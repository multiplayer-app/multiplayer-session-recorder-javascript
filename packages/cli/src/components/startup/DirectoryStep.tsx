import { useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { ScrollBoxRenderable } from '@opentui/core'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import fs from 'fs'
import path from 'path'
import type { AgentConfig } from '../../types/index.js'
import * as GitService from '../../services/git.service.js'
import { clickHandler, ActionButton, FooterHints, Divider, InputField } from '../shared/index.js'
import { stringFromInputSubmit } from '../../lib/inputSubmit.js'

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

interface DirEntry {
  name: string
  createdAt: Date
  modifiedAt: Date
}

type SortField = 'name' | 'createdAt' | 'modifiedAt'
const SORT_OPTIONS: { id: SortField; label: string }[] = [
  { id: 'name', label: 'Name' },
  { id: 'modifiedAt', label: 'Modified' },
  { id: 'createdAt', label: 'Created' }
]

function readDirs(dirPath: string): DirEntry[] {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !IGNORED_DIRS.has(e.name))
      .map((e) => {
        const stat = fs.statSync(path.join(dirPath, e.name))
        return { name: e.name, createdAt: stat.birthtime, modifiedAt: stat.mtime }
      })
  } catch {
    return []
  }
}

interface Props {
  config: Partial<AgentConfig>
  title?: string
  allowCreateFolder?: boolean
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

function formatRelativeDate(date: Date): string {
  const now = Date.now()
  const diff = now - date.getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export function DirectoryStep({ config, title = 'Select repository directory', allowCreateFolder, onComplete }: Props): ReactElement {
  useTerminalDimensions()
  const [currentPath, setCurrentPath] = useState(config.dir ?? process.cwd())
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [hoveredBreadcrumb, setHoveredBreadcrumb] = useState<number | null>(null)
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  const [sortBy, setSortBy] = useState<SortField>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const isRoot = currentPath === path.parse(currentPath).root
  const dirs = useMemo(() => readDirs(currentPath), [currentPath])
  const sortedDirs = useMemo(() => {
    const sorted = [...dirs]
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'createdAt':
          return a.createdAt.getTime() - b.createdAt.getTime()
        case 'modifiedAt':
          return a.modifiedAt.getTime() - b.modifiedAt.getTime()
      }
    })
    if (!sortAsc) sorted.reverse()
    return sorted
  }, [dirs, sortBy, sortAsc])
  const dirMap = useMemo(() => new Map(sortedDirs.map((d) => [d.name, d])), [sortedDirs])
  const items = useMemo(() => [...(isRoot ? [] : [UP_ITEM]), ...sortedDirs.map((d) => d.name)], [isRoot, sortedDirs])

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortAsc((v) => !v)
    } else {
      setSortBy(field)
      setSortAsc(field === 'name')
    }
  }

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
        .catch(() => false)
        .then((isGit) => {
          setValidating(false)
          onComplete({ dir: currentPath, ...(isGit ? {} : { noGitBranch: true }) })
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

  const handleCreateFolder = (rawName: string) => {
    const trimmed = rawName.trim()
    if (!trimmed) {
      setCreatingFolder(false)
      setNewFolderName('')
      return
    }
    try {
      const newPath = path.join(currentPath, trimmed)
      fs.mkdirSync(newPath, { recursive: true })
      setCurrentPath(newPath)
      setSelectedIndex(-1)
      setError(null)
    } catch (err: any) {
      setError(`Could not create folder: ${err.message}`)
    }
    setCreatingFolder(false)
    setNewFolderName('')
  }

  useKeyboard((key) => {
    if (creatingFolder) {
      if (key.name === 'escape') {
        setCreatingFolder(false)
        setNewFolderName('')
        key.stopPropagation()
      }
      return
    }
    if (validating) return
    const { name } = key
    if (name === 'up') {
      setSelectedIndex((i) => Math.max(-1, i - 1))
    } else if (name === 'down') {
      setSelectedIndex((i) => Math.min(items.length - 1, i + 1))
    } else if (name === 'pageup') {
      const sb = scrollRef.current
      if (sb) {
        sb.scrollBy(-0.5, 'viewport')
        key.stopPropagation()
      }
      setSelectedIndex((i) => Math.max(-1, i - 10))
    } else if (name === 'pagedown') {
      const sb = scrollRef.current
      if (sb) {
        sb.scrollBy(0.5, 'viewport')
        key.stopPropagation()
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
    } else if (name === 'n' && allowCreateFolder) {
      setCreatingFolder(true)
    } else if (name === 'tab') {
      key.stopPropagation()
      if (key.shift) {
        setSortAsc((v) => !v)
      } else {
        const idx = SORT_OPTIONS.findIndex((o) => o.id === sortBy)
        const next = SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length]!
        setSortBy(next.id)
      }
    }
  })

  return (
    <box flexDirection='column' flexGrow={1}>
      {/* Title */}
      <box flexShrink={0} paddingLeft={1} marginBottom={1}>
        <text attributes={tuiAttrs({ bold: true })} fg='#e6edf3'>
          {title}
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
        {/* Column headers — aligned with row layout */}
        <box flexDirection='row' flexShrink={0} height={1} paddingLeft={1} paddingRight={1}>
          <box width={3} flexShrink={0} />
          <box flexGrow={1}>
            <text
              fg={sortBy === 'name' ? '#58a6ff' : '#484f58'}
              attributes={tuiAttrs({ bold: sortBy === 'name' })}
              onMouseUp={clickHandler(() => toggleSort('name'))}
            >
              Name{sortBy === 'name' ? (sortAsc ? ' ↑' : ' ↓') : ''}
            </text>
          </box>
          <box flexShrink={0} flexDirection='row' gap={1}>
            <box width={11} flexShrink={0}>
              <text
                fg={sortBy === 'modifiedAt' ? '#58a6ff' : '#484f58'}
                attributes={tuiAttrs({ bold: sortBy === 'modifiedAt' })}
                onMouseUp={clickHandler(() => toggleSort('modifiedAt'))}
              >
                Modified{sortBy === 'modifiedAt' ? (sortAsc ? ' ↑' : ' ↓') : ''}
              </text>
            </box>
            <text fg='#30363d'>│</text>
            <box width={11} flexShrink={0}>
              <text
                fg={sortBy === 'createdAt' ? '#58a6ff' : '#484f58'}
                attributes={tuiAttrs({ bold: sortBy === 'createdAt' })}
                onMouseUp={clickHandler(() => toggleSort('createdAt'))}
              >
                Created{sortBy === 'createdAt' ? (sortAsc ? ' ↑' : ' ↓') : ''}
              </text>
            </box>
          </box>
          <box width={2} flexShrink={0} />
        </box>
        <Divider />

        <scrollbox ref={scrollRef} flexGrow={1} scrollY focused={false} style={SCROLLBAR_STYLE}>
          <box flexDirection='column' flexShrink={0} width='100%'>
            {items.map((item, i) => {
              const isActive = i === selectedIndex
              const isLast = i === items.length - 1
              const isUp = item === UP_ITEM

              const icon = isUp ? '' : '📁'
              const label = isUp ? '../' : item
              const nameFg = isActive ? '#e6edf3' : isUp ? '#8b949e' : '#c9d1d9'
              const entry = isUp ? null : dirMap.get(item)

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
                    {/* Timestamps */}
                    {entry && (
                      <box flexShrink={0} flexDirection='row' gap={1}>
                        <box width={11} flexShrink={0}>
                          <text fg='#484f58'>{formatRelativeDate(entry.modifiedAt)}</text>
                        </box>
                        <text fg='#30363d'>│</text>
                        <box width={11} flexShrink={0}>
                          <text fg='#484f58'>{formatRelativeDate(entry.createdAt)}</text>
                        </box>
                      </box>
                    )}
                    {/* Arrow indicator for folders */}
                    {!isUp && (
                      <box width={2} flexShrink={0}>
                        <text fg='#484f58'>{isActive || isHovered ? '›' : ' '}</text>
                      </box>
                    )}
                  </box>
                  {/* Row separator */}
                  {!isLast && <Divider />}
                </box>
              )
            })}
          </box>
        </scrollbox>

        <box marginLeft={1} marginRight={1} flexShrink={0} flexDirection='column'>
          {creatingFolder ? (
            <box flexDirection='column' gap={0}>
              <text fg='#c9d1d9' paddingLeft={1}>New folder name:</text>
              <InputField
                value={newFolderName}
                onInput={setNewFolderName}
                onSubmit={(p) => handleCreateFolder(stringFromInputSubmit(p, newFolderName))}
                placeholder='my-project'
              />
            </box>
          ) : (
            <box flexDirection='column' gap={0}>
              <ActionButton
                label='Use this directory'
                icon='✓'
                iconColor='#3fb950'
                labelColor='#3fb950'
                onClick={() => {
                  if (!validating) activateItem(CONFIRM_ITEM)
                }}
              />
              {allowCreateFolder && (
                <ActionButton
                  label='New folder'
                  icon='+'
                  iconColor='#58a6ff'
                  labelColor='#58a6ff'
                  onClick={() => setCreatingFolder(true)}
                />
              )}
            </box>
          )}
        </box>
      </box>

      {/* Footer */}
      <FooterHints
        hints={
          creatingFolder
            ? 'Enter create · Esc cancel'
            : allowCreateFolder
              ? '↑↓ navigate · ← back · →/Enter open · Tab sort · n new folder'
              : '↑↓ navigate · ← back · →/Enter open · Tab sort · ⇧Tab reverse'
        }
        paddingLeft={1}
        marginTop={1}
      />
    </box>
  ) as ReactElement
}
