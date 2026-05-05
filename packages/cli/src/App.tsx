import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyEvent } from '@opentui/core'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import { DashboardScreen } from './components/screens/DashboardScreen.js'
import { QuitScreen } from './components/screens/QuitScreen.js'
import { StartupScreen } from './components/screens/StartupScreen.js'
import { RuntimeController } from './runtime/controller.js'
import { clearCredentials } from './cli/profile.js'
import { deleteProfileTokenData } from './auth/token-store.js'
import type { AgentChatStatus, AgentConfig, LogEntry, IAgent } from './types/index.js'
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
  const [startupConfig, setStartupConfig] = useState<Partial<AgentConfig>>(initialConfig)
  const [runtimeState, setRuntimeState] = useState<RuntimeState | null>(null)
  const [sessionDetails, setSessionDetails] = useState<Map<string, SessionDetail>>(new Map())
  const [agentLogs, setAgentLogs] = useState<LogEntry[]>([])
  const [chatStatuses, setChatStatuses] = useState<Map<string, AgentChatStatus | string>>(new Map())
  const [hasMoreSessions, setHasMoreSessions] = useState(false)
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null)
  const controllerRef = useRef<RuntimeController | null>(null)

  const handleAuthError = useCallback(
    (reason: string) => {
      const profile = profileName ?? 'default'
      try {
        deleteProfileTokenData(profile)
      } catch {
        /* best-effort */
      }
      try {
        clearCredentials(profile)
      } catch {
        /* best-effort */
      }

      controllerRef.current?.disconnect()
      controllerRef.current = null

      setRuntimeState(null)
      setSessionDetails(new Map())
      setChatStatuses(new Map())
      setHasMoreSessions(false)
      setAgentLogs([])
      setStartupConfig((c) => ({
        ...c,
        apiKey: undefined,
        authType: undefined,
        workspace: undefined,
        project: undefined,
        workspaceDisplayName: undefined,
        projectDisplayName: undefined
      }))
      setAuthErrorMessage(reason)
      setScreen('startup')
    },
    [profileName]
  )

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

      controller.on('chat-status', (chatId: string, status: AgentChatStatus | string) => {
        setChatStatuses((prev) => new Map(prev).set(chatId, status))
      })

      controller.on('quit', () => {
        onExit()
      })

      controller.on('auth-error', (reason: string) => {
        handleAuthError(reason)
      })

      controller.connect()
      controllerRef.current = controller
      setRuntimeState(controller.getState())
      setScreen('dashboard')

      // Load initial agent chats from API
      void controller.loadAgentChats(0).then((more) => setHasMoreSessions(more))
    },
    [onExit, handleAuthError]
  )

  const handleQuitRequest = useCallback(() => {
    setScreen('quit-confirm')
  }, [])

  const handleQuit = useCallback((mode: QuitMode) => {
    controllerRef.current?.quit(mode)
    // Close the dialog; "now" exits the process right after, "after-current" keeps running until idle.
    setScreen('dashboard')
  }, [])

  const handleRestartSetupFromQuit = useCallback(() => {
    controllerRef.current?.disconnect()
    controllerRef.current = null
    setRuntimeState(null)
    setSessionDetails(new Map())
    setChatStatuses(new Map())
    setHasMoreSessions(false)
    setAgentLogs([])
    setStartupConfig(initialConfig)
    setAuthErrorMessage(null)
    setScreen('startup')
  }, [initialConfig])

  const handleQuitCancel = useCallback(() => {
    setScreen('dashboard')
  }, [])

  /** Sync chat status for a given session from the server. */
  const syncChatStatus = useCallback(async (chatId: string) => {
    const status = await controllerRef.current?.fetchChatStatus(chatId)
    if (status) {
      setChatStatuses((prev) => new Map(prev).set(chatId, status))
    }
  }, [])

  const handleLoadMessages = useCallback(
    (chatId: string, before?: string) => {
      void controllerRef.current?.loadSessionMessages(chatId, before)
      // Sync chat status and fetch full chat detail on initial load (not pagination)
      if (!before) {
        void syncChatStatus(chatId)
        void controllerRef.current?.loadChatDetail(chatId)
      }
    },
    [syncChatStatus]
  )

  const handleSendMessage = useCallback((chatId: string, content: string) => {
    void controllerRef.current?.sendUserMessage(chatId, content)
  }, [])

  const handleAbortChat = useCallback((chatId: string) => {
    void controllerRef.current?.abortChatSession(chatId)
  }, [])

  const handleSubscribeSession = useCallback((chatId: string) => {
    controllerRef.current?.subscribeSession(chatId)
  }, [])

  const handleUnsubscribeSession = useCallback((chatId: string) => {
    controllerRef.current?.unsubscribeSession(chatId)
  }, [])

  const handleLoadMoreSessions = useCallback(() => {
    const controller = controllerRef.current
    if (!controller) return
    const currentCount = runtimeState?.sessions.length ?? 0
    void controller.loadAgentChats(currentCount).then((more) => setHasMoreSessions(more))
  }, [runtimeState?.sessions.length])

  const handleEmitAgentSettings = useCallback((settings: Partial<NonNullable<IAgent['settings']>>) => {
    controllerRef.current?.emitAgentSettings(settings)
  }, [])

  const handleLoadRadarLists = useCallback(async () => {
    const controller = controllerRef.current
    if (!controller) return { components: [] as string[], environments: [] as string[] }
    return controller.listRadarDetections()
  }, [])

  useEffect(() => {
    return () => {
      controllerRef.current?.disconnect()
    }
  }, [])

  if (screen === 'startup') {
    return (
      <StartupScreen
        initialConfig={startupConfig}
        profileName={profileName}
        authErrorMessage={authErrorMessage}
        onComplete={(cfg) => {
          setAuthErrorMessage(null)
          handleStartupComplete(cfg)
        }}
      />
    )
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
            chatStatuses={chatStatuses}
            onQuitRequest={handleQuitRequest}
            onLoadMessages={handleLoadMessages}
            onSendMessage={handleSendMessage}
            onAbortChat={handleAbortChat}
            onSubscribeSession={handleSubscribeSession}
            onUnsubscribeSession={handleUnsubscribeSession}
            onLoadMoreSessions={handleLoadMoreSessions}
            hasMoreSessions={hasMoreSessions}
            suspendKeyboard={screen === 'quit-confirm'}
            onEmitAgentSettings={handleEmitAgentSettings}
            onLoadRadarLists={handleLoadRadarLists}
          />
        </box>
        {screen === 'quit-confirm' && (
          <QuitScreen onQuit={handleQuit} onCancel={handleQuitCancel} onRestartSetup={handleRestartSetupFromQuit} />
        )}
      </box>
    )
  }

  return null
}
