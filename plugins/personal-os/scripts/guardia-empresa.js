#!/usr/bin/env node
// guardia-empresa.js — hook PreToolUse (Bash | PowerShell) de las reglas de la organización.
// Configuración: <OS_HOME>/guardia-empresa.json, generada por la skill reglas-organizacion (scripts/build.py)
// desde el registro de reglas de la organización. Sin ese archivo, el hook deja pasar todo.
//
// Bloquea (deny) o pregunta (ask):
//   · comandos que conectan a un servidor de `servidores_deny` (deny) o de `servidores_ask` (ask)
//   · git push a ramas protegidas o a ramas que no cumplen `patron_rama`, solo en repos cuyo remoto
//     coincide con `remotos_org` (sin `remotos_org`, en todos)
//   · escrituras SQL/Mongo por cliente de línea de comandos (ask en `servidores_test`, deny en el resto)
// Los motivos son textos para el usuario; las reglas y sus ids viven en el registro de la organización.
// Compara el texto del comando: es una red de seguridad, no una frontera de seguridad.
// Ante cualquier error propio deja pasar (no puede tumbar la sesión) y lo anota en el log.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const C = require('./lib/comun.js');
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
  if (!CONECTORES.some((c) => contiene(cmd, c)) && !DRIVERS.test(cmd)) return null;
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
  const enTest = (cfg.servidores_test || []).some((h) => contiene(cmd, h));
  if (enTest) return ['ask', `Escritura (${hallada.replace(/[.(]/g, '')}) en la base de test con ${cliente}. Claude no ejecuta escrituras: se entregan como script con rollback. Solo sigue si el usuario lo autoriza expresamente.`];
  return ['deny', `Escritura (${hallada.replace(/[.(]/g, '')}) con ${cliente} fuera de la base de test. Las escrituras no las ejecuta Claude: se entregan como script idempotente de publicación + rollback.`];
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
    const cfg = JSON.parse(fs.readFileSync(CONF, 'utf8'));
    const cwd = ev.cwd || process.cwd();
    const r = revisarServidores(cmd, cfg) || revisarPush(cmd, cfg, cwd) || revisarSql(cmd, cfg);
    if (r) salir(r[0], r[1], cmd);
    salir(null);
  } catch (e) {
    anotar(`ERROR · ${e && e.message} · ${cmd.slice(0, 120)}`);
    salir(null);
  }
});
