#!/usr/bin/env node
/*
 * Personal OS — NIVEL DE EXIGENCIA (el dial).
 *
 * Un solo dial que gradúa cuánto aprieta el sistema. Lo leen el arranque (que ajusta el tono del
 * preámbulo) y el vigía de compromisos (que ajusta sus umbrales). Se mueve con /exigencia o con:
 *     node exigencia.js --set <facil|normal|estricto|cuartel>
 *
 * Fuente de verdad: ~/.claude/personal-os/exigencia.json → {"nivel": "estricto", ...}
 * Si falta el archivo o el nivel no existe, se usa `estricto`: el lado seguro del error es
 * apretar, no aflojar. Un sistema de control que ante la duda se relaja no controla nada.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./lib/comun.js');

const RUTA = path.join(C.OS_HOME, 'exigencia.json');
const POR_DEFECTO = 'estricto';

/** Cada nivel define de forma verificable qué cambia: si un nivel no mueve un número o una regla, no existe. */
const NIVELES = {
  facil: {
    etiqueta: 'fácil', orden: 1,
    max_dias_sin_verificar: 3,      // días hábiles que se toleran sin cruzar un alcance
    ventana_critica_dias: 2,        // a partir de cuándo un alcance en rojo es CRÍTICO
    max_compromisos_vencidos: 3,    // cuántos vencidos lista
    detectar_sin_declarar: false,   // no rastrea la bitácora buscando promesas sin nota
    avisar_fin_de_semana: false,
    tono: 'Recuerda solo lo crítico y no insistas. Si algo puede esperar, di que puede esperar. ' +
          'Una sola recomendación al cierre, no tres.',
  },
  normal: {
    etiqueta: 'normal', orden: 2,
    max_dias_sin_verificar: 2, ventana_critica_dias: 3, max_compromisos_vencidos: 5,
    detectar_sin_declarar: true, avisar_fin_de_semana: false,
    tono: 'Equilibrio: levanta lo que importa, no repitas lo ya dicho hoy salvo que haya cambiado.',
  },
  estricto: {
    etiqueta: 'estricto', orden: 3,
    max_dias_sin_verificar: 1,      // se cruza TODOS los días hábiles
    ventana_critica_dias: 5, max_compromisos_vencidos: 8,
    detectar_sin_declarar: true, avisar_fin_de_semana: false,
    tono: 'No suavices. Cada compromiso con fecha se nombra hasta que se cierre con evidencia. ' +
          'Exige issue, responsable y fecha antes de aceptar cualquier trabajo, y estimación ' +
          'antes de aceptar una fecha. Cierra siempre con las tres recomendaciones.',
  },
  cuartel: {
    etiqueta: 'cuartel', orden: 4,
    max_dias_sin_verificar: 0,      // sin tolerancia: o se cruzó hoy, o está sin vigilancia
    ventana_critica_dias: 10, max_compromisos_vencidos: 99,
    detectar_sin_declarar: true, avisar_fin_de_semana: true,
    tono: 'BLOQUEANTE. Si el vigía reporta un CRÍTICO, eso se atiende ANTES que lo que el usuario ' +
          'venga a pedir: dilo en la primera línea y pide decisión explícita para posponerlo. ' +
          'Nada se da por cerrado sin evidencia citada. Ninguna fecha se acepta sin esfuerzo validado. ' +
          'Ningún trabajo arranca sin issue. Si algo se va a incumplir, se comunica el mismo día.',
  },
};

function normaliza(s) { return C.sinTildes(s); }

function leer() {
  let nivel = POR_DEFECTO;
  let meta = {};
  let aviso = null;
  const crudo = C.leerTexto(RUTA, null);   // quita el BOM: con él el dial se quedaba clavado en silencio
  if (crudo !== null) {
    try {
      const j = JSON.parse(crudo);
      const n = normaliza(j && j.nivel);
      if (NIVELES[n]) { nivel = n; meta = j; }
      else aviso = `exigencia.json dice nivel "${j && j.nivel}", que no existe`;
    } catch (e) {
      aviso = 'exigencia.json existe pero no se puede leer (JSON inválido)';
    }
  }
  // Un dial que falla en silencio es peor que no tenerlo: quien lo movió cree que cambió algo.
  return Object.assign({ nivel, aviso }, NIVELES[nivel], { _meta: meta });
}

function fijar(nivelPedido) {
  const n = normaliza(nivelPedido);
  if (!NIVELES[n]) throw new Error(`nivel "${nivelPedido}" no existe (${Object.keys(NIVELES).join(' | ')})`);
  fs.mkdirSync(C.OS_HOME, { recursive: true });
  const { ymd, hm } = C.ahora();
  fs.writeFileSync(RUTA, JSON.stringify({ nivel: n, actualizado: `${ymd}T${hm}`, por: 'exigencia.js' }, null, 2) + '\n', 'utf8');
  return n;
}

module.exports = { leer, fijar, NIVELES, RUTA, POR_DEFECTO };

if (require.main === module) {
  try {
    const nuevo = C.arg('--set', null);
    if (nuevo) process.stdout.write(`nivel fijado: ${NIVELES[fijar(nuevo)].etiqueta}\n`);
    const e = leer();
    process.stdout.write(`nivel: ${e.etiqueta}${e.aviso ? `  (⚠️ ${e.aviso})` : ''}\n` +
      `  días sin cruzar tolerados : ${e.max_dias_sin_verificar}\n` +
      `  ventana crítica (días)    : ${e.ventana_critica_dias}\n` +
      `  vencidos que lista        : ${e.max_compromisos_vencidos}\n` +
      `  detecta sin declarar      : ${e.detectar_sin_declarar}\n` +
      `  avisa fin de semana       : ${e.avisar_fin_de_semana}\n`);
  } catch (err) {
    process.stdout.write('error: ' + err.message + '\n');
    process.exit(1);
  }
}
