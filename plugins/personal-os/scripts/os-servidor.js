#!/usr/bin/env node
/**
 * os-servidor.js — el servidor local de la consola unificada del Personal OS (D-065).
 *
 * Sirve la app (consola + mandos + configuración) y una LISTA CERRADA de acciones. Corre todo el día
 * en segundo plano, así que es Node puro, sin dependencias, y no hace nada mientras nadie le pide algo.
 *
 * SEGURIDAD. Un servidor local que escribe archivos y lanza procesos es alcanzable desde CUALQUIER página
 * abierta en el navegador (CSRF y DNS rebinding). Por eso, sin excepción:
 *   1. Escucha solo en 127.0.0.1 y rechaza todo `Host` que no sea 127.0.0.1:<puerto> o localhost:<puerto>.
 *   2. Lo que escribe o ejecuta exige POST con `Content-Type: application/json`, el `Origin` de la propia app
 *      y la cabecera `X-OS-Token` con un token aleatorio por arranque. El token solo viaja dentro de la página
 *      servida (la política de mismo origen impide que otra página la lea) y nunca se escribe en disco.
 *   3. Ningún endpoint recibe un comando, una ruta ni un argumento libre: la acción se elige de una lista
 *      (las propias de abajo + `config.json → servidor.acciones`, que solo edita el dueño del equipo).
 *   4. Los archivos estáticos salen solo de la carpeta de estado y de las plantillas del plugin, sin `..`.
 *
 * Uso:
 *   node os-servidor.js [--puerto 7318] [--abrir]
 *   node os-servidor.js --instalar-tarea   → arranque oculto al iniciar sesión de Windows (schtasks)
 *   node os-servidor.js --quitar-tarea
 *   node os-servidor.js --salud            → ¿está vivo? (exit 0 sí, 1 no). Lo usa el testigo.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const C = require('./lib/comun.js');

const cfg = C.config();
const CFG_SRV = cfg.servidor || {};
const PUERTO = Number(C.arg('--puerto', null) || CFG_SRV.puerto || 7318);
const STATE = C.stateDir();
const PLANTILLAS = path.join(C.PLUGIN_ROOT, 'plantillas');
// pid y puerto, sin el token. Una marca por puerto: una instancia de prueba en otro puerto no pisa la real.
const MARCA = path.join(C.OS_HOME, `_servidor-${PUERTO}.json`);
const TOKEN = crypto.randomBytes(24).toString('hex');
// Versión: la del plugin; en una instalación suelta, la que el sync deja en <os-home>/plugin-version.json.
const VERSION = (() => {
  for (const r of [path.join(C.PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), path.join(C.OS_HOME, 'plugin-version.json')]) {
    const j = C.leerJson(r, null); if (j && j.version) return j.version;
  }
  return '?';
})();
const HOSTS = new Set([`127.0.0.1:${PUERTO}`, `localhost:${PUERTO}`]);
const ORIGENES = new Set([`http://127.0.0.1:${PUERTO}`, `http://localhost:${PUERTO}`]);
const NODE = process.execPath;
const TAREA = 'PersonalOS-Servidor';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8', '.glb': 'model/gltf-binary',
};

// ------------------------------------------------------------------ modos que no levantan servidor

function salud(cb) {
  const req = http.get({ host: '127.0.0.1', port: PUERTO, path: '/salud', timeout: 1500 }, (res) => {
    let d = ''; res.on('data', (x) => { d += x; }); res.on('end', () => cb(res.statusCode === 200, d));
  });
  req.on('timeout', () => { req.destroy(); cb(false, 'sin respuesta'); });
  req.on('error', (e) => cb(false, e.code || e.message));
}

if (process.argv.includes('--salud')) {
  salud((ok, d) => { console.log(ok ? `vivo en ${PUERTO}: ${d}` : `no responde en ${PUERTO} (${d})`); process.exit(ok ? 0 : 1); });
  return;
}

// Acceso en el Escritorio que abre la app como una PESTAÑA del navegador por defecto, igual que /consola
// (decisión del usuario, 23/11: nada de ventana aparte). Es un acceso a Internet (.url), sin consola ni flash.
if (process.argv.includes('--crear-acceso')) {
  if (process.platform !== 'win32') { console.error(`Abre http://127.0.0.1:${PUERTO}/ en tu navegador.`); process.exit(1); }
  const icono = C.arg('--icono', null);
  const q = (s) => String(s).replace(/'/g, "''");
  const contenido = ['[InternetShortcut]', `URL=http://127.0.0.1:${PUERTO}/`].concat(icono ? [`IconFile=${icono}`, 'IconIndex=0'] : []).join('\r\n') + '\r\n';
  // Nunca pisa un acceso ajeno: si «Personal OS.url» existe y apunta a otra cosa, usa otro nombre.
  const ps = `$d=[Environment]::GetFolderPath('Desktop');$l=Join-Path $d 'Personal OS.url';`
    + `if((Test-Path (Join-Path $d 'Personal OS.lnk')) -or ((Test-Path $l) -and -not ((Get-Content $l -Raw) -match '127\\.0\\.0\\.1:${PUERTO}'))){$l=Join-Path $d 'Personal OS (consola).url'};`
    + `[IO.File]::WriteAllText($l,'${q(contenido)}');Write-Output $l`;
  execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true }, (e, out, err) => {
    if (e) { console.error(`✖ ${(err || e.message).trim()}`); process.exit(1); }
    console.log(`Acceso directo: ${String(out).trim()} (abre una pestaña en el navegador por defecto)`);
  });
  return;
}

if (process.argv.includes('--instalar-tarea') || process.argv.includes('--quitar-tarea')) {
  if (process.platform !== 'win32') { console.error('La tarea de arranque solo existe en Windows.'); process.exit(1); }
  const quitar = process.argv.includes('--quitar-tarea');
  // Acceso directo en la carpeta Inicio del usuario: no pide administrador (schtasks ONLOGON sí lo pide)
  // y el usuario lo ve y lo apaga en Configuración → Aplicaciones → Inicio.
  // conhost --headless arranca node sin ventana (Windows 11).
  const inicio = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  const lnk = path.join(inicio, `${TAREA}.lnk`);
  if (quitar) {
    try { fs.unlinkSync(lnk); console.log(`Arranque quitado: ${lnk}`); } catch (_) { console.log('No había arranque instalado.'); }
    return;
  }
  const q = (s) => String(s).replace(/'/g, "''");
  const ps = `$s=(New-Object -ComObject WScript.Shell).CreateShortcut('${q(lnk)}');`
    + `$s.TargetPath='${q(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'conhost.exe'))}';`
    + `$s.Arguments='--headless "${q(NODE)}" "${q(__filename)}" --puerto ${PUERTO}';`
    + `$s.WorkingDirectory='${q(path.dirname(__filename))}';$s.WindowStyle=7;$s.Description='Personal OS: servidor de la consola (solo 127.0.0.1)';$s.Save()`;
  execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true }, (e, out, err) => {
    if (e || !fs.existsSync(lnk)) { console.error(`✖ no se pudo crear el arranque: ${(err || (e && e.message) || 'el acceso directo no quedó').trim()}`); process.exit(1); }
    console.log(`Arranque instalado: ${lnk} (oculto al iniciar sesión, puerto ${PUERTO}).`);
  });
  return;
}

// ------------------------------------------------------------------ lectura del estado

function mtime(ruta) { try { return fs.statSync(ruta).mtime.toISOString(); } catch (_) { return null; } }

function estado() {
  const ex = require('./exigencia.js').leer();
  const ex_mod = require('./exigencia.js');
  return {
    version: VERSION,
    os: { flag: C.flag ? C.flag() : null, activo: C.activo ? C.activo() : null },
    exigencia: {
      nivel: ex.nivel, etiqueta: ex.etiqueta, tono: ex.tono, aviso: ex.aviso,
      niveles: Object.entries(ex_mod.NIVELES).map(([k, v]) => ({ clave: k, etiqueta: v.etiqueta, tono: v.tono })),
    },
    tablero: { md: mtime(path.join(STATE || '', 'tablero.md')), html: mtime(path.join(STATE || '', 'tablero.html')) },
    consola: mtime(path.join(STATE || '', 'consola.html')),
    // mostrar_si / ocultar_si: {indicador, valor}. Así una acción se alterna con su contraria
    // (abrir o cerrar un widget) según lo que diga un indicador, sin que la app conozca el widget.
    acciones: Object.entries(accionesConfig()).map(([id, a]) => ({ id, etiqueta: a.etiqueta || id, ayuda: a.ayuda || '',
      confirmar: a.confirmar || null, mostrar_si: a.mostrar_si || null, ocultar_si: a.ocultar_si || null })),
    hoy: C.hoyISO(),
    // Consumo real del proceso del servidor (la página mide el suyo en el navegador).
    recursos: { servidor_mb: Math.round(process.memoryUsage().rss / 1048576), desde: INICIO, oficina: fs.existsSync(path.join(STATE || '', 'oficina.html')) },
  };
}

// ------------------------------------------------------------------ indicadores (módulos del usuario)

/**
 * `config.json → servidor.indicadores`: [{id, etiqueta, cmd: [...]}]. Cada comando imprime UNA línea JSON
 * {valor, detalle, tono: ok|aviso|error|neutro}. Así entran datos propios del usuario (horas de la jornada,
 * un widget) sin que el plugin conozca sus rutas. Caché corta: la página los pide cada 30 s solo si está visible.
 */
let cacheInd = { t: 0, datos: null };
async function indicadores() {
  if (cacheInd.datos && Date.now() - cacheInd.t < 20000) return cacheInd.datos;
  const lista = ((C.config().servidor || {}).indicadores || []).filter((i) => i && /^[a-z0-9-]{2,40}$/.test(i.id) && Array.isArray(i.cmd));
  const datos = await Promise.all(lista.map((i) => new Promise((resolve) => {
    const [exe, ...args] = i.cmd.map(sustituir);
    // 30 s: un indicador que lee un libro de Excel tarda en frío más de 10 s.
    execFile(exe, args, { windowsHide: true, timeout: 30000, cwd: STATE || C.OS_HOME }, (e, out, err) => {
      let r;
      try { r = JSON.parse(String(out || '').trim().split(/\r?\n/).pop()); } catch (_) { r = null; }
      // Nunca un número inventado: si el comando falla o no da JSON, se dice POR QUÉ (no la línea de comandos).
      const causa = e && e.killed ? 'tardó más de 30 s' : (String(err || '').trim().split(/\r?\n/).pop() || (e ? `salió con código ${e.code}` : 'no devolvió JSON'));
      resolve(Object.assign({ id: i.id, etiqueta: i.etiqueta || i.id },
        r && typeof r === 'object' ? r : { valor: 'sin dato', detalle: causa.slice(0, 160), tono: 'error' }));
    });
  })));
  cacheInd = { t: Date.now(), datos };
  return datos;
}

// ------------------------------------------------------------------ agentes (F3)

/*
 * Tres grupos, sacados de los archivos (CO-086):
 *   · propios del OS → los que trae el plugin (PLUGIN_ROOT/agents o la lista que deja el sync). Candado.
 *   · míos           → frontmatter `origen: personal-os-usuario`. Se crean, editan y borran desde la app.
 *   · de terceros    → todo lo demás (otros frameworks, sueltos). Candado.
 * Solo se escribe en ~/.claude/agents. El borrado mueve a <os-home>/_papelera-agentes (fuera de la carpeta
 * que Claude Code escanea). Un agente nuevo aparece en la siguiente sesión de Claude.
 */
const DIR_AGENTES = path.join(require('os').homedir(), '.claude', 'agents');
const PAPELERA = path.join(C.OS_HOME, '_papelera-agentes');
const ORIGEN_MIO = 'personal-os-usuario';
const RESERVADOS = new Set(['general-purpose', 'explore', 'plan', 'claude', 'fork', 'statusline-setup', 'claude-code-guide']);
const MODELOS = ['inherit', 'sonnet', 'opus', 'haiku', 'fable'];
const COLORES = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];   // los de Claude Code
// Agentes integrados de Claude Code (no tienen archivo). Descripción corta para la consola.
const INTEGRADOS = {
  'general-purpose': 'Agente de propósito general de Claude Code: investiga, busca código y hace tareas de varios pasos.',
  Explore: 'Explorador de solo lectura de Claude Code: barre muchos archivos y devuelve la conclusión.',
  Plan: 'Arquitecto de Claude Code: diseña planes de implementación paso a paso.',
  'claude-code-guide': 'Guía de Claude Code: responde sobre Claude Code, el Agent SDK y la API.',
  'statusline-setup': 'Configura la línea de estado de Claude Code.',
  fork: 'Copia de la sesión que trabaja en segundo plano con todo el contexto.',
  'workflow-subagent': 'Subagente que lanzan los workflows de Claude Code.',
};
const ACCESORIOS = ['', 'gafas', 'lupa', 'pluma', 'casco', 'boina', 'auriculares', 'escudo', 'portapapeles', 'corbatin', 'brujula'];
const GRUPOS_HERR = {
  lectura: ['Read', 'Grep', 'Glob'], edicion: ['Write', 'Edit'], terminal: ['Bash', 'PowerShell'], web: ['WebFetch', 'WebSearch'],
};

function propiosDelOs() {
  const s = new Set();
  try { for (const f of fs.readdirSync(path.join(C.PLUGIN_ROOT, 'agents'))) if (f.endsWith('.md')) s.add(f.slice(0, -3)); } catch (_) { /* instalación suelta */ }
  for (const n of (C.leerJson(path.join(C.OS_HOME, 'plugin-version.json'), {}) || {}).agentes || []) s.add(n);
  return s;
}

/** Frontmatter con `clave: valor` y listas YAML con guion (como `tools:` de algunos agentes). */
function leerAgente(ruta) {
  const texto = C.leerTexto(ruta, '') || '';
  const m = texto.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const fm = {}; let ultima = null;
  for (const l of m[1].split(/\r?\n/)) {
    if (/^\s*#/.test(l) || !l.trim()) continue;
    const item = l.match(/^\s+-\s+(.*)$/);
    if (item && ultima) { fm[ultima] = (Array.isArray(fm[ultima]) ? fm[ultima] : []).concat(item[1].trim()); continue; }
    const k = l.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!k) continue;
    ultima = k[1];
    let v = k[2].trim();
    if (/^\[.*\]$/.test(v)) { try { v = JSON.parse(v); } catch (_) { v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean); } }
    else if (/^".*"$/.test(v)) { try { v = JSON.parse(v); } catch (_) { v = v.slice(1, -1); } }
    else if (/^'.*'$/.test(v)) v = v.slice(1, -1).replace(/''/g, "'");
    fm[ultima] = v;
  }
  const tools = Array.isArray(fm.tools) ? fm.tools : String(fm.tools || '').split(',').map((s) => s.trim()).filter(Boolean);
  const lista = (x) => (Array.isArray(x) ? x : x ? [String(x)] : []).map(String).filter(Boolean);
  return { nombre: fm.name || path.basename(ruta, '.md'), descripcion: String(fm.description || ''), herramientas: tools,
    modelo: fm.model || 'inherit', origen: fm.origen || null, archivo: path.basename(ruta),
    // El bloque fijo de memoria lo pone la consola: no se muestra ni se edita como parte de las instrucciones.
    instrucciones: m[2].replace(/\n*<!-- memoria-os:inicio -->[\s\S]*?<!-- memoria-os:fin -->\n*/g, '\n').trim(),
    memoria: fm.memory || null,
    // Ficha (modelo Grok Bot: trabajo, metas y límites) + identidad. `color` es el campo oficial de Claude Code;
    // el resto son claves propias que Claude Code ignora sin error (doc oficial de subagentes).
    color: COLORES.includes(fm.color) ? fm.color : null, oficio: fm.oficio || '', lema: fm.lema || '',
    objetivo: fm.objetivo || '', meta: fm.meta || '', limites: lista(fm.limites), accesorio: fm.accesorio || '' };
}

function listarAgentes() {
  const propios = propiosDelOs();
  const lista = [];
  let archivos = [];
  try { archivos = fs.readdirSync(DIR_AGENTES).filter((f) => f.endsWith('.md')); } catch (_) { /* sin carpeta */ }
  for (const f of archivos.sort()) {
    const a = leerAgente(path.join(DIR_AGENTES, f));
    if (!a) { lista.push({ nombre: f.slice(0, -3), grupo: 'terceros', candado: true, error: 'frontmatter ilegible' }); continue; }
    const grupo = a.origen === ORIGEN_MIO ? 'mios' : propios.has(a.nombre) ? 'propios' : 'terceros';
    lista.push(Object.assign(a, { grupo, candado: grupo !== 'mios' }));
  }
  // Los integrados de Claude Code no son archivos: se listan los conocidos y los que aparecen en la actividad.
  const act = actividad();
  const tipos = new Set(Object.keys(INTEGRADOS).concat(Object.keys(act.porTipo).filter((t) => /^[A-Za-z][\w-]{1,40}$/.test(t))));
  for (const n of tipos) {
    if (lista.some((a) => a.nombre === n) || propios.has(n)) continue;
    if (!INTEGRADOS[n] && !act.porTipo[n]) continue;
    lista.push({ nombre: n, descripcion: INTEGRADOS[n] || 'Tipo de agente visto en la actividad de tus sesiones (sin archivo en ~/.claude/agents).',
      herramientas: [], modelo: 'inherit', instrucciones: '', grupo: 'integrados', candado: true, oficio: '', lema: '', objetivo: '', meta: '', limites: [], color: null, accesorio: '', memoria: null });
  }
  // Los del plugin que no estén copiados en ~/.claude/agents (instalación como plugin) también se ven.
  for (const n of propios) if (!lista.some((a) => a.nombre === n)) {
    const a = leerAgente(path.join(C.PLUGIN_ROOT, 'agents', `${n}.md`));
    if (a) lista.push(Object.assign(a, { grupo: 'propios', candado: true }));
  }
  return { agentes: lista, grupos_herramientas: GRUPOS_HERR, modelos: MODELOS, colores: COLORES, accesorios: ACCESORIOS.filter(Boolean),
    carpeta: DIR_AGENTES, actividad: actividad() };
}

/**
 * Actividad real por tipo de agente, desde los eventos que escriben los hooks en <estado>/_runtime/agentes-AAAA-MM-DD.jsonl
 * (SubagentStart / SubagentStop por id). De ahí: usos 7 y 30 días, última vez, si corre ahora y las últimas ejecuciones.
 * Lo que los eventos no traen (resultado, tarea) no se inventa. Caché de 10 s.
 */
let cacheAct = { t: 0, datos: null };
function actividad() {
  if (cacheAct.datos && Date.now() - cacheAct.t < 10000) return cacheAct.datos;
  const dir = path.join(STATE || '', '_runtime');
  let archivos = [];
  try { archivos = fs.readdirSync(dir).filter((f) => /^agentes-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort().slice(-30); } catch (_) { /* sin hooks */ }
  const corridas = new Map();
  for (const f of archivos) {
    for (const l of (C.leerTexto(path.join(dir, f), '') || '').split('\n')) {
      if (!l.trim()) continue;
      let ev; try { ev = JSON.parse(l); } catch (_) { continue; }
      if (!ev.id) continue;
      const c = corridas.get(ev.id) || { id: ev.id, tipo: null, inicio: null, fin: null, sesion: ev.sesion || null, tarea: null };
      if (ev.agentType) c.tipo = ev.agentType;
      if (ev.tarea) c.tarea = String(ev.tarea).slice(0, 200);
      if (ev.estado === 'trabajando') { if (!c.inicio || ev.ts < c.inicio) c.inicio = ev.ts; c.fin = null; }
      else if (ev.estado === 'libre') c.fin = ev.ts;
      corridas.set(ev.id, c);
    }
  }
  const ahora = Date.now(), D = 86400000, porTipo = {};
  for (const c of corridas.values()) {
    if (!c.tipo || !c.inicio) continue;
    const t = porTipo[c.tipo] || (porTipo[c.tipo] = { usos7: 0, usos30: 0, ultima: null, corriendo: false, desde: null, ejecuciones: [] });
    const ini = Date.parse(c.inicio);
    if (ahora - ini < 7 * D) t.usos7++;
    if (ahora - ini < 30 * D) t.usos30++;
    const ult = c.fin || c.inicio;
    if (!t.ultima || ult > t.ultima) t.ultima = ult;
    // Corriendo: arrancó y no ha terminado, y no hace más de 3 h (un cierre perdido no lo deja "trabajando" para siempre).
    if (!c.fin && ahora - ini < 3 * 3600000) { t.corriendo = true; t.desde = c.inicio; }
    t.ejecuciones.push({ inicio: c.inicio, fin: c.fin, duracion_s: c.fin ? Math.max(0, Math.round((Date.parse(c.fin) - ini) / 1000)) : null, sesion: c.sesion ? String(c.sesion).slice(0, 8) : null, tarea: c.tarea });
  }
  for (const t of Object.values(porTipo)) t.ejecuciones = t.ejecuciones.sort((a, b) => (a.inicio < b.inicio ? 1 : -1)).slice(0, 10);
  cacheAct = { t: Date.now(), datos: { generado: new Date().toISOString(), dias: archivos.length, porTipo } };
  return cacheAct.datos;
}

// ------------------------------------------------------------------ memoria del agente (conocimiento y experiencia)

const DIR_MEM = path.join(require('os').homedir(), '.claude', 'agent-memory');
const BLOQUE_MEMORIA = `<!-- memoria-os:inicio -->
## Tu memoria: conocimiento y experiencia
Tienes una carpeta de memoria persistente. Su índice \`MEMORY.md\` ya está en tu contexto.
- **Antes de trabajar:** revisa el índice y lee con Read los archivos de \`conocimiento/\` que apliquen a la tarea. Los escribe el usuario: son guías y convenciones que mandan sobre tus preferencias.
- **Al terminar:** si aprendiste algo que te sirva la próxima vez (una corrección del usuario, un error y su causa, una decisión con su porqué, algo que funcionó), guárdalo en \`experiencia/<tema>.md\` (un archivo por tema; amplía el existente antes de crear otro) y agrega o actualiza su línea en la sección «Experiencia» de \`MEMORY.md\`.
- No toques \`conocimiento/\` ni la sección «Conocimiento» del índice: son del usuario. Mantén \`MEMORY.md\` por debajo de 200 líneas.
- Nunca guardes secretos ni datos reales de personas.
<!-- memoria-os:fin -->`;
const RUTA_MEM = /^(MEMORY\.md|(conocimiento|experiencia)\/[a-z0-9][a-z0-9-]{0,60}\.md)$/;

function indiceInicial(nombre) {
  return `# Memoria de ${nombre}\n\n## Conocimiento\n<!-- conocimiento:inicio -->\n<!-- conocimiento:fin -->\n\n## Experiencia\n(El agente agrega aquí una línea por cada archivo de experiencia/.)\n`;
}

/** Reescribe la sección «Conocimiento» del índice con los archivos que hay en conocimiento/ (su título = primera línea #). */
function reindexarConocimiento(nombre) {
  const dir = path.join(DIR_MEM, nombre);
  const ruta = path.join(dir, 'MEMORY.md');
  let idx = C.leerTexto(ruta, null) || indiceInicial(nombre);
  if (!/<!-- conocimiento:inicio -->[\s\S]*?<!-- conocimiento:fin -->/.test(idx)) idx = idx.replace(/^(# .*\n)/, `$1\n## Conocimiento\n<!-- conocimiento:inicio -->\n<!-- conocimiento:fin -->\n`);
  let arch = [];
  try { arch = fs.readdirSync(path.join(dir, 'conocimiento')).filter((f) => f.endsWith('.md')).sort(); } catch (_) { /* vacío */ }
  const lineas = arch.map((f) => {
    const t = (C.leerTexto(path.join(dir, 'conocimiento', f), '') || '').match(/^#\s+(.+)$/m);
    return `- [${t ? t[1].trim() : f.slice(0, -3)}](conocimiento/${f})`;
  });
  idx = idx.replace(/<!-- conocimiento:inicio -->[\s\S]*?<!-- conocimiento:fin -->/, `<!-- conocimiento:inicio -->\n${lineas.join('\n')}${lineas.length ? '\n' : ''}<!-- conocimiento:fin -->`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ruta, idx, 'utf8');
}

function memoriaDe(nombre) {
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(nombre)) return { error: 'nombre inválido' };
  const dir = path.join(DIR_MEM, nombre);
  const archivos = [];
  for (const g of ['conocimiento', 'experiencia']) {
    let fs_ = [];
    try { fs_ = fs.readdirSync(path.join(dir, g)).filter((f) => f.endsWith('.md')); } catch (_) { /* vacío */ }
    for (const f of fs_.sort()) {
      const r = path.join(dir, g, f); const st = fs.statSync(r);
      const t = (C.leerTexto(r, '') || '').match(/^#\s+(.+)$/m);
      archivos.push({ grupo: g, ruta: `${g}/${f}`, titulo: t ? t[1].trim() : f.slice(0, -3), bytes: st.size, modificado: st.mtime.toISOString() });
    }
  }
  const indice = C.leerTexto(path.join(dir, 'MEMORY.md'), null);
  return { carpeta: dir, existe: fs.existsSync(dir), indice, lineas_indice: indice ? indice.split('\n').length : 0, archivos };
}

function leerMemoria(nombre, ruta) {
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(nombre) || !RUTA_MEM.test(ruta)) return null;
  return C.leerTexto(path.join(DIR_MEM, nombre, ruta), null);
}

function esMio(nombre) {
  const r = path.join(DIR_AGENTES, `${nombre}.md`);
  const a = fs.existsSync(r) ? leerAgente(r) : null;
  return !!(a && a.origen === ORIGEN_MIO);
}

function guardarConocimiento(b) {
  const nombre = String(b.agente || '');
  if (!esMio(nombre)) return { ok: false, mensaje: 'solo se escribe conocimiento en tus agentes' };
  const slug = String(b.slug || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) return { ok: false, mensaje: 'el nombre del archivo va en minúsculas, números y guiones' };
  const titulo = String(b.titulo || '').replace(/\s+/g, ' ').trim();
  if (titulo.length < 3 || titulo.length > 90) return { ok: false, mensaje: 'el título va de 3 a 90 caracteres' };
  let contenido = String(b.contenido || '').replace(/\r\n/g, '\n').trim();
  if (contenido.length < 10) return { ok: false, mensaje: 'el contenido está vacío' };
  if (contenido.length > 60000) return { ok: false, mensaje: 'el archivo pasa de 60 KB: pártelo por temas' };
  if (!/^#\s/.test(contenido)) contenido = `# ${titulo}\n\n${contenido}`;
  else contenido = contenido.replace(/^#\s+.*$/m, `# ${titulo}`);
  const dir = path.join(DIR_MEM, nombre, 'conocimiento');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${slug}.md`), tmp = dest + '.tmp';
  if (b.original && b.original !== slug) {
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(b.original)) return { ok: false, mensaje: 'original inválido' };
    if (fs.existsSync(dest)) return { ok: false, mensaje: `ya existe conocimiento/${slug}.md` };
  } else if (!b.original && fs.existsSync(dest)) return { ok: false, mensaje: `ya existe conocimiento/${slug}.md` };
  fs.writeFileSync(tmp, contenido + '\n', 'utf8'); fs.renameSync(tmp, dest);
  if (b.original && b.original !== slug) moverMemoriaAPapelera(nombre, `conocimiento/${b.original}.md`);
  reindexarConocimiento(nombre);
  if (C.leerTexto(dest, '') !== contenido + '\n') return { ok: false, mensaje: 'se escribió pero no se pudo releer igual' };
  return { ok: true, mensaje: `conocimiento/${slug}.md guardado e indexado en MEMORY.md` };
}

function moverMemoriaAPapelera(nombre, ruta) {
  const desde = path.join(DIR_MEM, nombre, ruta);
  if (!fs.existsSync(desde)) return;
  fs.mkdirSync(PAPELERA, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  fs.renameSync(desde, path.join(PAPELERA, `${nombre}--${ruta.replace('/', '--').slice(0, -3)}.${sello}.md`));
}

function borrarConocimiento(b) {
  const nombre = String(b.agente || ''), slug = String(b.slug || '');
  if (!esMio(nombre)) return { ok: false, mensaje: 'solo se borra conocimiento de tus agentes' };
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) return { ok: false, mensaje: 'nombre inválido' };
  if (!fs.existsSync(path.join(DIR_MEM, nombre, 'conocimiento', `${slug}.md`))) return { ok: false, mensaje: 'no existe' };
  moverMemoriaAPapelera(nombre, `conocimiento/${slug}.md`);
  reindexarConocimiento(nombre);
  return { ok: true, mensaje: `conocimiento/${slug}.md movido a la papelera` };
}

/** Valida y arma el .md. Devuelve {error} o {nombre, texto}. */
function armarAgente(b) {
  const nombre = String(b.nombre || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(nombre)) return { error: 'el nombre va en minúsculas, números y guiones (3 a 40), sin espacios' };
  if (RESERVADOS.has(nombre)) return { error: `«${nombre}» es un nombre reservado de Claude Code` };
  const descripcion = String(b.descripcion || '').replace(/\s+/g, ' ').trim();
  if (descripcion.length < 20) return { error: 'la descripción (cuándo usarlo) necesita al menos 20 caracteres: es lo que Claude lee para decidir llamarlo' };
  if (descripcion.length > 1000) return { error: 'la descripción pasa de 1000 caracteres' };
  const instrucciones = String(b.instrucciones || '').replace(/\r\n/g, '\n').trim();
  if (instrucciones.length < 20) return { error: 'las instrucciones necesitan al menos 20 caracteres' };
  if (/^---\s*$/m.test(instrucciones)) return { error: 'las instrucciones no pueden tener una línea con solo «---» (rompe el frontmatter)' };
  const modelo = MODELOS.includes(b.modelo) ? b.modelo : 'inherit';
  const herr = [];
  for (const g of b.grupos || []) for (const t of GRUPOS_HERR[g] || []) if (!herr.includes(t)) herr.push(t);
  for (const t of String(b.otras || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*(\*)?$/.test(t)) return { error: `herramienta con nombre inválido: «${t}»` };
    if (!herr.includes(t)) herr.push(t);
  }
  // Ficha: textos de una línea con su tope; límites, hasta 6 líneas.
  const corto = (v, max, campo) => {
    const s = String(v || '').replace(/\s+/g, ' ').trim();
    if (s.length > max) throw new Error(`${campo} pasa de ${max} caracteres`);
    return s;
  };
  let ficha;
  try {
    ficha = {
      oficio: corto(b.oficio, 40, 'el oficio'), lema: corto(b.lema, 90, 'el lema'),
      objetivo: corto(b.objetivo, 220, 'el objetivo'), meta: corto(b.meta, 220, 'la meta de cierre'),
      limites: (Array.isArray(b.limites) ? b.limites : String(b.limites || '').split('\n')).map((l, i) => corto(l, 140, `el límite ${i + 1}`)).filter(Boolean),
    };
  } catch (e) { return { error: e.message }; }
  if (ficha.limites.length > 6) return { error: 'máximo 6 límites' };
  const color = COLORES.includes(b.color) ? b.color : null;
  const accesorio = ACCESORIOS.includes(b.accesorio) ? b.accesorio : '';

  // Los textos van entre comillas dobles (JSON es YAML válido): así un «: » no rompe nada (bug de la 3.2.1).
  const fm = ['---', `name: ${nombre}`, `description: ${JSON.stringify(descripcion)}`];
  if (herr.length) fm.push(`tools: ${herr.join(', ')}`);
  if (modelo !== 'inherit') fm.push(`model: ${modelo}`);
  if (color) fm.push(`color: ${color}`);
  for (const k of ['oficio', 'lema', 'objetivo', 'meta']) if (ficha[k]) fm.push(`${k}: ${JSON.stringify(ficha[k])}`);
  if (ficha.limites.length) fm.push(`limites: ${JSON.stringify(ficha.limites)}`);
  if (accesorio) fm.push(`accesorio: ${accesorio}`);
  // Memoria nativa de Claude Code (doc de subagentes): `memory: user` → ~/.claude/agent-memory/<nombre>/, con
  // MEMORY.md como índice (sus primeras 200 líneas entran solas) y Read/Write/Edit habilitadas para esa carpeta.
  if (b.memoria) fm.push('memory: user');
  fm.push(`origen: ${ORIGEN_MIO}`, '---', '');
  let cuerpo = instrucciones.replace(/\n*<!-- memoria-os:inicio -->[\s\S]*?<!-- memoria-os:fin -->\n*/g, '\n').trim();
  if (b.memoria) cuerpo += '\n\n' + BLOQUE_MEMORIA;
  return { nombre, texto: fm.join('\n') + cuerpo + '\n' };
}

function guardarAgente(b) {
  const r = armarAgente(b);
  if (r.error) return { ok: false, mensaje: r.error };
  const destino = path.join(DIR_AGENTES, `${r.nombre}.md`);
  const original = b.original ? String(b.original) : null;
  if (original && !/^[a-z0-9][a-z0-9-]{2,39}$/.test(original)) return { ok: false, mensaje: 'original inválido' };
  const existe = fs.existsSync(destino);
  if (existe) {
    const a = leerAgente(destino);
    if (!a || a.origen !== ORIGEN_MIO) return { ok: false, mensaje: `ya existe un agente «${r.nombre}» que no es tuyo: tiene candado` };
    if (original !== r.nombre) return { ok: false, mensaje: `ya tienes un agente llamado «${r.nombre}»` };
  }
  if (original && original !== r.nombre) {
    const viejo = path.join(DIR_AGENTES, `${original}.md`);
    const a = fs.existsSync(viejo) ? leerAgente(viejo) : null;
    if (!a || a.origen !== ORIGEN_MIO) return { ok: false, mensaje: `«${original}» no es tuyo o ya no existe` };
  }
  fs.mkdirSync(DIR_AGENTES, { recursive: true });
  const tmp = destino + '.tmp';
  fs.writeFileSync(tmp, r.texto, 'utf8');
  fs.renameSync(tmp, destino);
  // Se relee lo escrito (CO-029): si no se lee igual, no se da por guardado.
  const leido = leerAgente(destino);
  if (!leido || leido.nombre !== r.nombre || leido.origen !== ORIGEN_MIO) return { ok: false, mensaje: 'se escribió pero no se pudo releer igual: revisa el archivo' };
  if (original && original !== r.nombre) moverAPapelera(original);
  if (b.memoria && !fs.existsSync(path.join(DIR_MEM, r.nombre, 'MEMORY.md'))) reindexarConocimiento(r.nombre);
  // Claude Code vigila ~/.claude/agents y toma el cambio en segundos, sin reiniciar (doc oficial de subagentes).
  return { ok: true, mensaje: `«${r.nombre}» guardado · Claude Code lo toma en unos segundos, sin reiniciar` };
}

function moverAPapelera(nombre) {
  fs.mkdirSync(PAPELERA, { recursive: true });
  const sello = new Date().toISOString().replace(/[:.]/g, '-');
  fs.renameSync(path.join(DIR_AGENTES, `${nombre}.md`), path.join(PAPELERA, `${nombre}.${sello}.md`));
}

function borrarAgente(b) {
  const nombre = String(b.nombre || '');
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(nombre)) return { ok: false, mensaje: 'nombre inválido' };
  const ruta = path.join(DIR_AGENTES, `${nombre}.md`);
  const a = fs.existsSync(ruta) ? leerAgente(ruta) : null;
  if (!a) return { ok: false, mensaje: `no existe «${nombre}»` };
  if (a.origen !== ORIGEN_MIO) return { ok: false, mensaje: `«${nombre}» tiene candado: no es tuyo` };
  moverAPapelera(nombre);
  return { ok: true, mensaje: `«${nombre}» movido a la papelera (${PAPELERA.replace(/\\/g, '/')})` };
}

// ------------------------------------------------------------------ paso a producción: qué se genera

/**
 * fuentes.yaml del usuario: --fuentes <ruta> (pruebas) > el --config-dir de servidor.consola_args (instalación
 * suelta) > <stateDir>/config. Nunca una ruta fija.
 */
function rutaFuentes() {
  const forzado = C.arg('--fuentes', null);
  if (forzado) return path.resolve(forzado);
  const a = (C.config().servidor || {}).consola_args || [];
  const i = a.indexOf('--config-dir');
  const dir = i > -1 && a[i + 1] ? a[i + 1] : (STATE ? path.join(STATE, 'config') : null);
  return dir ? path.join(path.resolve(dir), 'fuentes.yaml') : null;
}

const sangria = (l) => (l.match(/^[ \t]*/) || [''])[0].length;
const esVacia = (l) => /^\s*(#.*)?$/.test(l);

/**
 * Lee el bloque `paso_produccion:` sin parser YAML (Node puro): entregables (id, nombre, con) y la línea `omitir:`.
 * Acepta entradas en flujo de una línea (`- { id: x, nombre: "…", con: y }`) o en bloque (`- id: x` + claves debajo).
 */
function leerPasoProduccion(texto) {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/);
  const ini = lineas.findIndex((l) => /^paso_produccion:\s*(#.*)?$/.test(l));
  if (ini < 0) return { ini: -1, lineas, entregables: [], omitir: [], lineaOmitir: -1, sangriaBloque: 2 };
  let fin = lineas.length;
  for (let k = ini + 1; k < lineas.length; k++) if (lineas[k] !== '' && /^\S/.test(lineas[k])) { fin = k; break; }
  let sangriaBloque = null, lineaOmitir = -1, omitir = [], iEnt = -1;
  for (let k = ini + 1; k < fin; k++) {
    if (esVacia(lineas[k])) continue;
    if (sangriaBloque === null) sangriaBloque = sangria(lineas[k]);
    if (sangria(lineas[k]) !== sangriaBloque) continue;
    const mo = lineas[k].match(/^\s+omitir:\s*\[(.*)\]\s*(#.*)?$/);
    if (mo) { lineaOmitir = k; omitir = [...mo[1].matchAll(/"([^"]*)"|'([^']*)'|([\w.-]+)/g)].map((x) => x[1] ?? x[2] ?? x[3]).filter(Boolean); }
    if (/^\s+entregables:\s*(#.*)?$/.test(lineas[k])) iEnt = k;
  }
  const entregables = [];
  if (iEnt > -1) {
    const base = sangria(lineas[iEnt]);
    let actual = null;
    for (let k = iEnt + 1; k < fin; k++) {
      const l = lineas[k];
      if (esVacia(l)) continue;
      if (sangria(l) <= base && !/^\s*-/.test(l)) break;              // siguiente clave del bloque (aprobaciones…)
      const md = l.match(/^\s*-\s+(?:\{\s*)?id:\s*["']?([\w.-]+)/);
      if (md) { actual = { id: md[1], texto: l }; entregables.push(actual); }
      else if (actual && /^\s*-/.test(l) && sangria(l) <= base + 2) actual = null;
      else if (actual) actual.texto += '\n' + l;
    }
  }
  const campo = (t, c) => {
    // Un «con:» dentro del texto de otra clave (p. ej. el nombre) no cuenta: se vacían los textos ajenos.
    if (c !== 'nombre') t = t.replace(new RegExp(`(\\b(?!${c}\\b)[\\w-]+:\\s*)"(?:[^"\\\\]|\\\\.)*"`, 'g'), '$1""');
    const m = t.match(new RegExp(`(?:^|[\\s{,])${c}:\\s*(?:"((?:[^"\\\\]|\\\\.)*)"|'([^']*)'|([^,}\\n#]+))`));
    return m ? (m[1] ?? m[2] ?? m[3] ?? '').trim() : null;
  };
  return {
    ini, fin, lineas, lineaOmitir, omitir, sangriaBloque: sangriaBloque ?? 2,
    entregables: entregables.map((e) => ({ id: e.id, nombre: campo(e.texto, 'nombre') || e.id, con: campo(e.texto, 'con') || null })),
  };
}

function pasoProduccion() {
  const ruta = rutaFuentes();
  if (!ruta || !fs.existsSync(ruta)) return { ruta_existe: false, seccion: false, entregables: [] };
  const p = leerPasoProduccion(fs.readFileSync(ruta, 'utf8'));
  const om = new Set(p.omitir);
  return {
    ruta_existe: true, seccion: p.ini > -1,
    entregables: p.entregables.map((e) => ({ ...e, omitido: om.has(e.id), efectivo_omitido: om.has(e.id) || (!!e.con && om.has(e.con)) })),
  };
}

/** Reescribe SOLO la línea `omitir:` del bloque (o la crea tras `paso_produccion:`). Lista cerrada: ids existentes. */
function guardarPasoProduccion(b) {
  const ruta = rutaFuentes();
  if (!ruta || !fs.existsSync(ruta)) return { ok: false, mensaje: 'no encuentro fuentes.yaml' };
  if (!Array.isArray(b.omitir) || b.omitir.length > 100 || !b.omitir.every((x) => typeof x === 'string')) return { ok: false, mensaje: 'omitir debe ser una lista de ids' };
  const crudo = fs.readFileSync(ruta, 'utf8');
  const p = leerPasoProduccion(crudo);
  if (p.ini < 0) return { ok: false, mensaje: 'fuentes.yaml no tiene la sección paso_produccion' };
  const ids = p.entregables.map((e) => e.id);
  const malos = b.omitir.filter((x) => !ids.includes(x));
  if (malos.length) return { ok: false, mensaje: `entregable desconocido: ${malos.join(', ')}` };
  const lista = ids.filter((x) => b.omitir.includes(x));                 // orden de la configuración, sin duplicados
  const eol = crudo.includes('\r\n') ? '\r\n' : '\n';
  const bom = crudo.startsWith('﻿') ? '﻿' : '';
  const lineas = p.lineas.slice();
  const valor = `omitir: [${lista.map((x) => JSON.stringify(x)).join(', ')}]`;
  if (p.lineaOmitir > -1) {
    const vieja = lineas[p.lineaOmitir];
    const coment = (vieja.match(/\]\s*(#.*)$/) || [])[1];
    lineas[p.lineaOmitir] = vieja.match(/^\s*/)[0] + valor + (coment ? '   ' + coment : '');
  } else {
    lineas.splice(p.ini + 1, 0, ' '.repeat(p.sangriaBloque) + valor + '   # entregables que no se generan (⚙ Config de la consola)');
  }
  const respaldo = ruta + '.antes-omitir';
  if (!fs.existsSync(respaldo)) fs.copyFileSync(ruta, respaldo);
  const tmp = ruta + '.tmp-omitir';
  fs.writeFileSync(tmp, bom + lineas.join(eol), 'utf8');
  fs.renameSync(tmp, ruta);
  return { ok: true, mensaje: lista.length ? `no se generan: ${lista.join(', ')}` : 'se genera todo', omitir: lista };
}

// ------------------------------------------------------------------ acciones (lista cerrada)

/** Las del usuario: `config.json → servidor.acciones`. {id: {etiqueta, ayuda, confirmar, cmd: [...], esperar}} */
function accionesConfig() {
  const a = (C.config().servidor || {}).acciones || {};
  const ok = {};
  for (const [id, def] of Object.entries(a)) {
    if (!/^[a-z0-9-]{2,40}$/.test(id) || !def || !Array.isArray(def.cmd) || !def.cmd.length) continue;
    ok[id] = def;
  }
  return ok;
}

const sustituir = (s) => String(s)
  .replace(/\$\{STATE\}/g, STATE || '').replace(/\$\{OS_HOME\}/g, C.OS_HOME)
  .replace(/\$\{SCRIPTS\}/g, C.SCRIPTS_DIR).replace(/\$\{NODE\}/g, NODE);

function correr(cmd, esperar) {
  return new Promise((resolve) => {
    const [exe, ...args] = cmd.map(sustituir);
    if (!esperar) {
      const p = spawn(exe, args, { cwd: STATE || C.OS_HOME, detached: true, stdio: 'ignore', windowsHide: true });
      p.on('error', (e) => resolve({ ok: false, mensaje: e.message }));
      p.unref();
      return setTimeout(() => resolve({ ok: true, mensaje: 'lanzado' }), 300);
    }
    execFile(exe, args, { cwd: STATE || C.OS_HOME, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 4 * 1024 * 1024 },
      (e, out, err) => {
        const lineas = `${out || ''}${err || ''}`.trim().split(/\r?\n/).filter(Boolean);
        // El resultado se dice, no se supone: última línea de la salida y el código real.
        resolve({ ok: !e, mensaje: (lineas.pop() || (e ? e.message : 'hecho')).slice(0, 300) });
      });
  });
}

function abrirEnSistema(ruta) {
  if (!fs.existsSync(ruta)) return { ok: false, mensaje: `no existe: ${path.basename(ruta)}` };
  const [exe, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', ruta]]
    : process.platform === 'darwin' ? ['open', [ruta]] : ['xdg-open', [ruta]];
  execFile(exe, args, { windowsHide: true }, () => {});
  return { ok: true, mensaje: `abierto: ${path.basename(ruta)}` };
}

const PROPIAS = {
  'os-flag': (b) => {
    if (typeof b.activo !== 'boolean') return { ok: false, mensaje: 'falta activo: true|false' };
    fs.writeFileSync(path.join(C.OS_HOME, 'state.flag'), b.activo ? 'active' : 'paused', 'utf8');
    return { ok: true, mensaje: `Personal OS ${b.activo ? 'activado' : 'pausado'} · aplica desde la próxima sesión` };
  },
  exigencia: (b) => {
    const n = require('./exigencia.js').fijar(b.nivel);
    return { ok: true, mensaje: `exigencia: ${n} · aplica en la próxima sesión de Claude` };
  },
  abrir: (b) => {
    const destinos = {
      estado: STATE,
      'bitacora-hoy': path.join(STATE || '', 'bitacora', `${C.hoyISO()}.md`),
      tablero: path.join(STATE || '', 'tablero.html'),
    };
    if (!destinos[b.destino]) return { ok: false, mensaje: `destino desconocido: ${b.destino}` };
    return abrirEnSistema(destinos[b.destino]);
  },
  // En una instalación suelta build-consola necesita --config-dir: va en servidor.consola_args.
  'agente-guardar': (b) => guardarAgente(b),
  'agente-borrar': (b) => borrarAgente(b),
  'agente-conocimiento': (b) => guardarConocimiento(b),
  'agente-conocimiento-borrar': (b) => borrarConocimiento(b),
  'consola-build': () => correr([NODE, path.join(C.SCRIPTS_DIR, 'build-consola.js'),
    ...((C.config().servidor || {}).consola_args || [])], true),
};

async function ejecutar(id, cuerpo) {
  if (PROPIAS[id]) return PROPIAS[id](cuerpo || {});
  const def = accionesConfig()[id];
  if (!def) return null;                                   // 404: no está en la lista
  return correr(def.cmd, def.esperar !== false);
}

// ------------------------------------------------------------------ servidor

/**
 * La app ES la consola (decisión del usuario, 23/11: nada de «app dentro de app»). Al servir consola.html se
 * le inyecta el token y consola-app.js JUSTO DESPUÉS de sus datos y ANTES de su script: así sus pestañas
 * nuevas (Mandos, Config) ya existen cuando la consola engancha las suyas. La plantilla no se toca.
 */
function consolaConApp(html) {
  const inyeccion = `<script>window.OS_TOKEN=${JSON.stringify(TOKEN)};window.OS_VERSION=${JSON.stringify(VERSION)};</script>`
    + '<script src="/plantillas/identidad-agente.js" charset="utf-8"></script>'
    + '<script src="/plantillas/consola-app.js" charset="utf-8"></script>';
  const ancla = /(<script src="_datos\/datos\.js"[^>]*><\/script>)/;
  return ancla.test(html) ? html.replace(ancla, `$1\n${inyeccion}`) : html.replace(/<\/body>/i, `${inyeccion}</body>`);
}

function estatico(base, rel) {
  const destino = path.resolve(base, '.' + rel);
  if (!destino.startsWith(path.resolve(base) + path.sep)) return { codigo: 403 };
  const ext = path.extname(destino).toLowerCase();
  if (!MIME[ext]) return { codigo: 403 };
  if (!fs.existsSync(destino) || !fs.statSync(destino).isFile()) return { codigo: 404 };
  return { codigo: 200, tipo: MIME[ext], cuerpo: fs.readFileSync(destino) };
}

const servidor = http.createServer((req, res) => {
  const enviar = (codigo, tipo, cuerpo, extra) => {
    res.writeHead(codigo, Object.assign({
      'Content-Type': tipo, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      // SAMEORIGIN: la app muestra la consola en un iframe propio; ninguna página ajena puede enmarcarla.
      'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': "frame-ancestors 'self'", 'Referrer-Policy': 'no-referrer',
    }, extra || {}));
    res.end(cuerpo);
  };
  const json = (codigo, obj) => enviar(codigo, MIME['.json'], JSON.stringify(obj));

  // 1. Host: corta el DNS rebinding antes de mirar nada más.
  if (!HOSTS.has(String(req.headers.host || '').toLowerCase())) return enviar(403, 'text/plain', 'host no permitido');

  let url;
  try { url = new URL(req.url, `http://127.0.0.1:${PUERTO}`); } catch (_) { return enviar(400, 'text/plain', 'url inválida'); }
  const ruta = decodeURIComponent(url.pathname);

  if (req.method === 'GET') {
    if (ruta === '/salud') return json(200, { ok: true, version: VERSION, pid: process.pid, desde: INICIO });
    if (ruta === '/' || ruta === '/app') return enviar(302, 'text/plain', 'a la consola', { Location: '/estado/consola.html' + (url.search || '') });
    if (ruta === '/estado/consola.html' && STATE) {
      const r = estatico(STATE, '/consola.html');
      if (r.codigo !== 200) return enviar(404, 'text/plain; charset=utf-8', 'la consola no se ha construido: corre /consola o build-consola.js');
      return enviar(200, MIME['.html'], consolaConApp(r.cuerpo.toString('utf8')));
    }
    if (ruta === '/api/estado') {
      try { return json(200, estado()); } catch (e) { return json(500, { error: String(e && e.message) }); }
    }
    if (ruta === '/api/config/memoria') {
      const n = url.searchParams.get('agente') || '', r = url.searchParams.get('ruta');
      if (r) { const t = leerMemoria(n, r); return t === null ? json(404, { error: 'no existe' }) : json(200, { ruta: r, contenido: t }); }
      const m = memoriaDe(n); return json(m.error ? 400 : 200, m);
    }
    if (ruta === '/api/config/actividad') {
      try { return json(200, actividad()); } catch (e) { return json(500, { error: String(e && e.message) }); }
    }
    if (ruta === '/api/config/agentes') {
      try { return json(200, listarAgentes()); } catch (e) { return json(500, { error: String(e && e.message) }); }
    }
    if (ruta === '/api/config/paso-produccion') {
      try { return json(200, pasoProduccion()); } catch (e) { return json(500, { error: String(e && e.message) }); }
    }
    if (ruta === '/api/indicadores') {
      indicadores().then((d) => json(200, d), (e) => json(500, { error: String(e && e.message) }));
      return;
    }
    if (ruta.startsWith('/estado/') && STATE) {
      const r = estatico(STATE, ruta.slice('/estado'.length));
      return r.codigo === 200 ? enviar(200, r.tipo, r.cuerpo) : enviar(r.codigo, 'text/plain', String(r.codigo));
    }
    // La oficina 3D (en la carpeta de estado) importa three.js por rutas absolutas /_vendor/...
    if (ruta.startsWith('/_vendor/') && STATE) {
      const r = estatico(STATE, ruta);
      return r.codigo === 200 ? enviar(200, r.tipo, r.cuerpo, { 'Cache-Control': 'max-age=86400' }) : enviar(r.codigo, 'text/plain', String(r.codigo));
    }
    if (ruta.startsWith('/plantillas/')) {
      const r = estatico(PLANTILLAS, ruta.slice('/plantillas'.length));
      return r.codigo === 200 ? enviar(200, r.tipo, r.cuerpo) : enviar(r.codigo, 'text/plain', String(r.codigo));
    }
    return enviar(404, 'text/plain', 'no existe');
  }

  if (req.method !== 'POST') return enviar(405, 'text/plain', 'método no permitido');

  // 2. Lo que escribe o ejecuta: Origin propio + JSON + token.
  if (!ORIGENES.has(String(req.headers.origin || ''))) return enviar(403, 'text/plain', 'origen no permitido');
  if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) return enviar(415, 'text/plain', 'se espera JSON');
  const tok = String(req.headers['x-os-token'] || '');
  if (tok.length !== TOKEN.length || !crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(TOKEN))) {
    return enviar(403, 'text/plain', 'token inválido');
  }

  let crudo = '';
  req.on('data', (d) => { crudo += d; if (crudo.length > 20000) req.destroy(); });
  req.on('end', async () => {
    let cuerpo = {};
    try { cuerpo = crudo ? JSON.parse(crudo) : {}; } catch (_) { return json(400, { ok: false, mensaje: 'JSON inválido' }); }

    if (ruta === '/api/log') {
      try { fs.mkdirSync(path.join(STATE, '_runtime'), { recursive: true }); fs.appendFileSync(path.join(STATE, '_runtime', 'app-errores.log'), `${new Date().toISOString()} ${crudo.slice(0, 2000)}\n`); } catch (_) { /* nunca tumbar el servidor por un log */ }
      return enviar(204, 'text/plain', '');
    }
    if (ruta === '/api/config/paso-produccion') {
      try { const r = guardarPasoProduccion(cuerpo); return json(r.ok ? 200 : 400, r); }
      catch (e) { return json(500, { ok: false, mensaje: String(e && e.message).slice(0, 300) }); }
    }
    const m = ruta.match(/^\/api\/accion\/([a-z0-9-]{2,40})$/);
    if (!m) return json(404, { ok: false, mensaje: 'ruta desconocida' });
    try {
      const r = await ejecutar(m[1], cuerpo);
      if (!r) return json(404, { ok: false, mensaje: `acción no permitida: ${m[1]}` });
      return json(r.ok ? 200 : 500, r);
    } catch (e) {
      return json(500, { ok: false, mensaje: String(e && e.message).slice(0, 300) });
    }
  });
});

const INICIO = new Date().toISOString();

servidor.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `✖ El puerto ${PUERTO} está ocupado (¿ya hay otro os-servidor?). Prueba --salud.` : `✖ ${e.message}`);
  process.exit(1);
});

const limpiar = () => { try { const m = JSON.parse(fs.readFileSync(MARCA, 'utf8')); if (m.pid === process.pid) fs.unlinkSync(MARCA); } catch (_) { /* nada */ } };
process.on('exit', limpiar);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => process.exit(0));

// 127.0.0.1 explícito: NO 0.0.0.0. Aquí hay riesgos, compromisos y datos de clientes.
servidor.listen(PUERTO, '127.0.0.1', () => {
  try { fs.writeFileSync(MARCA, JSON.stringify({ pid: process.pid, puerto: PUERTO, desde: INICIO, version: VERSION }, null, 2)); } catch (_) { /* el testigo lo dirá */ }
  const url = `http://127.0.0.1:${PUERTO}/`;
  console.log(`Personal OS ${VERSION} en ${url} · solo 127.0.0.1 · estado: ${STATE || '(sin configurar)'}`);
  if (process.argv.includes('--abrir') && process.platform === 'win32') execFile('cmd', ['/c', 'start', '', url], { windowsHide: true }, () => {});
});
