#!/usr/bin/env node
// Pruebas del guardia (guardia-empresa.js) con los permisos de ⚙ Config · Bases de datos (D-071 F2).
// Corre contra un OS_HOME temporal: nunca lee las conexiones ni las reglas reales.
//   node scripts/pruebas/guardia.prueba.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const GUARDIA = path.join(__dirname, '..', 'guardia-empresa.js');
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
escribir(path.join(home, 'conexiones-bd.json'), { conexiones: ['auto', 'pregunta', 'bloq', 'replica', 'prod', 'heredada']
  .map((id) => ({ id, nombre: id, archivo: path.join(con, `${id}.json`), motor: 'sqlserver', etiquetas: [] })), etiquetas_propias: [] });
const reglas = { servidores_deny: ['198.51.100.9'], servidores_ask: ['198.51.100.7'], servidores_test: ['192.0.2.11'],
  clientes_sql: ['sqlcmd', 'Invoke-Sqlcmd', 'mongosh'], sql_escritura: ['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'TRUNCATE', 'DROP', 'ALTER', 'CREATE'] };

function decide(cmd, conReglas = true) {
  const g = path.join(home, 'guardia-empresa.json');
  if (conReglas) escribir(g, reglas); else if (fs.existsSync(g)) fs.unlinkSync(g);
  const r = spawnSync(process.execPath, [GUARDIA], { input: JSON.stringify({ tool_name: 'PowerShell', tool_input: { command: cmd }, cwd: home }),
    env: Object.assign({}, process.env, { PERSONAL_OS_HOME: home }), encoding: 'utf8' });
  if (r.status !== 0) return `exit ${r.status}: ${r.stderr}`;
  if (!r.stdout.trim()) return 'pasa';
  return JSON.parse(r.stdout).hookSpecificOutput.permissionDecision;
}

const S = '-Query "SELECT TOP(5) * FROM t"';
const casos = [
  // [nombre, comando, esperado, conReglas]
  ['lectura automática pasa', `scripts\\dbread.ps1 -ConfirmDb db_auto ${S}`, 'pasa'],
  ['lectura en «me pregunta» pide OK', `scripts\\dbread.ps1 -ConfirmDb db_pregunta ${S}`, 'ask'],
  ['lectura bloqueada se niega', `scripts\\dbread.ps1 -ConfirmDb db_bloq ${S}`, 'deny'],
  ['por host también se reconoce', `sqlcmd -S 192.0.2.12 -Q "SELECT TOP(1) 1"`, 'deny'],
  ['host con puerto e instancia', `sqlcmd -S tcp:192.0.2.11,1433 -Q "SELECT TOP(1) 1"`, 'ask'],
  ['réplica de la org gana a automático', `scripts\\dbread.ps1 -ConfirmDb db_replica ${S}`, 'ask'],
  ['producción de la org gana a automático', `scripts\\dbread.ps1 -ConfirmDb db_prod ${S}`, 'deny'],
  ['modo heredado de /bd-test (automático)', `scripts\\dbread.ps1 -ConfirmDb db_heredada ${S}`, 'pasa'],
  ['escritura en conexión automática se niega', 'sqlcmd -S 192.0.2.10 -d db_auto -Q "UPDATE t SET a=1"', 'deny'],
  ['escritura en test también se niega', 'sqlcmd -S 192.0.2.11 -Q "INSERT INTO t VALUES(1)"', 'deny'],
  ['EXEC es escritura', 'sqlcmd -S 192.0.2.10 -Q "EXEC dbo.p"', 'deny'],
  ['SELECT INTO es escritura', 'sqlcmd -S 192.0.2.10 -Q "SELECT * INTO t2 FROM t"', 'deny'],
  ['mongo deleteMany se niega', 'mongosh "mongodb://192.0.2.10/db_auto" --eval "db.c.deleteMany({})"', 'deny'],
  ['sin reglas de la org, igual rigen los permisos', `scripts\\dbread.ps1 -ConfirmDb db_bloq ${S}`, 'deny', false],
  ['sin reglas de la org, escrituras igual se niegan', 'sqlcmd -S 192.0.2.10 -Q "DELETE FROM t"', 'deny', false],
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
fs.rmSync(home, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} control(es) fallan.` : `\nLos ${casos.length} controles pasan.`);
process.exit(fallos ? 1 : 0);
