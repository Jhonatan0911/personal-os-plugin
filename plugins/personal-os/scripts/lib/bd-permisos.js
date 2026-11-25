'use strict';
/*
 * Permisos de base de datos (D-072, fase 2 · 25/11/2026). Lo comparten la consola (os-servidor.js, que los edita)
 * y el guardia (guardia-empresa.js, que los hace cumplir). Los wrappers de lectura (dbread.ps1, mongoread.py)
 * aplican la misma tabla con su propio código.
 *
 * Reglas decididas por el usuario:
 *   · Leer tiene modo: bloqueado (no se consulta) · preguntar (OK por consulta) · automatico (sin preguntar).
 *   · Las escrituras (crear, actualizar, borrar, estructura, ejecutar) NUNCA las ejecuta Claude: siempre se
 *     entregan como script de publicación + rollback. Su único valor es «script».
 *   · Gana la regla más estricta entre la consola y las reglas de la organización (guardia-empresa.json).
 *
 * Registro: <OS_HOME>/conexiones-bd.json → { conexiones: [{ id, nombre, archivo, motor, etiquetas }] }; cada
 * `archivo` es el JSON de la conexión (servidor, catalogos, permisos, modo_lectura…). La contraseña nunca se usa aquí.
 */
const fs = require('fs');
const path = require('path');

const ACCIONES = ['leer', 'crear', 'actualizar', 'borrar', 'estructura', 'ejecutar'];
const ESCRITURA = ['crear', 'actualizar', 'borrar', 'estructura', 'ejecutar'];
const MODOS_LECTURA = ['bloqueado', 'preguntar', 'automatico'];
const MODO_ESCRITURA = 'script';

function leerJson(ruta) {
  try { return JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '')); } catch (_) { return null; }
}

/** Modo de lectura efectivo de un archivo de conexión (con el campo heredado de /bd-test si no hay `permisos`). */
function modoLectura(d) {
  const p = d && d.permisos && d.permisos.leer;
  if (MODOS_LECTURA.includes(p)) return p;
  return d && d.modo_lectura === 'automatico' ? 'automatico' : 'preguntar';
}

/** Permisos completos normalizados: leer con su modo; las escrituras siempre «script». */
function permisos(d) {
  const p = { leer: modoLectura(d) };
  for (const a of ESCRITURA) p[a] = MODO_ESCRITURA;
  return p;
}

/** Host sin protocolo, puerto ni instancia, en minúsculas: «tcp:10.0.0.5,1433» → «10.0.0.5». */
function host(servidor) {
  return String(servidor || '').trim().toLowerCase().replace(/^tcp:/, '').split(/[,\\:]/)[0].trim();
}

/** Conexiones registradas con lo que hace falta para reconocerlas (sin contraseña). */
function conexiones(osHome) {
  const reg = leerJson(path.join(osHome, 'conexiones-bd.json'));
  if (!reg || !Array.isArray(reg.conexiones)) return [];
  return reg.conexiones.map((c) => {
    const d = leerJson(c.archivo) || {};
    return { id: c.id, nombre: c.nombre || c.id, etiquetas: c.etiquetas || [], servidor: d.servidor || '', host: host(d.servidor),
      catalogos: Array.isArray(d.catalogos) ? d.catalogos.map(String) : [], leer: modoLectura(d) };
  }).filter((c) => c.host || c.catalogos.length);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nombra = (texto, palabra) => !!palabra && new RegExp(`(^|[^\\w.-])${esc(palabra)}($|[^\\w.-])`, 'i').test(texto);

/** Conexiones registradas que el comando nombra por su host o por una de sus bases. */
function conexionesEn(cmd, lista) {
  return lista.filter((c) => nombra(cmd, c.host) || c.catalogos.some((b) => nombra(cmd, b)));
}

// Acción de una sentencia. Se busca la más «fuerte» presente: un SELECT con un DELETE dentro es un borrado.
const SQL = [
  ['estructura', /\b(CREATE|ALTER|DROP|TRUNCATE\s+TABLE\s+\S+\s+WITH|GRANT|REVOKE|DENY|sp_rename)\b/i],
  ['borrar', /\b(DELETE|TRUNCATE)\b/i],
  ['actualizar', /\b(UPDATE|MERGE)\b/i],
  ['crear', /\b(INSERT|BULK\s+INSERT|SELECT\b[\s\S]*\bINTO\b)/i],
  ['ejecutar', /\b(EXEC(UTE)?|xp_cmdshell|sp_executesql)\b/i],
];
const MONGO = [
  ['estructura', /\.(drop|dropDatabase|createIndex|createIndexes|dropIndex|dropIndexes|renameCollection|createCollection)\s*\(/],
  ['borrar', /\.(delete|deleteOne|deleteMany|remove|findOneAndDelete)\s*\(/],
  ['actualizar', /\.(update|updateOne|updateMany|replaceOne|findOneAndUpdate|findOneAndReplace|bulkWrite)\s*\(/],
  ['crear', /\.(insert|insertOne|insertMany)\s*\(/],
];
function accion(cmd) {
  for (const [a, re] of MONGO) if (re.test(cmd)) return a;
  for (const [a, re] of SQL) if (re.test(cmd)) return a;
  return 'leer';
}

module.exports = { ACCIONES, ESCRITURA, MODOS_LECTURA, MODO_ESCRITURA, modoLectura, permisos, host, conexiones, conexionesEn, accion };
