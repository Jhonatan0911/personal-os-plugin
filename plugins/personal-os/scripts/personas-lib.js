'use strict';
/*
 * Personal OS — librería compartida del módulo de personas.
 *
 * La usan personas-append.js, personas-query.js, personas-doa.js y la skill `personas`.
 *
 * Dónde vive cada cosa: las fichas están en <stateDir>/personas/ (una nota por persona con
 * frontmatter YAML), junto con dos archivos especiales:
 *   · _dominios.md       diccionario de frentes funcionales y sus alias (el enlace semántico).
 *   · _identidades.yaml  mapa persona → identidades de Jira / git / correo (para cruzar datos).
 * Todo archivo que empiece por "_" (incluido _ejemplo.md) y el README NO se leen como ficha.
 *
 * Filosofía: parsers que NO pretenden ser YAML completo, pero que NUNCA fallan en silencio. Si
 * algo no se entiende, la clave no existe y el chequeo de arriba reporta "falta el dato" — que es
 * el lado seguro del error. Un módulo de personas que se calla cuando no entiende un archivo es
 * peor que no tenerlo: responde con media verdad sobre gente real.
 */

const fs = require('fs');
const path = require('path');
const C = require('./lib/comun.js');

// ─────────────────────────────────────────────────────────────── utilidades

const arg = C.arg;
const hoyISO = C.hoyISO;
const diasEntre = (desde, hasta) => C.diasEntre(String(desde), String(hasta));

/** Carpeta de estado (--estado <ruta> > config.json stateDir). null si el usuario no corrió /os-setup. */
function stateDir() { return C.stateDir(); }

function dirPersonas(base) {
  const b = base || stateDir();
  return b ? path.join(b, 'personas') : null;
}

/** Mensaje estándar cuando no hay carpeta de estado configurada. */
const SIN_ESTADO = 'El Personal OS no tiene carpeta de estado configurada.\n' +
  'Corre /os-setup (o pasa --estado <ruta> para pruebas).';

/**
 * Argumentos posicionales a partir de `desde`, saltando las banderas y el VALOR de las banderas
 * que llevan uno (--estado <ruta>, --hoy <fecha>…). Sin esto, "persona ana --estado /tmp/x"
 * buscaría a "ana /tmp/x" y no la encontraría.
 */
const BANDERAS_CON_VALOR = new Set([
  '--estado', '--hoy', '--hecho', '--frente', '--nivel', '--desde', '--fuente',
  '--evidencia', '--motivo', '--repos', '--repo',
]);
function posicionales(desde) {
  const out = [];
  const a = process.argv.slice(desde);
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) { if (BANDERAS_CON_VALOR.has(a[i])) i += 1; continue; }
    out.push(a[i]);
  }
  return out;
}

/**
 * Normaliza para comparar: minúsculas y sin tildes.
 * La gente escribe "facturación" y "facturacion", "integración" e "integracion" — y un
 * diccionario que no los una no sirve para nada. Esto NO se aplica al guardar, solo al buscar.
 */
function normalizar(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');
}

function limpia(v) {
  let s = String(v).trim();
  s = s.replace(/\s+#.*$/, '');                      // comentario al final de línea
  if (/^".*"$/.test(s) || /^'.*'$/.test(s)) s = s.slice(1, -1);
  if (s === 'null' || s === '~' || s === '') return '';
  return s.trim();
}

/** Lista inline: [a, b, "c d"] → ['a','b','c d'] */
function parseLista(s) {
  const m = /^\[(.*)\]$/.exec(String(s).trim());
  if (!m) return null;
  if (!m[1].trim()) return [];
  return m[1].split(',').map((x) => limpia(x)).filter((x) => x !== '');
}

function txt(v) {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.length ? String(v[0]).trim() : '';
  if (typeof v === 'object') return '';
  return String(v).trim();
}

// ───────────────────────────────────────────────────── parser de estructuras

/**
 * Une las líneas de una lista inline partida en varias:
 *    alias: [pagos, pasarela,
 *            checkout]
 * El diccionario de frentes suele escribirse así para leerlo a ojo, y sin esto se pierden justo
 * los alias del final — que son los que el usuario usa cuando habla rápido.
 */
function unirListasMultilinea(lineas) {
  const out = [];
  let buffer = null;
  for (const linea of lineas) {
    if (buffer !== null) {
      buffer += ' ' + linea.trim();
      if (buffer.includes(']')) { out.push(buffer); buffer = null; }
      continue;
    }
    const abre = (linea.match(/\[/g) || []).length;
    const cierra = (linea.match(/\]/g) || []).length;
    if (abre > cierra) { buffer = linea; continue; }
    out.push(linea);
  }
  if (buffer !== null) out.push(buffer);   // lista sin cerrar: se entrega como esté
  return out;
}

/**
 * Parser de listas de objetos indentados:
 *    clave_raiz:
 *      - a: 1
 *        b: 2
 *      - a: 3
 * Devuelve [{a:'1',b:'2'}, {a:'3'}]. Los bloques `|` (texto libre multilínea) se guardan como una
 * sola cadena.
 */
function parseListaObjetos(texto, claveRaiz) {
  const lineas = unirListasMultilinea(String(texto).split(/\r?\n/));
  const items = [];
  let dentro = false;
  let actual = null;
  let bloque = null;          // {clave, indent, partes} mientras se acumula un `|`

  for (const linea of lineas) {
    if (!dentro) {
      if (new RegExp('^' + claveRaiz + '\\s*:\\s*$').test(linea)) dentro = true;
      continue;
    }
    if (/^\S/.test(linea) && linea.trim() !== '') {          // volvió al margen: se acabó
      if (bloque && actual) actual[bloque.clave] = bloque.partes.join('\n').trim();
      break;
    }
    if (!linea.trim()) { if (bloque) bloque.partes.push(''); continue; }

    const indent = linea.match(/^\s*/)[0].length;

    if (bloque) {
      if (indent > bloque.indent) { bloque.partes.push(linea.trim()); continue; }
      if (actual) actual[bloque.clave] = bloque.partes.join('\n').trim();
      bloque = null;
    }
    if (/^\s*#/.test(linea)) continue;

    const item = /^\s*-\s+([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(linea);
    if (item) {
      actual = {};
      items.push(actual);
      asigna(actual, item[1], item[2]);
      continue;
    }
    const kv = /^\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(linea);
    if (kv && actual) {
      if (kv[2].trim() === '|' || kv[2].trim() === '>') {
        bloque = { clave: kv[1], indent, partes: [] };
        continue;
      }
      asigna(actual, kv[1], kv[2]);
    }
  }
  if (bloque && actual) actual[bloque.clave] = bloque.partes.join('\n').trim();
  return items;

  function asigna(obj, clave, crudo) {
    const lista = parseLista(crudo);
    obj[clave] = lista !== null ? lista : limpia(crudo);
  }
}

/** Frontmatter de una nota: claves simples, listas y un nivel de anidación. */
function parseFrontmatter(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto);
  if (!m) return {};
  const out = {};
  let padre = null;
  let listaEn = null;

  for (const linea of unirListasMultilinea(m[1].split(/\r?\n/))) {
    if (!linea.trim() || /^\s*#/.test(linea)) continue;
    const indent = linea.match(/^\s*/)[0].length;

    const item = /^\s*-\s+(.*)$/.exec(linea);
    if (item && !/^\s*-\s+[A-Za-z0-9_]+\s*:/.test(linea)) {
      if (listaEn) listaEn.obj[listaEn.clave].push(limpia(item[1]));
      continue;
    }
    if (item) continue;                       // lista de objetos: se lee con parseListaObjetos

    const kv = /^\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(linea);
    if (!kv) continue;
    const clave = kv[1];
    const crudo = kv[2];
    const lista = parseLista(crudo);
    const valor = lista !== null ? lista : limpia(crudo);

    if (indent === 0) {
      listaEn = null; padre = null;
      if (lista !== null) { out[clave] = lista; }
      else if (valor === '') { out[clave] = []; padre = clave; listaEn = { obj: out, clave }; }
      else out[clave] = valor;
    } else if (padre) {
      if (Array.isArray(out[padre])) {
        if (out[padre].length) continue;
        out[padre] = {};
      }
      if (lista !== null) { out[padre][clave] = lista; listaEn = null; }
      else if (valor === '') { out[padre][clave] = []; listaEn = { obj: out[padre], clave }; }
      else { out[padre][clave] = valor; listaEn = null; }
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────── carga de datos

/** Lee un archivo quitando el BOM. A diferencia de comun.leerTexto, LANZA si no existe. */
function leerTexto(ruta) {
  let texto = fs.readFileSync(ruta, 'utf8');
  if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);   // BOM de PowerShell/Notepad
  return texto;
}

/** Todas las fichas de persona (ignora README y los archivos que empiezan por _). */
function leerFichas(base) {
  const dir = dirPersonas(base);
  if (!dir) return [];
  let archivos = [];
  try { archivos = fs.readdirSync(dir); } catch (e) { return []; }
  return archivos
    .filter((f) => f.toLowerCase().endsWith('.md'))
    .filter((f) => !f.startsWith('_') && f.toLowerCase() !== 'readme.md')
    .map((f) => {
      const ruta = path.join(dir, f);
      let texto = '';
      try { texto = leerTexto(ruta); } catch (e) { return null; }
      const fm = parseFrontmatter(texto);
      return {
        archivo: f,
        ruta,
        texto,
        fm,
        slug: txt(fm.slug) || f.replace(/\.md$/i, ''),
        nombre: txt(fm.nombre) || f.replace(/\.md$/i, ''),
        alias: Array.isArray(fm.alias) ? fm.alias : [],
        estado: txt(fm.estado) || 'activo',
        frentes: parseListaObjetos(texto, 'frentes'),
      };
    })
    .filter(Boolean);
}

/** Diccionario de frentes + índice por alias ya normalizado. */
function cargarDominios(base) {
  const dir = dirPersonas(base);
  if (!dir) return { frentes: [], porAlias: new Map() };
  let texto = '';
  try { texto = leerTexto(path.join(dir, '_dominios.md')); }
  catch (e) { return { frentes: [], porAlias: new Map() }; }

  const frentes = parseListaObjetos(texto, 'frentes');
  const porAlias = new Map();
  for (const f of frentes) {
    const claves = [f.clave, f.nombre].concat(Array.isArray(f.alias) ? f.alias : []);
    for (const a of claves) {
      const n = normalizar(a);
      if (n && !porAlias.has(n)) porAlias.set(n, f);
    }
  }
  return { frentes, porAlias };
}

/**
 * ¿Aparece `alias` como palabra completa dentro de la frase?
 *
 * Se usa límite de palabra y NO contención simple: hay alias cortos (siglas de dos o tres letras).
 * Con un filtro de longitud mínima se pierden — "armemos un equipo para CRM" no encontraría
 * nada — y con contención simple engancharían dentro de cualquier palabra que lleve esas letras.
 * El límite de palabra resuelve las dos cosas y deja pasar los alias compuestos
 * ("pasarela de pagos") tal cual.
 */
function mencionaAlias(fraseNormalizada, alias) {
  const esc = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(fraseNormalizada);
}

/**
 * Resuelve un término a un frente. Primero exacto; si no, por alias mencionado dentro de la
 * frase (para que "tengo un bug en la pasarela de pagos" encuentre `pagos`).
 * Devuelve null cuando no hay match: NO adivina. Un frente inventado contamina el mapa entero.
 */
function resolverFrente(dominios, termino) {
  const n = normalizar(termino);
  if (!n) return null;
  if (dominios.porAlias.has(n)) return dominios.porAlias.get(n);

  let mejor = null;
  let largo = 0;
  for (const [alias, frente] of dominios.porAlias) {
    if (mencionaAlias(n, alias) && alias.length > largo) { mejor = frente; largo = alias.length; }
  }
  return mejor;
}

/** Igual que resolverFrente pero devuelve TODOS los frentes mencionados en una frase. */
function frentesEn(dominios, frase) {
  const n = normalizar(frase);
  const encontrados = new Map();
  for (const [alias, frente] of dominios.porAlias) {
    if (mencionaAlias(n, alias)) encontrados.set(frente.clave, frente);
  }
  return [...encontrados.values()];
}

/** Personas del mapa de identidades (no de las fichas): para cruzar Jira/git/correo. */
function cargarIdentidades(base) {
  const dir = dirPersonas(base);
  if (!dir) return [];
  try { return parseListaObjetos(leerTexto(path.join(dir, '_identidades.yaml')), 'personas'); }
  catch (e) { return []; }
}

/**
 * Resuelve un nombre suelto ("ana", "Luis", "lgomez") a una ficha.
 * Devuelve {ficha} | {ambiguo:[...]} | null. La ambigüedad se DEVUELVE, no se rompe el empate:
 * en un equipo grande es normal que haya varias personas con el mismo nombre o apellido.
 */
function resolverPersona(fichas, termino) {
  const n = normalizar(termino);
  if (!n) return null;

  const exactas = fichas.filter((f) =>
    normalizar(f.slug) === n ||
    normalizar(f.nombre) === n ||
    f.alias.some((a) => normalizar(a) === n));
  if (exactas.length === 1) return { ficha: exactas[0] };
  if (exactas.length > 1) return { ambiguo: exactas };

  const parciales = fichas.filter((f) => {
    const partes = normalizar(f.nombre).split(' ');
    return partes.includes(n) || normalizar(f.slug).split('-').includes(n);
  });
  if (parciales.length === 1) return { ficha: parciales[0] };
  if (parciales.length > 1) return { ambiguo: parciales };
  return null;
}

/** Hechos de frente vigentes hoy (sin `hasta`, o con `hasta` futuro). */
function frentesVigentes(ficha, hoy) {
  const h = hoy || hoyISO();
  return (ficha.frentes || []).filter((f) => {
    const hasta = txt(f.hasta);
    return !hasta || hasta >= h;
  });
}

module.exports = {
  arg, hoyISO, diasEntre, stateDir, dirPersonas, SIN_ESTADO, posicionales,
  normalizar, limpia, txt, parseLista,
  parseFrontmatter, parseListaObjetos, leerTexto,
  leerFichas, cargarDominios, cargarIdentidades,
  resolverFrente, frentesEn, mencionaAlias, resolverPersona, frentesVigentes,
};
