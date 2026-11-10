# Paso 0 · Entender y aceptar

Léelo en la Fase 3, cuando vuelvan el revisor de estimación y el refutador.

## 1. Encargo al refutador

Al agente `refutador-requerimiento` le pasas rutas, no copias:
- la del expediente (`<stateDir>/requerimientos/<slug>/expediente.json`) y la del `plan.json` o la lista
  de subtareas con título, horas, estado, observación y descripción;
- la tabla de normas: `<stateDir>/criticidad/normas.json`. Si no existe, la de ejemplo del plugin
  (`plantillas/estado/criticidad/normas-ejemplo.json`) y le dices que **no está verificada**;
- el mapa de criticidad `<stateDir>/criticidad/modulos.json`, si existe;
- las rutas de los repos con su ref, si quieres que mire el código.

La tabla de normas la mantiene el usuario: cada regla con su URL oficial, su estado (`vigente`,
`en_tramite`, `derogada`) y la fecha en que se verificó. Si la más vieja tiene más de 45 días, dilo en el
resumen y propón revisarla antes de citarla frente al cliente.

## 2. Bajar los recortes al plan

| El refutador dice | En el plan | En el expediente |
|---|---|---|
| refuta y da alternativa | la subtarea pasa a `espera`; la observación empieza con «REFUTADO: <regla> — alternativa: …» | `refutacion[]` con `estado: propuesta` |
| la alternativa necesita trabajo nuevo | nueva subtarea `propuesta` con la alternativa como instrucción | se anota en `afecta` |
| pide descartar | la observación empieza con «DESCARTAR: <motivo>» para que el líder la descarte en la página | `refutacion[]` |
| pregunta (sin alternativa) | la subtarea pasa a `espera` con la pregunta | `pendientes[]` con `a_quien` y `bloquea` |
| acepta sin objeción | nada cambia | nada |

Lo que el líder acepta o descarta en la página se refleja después en `refutacion[].estado`. Nada se borra
del expediente: una refutación descartada queda como historia de por qué se hizo así.

## 3. DoR por niveles

Se avanza en lo claro y las dudas bloquean solo lo suyo (Cohn: una DoR que exige el 100 % es una cascada).

- **Listo para empezar** (la porción entra al plan como `propuesta`): está en la historia de Jira, tiene
  CA con cómo verificarlos, no tiene una refutación abierta ni un pendiente que la nombre en `bloquea`, y
  tiene responsable y horas.
- **Listo del todo** (el requerimiento completo): además, cero pendientes abiertos, ficha de impacto
  completa y, si el módulo es crítico (algún eje ≥ 4), escenarios de calidad y los ADR que hagan falta.

## 4. Chequeo del paso 0

| Estado | Cuándo | Qué se publica |
|---|---|---|
| `aceptado` | todo está listo para empezar y no queda refutación pendiente de decisión | cronograma para exportar |
| `parcial` | hay porciones listas para empezar y otras que esperan; lo que espera tiene dueño y fecha de seguimiento | cronograma para exportar solo lo `propuesta`; el correo de escalada lleva lo que espera |
| `por_entender` | lo que bloquea toca la base de la que dependen las demás historias | cronograma para decidir (sin exportar) y el correo con las preguntas |

Escríbelo en `chequeos.p0` con la fecha y una nota de una línea («entra la estructura base y 6 escalas;
espera lo clínico sin fuente»). `paso_actual` sube a 1 cuando el p0 no es `pendiente`. El líder puede
cambiar el estado: es su decisión y se anota en `historial`.
