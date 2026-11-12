#!/usr/bin/env node
// Página local en vivo de la regresión. Solo escucha en 127.0.0.1.
// Uso: node servidor.js [puerto]   (REGRESION_MESA = carpeta de la mesa; por defecto, el cwd)
//   GET  /estado.json         estado de la skill
//   GET  /dependencias.json   matriz de proyectos externos (compuerta de la fase 3)
//   POST /dependencias        guarda la decisión de una fila {id, accion: bajar|no_bajar, dueno, proyecto_azure, rama, nota}
//   GET  /ramas?org=&proyecto=&repo=   ramas remotas (git ls-remote, sin clonar)
//   GET  /trafico             tráfico en vivo (SSE): .regresion/trafico.jsonl (mirilla), .regresion/staging.log
//                             (staging.py) y evidencias/relevo/*.jsonl (relevo de terceros)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const puerto = Number(process.argv[2] || 4747);
const mesa = process.env.REGRESION_MESA || process.cwd();
const estado = path.join(mesa, '.regresion', 'estado.json');
const deps = path.join(mesa, '.regresion', 'dependencias.json');
const pagina = path.join(__dirname, 'index.html');
const scriptDeps = path.join(__dirname, '..', 'dependencias.js');

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
const leer = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return null; } };
function guardar(f, obj) { obj.actualizado = new Date().toISOString(); const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(obj, null, 2), 'utf8'); fs.renameSync(t, f); }
function evento(texto) {
  try { execFile(process.execPath, [path.join(__dirname, '..', 'estado.js'), 'evento', '--tipo', 'info', '--texto', texto], { env: { ...process.env, REGRESION_MESA: mesa } }); } catch { }
}

// ---------- Tráfico en vivo (SSE): mirilla + staging.py + relevo de terceros ----------
const enmascarar = t => String(t || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo]').replace(/\d{6,}/g, '[n]');
const anillo = []; const oyentes = new Set(); const offsets = new Map();
function normalizar(origen, d) {
  if (origen === 'trafico') return d;
  if (origen === 'staging') {
    const txt = d.sql || d.sentencia || d.texto || d.consulta || [d.coleccion, d.filtro && JSON.stringify(d.filtro)].filter(Boolean).join(' ');
    return { t: d.t, canal: 'bd', de: 'staging.py', a: `${d.motor === 'mongo' ? 'Mongo' : 'SQL'} staging${d.base ? ' · ' + d.base : ''}`, op: `${d.tipo || ''} ${enmascarar(String(txt).replace(/\s+/g, ' ').slice(0, 160))}`.trim(), filas: d.filas, status: d.error ? 'error' : undefined, nota: d.error ? enmascarar(String(d.error).slice(0, 160)) : undefined };
  }
  if (origen === 'relevo') {
    const ruta = enmascarar(String(d.ruta || '').split('?')[0]);
    return { t: d.t, canal: 'tercero', de: d.headers?.origin ? 'navegador' : 'app local', a: `relevo ${d.servicio || ''}`.trim(), op: `${d.metodo || ''} ${ruta}`.trim(), status: d.status, sube: d.bytes, nota: `${(d.destinatarios || []).length} destinatario(s) · no se reenvió` };
  }
}
function empujar(e) {
  if (!e) return; anillo.push(e); if (anillo.length > 600) anillo.shift();
  const txt = `data: ${JSON.stringify(e)}\n\n`; for (const r of oyentes) r.write(txt);
}
function fuentes() {
  const f = [[path.join(mesa, '.regresion', 'trafico.jsonl'), 'trafico'], [path.join(mesa, '.regresion', 'staging.log'), 'staging']];
  const rel = path.join(mesa, 'evidencias', 'relevo');
  try { for (const n of fs.readdirSync(rel)) if (n.endsWith('.jsonl')) f.push([path.join(rel, n), 'relevo']); } catch { }
  return f;
}
function leerNuevo(primera) {
  for (const [f, origen] of fuentes()) {
    let tam; try { tam = fs.statSync(f).size; } catch { continue; }
    let desde = offsets.has(f) ? offsets.get(f) : (primera ? Math.max(0, tam - 150 * 1024) : 0);
    if (tam < desde) desde = 0; // rotó
    if (tam === desde) { offsets.set(f, tam); continue; }
    const fd = fs.openSync(f, 'r'); const buf = Buffer.alloc(Math.min(tam - desde, 4 * 1024 * 1024)); fs.readSync(fd, buf, 0, buf.length, desde); fs.closeSync(fd);
    let txt = buf.toString('utf8'); const ultimo = txt.lastIndexOf('\n'); if (ultimo < 0) continue;
    txt = txt.slice(0, ultimo); offsets.set(f, desde + Buffer.byteLength(txt) + 1);
    const lineas = txt.split('\n'); if (primera && desde > 0) lineas.shift();
    for (const l of lineas) { if (!l.trim()) continue; try { empujar(normalizar(origen, JSON.parse(l))); } catch { } }
  }
}
leerNuevo(true); anillo.sort((a, b) => String(a.t).localeCompare(String(b.t)));
setInterval(() => leerNuevo(false), 250);
setInterval(() => { for (const r of oyentes) r.write(': latido\n\n'); }, 15000);

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'GET' && u.pathname === '/trafico') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(`event: historia\ndata: ${JSON.stringify(anillo.slice(-300))}\n\n`);
    oyentes.add(res); req.on('close', () => oyentes.delete(res));
    return;
  }
  if (req.method === 'GET' && u.pathname === '/estado.json') {
    return fs.readFile(estado, 'utf8', (err, d) => json(res, 200, err ? '{"vacio":true}' : d));
  }
  if (req.method === 'GET' && u.pathname === '/dependencias.json') {
    return fs.readFile(deps, 'utf8', (err, d) => json(res, 200, err ? '{"vacio":true}' : d));
  }
  if (req.method === 'GET' && u.pathname === '/ramas') {
    const [org, proy, repo] = ['org', 'proyecto', 'repo'].map(k => u.searchParams.get(k) || '');
    if (!/^[\w.-]+$/.test(org) || !/^[\w. -]+$/.test(proy) || !/^[\w.-]+$/.test(repo)) return json(res, 400, { error: 'parámetros inválidos' });
    return execFile(process.execPath, [scriptDeps, 'ramas', org, proy, repo], { timeout: 60000 }, (e, out) => json(res, 200, e ? '[]' : (out || '[]')));
  }
  if (req.method === 'POST' && u.pathname === '/dependencias') {
    let b = ''; req.on('data', c => { b += c; if (b.length > 20000) req.destroy(); });
    return req.on('end', () => {
      let p; try { p = JSON.parse(b); } catch { return json(res, 400, { error: 'JSON inválido' }); }
      const d = leer(deps); if (!d) return json(res, 409, { error: 'No hay matriz de dependencias' });
      const it = (d.items || []).find(i => i.id === p.id); if (!it) return json(res, 404, { error: 'Fila no encontrada' });
      if (p.accion === null) { it.decision = null; guardar(deps, d); evento(`Dependencia ${it.api}: decisión deshecha`); return json(res, 200, { ok: true }); }
      if (!['bajar', 'no_bajar'].includes(p.accion)) return json(res, 400, { error: 'accion debe ser bajar o no_bajar' });
      const repo = String(p.repo || it.repo || '').trim();
      if (p.accion === 'bajar' && !repo) return json(res, 400, { error: 'Para bajarlo hay que escribir el repo' });
      if (p.accion === 'bajar' && !p.rama) return json(res, 400, { error: 'Para bajarlo hay que elegir o escribir la rama' });
      if (repo && !/^[\w.-]+$/.test(repo)) return json(res, 400, { error: 'Nombre de repo inválido' });
      if (p.rama && !/^[\w.\/+-]+$/.test(p.rama)) return json(res, 400, { error: 'Nombre de rama inválido' });
      if (repo) it.repo = repo;
      it.decision = { accion: p.accion, dueno: p.dueno || null, organizacion: p.organizacion || it.organizacion, proyecto_azure: p.proyecto_azure || it.proyecto_azure, repo: repo || null, rama: p.rama || null, nota: String(p.nota || '').slice(0, 500), fecha: new Date().toISOString() };
      guardar(deps, d);
      evento(p.accion === 'bajar' ? `Dependencia ${it.api}: BAJAR ${it.decision.proyecto_azure}/${it.repo || '?'} rama ${it.decision.rama}` : `Dependencia ${it.api}: NO se baja; sale de las pruebas (${(it.funciones || []).slice(0, 2).join('; ')})`);
      json(res, 200, { ok: true });
    });
  }
  fs.readFile(pagina, (err, d) => { res.writeHead(err ? 500 : 200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(err ? 'Falta index.html' : d); });
}).listen(puerto, '127.0.0.1', () => {
  console.log(`Regresión en vivo: http://127.0.0.1:${puerto}  (mesa: ${mesa})`);
});
