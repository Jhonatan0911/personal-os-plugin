// Carga la página publicada y la generada en jsdom, abre cada vista y compara lo que pinta.
'use strict';
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const path = require('path');
// --ignorar "<selector>,<selector>" quita esos elementos de las dos fotos (una diferencia buscada, p. ej. una pestaña nueva).
const argv = process.argv.slice(2);
const iIgn = argv.indexOf('--ignorar');
const IGNORAR = iIgn >= 0 ? argv.splice(iIgn, 2)[1] : '';
const [A, B, DBDIR] = argv;
// Base simulada: cada subcarpeta de DBDIR es una colección y cada .json un documento. Solo lectura.
let DB = null, USER = null;
if (DBDIR) {
  const col = {};
  for (const c of fs.readdirSync(DBDIR)) {
    col[c] = fs.readdirSync(path.join(DBDIR, c)).filter(f => f.endsWith('.json'))
      .map(f => ({ id: f.slice(0, -5), v: JSON.parse(fs.readFileSync(path.join(DBDIR, c, f), 'utf8')) }));
  }
  const snap = c => ({ docs: (col[c] || []).map(d => ({ id: d.id, data: () => JSON.parse(JSON.stringify(d.v)) })) });
  DB = { collection: c => ({
    onSnapshot(cb) { setTimeout(() => cb(snap(c)), 0); return () => {}; },
    get: async () => snap(c),
    doc: id => ({ set: async () => {}, delete: async () => {}, update: async () => {},
      get: async () => { const d = (col[c] || []).find(x => x.id === id); return { exists: !!d, id, data: () => d && d.v }; } }),
  }) };
  USER = { isOwner: async () => true, can: async () => true, id: async () => 'u_prueba', email: async () => 'prueba@ejemplo.com', profiles: async () => ({}) };
}

async function cargar(ruta) {
  const errores = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errores.push(String(e && (e.message || e)).slice(0, 300)));
  const dom = new JSDOM(fs.readFileSync(ruta, 'utf8'), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://claude.ai/', virtualConsole: vc,
    beforeParse(w) {
      w.claude = { use: async (cap) => (cap === 'db' && DB) ? DB : (cap === 'user' && DB) ? USER : null };
      w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
      w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = function () {};
      w.navigator.clipboard = { writeText: async () => {} };
    },
  });
  await new Promise(r => setTimeout(r, 400));
  const doc = dom.window.document;
  const foto = () => {
    const c = doc.body.cloneNode(true);
    c.querySelectorAll('script,style' + (IGNORAR ? ',' + IGNORAR : '')).forEach(s => s.remove());
    return c.innerHTML.replace(/\s+/g, ' ');
  };
  const vistas = [...doc.querySelectorAll('[data-vista]')].filter(b => !(IGNORAR && b.matches(IGNORAR))).map(b => b.dataset.vista);
  const fotos = { inicio: foto() };
  for (const v of vistas) {
    const b = doc.querySelector(`[data-vista="${v}"]`); if (b) b.click();
    await new Promise(r => setTimeout(r, 60));
    fotos[v] = foto();
  }
  dom.window.close();
  return { fotos, errores, vistas };
}

(async () => {
  const a = await cargar(A), b = await cargar(B);
  console.log('vistas publicada:', a.vistas.join(','));
  console.log('vistas generada :', b.vistas.join(','));
  console.log('errores publicada:', a.errores.length, a.errores.slice(0, 3));
  console.log('errores generada :', b.errores.length, b.errores.slice(0, 3));
  let distintas = 0;
  for (const v of Object.keys(a.fotos)) {
    const x = a.fotos[v], y = b.fotos[v] || '';
    if (x === y) { console.log(`= ${v} (${x.length} car.)`); continue; }
    distintas++;
    let i = 0; while (i < x.length && x[i] === y[i]) i++;
    console.log(`≠ ${v}: publicada ${x.length} car., generada ${y.length} car.; primera diferencia en ${i}:`);
    console.log('   P: …' + x.slice(Math.max(0, i - 120), i + 160));
    console.log('   G: …' + y.slice(Math.max(0, i - 120), i + 160));
  }
  console.log(distintas ? `RESULTADO: ${distintas} vista(s) distinta(s)` : 'RESULTADO: todas las vistas pintan igual');
  process.exit(distintas ? 1 : 0);
})();
