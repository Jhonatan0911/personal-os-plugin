---
tipo: perfil
nombre: Voz de Fulano Ejemplo
actualizado: AAAA-MM-DD
fuente_corpus: >
  CORREOS INTERNOS — 6 leídos completos y 40 en previsualización, de Enviados entre <fecha> y <fecha>.
  CORREOS A CLIENTE — 3 completos y 15 en previsualización, a <dominio-cliente>.
  JIRA — 15 comentarios suyos, íntegros, en <PROY-1>, <PROY-2>…
  NO LEÍDO: Teams, actas y el resto de Enviados.
regla_de_corpus: >
  Solo cuenta como voz lo escrito por la persona a mano. Quedan fuera los textos redactados por el OS
  y los comentarios de bots.
contaminacion_desde: AAAA-MM-DD
---

# Voz de Fulano Ejemplo — cómo escribe hacia afuera

> EJEMPLO FICTICIO: muestra el formato. No es la voz de nadie; cada usuario arma la suya.

## Cómo suena, en tres líneas
Directo, el hecho primero. Párrafos de una o dos frases. Pide con nombre y fecha, sin rodeos.

## Los dos registros — no se mezclan
| | Dentro de la organización | Fuera (cliente, proveedor) |
|---|---|---|
| Saludo | «Hola equipo,» | «Buenas tardes,» |
| Persona | «yo» y «nosotros» | plural de empresa siempre («Confirmamos…») |
| Cierre | «Gracias.» | «Quedamos atentos. Saludos.» |
| Prohibido aquí | «Cordial saludo» | «porfa», emojis |

## Por género
- **Bloqueo**: asunto con la clave de la issue; primera frase = qué se detuvo y por qué; luego qué se
  necesita y de quién.
- **Comentario de Jira, modo corto**: una línea, sin saludo ni cierre. *«Desplegado en pruebas.»*
- **Comentario de Jira, modo largo**: con saludo y mención `@Nombre` pegada al pedido.

## Reglas de voz — con su evidencia
1. **El hecho en la primera frase.** Cita: *«El despliegue de hoy quedó detenido por la migración.»* (AAAA-MM-DD)
2. **Nunca condiciona una fecha que ya dio.** Cita: *«Queda para el viernes.»* (AAAA-MM-DD)

## Léxico
- **Usa:** «queda», «por favor», «quedo pendiente», «mesa técnica».
- **Tics (se conservan):** «porfa» hacia dentro; «el día de hoy».
- **Descuidos (se corrigen):** «etc..», nombres propios en minúscula.
- **Nunca:** «Estimado», «espero se encuentre bien», «sinergia».

## Contaminación
Desde `contaminacion_desde` hay textos redactados por el OS: no entran al corpus sin confirmarlo.

## Qué NO se imita
Errores de tipeo, respuestas de una palabra a gerencia, textos reenviados.

## Lecciones aprendidas
<!-- AAAA-MM-DD — título. Antes: «…». Después: «…». Regla: … -->
