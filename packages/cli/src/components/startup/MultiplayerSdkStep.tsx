import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactElement,
  type SetStateAction
} from 'react'
import { useKeyboard } from '@opentui/react'
import { ScrollBoxRenderable } from '@opentui/core'
import { tuiAttrs } from '../../lib/tuiAttrs.js'
import type { AgentConfig } from '../../types/index.js'
import { detectStacks, summarizeDetection, type DetectedStack } from '../../session-recorder/detectStacks.js'
import {
  generateSetupPlan,
  applySetupPlan,
  classifyStacksWithAi,
  applyClassifications,
  createApiKeysForSetup,
  injectApiKeysIntoPlan,
  type CreatedApiKey,
  type SetupPlan
} from '../../session-recorder/setupWithAi.js'
import { Divider, clickHandler, FooterHints, ActionButton, AnimatedLoading, AiStatusLine } from '../shared/index.js'

// ─── Cross-stack context helpers ─────────────────────────────────────────────

function formatStackPath(stack: DetectedStack): string {
  return stack.relativePath !== '.' ? stack.relativePath : '(root)'
}

function buildUpcomingStacksSummary(queue: DetectedStack[], currentIdx: number): string {
  const upcoming = queue.slice(currentIdx + 1)
  if (upcoming.length === 0) return ''
  return upcoming.map((s) => `- ${formatStackPath(s)} — ${s.label} (type: ${s.type}, SDK: ${s.sdkPackage})`).join('\n')
}

function buildPriorSummary(plan: SetupPlan, stack: DetectedStack, keys: CreatedApiKey[] | null): string {
  const path = formatStackPath(stack)
  const files = plan.fileChanges.length
    ? plan.fileChanges.map((c) => `  - ${c.filePath} (${c.action}) — ${c.description}`).join('\n')
    : '  (none)'
  const envNames = plan.envVars.map((e) => e.name).join(', ') || '(none)'
  const matching =
    keys && keys.length > 0
      ? stack.type === 'backend'
        ? keys.find((k) => k.stackType === 'backend')
        : keys.find((k) => k.stackType === 'frontend')
      : undefined
  const keyLine = matching
    ? `- Shared ${matching.stackType} API key: ${matching.name} (reuse this — do not create another)`
    : '- API key: (none created)'
  const warnings = plan.warnings.length ? `\n- Warnings surfaced: ${plan.warnings.join(' | ')}` : ''
  return `### Stack: ${path} — ${stack.label}
- Framework detected: ${plan.detection.framework}
- Approach: ${plan.detection.approach}
- Install ran: ${plan.installCommand || '(none)'}
- Files applied (paths relative to ${path}):
${files}
- Env vars introduced: ${envNames}
${keyLine}${warnings}`
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase =
  | 'confirm' // 0. Ask the user before scanning
  | 'scanning' // 1. Detecting stacks (heuristic scan)
  | 'classifying' // 2. AI analyzes which stacks need the SDK
  | 'no-stacks' // 2a. Nothing detected — skip
  | 'already-done' // 2b. All stacks configured (installed / not-needed / covered)
  | 'results' // 3. Showing detected stacks, user picks action
  | 'partial' // 3a. Only frontend or backend found — show with warning
  | 'ai-planning' // 4. AI generating the setup plan for a stack
  | 'preview' // 5. Showing AI-generated plan for user approval
  | 'applying' // 6. Applying the plan + running install
  | 'done' // 7. Setup complete
  | 'error' // ✗ Something went wrong (retry / skip)

interface Props {
  config: Partial<AgentConfig>
  onComplete: (updates: Partial<AgentConfig>) => void
  onBack?: () => void
}

type Action = 'setup' | 'skip'
type PreviewAction = 'apply' | 'regenerate' | 'skip'
type ConfirmAction = 'detect' | 'skip'

const ACTIONS: { id: Action; label: string; description: string }[] = [
  {
    id: 'setup',
    label: 'Set up SDK',
    description: 'Analyze your project and generate integration changes'
  },
  { id: 'skip', label: 'Skip for now', description: 'You can set this up later' }
]

const CONFIRM_ACTIONS: { id: ConfirmAction; label: string; description: string }[] = [
  {
    id: 'detect',
    label: 'Start scanning',
    description: 'Scan this directory to find frameworks that need the Session Recorder SDK'
  },
  { id: 'skip', label: 'Skip for now', description: 'You can run setup later' }
]

const PREVIEW_ACTIONS: { id: PreviewAction; label: string }[] = [
  { id: 'apply', label: 'Apply changes' },
  { id: 'regenerate', label: 'Regenerate plan' },
  { id: 'skip', label: 'Skip' }
]

const STEP_TITLE = 'Multiplayer SDK'

type StatusGroup = 'needs-setup' | 'installed' | 'not-needed' | 'covered'
const STATUS_ORDER: StatusGroup[] = ['needs-setup', 'installed', 'covered', 'not-needed']
const STATUS_LABELS: Record<StatusGroup, string> = {
  'needs-setup': 'Needs Setup',
  installed: 'Installed',
  covered: 'Covered by Dependency',
  'not-needed': 'Not Needed'
}
const STATUS_COLORS: Record<StatusGroup, string> = {
  'needs-setup': '#f59e0b',
  installed: '#10b981',
  covered: '#8b5cf6',
  'not-needed': '#6b7280'
}

function getStatusGroup(s: DetectedStack): StatusGroup {
  if (s.sdkRelevance === 'installed' || (!s.sdkRelevance && s.alreadyInstalled)) return 'installed'
  if (s.sdkRelevance === 'not-needed') return 'not-needed'
  if (s.sdkRelevance === 'covered-by-dependency') return 'covered'
  return 'needs-setup'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sdkDisplayName(sdk: DetectedStack['sdkPackage']): string {
  if (sdk.startsWith('@multiplayer-app/')) return sdk
  return `multiplayer ${sdk.replace('multiplayer-', '')} SDK`
}

interface LogLineStyle {
  fg: string
  bold?: boolean
  dim?: boolean
  icon?: string
  text: string
}

function classifyLogLine(line: string): LogLineStyle {
  const headerMatch = line.match(/^── (.+) ──$/)
  if (headerMatch) {
    return { fg: '#22d3ee', bold: true, text: headerMatch[1]!, icon: '▸' }
  }
  if (line.startsWith('✓')) return { fg: '#10b981', text: line.slice(1).trimStart(), icon: '✓' }
  if (line.startsWith('✗')) return { fg: '#ef4444', text: line.slice(1).trimStart(), icon: '✗' }
  if (line.startsWith('⚠')) return { fg: '#f59e0b', text: line.slice(1).trimStart(), icon: '⚠' }
  if (line.startsWith('◌')) return { fg: '#60a5fa', text: line.slice(1).trimStart(), icon: '◌' }
  if (line.startsWith('·')) return { fg: '#8b949e', dim: true, text: line.slice(1).trimStart(), icon: '·' }
  if (line.startsWith('  ')) return { fg: '#8b949e', dim: true, text: line.trimStart() }
  if (line.endsWith(':') && line.length > 1) return { fg: '#c9d1d9', bold: true, text: line }
  return { fg: '#e6edf3', text: line }
}

function LogLineView({ line }: { line: string }): ReactElement {
  if (line.length === 0) {
    return (<text> </text>) as ReactElement
  }
  const { fg, bold, dim, icon, text } = classifyLogLine(line)
  return (
    <box flexDirection='row' gap={1}>
      {icon && (
        <box width={2} flexShrink={0}>
          <text fg={fg} attributes={tuiAttrs({ bold })}>
            {icon}
          </text>
        </box>
      )}
      <box flexGrow={1} flexShrink={1}>
        <text fg={fg} attributes={tuiAttrs({ bold, dim })}>
          {text}
        </text>
      </box>
    </box>
  ) as ReactElement
}

function parseApplyLog(log: string[]): { header: string | null; lines: string[] }[] {
  const sections: { header: string | null; lines: string[] }[] = []
  let current: { header: string | null; lines: string[] } = { header: null, lines: [] }
  sections.push(current)
  for (const line of log) {
    const m = line.match(/^── (.+) ──$/)
    if (m) {
      current = { header: m[1]!, lines: [] }
      sections.push(current)
    } else {
      current.lines.push(line)
    }
  }
  // Drop a leading empty preface section if nothing was logged before the first header
  if (sections[0] && sections[0].header === null && sections[0].lines.length === 0) {
    sections.shift()
  }
  return sections
}

function ApplyLogView({ applyLog }: { applyLog: string[] }): ReactElement {
  const sections = parseApplyLog(applyLog)
  if (sections.length === 0) return (<box />) as ReactElement
  return (
    <box flexDirection='column' gap={1}>
      {sections.map((section, i) => (
        <box key={i} flexDirection='column'>
          {section.header && (
            <box flexDirection='row' gap={1} marginBottom={0}>
              <text fg='#22d3ee' attributes={tuiAttrs({ bold: true })}>
                ▸ {section.header}
              </text>
            </box>
          )}
          {section.lines.map((line, j) => (
            <LogLineView key={j} line={line} />
          ))}
        </box>
      ))}
    </box>
  ) as ReactElement
}

interface ConfirmViewProps {
  dir: string | undefined
  selectedIndex: number
  hoveredRow: number | null
  setSelectedIndex: (index: number) => void
  setHoveredRow: Dispatch<SetStateAction<number | null>>
  onDetect: () => void
  onSkip: () => void
  onBack?: () => void
}

function ConfirmView({
  dir,
  selectedIndex,
  hoveredRow,
  setSelectedIndex,
  setHoveredRow,
  onDetect,
  onSkip,
  onBack
}: ConfirmViewProps): ReactElement {
  return (
    <box flexDirection='column' gap={1} flexGrow={1}>
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE}</text>
      <box flexDirection='column' gap={1}>
        <text>Scan this project for application stacks and set up the Multiplayer Session Recorder SDK?</text>
        {dir && (
          <box flexDirection='row' gap={1}>
            <text attributes={tuiAttrs({ dim: true })}>Directory:</text>
            <text fg='#e6edf3'>{dir}</text>
          </box>
        )}
      </box>

      <box
        border={true}
        flexShrink={0}
        flexDirection='column'
        borderStyle='rounded'
        borderColor='#30363d'
        overflow={'hidden' as const}
      >
        {CONFIRM_ACTIONS.map((action, i) => {
          const isActive = i === selectedIndex
          const isHovered = hoveredRow === i
          const isLast = i === CONFIRM_ACTIONS.length - 1
          const icon = action.id === 'detect' ? '◆' : '→'
          const iconColor = action.id === 'detect' ? '#22d3ee' : '#8b949e'
          return (
            <box
              key={action.id}
              flexDirection='column'
              onMouseUp={clickHandler(() => {
                setSelectedIndex(i)
                if (action.id === 'detect') onDetect()
                else onSkip()
              })}
              onMouseOver={() => setHoveredRow(i)}
              onMouseOut={() => setHoveredRow((v) => (v === i ? null : v))}
            >
              <box
                flexDirection='row'
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={isActive ? '#161b22' : isHovered ? '#21262d' : undefined}
              >
                <box width={3} flexShrink={0}>
                  <text fg={iconColor}>{icon}</text>
                </box>
                <box flexDirection='column' flexGrow={1} flexShrink={1}>
                  <text fg={isActive ? '#e6edf3' : '#c9d1d9'} attributes={tuiAttrs({ bold: isActive })}>
                    {action.label}
                  </text>
                  <box flexGrow={1} flexShrink={1}>
                    <text attributes={tuiAttrs({ dim: true })}>{action.description}</text>
                  </box>
                </box>
              </box>
              {!isLast && <Divider />}
            </box>
          )
        })}
      </box>

      <FooterHints hints={onBack ? '↑↓ navigate · Enter confirm · Esc back' : '↑↓ navigate · Enter confirm'} />
    </box>
  ) as ReactElement
}

function ScanningView(): ReactElement {
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE}</text>
      <box gap={2}>
        <text fg='#f59e0b'>◌</text>
        <text>Scanning project for application stacks...</text>
      </box>
    </box>
  ) as ReactElement
}

function NoStacksView({ onBack }: { onBack?: () => void }): ReactElement {
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE}</text>
      <box gap={2}>
        <text fg='#6b7280'>·</text>
        <text>No supported application stacks detected in this directory.</text>
      </box>
      <text attributes={tuiAttrs({ dim: true })}>
        Supported: React, Next.js, Vue, Angular, Svelte, React Native, Express, Fastify, NestJS, Python, Go, Ruby, Java,
        .NET
      </text>
      <FooterHints hints={onBack ? 'Enter continue · Esc back' : 'Enter continue'} marginTop={1} />
    </box>
  ) as ReactElement
}

function StackBadge({ stack }: { stack: DetectedStack }): ReactElement {
  const s = stack
  if (s.sdkRelevance === 'installed' || s.alreadyInstalled) {
    return (
      <text flexShrink={0} fg='#10b981'>
        ✓ installed
      </text>
    ) as ReactElement
  }
  if (s.sdkRelevance === 'not-needed') {
    return (
      <text flexShrink={0} fg='#6b7280'>
        SDK not needed
      </text>
    ) as ReactElement
  }
  if (s.sdkRelevance === 'covered-by-dependency') {
    return (
      <text flexShrink={0} fg='#8b5cf6'>
        ✓ covered by dependency
      </text>
    ) as ReactElement
  }
  return (
    <text flexShrink={0} fg='#f59e0b'>
      Needs setup
    </text>
  ) as ReactElement
}

function StackRow({
  stack,
  isLast,
  checkbox
}: {
  stack: DetectedStack
  isLast: boolean
  checkbox?: { checked: boolean; focused: boolean; onToggle: () => void }
}): ReactElement {
  const s = stack
  return (
    <box flexDirection='column'>
      <box
        flexDirection='row'
        gap={2}
        paddingRight={1}
        backgroundColor={checkbox?.focused ? '#161b22' : undefined}
        onMouseUp={checkbox ? clickHandler(checkbox.onToggle) : undefined}
      >
        {checkbox && (
          <text flexShrink={0} fg={checkbox.checked ? '#22d3ee' : '#484f58'}>
            {checkbox.checked ? '[✓]' : '[ ]'}
          </text>
        )}
        <box flexGrow={1} flexShrink={1} flexDirection='column'>
          <box flexDirection='row' gap={1} paddingRight={1}>
            <text flexShrink={0} fg='#e6edf3' attributes={tuiAttrs({ bold: true })}>
              {s.relativePath !== '.' ? s.relativePath : s.label}
            </text>
            <box flexGrow={1} flexShrink={1}>
              <text attributes={tuiAttrs({ dim: true })}>
                {s.label} — {sdkDisplayName(s.sdkPackage)}
              </text>
            </box>
          </box>
          {s.sdkRelevanceReason && (s.sdkRelevance === 'not-needed' || s.sdkRelevance === 'covered-by-dependency') && (
            <box flexGrow={1} flexShrink={1}>
              <text attributes={tuiAttrs({ dim: true })} fg='#6b7280'>
                {s.sdkRelevanceReason}
              </text>
            </box>
          )}
        </box>
        <StackBadge stack={s} />
      </box>
      {!isLast && <Divider />}
    </box>
  ) as ReactElement
}

function AlreadyDoneView({
  stacks,
  onContinue,
  onBack
}: {
  stacks: DetectedStack[]
  onContinue: () => void
  onBack?: () => void
}): ReactElement {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  return (
    <box flexDirection='column' gap={1} flexGrow={1}>
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE}</text>
      <box gap={1} flexDirection='row'>
        <text fg='#10b981'>✓</text>
        <text fg='#10b981'>All detected stacks are configured</text>
      </box>
      <text attributes={tuiAttrs({ dim: true })}>Detected stacks in your project:</text>
      <scrollbox ref={scrollRef} flexGrow={1} scrollY focused={false} style={PREVIEW_SCROLLBAR_STYLE}>
        <box flexDirection='column'>
          {stacks.map((s, i) => (
            <StackRow key={i} stack={s} isLast={i === stacks.length - 1} />
          ))}
        </box>
      </scrollbox>

      <ActionButton label='Continue' icon='→' iconColor='#10b981' onClick={onContinue} />
      <FooterHints hints={onBack ? 'Enter continue · Esc back' : 'Enter continue'} />
    </box>
  ) as ReactElement
}

interface AiPhaseAction {
  id: 'back' | 'skip'
  label: string
  description: string
  icon: string
  iconColor: string
  onSelect: () => void
}

function buildAiPhaseActions(onSkip: () => void, onBack?: () => void): AiPhaseAction[] {
  const actions: AiPhaseAction[] = []
  actions.push({
    id: 'skip',
    label: 'Skip for now',
    description: 'Continue without setting up the SDK',
    icon: '→',
    iconColor: '#8b949e',
    onSelect: onSkip
  })
  if (onBack) {
    actions.push({
      id: 'back',
      label: 'Back',
      description: 'Return to the previous step',
      icon: '←',
      iconColor: '#8b949e',
      onSelect: onBack
    })
  }
  return actions
}

function AiPhaseActionList({
  actions,
  selectedIndex,
  setSelectedIndex,
  hoveredRow,
  setHoveredRow
}: {
  actions: AiPhaseAction[]
  selectedIndex: number
  setSelectedIndex: (i: number) => void
  hoveredRow: number | null
  setHoveredRow: Dispatch<SetStateAction<number | null>>
}): ReactElement {
  return (
    <box
      border={true}
      flexShrink={0}
      flexDirection='column'
      borderStyle='rounded'
      borderColor='#30363d'
      overflow={'hidden' as const}
    >
      {actions.map((action, i) => {
        const isActive = i === selectedIndex
        const isHovered = hoveredRow === i
        const isLast = i === actions.length - 1
        return (
          <box
            key={action.id}
            flexDirection='column'
            onMouseUp={clickHandler(() => {
              setSelectedIndex(i)
              action.onSelect()
            })}
            onMouseOver={() => setHoveredRow(i)}
            onMouseOut={() => setHoveredRow((v) => (v === i ? null : v))}
          >
            <box
              flexDirection='row'
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={isActive ? '#161b22' : isHovered ? '#21262d' : undefined}
            >
              <box width={3} flexShrink={0}>
                <text fg={action.iconColor}>{action.icon}</text>
              </box>
              <box flexDirection='column' flexGrow={1} flexShrink={1}>
                <text fg={isActive ? '#e6edf3' : '#c9d1d9'} attributes={tuiAttrs({ bold: isActive })}>
                  {action.label}
                </text>
                <box flexGrow={1} flexShrink={1}>
                  <text attributes={tuiAttrs({ dim: true })}>{action.description}</text>
                </box>
              </box>
            </box>
            {!isLast && <Divider />}
          </box>
        )
      })}
    </box>
  ) as ReactElement
}

interface AiPhaseProps {
  actions: AiPhaseAction[]
  selectedIndex: number
  setSelectedIndex: (i: number) => void
  hoveredRow: number | null
  setHoveredRow: Dispatch<SetStateAction<number | null>>
}

function ClassifyingView({
  aiStatus,
  actions,
  selectedIndex,
  setSelectedIndex,
  hoveredRow,
  setHoveredRow
}: { aiStatus: string } & AiPhaseProps): ReactElement {
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE}</text>
      <AiStatusLine title='Analyzing your project structure' status={aiStatus} color='#a78bfa' />
      <AiPhaseActionList
        actions={actions}
        selectedIndex={selectedIndex}
        setSelectedIndex={setSelectedIndex}
        hoveredRow={hoveredRow}
        setHoveredRow={setHoveredRow}
      />
      <FooterHints hints='↑↓ navigate · Enter confirm · Esc back' />
    </box>
  ) as ReactElement
}

function AiPlanningView({
  stackLabel,
  aiStatus,
  actions,
  selectedIndex,
  setSelectedIndex,
  hoveredRow,
  setHoveredRow
}: { stackLabel: string; aiStatus: string } & AiPhaseProps): ReactElement {
  return (
    <box flexDirection='column' gap={1}>
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE}</text>
      <AiStatusLine title={`Preparing setup plan for ${stackLabel}`} status={aiStatus} color='#f59e0b' />
      <AiPhaseActionList
        actions={actions}
        selectedIndex={selectedIndex}
        setSelectedIndex={setSelectedIndex}
        hoveredRow={hoveredRow}
        setHoveredRow={setHoveredRow}
      />
      <FooterHints hints='↑↓ navigate · Enter confirm · Esc back' />
    </box>
  ) as ReactElement
}

const PREVIEW_SCROLLBAR_STYLE = {
  wrapperOptions: { flexGrow: 1 },
  viewportOptions: { flexGrow: 1 },
  scrollbarOptions: {
    showArrows: true,
    trackOptions: {
      foregroundColor: '#22d3ee',
      backgroundColor: '#374151'
    }
  }
}

interface PreviewViewProps {
  plan: SetupPlan
  selectedIndex: number
  hoveredRow: number | null
  setSelectedIndex: (index: number) => void
  setHoveredRow: Dispatch<SetStateAction<number | null>>
  onApply: () => void
  onRegenerate: () => void
  onSkip: () => void
}

function PreviewView({
  plan,
  selectedIndex,
  hoveredRow,
  setSelectedIndex,
  setHoveredRow,
  onApply,
  onRegenerate,
  onSkip
}: PreviewViewProps): ReactElement {
  const det = plan.detection
  const confidencePercent = Math.round((plan.confidence ?? 0) * 100)
  const previewScrollRef = useRef<ScrollBoxRenderable | null>(null)
  return (
    <box flexDirection='column' gap={1} flexGrow={1}>
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE} — Review Plan</text>

      <scrollbox ref={previewScrollRef} flexGrow={1} scrollY focused={false} style={PREVIEW_SCROLLBAR_STYLE}>
        <box flexDirection='column' gap={1}>
          <box flexDirection='column'>
            <box flexDirection='row' gap={1}>
              <text attributes={tuiAttrs({ dim: true })}>Framework:</text>
              <text fg='#e6edf3' attributes={tuiAttrs({ bold: true })}>
                {det.framework}
              </text>
            </box>
            <box flexDirection='row' gap={1}>
              <text attributes={tuiAttrs({ dim: true })}>Approach:</text>
              <text fg={det.approach === 'already-complete' ? '#10b981' : '#22d3ee'}>{det.approach}</text>
            </box>
            <box flexDirection='row' gap={1}>
              <text attributes={tuiAttrs({ dim: true })}>Confidence:</text>
              <text fg={confidencePercent >= 80 ? '#10b981' : confidencePercent >= 60 ? '#f59e0b' : '#ef4444'}>
                {confidencePercent}%
              </text>
            </box>
            {det.existingSetup.hasOpenTelemetry && (
              <box flexDirection='column'>
                <box flexDirection='row' gap={1}>
                  <text fg='#f59e0b'>⚡</text>
                  <box flexGrow={1} flexShrink={1}>
                    <text fg='#f59e0b'>
                      Existing OpenTelemetry found — will add Multiplayer OTLP exporter alongside existing setup
                    </text>
                  </box>
                </box>
                {det.existingSetup.existingOtlpEndpoint && (
                  <box flexDirection='row' gap={1} paddingLeft={3}>
                    <text attributes={tuiAttrs({ dim: true })}>Current endpoint:</text>
                    <text fg='#e6edf3'>{det.existingSetup.existingOtlpEndpoint}</text>
                  </box>
                )}
              </box>
            )}
            {det.existingSetup.hasMultiplayerSdk && (
              <box flexDirection='row' gap={1}>
                <text fg='#10b981'>✓</text>
                <text fg='#10b981'>Multiplayer SDK already present</text>
              </box>
            )}
            <box flexGrow={1} flexShrink={1}>
              <text attributes={tuiAttrs({ dim: true })}>{det.reasoning}</text>
            </box>
          </box>

          <box
            border={true}
            borderStyle='rounded'
            borderColor='#30363d'
            paddingLeft={1}
            paddingRight={1}
            flexShrink={0}
          >
            <box flexGrow={1} flexShrink={1}>
              <text fg='#22d3ee'>{plan.summary}</text>
            </box>
          </box>

          {plan.installCommand && (
            <box marginTop={1} flexDirection='row' gap={1}>
              <text attributes={tuiAttrs({ dim: true })}>Install:</text>
              <box flexGrow={1} flexShrink={1}>
                <text fg='#e6edf3'>{plan.installCommand}</text>
              </box>
            </box>
          )}

          {plan.steps.length > 0 && (
            <box flexDirection='column' marginTop={1}>
              <text attributes={tuiAttrs({ dim: true })}>Execution plan:</text>
              {plan.steps.map((step, i) => (
                <box key={i} flexDirection='row' gap={1}>
                  <text fg='#22d3ee' flexShrink={0}>
                    {i + 1}.
                  </text>
                  <box flexGrow={1} flexShrink={1}>
                    <text fg='#e6edf3'>{step}</text>
                  </box>
                </box>
              ))}
            </box>
          )}

          <box flexDirection='column' marginTop={1}>
            <text attributes={tuiAttrs({ dim: true })}>File changes ({plan.fileChanges.length}):</text>
            {plan.fileChanges.map((change, i) => (
              <box key={i} flexDirection='row' gap={1}>
                <text flexShrink={0} fg={change.action === 'create' ? '#10b981' : '#f59e0b'}>
                  {change.action === 'create' ? '+' : '~'}
                </text>
                <text flexShrink={0} fg='#e6edf3'>
                  {change.filePath}
                </text>
                <box flexGrow={1} flexShrink={1}>
                  <text attributes={tuiAttrs({ dim: true })}>— {change.description}</text>
                </box>
              </box>
            ))}
          </box>

          {plan.envVars.length > 0 && (
            <box flexDirection='column' marginTop={1}>
              <text attributes={tuiAttrs({ dim: true })}>Environment variables:</text>
              {plan.envVars.map((env, i) => (
                <box key={i} flexDirection='row' gap={1}>
                  <text flexShrink={0} fg='#22d3ee'>
                    {env.name}
                  </text>
                  <box flexGrow={1} flexShrink={1}>
                    <text attributes={tuiAttrs({ dim: true })}>— {env.description}</text>
                  </box>
                </box>
              ))}
            </box>
          )}

          {plan.warnings.length > 0 && (
            <box flexDirection='column' marginTop={1}>
              <text fg='#f59e0b' attributes={tuiAttrs({ bold: true })}>
                Review before applying:
              </text>
              {plan.warnings.map((warning, i) => (
                <box key={i} flexDirection='row' gap={1}>
                  <text fg='#f59e0b'>{warning}</text>
                </box>
              ))}
            </box>
          )}
        </box>
      </scrollbox>

      <box
        flexDirection='column'
        border={true}
        flexShrink={0}
        borderStyle='rounded'
        borderColor='#30363d'
        overflow={'hidden' as const}
      >
        {PREVIEW_ACTIONS.map((action, i) => {
          const isActive = i === selectedIndex
          const isHovered = hoveredRow === i
          const isLast = i === PREVIEW_ACTIONS.length - 1
          const icon = action.id === 'apply' ? '✓' : action.id === 'regenerate' ? '↻' : '→'
          const iconColor = action.id === 'apply' ? '#10b981' : action.id === 'regenerate' ? '#22d3ee' : '#8b949e'
          return (
            <box
              key={action.id}
              flexDirection='column'
              onMouseUp={clickHandler(() => {
                setSelectedIndex(i)
                if (action.id === 'apply') onApply()
                else if (action.id === 'regenerate') onRegenerate()
                else onSkip()
              })}
              onMouseOver={() => setHoveredRow(i)}
              onMouseOut={() => setHoveredRow((v) => (v === i ? null : v))}
            >
              <box
                id={`action-${i}`}
                flexDirection='row'
                height={1}
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={isActive ? '#161b22' : isHovered ? '#21262d' : undefined}
              >
                <box width={3} flexShrink={0}>
                  <text fg={iconColor}>{icon}</text>
                </box>
                <box flexGrow={1}>
                  <text fg={isActive ? '#e6edf3' : '#8b949e'} attributes={tuiAttrs({ bold: isActive })}>
                    {action.label}
                  </text>
                </box>
              </box>
              {!isLast && <Divider />}
            </box>
          )
        })}
      </box>

      <FooterHints hints='↑↓ select · Enter confirm · Esc back' />
    </box>
  ) as ReactElement
}

const LOG_SCROLLBAR_STYLE = {
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

function LogScrollBox({ applyLog }: { applyLog: string[] }): ReactElement {
  const ref = useRef<ScrollBoxRenderable | null>(null)
  return (
    <box
      border={true}
      borderStyle='rounded'
      borderColor='#30363d'
      paddingLeft={1}
      paddingRight={1}
      flexDirection='column'
      flexGrow={1}
      flexShrink={1}
      overflow={'hidden' as const}
    >
      <scrollbox ref={ref} flexGrow={1} scrollY focused={false} style={LOG_SCROLLBAR_STYLE}>
        <ApplyLogView applyLog={applyLog} />
      </scrollbox>
    </box>
  ) as ReactElement
}

function countStackSections(applyLog: string[]): number {
  return applyLog.filter((l) => /^── .+ ──$/.test(l)).length
}

function ApplyingView({ applyLog }: { applyLog: string[] }): ReactElement {
  return (
    <box flexDirection='column' gap={1} flexGrow={1}>
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE} — Applying</text>
      <AnimatedLoading title='Applying setup plan' />
      {applyLog.length > 0 && <LogScrollBox applyLog={applyLog} />}
    </box>
  ) as ReactElement
}

function DoneView({ applyLog }: { applyLog: string[] }): ReactElement {
  const stackCount = countStackSections(applyLog)
  const summary =
    stackCount === 0
      ? 'Session Recorder SDK has been set up'
      : stackCount === 1
        ? 'Session Recorder SDK configured for 1 stack'
        : `Session Recorder SDK configured for ${stackCount} stacks`
  return (
    <box flexDirection='column' gap={1} flexGrow={1}>
      <text attributes={tuiAttrs({ bold: true })} fg='#10b981'>
        {STEP_TITLE} — Complete
      </text>
      <box flexDirection='row' gap={1} flexShrink={0}>
        <text fg='#10b981'>✓</text>
        <text fg='#10b981' attributes={tuiAttrs({ bold: true })}>
          {summary}
        </text>
      </box>
      {applyLog.length > 0 && <LogScrollBox applyLog={applyLog} />}
      <FooterHints hints='Enter continue' />
    </box>
  ) as ReactElement
}

function ErrorView({ error, applyLog }: { error: string | null; applyLog: string[] }): ReactElement {
  return (
    <box flexDirection='column' gap={1} flexGrow={1}>
      <text attributes={tuiAttrs({ bold: true })} fg='#ef4444'>
        {STEP_TITLE} — Error
      </text>
      <box flexDirection='row' gap={1} flexShrink={0}>
        <text fg='#ef4444'>✗</text>
        <box flexGrow={1} flexShrink={1}>
          <text fg='#ef4444'>{error}</text>
        </box>
      </box>
      {applyLog.length > 0 && <LogScrollBox applyLog={applyLog} />}
      <FooterHints hints='Enter retry · Esc back' />
    </box>
  ) as ReactElement
}

interface ResultsViewProps {
  stacks: DetectedStack[]
  isPartial: boolean
  selectedIndex: number
  hoveredRow: number | null
  setSelectedIndex: (index: number) => void
  setHoveredRow: Dispatch<SetStateAction<number | null>>
  selectedStacks: Set<string>
  onToggleStack: (relativePath: string) => void
  onSetup: () => void
  onSkip: () => void
}

function ResultsView({
  stacks,
  isPartial,
  selectedIndex,
  hoveredRow,
  setSelectedIndex,
  setHoveredRow,
  selectedStacks,
  onToggleStack,
  onSetup,
  onSkip
}: ResultsViewProps): ReactElement {
  const summary = summarizeDetection(stacks)
  const detectedSide = summary.hasFrontend ? 'frontend' : 'backend'
  const missingSide = summary.hasFrontend ? 'backend' : 'frontend'
  const resultsScrollRef = useRef<ScrollBoxRenderable | null>(null)

  // Group stacks by status in display order
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    stacks: stacks.filter((s) => getStatusGroup(s) === status)
  })).filter((g) => g.stacks.length > 0)

  // Build checkable items in display order for cursor mapping
  const checkableInOrder: DetectedStack[] = []
  for (const group of grouped) {
    for (const s of group.stacks) {
      if (getStatusGroup(s) === 'needs-setup') {
        checkableInOrder.push(s)
      }
    }
  }

  const checkableCount = checkableInOrder.length
  const actionIdx = selectedIndex >= checkableCount ? selectedIndex - checkableCount : -1

  return (
    <box flexDirection='column' gap={1} flexGrow={1}>
      <text attributes={tuiAttrs({ bold: true })}>{STEP_TITLE}</text>
      <text attributes={tuiAttrs({ dim: true })} marginBottom={1}>
        Detected stacks in your project:
      </text>
      <scrollbox ref={resultsScrollRef} flexGrow={1} scrollY focused={false} style={PREVIEW_SCROLLBAR_STYLE}>
        <box flexDirection='column'>
          {grouped.map((group, gi) => (
            <box key={group.status} flexDirection='column'>
              <box paddingTop={gi > 0 ? 1 : 0}>
                <text fg={STATUS_COLORS[group.status]} attributes={tuiAttrs({ bold: true, underline: true })}>
                  {STATUS_LABELS[group.status]} ({group.stacks.length})
                </text>
              </box>
              <Divider />
              {group.stacks.map((s, si) => {
                const isCheckable = getStatusGroup(s) === 'needs-setup'
                const checkIdx = isCheckable ? checkableInOrder.indexOf(s) : -1
                const isFocused = checkIdx >= 0 && checkIdx === selectedIndex
                const isChecked = selectedStacks.has(s.relativePath)
                const isLastStack = gi === grouped.length - 1 && si === group.stacks.length - 1

                return (
                  <StackRow
                    key={si}
                    stack={s}
                    isLast={isLastStack}
                    checkbox={
                      isCheckable
                        ? {
                            checked: isChecked,
                            focused: isFocused,
                            onToggle: () => onToggleStack(s.relativePath)
                          }
                        : undefined
                    }
                  />
                )
              })}
            </box>
          ))}

          {isPartial && (
            <box marginTop={1} flexGrow={1} flexShrink={1}>
              <text fg='#f59e0b'>
                Only {detectedSide} detected. To set up the {missingSide}, run the CLI in the {missingSide} project
                directory.
              </text>
            </box>
          )}
        </box>
      </scrollbox>

      <box
        border={true}
        flexShrink={0}
        flexDirection='column'
        borderStyle='rounded'
        borderColor='#30363d'
        overflow={'hidden' as const}
      >
        {ACTIONS.map((action, i) => {
          const isDisabled = action.id === 'setup' && selectedStacks.size === 0
          const isActive = actionIdx === i && !isDisabled
          const isHovered = hoveredRow === i
          const isLast = i === ACTIONS.length - 1
          const icon = action.id === 'setup' ? '◆' : '→'
          const iconColor = isDisabled ? '#484f58' : action.id === 'setup' ? '#22d3ee' : '#8b949e'
          return (
            <box
              key={action.id}
              flexDirection='column'
              onMouseUp={
                isDisabled
                  ? undefined
                  : clickHandler(() => {
                      setSelectedIndex(checkableCount + i)
                      if (action.id === 'skip') onSkip()
                      else onSetup()
                    })
              }
              onMouseOver={() => setHoveredRow(i)}
              onMouseOut={() => setHoveredRow((v) => (v === i ? null : v))}
            >
              <box
                id={`action-${i}`}
                flexDirection='row'
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={isActive ? '#161b22' : isHovered && !isDisabled ? '#21262d' : undefined}
              >
                <box width={3} flexShrink={0}>
                  <text fg={iconColor}>{icon}</text>
                </box>
                <box flexDirection='column' flexGrow={1} flexShrink={1}>
                  <text
                    fg={isDisabled ? '#484f58' : isActive ? '#e6edf3' : action.id === 'setup' ? '#c9d1d9' : '#8b949e'}
                    attributes={tuiAttrs({ bold: isActive })}
                  >
                    {action.label}
                  </text>
                  <box flexGrow={1} flexShrink={1}>
                    <text attributes={tuiAttrs({ dim: true })}>
                      {isDisabled ? 'Select at least one stack above' : action.description}
                    </text>
                  </box>
                </box>
              </box>
              {!isLast && <Divider />}
            </box>
          )
        })}
      </box>

      <FooterHints hints='↑↓ navigate · Space toggle · Enter confirm' />
    </box>
  ) as ReactElement
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MultiplayerSdkStep({ config, onComplete, onBack }: Props): ReactElement {
  const [phase, setPhase] = useState<Phase>(config.skipSdkCheck ? 'scanning' : 'confirm')
  const [stacks, setStacks] = useState<DetectedStack[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [hoveredRow, setHoveredRow] = useState<number | null>(null)
  const [plan, setPlan] = useState<SetupPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [applyLog, setApplyLog] = useState<string[]>([])
  const [aiStatus, setAiStatus] = useState('')
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [selectedStacks, setSelectedStacks] = useState<Set<string>>(new Set())
  const [currentStackIdx, setCurrentStackIdx] = useState(0)
  const createdKeysRef = useRef<CreatedApiKey[] | null>(null)
  const setupQueueRef = useRef<DetectedStack[]>([])
  const priorSummariesRef = useRef<string[]>([])

  const needsSetup = stacks.filter((s) => getStatusGroup(s) === 'needs-setup')
  const selectedForSetup = needsSetup.filter((s) => selectedStacks.has(s.relativePath))

  const toggleStack = (relativePath: string) => {
    setSelectedStacks((prev) => {
      const next = new Set(prev)
      if (next.has(relativePath)) next.delete(relativePath)
      else next.add(relativePath)
      return next
    })
  }

  // ─── Honor skipSdkCheck flag (no confirmation needed) ──────────────────────

  useEffect(() => {
    if (config.skipSdkCheck) {
      onComplete({ sessionRecorderSetupDone: true })
    }
  }, [config.skipSdkCheck])

  // ─── Run detection (triggered from the confirm screen) ─────────────────────

  const runDetection = () => {
    if (!config.dir) {
      setPhase('no-stacks')
      return
    }

    setPhase('scanning')
    const detected = detectStacks(config.dir)
    setStacks(detected)

    if (detected.length === 0) {
      setPhase('no-stacks')
      return
    }

    const summary = summarizeDetection(detected)

    if (summary.allInstalled) {
      setPhase('already-done')
      return
    }

    // If we have a model configured and multiple stacks, use AI to classify
    if (config.model && detected.length > 1) {
      setSelectedIndex(0)
      setPhase('classifying')
      void runAiClassification(detected)
    } else {
      // Fallback: use heuristic classification
      for (const s of detected) {
        s.sdkRelevance = s.alreadyInstalled ? 'installed' : 'needed'
      }
      setStacks([...detected])
      transitionToResults(detected)
    }
  }

  const transitionToResults = (classified: DetectedStack[]) => {
    const summary = summarizeDetection(classified)
    // After classification, check if all relevant stacks are installed or not-needed
    const actionable = classified.filter((s) => s.sdkRelevance === 'needed')
    setSelectedStacks(new Set(actionable.map((s) => s.relativePath)))
    if (actionable.length === 0) {
      setPhase('already-done')
      return
    }

    const onlyFrontend = summary.hasFrontend && !summary.hasBackend
    const onlyBackend = summary.hasBackend && !summary.hasFrontend
    if (onlyFrontend || onlyBackend) {
      setPhase('partial')
      return
    }

    setPhase('results')
  }

  // ─── AI classification ────────────────────────────────────────────────────

  const runAiClassification = async (detected: DetectedStack[]) => {
    const controller = new AbortController()
    abortRef.current = controller
    setAiStatus('')
    try {
      const result = await classifyStacksWithAi(
        detected,
        config.dir!,
        config.model!,
        config.modelKey ?? '',
        config.modelUrl,
        (s) => {
          if (!controller.signal.aborted) setAiStatus(s)
        }
      )

      if (controller.signal.aborted) return

      if (result.success) {
        applyClassifications(detected, result.classifications)
      } else {
        // Fallback to heuristic on AI failure
        for (const s of detected) {
          s.sdkRelevance = s.alreadyInstalled ? 'installed' : 'needed'
        }
      }

      setStacks([...detected])
      transitionToResults(detected)
    } catch {
      if (controller.signal.aborted) return
      // Fallback to heuristic
      for (const s of detected) {
        s.sdkRelevance = s.alreadyInstalled ? 'installed' : 'needed'
      }
      setStacks([...detected])
      transitionToResults(detected)
    } finally {
      abortRef.current = null
    }
  }

  // ─── AI planning ───────────────────────────────────────────────────────────

  const startSetupSequence = () => {
    const queue = [...selectedForSetup]
    if (!config.model || queue.length === 0) {
      setError('Model is not configured or no stacks selected')
      setPhase('error')
      return
    }
    setupQueueRef.current = queue
    createdKeysRef.current = null
    priorSummariesRef.current = []
    setApplyLog([])
    setCurrentStackIdx(0)
    void runAiPlanning(0)
  }

  const runAiPlanning = async (stackIdx: number) => {
    const queue = setupQueueRef.current
    const stack = queue[stackIdx]
    if (!stack || !config.model) {
      setError('No stack to plan for')
      setPhase('error')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller

    setCurrentStackIdx(stackIdx)
    setPlan(null)
    setSelectedIndex(0)
    setPhase('ai-planning')
    setError(null)
    setAiStatus('')

    try {
      const upcomingStacks = buildUpcomingStacksSummary(queue, stackIdx)
      const result = await generateSetupPlan(
        stack,
        config.model,
        config.modelKey ?? '',
        config.modelUrl,
        (s) => {
          if (!controller.signal.aborted) setAiStatus(s)
        },
        {
          priorSummaries: priorSummariesRef.current,
          upcomingStacks
        }
      )

      if (controller.signal.aborted) return

      if (result.success && result.plan) {
        setPlan(result.plan)
        setSelectedIndex(0)
        setPhase('preview')
      } else {
        setError(result.error ?? 'Failed to generate setup plan')
        setPhase('error')
      }
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      setError((err as Error).message)
      setPhase('error')
    } finally {
      abortRef.current = null
    }
  }

  const advanceOrFinish = (nextIdx: number) => {
    const queue = setupQueueRef.current
    if (nextIdx < queue.length) {
      void runAiPlanning(nextIdx)
    } else {
      setPhase('done')
    }
  }

  const skipCurrentStack = () => {
    advanceOrFinish(currentStackIdx + 1)
  }

  // ─── Apply plan ────────────────────────────────────────────────────────────

  const applyPlan = async () => {
    const queue = setupQueueRef.current
    const stack = queue[currentStackIdx]
    if (!plan || !stack) return
    setPhase('applying')
    const log = [...applyLog]
    const stackTag = `[${stack.relativePath !== '.' ? stack.relativePath : stack.label}]`
    log.push(`── ${stackTag} ──`)
    setApplyLog([...log])

    try {
      // 1. Create Multiplayer API keys on the first stack (shared across frontend/backend)
      if (createdKeysRef.current === null && config.workspace && config.project && config.apiKey) {
        log.push('◌ Creating Multiplayer API keys...')
        setApplyLog([...log])

        const { keys, errors: keyErrors } = await createApiKeysForSetup(queue, {
          url: config.url!,
          apiKey: config.apiKey,
          workspace: config.workspace,
          project: config.project
        })

        createdKeysRef.current = keys
        log.pop()
        for (const err of keyErrors) log.push(`⚠ ${err}`)
        if (keys.length > 0) {
          for (const k of keys) log.push(`✓ Created ${k.stackType} API key: ${k.name}`)
        } else if (keyErrors.length === 0) {
          log.push('· No API keys needed')
        }
        setApplyLog([...log])
      }

      // Inject the right API key for THIS stack's type
      if (createdKeysRef.current && createdKeysRef.current.length > 0) {
        injectApiKeysIntoPlan(plan, createdKeysRef.current, stack.type)
      }

      // 2. Write file changes to the stack's own root (not config.dir — monorepos)
      const written = applySetupPlan(plan, stack.root)
      for (const f of written) log.push(`✓ ${f}`)

      // 3. Run install command from the stack's root
      if (plan.installCommand) {
        log.push(`◌ Running: ${plan.installCommand}`)
        setApplyLog([...log])

        const { exec } = await import('child_process')
        const { promisify } = await import('util')
        const execAsync = promisify(exec)
        await execAsync(plan.installCommand, { cwd: stack.root, timeout: 120_000 })
        log[log.length - 1] = `✓ ${plan.installCommand}`
      }

      // 4. Note env vars (the AI emits .env as a fileChange; this is just a summary)
      if (plan.envVars.length > 0) {
        log.push('Environment variables added:')
        for (const env of plan.envVars) {
          log.push(`  ${env.name}  # ${env.description}`)
        }
      }

      setApplyLog(log)

      // Record what this stack accomplished so the next agent has context
      priorSummariesRef.current = [...priorSummariesRef.current, buildPriorSummary(plan, stack, createdKeysRef.current)]

      advanceOrFinish(currentStackIdx + 1)
    } catch (err: unknown) {
      log.push(`✗ ${(err as Error).message}`)
      setApplyLog(log)
      setError((err as Error).message)
      setPhase('error')
    }
  }

  // ─── Keyboard ──────────────────────────────────────────────────────────────

  useKeyboard(({ name }) => {
    if (phase === 'scanning' || phase === 'applying') return

    // Confirm phase: navigate the two actions, Enter confirms, Esc = back
    if (phase === 'confirm') {
      if (name === 'up' || name === 'left') {
        setSelectedIndex((i) => Math.max(0, i - 1))
      } else if (name === 'down' || name === 'right') {
        setSelectedIndex((i) => Math.min(CONFIRM_ACTIONS.length - 1, i + 1))
      } else if (name === 'return') {
        const action = CONFIRM_ACTIONS[selectedIndex]
        if (action?.id === 'detect') {
          setSelectedIndex(0)
          runDetection()
        } else if (action?.id === 'skip') {
          onComplete({ sessionRecorderSetupDone: true })
        }
      } else if (name === 'escape' && onBack) {
        onBack()
      }
      return
    }

    // During AI phases: navigate Back/Skip actions with arrows, Enter confirms, Esc = back
    if (phase === 'classifying' || phase === 'ai-planning') {
      const actions = buildAiPhaseActions(handleSkip, handleBack)
      if (name === 'up' || name === 'left') {
        setSelectedIndex((i) => Math.max(0, i - 1))
      } else if (name === 'down' || name === 'right') {
        setSelectedIndex((i) => Math.min(actions.length - 1, i + 1))
      } else if (name === 'return') {
        const action = actions[selectedIndex]
        if (action) action.onSelect()
      } else if (name === 'escape') {
        abortRef.current?.abort()
        abortRef.current = null
        if (onBack) onBack()
        else onComplete({ sessionRecorderSetupDone: true })
      }
      return
    }

    // Simple continue phases — Enter advances, Esc goes back (except after 'done', where files are already written)
    if (phase === 'no-stacks' || phase === 'already-done' || phase === 'done') {
      if (name === 'return') {
        onComplete({ sessionRecorderSetupDone: true })
      } else if (name === 'escape' && phase !== 'done' && onBack) {
        onBack()
      }
      return
    }

    // Error: retry current stack or skip
    if (phase === 'error') {
      if (name === 'return') {
        void runAiPlanning(currentStackIdx) // retry current stack
      } else if (name === 'escape') {
        onComplete({ sessionRecorderSetupDone: true })
      }
      return
    }

    // Results & partial: navigate checkboxes + action buttons
    if (phase === 'results' || phase === 'partial') {
      const checkableCount = needsSetup.length
      const totalItems = checkableCount + ACTIONS.length
      if (name === 'up' || name === 'left') {
        setSelectedIndex((i) => Math.max(0, i - 1))
      } else if (name === 'down' || name === 'right') {
        setSelectedIndex((i) => Math.min(totalItems - 1, i + 1))
      } else if (name === 'space' || name === 'return') {
        if (selectedIndex < checkableCount) {
          const stack = needsSetup[selectedIndex]
          if (stack) toggleStack(stack.relativePath)
        } else {
          const actionIdx = selectedIndex - checkableCount
          const action = ACTIONS[actionIdx]
          if (action?.id === 'skip') {
            onComplete({ sessionRecorderSetupDone: true })
          } else if (action?.id === 'setup' && selectedForSetup.length > 0) {
            startSetupSequence()
          }
        }
      }
      return
    }

    // Preview: navigate preview actions
    if (phase === 'preview') {
      if (name === 'up' || name === 'left') {
        setSelectedIndex((i) => Math.max(0, i - 1))
      } else if (name === 'down' || name === 'right') {
        setSelectedIndex((i) => Math.min(PREVIEW_ACTIONS.length - 1, i + 1))
      } else if (name === 'return') {
        const action = PREVIEW_ACTIONS[selectedIndex]
        if (action?.id === 'apply') {
          void applyPlan()
        } else if (action?.id === 'regenerate') {
          setSelectedIndex(0)
          void runAiPlanning(currentStackIdx)
        } else if (action?.id === 'skip') {
          // Skip THIS stack and move to next (or finish if last)
          skipCurrentStack()
        }
      } else if (name === 'escape') {
        setSelectedIndex(0)
        setPhase(stacks.some((s) => getStatusGroup(s) === 'needs-setup') ? 'results' : 'already-done')
      }
    }
  })

  useLayoutEffect(() => {
    scrollRef.current?.scrollChildIntoView(`action-${selectedIndex}`)
  }, [selectedIndex])

  const handleContinue = () => {
    onComplete({ sessionRecorderSetupDone: true })
  }
  const handleSkip = () => {
    abortRef.current?.abort()
    abortRef.current = null
    onComplete({ sessionRecorderSetupDone: true })
  }
  const handleBack = onBack
    ? () => {
        abortRef.current?.abort()
        abortRef.current = null
        onBack()
      }
    : undefined
  // ─── Render: ordered by phase flow ─────────────────────────────────────────

  switch (phase) {
    case 'confirm':
      return (
        <ConfirmView
          dir={config.dir}
          selectedIndex={Math.min(selectedIndex, CONFIRM_ACTIONS.length - 1)}
          hoveredRow={hoveredRow}
          setSelectedIndex={setSelectedIndex}
          setHoveredRow={setHoveredRow}
          onDetect={() => {
            setSelectedIndex(0)
            runDetection()
          }}
          onSkip={() => onComplete({ sessionRecorderSetupDone: true })}
          onBack={onBack}
        />
      ) as ReactElement
    case 'scanning':
      return (<ScanningView />) as ReactElement
    case 'classifying': {
      const actions = buildAiPhaseActions(handleSkip, handleBack)
      return (
        <ClassifyingView
          aiStatus={aiStatus}
          actions={actions}
          selectedIndex={Math.min(selectedIndex, actions.length - 1)}
          setSelectedIndex={setSelectedIndex}
          hoveredRow={hoveredRow}
          setHoveredRow={setHoveredRow}
        />
      ) as ReactElement
    }
    case 'no-stacks':
      return (<NoStacksView onBack={onBack} />) as ReactElement
    case 'already-done':
      return (<AlreadyDoneView stacks={stacks} onContinue={handleContinue} onBack={onBack} />) as ReactElement
    case 'ai-planning': {
      const queue = setupQueueRef.current
      const stack = queue[currentStackIdx]
      const progress = queue.length > 1 ? `Stack ${currentStackIdx + 1} of ${queue.length}: ` : ''
      const actions = buildAiPhaseActions(handleSkip, handleBack)
      return (
        <AiPlanningView
          stackLabel={`${progress}${stack?.label ?? 'detected stack'}`}
          aiStatus={aiStatus}
          actions={actions}
          selectedIndex={Math.min(selectedIndex, actions.length - 1)}
          setSelectedIndex={setSelectedIndex}
          hoveredRow={hoveredRow}
          setHoveredRow={setHoveredRow}
        />
      ) as ReactElement
    }
    case 'preview':
      return plan
        ? ((
            <PreviewView
              plan={plan}
              selectedIndex={selectedIndex}
              hoveredRow={hoveredRow}
              setSelectedIndex={setSelectedIndex}
              setHoveredRow={setHoveredRow}
              onApply={() => void applyPlan()}
              onRegenerate={() => void runAiPlanning(currentStackIdx)}
              onSkip={skipCurrentStack}
            />
          ) as ReactElement)
        : ((<ScanningView />) as ReactElement)
    case 'applying':
      return (<ApplyingView applyLog={applyLog} />) as ReactElement
    case 'done':
      return (<DoneView applyLog={applyLog} />) as ReactElement
    case 'error':
      return (<ErrorView error={error} applyLog={applyLog} />) as ReactElement
    case 'results':
    case 'partial':
      return (
        <ResultsView
          stacks={stacks}
          isPartial={phase === 'partial'}
          selectedIndex={selectedIndex}
          hoveredRow={hoveredRow}
          setSelectedIndex={setSelectedIndex}
          setHoveredRow={setHoveredRow}
          selectedStacks={selectedStacks}
          onToggleStack={toggleStack}
          onSetup={startSetupSequence}
          onSkip={handleContinue}
        />
      ) as ReactElement
  }
}
