#!/usr/bin/env node
// Mirilla de tráfico de la regresión: proxy local que se pone DELANTE de cada API (red) y de cada base
// de staging (base de datos) y registra cada petición en <mesa>/.regresion/trafico.jsonl, que la página
// en vivo muestra como un chat de logs.
//
// REGLA DURA DE RED: solo escucha en 127.0.0.1. Las APIs solo se reenvían a 127.0.0.1. Las bases solo a
// los hosts y puertos de kit/hosts-permitidos.json -> staging / staging_puertos. Si la configuración
// trae otra cosa, NO arranca (código 3). Correr con kit/bin/node-regresion.exe (lo cubre el firewall).
//
// Uso: node mirilla.js [--config <json>]   (por defecto <mesa>/kit/mirilla.json; plantilla en plantillas/)
//   http: [{nombre, escucha, destino}]  la app escucha en `destino`; quien la llama apunta a `escucha`.
//   bd:   [{nombre, motor: sql|mongo, escucha, host, puerto}]  las cadenas locales apuntan a 127.0.0.1:<escucha>.
//   fronts: [{nombre, puerto}]  para saber qué front hizo la llamada (cabecera Origin/Referer).
//
// Privacidad: no se registran cuerpos, cookies ni cabeceras. En rutas y consultas, los números de 6 o más
// dígitos y los correos se enmascaran y los valores del query string se quitan. Las bases cifradas (TLS)
// se ven por petición (quién, cuánto pesa, cuánto tarda); si viajan sin cifrar se ve además el SP, la
// sentencia (recortada) o el comando de Mongo. La mirilla NUNCA cambia el cifrado de una conexión.
'use strict';
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const mesa = process.env.REGRESION_MESA || process.cwd();
const arg = k => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null; };
const rutaCfg = arg('--config') || path.join(mesa, 'kit', 'mirilla.json');
const leer = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
const alto = m => { console.error('MIRILLA NO ARRANCA: ' + m); process.exit(3); };

let cfg; try { cfg = leer(rutaCfg); } catch (e) { alto(`no pude leer ${rutaCfg} (${e.message})`); }
let permitidos = { staging: [], staging_puertos: [] };
try { permitidos = leer(path.join(mesa, 'kit', 'hosts-permitidos.json')); } catch { }
const LOCAL = new Set(['127.0.0.1', 'localhost', '::1']);
for (const h of cfg.http || []) {
  if (h.host && !LOCAL.has(String(h.host).toLowerCase())) alto(`${h.nombre}: el destino HTTP solo puede ser 127.0.0.1`);
  if (!Number(h.escucha) || !Number(h.destino) || h.escucha === h.destino) alto(`${h.nombre}: escucha y destino deben ser puertos distintos`);
}
for (const b of cfg.bd || []) {
  if (!(permitidos.staging || []).includes(b.host)) alto(`${b.nombre}: ${b.host} no está en hosts-permitidos.json -> staging`);
  if (!(permitidos.staging_puertos || []).includes(Number(b.puerto))) alto(`${b.nombre}: el puerto ${b.puerto} no está en staging_puertos`);
  if (!['sql', 'mongo'].includes(b.motor)) alto(`${b.nombre}: motor debe ser sql o mongo`);
}

// ---------- Registro ----------
const salida = path.join(mesa, '.regresion', 'trafico.jsonl');
fs.mkdirSync(path.dirname(salida), { recursive: true });
let cola = [], tamano = 0; try { tamano = fs.statSync(salida).size; } catch { }
function registrar(d) { cola.push(JSON.stringify({ t: new Date().toISOString(), ...d })); }
setInterval(() => {
  if (!cola.length) return;
  const txt = cola.join('\n') + '\n'; cola = [];
  if (tamano > 50 * 1024 * 1024) { try { fs.renameSync(salida, salida + '.1'); } catch { } tamano = 0; }
  fs.appendFile(salida, txt, 'utf8', () => { }); tamano += txt.length;
}, 100);

const enmascarar = t => String(t || '')
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo]')
  .replace(/\d{6,}/g, '[n]');
function rutaSegura(url) {
  const [p, q] = String(url || '').split('?');
  const qs = q ? '?' + q.split('&').map(kv => kv.split('=')[0] + '=…').join('&') : '';
  return enmascarar(decodeURIComponent(p).slice(0, 200)) + qs.slice(0, 120);
}

// ---------- Quién llama: puerto de origen -> PID -> servicio (netstat, con caché) ----------
const porPuerto = new Map(); // "puertoLocal>puertoRemoto" -> pid
const escuchaPorPid = new Map(); // pid -> [puertos en LISTENING]
const nombrePid = new Map(); let ultimo = 0, enCurso = null;
function netstat() {
  if (enCurso) return enCurso;
  enCurso = new Promise(ok => execFile('netstat', ['-ano', '-p', 'tcp'], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (e, out) => {
    if (!e) {
      porPuerto.clear(); escuchaPorPid.clear();
      for (const l of out.split(/\r?\n/)) {
        const m = l.trim().split(/\s+/); if (m[0] !== 'TCP' || m.length < 5) continue;
        const lp = m[1].split(':').pop(), rp = m[2].split(':').pop(), pid = m[4] || m[3];
        if (m[3] === 'LISTENING') { if (!escuchaPorPid.has(pid)) escuchaPorPid.set(pid, []); escuchaPorPid.get(pid).push(Number(lp)); }
        else porPuerto.set(lp + '>' + rp, pid);
      }
    }
    ultimo = Date.now(); enCurso = null; ok();
  }));
  return enCurso;
}
const nombrePorPuerto = new Map();
for (const h of cfg.http || []) { nombrePorPuerto.set(Number(h.destino), h.nombre); }
for (const f of cfg.fronts || []) nombrePorPuerto.set(Number(f.puerto), f.nombre);
for (const [p, n] of Object.entries(cfg.otros || {})) nombrePorPuerto.set(Number(p), n);
function nombreProceso(pid) {
  if (nombrePid.has(pid)) return Promise.resolve(nombrePid.get(pid));
  return new Promise(ok => execFile('tasklist', ['/fi', `PID eq ${pid}`, '/fo', 'csv', '/nh'], { windowsHide: true }, (e, out) => {
    const exe = !e && (out.match(/^"([^"]+)"/) || [])[1] || '?';
    const n = /node-regresion/i.test(exe) ? 'reproducción' : /chrome|msedge|firefox/i.test(exe) ? 'navegador' : exe.replace(/\.exe$/i, '');
    nombrePid.set(pid, n); ok(n);
  }));
}
async function quienLlama(puertoCliente, puertoMio) {
  const k = puertoCliente + '>' + puertoMio;
  if (!porPuerto.has(k) || Date.now() - ultimo > 1500) await netstat();
  const pid = porPuerto.get(k); if (!pid) return '?';
  for (const p of escuchaPorPid.get(pid) || []) if (nombrePorPuerto.has(p)) return nombrePorPuerto.get(p);
  return nombreProceso(pid);
}
const conTiempo = (p, ms) => Promise.race([p, new Promise(ok => setTimeout(() => ok('?'), ms))]);
function frontDe(req) {
  for (const h of [req.headers.origin, req.headers.referer]) {
    if (!h) continue; let u; try { u = new URL(h); } catch { continue; }
    const n = nombrePorPuerto.get(Number(u.port || 80)); if (n) return n;
  }
  return null;
}

// Peticiones HTTP en curso por servicio, para decir "durante POST /x" en las líneas de base de datos.
const activas = new Map(); // nombre -> Map(id -> texto)
let sec = 0;

// ---------- Red: proxy HTTP por API ----------
const agente = new http.Agent({ keepAlive: true, maxSockets: 256 });
for (const h of cfg.http || []) {
  const srv = http.createServer((req, res) => {
    const t0 = process.hrtime.bigint(), id = ++sec, op = `${req.method} ${rutaSegura(req.url)}`;
    const caso = req.headers['x-regresion-caso'];
    const de = caso ? Promise.resolve(`reproducción · caso ${String(caso).slice(0, 40)}`) : frontDe(req) ? Promise.resolve(frontDe(req)) : conTiempo(quienLlama(req.socket.remotePort, h.escucha), 2500);
    if (!activas.has(h.nombre)) activas.set(h.nombre, new Map());
    activas.get(h.nombre).set(id, op);
    let subida = 0, bajada = 0, cerrado = false;
    req.on('data', c => { subida += c.length; });
    const fin = async (status, extra) => {
      if (cerrado) return; cerrado = true; activas.get(h.nombre).delete(id);
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      registrar({ canal: 'red', de: await de, a: h.nombre, op, status, ms: Math.round(ms), sube: subida, baja: bajada, ...extra });
    };
    const up = http.request({ host: '127.0.0.1', port: h.destino, method: req.method, path: req.url, headers: req.headers, agent: agente }, r => {
      res.writeHead(r.statusCode, r.headers);
      r.on('data', c => { bajada += c.length; });
      r.on('end', () => fin(r.statusCode));
      r.on('error', () => fin(r.statusCode, { nota: 'respuesta cortada' }));
      r.pipe(res);
    });
    up.on('error', e => {
      if (!res.headersSent) { res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(`Mirilla: ${h.nombre} no responde en 127.0.0.1:${h.destino}`); }
      fin(502, { nota: `${h.nombre} no responde (${e.code || e.message})` });
    });
    res.on('close', () => { if (!res.writableEnded) fin(499, { nota: 'el cliente cerró antes' }); });
    req.pipe(up);
  });
  srv.on('upgrade', (req, sock, head) => {
    const c = net.connect(h.destino, '127.0.0.1', () => {
      c.write(`${req.method} ${req.url} HTTP/1.1\r\n` + Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
      if (head && head.length) c.write(head);
      sock.pipe(c).pipe(sock);
    });
    c.on('error', () => sock.destroy()); sock.on('error', () => c.destroy());
    registrar({ canal: 'red', de: frontDe(req) || '?', a: h.nombre, op: `WS ${rutaSegura(req.url)}`, status: 101 });
  });
  srv.keepAliveTimeout = 65000;
  srv.on('error', e => alto(`${h.nombre}: no pude escuchar en 127.0.0.1:${h.escucha} (${e.code})`));
  srv.listen(h.escucha, '127.0.0.1', () => console.log(`(red) ${h.nombre.padEnd(28)} 127.0.0.1:${h.escucha} -> 127.0.0.1:${h.destino}`));
}

// ---------- Base de datos: túnel TCP con lectura del protocolo cuando viaja sin cifrar ----------
const RUIDO_MONGO = new Set(['hello', 'ismaster', 'isMaster', 'ping', 'saslStart', 'saslContinue', 'endSessions', 'buildInfo', 'getLastError', 'killCursors']);
function tdsLeer(buf) {
  // Devuelve {omitir} para prelogin/login, {cifrado} si es TLS, o {op} con el SP / sentencia.
  const tipo = buf[0];
  if (tipo === 0x16 || tipo === 0x17 || tipo === 0x15 || tipo === 0x14) return { cifrado: true, omitir: tipo !== 0x17 };
  if (tipo === 0x12 || tipo === 0x10) return { omitir: true };
  if (buf.length < 12) return { op: 'TDS' };
  try {
    let o = 8; const total = buf.readUInt32LE(o); if (total >= 4 && total < 1024) o += total; // ALL_HEADERS
    if (tipo === 0x01) return { op: enmascarar(buf.slice(o, Math.min(buf.length, o + 400)).toString('utf16le').replace(/\s+/g, ' ').trim().slice(0, 160)) };
    if (tipo === 0x03) {
      const n = buf.readUInt16LE(o); o += 2;
      if (n !== 0xFFFF) return { op: 'EXEC ' + buf.slice(o, o + n * 2).toString('utf16le') };
      const procId = buf.readUInt16LE(o); o += 2;
      const PROCS = { 10: 'sp_executesql', 11: 'sp_prepare', 12: 'sp_execute', 13: 'sp_prepexec', 15: 'sp_unprepare' };
      const nombre = PROCS[procId] || `proc ${procId}`;
      if (procId !== 10) return { op: nombre };
      o += 2; const ln = buf[o]; o += 1 + ln * 2; o += 1; // flags, nombre del parámetro, status
      const t = buf[o]; o += 1;
      if (t !== 0xE7 && t !== 0xEF) return { op: nombre };
      const max = buf.readUInt16LE(o); o += 2 + 5; // maxlen + collation
      let texto;
      if (max === 0xFFFF) { o += 8; const ch = buf.readUInt32LE(o); o += 4; texto = buf.slice(o, Math.min(buf.length, o + Math.min(ch, 400))).toString('utf16le'); }
      else { const l = buf.readUInt16LE(o); o += 2; texto = buf.slice(o, Math.min(buf.length, o + Math.min(l, 400))).toString('utf16le'); }
      return { op: 'sql: ' + enmascarar(texto.replace(/\s+/g, ' ').trim().slice(0, 160)) };
    }
    if (tipo === 0x0E) return { op: 'transacción' };
    if (tipo === 0x06) return { op: 'cancelar' };
  } catch { }
  return { op: `TDS 0x${tipo.toString(16)}` };
}
function mongoLeer(buf) {
  if (buf[0] === 0x16 || buf[0] === 0x17) return { cifrado: true, omitir: buf[0] === 0x16 };
  try {
    const opCode = buf.readInt32LE(12);
    if (opCode === 2012) return { op: 'comprimido' };
    if (opCode !== 2013) return { op: `op ${opCode}` };
    let o = 16 + 4; if (buf[o] !== 0) return { op: 'OP_MSG' };
    o += 1 + 4; const tipo = buf[o]; o += 1;
    const fin = buf.indexOf(0, o); const cmd = buf.slice(o, fin).toString('utf8'); o = fin + 1;
    if (RUIDO_MONGO.has(cmd)) return { omitir: true, latido: true };
    let col = ''; if (tipo === 0x02) { const l = buf.readInt32LE(o); col = buf.slice(o + 4, o + 3 + l).toString('utf8'); }
    return { op: col ? `${cmd} ${col}` : cmd };
  } catch { return { op: 'mongo' }; }
}
for (const b of cfg.bd || []) {
  const etiqueta = b.nombre || `${b.motor === 'sql' ? 'SQL' : 'Mongo'} staging`;
  const srv = net.createServer(cli => {
    const de = conTiempo(quienLlama(cli.remotePort, b.escucha), 1500);
    const srvSock = net.connect(Number(b.puerto), b.host);
    const t0 = Date.now(); let total = { sube: 0, baja: 0, peticiones: 0 }, cifrado = false;
    let actual = null, idle = null;
    const durante = async () => { const n = await de; const m = activas.get(n); return m && m.size ? [...m.values()].pop() : undefined; };
    const emitir = async () => {
      if (!actual) return; const a = actual; actual = null; clearTimeout(idle);
      if (a.omitir) return; total.peticiones++;
      const small = a.sube < 400 && a.baja < 1500;
      registrar({ canal: 'bd', de: await de, a: etiqueta, op: a.op || (cifrado ? 'consulta (cifrada)' : 'consulta'), ms: (a.t2 || Date.now()) - a.t1, sube: a.sube, baja: a.baja, cifrado, latido: a.latido || (cifrado && b.motor === 'mongo' && small) || undefined, durante: await durante() });
    };
    cli.on('data', c => {
      total.sube += c.length;
      if (actual && actual.baja) emitir();
      if (!actual) {
        const info = b.motor === 'sql' ? tdsLeer(c) : mongoLeer(c);
        if (info.cifrado) cifrado = true;
        actual = { t1: Date.now(), sube: 0, baja: 0, ...info };
      }
      actual.sube += c.length;
    });
    srvSock.on('data', c => {
      total.baja += c.length;
      if (actual) { actual.baja += c.length; actual.t2 = Date.now(); clearTimeout(idle); idle = setTimeout(emitir, 80); }
    });
    cli.pipe(srvSock); srvSock.pipe(cli);
    srvSock.on('connect', async () => registrar({ canal: 'bd', de: await de, a: etiqueta, op: 'conexión abierta', evento: 'abre' }));
    let cerrada = false;
    const cerrar = async (motivo) => {
      if (cerrada) return; cerrada = true; await emitir();
      registrar({ canal: 'bd', de: await de, a: etiqueta, op: motivo ? `conexión fallida (${motivo})` : 'conexión cerrada', evento: 'cierra', ms: Date.now() - t0, sube: total.sube, baja: total.baja, peticiones: total.peticiones, cifrado, status: motivo ? 'error' : undefined });
      cli.destroy(); srvSock.destroy();
    };
    srvSock.on('error', e => cerrar(e.code || e.message)); cli.on('error', () => cerrar());
    srvSock.on('close', () => cerrar()); cli.on('close', () => cerrar());
  });
  srv.on('error', e => alto(`${etiqueta}: no pude escuchar en 127.0.0.1:${b.escucha} (${e.code})`));
  srv.listen(b.escucha, '127.0.0.1', () => console.log(`(base de datos) ${etiqueta.padEnd(18)} 127.0.0.1:${b.escucha} -> ${b.host}:${b.puerto}`));
}
netstat();
registrar({ canal: 'sistema', op: `Mirilla arriba: ${(cfg.http || []).length} APIs y ${(cfg.bd || []).length} bases vigiladas` });
console.log(`Registro: ${salida}`);
