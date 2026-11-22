// GENERADO POR build-consola.js (plugin Personal OS) — NO EDITAR A MANO.
// Fuente: las notas de riesgos/, compromisos/ y alcances/, la bitácora del día y config/consola-layout.json.
// Si algo está mal aquí, se corrige en la nota o en el layout y se vuelve a correr el build.
// DEMOSTRACIÓN con datos ficticios: se publica en la landing.
window.ESTADO = {
 "generado": "2026-11-22T01:03:29.337Z",
 "fecha": "2026-11-21",
 "hito": {
  "etiqueta": "Entrega Cliente A",
  "fecha": "2026-12-15"
 },
 "avisos": [],
 "NODES": [
  {
   "id": "brain",
   "label": "CEREBRO",
   "full": "Personal OS",
   "kind": "core",
   "scope": "both",
   "fx": 0.5,
   "fy": 0.5,
   "r": 15,
   "issues": ""
  },
  {
   "id": "CLA",
   "label": "CLIENTE A",
   "full": "Cliente A · plataforma principal",
   "scope": "laboral",
   "fx": 0.74,
   "fy": 0.26,
   "r": 12,
   "issues": "R-01 (nivel 3): riesgo · A-001 (nivel 3): alcance · R-04 (nivel 2): riesgo"
  },
  {
   "id": "CLB",
   "label": "CLIENTE B",
   "full": "Cliente B · integración",
   "scope": "laboral",
   "fx": 0.8,
   "fy": 0.66,
   "r": 10,
   "issues": "C-01 (nivel 3): espera a tercero · R-02 (nivel 2): riesgo"
  },
  {
   "id": "PROY",
   "label": "PROY",
   "full": "PROY · producto interno",
   "scope": "laboral",
   "fx": 0.6,
   "fy": 0.16,
   "r": 9,
   "issues": "R-03 (nivel 1): riesgo"
  },
  {
   "id": "TRANS",
   "label": "TRANSV",
   "full": "Transversal · lo que no cuelga de un solo cliente",
   "scope": "laboral",
   "fx": 0.86,
   "fy": 0.45,
   "r": 10,
   "issues": ""
  },
  {
   "id": "LADO",
   "label": "proyecto-lado",
   "full": "Proyecto personal",
   "scope": "personal",
   "fx": 0.26,
   "fy": 0.22,
   "r": 10,
   "issues": "C-04 (nivel 1): compromiso"
  },
  {
   "id": "CURSO",
   "label": "curso",
   "full": "Curso · certificación",
   "scope": "personal",
   "fx": 0.34,
   "fy": 0.7,
   "r": 11,
   "issues": "C-03 (nivel 2): compromiso"
  },
  {
   "id": "MOD1",
   "label": "Módulo 1",
   "full": "Curso · módulo 1",
   "scope": "personal",
   "parent": "CURSO",
   "fx": 0.2,
   "fy": 0.62,
   "r": 8,
   "issues": ""
  },
  {
   "id": "MOD2",
   "label": "Módulo 2",
   "full": "Curso · módulo 2",
   "scope": "personal",
   "parent": "CURSO",
   "fx": 0.22,
   "fy": 0.84,
   "r": 8,
   "issues": ""
  }
 ],
 "ITEMS": [
  {
   "id": "R-01",
   "cli": "CLA",
   "clase": "riesgo",
   "nivel": 3,
   "estado": "abierto",
   "tag": "riesgo",
   "label": "Alcance ampliado sin mover la fecha. Entraron dos puntos nuevos y la fecha sigue igual.",
  },
  {
   "id": "R-02",
   "cli": "CLB",
   "clase": "riesgo",
   "nivel": 2,
   "estado": "abierto",
   "tag": "riesgo",
   "label": "Dependencia externa sin confirmar. La API del tercero no tiene ambiente de pruebas.",
  },
  {
   "id": "R-03",
   "cli": "PROY",
   "clase": "riesgo",
   "nivel": 1,
   "estado": "abierto",
   "tag": "riesgo",
   "label": "Documentación del módulo atrasada. Dos semanas sin actualizar.",
  },
  {
   "id": "R-04",
   "cli": "CLA",
   "clase": "riesgo",
   "nivel": 2,
   "estado": "abierto",
   "tag": "riesgo",
   "label": "Prueba de carga pendiente. Sin fecha acordada con infraestructura.",
  },
  {
   "id": "C-01",
   "cli": "CLB",
   "clase": "compromiso",
   "nivel": 3,
   "fecha": "2026-11-19",
   "atraso": 2,
   "estado": "vencido hace 2 d (2026-11-19)",
   "tag": "espera a tercero",
   "label": "Certificación del cliente. Pedida hace 11 días.",
  },
  {
   "id": "C-02",
   "cli": "CLA",
   "clase": "compromiso",
   "nivel": 2,
   "fecha": "2026-11-24",
   "atraso": 0,
   "estado": "abierto",
   "tag": "compromiso",
   "label": "Enviar acta firmada. Acta de la sesión de validación.",
  },
  {
   "id": "C-03",
   "cli": "CURSO",
   "clase": "compromiso",
   "nivel": 2,
   "fecha": "2026-11-25",
   "atraso": 0,
   "estado": "abierto",
   "tag": "compromiso",
   "label": "Entregar el taller del módulo 2. Taller práctico.",
  },
  {
   "id": "C-04",
   "cli": "LADO",
   "clase": "compromiso",
   "nivel": 1,
   "fecha": null,
   "atraso": 0,
   "estado": "abierto",
   "tag": "compromiso",
   "label": "Publicar la versión del proyecto personal. Sin fecha todavía.",
  },
  {
   "id": "A-001",
   "cli": "CLA",
   "clase": "alcance",
   "nivel": 3,
   "estado": "entrega 2026-11-27 (en 5 háb.) · 1 punto(s) sin dueño",
   "fecha": "2026-11-27",
   "atraso": 0,
   "tag": "alcance",
   "label": "Ajustes del módulo de reportes (10 puntos). Diez puntos prometidos con fecha.",
  }
 ],
 "SINAPSIS": [
  {
   "t": "08:05",
   "scope": "laboral",
   "label": "Brief del día: #1 = entrega de reportes de Cliente A"
  },
  {
   "t": "09:40",
   "scope": "laboral",
   "label": "Reporte de pagos: el total pasó a una función; el modelo solo redacta"
  },
  {
   "t": "11:20",
   "scope": "personal",
   "label": "Curso: repaso del módulo 2 con ejercicios"
  },
  {
   "t": "14:10",
   "scope": "laboral",
   "label": "Revisión de PR contra sus criterios de aceptación"
  },
  {
   "t": "17:30",
   "scope": "laboral",
   "label": "El sueño semanal propuso 3 lecciones nuevas"
  }
 ],
 "PRIO": {
  "laboral": {
   "v": "A-001 · entrega de reportes",
   "note": "vence en 4 días hábiles",
   "fecha": "2026-11-21"
  },
  "ambas": {
   "v": "A-001 · entrega de reportes",
   "note": "vence en 4 días hábiles",
   "fecha": "2026-11-21"
  },
  "personal": {
   "v": "Curso · módulo 2",
   "note": "examen el viernes",
   "fecha": "2026-11-21"
  }
 },
 "CORTEZA": {
  "notas": [
   {
    "id": "CO-001",
    "titulo": "Lo que el código puede calcular no se le pregunta al modelo",
    "tema": "metodo",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 5,
    "aplica": [],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Lo que el código puede calcular no se le pregunta al modelo. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-030"
    ],
    "versiones": 0
   },
   {
    "id": "CO-002",
    "titulo": "Se verifica el artefacto, no el exit code",
    "tema": "metodo",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 6,
    "aplica": [],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Se verifica el artefacto, no el exit code. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-005",
     "CO-011"
    ],
    "versiones": 0
   },
   {
    "id": "CO-003",
    "titulo": "Antes de construir, nombrar la herramienta que ya existe",
    "tema": "metodo",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 3,
    "aplica": [],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Antes de construir, nombrar la herramienta que ya existe. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-042"
    ],
    "versiones": 1
   },
   {
    "id": "CO-004",
    "titulo": "No afirmar que algo no existe sin buscar en todas las fuentes",
    "tema": "metodo",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 4,
    "aplica": [],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "No afirmar que algo no existe sin buscar en todas las fuentes. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-030",
     "CO-017",
     "CO-002"
    ],
    "versiones": 0
   },
   {
    "id": "CO-005",
    "titulo": "Un síntoma en el destino no prueba dónde está la causa",
    "tema": "metodo",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 3,
    "aplica": [],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Un síntoma en el destino no prueba dónde está la causa. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-004",
     "CO-020"
    ],
    "versiones": 0
   },
   {
    "id": "CO-006",
    "titulo": "Una cifra se lee en su fuente",
    "tema": "metodo",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 5,
    "aplica": [],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Una cifra se lee en su fuente. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-029"
    ],
    "versiones": 0
   },
   {
    "id": "CO-007",
    "titulo": "Lo que puede fallar en silencio lleva testigo",
    "tema": "metodo",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 6,
    "aplica": [],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Lo que puede fallar en silencio lleva testigo. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-025"
    ],
    "versiones": 0
   },
   {
    "id": "CO-008",
    "titulo": "Una instrucción ambigua e irreversible se confirma antes",
    "tema": "metodo",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 6,
    "aplica": [],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Una instrucción ambigua e irreversible se confirma antes. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-029",
     "CO-036"
    ],
    "versiones": 0
   },
   {
    "id": "CO-009",
    "titulo": "Un error repetible se corrige en el mecanismo",
    "tema": "metodo",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 3,
    "aplica": [],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Un error repetible se corrige en el mecanismo. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-011",
     "CO-042",
     "CO-028"
    ],
    "versiones": 0
   },
   {
    "id": "CO-010",
    "titulo": "Un documento declara su lector y su propósito",
    "tema": "metodo",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 3,
    "aplica": [],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Un documento declara su lector y su propósito. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-017",
     "CO-008"
    ],
    "versiones": 0
   },
   {
    "id": "CO-011",
    "titulo": "Lo que ya existe se lee o se reutiliza, no se copia",
    "tema": "metodo",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 6,
    "aplica": [],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Lo que ya existe se lee o se reutiliza, no se copia. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-038",
     "CO-018"
    ],
    "versiones": 0
   },
   {
    "id": "CO-012",
    "titulo": "Se integra contra el contrato real",
    "tema": "metodo",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 3,
    "aplica": [],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Se integra contra el contrato real. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-038",
     "CO-020"
    ],
    "versiones": 0
   },
   {
    "id": "CO-013",
    "titulo": "Las dependencias apuntan al dominio",
    "tema": "arquitectura",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 7,
    "aplica": [
     "**/*.cs",
     "**/*.ts"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Las dependencias apuntan al dominio. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-024",
     "CO-027"
    ],
    "versiones": 0
   },
   {
    "id": "CO-014",
    "titulo": "Reglas de negocio fuera de los controladores",
    "tema": "arquitectura",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 4,
    "aplica": [
     "**/*.cs",
     "**/*.ts"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Reglas de negocio fuera de los controladores. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-022",
     "CO-015",
     "CO-021"
    ],
    "versiones": 1
   },
   {
    "id": "CO-015",
    "titulo": "Dependencias por constructor, como interfaz",
    "tema": "arquitectura",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 5,
    "aplica": [
     "**/*.cs",
     "**/*.ts"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Dependencias por constructor, como interfaz. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-023",
     "CO-042"
    ],
    "versiones": 0
   },
   {
    "id": "CO-016",
    "titulo": "Servicios externos detrás de una interfaz propia",
    "tema": "arquitectura",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 7,
    "aplica": [
     "**/*.cs",
     "**/*.ts"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Servicios externos detrás de una interfaz propia. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-015",
     "CO-032",
     "CO-012"
    ],
    "versiones": 0
   },
   {
    "id": "CO-017",
    "titulo": "Integraciones externas con reintentos y tiempo límite",
    "tema": "arquitectura",
    "nivel": "criterio",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 4,
    "aplica": [
     "**/*.cs",
     "**/*.ts"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Integraciones externas con reintentos y tiempo límite. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-007",
     "CO-029"
    ],
    "versiones": 0
   },
   {
    "id": "CO-018",
    "titulo": "Errores manejados en un solo punto",
    "tema": "backend",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 4,
    "aplica": [
     "**/*.cs",
     "**/*.py"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Errores manejados en un solo punto. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-007",
     "CO-031",
     "CO-029"
    ],
    "versiones": 0
   },
   {
    "id": "CO-019",
    "titulo": "Logs sin datos personales ni secretos",
    "tema": "backend",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 7,
    "aplica": [
     "**/*.cs",
     "**/*.py"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Logs sin datos personales ni secretos. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-008",
     "CO-024"
    ],
    "versiones": 0
   },
   {
    "id": "CO-020",
    "titulo": "Una homologación cruza por identificador estable",
    "tema": "backend",
    "nivel": "criterio",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 2,
    "aplica": [
     "**/*.cs",
     "**/*.py"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Una homologación cruza por identificador estable. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-011",
     "CO-003"
    ],
    "versiones": 0
   },
   {
    "id": "CO-021",
    "titulo": "Una hoja generada se verifica como la verá quien la recibe",
    "tema": "backend",
    "nivel": "criterio",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 6,
    "aplica": [
     "**/*.cs",
     "**/*.py"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Una hoja generada se verifica como la verá quien la recibe. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-031",
     "CO-016",
     "CO-020"
    ],
    "versiones": 0
   },
   {
    "id": "CO-022",
    "titulo": "Librerías de UI de terceros detrás de wrappers propios",
    "tema": "frontend",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 4,
    "aplica": [
     "**/*.ts",
     "**/*.html"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Librerías de UI de terceros detrás de wrappers propios. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-039",
     "CO-001",
     "CO-008"
    ],
    "versiones": 0
   },
   {
    "id": "CO-023",
    "titulo": "Un solo punto de acceso HTTP",
    "tema": "frontend",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 2,
    "aplica": [
     "**/*.ts",
     "**/*.html"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Un solo punto de acceso HTTP. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-035",
     "CO-034"
    ],
    "versiones": 0
   },
   {
    "id": "CO-024",
    "titulo": "Tipado estricto, sin any",
    "tema": "frontend",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 5,
    "aplica": [
     "**/*.ts",
     "**/*.html"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Tipado estricto, sin any. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-010",
     "CO-036"
    ],
    "versiones": 0
   },
   {
    "id": "CO-025",
    "titulo": "Nada se guarda hasta el botón Guardar",
    "tema": "frontend",
    "nivel": "criterio",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 2,
    "aplica": [
     "**/*.ts",
     "**/*.html"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Nada se guarda hasta el botón Guardar. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-021"
    ],
    "versiones": 0
   },
   {
    "id": "CO-026",
    "titulo": "Una vista de planeación solo afirma lo que dicen sus datos",
    "tema": "frontend",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 5,
    "aplica": [
     "**/*.ts",
     "**/*.html"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Una vista de planeación solo afirma lo que dicen sus datos. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-025",
     "CO-032",
     "CO-009"
    ],
    "versiones": 0
   },
   {
    "id": "CO-027",
    "titulo": "Consultas siempre parametrizadas",
    "tema": "seguridad",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 7,
    "aplica": [
     "**/*.cs",
     "**/*.ts",
     "**/*.py"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Consultas siempre parametrizadas. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-020",
     "CO-012"
    ],
    "versiones": 0
   },
   {
    "id": "CO-028",
    "titulo": "Los secretos nunca van en el código",
    "tema": "seguridad",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 3,
    "aplica": [
     "**/*.cs",
     "**/*.ts",
     "**/*.py"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Los secretos nunca van en el código. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-043",
     "CO-023",
     "CO-034"
    ],
    "versiones": 0
   },
   {
    "id": "CO-029",
    "titulo": "Nunca datos reales de personas en pruebas",
    "tema": "seguridad",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 7,
    "aplica": [
     "**/*.cs",
     "**/*.ts",
     "**/*.py"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Nunca datos reales de personas en pruebas. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-043",
     "CO-035",
     "CO-036"
    ],
    "versiones": 0
   },
   {
    "id": "CO-030",
    "titulo": "Las personas se identifican por su cuenta, no por su nombre",
    "tema": "seguridad",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 4,
    "aplica": [
     "**/*.cs",
     "**/*.ts",
     "**/*.py"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Las personas se identifican por su cuenta, no por su nombre. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-002"
    ],
    "versiones": 0
   },
   {
    "id": "CO-031",
    "titulo": "Permisos verificados en el servidor, no en la pantalla",
    "tema": "seguridad",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 5,
    "aplica": [
     "**/*.cs",
     "**/*.ts",
     "**/*.py"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Permisos verificados en el servidor, no en la pantalla. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-015",
     "CO-037",
     "CO-029"
    ],
    "versiones": 1
   },
   {
    "id": "CO-032",
    "titulo": "Instantes con zona; fechas de calendario sin hora",
    "tema": "bd",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 2,
    "aplica": [
     "**/*.sql"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Instantes con zona; fechas de calendario sin hora. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-007"
    ],
    "versiones": 0
   },
   {
    "id": "CO-033",
    "titulo": "Scripts idempotentes con su reversa",
    "tema": "bd",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 2,
    "aplica": [
     "**/*.sql"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Scripts idempotentes con su reversa. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-011"
    ],
    "versiones": 0
   },
   {
    "id": "CO-034",
    "titulo": "Un script, un objeto, un cambio",
    "tema": "bd",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 2,
    "aplica": [
     "**/*.sql"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Un script, un objeto, un cambio. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-023",
     "CO-006",
     "CO-032"
    ],
    "versiones": 0
   },
   {
    "id": "CO-035",
    "titulo": "Antes de migrar, se compara contra lo que corre",
    "tema": "bd",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 4,
    "aplica": [
     "**/*.sql"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Antes de migrar, se compara contra lo que corre. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-030",
     "CO-020",
     "CO-021"
    ],
    "versiones": 0
   },
   {
    "id": "CO-036",
    "titulo": "Una regla sobre datos se apoya en su distribución medida",
    "tema": "bd",
    "nivel": "criterio",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 3,
    "aplica": [
     "**/*.sql"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Una regla sobre datos se apoya en su distribución medida. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-038",
     "CO-012",
     "CO-031"
    ],
    "versiones": 0
   },
   {
    "id": "CO-037",
    "titulo": "Tablas vivas e históricas separadas por su frontera",
    "tema": "bd",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 3,
    "aplica": [
     "**/*.sql"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Tablas vivas e históricas separadas por su frontera. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-034",
     "CO-012"
    ],
    "versiones": 0
   },
   {
    "id": "CO-038",
    "titulo": "Un verificador se prueba con casos de control",
    "tema": "pruebas",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 3,
    "aplica": [
     "**/*.spec.ts",
     "**/*Tests.cs"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Un verificador se prueba con casos de control. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-004"
    ],
    "versiones": 0
   },
   {
    "id": "CO-039",
    "titulo": "Un PR se juzga contra sus criterios de aceptación",
    "tema": "pruebas",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 6,
    "aplica": [
     "**/*.spec.ts",
     "**/*Tests.cs"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Un PR se juzga contra sus criterios de aceptación. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-017"
    ],
    "versiones": 0
   },
   {
    "id": "CO-040",
    "titulo": "Lo que escriben otros se normaliza; lo ilegible se denuncia",
    "tema": "entorno",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 2,
    "aplica": [
     "**/*.ps1",
     "**/*.js"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Lo que escriben otros se normaliza; lo ilegible se denuncia. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-015"
    ],
    "versiones": 0
   },
   {
    "id": "CO-041",
    "titulo": "En Windows, los builds van por PowerShell",
    "tema": "entorno",
    "nivel": "criterio",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 3,
    "aplica": [
     "**/*.ps1",
     "**/*.js"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "En Windows, los builds van por PowerShell. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-021",
     "CO-023",
     "CO-043"
    ],
    "versiones": 0
   },
   {
    "id": "CO-042",
    "titulo": "Rutas de servicio entre comillas",
    "tema": "entorno",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 2,
    "aplica": [
     "**/*.ps1",
     "**/*.js"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Rutas de servicio entre comillas. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-021",
     "CO-031"
    ],
    "versiones": 0
   },
   {
    "id": "CO-043",
    "titulo": "Antes de documentar un repositorio, primero fetch",
    "tema": "git",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 4,
    "aplica": [
     "**/.gitignore"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Antes de documentar un repositorio, primero fetch. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-040",
     "CO-018"
    ],
    "versiones": 0
   },
   {
    "id": "CO-044",
    "titulo": "Operaciones sobre repos ajenos: simuladas y respaldadas",
    "tema": "git",
    "nivel": "duro",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 2,
    "aplica": [
     "**/.gitignore"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Operaciones sobre repos ajenos: simuladas y respaldadas. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-027",
     "CO-001",
     "CO-024"
    ],
    "versiones": 0
   },
   {
    "id": "CO-045",
    "titulo": "En trabajo paralelo, push por subtarea",
    "tema": "git",
    "nivel": "criterio",
    "estado": "vigente",
    "procedencia": "confirmada",
    "casos": 5,
    "aplica": [
     "**/.gitignore"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "En trabajo paralelo, push por subtarea. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-020"
    ],
    "versiones": 0
   }
  ],
  "propuestas": [
   {
    "id": "CO-101",
    "titulo": "Una exclusión que no coincide aborta",
    "tema": "entorno",
    "nivel": "duro",
    "estado": "propuesta",
    "procedencia": "confirmada",
    "casos": 5,
    "aplica": [
     "**/*.ps1",
     "**/*.js"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Una exclusión que no coincide aborta. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-021",
     "CO-016",
     "CO-019"
    ]
   },
   {
    "id": "CO-102",
    "titulo": "Lo capturado que no llegó se denuncia",
    "tema": "metodo",
    "nivel": "duro",
    "estado": "propuesta",
    "procedencia": "confirmada",
    "casos": 3,
    "aplica": [],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Lo capturado que no llegó se denuncia. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-015",
     "CO-021",
     "CO-033"
    ]
   },
   {
    "id": "CO-103",
    "titulo": "Commit por nombre de archivo con sesiones en paralelo",
    "tema": "git",
    "nivel": "duro",
    "estado": "propuesta",
    "procedencia": "confirmada",
    "casos": 5,
    "aplica": [
     "**/.gitignore"
    ],
    "fuentes": 1,
    "creado": "2026-11-21",
    "aprobada": "",
    "regla": "Commit por nombre de archivo con sesiones en paralelo. (Lección de ejemplo de la demostración: en tu corteza aquí va tu regla completa, accionable y verificable.)",
    "porque": "Cada lección nace de casos reales de tu bitácora; el porqué es lo que permite aplicarla bien en otro contexto.",
    "noAplica": "Las excepciones también se anotan, para no aplicarla a ciegas.",
    "enlaces": [
     "CO-043",
     "CO-004"
    ]
   }
  ],
  "semanas": 18,
  "ultimaSemana": "2026-W47",
  "validacion": ""
 },
 "CONTROL": [
  {
   "id": "nucleo",
   "label": "Núcleo de la empresa",
   "detalle": "Reglas obligatorias de la organización, inyectadas al arrancar.",
   "soloEmpresa": true,
   "activo": true
  },
  {
   "id": "correo",
   "label": "Vigía de correo",
   "detalle": "Buzón sin barrer, buzón ajeno y urgentes abiertos.",
   "soloEmpresa": true,
   "activo": true
  },
  {
   "id": "reglas",
   "label": "Vigía de reglas",
   "detalle": "Políticas nuevas de la organización sin registrar.",
   "soloEmpresa": true,
   "activo": true
  },
  {
   "id": "reunion",
   "label": "Detector de reuniones",
   "detalle": "Reuniones del día sin preparar.",
   "soloEmpresa": true,
   "activo": true
  },
  {
   "id": "compromisos",
   "label": "Vigía de compromisos",
   "detalle": "Cada sesión ve solo los alcances de su ámbito.",
   "soloEmpresa": false,
   "activo": true
  },
  {
   "id": "guardia",
   "label": "Guardia de producción",
   "detalle": "Bloquea producción, ramas protegidas y escrituras en BD en TODAS las sesiones.",
   "soloEmpresa": false,
   "activo": true
  },
  {
   "id": "buscar",
   "label": "Buscar antes de negar",
   "detalle": "Nunca «no existe» sin barrer todas las fuentes.",
   "soloEmpresa": false,
   "activo": true
  }
 ],
 "AMBITOS": [
  "laboral",
  "personal",
  "universidad"
 ]
};
