---
description: Ve o cambia el nivel de exigencia del Personal OS (fácil, normal, estricto, cuartel)
---

El dial de exigencia gradúa cuánto aprieta el sistema: los umbrales del vigía de compromisos y el tono
que se inyecta al arrancar cada sesión.

1. Muestra el nivel vigente con `node "<raíz del plugin>/scripts/exigencia.js"` (la raíz aparece en la
   línea "Scripts del plugin:" del contexto).
2. Pregunta con **AskUserQuestion** a qué nivel lo quiere, explicando qué cambia cada uno en números:
   - **estricto** (por defecto): cruza los alcances todos los días hábiles, ventana crítica de 5 días, lista 8 vencidos.
   - **cuartel**: sin tolerancia; los CRÍTICOS se atienden antes que cualquier petición; avisa también en fin de semana.
   - **normal**: tolera 2 días sin cruzar, ventana de 3 días, lista 5 vencidos.
   - **fácil**: tolera 3 días, ventana de 2, no rastrea promesas sin declarar, una sola recomendación al cierre.
3. Aplica con `node "<raíz del plugin>/scripts/exigencia.js" --set <facil|normal|estricto|cuartel>` y
   confirma que el cambio rige desde la próxima sesión (el vigía de cada prompt lo usa de inmediato).
   Si el usuario baja el nivel con alcances en rojo, nómbralo una vez: es su decisión.
