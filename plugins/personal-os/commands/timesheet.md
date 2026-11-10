---
description: Arma, valida y prepara el envío del timesheet desde la bitácora (libro corporativo si hay perfil de organización)
argument-hint: "[fecha | semana <fecha> | envio <fecha> | horas-extra]"
---

Sigue el skill `timesheet` del plugin con el argumento: $ARGUMENTS

- Primero `python "<raíz del plugin>/skills/timesheet/libro.py" perfil` (`python3` fuera de Windows; la raíz
  del plugin está en la línea **"Scripts del plugin:"** del contexto). Con `PERFIL ACTIVO` va el modo libro
  (`libro.py` + `horas_extra.py`, reglas del perfil); sin perfil, el modo genérico (`timesheet.py`).
- Sin argumento: el día de hoy. Una fecha (`AAAA-MM-DD`, `dd/mm/aaaa`, "ayer", "lunes"): ese día.
  `semana <fecha>`: la semana que la contiene. `envio <fecha>`: el archivo de envío. `horas-extra`: el
  formato del corte.
- Arma el día con las líneas TS de la bitácora y crúzalo en SOLO LECTURA con el calendario y con los
  timesheets del equipo (obligatorio si el perfil lo dice; en modo genérico, si `fuentes.yaml` lo activa).
  Los huecos se declaran, nunca se rellenan.
- Toda fila con fecha fija, clave de issue y cliente; sin horas extra como filas; sin herramientas de IA
  ni códigos internos en la tarea. El correo se redacta y lo envía el usuario: nunca lo envíes tú.
