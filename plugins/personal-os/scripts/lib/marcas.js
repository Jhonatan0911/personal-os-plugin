// lib/marcas.js — registro general de marcas del Personal OS (transversal: documentos, artefactos, terminal…).
//
// <configDir>/marca/marcas.json:
//   { predeterminadas: { laboral: id|null, personal: id|null },
//     marcas: { <id>: { nombre, corto, lema, ambito: 'laboral'|'personal', colores: {12},
//                        logo, marca_agua_imagen, marca_agua_opacidad, marca_agua_posicion, icono } } }
// Las imágenes van en <configDir>/marca/imagenes/ con rutas relativas a la carpeta marca/.
// <configDir> = --config-dir > el --config-dir de servidor.consola_args (instalación suelta) > <stateDir>/config.
//
// Versión anterior (4.5.0 temprana): las marcas vivían dentro de terminal.json. leer() las migra solas.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./comun');

const AMBITOS = ['laboral', 'personal'];
const COLORES = ['principal', 'acento', 'acento_vivo', 'claro', 'fondo', 'fondo_suave', 'texto', 'gris', 'gris_suave', 'ok', 'error', 'alerta'];
const POSICIONES = ['center', 'top', 'bottom', 'left', 'right', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
const IMAGENES = { logo: 'logo', agua: 'marca_agua_imagen', icono: 'icono' };
const REFERENCIAS = path.join(C.PLUGIN_ROOT, 'plantillas', 'marca-terminal-referencias.json');
const PROTEGIDAS = path.join(C.PLUGIN_ROOT, 'plantillas', 'marcas-protegidas');

const leerJson = (ruta) => JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, ''));
const escribirJson = (ruta, obj) => { fs.mkdirSync(path.dirname(ruta), { recursive: true }); fs.writeFileSync(ruta, JSON.stringify(obj, null, 2) + '\n'); };

function dirConfig() {
  const forzado = C.arg('--config-dir', null);
  const a = (C.config().servidor || {}).consola_args || [];
  const i = a.indexOf('--config-dir');
  const dir = forzado || (i > -1 && a[i + 1]) || (C.stateDir() ? path.join(C.stateDir(), 'config') : null);
  if (!dir) throw new Error('no hay stateDir en la configuración del Personal OS (corre /os-setup)');
  return path.resolve(dir);
}
function rutas() {
  const marca = path.join(dirConfig(), 'marca');
  return { marca, marcas: path.join(marca, 'marcas.json'), terminal: path.join(marca, 'terminal.json'), imagenes: path.join(marca, 'imagenes') };
}

/** Lee el registro (migrando el formato viejo si hace falta). Devuelve null si todavía no hay marcas. */
function leer() {
  const r = rutas();
  if (fs.existsSync(r.marcas)) {
    const d = leerJson(r.marcas);
    d.marcas = d.marcas || {}; d.predeterminadas = Object.assign({ laboral: null, personal: null }, d.predeterminadas);
    return d;
  }
  if (fs.existsSync(r.terminal)) {
    const t = leerJson(r.terminal);
    if (t.marcas && Object.keys(t.marcas).length) {
      // Migración: las marcas salen de terminal.json; sin ámbito declarado se toman como laborales.
      const d = { _que_es: 'Registro de marcas del Personal OS: documentos, artefactos y terminal. Se edita en ⚙ Config · Marcas.', predeterminadas: { laboral: null, personal: null }, marcas: {} };
      for (const [id, m] of Object.entries(t.marcas)) d.marcas[id] = Object.assign({ ambito: 'laboral', logo: null }, m);
      for (const amb of AMBITOS) d.predeterminadas[amb] = (t.activa && d.marcas[t.activa] && d.marcas[t.activa].ambito === amb) ? t.activa : (Object.keys(d.marcas).find((k) => d.marcas[k].ambito === amb) || null);
      escribirJson(r.marcas, d);
      delete t.marcas; delete t._que_es;
      escribirJson(r.terminal, t);
      return d;
    }
  }
  return null;
}
function guardar(d) { escribirJson(rutas().marcas, d); }
function vacio() { return { _que_es: 'Registro de marcas del Personal OS: documentos, artefactos y terminal. Se edita en ⚙ Config · Marcas.', predeterminadas: { laboral: null, personal: null }, marcas: {} }; }

/** Ruta absoluta de una imagen de la marca (o null). Nunca sale de la carpeta marca/. */
function imagen(m, tipo) {
  const rel = m && m[IMAGENES[tipo]];
  if (!rel) return null;
  const base = rutas().marca;
  const abs = path.resolve(base, rel);
  return abs.startsWith(base + path.sep) && fs.existsSync(abs) ? abs : null;
}

function resumen(id, m, d) {
  return {
    id, nombre: m.nombre || id, corto: m.corto || m.nombre || id, lema: m.lema || '', ambito: AMBITOS.includes(m.ambito) ? m.ambito : 'laboral',
    colores: m.colores || {}, predeterminada: !!d && d.predeterminadas[m.ambito] === id,
    con_logo: !!imagen(m, 'logo'), con_marca_agua: !!imagen(m, 'agua'), con_icono: !!imagen(m, 'icono'),
    marca_agua_opacidad: Number(m.marca_agua_opacidad ?? 0.18), marca_agua_posicion: m.marca_agua_posicion || 'center',
  };
}
const lista = (d) => Object.entries((d && d.marcas) || {}).map(([id, m]) => resumen(id, m, d));

/** Para quien genera un documento: todas las marcas, la del ámbito primero y preseleccionada. */
function elegir(ambito) {
  const d = leer();
  if (!d) return { predeterminada: null, opciones: [] };
  const amb = AMBITOS.includes(ambito) ? ambito : 'laboral';
  const ops = lista(d).sort((a, b) => (a.ambito === amb ? 0 : 1) - (b.ambito === amb ? 0 : 1));
  const pre = d.predeterminadas[amb] && d.marcas[d.predeterminadas[amb]] ? d.predeterminadas[amb] : (ops.find((o) => o.ambito === amb) || {}).id || null;
  return { ambito: amb, predeterminada: pre, preguntar: ops.length > 1, opciones: ops.map((o) => ({ id: o.id, nombre: o.nombre, ambito: o.ambito })) };
}

/** Marca completa con rutas absolutas de sus imágenes (para generar documentos). */
function obtener(id) {
  const d = leer();
  const m = d && d.marcas[id];
  if (!m) return null;
  return Object.assign(resumen(id, m, d), { logo: imagen(m, 'logo'), marca_agua: imagen(m, 'agua'), icono: imagen(m, 'icono') });
}

const slug = (s) => C.sinTildes(String(s || '')).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'marca';
const idLibre = (d, raiz) => { let id = raiz; for (let n = 2; d.marcas[id]; n++) id = `${raiz}-${n}`; return id; };
const texto = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);

/**
 * Crea o edita una marca. e = { nombre, corto, lema, ambito, colores, marca_agua_opacidad, marca_agua_posicion, predeterminada? };
 * imgs = { logo|agua|icono: Buffer PNG | null (quitar) | undefined (dejar) }. Devuelve { id, nueva } o lanza Error.
 */
function guardarMarca(id, e, imgs) {
  const d = leer() || vacio();
  const nombre = texto(e.nombre, 60);
  if (!nombre) throw new Error('la marca necesita un nombre');
  const ambito = AMBITOS.includes(e.ambito) ? e.ambito : null;
  if (!ambito) throw new Error('elige si la marca es laboral o personal');
  const colores = {};
  for (const k of COLORES) {
    const v = String((e.colores || {})[k] || '');
    if (!/^#[0-9A-Fa-f]{6}$/.test(v)) throw new Error(`el color «${k}» no es válido (#RRGGBB)`);
    colores[k] = v.toUpperCase();
  }
  const opacidad = Number(e.marca_agua_opacidad ?? 0.18);
  if (!(opacidad >= 0 && opacidad <= 1)) throw new Error('la opacidad va de 0 a 1');
  const nueva = !id;
  if (nueva) id = idLibre(d, slug(nombre));
  else if (!d.marcas[id]) throw new Error('esa marca no existe');
  const m = Object.assign({}, d.marcas[id], {
    nombre, corto: texto(e.corto, 24) || nombre, lema: texto(e.lema, 90), ambito, colores,
    marca_agua_opacidad: Math.round(opacidad * 100) / 100, marca_agua_posicion: POSICIONES.includes(e.marca_agua_posicion) ? e.marca_agua_posicion : 'center',
  });
  for (const [tipo, clave] of Object.entries(IMAGENES)) {
    const buf = (imgs || {})[tipo];
    if (buf === undefined) continue;
    if (buf === null) { m[clave] = null; continue; }
    if (buf.length > 2 * 1024 * 1024) throw new Error('cada imagen debe pesar menos de 2 MB');
    if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('las imágenes deben ser PNG');
    fs.mkdirSync(rutas().imagenes, { recursive: true });
    const archivo = `${id}-${tipo === 'agua' ? 'marca-agua' : tipo}.png`;
    fs.writeFileSync(path.join(rutas().imagenes, archivo), buf);
    m[clave] = `imagenes/${archivo}`;
  }
  d.marcas[id] = m;
  // Ámbito cambiado: deja de ser la predeterminada del otro. Primera de su ámbito o pedida: queda predeterminada.
  for (const amb of AMBITOS) if (amb !== ambito && d.predeterminadas[amb] === id) d.predeterminadas[amb] = null;
  if (e.predeterminada || !d.predeterminadas[ambito] || !d.marcas[d.predeterminadas[ambito]]) d.predeterminadas[ambito] = id;
  guardar(d);
  return { id, nueva };
}

function quitarMarca(id, enUso) {
  const d = leer();
  if (!d || !d.marcas[id]) throw new Error('esa marca no existe');
  if (enUso) throw new Error(enUso);
  delete d.marcas[id];
  for (const amb of AMBITOS) if (d.predeterminadas[amb] === id) d.predeterminadas[amb] = Object.keys(d.marcas).find((k) => d.marcas[k].ambito === amb) || null;
  guardar(d);
}

function predeterminar(ambito, id) {
  const d = leer();
  if (!d || !d.marcas[id]) throw new Error('esa marca no existe');
  if (!AMBITOS.includes(ambito) || d.marcas[id].ambito !== ambito) throw new Error('la marca no es de ese ámbito');
  d.predeterminadas[ambito] = id; guardar(d);
}

// ---- referencias y marcas protegidas -------------------------------------------------------
const referencias = () => (fs.existsSync(REFERENCIAS) ? (leerJson(REFERENCIAS).referencias || []) : []);

function desdeReferencia(refId, ambito) {
  const ref = referencias().find((r) => r.id === refId);
  if (!ref) throw new Error(`no hay una referencia '${refId}'`);
  return guardarMarca(null, { nombre: ref.nombre, corto: ref.corto, lema: '', ambito: AMBITOS.includes(ambito) ? ambito : 'laboral', colores: ref.colores }, {});
}

// El código se normaliza: sin tildes, mayúsculas, espacios ni signos («Mi Marca-2026» = «mimarca2026»).
const normalizarCodigo = (s) => C.sinTildes(String(s || '')).replace(/[^a-z0-9]/g, '');
const KDF = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const claveDe = (codigo, sal, k) => crypto.scryptSync(normalizarCodigo(codigo), sal, 32, { N: k.N, r: k.r, p: k.p, maxmem: KDF.maxmem });

/** Prueba el código contra cada marca protegida; la que abre se agrega al registro. Devuelve { id, nombre } o null. */
function desbloquear(codigo) {
  if (!normalizarCodigo(codigo)) throw new Error('no se recibió ningún código');
  const archivos = fs.existsSync(PROTEGIDAS) ? fs.readdirSync(PROTEGIDAS).filter((f) => f.endsWith('.marca')) : [];
  for (const f of archivos) {
    let plano;
    try {
      const p = leerJson(path.join(PROTEGIDAS, f));
      const dc = crypto.createDecipheriv('aes-256-gcm', claveDe(codigo, Buffer.from(p.kdf.sal, 'base64'), p.kdf), Buffer.from(p.iv, 'base64'));
      dc.setAuthTag(Buffer.from(p.tag, 'base64'));
      plano = JSON.parse(Buffer.concat([dc.update(Buffer.from(p.datos, 'base64')), dc.final()]).toString('utf8'));
    } catch { continue; }   // no abre con ese código: se prueba la siguiente
    const imgs = {};
    for (const t of Object.keys(IMAGENES)) if ((plano.imagenes || {})[t]) imgs[t] = Buffer.from(plano.imagenes[t], 'base64');
    const d = leer() || vacio();
    const existe = !!d.marcas[plano.id];
    if (!existe) { d.marcas[plano.id] = { nombre: plano.marca.nombre, ambito: plano.marca.ambito || 'laboral' }; guardar(d); }
    guardarMarca(plano.id, Object.assign({ ambito: 'laboral' }, plano.marca), imgs);
    return { id: plano.id, nombre: plano.marca.nombre };
  }
  return null;
}

function empaquetar(id, codigo, salida) {
  const d = leer();
  const m = d && d.marcas[id];
  if (!m) throw new Error(`la marca '${id}' no existe`);
  if (normalizarCodigo(codigo).length < 6) throw new Error('el código debe tener al menos 6 letras o números');
  const marca = Object.assign({}, m); for (const k of Object.values(IMAGENES)) delete marca[k];
  const imagenes = {};
  for (const t of Object.keys(IMAGENES)) { const a = imagen(m, t); imagenes[t] = a ? fs.readFileSync(a).toString('base64') : null; }
  const sal = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', claveDe(codigo, sal, KDF), iv);
  const cifrado = Buffer.concat([c.update(Buffer.from(JSON.stringify({ id, marca, imagenes }))), c.final()]);
  escribirJson(salida, { formato: 'marca-protegida', version: 2, kdf: { alg: 'scrypt', N: KDF.N, r: KDF.r, p: KDF.p, sal: sal.toString('base64') },
    cifrado: 'aes-256-gcm', iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), datos: cifrado.toString('base64') });
}

module.exports = { AMBITOS, COLORES, POSICIONES, rutas, leer, guardar, lista, resumen, elegir, obtener, imagen, guardarMarca, quitarMarca, predeterminar, referencias, desdeReferencia, desbloquear, empaquetar, normalizarCodigo };
