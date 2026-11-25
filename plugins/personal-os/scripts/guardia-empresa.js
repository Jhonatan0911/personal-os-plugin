#!/usr/bin/env node
// guardia-empresa.js — hook PreToolUse (Bash | PowerShell) de las reglas de la organización.
// Configuración: <OS_HOME>/guardia-empresa.json, generada por la skill reglas-organizacion (scripts/build.py)
// desde el registro de reglas de la organización. Sin ese archivo, el hook deja pasar todo.
//
// Bloquea (deny) o pregunta (ask):
//   · comandos que conectan a un servidor de `servidores_deny` (deny) o de `servidores_ask` (ask)
//   · git push a ramas protegidas o a ramas que no cumplen `patron_rama`, solo en repos cuyo remoto
//     coincide con `remotos_org` (sin `remotos_org`, en todos)
//   · escrituras SQL/Mongo por cliente de línea de comandos: deny SIEMPRE (D-071 F2: Claude no ejecuta escrituras,
//     las entrega como script de publicación + rollback)
//   · lecturas contra una conexión de ⚙ Config · Bases de datos (<OS_HOME>/conexiones-bd.json): bloqueado → deny,
//     me pregunta → ask, automático → sin intervenir. Gana siempre la regla más estricta con las de la organización.
// Los motivos son textos para el usuario; las reglas y sus ids viven en el registro de la organización.
// Compara el texto del comando: es una red de seguridad, no una frontera de seguridad.
// Ante cualquier error propio deja pasar (no puede tumbar la sesión) y lo anota en el log.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const C = require('./lib/comun.js');
const BD = require('./lib/bd-permisos.js');
const CONF = path.join(C.OS_HOME, 'guardia-empresa.json');
const LOG = path.join(C.OS_HOME, 'guardia-empresa.log');

function anotar(linea) {
  try { fs.appendFileSync(LOG, `${new Date().toISOString()} ${linea}\n`); } catch (_) { /* sin log no se frena */ }
}

function salir(decision, motivo, cmd) {
  if (decision) {
    anotar(`${decision.toUpperCase()} · ${motivo} · ${String(cmd).slice(0, 200).replace(/\s+/g, ' ')}`);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: motivo },
    }));
  }
  process.exit(0);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const contiene = (texto, palabra) => new RegExp(`(^|[^\\w.])${esc(palabra)}($|[^\\w.])`, 'i').test(texto);

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).trim();
  } catch (_) { return ''; }
}

// ── Servidores de producción ───────────────────────────────────────────────────────────────────────
// Solo cuenta si el comando usa algo que conecta (cliente de BD o de red, o un driver en línea).
// Nombrar la IP en una nota, un grep o un documento no conecta a nada (falso positivo del 18/11/2026).
const CONECTORES = ['sqlcmd', 'Invoke-Sqlcmd', 'osql', 'bcp', 'sqlpackage', 'mongosh', 'mongo', 'mongodump', 'mongoexport',
  'psql', 'mysql', 'ssh', 'scp', 'sftp', 'rsync', 'telnet', 'nc', 'ncat', 'ping', 'Test-NetConnection', 'Test-Connection',
  'curl', 'wget', 'Invoke-WebRequest', 'Invoke-RestMethod', 'iwr', 'irm', 'Enter-PSSession', 'New-PSSession',
  'Invoke-Command', 'mstsc', 'net use', 'New-PSDrive', 'dbread', 'mongoread'];
const DRIVERS = /SqlConnection|SqlClient|pyodbc|pymssql|pymongo|MongoClient|Server\s*=|Data Source\s*=|mongodb(\+srv)?:\/\/|\\\\\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\\/i;

function revisarServidores(cmd, cfg) {
  if (!conecta(cmd)) return null;
  for (const h of cfg.servidores_deny || []) {
    if (contiene(cmd, h)) return ['deny', `Producción no se toca: el comando conecta al servidor de producción ${h}. Si es una necesidad real, la ejecuta el usuario por sus canales.`];
  }
  for (const h of cfg.servidores_ask || []) {
    if (contiene(cmd, h)) return ['ask', `${h} es una réplica de producción: solo lectura y con OK explícito del usuario para esta consulta.`];
  }
  return null;
}

// ── git push ────────────────────────────────────────────────────────────────────────────
function segmentosPush(cmd) {
  // cada sub-comando separado por ; && || | o salto de línea que sea un `git ... push ...`
  return cmd.split(/;|&&|\|\||\||\r?\n/).map((s) => s.trim()).filter((s) => /(^|\s)git(\.exe)?\s.*\bpush\b/.test(s));
}

function tokens(s) {
  const out = []; const re = /"([^"]*)"|'([^']*)'|(\S+)/g; let m;
  while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function esDeLaOrg(url, cfg) {
  const pats = cfg.remotos_org || [];
  if (!pats.length) return true;
  return pats.some((p) => { try { return new RegExp(p, 'i').test(url || ''); } catch (_) { return false; } });
}

function revisarPush(cmd, cfg, cwdBase) {
  const protegidas = new Set((cfg.ramas_protegidas || []).map((r) => r.toLowerCase()));
  const patron = cfg.patron_rama ? new RegExp(cfg.patron_rama) : null;
  for (const seg of segmentosPush(cmd)) {
    const t = tokens(seg);
    let i = t.findIndex((x) => /^git(\.exe)?$/i.test(x));
    let cwd = cwdBase;
    // opciones globales de git antes del subcomando (-C <dir>, -c k=v)
    for (i = i + 1; i < t.length && t[i] !== 'push'; i++) {
      if (t[i] === '-C' && t[i + 1]) { cwd = path.resolve(cwdBase, t[i + 1]); i++; } else if (t[i] === '-c') i++;
    }
    if (t[i] !== 'push') continue;
    const args = t.slice(i + 1);
    if (args.some((a) => a === '--tags' || a === '--dry-run' || a === '-n')) continue;
    const posicionales = []; let borrar = false;
    for (let k = 0; k < args.length; k++) {
      const a = args[k];
      if (a === '-d' || a === '--delete') { borrar = true; continue; }
      if (/^(--repo|--receive-pack|--exec|-o|--push-option)$/.test(a)) { k++; continue; }
      if (a.startsWith('-')) continue;
      posicionales.push(a);
    }
    const remoto = posicionales[0] || 'origin';
    const url = git(['remote', 'get-url', remoto], cwd) || remoto;
    if (!esDeLaOrg(url, cfg)) continue; // repos personales y de otras organizaciones: no aplica
    let destinos = posicionales.slice(1).map((r) => {
      let d = r.replace(/^\+/, '');
      if (d.includes(':')) d = d.split(':')[1] || d.split(':')[0];
      return d.replace(/^refs\/heads\//, '');
    }).filter((d) => d && !d.startsWith('refs/tags/'));
    if (!destinos.length) {
      const actual = git(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
      if (!actual || actual === 'HEAD') continue; // no se pudo saber la rama: lo decide la revisión de PR
      destinos = [actual];
    }
    for (const d of destinos) {
      if (protegidas.has(d.toLowerCase())) {
        return ['deny', `${borrar ? 'Borrar' : 'Hacer push a'} «${d}» no se permite: es una rama protegida y todo entra por PR.`];
      }
      if (!borrar && patron && !patron.test(d)) {
        return ['deny', `La rama «${d}» no cumple el formato de ramas de la organización (${cfg.patron_rama}). Renómbrala con la clave de Jira antes de publicarla.`];
      }
    }
  }
  return null;
}

// ── Escrituras en BD ─────────────────────────────────────────────────────────────────
const MONGO_ESCRITURA = ['insert', 'insertOne', 'insertMany', 'update', 'updateOne', 'updateMany', 'replaceOne',
  'delete', 'deleteOne', 'deleteMany', 'remove', 'drop', 'dropDatabase', 'createIndex', 'bulkWrite', 'findOneAndUpdate',
  'findOneAndDelete', 'findOneAndReplace', 'renameCollection'];

function revisarSql(cmd, cfg) {
  const cliente = (cfg.clientes_sql || []).find((c) => contiene(cmd, c));
  if (!cliente) return null;
  const esMongo = /^mongo/i.test(cliente);
  const palabras = esMongo ? MONGO_ESCRITURA.map((m) => `.${m}(`) : cfg.sql_escritura || [];
  const hallada = esMongo
    ? palabras.find((p) => cmd.includes(p))
    : palabras.find((p) => new RegExp(`\\b${esc(p)}\\b`, 'i').test(cmd));
  if (!hallada) return null;
  // D-071 F2 (25/11/2026): ni en test. Claude redacta el script; lo ejecuta el usuario por sus canales.
  return ['deny', `Escritura (${hallada.replace(/[.(]/g, '')}) con ${cliente}. Claude no ejecuta escrituras en ninguna base: entrégala como script idempotente de publicación + rollback para que el usuario la corra.`];
}

// ── Conexiones de ⚙ Config · Bases de datos (D-071 F2) ─────────────────────────────────
// Reconoce la conexión por su host o por una de sus bases (con dbread el comando solo trae -ConfirmDb <base>) y
// la acción por las palabras de la sentencia. Escrituras: deny. Lectura: el modo de la consola, combinado con las
// reglas de la organización aplicadas al servidor de ESA conexión (así un dbread hacia una réplica también pregunta).
// Los wrappers se invocan con extensión (scripts\dbread.ps1): «contiene» no los ve porque el punto corta la palabra.
const WRAPPERS = /(^|[\\/\s"'])(dbread|mongoread)(\.ps1|\.py)?(\s|"|'|$)/i;
const conecta = (cmd) => CONECTORES.some((c) => contiene(cmd, c)) || DRIVERS.test(cmd) || WRAPPERS.test(cmd);

function revisarBd(cmd, cfg) {
  if (!conecta(cmd)) return null;
  const halladas = BD.conexionesEn(cmd, BD.conexiones(C.OS_HOME));
  if (!halladas.length) return null;
  const nombres = halladas.map((c) => `«${c.nombre}»`).join(', ');
  const acc = BD.accion(cmd);
  if (acc !== 'leer') return ['deny', `${acc[0].toUpperCase() + acc.slice(1)} en ${nombres}: Claude no ejecuta escrituras. Entrégalo como script de publicación + rollback para que el usuario lo corra.`];
  const r = [];
  for (const c of halladas) {
    if ((cfg.servidores_deny || []).some((h) => BD.host(h) === c.host)) r.push(['deny', `${nombres} apunta a un servidor de producción bloqueado por las reglas de la organización. Gana la regla más estricta.`]);
    if (c.leer === 'bloqueado') r.push(['deny', `Leer en «${c.nombre}» está bloqueado en ⚙ Config · Bases de datos.`]);
    if ((cfg.servidores_ask || []).some((h) => BD.host(h) === c.host)) r.push(['ask', `«${c.nombre}» es una réplica de producción según las reglas de la organización: OK explícito para esta consulta.`]);
    if (c.leer === 'preguntar') r.push(['ask', `Leer en «${c.nombre}» está en «me pregunta» (⚙ Config · Bases de datos): confirma la consulta y la base.`]);
  }
  return masEstricta(r);
}

/** De varias decisiones, la más estricta: deny > ask > nada. */
function masEstricta(lista) {
  const v = lista.filter(Boolean);
  return v.find((x) => x[0] === 'deny') || v.find((x) => x[0] === 'ask') || null;
}

// ── principal ────────────────────────────────────────────────────────────────────────────────
let entrada = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { entrada += c; });
process.stdin.on('end', () => {
  let cmd = '';
  try {
    const ev = JSON.parse(entrada.replace(/^﻿/, '') || '{}');
    if (!/^(Bash|PowerShell)$/.test(ev.tool_name || '')) salir(null);
    cmd = String((ev.tool_input || {}).command || '');
    if (!cmd) salir(null);
    // Sin reglas de la organización igual rigen los permisos de la consola y la regla de escrituras.
    const cfg = C.leerJson(CONF, null) || { clientes_sql: ['sqlcmd', 'Invoke-Sqlcmd', 'osql', 'bcp', 'mongosh', 'mongo', 'psql', 'mysql'], sql_escritura: ['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'TRUNCATE', 'DROP', 'ALTER', 'CREATE'] };
    const cwd = ev.cwd || process.cwd();
    const r = masEstricta([revisarServidores(cmd, cfg), revisarBd(cmd, cfg), revisarSql(cmd, cfg)]) || revisarPush(cmd, cfg, cwd);
    if (r) salir(r[0], r[1], cmd);
    salir(null);
  } catch (e) {
    anotar(`ERROR · ${e && e.message} · ${cmd.slice(0, 120)}`);
    salir(null);
  }
});
