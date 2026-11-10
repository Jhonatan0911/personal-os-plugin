# Niveles de caso y adaptación del flujo por célula

Léelo cuando `flujo.niveles_activos` sea `true` en `<stateDir>/config/fuentes.yaml`, o cuando otra skill
del flujo (revisar-pr, certificar-funcional, la Worklist, el vigía) necesite saber qué pasos recorre un caso.
Es el **contrato común**: todas las piezas leen la misma sección `flujo` y el mismo campo `nivel` del expediente.

## 1. Para qué

No todo caso merece el flujo completo. Un trámite (una plantilla, una carga, unificar un paciente) toma
minutos del líder; un requerimiento con norma y dinero toma horas. Cada célula decide **qué pasos recorre
cada nivel y en qué versión**, sin copiar el flujo de otra. Sin la sección `flujo`, o con
`niveles_activos: false`, todo caso es del nivel por defecto (el completo) y nada cambia.

## 2. Configuración (`fuentes.yaml` → `flujo`)

```yaml
flujo:
  niveles_activos: false          # false: todo caso recorre el flujo completo (nivel_por_defecto)
  nivel_por_defecto: "C"
  niveles:
    A:
      nombre: "Trámite o configuración"
      minutos_lider: "10-15"
      ejemplos: "plantilla de mensajería, carga de datos, unificación de registros"
      pasos: { p0: corto, p5: evidencia }
    B:
      nombre: "Bug o incidente"
      minutos_lider: "30-60"
      pasos: { p0: corto, p1: corto, p4: ia_y_humana, p5: evidencia, p6: corto }
    C:
      nombre: "Requerimiento o proyecto"
      minutos_lider: "120-180 al inicio + cortes"
      pasos: { p0: completo, p1: completo, p2: completo, p3: completo, p4: completo, p5: matriz, p6: completo }
  clasifica: "lider"              # quién pone el nivel: lider | analista (el líder siempre puede cambiarlo)
  paso0:
    quien_llena: "lider"          # lider | analista: quién llena la ficha del paso 0
    analistas: []                 # [{ nombre: "<corto>", clientes: ["<Cliente>"] }] para sugerir quién la llena
  refutador:
    completo_en: ["C"]            # niveles que corren el refutador completo
    corto_en: []                  # niveles que corren el modo corto (p. ej. ["B"]); el resto, ninguno
  entrada_solo_por_paso0: false   # true: un pedido que llega al desarrollador por correo se devuelve al paso 0
  cierre_jira: null               # estado al que pasa el caso al cerrar el paso 6 (p. ej. "Cerrado")

normas:
  jurisdicciones: ["CO"]          # el refutador solo cita reglas de estas jurisdicciones (CO, PE, …)
```

### Valores de cada paso

Un paso que **no aparece** en `pasos` no aplica a ese nivel: su chequeo queda `no_aplica`.

| Paso | `completo` | `corto` | Otras variantes |
|---|---|---|---|
| p0 entender y aceptar | expediente + refutador según `refutador` | ficha corta (§3), refutador solo si el nivel está en `corto_en` | — |
| p1 impacto | ficha de impacto completa con modos de falla | ubicar el módulo en el mapa de criticidad | — |
| p2 definición técnica | escenarios de calidad + ADR | — | — |
| p3 subtareas y cortes | subtareas-instrucción con CA-n + cronograma + cortes | — | — |
| p4 revisión del PR | capa máquina + capa IA + segunda pasada + humana | — | `ia_y_humana` (capa máquina mínima + IA local + humana), `regla_minima` (solo capa máquina) |
| p5 revisión funcional | — | — | `matriz` (matriz desde la especificación), `evidencia` (una evidencia concreta que cierra el caso) |
| p6 retro y cierre | retro al dev + lección + horas reales | cierre en Jira + horas reales | — |

## 3. Campos del expediente que dependen del nivel

```json
{
  "nivel": "A|B|C",
  "ficha_corta": {"que": "", "para_cuando": "", "quien_pidio": "", "evidencia_cierre": "", "fuente": "F1"},
  "compromisos": [{"id": "K1", "fecha": "", "que": "", "a_quien": "", "fuente": "F2",
                   "estado": "vigente|cumplida|incumplida|reemplazada", "reemplaza": null, "nota": ""}],
  "cortes": [{"fecha": "", "que_se_revisa": "", "criterios": ["CA-1"], "responsable": "", 
              "tipo": "desarrollo|revision_lider|tercero|validacion|acta", "fuente": null,
              "estado": "pendiente|ok|desviado", "nota": ""}]
}
```

- Sin `nivel`, el caso es del `nivel_por_defecto`. Un expediente v2 viejo sigue siendo válido.
- `ficha_corta` es obligatoria en los niveles cuyo `p0` es `corto`: qué se pide, para cuándo, quién lo
  pidió y **la evidencia que cierra el caso** (la plantilla aprobada, la carga verificada, el registro
  corregido). Toma minutos y deja el caso con dueño y fecha en Jira.
- `compromisos[]` guarda **toda fecha prometida al cliente con su historial**: una fecha que se mueve no
  se sobreescribe, se agrega una nueva con `reemplaza` y la vieja pasa a `reemplazada` o `incumplida`.
- Un compromiso de un acta («dar la fecha el lunes») es un corte con `tipo: acta` y su `fuente`.
- `chequeos.pN` de un paso que no aplica al nivel: `{"estado": "no_aplica"}`.

## 4. Quién usa qué

| Pieza | Qué lee | Qué hace distinto por nivel |
|---|---|---|
| planear-sprint (paso 0) | `flujo`, `nivel` | clasifica, pide `ficha_corta` en A/B, decide si corre el refutador y en qué modo |
| refutador-requerimiento | modo del encargo, `normas.jurisdicciones` | `modo: corto` = solo norma y alcance, máx. 5 puntos |
| revisar-pr | `flujo.niveles[nivel].pasos.p4` | capas que corre |
| certificar-funcional | `flujo.niveles[nivel].pasos.p5` | matriz completa o evidencia única |
| Worklist del líder | `flujo`, `nivel` | filtro por nivel; A y B abren el detalle corto |
| vigía (alcances-scan) | `cortes[]` y `compromisos[]` de los expedientes | persigue cortes y compromisos vencidos como hitos |

## 5. Capacidad real del equipo

En `equipo[]` de `fuentes.yaml`, dos campos opcionales que el cronograma y status-celula respetan:

```yaml
equipo:
  - nombre: "<Persona>"
    produce_pr: true                      # false: no cuenta como capacidad de desarrollo (QA, analista)
    prestado: { a: "<otra célula>", desde: "AAAA-MM-DD", hasta: null }   # sin capacidad en ese rango
```

El cronograma muestra cuántas personas producen PR en el rango antes de comprometer una fecha.
