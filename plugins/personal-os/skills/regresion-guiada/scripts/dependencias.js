#!/usr/bin/env node
// Matriz de dependencias externas (proyectos fuera del grupo que hacen falta) — COMPUERTA de la fase 3.
//
// Uso (con REGRESION_MESA = la mesa):
//   node dependencias.js importar          lee conocimiento/DEPENDENCIAS_EXTERNAS.json y arma/actualiza
//                                          .regresion/dependencias.json conservando las decisiones ya tomadas;
//                                          trae las ramas reales de cada repo con `git ls-remote` (sin clonar).
//   node dependencias.js estado            resume decididos / pendientes
//   node dependencias.js exigir            sale 1 si queda alguna fila sin decidir (o «bajar» sin rama):
//                                          la skill NO avanza a la fase 4 hasta que salga 0.
//   node dependencias.js ramas <org> <proyecto> <repo>   lista ramas remotas (la usa el servidor de la página)
//
// git ls-remote es una lectura del servidor de repos hecha por git del sistema, no por las apps de la prueba:
// no entra en la regla de «solo localhost» (que aplica a las apps y scripts que se prueban).
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const mesa = process.env.REGRESION_MESA || process.cwd();
const fuente = path.join(mesa, 'conocimiento', 'DEPENDENCIAS_EXTERNAS.json');
const leerPerfil = () => { try { return JSON.parse(fs.readFileSync(path.join(mesa, 'kit', 'perfil.json'), 'utf8').replace(/^﻿/, '')); } catch { return {}; } };
const REPOS = leerPerfil().repos || {};
// Plantilla de URL de clonado; por defecto Azure DevOps. Placeholders: {organizacion} {proyecto} {repo}.
const URL_PLANTILLA = REPOS.url_plantilla || 'https://dev.azure.com/{organizacion}/{proyecto}/_git/{repo}';
const destino = path.join(mesa, '.regresion', 'dependencias.json');

const leer = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return d; } };
function guardar(obj) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  obj.actualizado = new Date().toISOString();
  const tmp = destino + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8'); fs.renameSync(tmp, destino);
}
function ramas(org, proyecto, repo) {
  if (!org || !proyecto || !repo) return [];
  try {
    const url = URL_PLANTILLA.replace('{organizacion}', encodeURIComponent(org)).replace('{proyecto}', encodeURIComponent(proyecto)).replace('{repo}', encodeURIComponent(repo));
    const out = execFileSync('git', ['ls-remote', '--heads', url], { encoding: 'utf8', timeout: 45000, stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split(/\r?\n/).map(l => l.split('refs/heads/')[1]).filter(Boolean).sort((a, b) => (b === 'main') - (a === 'main') || a.localeCompare(b));
  } catch { return []; }
}
function pendientes(d) {
  return (d.items || []).filter(i => !i.decision || !i.decision.accion || (i.decision.accion === 'bajar' && !i.decision.rama));
}

const cmd = process.argv[2];
if (cmd === 'ramas') { console.log(JSON.stringify(ramas(process.argv[3], process.argv[4], process.argv[5]))); process.exit(0); }

if (cmd === 'importar') {
  const f = leer(fuente);
  if (!f || !Array.isArray(f.items)) { console.error(`No encuentro ${fuente} con "items". Lo escribe el agente de dependencias externas (fase 3).`); process.exit(2); }
  const previo = leer(destino, { items: [] });
  const decisiones = Object.fromEntries((previo.items || []).map(i => [i.id, i.decision]));
  const asig = leer(path.join(mesa, 'asignaciones.json'), { personas: [] });
  const duenos = (asig.personas || []).map(p => ({ nombre: p.nombre, grupo: p.grupo, grupo_nombre: p.grupo_nombre }));
  const proyectos = new Set(REPOS.proyectos || []);
  (asig.personas || []).forEach(p => (p.proyectos || []).forEach(x => x.proyecto_azure && proyectos.add(x.proyecto_azure)));
  const items = f.items.map(i0 => {
    const dec = decisiones[i0.id];
    // Lo que el responsable corrigió a mano (repo, proyecto) manda sobre lo que trae el agente.
    const i = { ...i0, ...(dec && dec.repo ? { repo: dec.repo } : {}), ...(dec && dec.proyecto_azure ? { proyecto_azure: dec.proyecto_azure } : {}) };
    const org = i.organizacion || REPOS.organizacion || '';
    if (i.proyecto_azure) proyectos.add(i.proyecto_azure);
    const r = ramas(org, i.proyecto_azure, i.repo);
    process.stdout.write(`  ${String(i.id).padEnd(32)} ${r.length ? r.length + ' ramas' : 'sin ramas (repo/proyecto por confirmar)'}\n`);
    return { ...i, organizacion: org, ramas: r, decision: decisiones[i.id] || null };
  });
  guardar({ generado: new Date().toISOString(), duenos, proyectos_azure: [...proyectos].sort(), items });
  const p = pendientes({ items });
  console.log(`Matriz de dependencias: ${items.length} proyectos externos · ${items.length - p.length} decididos · ${p.length} pendientes. Ábrela en http://127.0.0.1:4747`);
  process.exit(0);
}

const d = leer(destino);
if (!d) { console.error('No hay .regresion/dependencias.json. Corre primero: node dependencias.js importar'); process.exit(2); }
const p = pendientes(d);
if (cmd === 'estado' || cmd === 'exigir') {
  for (const i of d.items) {
    const x = i.decision;
    console.log(`${x && x.accion ? (x.accion === 'bajar' ? 'BAJAR   ' : 'NO BAJAR') : 'PENDIENTE'}  ${i.api}${i.repo ? ` (${i.repo})` : ''}${x && x.accion === 'bajar' ? ` · ${x.proyecto_azure}/${x.rama} · ${x.dueno || 's/dueño'}` : ''}${x && x.accion === 'no_bajar' ? ' · sale de las pruebas: ' + (i.funciones || []).join('; ') : ''}`);
  }
  console.log(`${d.items.length - p.length}/${d.items.length} decididos.`);
  if (cmd === 'exigir' && p.length) { console.error(`COMPUERTA CERRADA: faltan ${p.length} decisiones en la matriz de dependencias (página en vivo).`); process.exit(1); }
  process.exit(0);
}
console.error('Comandos: importar | estado | exigir | ramas <org> <proyecto> <repo>'); process.exit(2);
