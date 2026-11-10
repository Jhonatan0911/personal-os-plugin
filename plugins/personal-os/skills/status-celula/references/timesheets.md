# Timesheets del equipo

Léelo al armar el bloque `timesheets` del JSON. Para qué: seguir **que el timesheet se envíe a diario, qué %
de las horas cuelga de una issue y qué hizo cada quien el día anterior**. Se mide la hora trazable, no la
escrita: un timesheet completo sin issues vale poco.

## 1. Buscar los envíos — por remitente, nunca por asunto

- El remitente de cada persona es `equipo[].correo`. Cada quien titula a su manera (con fecha, con su nombre,
  solo con el nombre de la plantilla): buscar por asunto pierde envíos.
- Correo en **solo lectura**: búsqueda por `sender` y desde el lunes de la semana anterior; luego se lee el
  mensaje para ver adjuntos o enlaces.
- El timesheet del líder no se audita aquí: va por la skill `timesheet`.
- Un prestado se busca igual, pero puede estar reportando a su célula base: se dice, no se da por faltante.

## 2. Abrir el archivo

| Cómo llega | Cómo se lee |
|---|---|
| Adjunto `.xlsx` | Leer el recurso del adjunto: devuelve la hoja como texto |
| Enlace a la nube | Por su id de unidad e item si el conector lo resuelve. Si no se puede abrir, **se declara** («el de X es un enlace que no se pudo leer») con `"leido": false` y los `dias` que cubre; nunca se da por no enviado |
| Imagen o cuerpo sin archivo | Se toma lo que traiga el cuerpo y se marca como incompleto |

Las fechas pueden llegar como **número de serie de Excel** (días desde 1899-12-30) o `dd/mm/aaaa`; las horas
desde/hasta, como fracción del día. Se convierten antes de escribir el JSON.

**Un día sale de UN solo envío: el más reciente que lo traiga.** Hay quien manda la semana acumulada y quien
acumula meses en el mismo Excel: sumar envíos duplicaría o triplicaría horas. Lo aplica el motor; tú pasas
todos los envíos y todas las filas.

## 3. El bloque del JSON

```json
"timesheets": {
  "desde": "<lunes de la semana anterior>", "hasta": "<hoy>", "festivos": ["AAAA-MM-DD"],
  "personas": [{
    "nombre": "<nombre>", "correo": "<remitente>",
    "envios": [{"id": "x-0928", "fecha_correo": "AAAA-MM-DDTHH:MM", "asunto": "…", "fuente": "adjunto|nube",
                "archivo": "…", "leido": true, "dias": ["AAAA-MM-DD"]}],
    "filas":  [{"fecha": "AAAA-MM-DD", "envio": "x-0928", "cliente": "…", "categoria": "…",
                "jira": "PROY-123", "tarea": "…", "horas": 0.43}]
  }]
}
```

Las cifras **no se escriben**: el motor calcula el semáforo por día, el % con issue por semana y «qué hizo
cada día». Una fila sin clave válida lleva `"jira": ""`: **no se le inventa una issue**.

## 4. Qué pinta y qué se entrega

| Color | Cuándo |
|---|---|
| verde | hay horas y llegaron en un correo del mismo día o posterior |
| ámbar | hay horas en el archivo pero ningún correo posterior (el archivo se siguió llenando y no se mandó) |
| rojo | día hábil ya pasado sin ninguna hora |
| gris | hoy o futuro, festivo, o archivo que no se pudo leer |

Para el usuario cada mañana: **quién no envió ayer** (con los días que lleva), **el % con issue de la semana**
y las filas sin issue más grandes, **qué hizo cada quien ayer** en una línea (de sus filas, no de Jira), **las
horas «en espera» o «sin tarea»** y **lo que el timesheet dice hecho y Jira no refleja** (se nombran las dos
cosas, sin dar la issue por cerrada).

Después de generar, `status-celula-fichas.js` guarda una línea por persona y día en su ficha
(`- **AAAA-MM-DD** — Timesheet dd/mm: N h, X % con issue. …`), sin duplicar y pasando por el guardarraíl de
datos de personas, para que «¿qué hacía X ese día?» se responda aunque la bitácora ya rotó.

## 5. Lo que NO se hace

No se le escribe a nadie reclamando el timesheet (el tablero lo muestra y el usuario decide), no se corrigen
horas, no se rellenan días y no se ponen observaciones personales de las filas: solo el hecho laboral.
