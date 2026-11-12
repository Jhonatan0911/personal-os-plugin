# Armar un perfil de voz desde cero

Léelo cuando el usuario no tiene perfil (paso 23) o pide rehacerlo. El resultado es un Markdown en
`rutas.perfil_voz` (por defecto `<stateDir>/personal/voz.md`) con la forma de
`plantillas/voz-ejemplo.md`. Es un archivo **privado**: nunca va al plugin ni a un repo compartido.

## 1. Pedir permiso y fijar el corpus (modal)

En una sola tanda: ¿se pueden leer, en solo lectura, sus correos enviados y sus comentarios de Jira?
¿Desde qué fecha? ¿Hay una fecha desde la que el OS ya le redactaba textos (`contaminacion_desde`)?
¿Qué dominio de correo es "dentro de la organización"? Sin permiso, no se lee nada: se le ofrece que
pegue 8-10 textos suyos de géneros distintos.

## 2. Leer (solo lectura, por subagentes si el corpus es grande)

- **Enviados**: 6-10 completos de géneros distintos (bloqueo, aprobación, reporte, trámite, respuesta
  a cliente) y 40-60 en previsualización para léxico y saludos. Separa **dentro** y **fuera** de la
  organización: casi siempre son dos registros.
- **Jira**: 15-20 comentarios suyos íntegros. Mira si tiene un modo corto (constancia) y uno largo.
- **Fuera del corpus**: lo redactado por el OS (desde `contaminacion_desde`), lo generado por bots y
  los reenvíos sin texto propio. Sus prompts a Claude sirven para el léxico, nunca como modelo.
- No copies al perfil credenciales, datos de pacientes ni correos completos de terceros: se citan
  frases del usuario, no hilos.

## 3. Destilar (cada regla con su evidencia)

Secciones, en este orden (las de `plantillas/voz-ejemplo.md`):

1. **Frontmatter**: `tipo: perfil`, `nombre`, `actualizado`, `fuente_corpus` (qué se leyó, rango de
   fechas, qué NO se leyó), `regla_de_corpus` y `contaminacion_desde`.
2. **Cómo suena, en tres líneas.**
3. **Los dos registros**: dentro y fuera de la organización — saludo, persona gramatical, cierre,
   fórmulas que valen en uno y están prohibidas en el otro.
4. **Por género**: correos, comentarios de Jira (corto y largo), mensajes; cómo arma cada uno.
5. **Reglas de voz**: cada una con una cita literal suya y su fecha. Una regla sin evidencia no entra.
6. **Léxico**: palabras y giros que sí usa; **tics** que se conservan; **descuidos** que se corrigen.
7. **Fórmulas prohibidas**: lo que nunca escribe aunque sea "lo normal".
8. **Contaminación** y **Qué NO se imita**.
9. **Lecciones aprendidas**: vacía al nacer; se llena con el paso 19.

## 4. Confirmar

Muéstrale **solo** «Cómo suena» y los dos registros y pregúntale en el modal si se reconoce. Lo que
corrija entra como primera lección. Desde ahí, `redactar` lo usa sin volver a pedir muestras.
