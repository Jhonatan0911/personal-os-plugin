#!/usr/bin/env node
// Pruebas de los lectores de BD de las mesas (mesa-nueva/assets/dbread.ps1 y mongoread.py) con los permisos de
// ⚙ Config · Bases de datos (D-072). Siempre en --DryRun / -DryRun: no se conecta a ninguna base.
// Datos ficticios: 192.0.2.0/24 y 198.51.100.0/24 son rangos reservados para documentación.
//   node scripts/pruebas/wrappers-bd.prueba.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ASSETS = path.resolve(__dirname, '..', '..', 'skills', 'mesa-nueva', 'assets');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'wrappers-bd-'));
const HOME = path.join(T, 'os-home');
fs.mkdirSync(path.join(HOME, 'conexiones'), { recursive: true });
const J = (r, d) => fs.writeFileSync(r, JSON.stringify(d, null, 2));
const con = (id, servidor, catalogos, extra) => { const a = path.join(HOME, 'conexiones', `${id}.json`); J(a, Object.assign({ servidor, catalogos }, extra)); return { id, nombre: id, archivo: a }; };
J(path.join(HOME, 'conexiones-bd.json'), { conexiones: [
  con('staging-auto', '192.0.2.30,1433', ['db_staging'], { permisos: { leer: 'automatico' } }),
  con('staging-bloq', '192.0.2.31', ['db_cerrada'], { permisos: { leer: 'bloqueado' } }),
  con('heredada', '192.0.2.32', ['db_vieja'], { modo_lectura: 'supervisado' }),
  con('prod', '198.51.100.9', ['db_prod'], { permisos: { leer: 'automatico' } }),
  con('mongo-auto', '192.0.2.40', ['mg_staging'], { permisos: { leer: 'automatico' } }),
  con('mongo-bloq', '192.0.2.41', ['mg_cerrada'], { permisos: { leer: 'bloqueado' } }),
] });
J(path.join(HOME, 'guardia-empresa.json'), { servidores_deny: ['198.51.100.9'] });
const env = Object.assign({}, process.env, { PERSONAL_OS_HOME: HOME });

function appsettings(nombre, clave, cadena) {
  const r = path.join(T, nombre);
  fs.writeFileSync(r, `{\n  // "${clave}": "comentada, no cuenta",\n  "${clave}": "${cadena}"\n}\n`);
  return r;
}
function dbread(servidor, catalogo, query, extra = []) {
  const a = appsettings(`sql-${servidor}-${catalogo}.json`, 'ConexionSQL', `Data Source=${servidor};Initial Catalog=${catalogo};User ID=u;Password=p`);
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(ASSETS, 'dbread.ps1'),
    '-ConfirmDb', catalogo, '-Query', query, '-AppSettings', a, '-DryRun', ...extra], { env, encoding: 'utf8', timeout: 60000 });
  return { ok: r.status === 0 && /DryRun/.test(r.stdout), salida: (r.stdout + r.stderr).replace(/\s+/g, ' ') };
}
function mongoread(host, db) {
  const a = appsettings(`mg-${host}-${db}.json`, 'MongoServerConnectionString', `mongodb://u:p@${host}:27017/${db}`);
  const r = spawnSync('python', ['-I', path.join(ASSETS, 'mongoread.py'), '--ConfirmDb', db, '--Collection', 'c', '--Project', '{"a":1}',
    '--Limit', '5', '--AppSettings', a, '--DryRun'], { env, encoding: 'utf8', timeout: 60000 });
  return { ok: r.status === 0 && /DryRun/.test(r.stdout), salida: (r.stdout + r.stderr).replace(/\s+/g, ' ') };
}

const S = 'SELECT TOP(5) a FROM t';
const casos = [
  ['dbread · staging registrada en automático se lee (antes se bloqueaba por no decir «test»)', () => dbread('192.0.2.30,1433', 'db_staging', S), true],
  ['dbread · staging con lectura bloqueada no se lee', () => dbread('192.0.2.31', 'db_cerrada', S), false],
  ['dbread · conexión heredada (supervisado) se lee', () => dbread('192.0.2.32', 'db_vieja', S), true],
  ['dbread · producción de la org gana a automático', () => dbread('198.51.100.9', 'db_prod', S), false],
  ['dbread · no registrada y sin «test» se bloquea', () => dbread('192.0.2.99', 'db_otra', S), false],
  ['dbread · no registrada con «test» se lee (regla de siempre)', () => dbread('192.0.2.99', 'db_otra_test', S), true],
  ['dbread · misma base en otro servidor no hereda el permiso', () => dbread('192.0.2.98', 'db_staging', S), false],
  ['dbread · escritura bloqueada aunque esté en automático', () => dbread('192.0.2.30', 'db_staging', 'UPDATE t SET a = 1'), false],
  ['dbread · EXEC bloqueado', () => dbread('192.0.2.30', 'db_staging', 'EXEC dbo.p'), false],
  ['dbread · -AllowExec ya no abre la puerta', () => dbread('192.0.2.30', 'db_staging', 'EXEC dbo.p', ['-AllowExec']), false],
  ['mongoread · staging registrada en automático se lee', () => mongoread('192.0.2.40', 'mg_staging'), true],
  ['mongoread · lectura bloqueada no se lee', () => mongoread('192.0.2.41', 'mg_cerrada'), false],
  ['mongoread · producción de la org se bloquea', () => mongoread('198.51.100.9', 'db_prod'), false],
  ['mongoread · no registrada y sin «test» se bloquea', () => mongoread('192.0.2.99', 'mg_otra'), false],
  ['mongoread · no registrada con «prueba» se lee', () => mongoread('192.0.2.99', 'mg_prueba'), true],
];
let fallos = 0;
for (const [nombre, f, esperado] of casos) {
  const r = f();
  const ok = r.ok === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${ok ? '' : ` · esperaba ${esperado ? 'pasar' : 'bloquear'}: ${r.salida.slice(0, 260)}`}`);
}
fs.rmSync(T, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} control(es) fallan.` : `\nLos ${casos.length} controles pasan.`);
process.exit(fallos ? 1 : 0);
