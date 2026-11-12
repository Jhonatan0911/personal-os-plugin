#!/usr/bin/env node
// Estado de la regresión para la página local en vivo.
// Escribe <mesa>/.regresion/estado.json de forma atómica. Sin dependencias.
//
// Uso:
//   node estado.js init  --persona "Nombre" --grupo 1 --issue PROY-123 [--titulo "Regresión de <sistema>"]
//   node estado.js fase  --n 3 --estado en_curso|listo|bloqueado|omitida [--detalle "texto"]
//   node estado.js paso  --n 3 --texto "Leyendo citas-backend" [--progreso 40]
//   node estado.js evento --tipo info|ok|error|pregunta --texto "..."
//   node estado.js proyecto --repo citas-backend --campo clonado|conocimiento|docs|arranca --valor ok|error|pendiente
//   node estado.js contador --nombre casos_ok --sumar 1     (o --valor 120)
//   node estado.js ver
'use strict';
const fs = require('fs');
const path = require('path');

const FASES = [
  'Identificar persona y confirmar proyectos',
  'Ramas y clonado',
  'Base de conocimiento por proyecto',
  'Documentación en el repo de docs',
  'Credenciales y lectura del periodo de referencia',
  'Mapa de integración y arranque en local',
  'Reproducir la operación del periodo',
  'Logs agrupados por causa',
  'Revisión humana con el especialista',
  'Matriz reutilizable y cierre'
];

const mesa = process.env.REGRESION_MESA || process.cwd();
const dir = path.join(mesa, '.regresion');
const file = path.join(dir, 'estado.json');

function args() {
  const a = process.argv.slice(3); const o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) { o[a[i].slice(2)] = a[i + 1]; i++; }
  return o;
}
function leer() {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function guardar(s) {
  fs.mkdirSync(dir, { recursive: true });
  s.actualizado = new Date().toISOString();
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}
function exigir(s) { if (!s) { console.error('No hay estado. Corre primero: node estado.js init ...'); process.exit(2); } return s; }

const cmd = process.argv[2]; const o = args();
let s = leer();

switch (cmd) {
  case 'init':
    s = {
      titulo: o.titulo || '', persona: o.persona || '', grupo: Number(o.grupo || 0), issue: o.issue || '',
      inicio: new Date().toISOString(), actualizado: null,
      fase_actual: 1,
      fases: FASES.map((t, i) => ({ n: i + 1, titulo: t, estado: i === 0 ? 'en_curso' : 'pendiente', detalle: '', inicio: i === 0 ? new Date().toISOString() : null, fin: null })),
      paso: { texto: 'Arrancando', progreso: 0 },
      proyectos: {}, contadores: {}, eventos: []
    };
    break;
  case 'fase': {
    exigir(s); const f = s.fases[Number(o.n) - 1]; if (!f) { console.error('Fase inválida'); process.exit(2); }
    f.estado = o.estado || f.estado; if (o.detalle) f.detalle = o.detalle;
    if (f.estado === 'en_curso') { f.inicio = f.inicio || new Date().toISOString(); s.fase_actual = f.n; }
    if (['listo', 'omitida'].includes(f.estado)) { f.fin = new Date().toISOString(); }
    s.eventos.push({ t: new Date().toISOString(), tipo: f.estado === 'listo' ? 'ok' : f.estado === 'bloqueado' ? 'error' : 'info', texto: `Fase ${f.n} · ${f.titulo}: ${f.estado}${o.detalle ? ' — ' + o.detalle : ''}` });
    break; }
  case 'paso':
    exigir(s); if (o.n) s.fase_actual = Number(o.n);
    s.paso = { texto: o.texto || '', progreso: o.progreso != null ? Number(o.progreso) : s.paso.progreso };
    break;
  case 'evento':
    exigir(s); s.eventos.push({ t: new Date().toISOString(), tipo: o.tipo || 'info', texto: o.texto || '' });
    if (s.eventos.length > 500) s.eventos = s.eventos.slice(-500);
    break;
  case 'proyecto':
    exigir(s); s.proyectos[o.repo] = s.proyectos[o.repo] || {}; s.proyectos[o.repo][o.campo] = o.valor;
    break;
  case 'contador':
    exigir(s); if (o.valor != null) s.contadores[o.nombre] = Number(o.valor);
    else s.contadores[o.nombre] = (s.contadores[o.nombre] || 0) + Number(o.sumar || 1);
    break;
  case 'ver':
    console.log(JSON.stringify(exigir(s), null, 2)); process.exit(0);
  default:
    console.error('Comandos: init | fase | paso | evento | proyecto | contador | ver'); process.exit(2);
}
guardar(s);
console.log('ok');
