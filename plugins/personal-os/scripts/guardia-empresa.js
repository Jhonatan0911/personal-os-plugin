#!/usr/bin/env node
// guardia-empresa.js — hook PreToolUse (Bash | PowerShell) de las reglas de la organización.
// Configuración: <OS_HOME>/guardia-empresa.json, generada por la skill reglas-organizacion (scripts/build.py)
// desde el registro de reglas de la organización. Sin ese archivo, el hook deja pasar todo.
//
// Bloquea (deny) o pregunta (ask):
//   · comandos que conectan a un servidor de `servidores_deny` (deny) o de `servidores_ask` (ask)
//   · git push a ramas protegidas o a ramas que no cumplen `patron_rama`, solo en repos cuyo remoto
//     coincide con `remotos_org` (sin `remotos_org`, en todos)
//   · el ejecutor de BD (bd-ejecutar.py <plan>, D-073): lee el plan, aplica el modo de ⚙ Config · Bases de datos para
//     cada acción del SQL (bloqueado → deny, me pregunta → ask con destino, servidor, IP, usuario, qué hace y el SQL;
//     automático → allow) y deja un pase de un solo uso atado a la huella del plan. Para una conexión registrada
//     manda la consola, también sobre las reglas de la organización.
//   · escrituras SQL/Mongo por cualquier otro camino (sqlcmd, wrappers de lectura…): deny, van por el ejecutor
//   · lecturas por los wrappers contra una conexión registrada: el modo de Leer de la consola.
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
  // D-073: un servidor registrado en ⚙ Config · Bases de datos lo gobierna la consola, no estas listas.
  const registrados = new Set(BD.conexiones(C.OS_HOME).map((c) => c.host));
  for (const h of cfg.servidores_deny || []) {
    if (registrados.has(BD.host(h))) continue;
    if (contiene(cmd, h)) return ['deny', `Producción no se toca: el comando conecta al servidor de producción ${h}. Si es una necesidad real, la ejecuta el usuario por sus canales.`];
  }
  for (const h of cfg.servidores_ask || []) {
    if (registrados.has(BD.host(h))) continue;
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
  // D-073: las escrituras solo van por el ejecutor, que aplica el permiso de la consola, la transacción y el rollback.
  return ['deny', ESCRIBE_POR_EJECUTOR(`${hallada.replace(/[.(]/g, '')} con ${cliente}`)];
}

// ── Conexiones de ⚙ Config · Bases de datos (D-072 F2) ─────────────────────────────────
// Reconoce la conexión por su host o por una de sus bases (con dbread el comando solo trae -ConfirmDb <base>) y
// la acción por las palabras de la sentencia. Escrituras: deny. Lectura: el modo de la consola, combinado con las
// reglas de la organización aplicadas al servidor de ESA conexión (así un dbread hacia una réplica también pregunta).
// Los wrappers se invocan con extensión (scripts\dbread.ps1): «contiene» no los ve porque el punto corta la palabra.
const WRAPPERS = /(^|[\\/\s"'])(dbread|mongoread|sqltest)(\.ps1|\.py)?(\s|"|'|$)/i;
// Lectores con subcomando de escritura (sqltest.py write …, a veces con el SQL en un archivo): se niegan siempre.
const ESCRITURA_WRAPPER = /(^|[\\/\s"'])sqltest(\.py)?["']?\s+(write|escribir|exec|ejecutar)\b/i;
const EJECUTOR = /(^|[\\/\s"'])bd-ejecutar(\.py)?["']?\s+("[^"]+"|'[^']+'|[^\s;&|]+)((?:\s+--[\w-]+)*)\s*$/i;
const conecta = (cmd) => CONECTORES.some((c) => contiene(cmd, c)) || DRIVERS.test(cmd) || WRAPPERS.test(cmd);

function revisarBd(cmd, cfg) {
  if (!conecta(cmd)) return null;
  if (ESCRITURA_WRAPPER.test(cmd)) return ['deny', ESCRIBE_POR_EJECUTOR('escritura con sqltest')];
  const halladas = BD.conexionesEn(cmd, BD.conexiones(C.OS_HOME));
  if (!halladas.length) return null;
  const nombres = halladas.map((c) => `«${c.nombre}»`).join(', ');
  const acc = BD.accion(cmd);
  if (acc !== 'leer') return ['deny', ESCRIBE_POR_EJECUTOR(`${BD.NOMBRE[acc]} en ${nombres}`)];
  // D-073: para una conexión registrada manda la consola (las listas de la organización no se suman).
  const r = [];
  for (const c of halladas) {
    if (c.leer === 'bloqueado') r.push(['deny', `Leer en «${c.nombre}» está bloqueado en ⚙ Config · Bases de datos.`]);
    if (c.leer === 'preguntar') r.push(['ask', `Leer en «${c.nombre}» está en «me pregunta» (⚙ Config · Bases de datos): confirma la consulta y la base.`]);
  }
  return masEstricta(r);
}

const ESCRIBE_POR_EJECUTOR = (que) => `${que}: las escrituras no se corren directo. Deja el plan (plan.json + consulta.sql + rollback.sql) y córrelo con bd-ejecutar.py: aplica el permiso de ⚙ Config · Bases de datos, la transacción y el rollback.`;

// ── Ejecutor de BD (D-073) ──────────────────────────────────────────────────────────────────────
// El comando debe ser SOLO la llamada al ejecutor: encadenado con otra cosa, el texto del diálogo no diría todo.
// Invocación = el comando arranca con python/py (con o sin «&» y comillas) y su script es bd-ejecutar.py.
// Nombrar el archivo en otro comando (copiarlo, leerlo) no es correrlo; y quien lo llame por otro camino no
// tiene pase, así que el ejecutor no corre.
const INVOCA_EJECUTOR = /^\s*(&\s*)?["']?[^"'\s]*?\bpy(thon3?|w)?(\.exe)?["']?\s+(-[A-Za-z]+\s+)*["']?[^"'\s]*bd-ejecutar(\.py)?["']?(\s|$)/i;
async function revisarEjecutor(cmd) {
  if (!INVOCA_EJECUTOR.test(cmd)) return null;
  const una = cmd.trim().replace(/^&\s*/, '');
  if (/[;&|\n]/.test(una.replace(/&&?\s*$/, ''))) return ['deny', 'El ejecutor de BD va solo en su comando, sin encadenar otros (así el diálogo muestra todo lo que corre).'];
  const m = una.match(EJECUTOR);
  if (!m) return ['deny', 'No reconozco el plan: usa bd-ejecutar.py <id-del-plan> [--rollback].'];
  const banderas = (m[4] || '').trim().split(/\s+/).filter(Boolean);
  const desconocida = banderas.find((b) => !['--rollback', '--simular'].includes(b));
  if (desconocida) return ['deny', `El ejecutor no acepta ${desconocida}.`];
  const p = BD.cargarPlan(C.OS_HOME, m[3], banderas.includes('--rollback') ? 'rollback' : 'consulta');
  if (!p.ok) return ['deny', `Plan de BD no válido: ${p.error}.`];
  if (p.modo === 'bloqueado') {
    const bloq = p.acciones.filter((a) => p.conexion.permisos[a] === 'bloqueado').map((a) => BD.NOMBRE[a]).join(', ');
    return ['deny', `${bloq} en «${p.conexion.nombre}» está bloqueado en ⚙ Config · Bases de datos.`];
  }
  BD.escribirPase(p);
  const ip = await resolverIp(p.conexion.host);
  let quien = 'Claude';
  try { quien = `Claude (sesión de ${require('os').userInfo().username})`; } catch (_) { /* sin usuario del sistema */ }
  return [p.modo === 'automatico' ? 'allow' : 'ask', BD.motivo(p, { ip, quien })];
}
function resolverIp(h) {
  if (!h || require('net').isIP(h)) return Promise.resolve(h);
  return new Promise((ok) => {
    const t = setTimeout(() => ok(''), 800);
    require('dns').lookup(h, (e, dir) => { clearTimeout(t); ok(e ? '' : dir); });
  });
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
process.stdin.on('end', async () => {
  let cmd = '';
  try {
    const ev = JSON.parse(entrada.replace(/^﻿/, '') || '{}');
    if (!/^(Bash|PowerShell)$/.test(ev.tool_name || '')) salir(null);
    cmd = String((ev.tool_input || {}).command || '');
    if (!cmd) salir(null);
    // Sin reglas de la organización igual rigen los permisos de la consola y la regla de escrituras.
    const cfg = C.leerJson(CONF, null) || { clientes_sql: ['sqlcmd', 'Invoke-Sqlcmd', 'osql', 'bcp', 'mongosh', 'mongo', 'psql', 'mysql'], sql_escritura: ['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'TRUNCATE', 'DROP', 'ALTER', 'CREATE'] };
    const cwd = ev.cwd || process.cwd();
    const ej = await revisarEjecutor(cmd);
    if (ej) salir(ej[0], ej[1], cmd);
    const r = masEstricta([revisarServidores(cmd, cfg), revisarBd(cmd, cfg), revisarSql(cmd, cfg)]) || revisarPush(cmd, cfg, cwd);
    if (r) salir(r[0], r[1], cmd);
    salir(null);
  } catch (e) {
    anotar(`ERROR · ${e && e.message} · ${cmd.slice(0, 120)}`);
    salir(null);
  }
});
