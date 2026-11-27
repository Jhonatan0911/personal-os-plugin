#!/usr/bin/env node
// marca-terminal.js — tema de la terminal según la marca activa.
//
//   node marca-terminal.js --iniciar           crea <stateDir>/config/marca/terminal.json desde la plantilla
//   node marca-terminal.js                     muestra el plan (simulación)
//   node marca-terminal.js --aplicar           aplica, con respaldo del día
//   node marca-terminal.js --marca otra --aplicar
//   node marca-terminal.js --estado            JSON con las marcas, los interruptores y lo que está aplicado
//
// Lee config/marca/terminal.json en la carpeta de configuración del Personal OS (el --config-dir de
// servidor.consola_args, o <stateDir>/config): { activa, encendido, restaurar_pestanas, marcas: { id: {...} } }.
// `encendido: false` quita el tema (mod, Windows Terminal, prompts); `restaurar_pestanas` es aparte. Toca:
//   1. Imágenes (opcionales): copia la marca de agua y el ícono a <home>/.claude/marca-terminal/
//      con un sufijo por contenido (Windows Terminal guarda en caché la imagen por ruta).
//   2. Mod de Claude Code: copia plantillas/marca-terminal-mod/ a <home>/.claude/marca-terminal/mod/
//      y genera hooks/marca.ts con los colores.
//   3. <home>/.claude/settings.json: CLAUDE_CODE_PLUGIN_DIRS apunta al mod (conserva otras rutas).
//   4. Windows Terminal (solo Windows): esquema, tema y valores por defecto de todos los perfiles.
//   5. Prompt de PowerShell: bloque entre marcadores en $PROFILE (no toca el resto).
//   6. Prompt de CMD (solo Windows): variable de usuario PROMPT.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const C = require('./lib/comun');

const APLICAR = process.argv.includes('--aplicar');
const INICIAR = process.argv.includes('--iniciar');
const ESTADO = process.argv.includes('--estado');
const MARCA_ARG = C.arg('--marca');
const HOME = os.homedir();
const SALIDA = path.join(HOME, '.claude', 'marca-terminal');
const MOD = path.join(SALIDA, 'mod');
const PLANTILLA_MOD = path.join(C.PLUGIN_ROOT, 'plantillas', 'marca-terminal-mod');
const PLANTILLA_CFG = path.join(C.PLUGIN_ROOT, 'plantillas', 'marca-terminal.json');
const SETTINGS = path.join(HOME, '.claude', 'settings.json');
const WT = path.join(process.env.LOCALAPPDATA || '', 'Packages', 'Microsoft.WindowsTerminal_8wekyb3d8bbwe', 'LocalState', 'settings.json');
const INICIO_PS = '# >>> marca-terminal (generado por marca-terminal.js; no editar a mano)';
const FIN_PS = '# <<< marca-terminal';
const COLORES = ['principal', 'acento', 'acento_vivo', 'claro', 'fondo', 'fondo_suave', 'texto', 'gris', 'gris_suave', 'ok', 'error', 'alerta'];
const HOY = C.hoyISO();
const plan = [];

const salir = (msg) => { console.error('ERROR: ' + msg); process.exit(1); };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const sgr = (h) => rgb(h).join(';');
const leerJsonSinBom = (ruta) => JSON.parse(fs.readFileSync(ruta, 'utf8').replace(/^﻿/, ''));

function escribir(ruta, contenido) {
  if (!APLICAR) return;
  fs.mkdirSync(path.dirname(ruta), { recursive: true });
  fs.writeFileSync(ruta, contenido); // sin BOM: hooks.json y los JSON lo exigen
}

function respaldar(ruta) {
  if (!fs.existsSync(ruta)) return;
  const copia = `${ruta}.respaldo-${HOY}`;
  if (fs.existsSync(copia)) return;
  plan.push(`respaldo: ${copia}`);
  if (APLICAR) fs.copyFileSync(ruta, copia);
}

// Carpeta de configuración: --config-dir > el de servidor.consola_args (instalación suelta) > <stateDir>/config.
function rutaConfig() {
  const forzado = C.arg('--config-dir', null);
  const a = (C.config().servidor || {}).consola_args || [];
  const i = a.indexOf('--config-dir');
  const dir = forzado || (i > -1 && a[i + 1]) || (C.stateDir() ? path.join(C.stateDir(), 'config') : null);
  if (!dir) salir('no hay stateDir en la configuración del Personal OS (corre /os-setup).');
  return path.join(path.resolve(dir), 'marca', 'terminal.json');
}

function leerDatos() {
  const ruta = rutaConfig();
  if (!fs.existsSync(ruta)) salir(`no existe ${ruta}. Créalo con: node marca-terminal.js --iniciar`);
  return { ruta, datos: leerJsonSinBom(ruta) };
}

function cargar() {
  const { ruta, datos } = leerDatos();
  const id = MARCA_ARG || datos.activa;
  const m = (datos.marcas || {})[id];
  if (!m) salir(`la marca '${id}' no está en ${ruta} (hay: ${Object.keys(datos.marcas || {}).join(', ')})`);
  const col = m.colores || {};
  const faltan = COLORES.filter((k) => !(k in col));
  const malos = Object.entries(col).filter(([, v]) => !/^#[0-9A-Fa-f]{6}$/.test(String(v))).map(([k]) => k);
  if (faltan.length || malos.length) salir(`marca '${id}': faltan colores [${faltan}] / no son #RRGGBB [${malos}]`);
  const base = path.dirname(ruta);
  const archivo = (rel) => (rel ? path.resolve(base, rel) : null);
  for (const clave of ['marca_agua_imagen', 'icono']) {
    const r = archivo(m[clave]);
    if (r && !fs.existsSync(r)) salir(`marca '${id}': no existe ${clave} = ${r}`);
  }
  return {
    id,
    encendido: datos.encendido !== false,
    restaurar: datos.restaurar_pestanas !== false,
    nombre: m.nombre || id,
    corto: m.corto || m.nombre || id,
    lema: m.lema || '',
    colores: col,
    agua: archivo(m.marca_agua_imagen),
    icono: archivo(m.icono),
    opacidad: Number(m.marca_agua_opacidad ?? 0.18),
    posicion: m.marca_agua_posicion || 'center',
  };
}

// 1. Imágenes ---------------------------------------------------------------
function copiarImagen(id, nombre, origen) {
  if (!origen) return null;
  const firma = crypto.createHash('sha1').update(fs.readFileSync(origen)).digest('hex').slice(0, 8);
  const destino = path.join(SALIDA, `${id}-${nombre}-${firma}${path.extname(origen)}`);
  plan.push(`imagen: ${destino}`);
  if (APLICAR && !fs.existsSync(destino)) {
    fs.mkdirSync(SALIDA, { recursive: true });
    fs.copyFileSync(origen, destino);
  }
  return destino;
}

// 2. Mod de Claude Code ---------------------------------------------------------
function copiarArbol(origen, destino) {
  for (const e of fs.readdirSync(origen, { withFileTypes: true })) {
    const o = path.join(origen, e.name);
    const d = path.join(destino, e.name);
    if (e.isDirectory()) copiarArbol(o, d);
    else { fs.mkdirSync(destino, { recursive: true }); fs.copyFileSync(o, d); }
  }
}

function mod(m) {
  plan.push(`mod: ${PLANTILLA_MOD} -> ${MOD}`);
  const datos = { nombre: m.nombre, corto: m.corto, lema: m.lema, colores: m.colores };
  const ts = '// GENERADO por scripts/marca-terminal.js desde config/marca/terminal.json.\n'
    + '// No editar: se sobrescribe en cada aplicación.\n'
    + `export const MARCA = ${JSON.stringify(datos, null, 2)} as const\n`;
  if (APLICAR) copiarArbol(PLANTILLA_MOD, MOD);
  escribir(path.join(MOD, 'hooks', 'marca.ts'), ts);
}

// 3. settings.json de Claude Code ----------------------------------------------
function settingsClaude(on) {
  const s = fs.existsSync(SETTINGS) ? leerJsonSinBom(SETTINGS) : {};
  s.env = s.env || {};
  const antes = s.env.CLAUDE_CODE_PLUGIN_DIRS;
  const rutas = String(antes || '').split(path.delimiter).filter((r) => r && !r.includes('marca-terminal'));
  if (on) rutas.push(MOD.split(path.sep).join('/'));
  const nuevo = rutas.join(path.delimiter);
  if ((antes || '') === nuevo) { plan.push('settings.json de Claude Code: sin cambios'); return; }
  plan.push(on ? `settings.json de Claude Code: carga el mod (${MOD})` : 'settings.json de Claude Code: deja de cargar el mod');
  respaldar(SETTINGS);
  if (nuevo) s.env.CLAUDE_CODE_PLUGIN_DIRS = nuevo; else delete s.env.CLAUDE_CODE_PLUGIN_DIRS;
  escribir(SETTINGS, JSON.stringify(s, null, 2) + '\n');
}

function modCargado() {
  try { return String((leerJsonSinBom(SETTINGS).env || {}).CLAUDE_CODE_PLUGIN_DIRS || '').includes('marca-terminal'); } catch { return false; }
}

// 4. Windows Terminal ---------------------------------------------------------------
function windowsTerminal(m, agua, icono) {
  if (process.platform !== 'win32' || !fs.existsSync(WT)) { plan.push('Windows Terminal: no está, se omite'); return; }
  const c = m.colores;
  const nombre = `Marca ${m.corto}`;
  const esquema = {
    name: nombre, background: c.fondo, foreground: c.texto, cursorColor: c.acento, selectionBackground: c.claro,
    black: c.texto, red: c.error, green: c.ok, yellow: c.alerta, blue: c.acento, purple: c.gris, cyan: c.acento, white: c.gris_suave,
    brightBlack: c.gris, brightRed: c.error, brightGreen: c.ok, brightYellow: c.alerta, brightBlue: c.acento_vivo,
    brightPurple: c.gris, brightCyan: c.acento_vivo, brightWhite: c.fondo_suave,
  };
  const tema = {
    name: nombre, window: { applicationTheme: 'light' },
    tabRow: { background: c.principal + 'FF', unfocusedBackground: c.principal + 'FF' },
    tab: { background: c.fondo + 'FF', unfocusedBackground: c.principal + 'FF', showCloseButton: 'hover' },
  };
  const s = leerJsonSinBom(WT);
  const antes = JSON.stringify(s);
  s.profiles = s.profiles || {};
  const d = (s.profiles.defaults = s.profiles.defaults || {});
  const deLaMarca = (v) => String(v || '').includes('marca-terminal');
  if (m.encendido) {
    s.schemes = (s.schemes || []).filter((x) => !String(x.name || '').startsWith('Marca ')).concat(esquema);
    s.themes = (s.themes || []).filter((x) => !String(x.name || '').startsWith('Marca ')).concat(tema);
    s.theme = nombre;
    Object.assign(d, { colorScheme: nombre, cursorShape: 'bar', padding: '12' });
    if (agua) {
      Object.assign(d, {
        backgroundImage: agua.split(path.sep).join('/'), backgroundImageOpacity: m.opacidad,
        backgroundImageAlignment: m.posicion, backgroundImageStretchMode: 'none',
      });
    }
    if (icono) d.icon = icono.split(path.sep).join('/');
    plan.push(`Windows Terminal: esquema y tema '${nombre}', pestañas ${c.principal}${agua ? `, marca de agua ${m.posicion} al ${m.opacidad}` : ''}`);
  } else {
    // Apagar: vuelve a lo de fábrica solo lo que puso la marca; los esquemas quedan guardados para volver.
    if (String(s.theme || '').startsWith('Marca ')) s.theme = 'system';
    if (String(d.colorScheme || '').startsWith('Marca ')) delete d.colorScheme;
    if (deLaMarca(d.backgroundImage)) for (const k of ['backgroundImage', 'backgroundImageOpacity', 'backgroundImageAlignment', 'backgroundImageStretchMode']) delete d[k];
    if (deLaMarca(d.icon)) delete d.icon;
    plan.push('Windows Terminal: sin el tema de la marca (colores, ícono y marca de agua de fábrica)');
  }
  // Si la ventana se cierra sin querer, al reabrir vuelven las mismas pestañas, cada una en su
  // carpeta (la informa el prompt con OSC 9;9) y con su texto; cerrar varias pide confirmación.
  delete s.confirmCloseAllTabs;
  if (m.restaurar) {
    s.firstWindowPreference = 'persistedLayoutAndContent';
    s['warning.confirmCloseAllTabs'] = true;
    plan.push('Windows Terminal: restaura pestañas y carpetas al reabrir; confirma antes de cerrar varias');
  } else {
    if (s.firstWindowPreference === 'persistedLayoutAndContent') s.firstWindowPreference = 'defaultProfile';
    plan.push('Windows Terminal: no restaura las pestañas al reabrir');
  }
  if (JSON.stringify(s) === antes) { plan.push('Windows Terminal: sin cambios'); return; }
  respaldar(WT);
  escribir(WT, JSON.stringify(s, null, 4) + '\n');
}

function estadoWT() {
  try {
    const s = leerJsonSinBom(WT);
    return { instalado: true, tema: String(s.theme || '').startsWith('Marca '), restaurar: s.firstWindowPreference === 'persistedLayoutAndContent' };
  } catch { return { instalado: false, tema: false, restaurar: false }; }
}

// 5. Prompt de PowerShell ------------------------------------------------------------
function perfilPowerShell() {
  for (const exe of ['powershell', 'pwsh']) {
    try {
      const r = execFileSync(exe, ['-NoProfile', '-Command', '$PROFILE'], { encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (r) return r;
    } catch { /* siguiente */ }
  }
  return null;
}

function promptPowerShell(m) {
  const perfil = perfilPowerShell();
  if (!perfil) { plan.push('PowerShell: no se encontró $PROFILE, se omite'); return; }
  const c = m.colores;
  // Solo ASCII: PowerShell 5.1 lee el perfil sin BOM como ANSI. Los símbolos van con [char].
  // Tema apagado pero restaurar encendido: prompt normal que solo le informa la carpeta a Windows Terminal.
  const minimo = [
    INICIO_PS,
    'function prompt {',
    '    $e = [char]27',
    '    $ruta = $executionContext.SessionState.Path.CurrentLocation.Path',
    '    "$e]9;9;$ruta$e\\PS $ruta> "',
    '}',
    FIN_PS,
    '',
  ].join('\r\n');
  const completo = [
    INICIO_PS,
    'function prompt {',
    '    $e = [char]27',
    '    $tri = [char]0x25B2',
    '    $ram = [char]0x2387',
    '    $ruta = $executionContext.SessionState.Path.CurrentLocation.Path',
    '    $rama = $null',
    '    $dir = Get-Item -LiteralPath $ruta -ErrorAction SilentlyContinue',
    '    while ($dir -ne $null) {',
    "        $head = Join-Path $dir.FullName '.git\\HEAD'",
    '        if (Test-Path -LiteralPath $head) {',
    '            $linea = Get-Content -LiteralPath $head -TotalCount 1',
    "            if ($linea -match 'refs/heads/(.+)$') { $rama = $Matches[1] } else { $rama = $linea.Substring(0, 7) }",
    '            break',
    '        }',
    '        $dir = $dir.Parent',
    '    }',
    `    $bloque = "$e[1;97;48;2;${sgr(c.principal)}m $tri PS $e[0m"`,
    `    $carpeta = "$e[38;2;${sgr(c.acento)};48;2;${sgr(c.claro)}m $ruta $e[0m"`,
    "    $git = ''",
    `    if ($rama) { $git = "$e[38;2;${sgr(c.gris)};48;2;${sgr(c.fondo_suave)}m $ram $rama $e[0m" }`,
    '    $osc = "$e]9;9;$ruta$e\\"',
    '    "$osc$bloque$carpeta$git "',
    '}',
    FIN_PS,
    '',
  ].join('\r\n');
  const bloque = m.encendido ? completo : m.restaurar ? minimo : '';
  const actual = fs.existsSync(perfil) ? fs.readFileSync(perfil, 'utf8').replace(/^﻿/, '') : '';
  // Se reconoce cualquier versión del marcador de inicio (el texto entre paréntesis ha cambiado).
  const i = actual.indexOf('# >>> marca-terminal');
  const f = actual.indexOf(FIN_PS);
  let nuevo;
  if (i >= 0 && f > i) {
    let fin = f + FIN_PS.length;
    while (actual[fin] === '\r' || actual[fin] === '\n') fin++;
    nuevo = actual.slice(0, i) + bloque + actual.slice(fin);
  } else {
    nuevo = !bloque ? actual : (actual.trim() ? actual.replace(/\s+$/, '') + '\r\n\r\n' : '') + bloque;
  }
  if (nuevo === actual) { plan.push(`PowerShell: sin cambios (${perfil})`); return; }
  plan.push(m.encendido ? `PowerShell: prompt de la marca en ${perfil}` : m.restaurar ? `PowerShell: prompt normal que informa la carpeta (${perfil})` : `PowerShell: se quita el prompt de la marca (${perfil})`);
  respaldar(perfil);
  escribir(perfil, nuevo);
}

// 6. Prompt de CMD ----------------------------------------------------------------------
function promptCmd(m) {
  if (process.platform !== 'win32') return;
  const c = m.colores;
  // $E]9;9;$P$E\ le dice a Windows Terminal la carpeta actual (restaurar pestañas en su carpeta).
  const valor = m.encendido
    ? `$E]9;9;$P$E\\$E[1;97;48;2;${sgr(c.principal)}m ▲ CMD $E[0m$E[38;2;${sgr(c.acento)};48;2;${sgr(c.claro)}m $P $E[0m `
    : m.restaurar ? '$E]9;9;$P$E\\$P$G' : null;
  if (valor) {
    plan.push(m.encendido ? 'CMD: variable de usuario PROMPT con los colores de la marca' : 'CMD: prompt normal que informa la carpeta');
    if (APLICAR) execFileSync('reg', ['add', 'HKCU\\Environment', '/v', 'PROMPT', '/t', 'REG_SZ', '/d', valor, '/f'], { stdio: 'ignore' });
  } else {
    plan.push('CMD: se quita la variable PROMPT (vuelve el prompt de fábrica)');
    if (APLICAR) { try { execFileSync('reg', ['delete', 'HKCU\\Environment', '/v', 'PROMPT', '/f'], { stdio: 'ignore' }); } catch { /* no estaba */ } }
  }
}

function main() {
  if (INICIAR) {
    const destino = rutaConfig();
    if (fs.existsSync(destino)) { console.log(`Ya existe ${destino}; no se toca.`); return; }
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.copyFileSync(PLANTILLA_CFG, destino);
    console.log(`Creado ${destino}. Edita colores y logos y corre: node marca-terminal.js --aplicar`);
    return;
  }
  if (ESTADO) {
    // Para ⚙ Config · Terminal: las marcas con sus colores (la previsualización) y qué está aplicado.
    const { ruta, datos } = leerDatos();
    const marcas = Object.entries(datos.marcas || {}).map(([id, x]) => ({
      id, nombre: x.nombre || id, corto: x.corto || x.nombre || id, lema: x.lema || '', colores: x.colores || {},
      con_marca_agua: !!x.marca_agua_imagen, con_icono: !!x.icono,
    }));
    const wt = estadoWT();
    console.log(JSON.stringify({
      ok: true, ruta, activa: datos.activa, encendido: datos.encendido !== false, restaurar_pestanas: datos.restaurar_pestanas !== false,
      marcas, aplicado: { mod: modCargado(), windows_terminal: wt.instalado, tema_wt: wt.tema, restaurar: wt.restaurar },
    }));
    return;
  }
  const m = cargar();
  plan.push(`marca: ${m.id} (${m.nombre}), color principal ${m.colores.principal}; tema ${m.encendido ? 'encendido' : 'apagado'}, restaurar pestañas ${m.restaurar ? 'sí' : 'no'}`);
  const agua = m.encendido ? copiarImagen(m.id, 'marca-agua', m.agua) : null;
  const icono = m.encendido ? copiarImagen(m.id, 'icono', m.icono) : null;
  if (m.encendido) mod(m);
  settingsClaude(m.encendido);
  windowsTerminal(m, agua, icono);
  promptPowerShell(m);
  promptCmd(m);
  console.log(APLICAR ? 'APLICADO:' : 'PLAN (simulación; usa --aplicar):');
  for (const l of plan) console.log('  - ' + l);
  if (APLICAR) {
    console.log('Siguiente: abrir una consola nueva (Claude Code carga el mod al iniciar sesión).');
    console.log('Con fondo claro, pon Claude Code en tema claro: /theme -> Light.');
  }
}

main();
