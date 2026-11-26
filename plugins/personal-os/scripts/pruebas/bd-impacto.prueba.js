#!/usr/bin/env node
// Controles de la lectura de impacto (qué tablas y procedimientos toca un SQL) que muestra el diálogo de BD (D-073).
//   node scripts/pruebas/bd-impacto.prueba.js
'use strict';
const BD = require('../lib/bd-permisos.js');
const casos = [
  ['update con join', `UPDATE c SET c.Estado = 'INA' FROM dbo.Agd_Cita c INNER JOIN [dbo].[Pac_Paciente] p ON p.Id = c.Paciente_Id WHERE p.Id = 7`,
    { modifica: ['dbo.Agd_Cita'], lee: ['dbo.Pac_Paciente'] }],
  ['insert select', `INSERT INTO dbo.Par_AgdCanal (Id, Descripcion) SELECT Id, Nombre FROM dbo.Origen WHERE x = 1`, { modifica: ['dbo.Par_AgdCanal'], lee: ['dbo.Origen'] }],
  ['delete', `DELETE FROM dbo.Agd_Log WHERE Fecha < '2020-01-01'`, { modifica: ['dbo.Agd_Log'], lee: [] }],
  ['exec sp', `EXEC dbo.sp_RecalcularCitas @Id = 3; EXEC @r = dbo.sp_Otro`, { procedimientos: ['dbo.sp_RecalcularCitas', 'dbo.sp_Otro'] }],
  ['create or alter proc', `CREATE OR ALTER PROCEDURE dbo.sp_Nuevo AS BEGIN SELECT 1 FROM dbo.T1 END`, { procedimientos: ['dbo.sp_Nuevo'], lee: ['dbo.T1'] }],
  ['alter table', `ALTER TABLE dbo.Agd_Cita ADD Motivo_Id INT NULL`, { estructura: ['dbo.Agd_Cita'] }],
  ['cte', `WITH x AS (SELECT Id FROM dbo.A) UPDATE dbo.B SET v = 1 WHERE Id IN (SELECT Id FROM x)`, { modifica: ['dbo.B'], lee: ['dbo.A'] }],
  ['comentario no cuenta', `-- DELETE FROM dbo.Peligro\nSELECT TOP(5) * FROM dbo.Segura`, { modifica: [], lee: ['dbo.Segura'] }],
  ['sin tablas', `SELECT TOP(1) DB_NAME() AS base`, { modifica: [], lee: [], procedimientos: [] }],
  ['delete con alias', `DELETE d FROM dbo.Agd_Detalle AS d JOIN dbo.Agd_Cita c ON c.Id = d.Cita_Id WHERE c.Id = 1`, { modifica: ['dbo.Agd_Detalle'], lee: ['dbo.Agd_Cita'] }],
  ['dinamico', `EXEC sp_executesql N'DELETE FROM dbo.X'`, { dinamico: true, modifica: [] }],
];
let f = 0;
for (const [n, sql, esp] of casos) {
  const r = BD.impacto(sql);
  const ok = Object.entries(esp).every(([k, v]) => JSON.stringify(Array.isArray(v) ? [...r[k]].sort() : r[k]) === JSON.stringify(Array.isArray(v) ? [...v].sort() : v));
  if (!ok) f++;
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${n}${ok ? '' : ' · ' + JSON.stringify(r)}`);
}
console.log(f ? `\n${f} control(es) fallan.` : `\nLos ${casos.length} controles pasan.`);
process.exit(f ? 1 : 0);
