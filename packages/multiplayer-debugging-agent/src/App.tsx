import React, { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "ink";
import { DashboardScreen } from "./components/screens/DashboardScreen.js";
import { QuitScreen } from "./components/screens/QuitScreen.js";
import { StartupScreen } from "./components/screens/StartupScreen.js";
import { RuntimeController } from "./runtime/controller.js";
import type { AgentConfig } from "./types/index.js";
import type { QuitMode, RuntimeState, SessionDetail } from "./runtime/types.js";

type Screen = "startup" | "dashboard" | "quit-confirm";

interface Props {
  initialConfig: Partial<AgentConfig>;
  profileName?: string;
}

export const App: React.FC<Props> = ({ initialConfig, profileName }) => {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>("startup");
  const [runtimeState, setRuntimeState] = useState<RuntimeState | null>(null);
  const [sessionDetails, setSessionDetails] = useState<
    Map<string, SessionDetail>
  >(new Map());
  const controllerRef = useRef<RuntimeController | null>(null);

  const handleStartupComplete = useCallback(
    (config: AgentConfig) => {
      const controller = new RuntimeController(config);

      controller.on("state", (state: RuntimeState) => {
        setRuntimeState({ ...state });
      });

      controller.on(
        "session-detail",
        (chatId: string, detail: SessionDetail) => {
          setSessionDetails((prev) => new Map(prev).set(chatId, { ...detail }));
        }
      );

      controller.on("quit", () => {
        exit();
      });

      controller.connect();
      controllerRef.current = controller;
      setRuntimeState(controller.getState());
      setScreen("dashboard");
    },
    [exit]
  );

  const handleQuitRequest = useCallback(() => {
    setScreen("quit-confirm");
  }, []);

  const handleQuit = useCallback((mode: QuitMode) => {
    controllerRef.current?.quit(mode);
    console.clear();
  }, []);

  const handleQuitCancel = useCallback(() => {
    setScreen("dashboard");
  }, []);

  const handleLoadMessages = useCallback((chatId: string) => {
    void controllerRef.current?.loadSessionMessages(chatId);
  }, []);

  useEffect(() => {
    return () => {
      controllerRef.current?.disconnect();
    };
  }, []);

  if (screen === "startup") {
    return (
      <StartupScreen
        initialConfig={initialConfig}
        profileName={profileName}
        onComplete={handleStartupComplete}
      />
    );
  }

  if (screen === "quit-confirm") {
    return <QuitScreen onQuit={handleQuit} onCancel={handleQuitCancel} />;
  }

  if (screen === "dashboard" && runtimeState && controllerRef.current) {
    return (
      <DashboardScreen
        state={runtimeState}
        config={controllerRef.current.config}
        sessionDetails={sessionDetails}
        onQuitRequest={handleQuitRequest}
        onLoadMessages={handleLoadMessages}
      />
    );
  }

  return null;
};
