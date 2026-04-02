// kilocode_change new file
import { RGBA } from "@opentui/core"
import { For, type JSX } from "solid-js"
import { useTheme, tint } from "@tui/context/theme"

// Shadow markers (rendered chars in parens):
// _ = full shadow cell (space with bg=shadow)
// ^ = letter top, shadow bottom (▀ with fg=letter, bg=shadow)
// ~ = shadow top only (▀ with fg=shadow)
const SHADOW_MARKER = /[_^~]/

const ASCII_LOGO = [
  `  ██████╗ ███████╗███╗   ██╗████████╗ █████╗  ██████╗ ██╗__`,
  `  ██╔══██╗██╔════╝████╗  ██║╚══██╔══╝██╔══██╗██╔════╝ ██║__`,
  `  ██████╔╝█████╗  ██╔██╗ ██║   ██║   ███████║██║  ███╗██║__`,
  `  ██╔═══╝ ██╔══╝  ██║╚██╗██║   ██║   ██╔══██║██║   ██║██║__`,
  `  ██║     ███████╗██║ ╚████║   ██║   ██║  ██║╚██████╔╝██║__`,
  `  ╚═╝     ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝__`,
  `   _____________________________________________________________`,
]

export function KiloLogo() {
  const { theme } = useTheme()
  const green = RGBA.fromHex("#00FF41")

  const renderLine = (line: string): JSX.Element[] => {
    const shadow = tint(theme.background, green, 0.25)
    const elements: JSX.Element[] = []
    let i = 0

    while (i < line.length) {
      const rest = line.slice(i)
      const markerIndex = rest.search(SHADOW_MARKER)

      if (markerIndex === -1) {
        elements.push(
          <text fg={green} selectable={false}>
            {rest}
          </text>,
        )
        break
      }

      if (markerIndex > 0) {
        elements.push(
          <text fg={green} selectable={false}>
            {rest.slice(0, markerIndex)}
          </text>,
        )
      }

      const marker = rest[markerIndex]
      switch (marker) {
        case "_":
          elements.push(
            <text fg={green} bg={shadow} selectable={false}>
              {" "}
            </text>,
          )
          break
        case "^":
          elements.push(
            <text fg={green} bg={shadow} selectable={false}>
              ▀
            </text>,
          )
          break
        case "~":
          elements.push(
            <text fg={shadow} selectable={false}>
              ▀
            </text>,
          )
          break
      }

      i += markerIndex + 1
    }

    return elements
  }

  return (
    <box>
      <For each={ASCII_LOGO}>{(line) => <box flexDirection="row">{renderLine(line)}</box>}</For>
    </box>
  )
}
