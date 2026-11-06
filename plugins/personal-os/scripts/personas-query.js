#!/usr/bin/env node
'use strict';
/*
 * Personal OS — consultas sobre personas.
 *
 * Responde, con evidencia al lado, las preguntas que normalmente solo viven en la cabeza de quien
 * lidera el equipo:
 *
 *   node personas-query.js quien "un bug de la pasarela de pagos"   ¿quién sabe de esto?
 *   node personas-query.js libre                                    ¿quién tiene menos encima?
 *   node personas-query.js equipo "algo de facturación y reportes"
 *   node personas-query.js dia ana 2026-03-09                       ¿qué hacía Ana ese lunes?
 *   node personas-query.js persona luis
 *   node personas-query.js bus                                      frentes huérfanos o de dueño único
 *   node personas-query.js scan                                     qué está podrido en el módulo
 *
 * Principio no negociable: **cada afirmación sale con lo que la sostiene.** Si no hay evidencia,
 * se dice "sin respaldo" — nunca se rellena. Y si lo declarado choca con lo derivado, salen los
 * dos. Un recomendador que suena seguro y se equivoca es peor que no tener recomendador.
 */

const fs = require('fs');
const path = require('path');
const L = require('./personas-lib.js');

const PESO_NIVEL = { dueno: 100, trabaja: 60, toco: 25, aprende: 10 };
const DIAS_DECAE = 90;   // sin evidencia nueva en 90 días, `trabaja` deja de ser `trabaja`

const JSONOUT = process.argv.includes('--json');
const cmd = (process.argv[2] || 'ayuda').toLowerCase();
const args = L.posicionales(3);
const resto = args.join(' ');

if (cmd === 'ayuda' || cmd === '--help' || cmd === '-h') { ayuda(); process.exit(0); }

const base = L.stateDir();
if (!base) { salida(L.SIN_ESTADO); process.exit(0); }
const hoy = L.hoyISO();
const fichas = L.leerFichas(base);
const dominios = L.cargarDominios(base);

if (!fichas.length) {
  salida('No hay fichas de personas todavía en ' + L.dirPersonas(base) + '\n' +
         'Se crean al registrar el primer hecho: personas-append.js <persona> --hecho "…" --crear');
  process.exit(0);
}

switch (cmd) {
  case 'quien':   cmdQuien(resto); break;
  case 'libre':   cmdLibre(); break;
  case 'equipo':  cmdEquipo(resto); break;
  case 'dia':     cmdDia(); break;
  case 'persona': cmdPersona(resto); break;
  case 'bus':     cmdBus(); break;
  case 'scan':    cmdScan(); break;
  default:        ayuda();
}

// ═══════════════════════════════════════════════════════════════ comandos

/** ¿Quién sabe de esto? Identificación (McDonald & Ackerman: capa 1). */
function cmdQuien(frase) {
  if (!frase) return salida('Falta la pregunta. Ej: personas-query.js quien "la facturación"');

  const encontrados = L.frentesEn(dominios, frase);
  if (!encontrados.length) {
    return salida(
      `No reconocí ningún frente en: "${frase}"\n\n` +
      `El diccionario conoce: ${dominios.frentes.map((f) => f.clave).join(', ') || '(ninguno: _dominios.md está vacío)'}\n` +
      `Si el usuario lo llama de otra forma, ese alias hay que agregarlo a _dominios.md.`);
  }

  const lineas = [];
  for (const frente of encontrados) {
    lineas.push(`\n━━ ${frente.nombre || frente.clave}  (${frente.clave})`);
    const candidatos = rankear(frente.clave);
    if (!candidatos.length) {
      lineas.push('  ⚠️  NADIE. Este frente no tiene una sola persona vigente asignada.');
      if (frente.alerta) lineas.push(`      ${frente.alerta}`);
      continue;
    }
    for (const c of candidatos) {
      let marca = c.decaido ? ' ⏳ sin evidencia nueva' : '';
      // Un hecho que se cierra hoy sigue contando hoy, pero si no se dice, mañana el frente
      // aparece huérfano sin que nadie haya avisado.
      if (c.hasta) marca += `  🔻 su vigencia termina el ${c.hasta}`;
      lineas.push(`  ${etiquetaNivel(c.nivel)} ${c.ficha.nombre}${marca}`);
      lineas.push(`      ${c.evidencia || 'sin evidencia registrada'}`);
      lineas.push(`      desde ${c.desde || '?'} · fuente: ${c.fuente || '?'} · carga: ${carga(c.ficha)}`);
      for (const cf of conflictos(c.ficha)) lineas.push(`      ⚠️  ${cf}`);
    }
  }
  salida(lineas.join('\n'));
}

/** ¿Quién puede ahora? Selección social (McDonald & Ackerman: capa 2). */
function cmdLibre() {
  const activos = fichas.filter((f) => f.estado === 'activo' && L.txt(f.fm.relacion) === 'reporta');
  const conCarga = activos.map((f) => ({
    f,
    abiertas: numero(f.fm.issues_abiertas),
    vencidas: numero(f.fm.issues_vencidas),
    derivado: L.txt(f.fm.derivado_el),
  })).sort((a, b) => (a.abiertas - b.abiertas) || (a.vencidas - b.vencidas));

  const lineas = ['Carga declarada en las fichas — ordenada de menos a más:\n'];
  if (!conCarga.length) lineas.push('  (ninguna ficha activa con relacion: reporta)');
  for (const c of conCarga) {
    const ab = c.abiertas === null ? '?' : c.abiertas;
    const ve = c.vencidas === null ? '?' : c.vencidas;
    lineas.push(`  ${String(ab).padStart(3)} abiertas · ${String(ve).padStart(2)} vencidas   ${c.f.nombre}`);
    if (!c.derivado) lineas.push('        ⚠️  nunca se cruzó con Jira: este número puede estar viejo');
    else if (c.derivado < hoy) lineas.push(`        cruzado el ${c.derivado}`);
  }
  lineas.push('\n⚠️  "Menos issues" NO es "más libre": es frecuente que buena parte de los casos no');
  lineas.push('    tengan fecha ni estimación. Un inventario chico puede ser trabajo grande sin medir.');
  lineas.push('    Para decidir de verdad, mira también lo que falta por estimar en cada ficha.');
  salida(lineas.join('\n'));
}

/** Formación de equipo: cubrir los frentes pedidos repartiendo la carga. */
function cmdEquipo(frase) {
  if (!frase) return salida('Falta el objetivo. Ej: personas-query.js equipo "facturación y reportes"');
  const frentes = L.frentesEn(dominios, frase);
  if (!frentes.length) return salida(`No reconocí ningún frente en: "${frase}"`);

  const lineas = [`Equipo propuesto para: ${frase}\n`];
  const elegidos = new Map();
  const sinCubrir = [];

  for (const frente of frentes) {
    const cand = rankear(frente.clave).filter((c) => c.ficha.estado === 'activo');
    if (!cand.length) { sinCubrir.push(frente); continue; }

    // Preferir a quien ya está en el equipo (menos coordinación) si tiene nivel suficiente;
    // si no, al de mayor nivel con menor carga.
    const yaDentro = cand.find((c) => elegidos.has(c.ficha.slug) && PESO_NIVEL[c.nivel] >= 60);
    const elegido = yaDentro || cand.sort((a, b) =>
      (PESO_NIVEL[b.nivel] || 0) - (PESO_NIVEL[a.nivel] || 0) ||
      (numero(a.ficha.fm.issues_abiertas) || 0) - (numero(b.ficha.fm.issues_abiertas) || 0))[0];

    if (!elegidos.has(elegido.ficha.slug)) elegidos.set(elegido.ficha.slug, { ficha: elegido.ficha, frentes: [] });
    elegidos.get(elegido.ficha.slug).frentes.push({ frente, nivel: elegido.nivel, evidencia: elegido.evidencia });
  }

  for (const [, e] of elegidos) {
    lineas.push(`  ${e.ficha.nombre}  —  carga actual: ${carga(e.ficha)}`);
    for (const f of e.frentes) {
      lineas.push(`      ${etiquetaNivel(f.nivel)} ${f.frente.nombre || f.frente.clave}`);
      lineas.push(`          ${f.evidencia || 'sin evidencia registrada'}`);
    }
  }
  for (const f of sinCubrir) {
    lineas.push(`  ⚠️  ${f.nombre || f.clave}: NADIE cubre este frente. Hay que decidirlo, no asumirlo.`);
  }
  lineas.push('\nEsto es una propuesta con la evidencia al lado. La asignación la decide el usuario.');
  salida(lineas.join('\n'));
}

/** ¿Qué hacía X tal día? Lee la bitácora y el historial de la ficha. */
function cmdDia() {
  const quien = args[0];
  const fecha = args[1];
  if (!quien || !fecha) return salida('Uso: personas-query.js dia <persona> <AAAA-MM-DD>');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return salida(`Fecha inválida: ${fecha}`);

  const res = L.resolverPersona(fichas, quien);
  if (!res) return salida(`No hay ficha para "${quien}".`);
  if (res.ambiguo) return salida('Ambiguo: ' + res.ambiguo.map((f) => f.slug).join(', '));
  const ficha = res.ficha;

  const nombres = [ficha.nombre, ...ficha.alias, ficha.nombre.split(' ')[0]]
    .map(L.normalizar).filter(Boolean);

  const lineas = [`${ficha.nombre} — ${fecha}\n`];

  // 1. Lo que la ficha registró con esa fecha
  const enFicha = ficha.texto.split(/\r?\n/).filter((l) => l.includes(`**${fecha}**`));
  if (enFicha.length) {
    lineas.push('De su ficha:');
    enFicha.forEach((l) => lineas.push('  ' + l.replace(/^-\s*/, '· ').trim()));
    lineas.push('');
  }

  // 2. Lo que dice la bitácora de ese día
  const ruta = path.join(base, 'bitacora', fecha + '.md');
  if (!fs.existsSync(ruta)) {
    lineas.push(`No hay bitácora de ${fecha} (${ruta}).`);
    lineas.push('Si es antigua, puede que la rotación de la bitácora ya la haya borrado.');
  } else {
    const texto = L.leerTexto(ruta);
    const hits = [];
    let hora = '';
    for (const l of texto.split(/\r?\n/)) {
      const h = /^##\s+(\d{2}:\d{2})/.exec(l);
      if (h) { hora = h[1]; continue; }
      const n = L.normalizar(l);
      // Palabra completa (no contención): así un nombre corto como "Ana" cuenta sin
      // engancharse dentro de "mañana" o "semana".
      if (nombres.some((nm) => nm.length >= 3 && L.mencionaAlias(n, nm))) {
        hits.push(`  [${hora}] ${l.trim().slice(0, 300)}`);
      }
    }
    if (hits.length) { lineas.push('De la bitácora de ese día:'); lineas.push(...hits); }
    else lineas.push(`La bitácora de ${fecha} no lo menciona.`);
  }

  // 3. Qué frentes tenía vigentes ESE día — no los de hoy. Esto es el modelo bi-temporal.
  const vigentes = (ficha.frentes || []).filter((f) => {
    const d = L.txt(f.desde); const h = L.txt(f.hasta);
    return (!d || d <= fecha) && (!h || h >= fecha);
  });
  lineas.push(`\nFrentes que tenía vigentes el ${fecha}:`);
  if (!vigentes.length) {
    lineas.push('  (ninguno registrado con esa vigencia)');
    // Diferencia crítica: "no tenía frentes" y "el módulo todavía no existía" NO son lo mismo,
    // y confundirlos convierte un hueco de memoria en una afirmación falsa sobre una persona.
    const primerRegistro = (ficha.frentes || [])
      .map((f) => L.txt(f.registrado_el)).filter(Boolean).sort()[0];
    if (primerRegistro && primerRegistro > fecha) {
      lineas.push(`  ⚠️  Ojo: la ficha de ${ficha.nombre} se empezó a llevar el ${primerRegistro}.`);
      lineas.push(`      Antes de esa fecha el módulo no tiene memoria — que no aparezca nada NO`);
      lineas.push(`      significa que no estuviera trabajando en algo.`);
    }
  }
  vigentes.forEach((f) => lineas.push(`  ${etiquetaNivel(f.nivel)} ${f.clave}`));
  salida(lineas.join('\n'));
}

function cmdPersona(quien) {
  if (!quien) return salida('Uso: personas-query.js persona <nombre>');
  const res = L.resolverPersona(fichas, quien);
  if (!res) return salida(`No hay ficha para "${quien}". Hay: ${fichas.map((f) => f.slug).join(', ')}`);
  if (res.ambiguo) return salida('Ambiguo: ' + res.ambiguo.map((f) => f.slug).join(', '));
  const f = res.ficha;

  const lineas = [
    `${f.nombre}  (${f.slug})`,
    `  estado: ${f.estado} · relación: ${L.txt(f.fm.relacion) || '?'} · rol: ${L.txt(f.fm.rol) || '?'}`,
    `  carga: ${carga(f)}`,
    `  identidad verificada: ${L.txt((f.fm.identidades || {}).verificado) || 'false'}`,
    '',
    '  Frentes vigentes:',
  ];
  const vig = L.frentesVigentes(f, hoy);
  if (!vig.length) lineas.push('    (ninguno)');
  vig.forEach((fr) => {
    lineas.push(`    ${etiquetaNivel(fr.nivel)} ${fr.clave}  (desde ${L.txt(fr.desde) || '?'}, ${L.txt(fr.fuente) || '?'})`);
    if (L.txt(fr.evidencia)) lineas.push(`        ${L.txt(fr.evidencia)}`);
  });
  const cerrados = (f.frentes || []).filter((fr) => L.txt(fr.hasta));
  if (cerrados.length) {
    lineas.push('', '  Frentes cerrados (histórico, no se borran):');
    cerrados.forEach((fr) => lineas.push(`    · ${fr.clave} — hasta ${L.txt(fr.hasta)}`));
  }
  const cf = conflictos(f);
  if (cf.length) { lineas.push('', '  ⚠️  Conflictos declarado vs derivado:'); cf.forEach((c) => lineas.push('     ' + c)); }
  salida(lineas.join('\n'));
}

/** Frentes sin dueño o con dueño único: la versión de escritorio del bus factor. */
function cmdBus() {
  const lineas = ['Bus factor por frente — quién se lleva el conocimiento si sale\n'];
  const criticos = [];
  const solos = [];
  const sanos = [];

  for (const frente of dominios.frentes) {
    const duenos = rankear(frente.clave).filter((c) => c.nivel === 'dueno' && c.ficha.estado === 'activo');
    const alguien = rankear(frente.clave).filter((c) => c.ficha.estado === 'activo');
    // Nadie EN EL EQUIPO no es lo mismo que nadie en la empresa. Si el frente lo cubre alguien de
    // otro equipo, decirlo cambia la acción: no es "hay que formar a alguien", es "hay que
    // acordarlo con su líder". Callarlo haría sonar la alarma equivocada.
    const fuera = rankear(frente.clave).filter((c) => c.ficha.estado === 'fuera-de-celula');
    if (!duenos.length && !alguien.length) criticos.push({ frente, quien: [], fuera });
    else if (!duenos.length) solos.push({ frente, quien: alguien, sinDueno: true });
    else if (duenos.length === 1) solos.push({ frente, quien: duenos });
    else sanos.push({ frente, quien: duenos });
  }

  if (!dominios.frentes.length) lineas.push('(el diccionario _dominios.md no tiene frentes declarados)');
  if (criticos.length) {
    lineas.push('🔴 HUÉRFANOS — nadie vigente EN EL EQUIPO:');
    criticos.forEach((c) => {
      lineas.push(`   · ${c.frente.nombre || c.frente.clave}`);
      if (c.fuera && c.fuera.length) {
        lineas.push(`     ↳ fuera del equipo sí lo cubre: ${c.fuera.map((f) => f.ficha.nombre).join(', ')}`);
        lineas.push('       (no es formar a alguien: es acordarlo con su líder)');
      }
      if (c.frente.alerta) lineas.push(`     ${c.frente.alerta}`);
    });
    lineas.push('');
  }
  if (solos.length) {
    lineas.push('🟠 DUEÑO ÚNICO — si esa persona sale, el frente queda huérfano:');
    solos.forEach((s) => {
      const etiqueta = s.sinDueno ? ' (sin dueño declarado, solo gente que lo toca)' : '';
      lineas.push(`   · ${s.frente.nombre || s.frente.clave}${etiqueta} → ${s.quien.map((q) => q.ficha.nombre).join(', ')}`);
    });
    lineas.push('');
  }
  if (sanos.length) {
    lineas.push('🟢 CON RELEVO — más de un dueño:');
    sanos.forEach((s) => lineas.push(`   · ${s.frente.nombre || s.frente.clave} → ${s.quien.map((q) => q.ficha.nombre).join(', ')}`));
  }
  lineas.push('\nEsto es el bus factor declarado. El numérico, calculado sobre el código con el');
  lineas.push('algoritmo de Avelino, lo produce personas-doa.js cuando haya repos clonados.');
  salida(lineas.join('\n'));
}

/** Diagnóstico del módulo: qué está viejo, qué falta, qué se contradice. */
function cmdScan() {
  const av = [];
  for (const f of fichas) {
    const ident = f.fm.identidades || {};
    if (L.txt(ident.verificado) !== 'true') {
      av.push(`· ${f.nombre}: identidad SIN VERIFICAR — no se puede cruzar con Jira ni con git sin riesgo de mezclar personas`);
    }
    if (!L.txt(f.fm.derivado_el)) {
      av.push(`· ${f.nombre}: nunca se cruzó con Jira (derivado_el vacío)`);
    }
    for (const c of conflictos(f)) av.push(`· ${f.nombre}: CONFLICTO — ${c}`);
    for (const fr of L.frentesVigentes(f, hoy)) {
      // Misma referencia que en rankear(): la evidencia más reciente, no el inicio del hecho.
      const d = L.diasEntre(L.txt(fr.registrado_el) || L.txt(fr.desde) || hoy, hoy);
      if (d !== null && d > DIAS_DECAE && (fr.nivel === 'trabaja' || fr.nivel === 'dueno')) {
        av.push(`· ${f.nombre}: "${fr.clave}" lleva ${d} días sin evidencia nueva — el nivel "${fr.nivel}" ya no se sostiene solo`);
      }
    }
    if (f.estado === 'ambiguo') {
      av.push(`· ${f.nombre}: FICHA BLOQUEADA por ambigüedad de identidad. Nada derivado se le atribuye.`);
    }
  }
  const huerfanos = dominios.frentes.filter((fr) => !rankear(fr.clave).some((c) => c.ficha.estado === 'activo'));
  huerfanos.forEach((fr) => av.push(`· FRENTE HUÉRFANO: ${fr.nombre || fr.clave} — nadie vigente`));

  salida(av.length
    ? 'MÓDULO DE PERSONAS — lo que hay que atender:\n\n' + av.join('\n')
    : 'Módulo de personas: sin hallazgos.');
}

// ═══════════════════════════════════════════════════════════════ auxiliares

/** Candidatos a un frente, ordenados por nivel y penalizando la falta de evidencia reciente. */
function rankear(clave) {
  const out = [];
  for (const f of fichas) {
    for (const fr of L.frentesVigentes(f, hoy)) {
      if (fr.clave !== clave) continue;
      const desde = L.txt(fr.desde);
      // El decaimiento se mide contra la evidencia MÁS RECIENTE, no contra el inicio del hecho:
      // "Ana es dueña de facturación desde junio" no es conocimiento viejo si la evidencia se
      // confirmó hoy. Medirlo contra `desde` marcaría como caduco justo lo que se acaba de validar.
      const ref = L.txt(fr.registrado_el) || desde;
      const dias = ref ? L.diasEntre(ref, hoy) : null;
      out.push({
        ficha: f,
        nivel: L.txt(fr.nivel) || 'toco',
        desde,
        hasta: L.txt(fr.hasta),
        fuente: L.txt(fr.fuente),
        evidencia: L.txt(fr.evidencia),
        decaido: dias !== null && dias > DIAS_DECAE,
      });
    }
  }
  return out.sort((a, b) => {
    const pa = (PESO_NIVEL[a.nivel] || 0) - (a.decaido ? 30 : 0);
    const pb = (PESO_NIVEL[b.nivel] || 0) - (b.decaido ? 30 : 0);
    return pb - pa;
  });
}

function conflictos(ficha) {
  const c = ficha.fm.conflictos;
  if (!c) return [];
  return Array.isArray(c) ? c.filter(Boolean) : [String(c)].filter(Boolean);
}

function numero(v) {
  const s = L.txt(v);
  if (s === '') return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

function carga(ficha) {
  const ab = numero(ficha.fm.issues_abiertas);
  const ve = numero(ficha.fm.issues_vencidas);
  if (ab === null) return 'sin cruzar con Jira';
  return `${ab} abiertas${ve !== null ? `, ${ve} vencidas` : ''}`;
}

function etiquetaNivel(n) {
  return ({ dueno: '[DUEÑO ]', trabaja: '[trabaja]', toco: '[tocó   ]', aprende: '[aprende]' })[n] || '[   ?   ]';
}

function salida(texto) {
  if (JSONOUT) process.stdout.write(JSON.stringify({ cmd, texto }, null, 2) + '\n');
  else process.stdout.write(texto + '\n');
}

function ayuda() {
  salida(`personas-query — consultas sobre el equipo

  quien "<frase>"            ¿Quién sabe de esto? Con evidencia y conflictos.
  libre                      Carga declarada, de menos a más.
  equipo "<frase>"           Propone quiénes cubren los frentes mencionados.
  dia <persona> <fecha>      Qué hacía esa persona ese día (bitácora + frentes vigentes ENTONCES).
  persona <nombre>           Ficha resumida, con frentes cerrados incluidos.
  bus                        Frentes huérfanos y de dueño único.
  scan                       Qué está viejo, sin verificar o en contradicción.

  --json                     Salida en JSON.
  --estado <ruta>            Carpeta de estado alternativa (pruebas).
  --hoy AAAA-MM-DD           Fecha de referencia (pruebas).

  Ejemplo: personas-query.js quien "un error en la facturación"`);
}
