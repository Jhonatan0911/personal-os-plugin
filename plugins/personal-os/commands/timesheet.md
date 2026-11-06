---
description: Arma, valida y prepara el envío del timesheet desde la bitácora
argument-hint: "[fecha | semana <fecha> | exportar <desde> [<hasta>]]"
---

Sigue el skill `timesheet` del plugin con el argumento: $ARGUMENTS

- Sin argumento: el día de hoy. Una fecha (`AAAA-MM-DD`, `dd/mm/aaaa`, "ayer", "lunes"): ese día.
  `semana <fecha>`: la semana que la contiene. `exportar <desde> [<hasta>]`: el archivo de envío.
- El motor es `python3 "<raíz del plugin>/skills/timesheet/timesheet.py"` (`python` en Windows); la raíz
  del plugin está en la línea **"Scripts del plugin:"** del contexto de la sesión.
- Arma el día con las líneas TS de la bitácora, crúzalo en SOLO LECTURA con el calendario y, si el usuario
  lo configuró en `fuentes.yaml`, con los timesheets de su equipo. Los huecos se declaran, nunca se rellenan.
- Toda fila con fecha, clave de issue y cliente; jornada, categorías y meta de cobertura salen de
  `config.json`; sin horas extra como filas; sin herramientas de IA ni códigos internos en la tarea.
- El archivo queda en `<stateDir>/timesheet/`. El correo se redacta y lo envía el usuario: nunca lo envíes tú.
