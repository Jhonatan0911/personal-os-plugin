#!/usr/bin/env node
'use strict';
/*
 * Prueba funcional del tablero de la célula: carga el HTML ya generado en un DOM real, captura los
 * errores de ejecución y comprueba que cada pestaña responde y que sus cifras son las que calculó el
 * motor (se leen del propio tablero, así sirve para cualquier corte). Lo que más protege: que el
 * cronograma siga pintando y que ningún cambio salga del tablero sin pasar por «Cambios propuestos».
 *
 *   node prueba.js <status-celula-AAAA-MM-DD.html>
 *
 * Necesita jsdom: `npm install jsdom` en cualquier carpeta y NODE_PATH apuntando a su node_modules
 * (o instalarlo junto a este archivo). Sale con 0 si todo pasa, 1 si algo falla, 2 si no puede correr.
 */
const fs = require('fs');

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); } catch (e) {
  console.error('Falta jsdom: `npm install jsdom` y define NODE_PATH=<esa carpeta>/node_modules. Sin él no se puede probar el tablero.');
  process.exit(2);
}
const RUTA = process.argv[2];
if (!RUTA || !fs.existsSync(RUTA)) { console.error('Uso: node prueba.js <tablero.html>  (no existe: ' + RUTA + ')'); process.exit(2); }

const errores = [];
const vc = new VirtualConsole()
  .on('jsdomError', (e) => errores.push('jsdomError: ' + (e.detail || e.message)))
  .on('error', (...a) => errores.push('console.error: ' + a.join(' ')));
const dom = new JSDOM(fs.readFileSync(RUTA, 'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;
const doc = window.document;
window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
window.HTMLDialogElement.prototype.close = function () { this.open = false; };

const ok = [], fail = [];
const t = (n, c, e) => (c ? ok : fail).push(n + (e != null && e !== '' ? ' → ' + e : ''));
const ev = (el, tipo, x) => el.dispatchEvent(new window.MouseEvent(tipo, { bubbles: true, clientX: x || 0, clientY: 0 }));
const clic = (el) => ev(el, 'click');
const num = (el) => +(el ? el.textContent : '').replace(/\D/g, '');
const $ = (id) => doc.getElementById(id);

setTimeout(() => {
  const D = JSON.parse($('datos').textContent);
  t('sin errores de ejecución', errores.length === 0, errores.join(' | '));

  // ── Cronograma ──
  const carriles = doc.querySelectorAll('#gantt .grow[data-p]');
  t('un carril por persona', carriles.length === D.personas.length, carriles.length + '');
  const lider = D.personas.find((p) => p.lider);
  t('el líder va primero', !lider || (carriles[0] && carriles[0].dataset.p === lider.slug));
  const barras = doc.querySelectorAll('#gantt .barra');
  t('el cronograma pinta barras', barras.length > 0, barras.length + ' barras');
  t('cada carril lleva su tira de carga', doc.querySelectorAll('#gantt .cargad').length > 0);
  t('la cobertura se declara arriba', $('cobertura').textContent.trim().length > 0);
  const cola = [...barras].find((b) => /^COLA·/.test(b.dataset.id));
  if (cola) {
    ev(cola, 'pointerdown'); ev(doc, 'pointerup');
    const c = D.items.find((i) => i.id === cola.dataset.id);
    t('clic en una cola abre su lista', $('dlg').open && $('dlgB').querySelectorAll('tr').length === c.grupo.length + 1,
      $('dlgB').querySelectorAll('tr').length - 1 + ' de ' + c.grupo.length);
    $('dlg').close();
  }
  const movibles = new Set(D.items.filter((i) => !i.fijo && !i.cerrada && !['grupo', 'implementacion', 'redefinido'].includes(i.tipo)).map((i) => i.id));
  const bMov = [...barras].find((b) => movibles.has(b.dataset.id));
  const movible = bMov && { id: bMov.dataset.id };
  if (bMov) {
    const n0 = num($('nCambios'));
    ev(bMov, 'pointerdown', 10);
    doc.dispatchEvent(new window.MouseEvent('pointermove', { bubbles: true, clientX: 400, clientY: 0 }));
    doc.dispatchEvent(new window.MouseEvent('pointerup', { bubbles: true, clientX: 400, clientY: 0 }));
    t('mover una barra deja un cambio propuesto', num($('nCambios')) === n0 + 1);
    clic($('deshacer'));
    t('«Deshacer» vacía los cambios', num($('nCambios')) === 0);
    const vuelta = [...doc.querySelectorAll('#gantt .barra')].find((b) => b.dataset.id === movible.id);
    t('«Deshacer» devuelve la barra a su sitio', vuelta && vuelta.style.left === bMov.style.left, vuelta && vuelta.style.left);
  }
  t('«Copiar para Jira» existe', !!$('copiar'));

  // ── Mesa ──
  const tarjetas = [...doc.querySelectorAll('#secciones .card')];
  const esperado = ['bloqueos_cliente', 'bloqueos_equipo', 'recursos', 'requerimientos', 'resuelto'].map((k) => (D[k] || []).length);
  t('la mesa trae sus cinco secciones con sus conteos', tarjetas.length === 5 && tarjetas.every((c, k) => num(c.querySelector('h2 .n')) === esperado[k]),
    tarjetas.map((c) => num(c.querySelector('h2 .n'))).join(',') + ' vs ' + esperado.join(','));

  // ── Líder ──
  const nCol = (D.colas_resumen || []).reduce((a, c) => a + c.n, 0);
  t('la pestaña Líder cuenta las colas', num($('nLider')) === nCol, $('nLider').textContent + ' vs ' + nCol);

  // ── Status Jira ──
  const M = D.jira && D.jira.metricas;
  if (M) {
    const tot = doc.querySelector('#tjProyectos tr.total');
    const espP = M.proyectos.find((p) => p.total);
    if (espP) t('TOTAL de tus proyectos coincide', num(tot.children[1]) === espP.abiertas, tot.children[1].textContent);
    const totC = doc.querySelector('#tjCelula tr.total'), espC = M.celula.find((f) => f.total);
    t('TOTAL de la célula coincide', num(totC.children[1]) === espC.abiertas, totC.children[1].textContent);
    const filas = doc.querySelectorAll('#tjCelula tbody tr');
    t('una fila por persona de la célula + TOTAL', filas.length === M.celula.length, filas.length + '');
    t('nadie de la célula lleva la marca de ajeno', ![...filas].some((r) => r.querySelector('.ajeno')));
    const ext = doc.querySelectorAll('#tjExternos tbody tr');
    if (M.externos.length) t('los de fuera van marcados', ext.length === M.externos.length && [...ext].every((r) => r.querySelector('.ajeno')));
    const conCarga = [...filas].find((r) => !r.classList.contains('total') && num(r.children[1]) > 0);
    if (conCarga) {
      clic(conCarga);
      const tareas = $('dlgB').querySelectorAll('tr.tarea');
      t('al clicar una persona salen sus issues', tareas.length === num(conCarga.children[1]), tareas.length + '');
      clic(tareas[0]);
      t('la ficha trae veredicto', $('isV') && $('isV').textContent.trim().length > 10);
      t('la ficha trae inicio y vencimiento', $('isDatos') && /Fecha de inicio/.test($('isDatos').textContent) && /Vencimiento/.test($('isDatos').textContent));
      t('la ficha trae el tiempo', $('isTiempo') && $('isTiempo').textContent.trim().length > 10);
      t('la ficha trae comentarios e historial', !!$('isCom') && !!$('isHist'));
      const n0 = num($('nCambios'));
      const sel = $('isEstado');
      sel.value = [...sel.options].map((o) => o.value).find((v) => v !== sel.value);
      clic($('isAplicaEstado'));
      t('proponer un estado entra en la cola', num($('nCambios')) === n0 + 1);
      clic(conCarga); clic($('dlgB').querySelectorAll('tr.tarea')[0]);
      $('isComentario').value = 'PRUEBA';
      clic($('isAplicaCom'));
      t('proponer un comentario entra en la cola', $('cambios').textContent.includes('PRUEBA'));
    }
  }

  // ── Frentes ──
  const frentes = (D.acuerdo_frentes && D.acuerdo_frentes.length) ? D.acuerdo_frentes : (D.frentes || []).filter((f) => f.titular !== undefined || f.backup !== undefined);
  if (frentes.length) {
    t('los frentes del acuerdo se listan', doc.querySelectorAll('#tfFrentes tbody tr').length === frentes.length);
    const s = doc.querySelector('#tfFrentes select[data-rol="titular"]');
    const n1 = num($('nCambios'));
    s.value = [...s.options].map((o) => o.value).find((v) => v && v !== s.value);
    s.dispatchEvent(new window.Event('change', { bubbles: true }));
    t('mover una titularidad entra en la cola', num($('nCambios')) === n1 + 1);
    if (D.reparto) t('mover una titularidad avisa del desbalance', doc.querySelectorAll('#reparto .desb').length > 0);
  }

  // ── Timesheets ──
  const TS = D.timesheets && D.timesheets.metricas;
  if (TS && TS.personas.length) {
    const celdas = doc.querySelectorAll('#tsTabla td.tsd');
    t('una celda por persona y día hábil', celdas.length === TS.personas.length * TS.dias.length, celdas.length + '');
    t('los colores coinciden con el cálculo', [...celdas].map((c) => c.dataset.e).join() === TS.personas.flatMap((p) => p.dias.map((d) => d.estado)).join());
    t('los rojos coinciden con la pastilla', doc.querySelectorAll('#tsTabla td.tsd.falta').length === (num($('nTs')) || 0));
    const k = TS.personas.findIndex((p) => p.dias.some((d) => d.sin_jira.length));
    if (k >= 0) { clic(doc.querySelectorAll('#tsTabla tr[data-ts]')[k]); t('al clicar una persona salen sus horas sin issue', !!$('tsSinJira')); }
  }

  console.log('\n=== PASA (' + ok.length + ') ===');
  ok.forEach((x) => console.log('  OK  ' + x));
  if (fail.length) { console.log('\n=== FALLA (' + fail.length + ') ==='); fail.forEach((x) => console.log('  XX  ' + x)); }
  process.exit(fail.length ? 1 : 0);
}, 700);
