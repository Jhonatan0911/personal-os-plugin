---
description: Busca un término en TODAS las fuentes del Personal OS antes de afirmar que algo no existe
argument-hint: <término> [sinónimo ...]
---

Ejecuta `node "<raíz del plugin>/scripts/os-buscar.js" $ARGUMENTS` (la raíz aparece en la línea
"Scripts del plugin:" del contexto). Si el usuario no dio sinónimos, añade uno o dos razonables
(singular/plural, la palabra sin tildes, el término en inglés si aplica).

Barre el estado, el núcleo y las skills del plugin, la configuración del OS, las instrucciones
globales, la memoria persistente y las carpetas declaradas en `config.json → busqueda`.

Entrega: dónde apareció (archivo y línea, lo justo), y la lista de fuentes barridas. Si no aparece,
se dice **"no lo encontré en <fuentes>"**, nunca "no existe": el contenido de PDF/Office, correos,
chats y Jira no se barre, así que propón buscar ahí o pregunta al usuario.
