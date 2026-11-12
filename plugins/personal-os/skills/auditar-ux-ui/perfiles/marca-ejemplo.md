---
tipo: identidad
nombre: "Identidad corporativa de Organización Ejemplo"
version: 1.0
actualizado: AAAA-MM-DD
estado: derivado_de_fuentes_reales   # o: manual_oficial
manual_oficial: PENDIENTE            # ruta o url del manual cuando exista; si existe, manda el manual
---

# Identidad de marca — Organización Ejemplo

> EJEMPLO FICTICIO: muestra el formato que lee `auditar-ux-ui`. Cópialo a la carpeta de configuración
> del estado (`marca/MARCA.md` junto a `fuentes.yaml`, o la ruta de `organizacion.marca`), pon los
> logos al lado y reemplaza los valores por los de tu organización. Nunca dentro del plugin.

## De dónde salió cada cosa
| Fuente | Qué aportó |
|---|---|
| <documento oficial de gerencia> | Logo y colores de texto |
| <capturas del portal de la empresa> | Azul de acción, fondos y grises |

## Paleta
```
PRIMARIOS
  --marca      #123A6B   El color del logo. Portadas, fondos grandes.
  --profundo   #1E2E4F   Títulos, encabezados y tablas.
  --accion     #2B5FB0   Botones, énfasis, elementos activos.
  --medio      #3F7CC4   Subtítulos, enlaces, acentos.
NEUTROS
  --tinta #1F2328 · --gris #5B6472 · --linea #E1E6EC · --fondo #F3F6F9 · --blanco #FFFFFF
SEMÁNTICOS (solo para estado, nunca decorativos)
  --critico #A33A33 · --alto #A8690A · --ok #2E6B4E
```
**Regla de uso:** profundo para estructura, acción para lo que importa, neutros para todo lo demás.

## Logos
| Archivo | Px | Cuándo se usa |
|---|---|---|
| `logo-horizontal.png` | 800×200 | Encabezados de documento |
| `logo-horizontal-blanco.png` | 800×200 | Sobre fondo de color |
**Reglas:** nunca se escalan por encima de su tamaño nativo, ni se deforman, rotan o recolorean;
margen libre alrededor; nunca sobre fondos de bajo contraste.

## Tipografía
- **Títulos:** <fuente> Semibold · **Cuerpo:** <fuente> · **Datos y código:** <monoespaciada>
- Lo que no se usa (p. ej. serifas) y por qué.

## Cómo se ve un documento
- Fondo dominante y cuántas bandas de color.
- Tablas: color de cabecera, filas alternas, grosor de línea.
- Cifras grandes con etiqueta pequeña; callouts con barra lateral.
- Pie: `<razón social> · <ciudad>` y numeración; marca de uso (`Uso interno`) si aplica.

## Cómo se ve una presentación (opcional)
Kicker numerado, titular que es la conclusión, una idea por diapositiva, formato 16:9.

## Lo que falta por confirmar
Lista de dudas abiertas sobre la marca (manual, tipografía oficial, versiones del logo).
