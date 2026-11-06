'use strict';
/*
 * Personal OS — utilidades comunes de los scripts del plugin.
 *
 * Dónde vive cada cosa:
 *   · El CÓDIGO viaja con el plugin (esta carpeta). Se actualiza al actualizar el plugin.
 *   · La CONFIGURACIÓN y la bandera del usuario viven en ~/.claude/personal-os/
 *     (config.json, state.flag, exigencia.json). Se puede mover con la variable
 *     de entorno PERSONAL_OS_HOME (útil para pruebas o para varias identidades).
 *   · El ESTADO (notas, bitácora, alcances…) vive en la carpeta `stateDir` que el usuario
 *     eligió en /os-setup. Nunca dentro del plugin.
 *
 * Regla de oro: nada aquí lanza hacia afuera en una lectura. Si falta un archivo, se devuelve
 * el valor por defecto y el script que llama decide; un hook que revienta deja de usarse.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const OS_HOME = process.env.PERSONAL_OS_HOME
  ? path.resolve(process.env.PERSONAL_OS_HOME)
  : path.join(os.homedir(), '.claude', 'personal-os');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT
  ? path.resolve(process.env.CLAUDE_PLUGIN_ROOT)
  : path.resolve(__dirname, '..', '..');

/** Lee un archivo de texto quitando el BOM (PowerShell y Notepad lo escriben). */
function leerTexto(ruta, porDefecto = null) {
  try {
    let t = fs.readFileSync(ruta, 'utf8');
    if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
    return t;
  } catch (e) { return porDefecto; }
}

function leerJson(ruta, porDefecto = null) {
  const t = leerTexto(ruta, null);
  if (t === null) return porDefecto;
  try { return JSON.parse(t); } catch (e) { return porDefecto; }
}

/** Argumento de línea de comandos: --nombre valor */
function arg(nombre, porDefecto = null) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : porDefecto;
}

let _cfg;
/** ~/.claude/personal-os/config.json (o {} si no existe). */
function config() {
  if (_cfg === undefined) _cfg = leerJson(path.join(OS_HOME, 'config.json'), {}) || {};
  return _cfg;
}

/** Bandera del toggle /os-on · /os-off. Instalación nueva (sin bandera) = activo. */
function flag() {
  const t = leerTexto(path.join(OS_HOME, 'state.flag'), null);
  return t === null ? 'active' : t.trim().toLowerCase();
}
function activo() { return flag() === 'active'; }

/** Carpeta de estado: --estado <ruta> (pruebas) > config.json stateDir > null. */
function stateDir() {
  const forzado = arg('--estado', null);
  if (forzado) return path.resolve(forzado);
  const s = config().stateDir;
  return s ? path.resolve(s) : null;
}

/** Zona horaria configurada (IANA, p. ej. "America/Bogota"); null = la del sistema. */
function zona() {
  const z = config().zonaHoraria;
  if (!z) return null;
  try { new Intl.DateTimeFormat('es', { timeZone: z }); return z; } catch (e) { return null; }
}

const pad = (n) => String(n).padStart(2, '0');

/** Fecha y hora "ahora" en la zona configurada: { ymd, hm, dow } (dow 0 = domingo). */
function ahora(d = new Date()) {
  const tz = zona();
  if (tz) {
    const partes = {};
    for (const p of new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(d)) partes[p.type] = p.value;
    const dows = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { ymd: `${partes.year}-${partes.month}-${partes.day}`,
             hm: `${partes.hour}:${partes.minute}`, dow: dows[partes.weekday] };
  }
  return { ymd: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
           hm: `${pad(d.getHours())}:${pad(d.getMinutes())}`, dow: d.getDay() };
}

/** Hoy en ISO (respeta --hoy AAAA-MM-DD para pruebas). */
function hoyISO() {
  const forzada = arg('--hoy', null);
  return forzada || ahora().ymd;
}

function diasEntre(desdeISO, hastaISO) {
  const a = Date.parse(desdeISO + 'T00:00:00Z');
  const b = Date.parse(hastaISO + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

let _festivos;
/** Festivos configurados (lista de AAAA-MM-DD en config.json → festivos). */
function festivos() {
  if (!_festivos) {
    const f = config().festivos;
    _festivos = new Set(Array.isArray(f) ? f.map(String) : []);
  }
  return _festivos;
}

function isoDe(d) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }

function esHabil(iso) {
  const d = new Date(Date.parse(iso + 'T00:00:00Z'));
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6 && !festivos().has(iso);
}

/** Días HÁBILES de `desde` (excl.) a `hasta` (incl.); negativo si ya pasó. Excluye festivos. */
function diasHabiles(desdeISO, hastaISO) {
  const brutos = diasEntre(desdeISO, hastaISO);
  if (brutos === null) return null;
  if (brutos === 0) return 0;
  const paso = brutos > 0 ? 1 : -1;
  let n = 0;
  const cur = new Date(Date.parse(desdeISO + 'T00:00:00Z'));
  for (let i = 0; i !== brutos; i += paso) {
    cur.setUTCDate(cur.getUTCDate() + paso);
    if (esHabil(isoDe(cur))) n += paso;
  }
  return n;
}

/** Minúsculas y sin tildes: para comparar texto que pasa por consolas que manglan acentos. */
const sinTildes = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Comando portable para citar un script del plugin en mensajes al modelo. */
function comandoScript(nombre) {
  return `node "${path.join(PLUGIN_ROOT, 'scripts', nombre).replace(/\\/g, '/')}"`;
}

module.exports = {
  OS_HOME, PLUGIN_ROOT, leerTexto, leerJson, arg, config, flag, activo, stateDir, zona,
  ahora, hoyISO, diasEntre, diasHabiles, esHabil, festivos, sinTildes, comandoScript, pad,
};
