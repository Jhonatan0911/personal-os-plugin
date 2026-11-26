'use strict';
/*
 * Permisos de base de datos (D-072 y D-073, 26/11/2026). Lo comparten la consola (os-servidor.js, que los edita),
 * el guardia (guardia-empresa.js, que los hace cumplir) y el ejecutor (bd-ejecutar.py, que corre las consultas).
 *
 * Reglas decididas por el usuario (D-073, reemplaza la fase 2 de la D-072):
 *   · Las seis acciones (leer, crear, actualizar, borrar, estructura, ejecutar) tienen tres modos:
 *     bloqueado (no se ejecuta) · preguntar (el diálogo de permisos de Claude Code muestra destino, servidor, IP,
 *     usuario, qué hace y el SQL, y espera Aceptar) · automatico (corre sin preguntar).
 *   · Claude no conecta a la base: deja un plan (plan.json + consulta.sql + rollback.sql) y lo corre el ejecutor.
 *   · Las escrituras corren en transacción y exigen rollback.sql.
 *   · Para una conexión registrada aquí manda la consola, también sobre las reglas de la organización.
 *   · Una escritura sin modo guardado queda bloqueada (el usuario la abre en la consola).
 *
 * Registro: <OS_HOME>/conexiones-bd.json → { conexiones: [{ id, nombre, archivo, motor, etiquetas }] }; cada
 * `archivo` es el JSON de la conexión (servidor, usuario, catalogos, permisos…). La contraseña nunca se usa aquí.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCIONES = ['leer', 'crear', 'actualizar', 'borrar', 'estructura', 'ejecutar'];
const ESCRITURA = ['crear', 'actualizar', 'borrar', 'estructura', 'ejecutar'];
const MODOS = ['bloqueado', 'preguntar', 'automatico'];
const MODOS_LECTURA = MODOS;   // compatibilidad con quien lo importaba por este nombre
const NOMBRE = { leer: 'Leer', crear: 'Crear', actualizar: 'Actualizar', borrar: 'Borrar', estructura: 'Estructura', ejecutar: 'Ejecutar' };
const MODO_ES = { bloqueado: 'Bloqueado', preguntar: 'Me pregunta', automatico: 'Automático' };

function leerJson(ruta) {
  try { return JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '')); } catch (_) { return null; }
}

/** Modo de lectura efectivo de un archivo de conexión (con el campo heredado de /bd-test si no hay `permisos`). */
function modoLectura(d) {
  const p = d && d.permisos && d.permisos.leer;
  if (MODOS.includes(p)) return p;
  return d && d.modo_lectura === 'automatico' ? 'automatico' : 'preguntar';
}

/** Permisos completos normalizados. Escritura sin modo (o con el «script» de la D-072) = bloqueado. */
function permisos(d) {
  const p = { leer: modoLectura(d) };
  for (const a of ESCRITURA) {
    const v = d && d.permisos && d.permisos[a];
    p[a] = MODOS.includes(v) ? v : 'bloqueado';
  }
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
    return { id: c.id, nombre: c.nombre || c.id, motor: c.motor || 'sqlserver', etiquetas: c.etiquetas || [],
      servidor: d.servidor || '', host: host(d.servidor), usuario: d.usuario || '',
      catalogos: Array.isArray(d.catalogos) ? d.catalogos.map(String) : [], leer: modoLectura(d), permisos: permisos(d) };
  }).filter((c) => c.host || c.catalogos.length);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nombra = (texto, palabra) => !!palabra && new RegExp(`(^|[^\\w.-])${esc(palabra)}($|[^\\w.-])`, 'i').test(texto);

/** Conexiones registradas que el comando nombra por su host o por una de sus bases. */
function conexionesEn(cmd, lista) {
  return lista.filter((c) => nombra(cmd, c.host) || c.catalogos.some((b) => nombra(cmd, b)));
}

// Acción de una sentencia. La lista va de la más fuerte a la más débil.
const SQL = [
  ['estructura', /\b(CREATE|ALTER|DROP|GRANT|REVOKE|DENY|sp_rename)\b/i],
  ['borrar', /\b(DELETE|TRUNCATE)\b/i],
  ['actualizar', /\b(UPDATE|MERGE)\b/i],
  ['crear', /\b(INSERT|BULK\s+INSERT)\b|\bSELECT\b[^;]*?\bINTO\s+[#@\w[]/i],
  ['ejecutar', /\b(EXEC(UTE)?|xp_cmdshell|sp_executesql)\b/i],
];
const MONGO = [
  ['estructura', /\.(drop|dropDatabase|createIndex|createIndexes|dropIndex|dropIndexes|renameCollection|createCollection)\s*\(/],
  ['borrar', /\.(delete|deleteOne|deleteMany|remove|findOneAndDelete)\s*\(/],
  ['actualizar', /\.(update|updateOne|updateMany|replaceOne|findOneAndUpdate|findOneAndReplace|bulkWrite)\s*\(/],
  ['crear', /\.(insert|insertOne|insertMany)\s*\(/],
];

/** SQL sin comentarios ni literales de texto: un «-- borra» o un 'DELETE' dentro de un texto no son acciones. */
function limpiarSql(sql) {
  return String(sql || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ')
    .replace(/N?'(?:[^']|'')*'/g, "''");
}

/** La acción más fuerte de un comando o sentencia (para el texto de un comando del guardia). */
function accion(cmd) {
  for (const [a, re] of MONGO) if (re.test(cmd)) return a;
  for (const [a, re] of SQL) if (re.test(cmd)) return a;
  return 'leer';
}

/** Todas las acciones de un script SQL, de la más fuerte a la más débil; solo lectura = ['leer']. */
function acciones(sql) {
  const s = limpiarSql(sql);
  const out = SQL.filter(([, re]) => re.test(s)).map(([a]) => a);
  return out.length ? out : ['leer'];
}

/** El modo que manda para un conjunto de acciones: el más estricto (bloqueado > preguntar > automatico). */
function modoPara(perms, accs) {
  const ms = accs.map((a) => (perms && perms[a]) || 'bloqueado');
  return ms.includes('bloqueado') ? 'bloqueado' : ms.includes('preguntar') ? 'preguntar' : 'automatico';
}

// ── Planes del ejecutor ─────────────────────────────────────────────────────────────────────────
// Un plan es una carpeta <OS_HOME>/bd-planes/<id>/ con plan.json ({ conexion, base, explicacion, limite? }),
// consulta.sql y, si escribe, rollback.sql. La huella une los tres: si alguno cambia después del OK, el
// ejecutor no corre (lo comprueba contra el pase que deja el guardia).
const RE_ID = /^[A-Za-z0-9][\w.-]{0,80}$/;
function dirPlanes(osHome) { return path.join(osHome, 'bd-planes'); }
function resolverPlan(osHome, ref) {
  const r = String(ref || '').replace(/^["']|["']$/g, '');
  if (!r) return null;
  if (RE_ID.test(r)) return path.join(dirPlanes(osHome), r);
  return path.resolve(r);
}
function leerBytes(ruta) { try { return fs.readFileSync(ruta); } catch (_) { return null; } }
function huella(plan, consulta, rollback) {
  const h = crypto.createHash('sha256');
  for (const b of [plan, consulta, rollback]) { h.update(b || Buffer.alloc(0)); h.update('\n--\n'); }
  return h.digest('hex');
}
const tieneSql = (txt) => limpiarSql(txt).replace(/\bGO\b/gi, '').trim().length > 0;

/**
 * Carga y valida un plan contra el registro de conexiones. Devuelve { ok, error?, dir, plan, conexion, sql,
 * acciones, modo, huella, rollback }. `objetivo` = 'consulta' o 'rollback' (correr el rollback de un plan).
 */
function cargarPlan(osHome, ref, objetivo = 'consulta') {
  const dir = resolverPlan(osHome, ref);
  if (!dir) return { ok: false, error: 'falta el id del plan' };
  const bPlan = leerBytes(path.join(dir, 'plan.json'));
  const bSql = leerBytes(path.join(dir, 'consulta.sql'));
  const bRb = leerBytes(path.join(dir, 'rollback.sql'));
  if (!bPlan) return { ok: false, dir, error: `no existe ${path.join(dir, 'plan.json')}` };
  let plan;
  try { plan = JSON.parse(bPlan.toString('utf8').replace(/^﻿/, '')); } catch (_) { return { ok: false, dir, error: 'plan.json no es JSON válido' }; }
  const sqlTxt = (objetivo === 'rollback' ? bRb : bSql);
  if (!sqlTxt || !tieneSql(sqlTxt.toString('utf8'))) return { ok: false, dir, error: objetivo === 'rollback' ? 'el plan no tiene rollback.sql' : 'consulta.sql no existe o está vacío' };
  const sql = sqlTxt.toString('utf8').replace(/^﻿/, '');
  const lista = conexiones(osHome);
  const conexion = lista.find((c) => c.id === plan.conexion) || lista.find((c) => c.nombre === plan.conexion);
  if (!conexion) return { ok: false, dir, plan, error: `la conexión «${plan.conexion || '(sin conexion)'}» no está registrada en ⚙ Config · Bases de datos` };
  const base = plan.base || conexion.catalogos[0];
  if (!base || (conexion.catalogos.length && !conexion.catalogos.includes(base))) {
    return { ok: false, dir, plan, conexion, error: `la base «${plan.base}» no está entre las de «${conexion.nombre}» (${conexion.catalogos.join(', ') || 'ninguna'})` };
  }
  if (conexion.motor !== 'sqlserver') return { ok: false, dir, plan, conexion, error: `el ejecutor todavía no corre ${conexion.motor}: solo SQL Server` };
  if (!String(plan.explicacion || '').trim()) return { ok: false, dir, plan, conexion, error: 'plan.json no dice qué hace la consulta («explicacion»)' };
  const accs = acciones(sql);
  const escribe = accs.some((a) => a !== 'leer');
  if (escribe && objetivo === 'consulta' && !(bRb && tieneSql(bRb.toString('utf8')))) {
    return { ok: false, dir, plan, conexion, acciones: accs, error: 'una escritura necesita su rollback.sql antes de correr' };
  }
  return { ok: true, dir, plan, conexion, base, sql, acciones: accs, escribe, modo: modoPara(conexion.permisos, accs),
    huella: huella(bPlan, bSql, bRb), objetivo };
}

// ── Impacto: qué objetos toca el SQL ─────────────────────────────────────────────────────────────
// Lectura estática del texto (sin comentarios ni literales): no adivina lo que hace un procedimiento por
// dentro ni un SQL dinámico; eso se dice en el diálogo cuando aparece.
const ID = String.raw`(?:\[[^\]]+\]|"[^"]+"|[#@]?[A-Za-z_][\w$#@]*)(?:\s*\.\s*(?:\[[^\]]+\]|"[^"]+"|[A-Za-z_][\w$#@]*)){0,3}`;
const norm = (s) => s.replace(/\s*\.\s*/g, '.').replace(/[[\]"]/g, '');
function capturar(s, re) {
  const out = []; let m;
  const rx = new RegExp(re.source, 'gi');
  while ((m = rx.exec(s))) out.push(norm(m[m.length - 1]));
  return out;
}
const unicos = (a) => [...new Set(a.filter((x) => x && !/^(SET|SELECT|VALUES|OUTPUT|WITH|TOP|AS|ON|WHERE)$/i.test(x)))];
function impacto(sql) {
  const s = limpiarSql(sql);
  const cte = new Set(capturar(s, new RegExp(String.raw`(?:\bWITH|,)\s*(${ID})\s+AS\s*\(`)).map((x) => x.toLowerCase()));
  const sinCte = (a) => a.filter((x) => !cte.has(x.toLowerCase()) && !x.startsWith('@'));
  // Alias: «FROM dbo.Agd_Cita c» / «JOIN dbo.T AS t» → el UPDATE c o DELETE c dice la tabla real.
  const alias = new Map();
  const NO_ALIAS = /^(WHERE|ON|INNER|LEFT|RIGHT|FULL|CROSS|OUTER|JOIN|GROUP|ORDER|SET|WITH|OPTION|UNION|EXCEPT|INTERSECT|APPLY|PIVOT|UNPIVOT|AS|GO|HAVING|OUTPUT)$/i;
  { const rx = new RegExp(String.raw`\b(?:FROM|JOIN|UPDATE|INTO)\s+(${ID})(?:\s+AS)?\s+([A-Za-z_]\w*)`, 'gi'); let m;
    while ((m = rx.exec(s))) if (!NO_ALIAS.test(m[2])) alias.set(m[2].toLowerCase(), norm(m[1])); }
  const real = (a) => a.map((x) => alias.get(x.toLowerCase()) || x);
  const modifica = unicos(sinCte(real([
    ...capturar(s, new RegExp(String.raw`\bINSERT\s+(?:INTO\s+)?(${ID})`)),
    ...capturar(s, new RegExp(String.raw`\bUPDATE\s+(?:TOP\s*\(\s*\d+\s*\)\s*)?(${ID})`)),
    ...capturar(s, new RegExp(String.raw`\bDELETE\s+(?:TOP\s*\(\s*\d+\s*\)\s*)?(?:FROM\s+)?(${ID})`)),
    ...capturar(s, new RegExp(String.raw`\bMERGE\s+(?:TOP\s*\(\s*\d+\s*\)\s*)?(?:INTO\s+)?(${ID})`)),
    ...capturar(s, new RegExp(String.raw`\bTRUNCATE\s+TABLE\s+(${ID})`)),
    ...capturar(s, new RegExp(String.raw`\bSELECT\b[^;]*?\bINTO\s+(${ID})`)),
  ])));
  const estructura = unicos([
    ...capturar(s, new RegExp(String.raw`\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|VIEW|INDEX\s+${ID}\s+ON|TRIGGER|SCHEMA|TYPE|SYNONYM)\s+(?:IF\s+EXISTS\s+)?(${ID})`)),
  ]);
  const procedimientos = unicos([
    ...capturar(s, new RegExp(String.raw`\bEXEC(?:UTE)?\s+(?:@\w+\s*=\s*)?(${ID})`)).filter((x) => !/^sp_executesql$/i.test(x) && !x.startsWith('@')),
    ...capturar(s, new RegExp(String.raw`\b(?:CREATE\s+OR\s+ALTER|CREATE|ALTER|DROP)\s+(?:PROC|PROCEDURE|FUNCTION)\s+(?:IF\s+EXISTS\s+)?(${ID})`)),
  ]);
  const todas = unicos(sinCte(capturar(s, new RegExp(String.raw`\b(?:FROM|JOIN|APPLY)\s+(${ID})`)))).filter((x) => !/\(/.test(x));
  const lee = todas.filter((x) => !modifica.some((m) => m.toLowerCase() === x.toLowerCase()));
  const dinamico = /\bsp_executesql\b|\bEXEC(?:UTE)?\s*\(/i.test(s);
  return { modifica, estructura, procedimientos, lee, dinamico };
}
const lista = (a, max = 8) => (a.length > max ? `${a.slice(0, max).join(', ')} y ${a.length - max} más` : a.join(', '));

/** Pase de un solo uso que deja el guardia y exige el ejecutor: misma huella, mismo objetivo, sin vencer. */
const PASE = '.pase.json';
function escribirPase(p, minutos = 15) {
  const pase = { huella: p.huella, objetivo: p.objetivo, modo: p.modo, acciones: p.acciones, expira: Date.now() + minutos * 60000 };
  fs.writeFileSync(path.join(p.dir, PASE), JSON.stringify(pase), 'utf8');
}

/** Texto del diálogo de permisos: solo lo que sirve para decidir, sin rutas ni comandos. */
function motivo(p, { ip, quien } = {}) {
  const c = p.conexion;
  const lineas = p.sql.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, '')).filter((l, i, a) => l || (i && a[i - 1]));
  const MAX = 15;
  const vista = lineas.slice(0, MAX).map((l) => '    ' + (l.length > 140 ? l.slice(0, 139) + '…' : l));
  if (lineas.length > MAX) vista.push(`    … (+${lineas.length - MAX} líneas)`);
  const accTxt = p.acciones.map((a) => NOMBRE[a]).join(' + ');
  const etq = c.etiquetas.length ? ` · ${c.etiquetas.join(', ')}` : '';
  const imp = impacto(p.sql);
  const impLineas = [
    imp.modifica.length && `  Modifica tablas: ${lista(imp.modifica)}`,
    imp.estructura.length && `  Cambia la estructura de: ${lista(imp.estructura)}`,
    imp.procedimientos.length && `  Procedimientos o funciones: ${lista(imp.procedimientos)}${p.acciones.includes('ejecutar') ? ' (lo que hagan por dentro no se ve aquí)' : ''}`,
    imp.lee.length && `  Lee tablas: ${lista(imp.lee)}`,
    imp.dinamico && '  Ojo: trae SQL dinámico; los objetos que arme no se pueden listar antes de correr.',
  ].filter(Boolean);
  return [
    `${p.objetivo === 'rollback' ? 'ROLLBACK · ' : ''}${accTxt} en «${c.nombre}»${etq} · ${MODO_ES[p.modo]}`,
    `Base de datos destino: ${p.base}`,
    `Servidor: ${c.servidor}${ip && ip !== c.host ? `  ·  IP ${ip}` : ''}`,
    `Usuario: ${c.usuario || '(sin usuario)'}  ·  lo pide ${quien || 'Claude'}`,
    `Qué hace: ${String(p.plan.explicacion).trim()}`,
    'Impacto:',
    ...(impLineas.length ? impLineas : ['  No toca tablas ni procedimientos (solo funciones del servidor).']),
    p.escribe ? 'Corre en una transacción; si falla, se deshace. Tiene rollback.sql.' : `Solo lectura · máximo ${limite(p.plan)} filas.`,
    'SQL:',
    ...vista,
  ].join('\n');
}
function limite(plan) {
  const n = parseInt(plan && plan.limite, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5000) : 200;
}

module.exports = { ACCIONES, ESCRITURA, MODOS, MODOS_LECTURA, NOMBRE, MODO_ES, modoLectura, permisos, host, conexiones, conexionesEn,
  accion, acciones, limpiarSql, modoPara, impacto, dirPlanes, resolverPlan, cargarPlan, escribirPase, PASE, motivo, limite, huella };
