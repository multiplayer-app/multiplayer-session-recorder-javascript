import React, { useMemo, useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import fs from 'fs'
import path from 'path'
import type { AgentConfig } from '../../types/index.js'
import * as GitService from '../../services/git.service.js'

const CONFIRM_ITEM = '__confirm__'
const UP_ITEM = '__up__'

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  if (maxLength < 9) return `${value.slice(0, Math.max(1, maxLength - 1))}…`
  const half = Math.floor((maxLength - 1) / 2)
  return `${value.slice(0, half)}…${value.slice(value.length - (maxLength - 1 - half))}`
}

const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', 'out', '.git', '.next', '.nuxt', '__pycache__', '.venv', 'venv'])

function readDirs(dirPath: string): string[] {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !IGNORED_DIRS.has(e.name))
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
}

export const DirectoryStep: React.FC<Props> = ({ config, onComplete }) => {
  const { stdout } = useStdout()
  const [currentPath, setCurrentPath] = useState(config.dir ?? process.cwd())
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isRoot = currentPath === path.parse(currentPath).root
  const subdirs = useMemo(() => readDirs(currentPath), [currentPath])
  const items = useMemo(
    () => [CONFIRM_ITEM, ...(isRoot ? [] : [UP_ITEM]), ...subdirs],
    [isRoot, subdirs]
  )
  const rows = stdout.rows || 30
  const cols = stdout.columns || 100
  // Keep total screen height below terminal rows to avoid frame spill/scrollback duplication.
  // This screen also includes logo, step panels, metadata box and hints outside this list.
  const reservedRows = 30
  const maxVisibleItems = Math.max(6, rows - reservedRows)
  const windowStart = Math.max(0, Math.min(
    selectedIndex - Math.floor(maxVisibleItems / 2),
    Math.max(0, items.length - maxVisibleItems)
  ))
  const visibleItems = useMemo(
    () => items.slice(windowStart, windowStart + maxVisibleItems),
    [items, windowStart, maxVisibleItems]
  )
  const hasAbove = windowStart > 0
  const hasBelow = windowStart + maxVisibleItems < items.length
  const topHiddenCount = windowStart
  const bottomHiddenCount = Math.max(0, items.length - (windowStart + visibleItems.length))
  const safePath = truncateMiddle(currentPath, Math.max(30, cols - 8))

  useInput((_, key) => {
    if (validating) return

    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1))
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1))
    } else if (key.pageUp) {
      setSelectedIndex((i) => Math.max(0, i - Math.max(3, Math.floor(maxVisibleItems / 2))))
    } else if (key.pageDown) {
      setSelectedIndex((i) => Math.min(items.length - 1, i + Math.max(3, Math.floor(maxVisibleItems / 2))))
    } else if (key.leftArrow) {
      if (!isRoot) {
        setCurrentPath(path.dirname(currentPath))
        setSelectedIndex(0)
        setError(null)
      }
    } else if (key.rightArrow) {
      const item = items[selectedIndex]
      if (item && item !== CONFIRM_ITEM && item !== UP_ITEM) {
        setCurrentPath(path.join(currentPath, item))
        setSelectedIndex(0)
        setError(null)
      }
    } else if (key.return) {
      const item = items[selectedIndex]
      if (!item) return

      if (item === CONFIRM_ITEM) {
        setValidating(true)
        setError(null)
        GitService.isGitRepo(currentPath)
          .then((isGit) => {
            setValidating(false)
            if (!isGit) {
              setError(`Not a git repository: ${currentPath}`)
              return
            }
            onComplete({ dir: currentPath })
          })
          .catch((err: Error) => {
            setValidating(false)
            setError(err.message)
          })
      } else if (item === UP_ITEM) {
        setCurrentPath(path.dirname(currentPath))
        setSelectedIndex(0)
        setError(null)
      } else {
        setCurrentPath(path.join(currentPath, item))
        setSelectedIndex(0)
        setError(null)
      }
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold>Project Directory</Text>
      <Text dimColor>Select the git repository root for your project.</Text>
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text dimColor>{safePath}</Text>
        </Box>
        <Box>
          <Text dimColor>
            {subdirs.length} folders in this directory
            {items.length > maxVisibleItems ? ` · showing ${visibleItems.length}` : ''}
          </Text>
        </Box>
        {error && (
          <Box>
            <Text color="red">✗ {error}</Text>
          </Box>
        )}
        {validating ? (
          <Text color="yellow">○ Checking git repository...</Text>
        ) : (
          <Box flexDirection="column">
            {hasAbove && (
              <Text dimColor>… {topHiddenCount} more above</Text>
            )}
            {visibleItems.map((item, localIndex) => {
              const i = windowStart + localIndex
              const isActive = i === selectedIndex
              let label: string
              let color: string | undefined
              if (item === CONFIRM_ITEM) {
                label = 'Use this directory'
                color = isActive ? 'green' : undefined
              } else if (item === UP_ITEM) {
                label = '../'
                color = isActive ? 'cyan' : undefined
              } else {
                label = `${item}/`
                color = isActive ? 'cyan' : undefined
              }
              const clipped = truncateMiddle(label, Math.max(20, cols - 8))
              return (
                <Box key={`${item}-${i}`}>
                  <Text color={color as any} bold={isActive}>
                    {isActive ? '> ' : '  '}
                    {clipped}
                  </Text>
                </Box>
              )
            })}
            {hasBelow && (
              <Text dimColor>… {bottomHiddenCount} more below</Text>
            )}
          </Box>
        )}
      </Box>
      <Text dimColor>↑↓ move · ←→ navigate dirs · PgUp/PgDn jump · Enter open/confirm · Esc back</Text>
    </Box>
  )
}
