import { useState, type ReactElement } from 'react'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { copyToClipboard } from '../../lib/clipboard.js'
import { clickHandler } from './clickHandler.js'

interface Props {
  command: string
}

function CopyableCommandImpl({ command }: Props): ReactElement {
  const [copied, setCopied] = useState(false)
  const handleCopy = (): void => {
    copyToClipboard(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <box
      flexDirection='row'
      border={true}
      borderStyle='rounded'
      borderColor='#30363d'
      paddingLeft={1}
      paddingRight={1}
      gap={1}
    >
      <box flexGrow={1} flexDirection='row' gap={1}>
        <text fg='#22d3ee'>$</text>
        <text fg='#e6edf3'>{command}</text>
      </box>
      <box onMouseUp={clickHandler(handleCopy)}>
        {copied ? (
          <text fg='#10b981'>✓ Copied</text>
        ) : (
          <text fg='#22d3ee' attributes={tuiAttrs({ underline: true })}>
            Copy
          </text>
        )}
      </box>
    </box>
  ) as ReactElement
}

export const CopyableCommand = CopyableCommandImpl as (props: Props) => ReactElement
