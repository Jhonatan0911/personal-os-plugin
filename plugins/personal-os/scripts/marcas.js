#!/usr/bin/env node
// marcas.js — el registro de marcas del Personal OS desde la línea de comandos (lo usan la consola y las skills).
//
//   node marcas.js --estado                       JSON: marcas (con su ámbito), predeterminadas y referencias
//   node marcas.js --elegir --ambito laboral|personal
//        Para quien genera un documento o artefacto: { predeterminada, preguntar, opciones }. Si `preguntar` es true,
//        se pregunta al usuario en el modal mostrando TODAS las opciones con la `predeterminada` marcada.
//   node marcas.js --obtener <id>                 la marca completa con rutas absolutas de logo, marca de agua e ícono
//   node marcas.js --referencias                  paletas de referencia para crear una marca
//   node marcas.js --desde-referencia <id> --ambito laboral|personal
//   node marcas.js --desbloquear                  lee un código de acceso (stdin, o lo pide sin mostrarlo) y agrega la
//                                                 marca protegida que abra (plantillas/marcas-protegidas/*.marca)
//   node marcas.js --empaquetar <id> --salida <archivo.marca>    cifra una marca con un código (stdin) para repartirla
//
// Todas aceptan --config-dir <carpeta> (por defecto, la del Personal OS). El código nunca va como argumento.
'use strict';

const fs = require('fs');
const C = require('./lib/comun');
const M = require('./lib/marcas');

const salir = (msg) => { console.error('ERROR: ' + msg); process.exit(1); };
const tiene = (f) => process.argv.includes(f);
const imprimir = (o) => console.log(JSON.stringify(o));

function leerCodigo() {
  if (!process.stdin.isTTY) { try { return fs.readFileSync(0, 'utf8').split(/\r?\n/)[0]; } catch { return ''; } }
  process.stdout.write('Código de acceso: ');
  const buf = Buffer.alloc(8); let s = '';
  try { process.stdin.setRawMode(true); } catch { /* sin modo crudo */ }
  for (;;) {
    let n = 0; try { n = fs.readSync(0, buf, 0, 1, null); } catch { break; }
    if (!n) break;
    const ch = buf.toString('utf8', 0, n);
    if (ch === '\r' || ch === '\n') break;
    if (ch === '\u0003') { process.stdout.write('\n'); process.exit(1); }
    if (ch === '\u007f' || ch === '\b') s = s.slice(0, -1); else s += ch;
  }
  try { process.stdin.setRawMode(false); } catch { /* nada */ }
  process.stdout.write('\n');
  return s;
}

try {
  if (tiene('--estado')) {
    const d = M.leer();
    imprimir({ ok: true, existe: !!d, ruta: M.rutas().marcas, predeterminadas: d ? d.predeterminadas : { laboral: null, personal: null }, marcas: M.lista(d), referencias: M.referencias() });
  } else if (tiene('--elegir')) {
    imprimir(Object.assign({ ok: true }, M.elegir(C.arg('--ambito', 'laboral'))));
  } else if (tiene('--obtener')) {
    const m = M.obtener(C.arg('--obtener'));
    if (!m) salir('esa marca no existe');
    imprimir(Object.assign({ ok: true }, m));
  } else if (tiene('--referencias')) {
    imprimir({ ok: true, referencias: M.referencias() });
  } else if (tiene('--desde-referencia')) {
    const r = M.desdeReferencia(C.arg('--desde-referencia'), C.arg('--ambito', 'laboral'));
    imprimir(Object.assign({ ok: true }, r));
  } else if (tiene('--desbloquear')) {
    const r = M.desbloquear(leerCodigo());
    if (!r) salir('el código no abre ninguna marca');
    imprimir(Object.assign({ ok: true }, r));
  } else if (tiene('--empaquetar')) {
    const id = C.arg('--empaquetar'), salida = C.arg('--salida');
    if (!id || !salida) salir('uso: --empaquetar <id> --salida <archivo.marca> (el código por stdin)');
    M.empaquetar(id, leerCodigo(), salida);
    console.log(`Empaquetada '${id}' en ${salida}. El código no se guarda en ninguna parte.`);
  } else {
    console.log('Uso: node marcas.js --estado | --elegir --ambito <laboral|personal> | --obtener <id> | --referencias | --desde-referencia <id> --ambito <a> | --desbloquear | --empaquetar <id> --salida <archivo>');
  }
} catch (e) { salir(e.message); }
