# Borradores: la mitad que hace posible aprender

Léelo al guardar un borrador (paso 15). La carpeta es `rutas.borradores` (por defecto
`<stateDir>/personal/borradores/`). Si no existe, créala con un `README.md` que copie esta página.

## Por qué existe

La señal más limpia sobre la voz del usuario no es que corrija un borrador (depende de que se
acuerde): es **la diferencia entre lo que el OS escribió y lo que él realmente mandó**. Para
calcularla hacen falta las dos mitades; Enviados es la derecha y esta carpeta, la izquierda.

## Ciclo

1. `redactar` guarda el borrador **antes** de entregarlo, con `estado: pendiente`.
2. El brief diario pasa los pendientes al explorador de Outlook, que busca cada uno en Enviados por
   asunto y destinatario y trae el cuerpo completo (ahí el cuerpo *es* el dato).
3. El hilo principal compara. Si hay diferencias, anexa la lección al perfil de voz (antes, después y
   regla) y marca el borrador `verificado`.
4. Si no aparece en Enviados, sigue `pendiente` y se reintenta mañana. Que un borrador lleve días sin
   salir es un dato del brief, no un fallo del cotejo.

## Formato

Nombre: `AAAA-MM-DD-slug-del-asunto.md`

```markdown
---
tipo: borrador
fecha: AAAA-MM-DD
genero: correo | comentario-jira | mensaje
registro: interno | externo
destinatarios: [<usuario1>, <usuario2>]
asunto: "RE: <asunto>"
estado: pendiente | verificado | descartado
voz_autoevaluada: 0-100
verificado_el:
diferencias:
---

<el texto exacto que se entregó, sin una palabra de más>
```

## Reglas

- **El texto tal cual se entregó**, no una versión resumida ni retocada de memoria.
- **Nada sensible**: ni credenciales, ni datos de pacientes o clientes, ni cadenas de conexión.
- **Retención: 30 días desde `verificado`.** Lo que valía ya vive como lección en el perfil. Los
  `pendiente` no se borran por antigüedad.
- **`descartado`** es para lo que el usuario decidió no mandar. También enseña: merece su lección.
