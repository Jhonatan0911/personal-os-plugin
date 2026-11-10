# Anclas por eje, esquema y volumetría

## Índice
1. Anclas por nivel (cómo calificar cada eje)
2. Qué cuenta como evidencia
3. Esquema de `modulos.json`
4. Índice y nivel (lo calcula el script)
5. Cómo lo usan las otras piezas
6. Volumetría en staging (solo con OK por consulta)

Base: Business Impact Analysis (ISO 22301 / ISO/TS 22317) para calificar el módulo una vez;
AMFE (IEC 60812) para los modos de falla de los módulos con algún eje ≥ 4; pruebas basadas en
riesgo (ISO/IEC/IEEE 29119) para decidir la profundidad de la regresión.

## 1. Anclas por nivel

Más alto = más crítico en los cinco ejes (en reversibilidad, 5 = irreversible). Si dudas entre dos
niveles, elige el que la evidencia sostiene, no el que suena prudente; la duda va en el texto.

| Eje | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **Transaccionalidad** (volumen y frecuencia) | Uso ocasional (configuración, reportes mensuales) | Decenas de operaciones al día | Cientos al día o un paso de un flujo diario | Interviene en cada atención o cita | Operación central de mayor volumen; miles al día o picos que tumban el servicio |
| **Dinero** | No toca cobro ni facturación | Muestra valores ya calculados | Dispara o condiciona un cobro sin calcularlo | Calcula, cobra o define quién paga | Si falla no se factura, no se radica o se pierde el pago (FEV, RIPS, soportes, pasarela) |
| **Norma** | Sin norma aplicable | Regla contractual o de un proveedor | Trata datos personales (habeas data) sin ser registro clínico | Alimenta campos regulados o trata datos sensibles de salud | Es el objeto directo de una norma vigente (historia clínica, RIPS/FEV, exportación masiva de datos sensibles) |
| **Usuarios** (concurrencia y tiempo de atención) | Lo usa una persona de vez en cuando | Un área pequeña | Varias áreas, sin paciente esperando | Bloquea a un rol completo o tiene pacientes esperando | Si cae o se pone lento, se detiene la atención (nadie entra o la consulta se retrasa) |
| **Reversibilidad** | Se deshace solo o con un clic | Se corrige con un ajuste interno sin efecto externo | Se corrige con trabajo manual o datos de respaldo | Solo se corrige con nota, anulación o el tercero (DIAN, pasarela, EPS) | Irreversible: registro clínico cerrado, mensaje enviado al paciente, plazo legal vencido |

Normas: cita la regla de la tabla viva de normas (`<stateDir>/criticidad/normas.json`) si existe; si la
norma no está ahí, el eje queda en null con «por validar: norma no verificada».

## 2. Qué cuenta como evidencia

- Sirve: documentación funcional, base de conocimiento por repo (dependencias, contratos), guías de
  regresión, notas de alcance o riesgo, investigación de normas, decisiones y lo que el líder dijo
  textualmente (cítalo como «el líder lo declaró» con la fuente donde quedó escrito).
- No sirve: «suena crítico», el nombre del módulo, que el frente sea grande o que vaya atrasado
  (eso es riesgo del proyecto, no criticidad del módulo; va como `eje: "general"`).
- Cada entrada: `{"eje", "texto", "fuente"}`. `fuente` es archivo + sección o línea. Un valor sin
  fuente es un error del script. Un null lleva `"texto": "por validar: <qué falta>"` y `"fuente": ""`.

## 3. Esquema de `modulos.json`

```json
{
  "version": 1, "actualizado": "AAAA-MM-DD",
  "pesos": {"transaccionalidad": 1, "dinero": 1, "norma": 1, "usuarios": 1, "reversibilidad": 1},
  "modulos": [{
    "id": "slug", "modulo": "Nombre", "descripcion": "Qué hace, en una línea",
    "frentes": ["clave del diccionario de frentes"], "repos": ["repo"],
    "ejes": {"transaccionalidad": 1-5|null, "dinero": …, "norma": …, "usuarios": …, "reversibilidad": …},
    "evidencia": [{"eje": "dinero|…|general", "texto": "", "fuente": ""}],
    "volumetria": {"tablas_candidatas": [{"tabla": "", "columna_fecha": null, "base": "", "nota": ""}],
                   "mediciones": [{"tabla": "", "ventana": "30d", "filas": 0, "ambiente": "staging",
                                   "fecha": "AAAA-MM-DD", "ok_lider": "fecha y frase del OK"}]},
    "validado_por_lider": false, "validado_el": null, "fecha": "AAAA-MM-DD"
  }]
}
```

`pesos` es opcional (1 por defecto). Cambiarlo es decisión del líder, no de la skill.

## 4. Índice y nivel

- **Índice** = 100 × Σ(peso·valor) ÷ Σ(peso·5) sobre los ejes calificados. Con menos de 3 ejes no hay
  índice: el promedio de un solo 5 daría 100 y engañaría.
- **Rango** = índice con los huecos en 1 y en 5: muestra cuánto puede moverse al llenarlos.
- **Nivel:** crítico (dos o más ejes en 5, o índice ≥ 80) · alto (un 5 o ≥ 60) · medio (un 4 o ≥ 40) ·
  bajo · por calificar (menos de 3 ejes).
- **Mini-AMFE:** obligatorio si algún eje vale ≥ 4.
- **Varios módulos en un cambio:** el peor valor por eje, no el promedio (`--modulos a,b`).

## 5. Cómo lo usan las otras piezas

| Pieza | Qué toma | Regla |
|---|---|---|
| Ficha de impacto (planear-sprint) | `--modulos <ids> --json` → `impacto.criticidad_modulo` del expediente | Si algún módulo no está validado, la ficha lo dice; no se presenta como dato firme |
| Refutador del requerimiento | Ejes norma, dinero y reversibilidad | Un cambio que degrada un eje ≥ 4 necesita alternativa y costo explícitos |
| Regresión / revisión funcional | Nivel | crítico → flujos de punta a punta + modos de falla del AMFE; alto → flujos del módulo; medio → humo; bajo → unitarias |
| Revisión de PR | Nivel y ejes | Módulo crítico: script de BD con rollback, pruebas y revisión de rendimiento si usuarios ≥ 4 |

## 6. Volumetría en staging (solo con OK por consulta)

La volumetría vuelve medible el eje de transaccionalidad. **La skill propone; nunca ejecuta sola.**

1. Saca las tablas candidatas de la base de conocimiento del repo (sección de datos) o de las guías de
   regresión, con su columna de fecha. Anótalas en `volumetria.tablas_candidatas`.
2. Genera el texto de las consultas con `criticidad.py --volumetria <id>`: solo `COUNT_BIG(*)` por
   ventana de fechas, nada de columnas con datos de personas.
3. Por **cada** consulta, muestra al líder el comando exacto y el servidor + base destino (con el modo
   de simulación del wrapper de solo lectura del proyecto) y **espera su OK explícito en esa
   conversación**. Un OK anterior, aunque sea de una consulta idéntica, no vale. Sin wrapper de lectura
   no se consulta: se propone cómo hacerlo.
4. Solo bases de pruebas o staging, solo lectura. Nunca producción. Nunca se imprimen cadenas de
   conexión ni credenciales.
5. Registra cada resultado en `volumetria.mediciones` con `ambiente`, `fecha` y `ok_lider`; el script
   rechaza mediciones sin esos campos. Recalifica el eje con el ancla y cita la medición como fuente.
