import { useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import type { MouseEvent } from '@opentui/core'
import { MouseButton, ScrollBoxRenderable } from '@opentui/core'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import fs from 'fs'
import path from 'path'
import type { AgentConfig } from '../../types/index.js'
import * as GitService from '../../services/git.service.js'

const CONFIRM_ITEM = '__confirm__'
const UP_ITEM = '__up__'

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  '.git',
  '.next',
  '.nuxt',
  '__pycache__',
  '.venv',
  'venv'
])

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

const SCROLLBAR_STYLE = {
  wrapperOptions: { flexGrow: 1 },
  viewportOptions: { flexGrow: 1 },
  scrollbarOptions: {
    showArrows: false,
    trackOptions: {
      foregroundColor: '#484f58',
      backgroundColor: '#21262d'
    }
  }
} as const

function clickHandler(handler: () => void) {
  return (e: MouseEvent) => {
    if (e.button !== MouseButton.LEFT) return
    e.stopPropagation()
    handler()
  }
}

export function DirectoryStep({ config, onComplete }: Props): ReactElement {
  const { height: rows } = useTerminalDimensions()
  const [currentPath, setCurrentPath] = useState(config.dir ?? process.cwd())
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [hoveredBreadcrumb, setHoveredBreadcrumb] = useState<number | null>(null)
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)

  const isRoot = currentPath === path.parse(currentPath).root
  const subdirs = useMemo(() => readDirs(currentPath), [currentPath])
  const items = useMemo(() => [...(isRoot ? [] : [UP_ITEM]), ...subdirs], [isRoot, subdirs])

  // Breadcrumb segments
  const breadcrumbs = useMemo(() => {
    const root = path.parse(currentPath).root
    const rel = currentPath.slice(root.length)
    const parts = rel ? rel.split(path.sep) : []
    return [root.replace(/\/$/, '') || '/', ...parts]
  }, [currentPath])

  // Breadcrumb click: navigate to that ancestor
  const navigateToBreadcrumb = (segIndex: number) => {
    const root = path.parse(currentPath).root
    const rel = currentPath.slice(root.length)
    const parts = rel ? rel.split(path.sep) : []
    const target = segIndex === 0 ? root : path.join(root, ...parts.slice(0, segIndex))
    setCurrentPath(target)
    setSelectedIndex(-1)
    setError(null)
  }

  const activateItem = (item: string) => {
    if (item === CONFIRM_ITEM) {
      setValidating(true)
      setError(null)
      GitService.isGitRepo(currentPath)
        .then((isGit) => {
          setValidating(false)
          if (!isGit) {
            setError(`Not a git repository`)
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
      setSelectedIndex(-1)
      setError(null)
    } else {
      setCurrentPath(path.join(currentPath, item))
      setSelectedIndex(-1)
      setError(null)
    }
  }

  useLayoutEffect(() => {
    scrollRef.current?.scrollChildIntoView(`dir-item-${selectedIndex}`)
  }, [selectedIndex, items])

  useKeyboard(({ name, stopPropagation }) => {
    if (validating) return
    if (name === 'up') {
      setSelectedIndex((i) => Math.max(-1, i - 1))
    } else if (name === 'down') {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1))
    } else if (name === 'pageup') {
      const sb = scrollRef.current
      if (sb) {
        sb.scrollBy(-0.5, 'viewport')
        stopPropagation()
      }
      setSelectedIndex((i) => Math.max(-1, i - 10))
    } else if (name === 'pagedown') {
      const sb = scrollRef.current
      if (sb) {
        sb.scrollBy(0.5, 'viewport')
        stopPropagation()
      }
      setSelectedIndex((i) => Math.min(items.length - 1, i + 10))
    } else if (name === 'home') {
      setSelectedIndex(-1)
      scrollRef.current?.scrollBy(-1, 'content')
    } else if (name === 'end') {
      setSelectedIndex(items.length - 1)
      scrollRef.current?.scrollBy(1, 'content')
    } else if (name === 'left') {
      if (!isRoot) {
        setCurrentPath(path.dirname(currentPath))
        setSelectedIndex(-1)
        setError(null)
      }
    } else if (name === 'right' || name === 'return') {
      if (selectedIndex === -1) {
        activateItem(CONFIRM_ITEM)
      } else {
        const item = items[selectedIndex]
        if (item) activateItem(item)
      }
    }
  })

  return (
    <box flexDirection='column' flexGrow={1}>
      {/* Title */}
      <box flexShrink={0} paddingLeft={1} marginBottom={1}>
        <text attributes={tuiAttrs({ bold: true })} fg='#e6edf3'>
          Select repository directory
        </text>
      </box>

      {/* Breadcrumb path */}
      <box flexDirection='row' flexShrink={0} marginLeft={1}>
        {breadcrumbs.map((seg, i) => (
          <box key={`bc-${i}`} flexDirection='row'>
            {i > 0 && <text fg='#484f58'> › </text>}
            <text
              fg={i === breadcrumbs.length - 1 ? '#e6edf3' : hoveredBreadcrumb === i ? '#79c0ff' : '#58a6ff'}
              attributes={tuiAttrs({
                bold: i === breadcrumbs.length - 1,
                underline: hoveredBreadcrumb === i && i !== breadcrumbs.length - 1
              })}
              onMouseUp={clickHandler(() => navigateToBreadcrumb(i))}
              onMouseOver={() => setHoveredBreadcrumb(i)}
              onMouseOut={() => setHoveredBreadcrumb((v) => (v === i ? null : v))}
            >
              {seg}
            </text>
          </box>
        ))}
      </box>

      {error && (
        <box flexShrink={0} marginTop={1}>
          <text fg='#f85149'> {error}</text>
        </box>
      )}

      {/* File explorer box */}
      <box
        flexDirection='column'
        border={true}
        borderStyle='rounded'
        borderColor='#30363d'
        flexGrow={1}
        marginTop={1}
        overflow={'hidden' as const}
      >
        {/* Sticky confirm button at top */}

        <scrollbox ref={scrollRef} flexGrow={1} scrollY focused={false} style={SCROLLBAR_STYLE}>
          <box flexDirection='column' flexShrink={0} width='100%'>
            {items.map((item, i) => {
              const isActive = i === selectedIndex
              const isLast = i === items.length - 1
              const isUp = item === UP_ITEM

              const icon = isUp ? '' : '📁'
              const label = isUp ? '../' : item
              const nameFg = isActive ? '#e6edf3' : isUp ? '#8b949e' : '#c9d1d9'

              const isHovered = hoveredRow === i
              return (
                <box
                  key={`${item}-${i}`}
                  id={`dir-item-${i}`}
                  flexDirection='column'
                  onMouseUp={clickHandler(() => {
                    if (validating) return
                    activateItem(item)
                  })}
                  onMouseOver={() => setHoveredRow(i)}
                  onMouseOut={() => setHoveredRow((v) => (v === i ? null : v))}
                >
                  <box
                    flexDirection='row'
                    height={1}
                    paddingLeft={1}
                    paddingRight={1}
                    backgroundColor={isActive ? '#161b22' : isHovered ? '#21262d' : undefined}
                  >
                    {/* Icon */}
                    <box width={3} flexShrink={0}>
                      <text fg='#8b949e'>{icon}</text>
                    </box>
                    {/* Name */}
                    <box flexGrow={1}>
                      <text fg={nameFg} attributes={tuiAttrs({ bold: isActive })}>
                        {label}
                      </text>
                    </box>
                    {/* Arrow indicator for folders */}
                    {!isUp && (
                      <box width={2} flexShrink={0}>
                        <text fg='#484f58'>{isActive || isHovered ? '›' : ' '}</text>
                      </box>
                    )}
                  </box>
                  {/* Row separator */}
                  {!isLast && (
                    <box height={1} paddingLeft={1} paddingRight={1}>
                      <text fg='#21262d'>{'─'.repeat(999)}</text>
                    </box>
                  )}
                </box>
              )
            })}
          </box>
        </scrollbox>

        <box
          flexShrink={0}
          border={true}
          borderStyle='rounded'
          borderColor='#30363d'
          flexDirection='column'
          onMouseUp={clickHandler(() => {
            if (!validating) activateItem(CONFIRM_ITEM)
          })}
          marginLeft={1}
          marginRight={1}
        >
          <box flexDirection='row' height={1} paddingLeft={1} paddingRight={1}>
            <box width={3} flexShrink={0}>
              <text fg='#3fb950'>✓</text>
            </box>
            <box flexGrow={1}>
              <text fg='#3fb950' attributes={tuiAttrs({ bold: true })}>
                Use this directory
              </text>
            </box>
          </box>
        </box>
      </box>

      {/* Footer */}
      <box flexDirection='row' flexShrink={0} paddingLeft={1} marginTop={1} gap={2}>
        <text fg='#484f58'>↑↓ navigate ← back →/Enter open Click to select</text>
      </box>
    </box>
  ) as ReactElement
}
