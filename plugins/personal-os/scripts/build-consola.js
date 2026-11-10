#!/usr/bin/env node
'use strict';
/**
 * build-consola.js — regenera la consola neuronal desde las notas del estado.
 *
 * Escribe dos archivos en la carpeta de estado (stateDir de config.json, o --estado <ruta>):
 *   · <stateDir>/consola.html      la vista (copia de la plantilla del plugin, sin datos dentro)
 *   · <stateDir>/_datos/datos.js   los datos vivos: window.ESTADO = { NODES, ITEMS, SINAPSIS, PRIO, … }
 *
 * POR QUÉ LOS DATOS VAN APARTE. Cuando los datos vivían pegados dentro del HTML había que
 * transcribirlos a mano en cada brief, y la consola quedaba vieja en días. Ahora la consola LEE y
 * este script ESCRIBE: regenerar es correr el build, nunca editar el HTML.
 *
 * POR QUÉ UN .js Y NO UN .json: la consola se abre con doble clic (protocolo file://) y ahí el
 * navegador BLOQUEA fetch() de archivos locales. Un <script src> sí carga. Así funciona sin servidor.
 *
 * LO QUE NO TOCA: el layout. fx/fy/r/label/full/scope/parent son diseño del usuario y viven en
 * <stateDir>/config/consola-layout.json (si no existe, se usa el ejemplo del plugin y se avisa).
 * Este script solo les inyecta los datos vivos.
 *
 * Fuentes que lee (todas opcionales; si faltan, la consola sale vacía pero válida):
 *   riesgos/*.md · compromisos/*.md · alcances/*.md   (una nota por objeto, frontmatter YAML)
 *   bitacora/AAAA-MM-DD.md                            (líneas "- **OS:** …" bajo "## HH:MM")
 *   _datos/prioridad.json                             (la #1 del día por ámbito; la escribe el brief)
 *
 * Uso:  node build-consola.js [--estado <ruta>] [--fecha AAAA-MM-DD | --hoy AAAA-MM-DD] [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const comun = require('./lib/comun.js');

const DRY = process.argv.includes('--dry-run');
const STATE = comun.stateDir();
if (!STATE) {
  console.error('✖ No hay carpeta de estado configurada.');
  console.error(`  Corre /os-setup (o define "stateDir" en ${path.join(comun.OS_HOME, 'config.json')}),`);
  console.error('  o pasa --estado <ruta> para una prueba.');
  process.exit(1);
}

// Fecha en la zona configurada (no en UTC: con toISOString una corrida nocturna devuelve el día
// siguiente y mide los vencimientos contra un día que aún no empieza).
const HOY = comun.arg('--fecha', null) || comun.hoyISO();
if (!/^\d{4}-\d{2}-\d{2}$/.test(HOY)) {
  console.error(`✖ Fecha inválida "${HOY}". Usa AAAA-MM-DD.`);
  process.exit(1);
}

const avisos = [];
const aviso = (m) => { avisos.push(m); };
const txt = (v) => (v === undefined || v === null ? '' : String(v)).trim();
const vacio = (v) => !txt(v) || /^(null|~|none|-)$/i.test(txt(v));

// ---------------------------------------------------------------- 0. LAYOUT

// --config-dir <ruta>: carpeta de configuración del usuario si no vive en <stateDir>/config
// (instalaciones anteriores al plugin la tienen junto al estado, no dentro).
const CONFIG_DIR = comun.arg('--config-dir', null) ? path.resolve(comun.arg('--config-dir', null)) : path.join(STATE, 'config');
const rutaLayoutUsuario = path.join(CONFIG_DIR, 'consola-layout.json');
const rutaLayoutPlugin = path.join(comun.PLUGIN_ROOT, 'plantillas', 'consola-layout.json');
let LAYOUT = null;
if (fs.existsSync(rutaLayoutUsuario)) {
  LAYOUT = comun.leerJson(rutaLayoutUsuario, null);
  if (!LAYOUT) aviso('config/consola-layout.json no es JSON válido: se usa el layout de ejemplo del plugin');
}
if (!LAYOUT) {
  LAYOUT = comun.leerJson(rutaLayoutPlugin, null);
  if (LAYOUT) {
    aviso('no existe config/consola-layout.json en tu estado: se usa el layout de EJEMPLO del plugin ' +
          '(nodos ficticios). Cópialo a config/ y pon ahí tus proyectos.');
  } else {
    aviso('no hay layout (ni el tuyo ni el de ejemplo): el mapa solo tendrá el núcleo');
    LAYOUT = {};
  }
}

// ---------------------------------------------------------------- 1. NODOS (layout + resumen vivo)

const NODES = (Array.isArray(LAYOUT.nodos) ? LAYOUT.nodos : [])
  .filter((n) => n && typeof n === 'object' && txt(n.id))
  .map((n) => ({ ...n, id: txt(n.id) }));

// La consola necesita un núcleo (kind "core") del que cuelgan los demás. Si el layout no lo trae,
// se pone uno al centro en vez de dejar el mapa sin ancla.
if (!NODES.some((n) => n.kind === 'core')) {
  NODES.unshift({ id: 'brain', label: 'NÚCLEO', full: 'Personal OS', kind: 'core', scope: 'both', fx: 0.5, fy: 0.5, r: 15 });
}

const byId = {};
for (const n of NODES) {
  if (byId[n.id]) { aviso(`el nodo ${n.id} está repetido en el layout; se usa el primero`); continue; }
  // Defaults defensivos: un nodo sin posición o sin ámbito rompe el dibujo.
  n.label = txt(n.label) || n.id;
  n.full = txt(n.full) || n.label;
  if (!['laboral', 'personal', 'both'].includes(n.scope)) n.scope = n.kind === 'core' ? 'both' : 'laboral';
  n.fx = Number.isFinite(Number(n.fx)) ? Number(n.fx) : 0.5;
  n.fy = Number.isFinite(Number(n.fy)) ? Number(n.fy) : 0.5;
  n.r = Number(n.r) > 0 ? Number(n.r) : (n.kind === 'core' ? 15 : 9);
  byId[n.id] = n;
}
const NODOS = Object.values(byId);
for (const n of NODOS) {
  if (n.parent && !byId[n.parent]) {
    aviso(`el nodo ${n.id} declara parent ${n.parent}, que no existe en el layout; cuelga del núcleo`);
    delete n.parent;
  }
}

// Traducción del campo `proyecto`/`cliente` de las notas al id de nodo.
const MAPA = {};
for (const [k, v] of Object.entries(LAYOUT.mapa_proyecto_a_nodo || {})) {
  if (!k.startsWith('_') && typeof v === 'string') MAPA[comun.sinTildes(k)] = v;
}
const NODO_DEFECTO = txt(LAYOUT.nodo_por_defecto) && byId[txt(LAYOUT.nodo_por_defecto)]
  ? txt(LAYOUT.nodo_por_defecto) : null;

/** proyecto de la nota -> id de nodo: mapa explícito > id de nodo igual > label/full igual. */
function nodoDe(valor) {
  const v = txt(valor).replace(/^\[\[(.*)\]\]$/, '$1').replace(/^"(.*)"$/, '$1').trim();
  if (!v) return null;
  const clave = comun.sinTildes(v);
  if (MAPA[clave] && byId[MAPA[clave]]) return MAPA[clave];
  for (const n of NODOS) {
    if (n.kind === 'core') continue;
    if (comun.sinTildes(n.id) === clave || comun.sinTildes(n.label) === clave || comun.sinTildes(n.full) === clave) return n.id;
  }
  return null;
}

// ---------------------------------------------------------------- 2. NOTAS

/**
 * Frontmatter YAML mínimo, tolerante: `clave: valor`, listas en línea `[a, b]` y listas en bloque
 * (`clave:` seguido de líneas `- x`). Tolera BOM y CRLF: con un regex solo-\n las notas guardadas
 * con salto de Windows se omitían EN SILENCIO y la consola pintaba un estado incompleto.
 * Un objeto anidado (`fuente:` con subclaves) se deja como texto vacío: aquí no se necesita.
 */
function parsearFrontmatter(texto) {
  const m = texto.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const fm = {};
  let abierta = null;
  for (const linea of m[1].split(/\r?\n/)) {
    const kv = linea.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) {
      let v = kv[2].trim();
      if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean).join(', ');
      else v = v.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      fm[kv[1]] = v;
      abierta = v === '' ? kv[1] : null;
      continue;
    }
    const item = linea.match(/^\s*-\s+(.*)$/);
    if (item && abierta) {
      const val = item[1].trim().replace(/^["']|["']$/g, '');
      fm[abierta] = fm[abierta] ? `${fm[abierta]}, ${val}` : val;
    } else if (/^\S/.test(linea)) {
      abierta = null;
    }
  }
  return { fm, cuerpo: m[2] };
}

/** Lee las notas .md de una carpeta del estado (salta README y plantillas). */
function leerNotas(carpeta) {
  const dir = path.join(STATE, carpeta);
  let archivos = [];
  try { archivos = fs.readdirSync(dir); } catch (e) { return []; }
  return archivos
    .filter((f) => f.endsWith('.md') && !/^(readme|_|plantilla)/i.test(f))
    .map((f) => {
      const texto = comun.leerTexto(path.join(dir, f), null);
      if (texto === null) { aviso(`${carpeta}/${f} no se pudo leer, se omite`); return null; }
      const p = parsearFrontmatter(texto);
      if (!p) { aviso(`${carpeta}/${f} no tiene frontmatter (líneas ---), se omite`); return null; }
      return { archivo: f, fm: p.fm, cuerpo: p.cuerpo };
    })
    .filter(Boolean);
}

/** El primer párrafo tras el título es la descripción que la tarjeta muestra. */
function primerParrafo(cuerpo, tope = 420) {
  const sinTitulo = String(cuerpo || '').replace(/^#[^\n]*\n/m, '');
  const p = sinTitulo.split(/\r?\n\s*\r?\n/).map((s) => s.trim())
    .find((s) => s && !s.startsWith('#') && !s.startsWith('>') && !s.startsWith('_') && !s.startsWith('|')) || '';
  return recortar(p.replace(/\s+/g, ' ').trim(), tope);
}
function recortar(s, tope) {
  return s.length > tope ? s.slice(0, tope).replace(/\s+\S*$/, '') + '…' : s;
}
const etiqueta = (fm, cuerpo) => {
  const titulo = txt(fm.titulo) || txt(fm.nombre);
  const parrafo = primerParrafo(cuerpo, 340);
  return [titulo, parrafo].filter(Boolean).join('. ') || '(sin descripción)';
};

/** `abierto_en_espera_de_tercero` -> `en espera de tercero`. */
const estadoCorto = (e) => (txt(e) || 'abierto').replace(/^abierto_?/, '').replace(/_/g, ' ').trim() || 'abierto';
const CERRADO = /^(cerrado|cumplido|hecho|resuelto|cancelado|descartado)/i;
const primeraClave = (v) => txt(v).split(',')[0].trim();
const idDe = (fm, archivo) => txt(fm.id) || archivo.replace(/\.md$/, '').split(/\s+[—-]\s+/)[0];

const ITEMS = [];
const sinNodo = [];

/**
 * Resuelve el nodo de una nota. Si no tiene, cae al `nodo_por_defecto` del layout; y si tampoco hay,
 * a un nodo "SIN NODO" que se crea al vuelo. Nunca se omite: un riesgo que no se ve es un riesgo oculto.
 */
const ID_SIN_NODO = '__sin_nodo';
function resolver(id, valor, clase) {
  const cli = nodoDe(valor);
  if (cli) return cli;
  const destino = NODO_DEFECTO || ID_SIN_NODO;
  if (destino === ID_SIN_NODO && !byId[ID_SIN_NODO]) {
    const n = { id: ID_SIN_NODO, label: 'SIN NODO', full: 'Notas cuyo proyecto no está en el layout', scope: 'laboral', fx: 0.62, fy: 0.86, r: 8 };
    NODOS.push(n);
    byId[ID_SIN_NODO] = n;
  }
  sinNodo.push(`${id} (${clase}, proyecto "${txt(valor) || 'vacío'}" -> ${byId[destino].label})`);
  return destino;
}

// --- riesgos: nivel 1-3 declarado en la nota
for (const nota of leerNotas('riesgos')) {
  const fm = nota.fm;
  if (CERRADO.test(txt(fm.estado)) || txt(fm.stub) === 'true') continue;
  const id = idDe(fm, nota.archivo);
  const cli = resolver(id, fm.proyecto || fm.cliente, 'riesgo');
  if (!cli) continue;
  ITEMS.push({
    id, cli, clase: 'riesgo',
    nivel: Math.min(3, Math.max(1, Number(fm.nivel) || 1)),
    estado: estadoCorto(fm.estado),
    tag: primeraClave(fm.issues) || 'riesgo',
    label: etiqueta(fm, nota.cuerpo),
  });
}

// --- compromisos: el nivel se deriva (vencido = 3, con fecha futura = 2, sin fecha = 1)
for (const nota of leerNotas('compromisos')) {
  const fm = nota.fm;
  if (CERRADO.test(txt(fm.estado)) || txt(fm.stub) === 'true') continue;
  const id = idDe(fm, nota.archivo);
  const cli = resolver(id, fm.proyecto || fm.cliente, 'compromiso');
  if (!cli) continue;
  const fecha = vacio(fm.fecha_limite) ? null : txt(fm.fecha_limite);
  const vencido = !!(fecha && fecha < HOY);
  ITEMS.push({
    id, cli, clase: 'compromiso',
    nivel: vencido ? 3 : (fecha ? 2 : 1),
    estado: vencido ? `VENCIDO ${fecha}` : (fecha === HOY ? 'vence HOY' : estadoCorto(fm.estado)),
    tag: primeraClave(fm.issues) || (/tercero/.test(txt(fm.direccion)) ? 'espera a tercero' : 'compromiso'),
    label: etiqueta(fm, nota.cuerpo),
  });
}

// --- alcances comprometidos: nivel 3 si está vencido, sin fecha o con puntos sin dueño;
//     2 si la entrega cae en los próximos 5 días hábiles; 1 en otro caso.
for (const nota of leerNotas('alcances')) {
  const fm = nota.fm;
  const est = (txt(fm.estado) || 'activo').toLowerCase();
  if (est === 'cumplido' || est === 'cancelado') continue;
  const id = idDe(fm, nota.archivo);
  const cli = resolver(id, fm.cliente || fm.proyecto, 'alcance');
  if (!cli) continue;
  const entrega = vacio(fm.fecha_entrega) ? null : txt(fm.fecha_entrega);
  const habiles = entrega ? comun.diasHabiles(HOY, entrega) : null;
  const sinDueno = Math.max(Number(fm.puntos_sin_issue) || 0, Number(fm.puntos_sin_responsable) || 0, Number(fm.puntos_sin_fecha) || 0);
  let nivel = 1;
  if (!entrega || (habiles !== null && habiles < 0) || sinDueno > 0) nivel = 3;
  else if (habiles !== null && habiles <= 5) nivel = 2;
  let estado = est;
  if (!entrega) estado = 'SIN FECHA de entrega';
  else if (habiles !== null && habiles < 0) estado = `VENCIDO ${entrega}`;
  else if (habiles === 0) estado = 'entrega HOY';
  else if (habiles !== null) estado = `entrega ${entrega} (en ${habiles} háb.)`;
  if (sinDueno > 0) estado += ` · ${sinDueno} punto(s) sin dueño`;
  ITEMS.push({
    id, cli, clase: 'alcance', nivel, estado,
    tag: 'alcance',
    label: etiqueta(fm, nota.cuerpo),
  });
}

// --- pendientes personales (opcional): bloques YAML `- id: P-<PREFIJO>-<n>` dentro de los .md de
//     <stateDir>/personal/. Solo corre si el layout declara `prefijo_item_a_nodo` (P-<PREFIJO> -> nodo).
//     Es la vista de los proyectos personales del usuario (scope "personal" del layout).
function bloquesP(texto) {
  const regs = [];
  let actual = null, abierta = null;
  for (const linea of String(texto).split(/\r?\n/)) {
    if (/^```/.test(linea)) continue;
    const nuevo = linea.match(/^- id: (P-[A-Z]+-\d+)\s*$/);
    if (nuevo) { actual = { id: nuevo[1], campos: {} }; regs.push(actual); abierta = null; continue; }
    if (!actual) continue;
    const kv = linea.match(/^ {2}([a-z_0-9]+):\s?(.*)$/);
    if (kv) { abierta = kv[1] in actual.campos ? null : kv[1]; if (abierta) actual.campos[abierta] = kv[2]; continue; }
    if (abierta && linea.trim()) actual.campos[abierta] += ' ' + linea.trim();
  }
  return regs;
}
const limpiarP = (v) => String(v || '').replace(/^"(.*)"$/s, '$1').replace(/\s+/g, ' ').trim();
const PREF = LAYOUT.prefijo_item_a_nodo || null;
const dirPersonal = path.join(STATE, 'personal');
if (PREF && fs.existsSync(dirPersonal)) {
  for (const archivo of fs.readdirSync(dirPersonal)) {
    if (!archivo.endsWith('.md')) continue;
    const texto = comun.leerTexto(path.join(dirPersonal, archivo), '');
    for (const r of bloquesP(texto)) {
      const c = r.campos;
      const nodo = PREF[r.id.split('-')[1]];
      if (!nodo || !byId[nodo]) { aviso(`${r.id} de personal/${archivo} no resuelve a un nodo (prefijo_item_a_nodo), se omite`); continue; }
      if (/^(hecho|cerrado|resuelto|cumplido)/i.test(limpiarP(c.estado))) continue;
      ITEMS.push({
        id: r.id, cli: nodo, clase: 'personal', nivel: Math.min(3, Math.max(1, Number(limpiarP(c.nivel)) || 1)),
        estado: limpiarP(c.siguiente_paso) === 'true' ? 'siguiente' : estadoCorto(limpiarP(c.estado)),
        tag: limpiarP(c.titulo).slice(0, 34) || 'pendiente',
        label: limpiarP(c.detalle) || limpiarP(c.titulo) || '(sin detalle)',
      });
    }
  }
}

if (sinNodo.length) {
  aviso(`notas sin nodo propio en el layout (añade su proyecto a mapa_proyecto_a_nodo): ${sinNodo.join(', ')}`);
}

// Red de seguridad: la consola hace byId[it.cli] sin comprobar; un cli inexistente la dejaría en blanco.
for (let i = ITEMS.length - 1; i >= 0; i--) {
  if (!byId[ITEMS[i].cli]) {
    aviso(`${ITEMS[i].id} apunta al nodo ${ITEMS[i].cli}, que no existe; se omite`);
    ITEMS.splice(i, 1);
  }
}

// El resumen del nodo (tooltip del mapa) se compone de sus ítems más graves.
for (const n of NODOS) {
  const suyos = ITEMS.filter((it) => it.cli === n.id).sort((a, b) => b.nivel - a.nivel);
  n.issues = suyos.length ? suyos.slice(0, 3).map((it) => `${it.id} (n${it.nivel}): ${it.tag}`).join(' · ') : '';
}

// ---------------------------------------------------------------- 3. SINAPSIS (bitácora del día)

const terminosPersonales = ((LAYOUT.sinapsis_personal && LAYOUT.sinapsis_personal.terminos) || [])
  .map((t) => comun.sinTildes(t)).filter(Boolean);
// Además de los términos declarados, el label de cada nodo personal del layout (no el id: un id
// corto como "LADO" clasificaría como personal cualquier frase que lo contenga).
for (const n of NODOS) {
  if (n.scope === 'personal') terminosPersonales.push(comun.sinTildes(n.label));
}
const esPersonal = (t) => { const b = comun.sinTildes(t); return terminosPersonales.some((x) => x && x.length > 3 && b.includes(x)); };

const SINAPSIS = [];
const rutaBitacora = path.join(STATE, 'bitacora', `${HOY}.md`);
const textoBitacora = comun.leerTexto(rutaBitacora, null);
if (textoBitacora === null) {
  aviso(`no hay bitácora de ${HOY}: la vista Bitácora saldrá vacía`);
} else {
  let hora = null;
  for (const linea of textoBitacora.split(/\r?\n/)) {
    const h = linea.match(/^## (\d{1,2}:\d{2})/);
    if (h) { hora = h[1].padStart(5, '0'); continue; }
    // Solo las líneas OS (el resumen de lo que se hizo). Los prompts crudos no son sinapsis.
    const os = linea.match(/^- \*\*OS:\*\*\s*(.*)$/);
    if (os && hora) {
      const texto = os[1].replace(/\s+/g, ' ').trim();
      if (texto) SINAPSIS.push({ t: hora, scope: esPersonal(texto) ? 'personal' : 'laboral', label: recortar(texto, 400) });
    }
  }
  if (!SINAPSIS.length) aviso(`la bitácora de ${HOY} no tiene líneas **OS:** (solo prompts): no hay sinapsis que pintar`);
}

// ---------------------------------------------------------------- 4. PRIORIDAD

// La #1 es juicio, no dato derivable: la escribe el brief en _datos/prioridad.json. Si no existe,
// la consola lo dice en vez de mostrar una prioridad inventada.
const sinFijar = { v: 'sin fijar', note: `Ninguna sesión ha fijado la prioridad de ${HOY}. Corre /brief y elígela; la consola no la inventa.` };
const prioLeida = comun.leerJson(path.join(STATE, '_datos', 'prioridad.json'), null);
if (!prioLeida) aviso('no existe _datos/prioridad.json (o no es JSON válido): la consola dirá que no hay prioridad fijada');
const PRIO = {};
for (const ambito of ['laboral', 'ambas', 'personal']) {
  const p = prioLeida && prioLeida[ambito];
  PRIO[ambito] = p && txt(p.v) ? { v: txt(p.v), note: txt(p.note) } : sinFijar;
}

// ---------------------------------------------------------------- 5. HITO (opcional)

let HITO = null;
if (LAYOUT.hito && /^\d{4}-\d{2}-\d{2}$/.test(txt(LAYOUT.hito.fecha))) {
  HITO = { etiqueta: txt(LAYOUT.hito.etiqueta) || 'Hito', fecha: txt(LAYOUT.hito.fecha) };
}

// ---------------------------------------------------------------- 6. escritura

const datos = {
  generado: new Date().toISOString(),
  fecha: HOY,
  hito: HITO,
  avisos,
  NODES: NODOS, ITEMS, SINAPSIS, PRIO,
};

const salidaDatos =
  '// GENERADO POR build-consola.js (plugin Personal OS) — NO EDITAR A MANO.\n' +
  '// Fuente: las notas de riesgos/, compromisos/ y alcances/, la bitácora del día y config/consola-layout.json.\n' +
  '// Si algo está mal aquí, se corrige en la nota o en el layout y se vuelve a correr el build.\n' +
  '// ARCHIVO PRIVADO: no se publica ni se sube a ningún servicio.\n' +
  `window.ESTADO = ${JSON.stringify(datos, null, 1)};\n`;

// Plantilla: la del usuario (config/consola.html) si decidió personalizarla; si no, la del plugin.
const rutaPlantillaUsuario = path.join(CONFIG_DIR, 'consola.html');
const rutaPlantillaPlugin = path.join(comun.PLUGIN_ROOT, 'plantillas', 'consola.html');
const plantilla = comun.leerTexto(rutaPlantillaUsuario, null) || comun.leerTexto(rutaPlantillaPlugin, null);
if (!plantilla) {
  console.error(`✖ No se encontró la plantilla de la consola (${rutaPlantillaPlugin}).`);
  process.exit(1);
}
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const html = plantilla.split('__COMANDO_BUILD__').join(escAttr(comun.comandoScript('build-consola.js')));

const nLab = ITEMS.filter((i) => byId[i.cli].scope === 'laboral').length;
const nPer = ITEMS.filter((i) => byId[i.cli].scope === 'personal').length;
console.log(`Consola neuronal · datos de ${HOY}`);
console.log(`Nodos: ${NODOS.length} · Ítems: ${ITEMS.length} (laboral ${nLab} · personal ${nPer}) · Sinapsis: ${SINAPSIS.length}`);
// Los avisos se imprimen y además viajan en datos.js: uno que no se ve no sirve de nada.
if (avisos.length) {
  console.log(`Avisos (${avisos.length}):`);
  for (const a of avisos) console.log(`  · ${a}`);
} else {
  console.log('Sin avisos.');
}

if (DRY) { console.log('\n--- DRY RUN: no se escribe nada ---'); process.exit(0); }

const rutaHtml = path.join(STATE, 'consola.html');
const rutaDatos = path.join(STATE, '_datos', 'datos.js');
// Escritura atómica (temporal + rename): un build interrumpido no deja un datos.js vacío o a medias.
const escribir = (ruta, contenido) => {
  const tmp = `${ruta}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contenido, 'utf8');
  fs.renameSync(tmp, ruta);
};
try {
  fs.mkdirSync(path.dirname(rutaDatos), { recursive: true });
  escribir(rutaDatos, salidaDatos);
  escribir(rutaHtml, html);
} catch (e) {
  console.error(`✖ No se pudo escribir la consola: ${e.message}`);
  process.exit(1);
}
console.log(`\nEscrito: ${rutaHtml}`);
console.log(`         ${rutaDatos} (${(salidaDatos.length / 1024).toFixed(1)} KB)`);
console.log('Vista LOCAL y privada: ábrela con doble clic; nunca la publiques.');
