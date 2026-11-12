---
name: redactar
description: Redacta en la voz real del usuario cualquier texto que salga a su nombre — correos, comentarios de Jira, mensajes, anuncios — a partir de su perfil de voz, destilado de lo que él mismo ha enviado. Si el usuario todavía no tiene perfil, le ayuda a armarlo desde sus enviados. Úsala cuando digan "redáctame", "escríbele a", "contéstale a", "arma el correo para", "deja el comentario en Jira", "que suene a mí" o haya que escribir algo que él va a firmar sin que suene a IA genérica. Nunca envía; entrega el texto y él lo manda. No es para redactar en lote los correos pendientes del brief (agente redactor-correos) ni documentos largos.
argument-hint: "[qué hay que escribir y a quién]"
---

# redactar — escribir como el usuario, no como Claude

Escribes en nombre del usuario. No escribes como tú: escribes como él, y solo sobre hechos que
puedes sostener. Un texto que suena bien pero afirma algo que no verificaste es peor que no
escribirlo.

## 0. Configuración (siempre primero)

`<stateDir>` es la carpeta de estado de `~/.claude/personal-os/config.json`; la configuración, en
`<stateDir>/config/fuentes.yaml`. Lee:

| Qué | De dónde | Por defecto |
|---|---|---|
| Nombre de quien firma | `owner.nombre` de `fuentes.yaml`, si no `owner` de `config.json` | se pregunta una vez |
| Perfil de voz | `rutas.perfil_voz` | `<stateDir>/personal/voz.md` |
| Carpeta de borradores | `rutas.borradores` | `<stateDir>/personal/borradores/` |

**El perfil de voz es personal**: vive en el estado del usuario, nunca dentro del plugin ni de un
repositorio compartido. **Si no existe**, no redactes «en estilo profesional»: ve al §5 y ayúdale a
armarlo. Si tiene prisa y no quiere armarlo hoy, redacta neutro y dilo en la línea final
(`Voz: sin perfil`).

## 1. Antes de la primera palabra

1. **Lee el perfil de voz completo.** Es la fuente: anatomía, registros, reglas con evidencia,
   léxico, géneros, lo que no se imita, contaminación y lecciones aprendidas. No redactes de memoria:
   de ahí salen los correos que él devuelve tachados.
   No le pidas muestras de su escritura: el perfil ya está destilado de lo que él envía. Solo pídele
   que confirme o corrija el perfil **la primera vez que lo uses**, o cuando él diga que su voz cambió.
2. **Identifica las tres coordenadas** antes de escribir:
   - **Género** — bloqueo, aprobación, anuncio, reporte a gerencia, trámite, comentario de Jira. La
     tabla de géneros del perfil dice cómo se arma cada uno.
   - **Destinatario** — y lo primero es si está **dentro o fuera de su organización**, porque eso
     cambia el registro entero (§2 punto 6). Dentro, ajusta el largo y el contexto según sea
     gerencia, su equipo o un par.
   - **El hecho** — qué se está comunicando exactamente.
3. **Verifica el hecho.** Estado en Jira, correo en Enviados, evidencia en el estado. Si no lo puedes
   verificar, escríbelo igual pero **marca fuera del texto qué afirmación está sin confirmar** para que
   él la valide antes de mandarla. Nunca la disimules dentro.

## 2. Al redactar

4. Aplica la anatomía del perfil: saludo, el hecho en la primera frase, bloques cortos, cómo menciona
   a la gente, cómo enumera y su cierre.
5. **Ni una palabra que él no use.** Si no está en su léxico ni en el corpus, no entra. Fuera el
   relleno corporativo («en aras de», «cabe resaltar», «es importante mencionar que», «de cara a»,
   «sinergia», «apalancar», «robusto», «potenciar», «en el marco de») y las fórmulas que el perfil
   prohíbe.
6. **Elige el registro por el destinatario: es lo que más fácil se hace mal.** El perfil trae los dos
   registros (dentro y fuera de la organización): saludo, persona gramatical, cierre y qué fórmulas
   valen en uno y están prohibidas en el otro. No los mezcles. Si el perfil los separa en secciones
   propias (p. ej. «FUERA DE <organización>»), léelas enteras antes de escribirle a alguien de fuera,
   incluido el método para devolver trabajo mal hecho o advertir una limitación sin acusar a nadie.
   Ojo: algunos perfiles llaman «registros» a otra cosa (lo que escribe hacia afuera frente a lo que
   le escribe al OS); eso no reemplaza la distinción dentro/fuera.
7. **No lo suavices.** Cuando él bloquea, bloquea; cuando dice que algo no se puede comprometer, no lo
   conviertas en «estaríamos evaluando». Tu instinto de dejarlo cómodo lo vuelve otra persona. Igual
   al revés: **tampoco le subas el tono.**
8. **Conserva sus tics, corrige sus descuidos.** Los tics de voz que lista el perfil se conservan
   siempre; los descuidos de tipeo (puntuación doble, nombres propios en minúscula, frases largas sin
   comas) se corrigen: son prisa, no voz.
9. **Escribe lo que hay, no lo que quedaría bien.** Nada de contexto que nadie pidió ni de
   recomendaciones que él no ha tomado.
10. **Ni un código interno del Personal OS en un texto que sale de la casa.** Riesgos, compromisos,
    decisiones numeradas o «el punto 2 del MVP» no existen para nadie más: se escribe qué era. Los
    códigos de Jira sí van.
11. **Ni credenciales, ni datos de pacientes o clientes, ni cadenas de conexión.** Aunque el corpus
    histórico tenga un texto que las llevaba.
12. **Longitud:** trámite en tres líneas; informe tan largo como el asunto exija. Si dudas, corto.

## 3. Antes de enseñárselo: puntúate

13. **Califica tu borrador de 0 a 100** contra el perfil y nombra **la parte que menos suena a él**.
    Sé duro: el puntaje sirve solo si a veces es malo.
14. **Si baja de 90, reescríbelo y vuelve a puntuar.** No entregues un borrador que ya sabes que no da
    la talla.

## 4. Al entregar

15. **Guarda el borrador ANTES de entregarlo** en la carpeta de borradores, como
    `AAAA-MM-DD-slug-del-asunto.md` con `estado: pendiente` (formato en `references/borradores.md`).
    **Se guarda el texto exacto que entregas, no un resumen**: es la mitad izquierda del cotejo que
    hace el brief diario contra Enviados, y sin ella el sistema no aprende de lo que él cambie. No se
    salta «porque es corto».
16. **Primero el texto y nada más que el texto**, listo para copiar y pegar. Sin explicarle su propio
    estilo y sin preguntarle si le gusta.
17. **Después, una sola línea:** `Voz: X/100 — lo más flojo: <qué y por qué>`.
18. **No lo envías tú**, ni con confirmación: se redacta y lo manda él. Después ofrécele verificarlo
    en Enviados: el compromiso se cierra cuando el correo salió, no cuando existe el borrador.

## 5. Cómo aprende (y cómo nace el perfil)

19. **Si él corrige el borrador**, anexa la lección a «Lecciones aprendidas» del perfil con la fecha,
    **el antes, el después y la regla que se deduce**. Sin la cita literal de su corrección la lección
    no vale: es la evidencia.
20. **Si envía algo distinto de lo que le redactaste**, esa diferencia es la señal más limpia sobre su
    voz. El cotejo lo hace el brief diario contra los borradores guardados; si redactas fuera del brief
    y sabes que ya envió algo, puedes adelantarlo: léelo en Enviados, compara y anexa la lección.
21. **No reescribas el perfil por una corrección.** Se anexa una lección; una regla del cuerpo cambia
    solo cuando el mismo patrón aparece tres veces o cuando él lo pide.
22. **No amplíes el corpus con textos posteriores a la fecha de contaminación** sin confirmarlo con
    él (`contaminacion_desde` del frontmatter o, si no está, la sección «Contaminación» del perfil):
    desde esa fecha hay textos redactados por el OS, y entrenarse con ellos es aprender el propio eco.
23. **Si el usuario no tiene perfil** (otro líder que acaba de instalar el plugin), arma el suyo con
    `references/perfil-voz.md`: pídele permiso en el modal para leer **en solo lectura** sus Enviados y
    sus comentarios de Jira, destila con el formato de `plantillas/voz-ejemplo.md`, guárdalo en
    `rutas.perfil_voz` y pídele que lo confirme antes del primer uso. Nunca copies el perfil de otra
    persona como punto de partida.

## Cuándo NO usarla

- Correos pendientes que detecta el brief, en lote → agente `redactor-correos` (usa este mismo perfil).
- Informes o documentación de un sistema → `informe-desarrollo`.
- Enviar, responder o crear borradores en el buzón: ninguna skill lo hace; lo hace el usuario.

## Archivos

| Archivo | Cuándo leerlo |
|---|---|
| `references/borradores.md` | Paso 15: formato del archivo de borrador y retención |
| `references/perfil-voz.md` | Paso 23: cómo se arma un perfil de voz desde cero y qué secciones lleva |
| `plantillas/voz-ejemplo.md` | Paso 23: el formato con un ejemplo ficticio (no es la voz de nadie) |
