#!/usr/bin/env node
/*
 * Personal OS — VIGÍA DE COMPROMISOS (alcances-scan)
 *
 * Por qué existe
 * --------------
 * Un alcance de 10 puntos comprometido con un cliente se descubrió roto el mismo día de la
 * entrega: puntos sin responsable, uno sin ticket, otros bloqueados desde hacía semanas esperando
 * un insumo que nadie persiguió. Todas las señales estaban escritas en el estado, sueltas. Nadie
 * hizo nunca la pregunta "¿qué prometimos y dónde está cada punto?".
 *
 * La lección no es "acordarse de ese cliente": es que **un compromiso con fecha necesita un vigía
 * que no dependa de que alguien se acuerde**. Este script es ese vigía. Es determinista, corre
 * en un hook y no sabe nada de ningún cliente en particular: aplica la misma regla a cualquier
 * cliente, a un proyecto interno o a un trabajo académico.
 *
 * Qué hace
 * --------
 *  1. Lee las notas de `estado/alcances/*.md` (un alcance = una nota, como riesgos y compromisos).
 *  2. Verifica sobre cada alcance ACTIVO:
 *       · ¿tiene fuente viva declarada? (sin fuente no hay nada que cruzar)
 *       · ¿se cruzó contra Jira hoy? (`verificado_el`) — si no, NO HAY VIGILANCIA
 *       · ¿hay puntos sin issue, sin responsable o sin fecha?
 *       · ¿hay puntos en estados que Jira cuenta como Done sin estarlo?
 *       · ¿hay puntos bloqueados esperando un insumo, y desde cuándo?
 *       · ¿el resultado del último cruce dejó puntos en rojo?
 *       · ¿la entrega está dentro de la ventana crítica, o ya venció sin cumplirse?
 *  3. Lee `estado/compromisos/*.md` y levanta los vencidos que siguen abiertos.
 *  4. Rastrea la bitácora reciente buscando compromisos NO DECLARADOS: si alguien habló de un
 *     alcance, una entrega o unas horas comprometidas y no existe una nota de alcance que lo
 *     cubra, eso es un punto ciego y se reporta.
 *  5. Lee `estado/requerimientos/<slug>/expediente.json` y persigue sus `cortes[]` pendientes y sus
 *     `compromisos[]` vigentes que vencen hoy, mañana o ya vencieron (sin duplicar un hito que una
 *     nota de alcance ya trae con la misma fecha y la misma clave de Jira).
 *
 * Salida: un bloque de texto para inyectar en contexto (exit 0, para que el hook SessionStart lo
 * inyecte). Con --exit-code, sale con 2 si hay CRÍTICOS (útil en CI o en un script propio).
 * Nunca lanza excepción hacia afuera: un vigía que rompe la sesión deja de usarse, y entonces
 * no vigila nada. Los días hábiles excluyen los festivos de config.json → festivos.
 *
 * Uso:
 *   node alcances-scan.js                 # usa el stateDir de config.json
 *   node alcances-scan.js --hitos         # modo corto para el hook de cada prompt
 *   node alcances-scan.js --estado <ruta> # para pruebas
 *   node alcances-scan.js --json          # salida estructurada
 *   node alcances-scan.js --hoy 2026-09-03  # congela la fecha (pruebas)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./lib/comun.js');

// ───────────────────────────────────────────────────────────── utilidades

const arg = C.arg;
const FLAG_JSON = process.argv.includes('--json');
// --hitos: modo corto para el hook de CADA prompt (UserPromptSubmit). Imprime solo los hitos con el
// cliente que vencen hoy, mañana o ya vencieron sin marcarse hechos, y NADA si no hay. Existe porque
// una publicación al cliente que vivía en la prosa de una nota, y no en un campo, no la vio el vigía
// del arranque, y en toda la jornada no entró en ninguna recomendación.
const FLAG_HITOS = process.argv.includes('--hitos');
const FLAG_EXIT = process.argv.includes('--exit-code');

const hoyISO = C.hoyISO;
const diasEntre = C.diasEntre;
/** ¿Cuántos días HÁBILES faltan de `desde` (excl.) a `hasta` (incl.)? Negativo si ya pasó. */
const diasHabiles = C.diasHabiles;

/**
 * Parser de frontmatter suficiente para nuestras notas: claves simples, listas y un nivel de
 * anidación. No pretende ser YAML completo — pretende no fallar nunca y no mentir: si algo no
 * lo entiende, esa clave simplemente no existe y el chequeo correspondiente salta como faltante,
 * que es el lado seguro del error.
 *
 *   clave: valor          → out.clave = "valor"
 *   clave:                → out.clave = [] | {}   (se decide con la primera línea indentada)
 *     - a                 → lista
 *     sub: v              → objeto
 */
function parseFrontmatter(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto);
  if (!m) return {};
  const out = {};
  let padre = null;        // clave de nivel 0 abierta (valor vacío) esperando hijos
  let listaEn = null;      // {obj, clave} donde se acumulan los "- item"

  for (const linea of m[1].split(/\r?\n/)) {
    if (!linea.trim() || /^\s*#/.test(linea)) continue;
    const indent = linea.match(/^\s*/)[0].length;

    const item = /^\s*-\s+(.*)$/.exec(linea);
    if (item) {
      if (listaEn) listaEn.obj[listaEn.clave].push(limpia(item[1]));
      continue;
    }

    const kv = /^\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/.exec(linea);
    if (!kv) continue;
    const clave = kv[1];
    const valor = limpia(kv[2]);

    if (indent === 0) {
      listaEn = null;
      padre = null;
      if (valor === '') { out[clave] = []; padre = clave; listaEn = { obj: out, clave }; }
      else out[clave] = valor;
    } else if (padre) {
      // primer hijo indentado: si la clave padre sigue siendo lista vacía, pásala a objeto
      if (Array.isArray(out[padre])) {
        if (out[padre].length) continue;   // ya es lista con datos: ignora la clave suelta
        out[padre] = {};
      }
      if (valor === '') { out[padre][clave] = []; listaEn = { obj: out[padre], clave }; }
      else { out[padre][clave] = valor; listaEn = null; }
    }
  }
  return out;
}

function limpia(v) {
  let s = String(v).trim();
  s = s.replace(/\s+#.*$/, '');                 // comentario al final
  if (/^".*"$/.test(s) || /^'.*'$/.test(s)) s = s.slice(1, -1);
  if (s === 'null' || s === '~') return '';
  return s.trim();
}

function leerNotas(dir) {
  let archivos = [];
  try { archivos = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.md')); }
  catch (e) { return []; }
  return archivos
    // README.md es el contrato de la carpeta; los que empiezan por "_" son plantillas o ejemplos.
    .filter((f) => f.toLowerCase() !== 'readme.md' && !f.startsWith('_'))
    .map((f) => {
      const ruta = path.join(dir, f);
      let texto = '';
      try { texto = fs.readFileSync(ruta, 'utf8'); } catch (e) { return null; }
      // Quitar el BOM: PowerShell, Excel y Notepad lo escriben, y sin esto el frontmatter no
      // hace match y la nota se ignora EN SILENCIO — el mismo modo de fallo que este script
      // existe para impedir.
      if (texto.charCodeAt(0) === 0xFEFF) texto = texto.slice(1);
      return { archivo: f, ruta, texto, fm: parseFrontmatter(texto) };
    })
    .filter(Boolean);
}

function num(v) { const n = parseInt(String(v), 10); return Number.isNaN(n) ? 0 : n; }

/**
 * Valor de texto de una clave del frontmatter. Existe por un bug real: una clave escrita como
 * `verificado_el:` (sin valor) la deja como lista vacía, y en JavaScript `[]` es TRUTHY — así que
 * `fm.verificado_el || ''` devolvía la lista y el chequeo "nunca se ha verificado" no disparaba.
 * Un vigía que se calla cuando falta el dato es peor que no tenerlo.
 */
function txt(v) {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.length ? String(v[0]).trim() : '';
  if (typeof v === 'object') return '';
  return String(v).trim();
}

/** Objeto real o null (una clave vacía llega como lista, no como objeto). */
function obj(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

// Palabras demasiado comunes para identificar un alcance: si se usan para decidir "esto ya está
// declarado", cualquier compromiso nuevo se camufla detrás de una palabra genérica.
const RUIDO = new Set([
  'entrega', 'entregar', 'final', 'software', 'ajustes', 'cliente', 'proyecto', 'modulo',
  'módulo', 'sistema', 'nuevo', 'nueva', 'general', 'total', 'puntos', 'punto', 'fase',
  'informe', 'reporte', 'cierre', 'flujo', 'datos', 'correo', 'para', 'sobre', 'todos',
]);

// ───────────────────────────────────────────────────────────── configuración

const stateDir = C.stateDir;

// El nivel de exigencia (el dial del panel) gradúa los umbrales. Si el módulo no está, se usan
// los valores de `estricto`: ante la duda se aprieta, porque un control que se relaja solo no
// controla nada.
let EXIGENCIA;
try { EXIGENCIA = require('./exigencia.js').leer(); }
catch (e) {
  EXIGENCIA = { nivel: 'estricto', etiqueta: 'estricto', max_dias_sin_verificar: 1,
                ventana_critica_dias: 5, max_compromisos_vencidos: 8,
                detectar_sin_declarar: true, avisar_fin_de_semana: false };
}

const POLITICA = {
  ventana_critica_dias: EXIGENCIA.ventana_critica_dias,
  max_dias_sin_verificar: EXIGENCIA.max_dias_sin_verificar,
  dias_bitacora: 5,              // cuánto atrás se rastrean compromisos no declarados
};

const SENALES = [
  'alcance', 'nos comprometimos', 'quedamos en entregar', 'esfuerzo total',
  'fecha de entrega', 'confirmado para pruebas',   // "puntos pendientes" se quitó: es lo que
                                                   // el usuario le pide al OS a diario, no una promesa
  'comprometido con el cliente', 'se entrega el', 'entrega al cliente',
  'quedamos en', 'me compromet', 'prometimos',
];

// Una promesa trae CUÁNDO. Sin referencia temporal, hablar de un alcance es conversación y no
// compromiso: sin este filtro la detección devolvía seis líneas de ruido por cada hallazgo real.
const TIENE_FECHA = [
  /\b\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/,
  /\b\d{1,2}[\/-]\d{1,2}([\/-]\d{2,4})?\b/,
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b(hoy|manana|pasado manana|esta semana|proxima semana|fin de semana|el lunes|el martes|el miercoles|el jueves|el viernes)\b/,
];

// ───────────────────────────────────────────────────────────── el análisis

const HITOS = [];   // hitos con el cliente de hoy/mañana/vencidos, para --hitos y --json

function analizar(base, hoy) {
  const hallazgos = [];   // {sev: 'CRITICO'|'ALERTA'|'OK', alcance, titulo, detalle, accion}
  const dirAlcances = path.join(base, 'alcances');
  const alcances = leerNotas(dirAlcances);

  // Una nota que el vigía no puede leer es una nota que NO vigila. Se reporta, no se ignora:
  // el silencio es justamente el modo de fallo que hay que erradicar.
  const ilegibles = alcances.filter((a) => Object.keys(a.fm).length === 0
                                        || !txt(a.fm.nombre) || !txt(a.fm.cliente));
  for (const a of ilegibles) {
    hallazgos.push({ sev: 'CRITICO', alcance: `⚠ ${a.archivo}`,
      titulo: 'Nota de alcance ILEGIBLE para el vigía',
      detalle: Object.keys(a.fm).length === 0
        ? 'No tiene frontmatter válido (¿se guardó sin las líneas ---?).'
        : 'Le falta `nombre` o `cliente` en el frontmatter.',
      accion: 'Arreglar el frontmatter. Mientras esté así, ese compromiso NO se está vigilando.' });
  }

  const legibles = alcances.filter((a) => !ilegibles.includes(a));
  const activos = legibles.filter((a) => {
    const e = (txt(a.fm.estado) || 'activo').toLowerCase();
    return e !== 'cumplido' && e !== 'cancelado';
  });

  for (const a of activos) {
    const fm = a.fm;
    const id = txt(fm.id) || a.archivo.replace(/\.md$/, '');
    const nombre = txt(fm.nombre) || id;
    const cliente = txt(fm.cliente) || 'SIN CLIENTE';
    const etiqueta = `${id} · ${cliente} · ${nombre}`;
    const entrega = txt(fm.fecha_entrega);
    const habiles = entrega ? diasHabiles(hoy, entrega) : null;

    // (1) fecha de entrega
    if (!entrega) {
      hallazgos.push({ sev: 'CRITICO', alcance: etiqueta,
        titulo: 'Alcance sin fecha de entrega',
        detalle: 'Un compromiso sin fecha no se puede vigilar ni incumplir a tiempo.',
        accion: 'Poner `fecha_entrega` o declarar por escrito que no la tiene y por qué.' });
    } else if (habiles !== null && habiles < 0 && txt(fm.estado).toLowerCase() !== 'incumplido') {
      hallazgos.push({ sev: 'CRITICO', alcance: etiqueta,
        titulo: `Entrega VENCIDA hace ${Math.abs(habiles)} día(s) hábil(es) y el alcance sigue abierto`,
        detalle: `Fecha comprometida: ${entrega}.`,
        accion: 'Cerrarlo como cumplido con evidencia, o declararlo incumplido y avisar al cliente HOY.' });
    }

    // (2) fuente viva
    const fuente = obj(fm.fuente);
    const tieneFuente = !!(fuente && (txt(fuente.item_id) || txt(fuente.uri) || txt(fuente.web_url)
                                      || txt(fuente.ruta) || txt(fuente.jql)));
    if (!tieneFuente) {
      hallazgos.push({ sev: 'CRITICO', alcance: etiqueta,
        titulo: 'Alcance sin fuente viva declarada',
        detalle: 'No hay de dónde leer los puntos, así que el cruce diario no puede hacerse.',
        accion: 'Declarar `fuente:` (archivo con drive_id+item_id, o el JQL que los devuelve).' });
    }

    // (3) ¿se cruzó hoy? — este es el chequeo que faltaba el día del incumplimiento
    const verificado = txt(fm.verificado_el);
    const enVentana = habiles === null || habiles <= POLITICA.ventana_critica_dias;
    // Días HÁBILES desde el último cruce: sin esto, todos los lunes gritaría por el fin de semana
    // y el aviso se volvería ruido de fondo, que es como se muere un control.
    const habilesSinCruzar = verificado ? diasHabiles(verificado, hoy) : null;
    const finDeSemana = [0, 6].includes(new Date(Date.parse(hoy + 'T00:00:00Z')).getUTCDay());

    if (!verificado) {
      hallazgos.push({ sev: enVentana ? 'CRITICO' : 'ALERTA', alcance: etiqueta,
        titulo: 'NUNCA se ha cruzado contra Jira',
        detalle: 'No existe registro de que los puntos se hayan verificado ni una sola vez.',
        accion: 'Cruzar los puntos hoy y escribir `verificado_el` con el resultado.' });
    } else if ((!finDeSemana || EXIGENCIA.avisar_fin_de_semana)
               && habilesSinCruzar !== null
               && habilesSinCruzar > POLITICA.max_dias_sin_verificar - 1) {
      // Un alcance activo se cruza TODOS los días hábiles. Tolerar "un día de retraso" es dejar
      // 24 h sin vigilancia a un compromiso con fecha, y 24 h antes de una entrega es todo.
      const cuanto = habilesSinCruzar === 1
        ? 'NO SE HA CRUZADO HOY'
        : `SIN VIGILANCIA hace ${habilesSinCruzar} días hábiles`;
      hallazgos.push({ sev: enVentana ? 'CRITICO' : 'ALERTA', alcance: etiqueta,
        titulo: cuanto,
        detalle: `Último cruce: ${verificado}. Un alcance activo se verifica todos los días hábiles.`,
        accion: 'Cruzar hoy punto por punto contra Jira y actualizar `verificado_el`.' });
    }

    // (4) el resultado del último cruce
    const total = num(fm.puntos_total);
    const conDueno = num(fm.puntos_con_dueno);
    const sinIssue = num(fm.puntos_sin_issue);
    const sinDueno = num(fm.puntos_sin_responsable);
    const sinFecha = num(fm.puntos_sin_fecha);
    const enganosos = num(fm.puntos_estado_enganoso);
    const bloqueados = num(fm.puntos_bloqueados);
    const brecha = num(fm.puntos_brecha_estado);

    if (total > 0) {
      // Las tres categorías SE SOLAPAN (un punto puede estar sin responsable y sin fecha a la
      // vez): sumarlas daba "11 de 10 puntos", y un vigía que exagera se deja de leer. Se reporta
      // el peor de los tres como magnitud y el desglose al lado.
      const rojo = Math.max(sinIssue, sinDueno, sinFecha);
      if (rojo > 0) {
        hallazgos.push({ sev: 'CRITICO', alcance: etiqueta,
          titulo: `hasta ${rojo} de ${total} puntos SIN DUEÑO REAL`,
          detalle: `sin issue: ${sinIssue} · sin responsable: ${sinDueno} · sin fecha: ${sinFecha} ` +
                   `(las categorías se solapan; el total real de puntos afectados está entre ${rojo} y ${Math.min(total, sinIssue + sinDueno + sinFecha)}).`,
          accion: 'Cada punto necesita issue, responsable y fecha. Sin eso ya está incumplido, solo que todavía no se nota.' });
      }
      if (enganosos > 0) {
        hallazgos.push({ sev: 'CRITICO', alcance: etiqueta,
          titulo: `${enganosos} punto(s) en un estado que Jira cuenta como cerrado sin estarlo`,
          detalle: 'Esos puntos no salen en ningún filtro de pendientes y siguen vivos.',
          accion: 'Sacarlos de ese estado o declarar por escrito que salen del alcance.' });
      }
      if (bloqueados > 0) {
        hallazgos.push({ sev: 'ALERTA', alcance: etiqueta,
          titulo: `${bloqueados} punto(s) esperando un insumo de un tercero`,
          detalle: txt(fm.bloqueo_detalle) || 'Un bloqueo que nadie persigue es un incumplimiento propio con pasos intermedios.',
          accion: 'Decir desde cuándo se pidió y a quién, y perseguirlo hoy.' });
      }
      if (brecha > 0) {
        hallazgos.push({ sev: 'ALERTA', alcance: etiqueta,
          titulo: `${brecha} punto(s) "hechos" según el equipo pero sin mover en Jira`,
          detalle: 'Quien mire Jira el día de la entrega ve trabajo sin empezar.',
          accion: 'Pedir que muevan el estado hoy: es lo que convierte el trabajo en evidencia.' });
      }
      if (rojo === 0 && enganosos === 0 && conDueno === total) {
        hallazgos.push({ sev: 'OK', alcance: etiqueta,
          titulo: `${total}/${total} puntos con dueño y fecha`,
          detalle: verificado ? `Verificado el ${verificado}.` : '', accion: '' });
      }
    } else if (tieneFuente && verificado) {
      hallazgos.push({ sev: 'ALERTA', alcance: etiqueta,
        titulo: 'El cruce no dejó números',
        detalle: 'Hay `verificado_el` pero no `puntos_total`: no se puede saber qué se verificó.',
        accion: 'Escribir el resultado del cruce en el frontmatter.' });
    }

    // (4-bis) HITOS intermedios con el cliente: publicaciones, envíos, sesiones con fecha propia.
    //   hitos:
    //     - "2026-09-29 | Publicar el módulo de reportes | hecho: correo de confirmación 29/09"
    // Formato: fecha | qué | estado. Sin estado (o sin 'hecho'/'cumplido'/'cancelado') = pendiente.
    // Un alcance incumplido sigue teniendo hitos: la entrega vencida no apaga las publicaciones pendientes.
    const hitos = Array.isArray(fm.hitos) ? fm.hitos : [];
    for (const h of hitos) {
      const [f, que, est] = String(h).split('|').map((s) => (s || '').trim());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f || '')) continue;
      if (/^(hecho|cumplido|cancelado)/i.test(est || '')) continue;
      const cuando = cuandoVence(hoy, f);
      if (!cuando) continue;
      const hit = { id, cliente, nombre, fecha: f, que: que || '(sin descripción)', cuando };
      HITOS.push(hit);
      hallazgos.push({ sev: 'CRITICO', alcance: etiqueta,
        titulo: `HITO CON EL CLIENTE ${cuando}: ${hit.que}`,
        detalle: `Fecha del hito: ${f}.`,
        accion: 'Va en «Mi recomendación para hoy» por encima de todo lo interno, hasta que se marque `hecho:` con evidencia en la nota.' });
    }

    // (5) proximidad de la entrega
    if (habiles !== null && habiles >= 0 && habiles <= POLITICA.ventana_critica_dias) {
      const rojos = hallazgos.filter((h) => h.alcance === etiqueta && h.sev === 'CRITICO').length;
      if (rojos > 0) {
        const cuando = habiles === 0 ? 'ENTREGA HOY' : `ENTREGA EN ${habiles} DÍA(S) HÁBIL(ES)`;
        hallazgos.push({ sev: 'CRITICO', alcance: etiqueta,
          titulo: `${cuando}, CON ${rojos} HALLAZGO(S) CRÍTICO(S) SIN RESOLVER`,
          detalle: `Fecha comprometida: ${entrega}.`,
          accion: 'Esto es la prioridad #1 del día. Si no se puede cumplir, avisar al cliente ANTES de la fecha.' });
      }
    }
  }

  // (6) compromisos vencidos que siguen abiertos
  const compromisos = leerNotas(path.join(base, 'compromisos'));
  const vencidos = [];
  for (const c of compromisos) {
    const est = txt(c.fm.estado).toLowerCase();
    if (['cumplido', 'cerrado', 'cancelado'].includes(est)) continue;
    // Un compromiso RECURRENTE ("enviar el timesheet todos los días") no está "vencido hace 20
    // días": se cumple o se incumple cada día. Reportarlo como vencido es ruido que tapa lo real.
    if (['si', 'sí', 'true'].includes(txt(c.fm.recurrente).toLowerCase())) continue;
    const lim = txt(c.fm.fecha_limite);
    if (!lim) continue;
    const d = diasEntre(lim, hoy);
    if (d === 0 || d === -1) {
      HITOS.push({ id: txt(c.fm.id) || c.archivo.replace(/\.md$/, ''), cliente: txt(c.fm.con),
                   nombre: txt(c.fm.titulo), fecha: lim, que: txt(c.fm.titulo) || c.archivo,
                   cuando: d === 0 ? 'HOY' : 'MAÑANA', compromiso: true });
    }
    if (d !== null && d > 0) {
      vencidos.push({ id: txt(c.fm.id) || c.archivo.replace(/\.md$/, ''), dias: d,
                      titulo: txt(c.fm.titulo) || c.archivo.replace(/\.md$/, ''), con: txt(c.fm.con) });
    }
  }
  vencidos.sort((a, b) => b.dias - a.dias);

  // (7) compromisos mencionados en la bitácora que NO tienen nota de alcance
  //     (en nivel `fácil` este rastreo se apaga: es el chequeo más caro de atender)
  const sospechas = EXIGENCIA.detectar_sin_declarar ? rastrearBitacora(base, hoy, alcances) : [];

  // (8) fechas de los expedientes de requerimiento: cortes y compromisos con el cliente
  let expedientes = { leidos: 0, conFechas: 0 };
  try { expedientes = vigilarExpedientes(base, hoy, legibles, hallazgos); }
  catch (e) {
    hallazgos.push({ sev: 'ALERTA', alcance: '⚠ requerimientos/',
      titulo: 'El vigía no pudo recorrer los expedientes', detalle: String(e && e.message || e).slice(0, 160),
      accion: 'Revisar la carpeta `requerimientos/`: mientras tanto sus cortes y compromisos NO se vigilan.' });
  }

  return { hallazgos, vencidos, sospechas, hitos: HITOS, totalAlcances: alcances.length, activos: activos.length,
           expedientes };
}

/**
 * ¿Cuándo vence una fecha, en el lenguaje del vigía? null si queda más allá del próximo día hábil.
 * La etiqueta usa días calendario: una fecha en sábado o festivo da 0 días hábiles, pero no es "hoy".
 */
function cuandoVence(hoy, f) {
  const dh = diasHabiles(hoy, f);
  if (dh === null || dh > 1) return null;
  const dc = diasEntre(hoy, f);
  return dc < 0 ? `VENCIDO hace ${Math.max(1, Math.abs(dh))} día(s) hábil(es)`
    : dc === 0 ? 'HOY' : dc === 1 ? 'MAÑANA' : `ANTES DEL PRÓXIMO DÍA HÁBIL (${f})`;
}

/**
 * Expedientes de requerimiento (`requerimientos/<slug>/expediente.json`, contrato en la skill
 * planear-sprint). Persigue dos listas con fecha:
 *   · `cortes[]` en estado `pendiente` (las revisiones intermedias; `tipo: acta` es una promesa
 *     tomada de un acta con el cliente). Un corte sin `responsable` es riesgo desde el día uno.
 *   · `compromisos[]` en estado `vigente`: fechas prometidas al cliente. Las `reemplazada` no
 *     alertan, pero la vigente dice cuántas veces se movió la fecha (la cadena de `reemplaza`).
 * Un expediente v1/v2 sin esos campos no emite nada; uno ilegible se avisa en una línea y no tumba
 * al resto. Si una nota de alcance ya trae el mismo hito (misma fecha y una clave de Jira del
 * expediente en su texto), no se repite: lo vigila la nota.
 */
function vigilarExpedientes(base, hoy, notas, hallazgos) {
  const dir = path.join(base, 'requerimientos');
  let slugs = [];
  try { slugs = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); }
  catch (e) { return { leidos: 0, conFechas: 0 }; }

  // Hitos ya declarados en las notas de alcance, para no duplicar.
  const hitosNotas = [];
  for (const a of notas) {
    for (const h of (Array.isArray(a.fm.hitos) ? a.fm.hitos : [])) {
      const f = String(h).split('|')[0].trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(f)) hitosNotas.push({ fecha: f, texto: String(h).toUpperCase() });
    }
  }
  const yaEnNota = (fecha, claves) => claves.length > 0 && hitosNotas.some((h) => h.fecha === fecha
    && claves.some((k) => new RegExp(`(^|[^A-Z0-9-])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9])`).test(h.texto)));

  const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ''));
  const lista = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
  let leidos = 0;
  let conFechas = 0;

  for (const slug of slugs.sort()) {
    if (slug.startsWith('_')) continue;   // plantillas o ejemplos, como en las notas
    const ruta = path.join(dir, slug, 'expediente.json');
    if (!fs.existsSync(ruta)) continue;
    let exp;
    try {
      let t = fs.readFileSync(ruta, 'utf8');
      if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
      exp = JSON.parse(t);
      if (!exp || typeof exp !== 'object' || Array.isArray(exp)) throw new Error('no es un objeto JSON');
    } catch (e) {
      const aviso = { id: slug, cliente: '', nombre: slug, fecha: '', que: 'expediente.json ILEGIBLE: sus fechas no se vigilan',
                      cuando: 'AVISO', origen: 'expediente' };
      HITOS.push(aviso);
      hallazgos.push({ sev: 'ALERTA', alcance: `⚠ requerimientos/${slug}`,
        titulo: 'Expediente ILEGIBLE para el vigía (JSON roto)',
        detalle: String(e && e.message || e).split('\n')[0].slice(0, 160),
        accion: 'Arreglar el JSON. Mientras esté así, sus cortes y compromisos NO se vigilan.' });
      continue;
    }
    leidos++;

    const cortes = lista(exp.cortes);
    const compromisos = lista(exp.compromisos);
    if (!cortes.length && !compromisos.length) continue;
    conFechas++;

    const id = txt(exp.id) || slug;
    const titulo = txt(exp.titulo) || txt(exp.requerimiento) || id;
    const cab = obj(exp.cabecera) || {};
    const cliente = txt(cab.cliente);
    const etiqueta = `${id} · ${cliente || 'SIN CLIENTE'} · ${titulo}`;
    const claves = new Set((Array.isArray(exp.jira) ? exp.jira : [exp.jira]).map(txt).filter(Boolean));
    for (const h of lista(exp.historias)) { const k = txt(h.clave) || txt(h.key); if (k) claves.add(k); }
    const clavesArr = [...claves].map((k) => k.toUpperCase());

    // Cortes pendientes (sin estado = pendiente: el lado seguro del error).
    for (const c of cortes) {
      const est = (txt(c.estado) || 'pendiente').toLowerCase();
      if (est !== 'pendiente') continue;
      const f = txt(c.fecha);
      if (!esFecha(f)) continue;
      const cuando = cuandoVence(hoy, f);
      if (!cuando || yaEnNota(f, clavesArr)) continue;
      const tipo = txt(c.tipo).toLowerCase();
      const resp = txt(c.responsable);
      const que = txt(c.que_se_revisa) || '(sin descripción)';
      const acta = tipo === 'acta';
      const vencido = cuando.startsWith('VENCIDO');
      // Promesa de un acta o corte sin dueño: CRÍTICO siempre. Corte interno: CRÍTICO solo vencido.
      const sev = acta || !resp || vencido ? 'CRITICO' : 'ALERTA';
      const extra = [acta ? 'acta con el cliente' : (tipo || 'corte'), resp || 'SIN RESPONSABLE'].join(' · ');
      HITOS.push({ id, cliente, nombre: titulo, fecha: f, que, cuando, origen: 'corte', extra });
      hallazgos.push({ sev, alcance: etiqueta,
        titulo: `${acta ? 'COMPROMISO DE ACTA' : 'CORTE'} ${cuando}: ${que}`,
        detalle: `Fecha del corte: ${f} · tipo: ${tipo || 'sin tipo'} · responsable: ${resp || 'SIN RESPONSABLE'}` +
                 (Array.isArray(c.criterios) && c.criterios.length ? ` · criterios: ${c.criterios.join(', ')}` : '') + '.',
        accion: !resp
          ? 'Ponerle responsable hoy: un corte sin dueño ya está incumplido, solo que todavía no se nota.'
          : vencido ? 'Hacer la revisión hoy y marcar el corte `ok` o `desviado` en el expediente, con nota.'
            : 'Agendarlo con el responsable y marcarlo `ok` o `desviado` en el expediente al terminar.' });
    }

    // Compromisos vigentes con el cliente.
    const porId = new Map(compromisos.filter((k) => txt(k.id)).map((k) => [txt(k.id), k]));
    for (const k of compromisos) {
      const est = (txt(k.estado) || 'vigente').toLowerCase();
      if (est !== 'vigente') continue;
      const f = txt(k.fecha);
      if (!esFecha(f)) continue;
      const cuando = cuandoVence(hoy, f);
      if (!cuando || yaEnNota(f, clavesArr)) continue;
      // Cadena de reemplazos: cuántas veces se movió la fecha antes de esta.
      const previas = [];
      const vistos = new Set([txt(k.id)]);
      let ant = txt(k.reemplaza);
      while (ant && !vistos.has(ant) && porId.has(ant)) {
        vistos.add(ant);
        previas.unshift(txt(porId.get(ant).fecha) || '¿?');
        ant = txt(porId.get(ant).reemplaza);
      }
      const movida = previas.length
        ? ` · la fecha se movió ${previas.length} ${previas.length === 1 ? 'vez' : 'veces'} (${previas.join(' → ')} → ${f})` : '';
      const que = txt(k.que) || '(sin descripción)';
      const aQuien = txt(k.a_quien);
      const extra = `compromiso con el cliente${aQuien ? ` · a ${aQuien}` : ''}${previas.length ? ` · movida ${previas.length}×` : ''}`;
      HITOS.push({ id, cliente, nombre: titulo, fecha: f, que, cuando, origen: 'compromiso_expediente', extra });
      hallazgos.push({ sev: 'CRITICO', alcance: etiqueta,
        titulo: `FECHA PROMETIDA AL CLIENTE ${cuando}: ${que}`,
        detalle: `Fecha comprometida: ${f}${aQuien ? ` · a ${aQuien}` : ''}${movida}.`,
        accion: cuando.startsWith('VENCIDO')
          ? 'Marcarla `cumplida` con evidencia, o `incumplida` y registrar la nueva fecha como compromiso que la `reemplaza`, avisando al cliente HOY.'
          : 'Va en «Mi recomendación para hoy» por encima de lo interno. Si no se cumple, avisar al cliente ANTES de la fecha.' });
    }
  }
  return { leidos, conFechas };
}

/**
 * Busca en la bitácora frases que suenan a compromiso y NO corresponden a ningún alcance ya
 * declarado. Es el detector de puntos ciegos: lo que nadie declaró es justamente lo que nadie
 * vigila.
 *
 * El match de "esto ya está declarado" se hace por PALABRA COMPLETA y solo con términos
 * distintivos. La primera versión comparaba por substring con cualquier palabra del nombre del
 * alcance, y un compromiso nuevo de un cliente quedó tapado porque la línea decía "entregar" y
 * un alcance de otro cliente se llamaba "Entrega final…". Camuflar un compromiso detrás de una
 * palabra común es exactamente el fallo que este script existe para impedir.
 */
function tokens(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 5 && !RUIDO.has(t));
}

function rastrearBitacora(base, hoy, alcances) {
  const dir = path.join(base, 'bitacora');
  const distintivos = new Set();
  for (const a of alcances) {
    tokens(a.fm.nombre).forEach((t) => distintivos.add(t));
    tokens(a.fm.cliente).forEach((t) => distintivos.add(t));
    for (const al of String(txt(a.fm.alias) || '').toLowerCase().split(/[,\s]+/)) {
      if (al.length >= 4) distintivos.add(al.normalize('NFD').replace(/[̀-ͯ]/g, ''));
    }
    distintivos.add(String(txt(a.fm.issue_paraguas) || '').toLowerCase());
  }
  distintivos.delete('');

  const out = [];
  const vistas = new Set();
  for (let i = 0; i < POLITICA.dias_bitacora; i++) {
    const d = new Date(Date.parse(hoy + 'T00:00:00Z'));
    d.setUTCDate(d.getUTCDate() - i);
    const p = (n) => String(n).padStart(2, '0');
    const iso = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
    let texto = '';
    try { texto = fs.readFileSync(path.join(dir, `${iso}.md`), 'utf8'); } catch (e) { continue; }

    for (const linea of texto.split(/\r?\n/)) {
      // Las líneas **OS:** y **TS:** las escribe el propio sistema: hablan de alcances que ya
      // conoce y ensucian la detección. Lo que interesa es lo que dijo el usuario o lo que llegó
      // de fuera.
      if (/^[-*\s]*\*\*(OS|TS):\*\*/i.test(linea)) continue;

      const plano = linea.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (!SENALES.some((s) => plano.includes(s.normalize('NFD').replace(/[̀-ͯ]/g, '')))) continue;

      // Un compromiso de verdad trae CUÁNDO. Sin referencia temporal es conversación, no promesa:
      // exigirla es lo que separa "hablamos del alcance" de "quedamos en entregarlo el 15".
      if (!TIENE_FECHA.some((re) => re.test(plano))) continue;

      // ¿la línea ya habla de un alcance declarado? Palabra COMPLETA, solo términos distintivos.
      const palabras = new Set(plano.split(/[^a-z0-9-]+/));
      if ([...distintivos].some((n) => palabras.has(n))) continue;

      const limpio = linea.replace(/^[-*\s]*\*\*(Tú|OS)\:\*\*\s*/i, '').replace(/^[-*\s]+/, '').trim();
      if (limpio.length < 25) continue;
      const clave = limpio.slice(0, 60).toLowerCase();
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      out.push({ fecha: iso, texto: limpio.slice(0, 170) });
    }
  }
  return out.slice(0, 6);
}

// ───────────────────────────────────────────────────────────── salida

function render(r, hoy, base) {
  const criticos = r.hallazgos.filter((h) => h.sev === 'CRITICO');
  const alertas = r.hallazgos.filter((h) => h.sev === 'ALERTA');
  const oks = r.hallazgos.filter((h) => h.sev === 'OK');
  const L = [];

  if (!r.totalAlcances && !r.vencidos.length && !r.sospechas.length && !r.hallazgos.length) {
    return { texto: '', criticos: 0 };
  }

  L.push('## ⚠️ VIGÍA DE COMPROMISOS — ' + hoy);
  L.push('');
  L.push(`Alcances vigilados: **${r.activos} activos** de ${r.totalAlcances}. ` +
         `Críticos: **${criticos.length}** · Alertas: ${alertas.length}. ` +
         `Exigencia: **${EXIGENCIA.etiqueta}**` +
         (EXIGENCIA.aviso ? ` ⚠️ (${EXIGENCIA.aviso}; se usa el nivel por defecto)` : '') + '.' +
         (r.expedientes && r.expedientes.conFechas
           ? ` Expedientes con cortes o compromisos: ${r.expedientes.conFechas} de ${r.expedientes.leidos}.` : ''));
  L.push('');

  if (criticos.length) {
    L.push('### 🔴 CRÍTICO — esto incumple una promesa con fecha');
    for (const h of criticos) {
      L.push(`- **${h.alcance}** — ${h.titulo}`);
      if (h.detalle) L.push(`  ${h.detalle}`);
      if (h.accion) L.push(`  → ${h.accion}`);
    }
    L.push('');
  }
  if (alertas.length) {
    L.push('### 🟡 Alerta');
    for (const h of alertas) {
      L.push(`- **${h.alcance}** — ${h.titulo}`);
      if (h.detalle) L.push(`  ${h.detalle}`);
      if (h.accion) L.push(`  → ${h.accion}`);
    }
    L.push('');
  }
  if (oks.length) {
    L.push('### 🟢 En regla');
    for (const h of oks) L.push(`- **${h.alcance}** — ${h.titulo} ${h.detalle}`);
    L.push('');
  }
  if (r.vencidos.length) {
    L.push('### ⏳ Compromisos vencidos y abiertos');
    const tope = EXIGENCIA.max_compromisos_vencidos;
    for (const v of r.vencidos.slice(0, tope)) {
      L.push(`- **${v.id}** — ${v.titulo} · vencido hace **${v.dias} días**${v.con ? ` · con ${v.con}` : ''}`);
    }
    if (r.vencidos.length > tope) L.push(`- …y ${r.vencidos.length - tope} más.`);
    L.push('');
  }
  if (r.sospechas.length) {
    L.push('### 👁 Posibles compromisos SIN DECLARAR (detectados en la bitácora)');
    L.push('Si alguno es un compromiso real con fecha, **crea su nota en `estado/alcances/` antes de seguir**:');
    for (const s of r.sospechas) L.push(`- \`${s.fecha}\` — ${s.texto}`);
    L.push('');
  }

  L.push('---');
  L.push('**Qué hacer con esto (no es opcional):** cada CRÍTICO se atiende o se declara por escrito ' +
         'por qué no se atiende. Cruzar un alcance significa mirar **punto por punto** su fuente viva ' +
         'contra Jira —por clave, nunca por título— y escribir el resultado en su nota ' +
         '(`verificado_el`, `puntos_total`, `puntos_sin_issue`, `puntos_sin_responsable`, ' +
         '`puntos_estado_enganoso`, `puntos_bloqueados`, `puntos_brecha_estado`). ' +
         'Un alcance que no se cruza hoy es un alcance sin vigilancia, y así fue como se perdió el último.');
  L.push(`_Vigía: \`alcances-scan.js\` sobre \`${base}\`._`);

  return { texto: L.join('\n'), criticos: criticos.length };
}

// ───────────────────────────────────────────────────────────── main

try {
  const base = stateDir();
  const hoy = hoyISO();
  if (!base || !fs.existsSync(base)) process.exit(0);
  // En los hooks se respeta la pausa (/os-off). A mano (--json, --estado) siempre corre.
  if (!FLAG_JSON && !arg('--estado', null) && !C.activo()) process.exit(0);
  const r = analizar(base, hoy);
  if (FLAG_HITOS) {
    if (r.hitos.length) {
      const L = ['⏰ HITOS CON FECHA (vigía, cada prompt): lo de hoy va en «Mi recomendación para hoy» por encima de lo interno, salvo que ya esté hecho con evidencia.'];
      for (const h of r.hitos) {
        const extra = h.compromiso ? ' (compromiso)' : h.extra ? ` (${h.extra})` : '';
        L.push(`- ${h.cuando} · ${h.id} · ${h.que}${extra}`);
      }
      process.stdout.write(L.join('\n') + '\n');
    }
    process.exit(0);   // en UserPromptSubmit un código 2 BLOQUEA el prompt: nunca
  }
  if (FLAG_JSON) {
    process.stdout.write(JSON.stringify({ hoy, base, ...r }, null, 2));
    process.exit(0);
  }
  const { texto, criticos } = render(r, hoy, base);
  if (texto) process.stdout.write(texto + '\n');
  // En SessionStart solo se inyecta el stdout de un exit 0; el código 2 queda para --exit-code.
  process.exit(FLAG_EXIT && criticos > 0 ? 2 : 0);
} catch (e) {
  if (process.argv.includes('--debug')) process.stderr.write(String(e && e.stack || e) + '\n');
  process.exit(0);   // un vigía nunca rompe la sesión
}
