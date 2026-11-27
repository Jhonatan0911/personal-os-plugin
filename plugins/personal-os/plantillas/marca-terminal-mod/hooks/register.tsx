// Mod de Claude Code: tema de la terminal según la marca activa del Personal OS.
// Los colores y textos vienen de ./marca.ts, que GENERA scripts/marca-terminal.js
// desde <stateDir>/config/marca/terminal.json. Este archivo es plantilla: no lleva colores propios.
import type { Register, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { MARCA } from './marca'

const C = MARCA.colores
const LEMA: string = MARCA.lema

// "#1E3A8A" -> "30;58;138", para las secuencias de color de la línea de estado.
const rgb = (hex: string): string =>
  [1, 3, 5].map(i => String(parseInt(hex.slice(i, i + 2), 16))).join(';')

// App de escritorio y móvil: paleta de la marca (la terminal no dibuja esto).
const { theme, problems } = makeColors({
  label: MARCA.nombre,
  roles: { accent: C.acento, danger: C.error, success: C.ok, warning: C.alerta, pro: C.principal },
  light: {
    gray: {
      anchors: {
        'surface-0': C.fondo_suave,
        'surface-1': C.fondo,
        'surface-2': C.fondo,
        'text-primary': C.texto,
        'text-secondary': C.gris,
        'text-muted': C.gris,
      },
    },
  },
})

const LOOK: ThemeSetArgs = { colors: theme }

// Franja de la línea de estado: letras blancas sobre el color principal.
const FRANJA = `\x1b[1;97;48;2;${rgb(C.principal)}m ▲ ${MARCA.corto} \x1b[0m`
const LINEA = `\x1b[1;38;2;${rgb(C.principal)}m`

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    await $.theme.set(LOOK)

    return next(e)
  })

  // Línea de estado completa en el color principal y negrita (se quitan los colores del comando).
  on('ui.render', { component: 'StatusLine' }, ($, e, next) => {
    const text = e.props.text
    const pintada = (text ?? '')
      .split('\n')
      .map(line => `${LINEA}${line.replace(/\x1b\[[0-9;]*m/g, '')}\x1b[0m`)
      .join('\n')
    const joined = text === null || text === '' ? FRANJA : `${FRANJA} ${pintada}`

    return next({ ...e, props: { ...e.props, text: joined } })
  })

  // Bienvenida: la marca en texto encima del logo de Claude Code.
  on('ui.render', { component: 'Welcome' }, async ($, e, next) => {
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="column" marginBottom={1}>
          <Text color={C.principal} bold>▲ {MARCA.nombre}</Text>
          {LEMA === '' ? null : <Text color={C.gris}>  {LEMA}</Text>}
        </Box>
        {await next(e)}
      </Box>
    )
  })

  // Mensajes del usuario: sin el fondo gris de Claude Code, barra gris y negrita.
  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    const kind = e.props.origin.kind

    if (e.surface !== 'terminal' || (kind !== 'composer' && kind !== 'bridge')) {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" alignItems="stretch" marginTop={1}>
        <Box width={1} flexShrink={0} backgroundColor={C.gris_suave} marginRight={1} />
        <Box flexDirection="column" flexGrow={1}>
          <Text color={C.texto} bold>{e.props.text}</Text>
        </Box>
      </Box>
    )
  })

  // Respuestas de Claude: barra vertical en el color principal.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal') {
      return next(e)
    }
    const { Box } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" alignItems="stretch">
        <Box width={1} flexShrink={0} backgroundColor={C.principal} marginRight={1} />
        <Box flexDirection="column" flexGrow={1}>
          {await next(e)}
        </Box>
      </Box>
    )
  })
}
