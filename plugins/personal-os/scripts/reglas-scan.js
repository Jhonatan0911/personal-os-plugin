#!/usr/bin/env node
// reglas-scan.js — vigía de las reglas de la organización (skill reglas-organizacion).
// Corre en el hook SessionStart. Imprime SOLO si hay hallazgos (no gasta tokens cuando todo está bien):
//   1. Despliegues a producción con fecha (hitos de los alcances y expedientes) sin paquete completo (paso-a-produccion).
//   2. Documentos fuente de una normativa que cambiaron, o versiones nuevas en las carpetas vigiladas.
//   3. Registro de reglas editado sin regenerar (build.py).
// Configuración: reglas-vigia.json (lo genera build.py). Estado propio: reglas-vigia-estado.json.
//   node reglas-scan.js            # bloque para el contexto (vacío si no hay nada)
//   node reglas-scan.js --json     # todo en JSON
//   node reglas-scan.js --aceptar  # da por revisados los documentos que cambiaron (nueva línea base)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const C = require('./lib/comun.js');
const DIR = __dirname;
const CONF = path.join(C.OS_HOME, 'reglas-vigia.json');
const ESTADO = path.join(C.OS_HOME, 'reglas-vigia-estado.json');
const JSON_OUT = process.argv.includes('--json');
const ACEPTAR = process.argv.includes('--aceptar');

const hoy = () => C.hoyISO();
const leer = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); } catch (_) { return d; } };
const huellaDe = (p) => { try { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } catch (_) { return null; } };

// ── 1. Despliegues a producción sin paquete ──────────────────────────────────────────────────
const ES_DESPLIEGUE = /(publicaci[oó]n|publicar|desplegar|despliegue|paso a producci[oó]n|subir a producci[oó]n|salida a producci[oó]n)/i;
const NO_ES = /(\bQA\b|\bstaging\b|\btest\b|publicad[oa]s?\b|desplegad[oa]s?\b)/i;
const CLAVE = /\b[A-Z][A-Z0-9]+-\d+\b/g;

function expedientes(carpetas) {
  const out = [];
  for (const c of carpetas || []) {
    let subs = [];
    try { subs = fs.readdirSync(c, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch (_) { continue; }
    for (const d of subs) {
      const p = path.join(c, d.name, 'expediente.json');
      const e = leer(p);
      if (e) out.push({ ruta: p, slug: d.name, exp: e, claves: new Set((JSON.stringify([e.id, e.jira, e.historias, e.subtareas]).toUpperCase().match(CLAVE)) || []) });
    }
  }
  return out;
}

function hitosAlcances() {
  try {
    const salida = execFileSync(process.execPath, [path.join(DIR, 'alcances-scan.js'), '--json'],
      { input: '{}', encoding: 'utf8', timeout: 20000, stdio: ['pipe', 'pipe', 'ignore'] });
    return (JSON.parse(salida).hitos) || [];
  } catch (_) { return null; }
}

function despliegues(cfg) {
  const hitos = hitosAlcances();
  if (hitos === null) return [{ nivel: 'aviso', texto: 'No pude leer los hitos de los alcances (alcances-scan.js --json falló): los despliegues no se revisaron.' }];
  const exps = expedientes(cfg.expedientes);
  const out = [];
  const vistos = new Set();
  for (const h of hitos) {
    const texto = `${h.que || ''}`;
    if (!ES_DESPLIEGUE.test(texto) || NO_ES.test(texto)) continue;
    const claves = (texto.toUpperCase().match(CLAVE)) || [];
    const llave = `${h.fecha}|${claves.join(',') || texto}`;
    if (vistos.has(llave)) continue;
    vistos.add(llave);
    const ex = exps.find((x) => claves.some((k) => x.claves.has(k)));
    const pp = ex && ex.exp.paso_produccion;
    if (pp && pp.completo) continue;
    const estado = !ex ? 'sin expediente: no hay dónde armar el paquete'
      : !pp ? `paquete sin verificar (paso-a-produccion ${claves[0] || ex.slug})`
        : `paquete incompleto, faltan ${(pp.faltan || []).length} (verificado el ${pp.verificado_el})`;
    out.push({ nivel: 'critico', regla: cfg.regla_despliegue, fecha: h.fecha, cuando: h.cuando, id: h.id,
      texto: `${cfg.regla_despliegue ? cfg.regla_despliegue + ' · ' : ''}${h.cuando} · ${h.id} · ${texto.slice(0, 140)} → ${estado}` });
  }
  return out;
}

// ── 2. Documentos fuente ─────────────────────────────────────────────────────────────────────
function documentos(cfg, estado) {
  const out = [];
  estado.docs = estado.docs || {};
  for (const d of cfg.documentos_vigilados || []) {
    const h = huellaDe(d.ruta);
    const previo = estado.docs[d.ruta];
    if (!h) { out.push({ nivel: 'aviso', texto: `${d.normativa} · no encuentro «${d.nombre}» en ${d.ruta}: ¿lo movieron o lo renombraron?` }); continue; }
    if (!previo) { estado.docs[d.ruta] = { huella: h, desde: hoy() }; continue; }
    if (previo.huella !== h) {
      out.push({ nivel: 'alerta', ruta: d.ruta, huella: h,
        texto: `${d.normativa} · «${d.nombre}» cambió desde el ${previo.desde}: releerlo, actualizar la normativa y el registro, y luego \`node reglas-scan.js --aceptar\`.` });
    }
  }
  estado.carpetas = estado.carpetas || {};
  for (const c of cfg.carpetas_vigiladas || []) {
    let nombres = [];
    try { nombres = fs.readdirSync(c.ruta).filter((n) => new RegExp(c.patron, 'i').test(n)).sort(); } catch (_) { continue; }
    const previo = estado.carpetas[c.ruta];
    if (!previo) { estado.carpetas[c.ruta] = nombres; continue; }
    const nuevos = nombres.filter((n) => !previo.includes(n));
    if (nuevos.length) out.push({ nivel: 'alerta', carpeta: c.ruta, nombres,
      texto: `Documento nuevo en ${path.basename(c.ruta)}: ${nuevos.join(', ')}. Si es una versión nueva, actualizar la normativa y el registro, y luego \`--aceptar\`.` });
  }
  return out;
}

// ── 3. Registro sin regenerar ────────────────────────────────────────────────────────────────
function registro(cfg) {
  const regs = (cfg.registro || []).map((p) => { try { return fs.readFileSync(p); } catch (_) { return Buffer.alloc(0); } });
  const h = crypto.createHash('sha256').update(Buffer.concat(regs)).digest('hex');
  if (cfg.huella && h !== cfg.huella) {
    return [{ nivel: 'alerta', texto: `El registro de reglas cambió y no se regeneró: correr \`python -I "${cfg.build}" --config-dir "${cfg.config_dir}"\` (skill reglas-organizacion) para que lleguen al núcleo, al hook y a fuentes.yaml.` }];
  }
  return [];
}

// ── principal ────────────────────────────────────────────────────────────────────────────────
function main() {
  const cfg = leer(CONF);
  if (!cfg) return; // sin configuración generada no hay vigía (build.py no ha corrido)
  const estado = leer(ESTADO, {});

  if (ACEPTAR) {
    for (const d of cfg.documentos_vigilados || []) {
      const h = huellaDe(d.ruta);
      if (h) estado.docs = { ...(estado.docs || {}), [d.ruta]: { huella: h, desde: hoy() } };
    }
    for (const c of cfg.carpetas_vigiladas || []) {
      try { estado.carpetas = { ...(estado.carpetas || {}), [c.ruta]: fs.readdirSync(c.ruta).filter((n) => new RegExp(c.patron, 'i').test(n)).sort() }; } catch (_) { /* carpeta ausente */ }
    }
    fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 2));
    console.log('Línea base de documentos actualizada.');
    return;
  }

  const hallazgos = [...despliegues(cfg), ...documentos(cfg, estado), ...registro(cfg)];
  try { fs.writeFileSync(ESTADO, JSON.stringify(estado, null, 2)); } catch (_) { /* sin estado se vuelve a sembrar */ }

  if (JSON_OUT) { console.log(JSON.stringify({ hallazgos }, null, 2)); return; }
  if (!hallazgos.length) return;
  const icono = { critico: '🔴', alerta: '🟠', aviso: '⚪' };
  const lineas = ['## ⚖️ REGLAS DE LA ORGANIZACIÓN — vigía', ''];
  for (const h of hallazgos) lineas.push(`- ${icono[h.nivel] || '-'} ${h.texto}`);
  lineas.push('', `Fuente: ${(cfg.registro || [])[0] || 'reglas-empresa/registro.yaml'} · normativas en <estado>/normativas/ · skill reglas-organizacion.`);
  console.log(lineas.join('\n'));
}

try { main(); } catch (e) { /* el vigía nunca tumba la sesión */ }
