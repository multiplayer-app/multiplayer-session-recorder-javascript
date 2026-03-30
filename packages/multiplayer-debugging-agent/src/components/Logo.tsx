import React, { useState, useEffect } from 'react'
import { Box, Text, useStdout } from 'ink'

const WORDMARK_LARGE = [
  '███╗   ███╗██╗   ██╗██╗   ████████╗██╗██████╗ ██╗      █████╗ ██╗   ██╗███████╗██████╗ ',
  '████╗ ████║██║   ██║██║   ╚══██╔══╝██║██╔══██╗██║     ██╔══██╗╚██╗ ██╔╝██╔════╝██╔══██╗',
  '██╔████╔██║██║   ██║██║      ██║   ██║██████╔╝██║     ███████║ ╚████╔╝ █████╗  ██████╔╝',
  '██║╚██╔╝██║██║   ██║██║      ██║   ██║██╔═══╝ ██║     ██╔══██║  ╚██╔╝  ██╔══╝  ██╔══██╗',
  '██║ ╚═╝ ██║╚██████╔╝███████╗ ██║   ██║██║     ███████╗██║  ██║   ██║   ███████╗██║  ██║',
  '╚═╝     ╚═╝ ╚═════╝ ╚══════╝ ╚═╝   ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝',
]

const WORDMARK_COMPACT = [
  '█   █ █   █ █     █████ █████ ████  █      ███  █   █ █████ ████ ',
  '██ ██ █   █ █       █     █   █   █ █     █   █ █   █ █     █   █',
  '█ █ █ █   █ █       █     █   █   █ █     █   █  █ █  █     █   █',
  '█   █ █   █ █       █     █   ████  █     █████   █   ████  ████ ',
  '█   █ █   █ █       █     █   █     █     █   █   █   █     █ █  ',
  '█   █ █   █ █       █     █   █     █     █   █   █   █     █  █ ',
  '█   █  ███  █████   █   █████ █     █████ █   █   █   █████ █   █',
]

function center(input: string, width: number): string {
  if (input.length >= width) return input
  const padLeft = Math.floor((width - input.length) / 2)
  const padRight = width - input.length - padLeft
  return `${' '.repeat(padLeft)}${input}${' '.repeat(padRight)}`
}

function rowWidth(rows: string[]): number {
  return rows.reduce((max, line) => Math.max(max, line.length), 0)
}

export const Logo: React.FC = () => {
  const { stdout } = useStdout()
  const [columns, setColumns] = useState(stdout.columns)

  useEffect(() => {
    const onResize = () => setColumns(process.stdout.columns)
    stdout.on('resize', onResize)
    return () => { stdout.off('resize', onResize) }
  }, [stdout])

  const maxInnerWidth = Math.max(48, (columns || 100) - 8)
  const wordmarkRows =
    rowWidth(WORDMARK_LARGE) <= maxInnerWidth ? WORDMARK_LARGE : WORDMARK_COMPACT

  const footnote = center('Automated issue triage, patching, and PR workflow', maxInnerWidth)

  return (
    <Box marginTop={2} marginBottom={1} flexDirection="column" alignSelf="center">
      {wordmarkRows.map((line, i) => (
        <Text key={i} color="#5a65ff">{center(line, maxInnerWidth)}</Text>
      ))}
      <Text color="#4ee4ff">{footnote}</Text>
    </Box>
  )
}
