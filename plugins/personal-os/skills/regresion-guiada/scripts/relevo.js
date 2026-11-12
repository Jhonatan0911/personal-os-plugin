#!/usr/bin/env node
// Relevo LOCAL de terceros (WhatsApp, SMS, API de correo, SMTP, short-link, validadores EPS, Zoom…).
//
// REGLA DURA: durante la regresión NINGUNA petición HTTP sale del
// equipo. El relevo NO reenvía a ningún tercero: recibe en 127.0.0.1, registra lo que la app quiso enviar y
// responde con la respuesta configurada (por defecto 200 {}). Así, si una prueba de recorrido dejó una URL
// sin cambiar, la app pega aquí o falla, pero nunca llega a producción ni a un paciente.
//
// Falla cerrado: si en kit/relevos.json aparece un "destino" o un "host_real" que no sea localhost, el relevo
// NO arranca (sale con código 3).
//
// Uso: node relevo.js [--config <json>]   (por defecto <mesa>/kit/relevos.json)
// Registro: <mesa>/evidencias/relevo/<servicio>.jsonl. Teléfonos y correos se guardan solo como huella
// (sha256 corta), nunca en claro. Las cabeceras sensibles se ocultan.
'use strict';
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const mesa = process.env.REGRESION_MESA || process.cwd();
const argv = process.argv.slice(2);
const cfgPath = argv.includes('--config') ? argv[argv.indexOf('--config') + 1] : path.join(mesa, 'kit', 'relevos.json');
const carpeta = path.join(mesa, 'evidencias', 'relevo');
fs.mkdirSync(carpeta, { recursive: true });

let cfg;
try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8').replace(/^﻿/, '')); }
catch (e) { console.error(`No pude leer ${cfgPath}. Copia plantillas/relevos.json a kit/relevos.json.`); process.exit(2); }

// ---- Candado: nada que no sea localhost ----
const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?)$/i;
const externos = [];
for (const [n, s] of Object.entries(cfg.servicios || {})) {
  if (s.destino) { try { const u = new URL(s.destino); if (!LOCAL.test(u.hostname)) externos.push(`${n}.destino`); } catch { externos.push(`${n}.destino`); } }
}
if (cfg.smtp && cfg.smtp.host_real && !LOCAL.test(cfg.smtp.host_real)) externos.push('smtp.host_real');
if (externos.length) {
  console.error(`ALTO: kit/relevos.json apunta fuera de localhost en: ${externos.join(', ')}. Durante la regresión no se reenvía a ningún tercero. Borra esos valores.`);
  process.exit(3);
}

const huella = v => crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 12);
const SENSIBLES = /^(authorization|x-api-key|apikey|api-key|token|cookie|proxy-authorization|password)$/i;
const registrar = (s, d) => fs.appendFileSync(path.join(carpeta, `${s}.jsonl`), JSON.stringify({ t: new Date().toISOString(), ...d }) + '\n', 'utf8');

// ---- Destinatarios: solo huella ----
const CLAVE_TEL = /^(destination|to|phone|phonenumber|phone_number|telefono|tel[eé]fono|celular|movil|m[oó]vil|numero|n[uú]mero|msisdn|recipient|recipients|destinatario|destinatarios|wa_id|send_to|sendto)$/i;
const CLAVE_MAIL = /^(to|cc|bcc|email|emails|correo|correos|destinatario|destinatarios|recipient|recipients|para|copia|copiaoculta|address|toaddress|toaddresses|ccaddresses|bccaddresses)$/i;
const ES_TEL = s => /^\+?\d[\d\s-]{6,}$/.test(String(s).trim());

function destinatarios(obj) {
  const out = [];
  (function rec(o, k) {
    if (Array.isArray(o)) return o.forEach(x => rec(x, k));
    if (o && typeof o === 'object') return Object.entries(o).forEach(([kk, v]) => rec(v, kk));
    const s = String(o ?? '');
    if (CLAVE_MAIL.test(k || '') && s.includes('@')) s.split(/[;,]/).map(x => x.trim().toLowerCase()).filter(Boolean).forEach(m => out.push({ campo: k, tipo: 'correo', huella: huella(m) }));
    else if (CLAVE_TEL.test(k || '') && ES_TEL(s)) out.push({ campo: k, tipo: 'telefono', huella: huella(s.replace(/\D/g, '')) });
  })(obj, '');
  return out;
}
function leerCuerpo(texto, tipo) {
  if (!texto) return null;
  try {
    if (/json/i.test(tipo) || /^\s*[\[{]/.test(texto)) return JSON.parse(texto);
    if (/x-www-form-urlencoded/i.test(tipo)) {
      const o = {}; for (const [k, v] of new URLSearchParams(texto)) { o[k] = v; if (/^\s*[\[{]/.test(v)) { try { o[k] = JSON.parse(v); } catch { } } }
      return o;
    }
  } catch { }
  return null;
}

// ---- Servicios HTTP: responden en local, nunca reenvían ----
for (const [nombre, s] of Object.entries(cfg.servicios || {})) {
  if (!s.puerto) continue;
  const status = s.status || 200;
  const respuesta = s.respuesta === undefined ? {} : s.respuesta;
  http.createServer((req, res) => {
    const trozos = []; req.on('data', c => trozos.push(c));
    req.on('end', () => {
      const texto = Buffer.concat(trozos).toString('utf8');
      const cuerpo = leerCuerpo(texto, req.headers['content-type'] || '');
      registrar(nombre, {
        metodo: req.method, ruta: req.url, servicio: nombre, resultado: 'respondido_local', status,
        bytes: texto.length, campos: cuerpo && typeof cuerpo === 'object' ? Object.keys(cuerpo).slice(0, 40) : [],
        destinatarios: cuerpo ? destinatarios(cuerpo) : [],
        headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, SENSIBLES.test(k) ? '***' : v]))
      });
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'X-Relevo': 'local-sin-reenvio' });
      res.end(typeof respuesta === 'string' ? respuesta : JSON.stringify(respuesta));
    });
  }).listen(s.puerto, '127.0.0.1', () => console.log(`Relevo ${nombre.padEnd(12)} http://127.0.0.1:${s.puerto}  -> responde ${status} en local (sin reenvío)`));
}

// ---- SMTP: acepta, registra la huella de los destinatarios y responde 250. No reenvía. ----
if (cfg.smtp && cfg.smtp.puerto) {
  net.createServer(sock => {
    let datos = false, buf = '', para = [], bytes = 0;
    const w = t => sock.write(t + '\r\n');
    w('220 relevo-smtp regresion (local, sin reenvio)');
    sock.on('data', chunk => {
      buf += chunk.toString('utf8'); let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const linea = buf.slice(0, i); buf = buf.slice(i + 2);
        if (datos) {
          if (linea === '.') { datos = false; registrar('smtp', { resultado: 'respondido_local', destinatarios: para.map(p => ({ tipo: 'correo', huella: huella(p.toLowerCase()) })), bytes }); w('250 OK (registrado, no reenviado)'); para = []; bytes = 0; }
          else bytes += linea.length;
          continue;
        }
        const cmd = linea.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO') { w('250-relevo'); w('250-AUTH PLAIN LOGIN'); w('250 OK'); }
        else if (cmd === 'AUTH') w('235 OK');
        else if (cmd === 'RCPT') { para.push((linea.match(/<([^>]*)>/) || [])[1] || ''); w('250 OK'); }
        else if (cmd === 'DATA') { datos = true; w('354 Fin con <CRLF>.<CRLF>'); }
        else if (cmd === 'QUIT') { w('221 Adios'); sock.end(); }
        else w('250 OK');
      }
    });
    sock.on('error', () => { });
  }).listen(cfg.smtp.puerto, '127.0.0.1', () => console.log(`Relevo smtp         smtp://127.0.0.1:${cfg.smtp.puerto}  -> registra y responde 250 (sin reenvío)`));
}
console.log(`Registro en ${carpeta}. Ninguna petición sale del equipo.`);
