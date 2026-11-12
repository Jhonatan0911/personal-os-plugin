#!/usr/bin/env node
// Guardia de red: revisa que ninguna configuración de los repos apunte a un servidor no permitido.
// Nunca imprime valores: solo archivo, línea, tipo y host.
//
// Uso: node guardia.js [carpeta=<mesa>/repos] [--permitidos <json>] [--salida <carpeta>]
// VERDE solo si: (1) ninguna configuración tiene una URL fuera de localhost; (2) los hosts de staging de
// <mesa>/kit/hosts-permitidos.json aparecen solo en cadenas de base de datos; (3) el candado del firewall
// (candado-red.ps1, reglas RegresionGuiada-*) está activo. Además lista las URLs escritas en el código.
// Sale con código 0 (verde) o 1 (rojo). Deja el informe en <mesa>/evidencias/guardia/.
'use strict';
const fs = require('fs');
const path = require('path');

const mesa = process.env.REGRESION_MESA || process.cwd();
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const raiz = argv[0] && !argv[0].startsWith('--') ? path.resolve(argv[0]) : path.join(mesa, 'repos');
const salida = opt('--salida', path.join(mesa, 'evidencias', 'guardia'));
const archPermitidos = opt('--permitidos', path.join(mesa, 'kit', 'hosts-permitidos.json'));

// REGLA DURA: HTTP/HTTPS solo a localhost. Los hosts de "staging" se aceptan ÚNICAMENTE en
// cadenas de conexión de base de datos (SQL Server / Mongo), nunca en una URL. No existen excepciones
// para validadores ni proveedores: todo tercero va al relevo local (relevo.js), que no reenvía.
const permitidos = new Set(['localhost', '127.0.0.1', '::1', '(local)', '.', '0.0.0.0']);
const staging = new Set();
const avisosConfig = [];
const TIPOS_BD = new Set(['sql', 'mongo', 'ip', 'host']);
try {
  const j = JSON.parse(fs.readFileSync(archPermitidos, 'utf8').replace(/^\uFEFF/, ''));
  (j.staging || []).forEach(h => staging.add(String(h).toLowerCase()));
  if ((j.hosts || []).length || (j.validadores_eps || []).length) avisosConfig.push('kit/hosts-permitidos.json trae "hosts" o "validadores_eps": ya no se aceptan (solo "staging" para bases de datos). Bórralos.');
} catch { avisosConfig.push('No pude leer kit/hosts-permitidos.json.'); }

const ARCHIVOS = [/^appsettings.*\.json$/i, /^web.*\.config$/i, /^app\.config$/i, /^connectionstrings.*\.config$/i,
  /^environment.*\.ts$/i, /^env\.(js|ts)$/i, /^\.env(\..*)?$/i, /^launchsettings\.json$/i, /^proxy\.conf.*\.json$/i];
const SALTAR = new Set(['node_modules', '.git', 'bin', 'obj', 'dist', '.angular', 'packages', '.vs', 'coverage']);

// Patrones de destino. La primera captura es el host.
const PATRONES = [
  { tipo: 'url', re: /\b(?:https?|wss?|ftp|smtp|amqp|redis):\/\/(?:[^\s"'@\/]+@)?([\[\]a-z0-9_.:-]+?)(?::\d+)?(?=[\/"'\s?#]|$)/gi },
  { tipo: 'mongo', re: /mongodb(?:\+srv)?:\/\/(?:[^\s"'@\/]+@)?([a-z0-9_.-]+)/gi },
  { tipo: 'sql', re: /(?:server|data source|address|addr|network address)\s*=\s*(?:tcp:)?([^;,"'\\\s]+)/gi },
  { tipo: 'host', re: /"(?:host|hostname|server|smtpserver|smtphost|mailserver|servidor)"\s*:\s*"([^"]+)"/gi },
  { tipo: 'ip', re: /\b((?:\d{1,3}\.){3}\d{1,3})\b/g }
];

function* recorrer(dir) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.isDirectory()) { if (!SALTAR.has(e.name)) yield* recorrer(path.join(dir, e.name)); }
    else if (ARCHIVOS.some(r => r.test(e.name))) yield path.join(dir, e.name);
  }
}
const normal = h => h.toLowerCase().replace(/^\[|\]$/g, '').replace(/\\.*$/, '');
const esPermitido = (h, tipo) => {
  const n = normal(h);
  if (permitidos.has(n) || /^127\./.test(n)) return true;
  if (staging.has(n) && TIPOS_BD.has(tipo)) return true;          // staging: solo como base de datos
  if (/^(0|255)\.|^\d+\.\d+$/.test(n)) return true;              // versiones o máscaras, no hosts
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(n) && n.split('.').some(p => +p > 255)) return true;
  if (/^(schemas\.microsoft\.com|www\.w3\.org|json\.schemastore\.org|tempuri\.org|go\.microsoft\.com)$/.test(n)) return true; // espacios de nombres XML/JSON
  return false;
};

const hallazgos = []; let revisados = 0;
for (const f of recorrer(raiz)) {
  revisados++;
  const lineas = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lineas.forEach((l, i) => {
    if (/^\s*(\/\/|#|<!--)/.test(l)) return;                       // comentarios
    // Valores en Base64 (algunos repos guardan así las cadenas): se decodifican y se revisan igual.
    const textos = [l];
    for (const b of l.match(/[A-Za-z0-9+\/]{24,}={0,2}/g) || []) {
      try { const d = Buffer.from(b, 'base64').toString('utf8'); if (/^[\x20-\x7E]+$/.test(d)) textos.push(d); } catch { }
    }
    for (const texto of textos) for (const p of PATRONES) {
      p.re.lastIndex = 0; let m;
      while ((m = p.re.exec(texto))) {
        const host = m[1]; if (!host || esPermitido(host, p.tipo)) continue;
        if (p.tipo === 'ip' && /version|Version="\d/.test(texto)) continue;
        hallazgos.push({ archivo: path.relative(raiz, f), linea: i + 1, tipo: texto === l ? p.tipo : p.tipo + ' (base64)', host: normal(host) });
      }
    }
  });
}
// Quitar duplicados por archivo+línea+host
const vistos = new Set();
const unicos = hallazgos.filter(h => { const k = `${h.archivo}|${h.linea}|${h.host}`; if (vistos.has(k)) return false; vistos.add(k); return true; });

// ---- URLs escritas en el código fuente (no se corrigen con configuración: las detiene el firewall) ----
const CODIGO = /\.(cs|ts|js|cshtml|vb|config|xml|json)$/i;
const enCodigo = {};
(function rec(dir) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SALTAR.has(e.name) && e.name !== 'environments') rec(f); continue; }
    if (!CODIGO.test(e.name) || ARCHIVOS.some(r => r.test(e.name)) || /\.(spec|min)\./i.test(e.name) || /package(-lock)?\.json$/i.test(e.name)) continue;
    let t; try { t = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const re = /\bhttps?:\/\/(?:[^\s"'@\/]+@)?([a-z0-9_.-]+)/gi; let m;
    while ((m = re.exec(t))) {
      const h = m[1].toLowerCase();
      if (esPermitido(h, 'url') || /(^|\.)(w3\.org|schemas\.microsoft\.com|schemas\.xmlsoap\.org|tempuri\.org|json\.schemastore\.org|go\.microsoft\.com|aka\.ms|github\.com|angular\.io|npmjs\.org|swagger\.io|example\.com|purl\.org|openxmlformats\.org)$/.test(h)) continue;
      (enCodigo[h] = enCodigo[h] || new Set()).add(path.relative(raiz, f));
    }
  }
})(raiz);

// ---- El candado del firewall tiene que estar puesto (candado-red.ps1) ----
let firewall = { activo: false, reglas: 0, detalle: '' };
if (process.platform === 'win32') {
  try {
    const r = require('child_process').spawnSync('powershell.exe', ['-NoProfile', '-Command',
      "(Get-NetFirewallRule -DisplayName 'RegresionGuiada-*' -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Outbound' -and $_.Action -eq 'Block' }).Count"], { encoding: 'utf8', timeout: 60000 });
    const n = parseInt(String(r.stdout).trim(), 10) || 0;
    firewall = { activo: n > 0, reglas: n, detalle: n ? '' : 'No hay reglas RegresionGuiada-* activas. Corre candado-red.ps1 como administrador.' };
  } catch (e) { firewall.detalle = 'No pude consultar el firewall: ' + e.message; }
} else firewall.detalle = 'Fuera de Windows: el candado de red no está implementado.';

const verde = unicos.length === 0 && firewall.activo && avisosConfig.length === 0;
const ts = new Date().toISOString().replace(/[:.]/g, '-');
fs.mkdirSync(salida, { recursive: true });
const porHost = {};
unicos.forEach(h => (porHost[h.host] = porHost[h.host] || []).push(h));
const md = [
  `# Guardia de red — ${verde ? 'VERDE' : 'ROJO'}`,
  '', `- Fecha: ${new Date().toLocaleString('es-CO')}`, `- Carpeta: ${raiz}`, `- Archivos de configuración revisados: ${revisados}`,
  `- Regla: HTTP/HTTPS solo a localhost; staging (${[...staging].join(', ') || 'ninguno'}) solo en cadenas de base de datos.`,
  `- Firewall (candado-red.ps1): ${firewall.activo ? `ACTIVO (${firewall.reglas} reglas de bloqueo)` : 'NO ACTIVO — ' + firewall.detalle}`,
  ...avisosConfig.map(a => `- ${a}`),
  `- Destinos no permitidos en configuración: ${unicos.length}`, '',
  ...(unicos.length === 0 ? ['Ninguna configuración apunta fuera de localhost (o de staging como base de datos).'] :
    ['| Host | Archivo | Línea | Tipo |', '|---|---|---|---|',
      ...Object.keys(porHost).sort().flatMap(h => porHost[h].map(x => `| ${x.host} | ${x.archivo} | ${x.linea} | ${x.tipo} |`))]),
  '', `## URLs escritas en el código (${Object.keys(enCodigo).length} hosts)`, '',
  'No se arreglan con configuración: las detiene el firewall. Si una operación del flujo pasa por aquí, se registra como «no probada (tercero)».', '',
  ...(Object.keys(enCodigo).length ? ['| Host | Archivos |', '|---|---|', ...Object.keys(enCodigo).sort().map(h => `| ${h} | ${[...enCodigo[h]].slice(0, 4).join('<br>')}${enCodigo[h].size > 4 ? ` (+${enCodigo[h].size - 4})` : ''} |`)] : ['Ninguna.'])
].join('\n');
fs.writeFileSync(path.join(salida, `guardia-${ts}.md`), md, 'utf8');
fs.writeFileSync(path.join(salida, 'ultima.json'), JSON.stringify({ verde, fecha: new Date().toISOString(), revisados, firewall, avisos: avisosConfig, destinos: unicos, en_codigo: Object.fromEntries(Object.entries(enCodigo).map(([h, s]) => [h, [...s]])) }, null, 2), 'utf8');

console.log(`Guardia de red: ${verde ? 'VERDE' : 'ROJO'} · ${revisados} archivos · ${unicos.length} destinos no permitidos · firewall ${firewall.activo ? 'activo' : 'NO activo'} · ${Object.keys(enCodigo).length} hosts escritos en código`);
avisosConfig.forEach(a => console.log('  ' + a));
if (!firewall.activo) console.log('  ' + firewall.detalle);
Object.keys(porHost).sort().forEach(h => console.log(`  ${h}  (${porHost[h].length} referencias, p. ej. ${porHost[h][0].archivo}:${porHost[h][0].linea})`));
console.log(`Informe: ${path.join(salida, `guardia-${ts}.md`)}`);
process.exit(verde ? 0 : 1);
