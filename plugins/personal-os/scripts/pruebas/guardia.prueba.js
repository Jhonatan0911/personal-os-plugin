#!/usr/bin/env node
// Pruebas del guardia (guardia-empresa.js) con los permisos de ⚙ Config · Bases de datos (D-072, D-073)
// y del ejecutor bd-ejecutar.py (pase de un solo uso, huella, simulación sin conectar).
// Corre contra un OS_HOME temporal: nunca lee las conexiones ni las reglas reales.
//   node scripts/pruebas/guardia.prueba.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const GUARDIA = path.join(__dirname, '..', 'guardia-empresa.js');
const EJECUTOR = path.join(__dirname, '..', 'bd-ejecutar.py');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'guardia-'));
const con = path.join(home, 'conexiones');
fs.mkdirSync(con);
const escribir = (r, d) => fs.writeFileSync(r, JSON.stringify(d, null, 2));

// Conexiones ficticias (documentación: 192.0.2.0/24 y 198.51.100.0/24 son rangos reservados para ejemplos).
escribir(path.join(con, 'auto.json'), { servidor: '192.0.2.10,1433', catalogos: ['db_auto'], permisos: { leer: 'automatico' } });
escribir(path.join(con, 'pregunta.json'), { servidor: '192.0.2.11', catalogos: ['db_pregunta'], permisos: { leer: 'preguntar' } });
escribir(path.join(con, 'bloq.json'), { servidor: '192.0.2.12', catalogos: ['db_bloq'], permisos: { leer: 'bloqueado' } });
escribir(path.join(con, 'replica.json'), { servidor: '198.51.100.7', catalogos: ['db_replica'], permisos: { leer: 'automatico' } });
escribir(path.join(con, 'prod.json'), { servidor: '198.51.100.9', catalogos: ['db_prod'], permisos: { leer: 'automatico' } });
escribir(path.join(con, 'heredada.json'), { servidor: '192.0.2.13', catalogos: ['db_heredada'], modo_lectura: 'automatico' });
escribir(path.join(con, 'escr.json'), { servidor: '192.0.2.14', usuario: 'desarrollo', catalogos: ['db_escr'],
  permisos: { leer: 'automatico', crear: 'automatico', actualizar: 'preguntar', borrar: 'bloqueado', estructura: 'bloqueado', ejecutar: 'preguntar' } });
escribir(path.join(con, 'prodw.json'), { servidor: '198.51.100.9', catalogos: ['db_prodw'], permisos: { leer: 'automatico', crear: 'automatico' } });
escribir(path.join(home, 'conexiones-bd.json'), { conexiones: ['auto', 'pregunta', 'bloq', 'replica', 'prod', 'heredada', 'escr', 'prodw']
  .map((id) => ({ id, nombre: id, archivo: path.join(con, `${id}.json`), motor: 'sqlserver', etiquetas: [] })), etiquetas_propias: [] });
const reglas = { servidores_deny: ['198.51.100.9', '198.51.100.20'], servidores_ask: ['198.51.100.7'], servidores_test: ['192.0.2.11'],
  clientes_sql: ['sqlcmd', 'Invoke-Sqlcmd', 'mongosh'], sql_escritura: ['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'TRUNCATE', 'DROP', 'ALTER', 'CREATE'] };

function decide(cmd, conReglas = true) {
  const g = path.join(home, 'guardia-empresa.json');
  if (conReglas) escribir(g, reglas); else if (fs.existsSync(g)) fs.unlinkSync(g);
  const r = spawnSync(process.execPath, [GUARDIA], { input: JSON.stringify({ tool_name: 'PowerShell', tool_input: { command: cmd }, cwd: home }),
    env: Object.assign({}, process.env, { PERSONAL_OS_HOME: home }), encoding: 'utf8' });
  if (r.status !== 0) return `exit ${r.status}: ${r.stderr}`;
  if (!r.stdout.trim()) return 'pasa';
  const h = JSON.parse(r.stdout).hookSpecificOutput;
  ultimoMotivo = h.permissionDecisionReason;
  return h.permissionDecision;
}
let ultimoMotivo = '';

// Planes del ejecutor
const planes = path.join(home, 'bd-planes');
function plan(id, p, sql, rb) {
  const d = path.join(planes, id);
  fs.mkdirSync(d, { recursive: true });
  escribir(path.join(d, 'plan.json'), Object.assign({ explicacion: 'prueba de ' + id }, p));
  fs.writeFileSync(path.join(d, 'consulta.sql'), sql);
  if (rb) fs.writeFileSync(path.join(d, 'rollback.sql'), rb);
}
const SEL = 'SELECT TOP(5) id, nombre\nFROM dbo.t\nWHERE estado = 1';
plan('leer-auto', { conexion: 'auto', base: 'db_auto' }, SEL);
plan('leer-preg', { conexion: 'pregunta', base: 'db_pregunta' }, SEL);
plan('leer-bloq', { conexion: 'bloq', base: 'db_bloq' }, SEL);
plan('upd-preg', { conexion: 'escr', base: 'db_escr' }, 'UPDATE dbo.t SET a = 1 WHERE id = 7', 'UPDATE dbo.t SET a = 0 WHERE id = 7');
plan('upd-sin-rb', { conexion: 'escr', base: 'db_escr' }, 'UPDATE dbo.t SET a = 1 WHERE id = 7');
plan('del-bloq', { conexion: 'escr', base: 'db_escr' }, 'DELETE FROM dbo.t WHERE id = 7', 'INSERT INTO dbo.t (id) VALUES (7)');
plan('ins-auto', { conexion: 'escr', base: 'db_escr' }, 'INSERT INTO dbo.t (id) VALUES (8)', 'DELETE FROM dbo.t WHERE id = 8');
plan('mixto', { conexion: 'escr', base: 'db_escr' }, 'INSERT INTO dbo.t (id) VALUES (8)\nGO\nUPDATE dbo.t SET a = 2 WHERE id = 8', 'DELETE FROM dbo.t WHERE id = 8');
plan('ins-prod', { conexion: 'prodw', base: 'db_prodw' }, 'INSERT INTO dbo.t (id) VALUES (9)', 'DELETE FROM dbo.t WHERE id = 9');
plan('comentario', { conexion: 'auto', base: 'db_auto' }, "-- DELETE FROM dbo.t\nSELECT TOP(1) 'UPDATE' AS texto FROM dbo.t");
plan('no-reg', { conexion: 'otra', base: 'x' }, SEL);
plan('base-fuera', { conexion: 'auto', base: 'db_ajena' }, SEL);
plan('sin-explicar', { conexion: 'auto', base: 'db_auto', explicacion: '' }, SEL);
plan('largo', { conexion: 'pregunta', base: 'db_pregunta' }, Array.from({ length: 40 }, (_, i) => `SELECT TOP(1) ${i} AS n`).join('\n'));
const PY = process.platform === 'win32' ? 'python' : 'python3';
const ej = (id, extra = '') => `${PY} "${EJECUTOR}" ${id}${extra}`;

const S = '-Query "SELECT TOP(5) * FROM t"';
const casos = [
  // [nombre, comando, esperado, conReglas]
  ['lectura automática pasa', `scripts\\dbread.ps1 -ConfirmDb db_auto ${S}`, 'pasa'],
  ['lectura en «me pregunta» pide OK', `scripts\\dbread.ps1 -ConfirmDb db_pregunta ${S}`, 'ask'],
  ['lectura bloqueada se niega', `scripts\\dbread.ps1 -ConfirmDb db_bloq ${S}`, 'deny'],
  ['por host también se reconoce', `sqlcmd -S 192.0.2.12 -Q "SELECT TOP(1) 1"`, 'deny'],
  ['host con puerto e instancia', `sqlcmd -S tcp:192.0.2.11,1433 -Q "SELECT TOP(1) 1"`, 'ask'],
  ['D-073: réplica registrada, manda la consola (automático)', `scripts\\dbread.ps1 -ConfirmDb db_replica ${S}`, 'pasa'],
  ['D-073: producción registrada, manda la consola (automático)', `scripts\\dbread.ps1 -ConfirmDb db_prod ${S}`, 'pasa'],
  ['producción NO registrada sigue bloqueada por la org', 'sqlcmd -S 198.51.100.20 -Q "SELECT TOP(1) 1"', 'deny'],
  ['modo heredado de /bd-test (automático)', `scripts\\dbread.ps1 -ConfirmDb db_heredada ${S}`, 'pasa'],
  ['escritura en conexión automática se niega', 'sqlcmd -S 192.0.2.10 -d db_auto -Q "UPDATE t SET a=1"', 'deny'],
  ['escritura en test también se niega', 'sqlcmd -S 192.0.2.11 -Q "INSERT INTO t VALUES(1)"', 'deny'],
  ['EXEC es escritura', 'sqlcmd -S 192.0.2.10 -Q "EXEC dbo.p"', 'deny'],
  ['SELECT INTO es escritura', 'sqlcmd -S 192.0.2.10 -Q "SELECT * INTO t2 FROM t"', 'deny'],
  ['mongo deleteMany se niega', 'mongosh "mongodb://192.0.2.10/db_auto" --eval "db.c.deleteMany({})"', 'deny'],
  ['sin reglas de la org, igual rigen los permisos', `scripts\\dbread.ps1 -ConfirmDb db_bloq ${S}`, 'deny', false],
  ['sin reglas de la org, escrituras igual se niegan', 'sqlcmd -S 192.0.2.10 -Q "DELETE FROM t"', 'deny', false],
  ['sqltest write se niega siempre (aunque el SQL venga en un archivo)', 'python scripts\\sqltest.py write --file publicar.sql', 'deny'],
  ['sqltest read en base bloqueada se niega', 'python scripts/sqltest.py read --db db_bloq "SELECT TOP(5) * FROM t"', 'deny'],
  ['sqltest read en base automática pasa', 'python scripts/sqltest.py read --db db_auto "SELECT TOP(5) * FROM t"', 'pasa'],
  // ejecutor (D-073)
  ['ejecutor: leer en automático se permite', ej('leer-auto'), 'allow'],
  ['ejecutor: leer en «me pregunta» pregunta', ej('leer-preg'), 'ask'],
  ['ejecutor: leer bloqueado se niega', ej('leer-bloq'), 'deny'],
  ['ejecutor: actualizar en «me pregunta» pregunta', ej('upd-preg'), 'ask'],
  ['ejecutor: escritura sin rollback se niega', ej('upd-sin-rb'), 'deny'],
  ['ejecutor: borrar bloqueado se niega', ej('del-bloq'), 'deny'],
  ['ejecutor: crear en automático se permite', ej('ins-auto'), 'allow'],
  ['ejecutor: crear + actualizar → el más estricto (pregunta)', ej('mixto'), 'ask'],
  ['ejecutor: producción registrada en automático, manda la consola', ej('ins-prod'), 'allow'],
  ['ejecutor: un DELETE en un comentario o un texto no es borrar', ej('comentario'), 'allow'],
  ['ejecutor: conexión no registrada se niega', ej('no-reg'), 'deny'],
  ['ejecutor: base fuera de la conexión se niega', ej('base-fuera'), 'deny'],
  ['ejecutor: sin explicación se niega', ej('sin-explicar'), 'deny'],
  ['ejecutor: --rollback del plan pregunta (es UPDATE)', ej('upd-preg', ' --rollback'), 'ask'],
  ['ejecutor: encadenado con otro comando se niega', ej('leer-auto') + '; Remove-Item x', 'deny'],
  ['ejecutor: bandera desconocida se niega', ej('leer-auto', ' --forzar'), 'deny'],
  ['ejecutor: plan inexistente se niega', ej('no-existe'), 'deny'],
  // controles negativos: nada que ver con una base registrada
  ['nombrar la base en una nota no es conectar', 'Get-Content notas.md | Select-String db_bloq', 'pasa'],
  ['base no registrada en lectura no se toca', `scripts\\dbread.ps1 -ConfirmDb db_otra ${S}`, 'pasa'],
  ['subcadena de una base no cuenta', `scripts\\dbread.ps1 -ConfirmDb db_bloqueo_x ${S}`, 'pasa'],
];

let fallos = 0;
for (const [nombre, cmd, esperado, conReglas = true] of casos) {
  const r = decide(cmd, conReglas);
  const ok = r === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${ok ? '' : ` · esperaba ${esperado}, dio ${r}`}`);
}

// Texto del diálogo: lo que sirve para decidir, sin rutas ni comandos.
function v(nombre, ok) { total++; if (!ok) fallos++; console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}`); }
let total = casos.length;
decide(ej('upd-preg'));
const m = ultimoMotivo;
v('diálogo: destino, servidor, usuario, qué hace y SQL', ['Base de datos destino: db_escr', 'Servidor: 192.0.2.14', 'Usuario: desarrollo', 'Qué hace: prueba de upd-preg', 'SQL:', 'UPDATE dbo.t SET a = 1'].every((x) => m.includes(x)));
v('diálogo: trae el impacto (tablas que modifica)', /Impacto:/.test(m) && /Modifica tablas: dbo\.t/.test(m));
v('diálogo: dice transacción y rollback', /transacción/.test(m) && /rollback/.test(m));
v('diálogo: sin rutas, python ni bd-planes', !/python|bd-planes|\.json|[A-Z]:\\/i.test(m));
decide(ej('largo'));
v('diálogo: SQL largo recortado a 15 líneas', /\+25 líneas/.test(ultimoMotivo) && ultimoMotivo.split('\n').filter((l) => /^ {4}SELECT/.test(l)).length === 15);

// Ejecutor: pase de un solo uso y huella (simulación, no conecta)
const corre = (id, extra = []) => spawnSync(PY, [EJECUTOR, id, '--simular', ...extra], { env: Object.assign({}, process.env, { PERSONAL_OS_HOME: home }), encoding: 'utf8' });
decide(ej('leer-auto'));
let r1 = corre('leer-auto');
v('ejecutor: con pase vigente corre (simulado)', r1.status === 0 && /SIMULACIÓN/.test(r1.stdout));
r1 = corre('leer-auto');
v('ejecutor: el pase es de un solo uso', r1.status === 3 && /sin pase/.test(r1.stderr));
decide(ej('mixto'));
r1 = corre('mixto');
v('ejecutor: escritura con pase corre en transacción (simulado)', r1.status === 0 && /en transacción/.test(r1.stdout));
decide(ej('upd-preg'));
fs.appendFileSync(path.join(planes, 'upd-preg', 'consulta.sql'), '\nUPDATE dbo.t SET a = 3 WHERE id = 7');
r1 = corre('upd-preg');
v('ejecutor: si el SQL cambió después del permiso, no corre', r1.status === 3 && /huella/.test(r1.stderr));
fs.rmSync(path.join(planes, 'ins-auto', '.pase.json'), { force: true });   // el de la tabla de casos
  r1 = corre('ins-auto');
v('ejecutor: sin pasar por el guardia no corre', r1.status === 3);
decide(ej('upd-preg', ' --rollback'));
r1 = corre('upd-preg');
v('ejecutor: un pase de rollback no sirve para la consulta', r1.status === 3);
const log = fs.existsSync(path.join(home, 'bd-ejecutor.log')) ? fs.readFileSync(path.join(home, 'bd-ejecutor.log'), 'utf8') : '';
v('ejecutor: deja bitácora sin contraseñas', log.includes('"estado": "simulado"') && !/password|PWD/i.test(log));

fs.rmSync(home, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} control(es) fallan.` : `\nLos ${total} controles pasan.`);
process.exit(fallos ? 1 : 0);
