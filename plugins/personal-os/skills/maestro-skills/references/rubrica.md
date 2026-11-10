# Rúbrica de calidad

## Índice
1. Criterios (lo que el auditor no mide)
2. Puntaje
3. Diagnóstico por síntoma
4. Anti-patrones

## 1. Criterios

Calificar cada uno de 0 a 2, con la evidencia (línea o frase). Anclas para no variar entre evaluadores:
**2** = se cumple en toda la skill sin excepción que encuentres; **1** = se cumple en lo principal pero
hay al menos un caso concreto que falla (cítalo); **0** = falla en lo principal o no existe.
Ejemplos: D1=2 si la descripción trae ≥3 frases reales y una situación sin nombrarla; D1=1 si solo trae
el comando. C2: cuenta las líneas que borrarías sin perder resultado; <10 % → 2, 10-20 % → 1, >20 % → 0.
C3: reglas duras en las primeras 60 líneas → 2; algunas abajo → 1; todas abajo → 0.

| # | Criterio | Pregunta |
|---|---|---|
| D1 | Disparo | ¿La descripción trae las frases que el usuario de verdad dice y una situación sin nombrar la skill? |
| D2 | Frontera | ¿Dice qué NO cubre y no se pisa con otra skill instalada? |
| D3 | No resume el flujo | ¿La descripción dice *cuándo*, sin contar los pasos? |
| C1 | Valor | ¿Cada sección aporta algo que Claude no haría bien solo? (proceso propio, rutas, formatos, trampas) |
| C2 | Concisión | ¿Se puede borrar un 20 % sin perder resultado? Si sí, falla. |
| C3 | Lo crítico arriba | ¿Las reglas que no se pueden romper están en las primeras ~60 líneas? |
| C4 | Porqué | ¿Las reglas duras explican su razón, o solo gritan en mayúsculas? |
| E1 | Determinismo | ¿Lo repetible y frágil (validar, contar, generar) está en un script que se ejecuta? |
| E2 | Grados de libertad | ¿Da un valor por defecto en lugar de un menú? |
| E3 | Verificación | ¿Hay un paso que compruebe el resultado antes de darlo por hecho? |
| S1 | Seguridad | ¿Toda escritura externa (Jira, correo, push, borrar) pide confirmación? |
| G1 | Generalidad | ¿Funcionaría para otra persona cambiando solo la configuración? |

## 2. Puntaje

- **Forma** (auditor): 0-100, lo da `scripts/auditar_skills.py`.
- **Fondo**: suma de los 12 criterios × 100 / 24.
- **Final** = 0,4 × forma + 0,6 × fondo. Meta: ≥ 85 para estar en el plugin; < 70 se rehace.
- Se reportan los tres números, nunca solo el final.

## 3. Diagnóstico por síntoma

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| No se dispara | Descripción vaga o sin las palabras del usuario | Añadir frases reales y situaciones; probar con evals de disparo |
| Se dispara de más | Descripción amplia o compartida con otra | Estrechar, añadir "No es para…", `paths`, o `disable-model-invocation` |
| Choca con otra skill | Solape de palabras clave | Fronteras explícitas en las dos; fusionar si hacen lo mismo |
| Gasta muchos tokens | Cuerpo largo, ejemplos de más, detalle que se usa poco | Mover a `references/`, scripts que impriman poco |
| Resultado distinto cada vez | Demasiada libertad en un paso frágil | Script con parámetros fijos o plantilla |
| Se olvida reglas a mitad de sesión | Reglas abajo del todo o la sesión compactó | Subirlas; si son obligatorias, hook |
| Claude "resume" en vez de seguirla | La descripción cuenta los pasos | Quitar el flujo de la descripción |
| Solo le sirve a su autor | Datos personales en el texto | `references/generalizar.md` |

## 4. Anti-patrones

- Descripción vaga ("Ayuda con documentos"), en primera persona o que resume el flujo.
- Explicar lo que Claude ya sabe (qué es un PDF, cómo hacer un commit).
- Menú de cinco opciones sin una por defecto.
- Referencias anidadas (A → B → C): Claude lee a medias.
- Rutas con `\` o absolutas de un equipo (`C:\Users\<usuario>\…`).
- Fechas, versiones y nombres de personas en el cuerpo (caducan).
- Constantes mágicas en scripts; scripts que le pasan el error a Claude.
- SIEMPRE/NUNCA en mayúsculas sin explicar.
- Parches para un caso de prueba (sobreajuste) en vez de una regla general.
- Renombrar a `-v2` en vez de mejorar la misma skill.
- Copias de la misma skill en dos ubicaciones.
