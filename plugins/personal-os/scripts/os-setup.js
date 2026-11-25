#!/usr/bin/env node
/*
 * Personal OS — siembra la carpeta de estado y la configuración del usuario (lo usa /os-setup).
 *
 * Es idempotente y NUNCA pisa nada: si un archivo ya existe, lo deja como está y lo reporta.
 *
 * Uso:
 *   node os-setup.js --estado <ruta absoluta> [--owner "Nombre"] [--zona America/Bogota]
 *                    [--festivos 2026-01-01,2026-05-01,...]
 *   node os-setup.js --estado <ruta> --dry     → muestra lo que haría sin escribir
 *
 * Qué hace:
 *   1. Crea la carpeta de estado con riesgos/, compromisos/, decisiones/, alcances/, personas/,
 *      bitacora/, proyectos/, _datos/, handoff/, timesheet/ y config/ (con su README cada una).
 *   2. Copia las plantillas (tablero.md, config/fuentes.yaml, config/consola-layout.json, .gitignore).
 *   3. Escribe ~/.claude/personal-os/config.json desde la plantilla (o completa el existente sin
 *      borrar claves) con owner, stateDir, zonaHoraria y festivos.
 *   4. Escribe `active` en state.flag si no existe, y exigencia.json en `estricto` si no existe.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./lib/comun.js');

const dry = process.argv.includes('--dry');
const PLANT = path.join(C.PLUGIN_ROOT, 'plantillas');
const CARPETAS = ['riesgos', 'compromisos', 'decisiones', 'alcances', 'personas', 'bitacora',
  'proyectos', '_datos', 'handoff', 'timesheet', 'config'];

const hecho = [];
const respetado = [];

/** Valores de ejemplo de plantillas/config.json que nunca deben quedar como datos reales. */
const EJEMPLOS = new Set(['Nombre de un cliente', 'nombre-de-un-servidor', '10.0.0.', 'Tu Nombre']);
const esEjemplo = (v) => typeof v === 'string' && (/^\/ruta\//.test(v) || EJEMPLOS.has(v));
/** Quita en sitio los valores de ejemplo: strings «/ruta/…», listas con ejemplos y objetos cuya ruta es de ejemplo. */
function limpiarEjemplos(o) {
  let n = 0;
  if (Array.isArray(o)) {
    for (let i = o.length - 1; i >= 0; i--) {
      const v = o[i];
      if (esEjemplo(v) || (v && typeof v === 'object' && !Array.isArray(v) && esEjemplo(v.ruta))) { o.splice(i, 1); n++; }
      else if (v && typeof v === 'object') n += limpiarEjemplos(v);
    }
  } else if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) {
      if (k === 'owner') continue;   // «Tu Nombre» lo reemplaza --owner; si no lo dan, se queda para que se vea
      if (esEjemplo(o[k])) { delete o[k]; n++; } else if (o[k] && typeof o[k] === 'object') n += limpiarEjemplos(o[k]);
    }
  }
  return n;
}

function escribir(ruta, contenido) {
  if (fs.existsSync(ruta)) { respetado.push(ruta); return; }
  if (!dry) {
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, contenido, 'utf8');
  }
  hecho.push(ruta);
}

function copiarArbol(origen, destino) {
  if (!fs.existsSync(origen)) return;
  for (const e of fs.readdirSync(origen, { withFileTypes: true })) {
    const o = path.join(origen, e.name);
    let nombre = e.name === 'gitignore.txt' ? '.gitignore' : e.name;
    const d = path.join(destino, nombre);
    if (e.isDirectory()) copiarArbol(o, d);
    else escribir(d, C.leerTexto(o, ''));
  }
}

try {
  const estadoArg = C.arg('--estado', null);
  if (!estadoArg) {
    console.log('Uso: node os-setup.js --estado <ruta absoluta> [--owner "Nombre"] [--zona America/Bogota] [--festivos AAAA-MM-DD,...] [--dry]');
    process.exit(1);
  }
  const estado = path.resolve(estadoArg);
  const owner = C.arg('--owner', null);
  const zona = C.arg('--zona', null);
  const festivosArg = C.arg('--festivos', null);

  if (zona) {
    try { new Intl.DateTimeFormat('es', { timeZone: zona }); }
    catch (e) { console.log(`error: zona horaria "${zona}" no es válida (usa un nombre IANA, p. ej. America/Bogota)`); process.exit(1); }
  }
  const festivos = festivosArg ? festivosArg.split(/[,\s]+/).filter(Boolean) : null;
  if (festivos && festivos.some((f) => !/^\d{4}-\d{2}-\d{2}$/.test(f))) {
    console.log('error: --festivos espera fechas AAAA-MM-DD separadas por coma'); process.exit(1);
  }

  // 1-2. Carpeta de estado
  if (!dry) fs.mkdirSync(estado, { recursive: true });
  for (const c of CARPETAS) if (!dry) fs.mkdirSync(path.join(estado, c), { recursive: true });
  copiarArbol(path.join(PLANT, 'estado'), estado);
  const layout = path.join(PLANT, 'consola-layout.json');
  if (fs.existsSync(layout)) escribir(path.join(estado, 'config', 'consola-layout.json'), C.leerTexto(layout, ''));

  // 3. config.json (se completa, nunca se borra lo que ya tenga)
  const rutaCfg = path.join(C.OS_HOME, 'config.json');
  const existente = C.leerJson(rutaCfg, null);
  const base = existente || C.leerJson(path.join(PLANT, 'config.json'), {}) || {};
  base.stateDir = estado.replace(/\\/g, '/');
  // La plantilla trae ejemplos («/ruta/a/…», «Nombre de un cliente»). Antes se copiaban tal cual y en un equipo
  // nuevo la corteza, los ámbitos y la búsqueda apuntaban a rutas que no existen (25/11/2026: «la corteza no está
  // configurada» en la primera instalación de un cliente). Se quitan, también de un config.json ya sembrado.
  const quitados = limpiarEjemplos(base);
  if (quitados) hecho.push(`config.json: ${quitados} valor(es) de ejemplo quitados`);
  // Corteza (saber común): por defecto dentro del estado. Si la ruta declarada no existe, se usa esta.
  const co = base.conocimiento = (base.conocimiento && typeof base.conocimiento === 'object') ? base.conocimiento : {};
  const dirCO = co.dir ? path.resolve(String(co.dir).replace(/^~(?=$|[\\/])/, require('os').homedir())) : null;
  if (!dirCO || !fs.existsSync(dirCO)) {
    co.dir = path.join(estado, 'conocimiento').replace(/\\/g, '/');
    if (!dry) fs.mkdirSync(path.join(estado, 'conocimiento', '_propuestas'), { recursive: true });
    hecho.push(`${co.dir}/ (corteza: tus lecciones CO-###; el sueño semanal propone las primeras)`);
  }
  if (!co.salida) co.salida = '~/.claude/rules/conocimiento';
  if (!Array.isArray(co.terminosProhibidos)) co.terminosProhibidos = [];
  if (owner) base.owner = owner;
  if (zona) base.zonaHoraria = zona;
  if (festivos) base.festivos = Array.from(new Set([...(Array.isArray(base.festivos) ? base.festivos : []), ...festivos])).sort();
  if (!dry) {
    fs.mkdirSync(C.OS_HOME, { recursive: true });
    fs.writeFileSync(rutaCfg, JSON.stringify(base, null, 2) + '\n', 'utf8');
  }
  hecho.push(rutaCfg + (existente ? ' (completado, sin borrar claves)' : ' (nuevo)'));

  // 4. bandera y dial
  escribir(path.join(C.OS_HOME, 'state.flag'), 'active');
  escribir(path.join(C.OS_HOME, 'exigencia.json'),
    JSON.stringify({ nivel: 'estricto', actualizado: `${C.ahora().ymd}`, por: 'os-setup' }, null, 2) + '\n');

  const rel = (p) => p.replace(/\\/g, '/');
  console.log(`${dry ? '[dry] ' : ''}Personal OS listo en ${rel(estado)}`);
  console.log(`\nCreado (${hecho.length}):`);
  hecho.forEach((p) => console.log('  + ' + rel(p)));
  if (respetado.length) {
    console.log(`\nYa existía, no se tocó (${respetado.length}):`);
    respetado.forEach((p) => console.log('  = ' + rel(p)));
  }
  console.log('\nSiguiente: completa los <placeholders> de config/fuentes.yaml y, en config.json, '
    + 'timesheet (categorías, clientes, jornada) y festivos de tu país.');
} catch (e) {
  console.log('error: ' + e.message);
  process.exit(1);
}
