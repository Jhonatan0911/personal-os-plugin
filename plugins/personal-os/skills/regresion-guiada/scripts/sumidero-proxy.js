// Sumidero de proxy de la regresión. Las apps y Playwright arrancan con HTTP_PROXY/HTTPS_PROXY=http://127.0.0.1:4809.
// Toda petición que intente salir de localhost llega aquí y se registra (método, host, ruta, quién).
//  - Por defecto NO se reenvía: HTTP absoluto -> 502; HTTPS (CONNECT) -> 403 y cierra.
//  - Post-publicación: los hosts de <mesa>/kit/hosts-permitidos.json -> "staging_web" (sitios de STAGING
//    desplegados, confirmados por el responsable) SÍ se reenvían, en túnel (no se descifra nada).
//    Coincidencia exacta de host o sufijo si la entrada empieza por "." (p. ej. ".staging.ejemplo.com").
// Registro: evidencias/relevo/sumidero-proxy.jsonl (accion: bloqueado | permitido)
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const mesa = process.env.REGRESION_MESA || path.resolve(__dirname, '..');
const carpeta = path.join(mesa, 'evidencias', 'relevo');
fs.mkdirSync(carpeta, { recursive: true });
const archivo = path.join(carpeta, 'sumidero-proxy.jsonl');
const PUERTO = Number(process.env.SUMIDERO_PUERTO || 4809);

let PERMITIDOS = [];
try {
  const j = JSON.parse(fs.readFileSync(path.join(mesa, 'kit', 'hosts-permitidos.json'), 'utf8').replace(/^﻿/, ''));
  // staging_web: sitios de staging desplegados. estaticos_web: CDNs de fuentes/íconos/estilos que esos sitios cargan
  // (solo descarga de recursos; sin ellos la pantalla se ve rota). Telemetría y Google siguen bloqueados.
  PERMITIDOS = [...(j.staging_web || []), ...(j.estaticos_web || [])].map(h => String(h).toLowerCase().trim()).filter(Boolean);
} catch (_) {}
const soloHost = h => String(h || '').toLowerCase().replace(/:\d+$/, '');
const permitido = h => {
  const x = soloHost(h);
  return PERMITIDOS.some(p => (p.startsWith('.') ? x.endsWith(p) || x === p.slice(1) : x === p));
};
const reg = d => {
  fs.appendFileSync(archivo, JSON.stringify({ t: new Date().toISOString(), ...d }) + '\n', 'utf8');
  console.log(`${d.accion.toUpperCase()} ${d.metodo} ${d.destino}${d.ruta || ''}`);
};

const srv = http.createServer((req, res) => {
  let destino = req.headers.host || '?', ruta = req.url, u = null;
  try { u = new URL(req.url); destino = u.host; ruta = u.pathname; } catch (_) {}
  if (u && permitido(destino)) {
    reg({ accion: 'permitido', metodo: req.method, destino, ruta, tipo: 'http', ua: req.headers['user-agent'] || '' });
    const out = http.request({ host: u.hostname, port: u.port || 80, method: req.method, path: u.pathname + u.search, headers: req.headers },
      r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    out.on('error', e => { res.writeHead(502); res.end(String(e.message)); });
    return req.pipe(out);
  }
  reg({ accion: 'bloqueado', metodo: req.method, destino, ruta, tipo: 'http', ua: req.headers['user-agent'] || '' });
  res.writeHead(502, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ relevo: 'sumidero-proxy', mensaje: 'salida a internet bloqueada en la regresión' }));
});

srv.on('connect', (req, sock, head) => {
  const destino = req.url;
  if (permitido(destino)) {
    reg({ accion: 'permitido', metodo: 'CONNECT', destino, tipo: 'https', ua: req.headers['user-agent'] || '' });
    const [h, p] = [soloHost(destino), Number(destino.split(':')[1] || 443)];
    const up = net.connect(p, h, () => { sock.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head && head.length) up.write(head); up.pipe(sock); sock.pipe(up); });
    up.on('error', () => sock.destroy()); sock.on('error', () => up.destroy());
    return;
  }
  reg({ accion: 'bloqueado', metodo: 'CONNECT', destino, tipo: 'https', ua: req.headers['user-agent'] || '' });
  sock.end('HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n');
});

srv.listen(PUERTO, '127.0.0.1', () => console.log(
  `Sumidero de proxy en http://127.0.0.1:${PUERTO} · permitidos (staging_web): ${PERMITIDOS.length ? PERMITIDOS.join(', ') : 'ninguno (todo bloqueado)'}`));
