#!/usr/bin/env node
/*
 * Genera la consola de DEMOSTRACIÓN de la landing con el build REAL del plugin y datos ficticios.
 *
 * No hay una consola «de mentira»: se arma un estado y una corteza de ejemplo en una carpeta temporal,
 * se corre scripts/build-consola.js contra ellos y se copia el resultado a demo/. Así la landing muestra
 * exactamente lo que el usuario ve con /consola, sin un solo dato real.
 *
 *   node demo/generar.js        → demo/consola.html + demo/_datos/datos.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-demo-'));
const HOME = path.join(TMP, 'home'), EST = path.join(TMP, 'estado'), CO = path.join(TMP, 'conocimiento');
for (const d of [HOME, EST, CO, path.join(CO, '_propuestas'), path.join(CO, '_historial'), path.join(EST, 'config'),
  path.join(EST, 'riesgos'), path.join(EST, 'compromisos'), path.join(EST, 'alcances'), path.join(EST, 'bitacora'), path.join(EST, '_datos')]) {
  fs.mkdirSync(d, { recursive: true });
}
const pad = (n) => String(n).padStart(2, '0');
const d = new Date(); const HOY = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const masDias = (n) => { const x = new Date(d); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const w = (p, t) => fs.writeFileSync(p, t, 'utf8');

// ---------- configuración y control
w(path.join(HOME, 'config.json'), JSON.stringify({
  stateDir: EST,
  ambitos: { carpetas: { laboral: ['C:/Empresa'], personal: ['C:/Personal'], universidad: ['C:/Personal/U'] } },
  conocimiento: { dir: CO },
}, null, 2));
w(path.join(HOME, 'nucleo-empresa.md'), '# Núcleo de ejemplo\n');
fs.copyFileSync(path.join(RAIZ, 'plugins/personal-os/plantillas/consola-layout.json'), path.join(EST, 'config', 'consola-layout.json'));
w(path.join(EST, '_datos', 'prioridad.json'), JSON.stringify({
  laboral: { v: 'A-001 · entrega de reportes', note: 'vence en 4 días hábiles' },
  ambas: { v: 'A-001 · entrega de reportes', note: 'vence en 4 días hábiles' },
  personal: { v: 'Curso · módulo 2', note: 'examen el viernes' },
}));

// ---------- estado de ejemplo (mapa, tarjetas, bitácora)
const nota = (dir, id, fm, cuerpo) => w(path.join(EST, dir, `${id}.md`),
  `---\nid: ${id}\n${Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n# ${fm.titulo || id}\n\n${cuerpo}\n`);
nota('riesgos', 'R-01', { titulo: 'Alcance ampliado sin mover la fecha', proyecto: 'Cliente A', nivel: 3, estado: 'abierto' }, 'Entraron dos puntos nuevos y la fecha sigue igual.');
nota('riesgos', 'R-02', { titulo: 'Dependencia externa sin confirmar', proyecto: 'Cliente B', nivel: 2, estado: 'abierto' }, 'La API del tercero no tiene ambiente de pruebas.');
nota('riesgos', 'R-03', { titulo: 'Documentación del módulo atrasada', proyecto: 'PROY', nivel: 1, estado: 'abierto' }, 'Dos semanas sin actualizar.');
nota('riesgos', 'R-04', { titulo: 'Prueba de carga pendiente', proyecto: 'Cliente A', nivel: 2, estado: 'abierto' }, 'Sin fecha acordada con infraestructura.');
nota('compromisos', 'C-01', { titulo: 'Certificación del cliente', proyecto: 'Cliente B', fecha_limite: masDias(-2), estado: 'abierto_en_espera_de_tercero', direccion: 'tercero' }, 'Pedida hace 11 días.');
nota('compromisos', 'C-02', { titulo: 'Enviar acta firmada', proyecto: 'Cliente A', fecha_limite: masDias(3), estado: 'abierto' }, 'Acta de la sesión de validación.');
nota('compromisos', 'C-03', { titulo: 'Entregar el taller del módulo 2', proyecto: 'curso', fecha_limite: masDias(4), estado: 'abierto' }, 'Taller práctico.');
nota('compromisos', 'C-04', { titulo: 'Publicar la versión del proyecto personal', proyecto: 'proyecto-lado', fecha_limite: 'null', estado: 'abierto' }, 'Sin fecha todavía.');
nota('alcances', 'A-001', { titulo: 'Ajustes del módulo de reportes (10 puntos)', cliente: 'Cliente A', fecha_entrega: masDias(6), estado: 'activo', puntos_sin_responsable: 1 }, 'Diez puntos prometidos con fecha.');
w(path.join(EST, 'bitacora', `${HOY}.md`), [
  '## 08:05', '- **OS:** Brief del día: #1 = entrega de reportes de Cliente A', '## 09:40',
  '- **OS:** Reporte de pagos: el total pasó a una función; el modelo solo redacta', '## 11:20',
  '- **OS:** Curso: repaso del módulo 2 con ejercicios', '## 14:10', '- **OS:** Revisión de PR contra sus criterios de aceptación',
  '## 17:30', '- **OS:** El sueño semanal propuso 3 lecciones nuevas', ''].join('\n'));

// ---------- corteza de ejemplo
let sd = 5; const rnd = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
const T = {
  metodo: ['Lo que el código puede calcular no se le pregunta al modelo', 'Se verifica el artefacto, no el exit code', 'Antes de construir, nombrar la herramienta que ya existe',
    'No afirmar que algo no existe sin buscar en todas las fuentes', 'Un síntoma en el destino no prueba dónde está la causa', 'Una cifra se lee en su fuente',
    'Lo que puede fallar en silencio lleva testigo', 'Una instrucción ambigua e irreversible se confirma antes', 'Un error repetible se corrige en el mecanismo',
    'Un documento declara su lector y su propósito', 'Lo que ya existe se lee o se reutiliza, no se copia', 'Se integra contra el contrato real'],
  arquitectura: ['Las dependencias apuntan al dominio', 'Reglas de negocio fuera de los controladores', 'Dependencias por constructor, como interfaz',
    'Servicios externos detrás de una interfaz propia', 'Integraciones externas con reintentos y tiempo límite*'],
  backend: ['Errores manejados en un solo punto', 'Logs sin datos personales ni secretos', 'Una homologación cruza por identificador estable*', 'Una hoja generada se verifica como la verá quien la recibe*'],
  frontend: ['Librerías de UI de terceros detrás de wrappers propios', 'Un solo punto de acceso HTTP', 'Tipado estricto, sin any', 'Nada se guarda hasta el botón Guardar*', 'Una vista de planeación solo afirma lo que dicen sus datos'],
  seguridad: ['Consultas siempre parametrizadas', 'Los secretos nunca van en el código', 'Nunca datos reales de personas en pruebas', 'Las personas se identifican por su cuenta, no por su nombre', 'Permisos verificados en el servidor, no en la pantalla'],
  bd: ['Instantes con zona; fechas de calendario sin hora', 'Scripts idempotentes con su reversa', 'Un script, un objeto, un cambio', 'Antes de migrar, se compara contra lo que corre',
    'Una regla sobre datos se apoya en su distribución medida*', 'Tablas vivas e históricas separadas por su frontera'],
  pruebas: ['Un verificador se prueba con casos de control', 'Un PR se juzga contra sus criterios de aceptación'],
  entorno: ['Lo que escriben otros se normaliza; lo ilegible se denuncia', 'En Windows, los builds van por PowerShell*', 'Rutas de servicio entre comillas'],
  git: ['Antes de documentar un repositorio, primero fetch', 'Operaciones sobre repos ajenos: simuladas y respaldadas', 'En trabajo paralelo, push por subtarea*'],
};
const GLOBS = { arquitectura: '["**/*.cs", "**/*.ts"]', backend: '["**/*.cs", "**/*.py"]', frontend: '["**/*.ts", "**/*.html"]', seguridad: '["**/*.cs", "**/*.ts", "**/*.py"]',
  bd: '["**/*.sql"]', pruebas: '["**/*.spec.ts", "**/*Tests.cs"]', entorno: '["**/*.ps1", "**/*.js"]', git: '["**/.gitignore"]', metodo: '[]' };
let n = 1; const ids = [];
for (const [tema, lista] of Object.entries(T)) for (const t of lista) { ids.push({ id: `CO-${String(n).padStart(3, '0')}`, tema, t }); n++; }
const escribirNota = (dir, x, estado) => {
  const crit = x.t.endsWith('*'), titulo = x.t.replace(/\*$/, '');
  const enl = [...new Set([0, 1, 2].map(() => ids[Math.floor(rnd() * ids.length)].id))].filter((e) => e !== x.id).slice(0, 1 + Math.floor(rnd() * 3));
  w(path.join(dir, `${x.id}.md`), `---\nid: ${x.id}\ntitulo: "${titulo}"\ntema: ${x.tema}\naplica_a: ${GLOBS[x.tema]}\nnivel: ${crit ? 'criterio' : 'duro'}\n`
    + `procedencia: confirmada\nfuentes: ["bitácora de ejemplo"]\nestado: ${estado}\ncreado: ${HOY}\ncasos: ${2 + Math.floor(rnd() * 6)}\n---\n`
    + `**Regla.** ${titulo}. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)\n\n`
    + `**Por qué.** Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.\n\n`
    + `**Cuándo no aplica.** Las excepciones también se anotan, para no aplicarla a ciegas.\n\n**Ver también.** ${enl.map((e) => `[[${e}]]`).join(' ')}\n`);
};
ids.forEach((x) => escribirNota(CO, x, 'vigente'));
['CO-003', 'CO-014', 'CO-031'].forEach((id) => w(path.join(CO, '_historial', `${id}.anterior.md`), 'versión anterior\n'));
[{ id: 'CO-101', tema: 'entorno', t: 'Una exclusión que no coincide aborta' }, { id: 'CO-102', tema: 'metodo', t: 'Lo capturado que no llegó se denuncia' },
  { id: 'CO-103', tema: 'git', t: 'Commit por nombre de archivo con sesiones en paralelo' }].forEach((x) => escribirNota(path.join(CO, '_propuestas'), x, 'propuesta'));
for (let s = 30; s <= 47; s++) w(path.join(EST, 'bitacora', `resumen-${d.getFullYear()}-W${s}.md`), '# resumen\n');

// ---------- build real y copia a demo/
execFileSync(process.execPath, [path.join(RAIZ, 'plugins/personal-os/scripts/build-consola.js'), '--config-dir', path.join(EST, 'config')],
  { env: { ...process.env, PERSONAL_OS_HOME: HOME }, stdio: 'inherit' });
const OUT = __dirname;
fs.mkdirSync(path.join(OUT, '_datos'), { recursive: true });
// La demo no caduca: el pie no debe decir «datos de otro día» cuando alguien la abra la semana que viene.
const html = fs.readFileSync(path.join(EST, 'consola.html'), 'utf8')
  .replace("(E.fecha!==hoy", "(false")
  .replace('<title>Personal OS — Consola Neuronal</title>', '<title>Personal OS — Consola Neuronal (demostración)</title>')
  .replace(/<meta name="comando-build" content="[^"]*">/, '<meta name="comando-build" content="/consola">')
  .replace('Vista local · derivada del estado · nunca publicada', 'Demostración · estado de ejemplo, sin datos reales')
  .replace("'datos de hoy · '+esc(E.fecha)", "'datos de ejemplo'");
fs.writeFileSync(path.join(OUT, 'consola.html'), html, 'utf8');
const datos = fs.readFileSync(path.join(EST, '_datos', 'datos.js'), 'utf8')
  .split(TMP.replace(/\\/g, '\\\\')).join('<demo>').split(TMP).join('<demo>');
fs.writeFileSync(path.join(OUT, '_datos', 'datos.js'), datos.replace('ARCHIVO PRIVADO: no se publica ni se sube a ningún servicio.', 'DEMOSTRACIÓN con datos ficticios: se publica en la landing.'), 'utf8');
fs.rmSync(TMP, { recursive: true, force: true });
console.log('\nDemo escrita en', OUT);
