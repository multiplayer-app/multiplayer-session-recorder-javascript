import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyEvent } from '@opentui/core'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import { DashboardScreen } from './components/screens/DashboardScreen.js'
import { QuitScreen } from './components/screens/QuitScreen.js'
import { StartupScreen } from './components/screens/StartupScreen.js'
import { RuntimeController } from './runtime/controller.js'
import type { AgentConfig, LogEntry } from './types/index.js'
import type { QuitMode, RuntimeState, SessionDetail } from './runtime/types.js'

type Screen = 'startup' | 'dashboard' | 'quit-confirm'

const MAX_AGENT_LOGS = 500

interface Props {
  initialConfig: Partial<AgentConfig>
  profileName?: string
  onExit: () => void
}

export const App: React.FC<Props> = ({ initialConfig, profileName, onExit }) => {
  /** Raw TUI mode often delivers Ctrl+C as a key event, not SIGINT — mirror SIGINT handler from index.tsx. */
  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (key.ctrl && key.name === 'c' && !key.repeated) {
          key.stopPropagation()
          onExit()
        }
      },
      [onExit]
    )
  )

  const { width: termWidth, height: termHeight } = useTerminalDimensions()
  const [screen, setScreen] = useState<Screen>('startup')
  const [runtimeState, setRuntimeState] = useState<RuntimeState | null>(null)
  const [sessionDetails, setSessionDetails] = useState<Map<string, SessionDetail>>(new Map())
  const [agentLogs, setAgentLogs] = useState<LogEntry[]>([])
  const controllerRef = useRef<RuntimeController | null>(null)

  const handleStartupComplete = useCallback(
    (config: AgentConfig) => {
      setAgentLogs([])
      const tuiLogger = (level: LogEntry['level'], msg: string) => {
        setAgentLogs((prev) => {
          const entry: LogEntry = { timestamp: new Date(), level, message: msg }
          const next = [...prev, entry]
          return next.length > MAX_AGENT_LOGS ? next.slice(-MAX_AGENT_LOGS) : next
        })
      }
      const controller = new RuntimeController(config, tuiLogger)

      controller.on('state', (state: RuntimeState) => {
        setRuntimeState({ ...state })
      })

      controller.on('session-detail', (chatId: string, detail: SessionDetail) => {
        setSessionDetails((prev) => new Map(prev).set(chatId, { ...detail }))
      })

      controller.on('quit', () => {
        onExit()
      })

      controller.connect()
      controllerRef.current = controller
      setRuntimeState(controller.getState())
      setScreen('dashboard')
    },
    [onExit]
  )

  const handleQuitRequest = useCallback(() => {
    setScreen('quit-confirm')
  }, [])

  const handleQuit = useCallback((mode: QuitMode) => {
    controllerRef.current?.quit(mode)
    // Close the dialog; "now" exits the process right after, "after-current" keeps running until idle.
    setScreen('dashboard')
  }, [])

  const handleQuitCancel = useCallback(() => {
    setScreen('dashboard')
  }, [])

  const handleLoadMessages = useCallback((chatId: string, before?: string) => {
    void controllerRef.current?.loadSessionMessages(chatId, before)
  }, [])

  useEffect(() => {
    return () => {
      controllerRef.current?.disconnect()
    }
  }, [])

  if (screen === 'startup') {
    return <StartupScreen initialConfig={initialConfig} profileName={profileName} onComplete={handleStartupComplete} />
  }

  if ((screen === 'dashboard' || screen === 'quit-confirm') && runtimeState && controllerRef.current) {
    return (
      <box position='relative' width={termWidth} height={termHeight}>
        <box width={termWidth} height={termHeight}>
          <DashboardScreen
            state={runtimeState}
            config={controllerRef.current.config}
            sessionDetails={sessionDetails}
            agentLogs={agentLogs}
            onQuitRequest={handleQuitRequest}
            onLoadMessages={handleLoadMessages}
            suspendKeyboard={screen === 'quit-confirm'}
          />
        </box>
        {screen === 'quit-confirm' && <QuitScreen onQuit={handleQuit} onCancel={handleQuitCancel} />}
      </box>
    )
  }

  return null
}
