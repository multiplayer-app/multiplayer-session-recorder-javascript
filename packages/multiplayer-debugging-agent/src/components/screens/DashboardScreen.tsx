import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import type { RuntimeState, SessionDetail } from "../../runtime/types.js";
import type { AgentConfig } from "../../types/index.js";
import { SessionListPane } from "../panes/SessionListPane.js";
import {
  SessionDetailPane,
  getSessionDisplayRowCount,
} from "../panes/SessionDetailPane.js";
import { FooterHints } from "../panes/FooterHints.js";

type ConnectionState = RuntimeState["connection"];

const CONNECTION_BADGE: Record<
  ConnectionState,
  { symbol: string; color: string }
> = {
  idle: { symbol: "○", color: "gray" },
  connecting: { symbol: "○", color: "yellow" },
  connected: { symbol: "●", color: "green" },
  disconnected: { symbol: "○", color: "gray" },
  error: { symbol: "✕", color: "red" },
};

interface Props {
  state: RuntimeState;
  config: AgentConfig;
  sessionDetails: Map<string, SessionDetail>;
  onQuitRequest: () => void;
  onLoadMessages: (chatId: string) => void;
}

// Static arrays — defined at module level so they are not recreated on every render
const LIST_HINTS = [
  { key: "↑↓", label: "navigate" },
  { key: "Tab/↵", label: "view session" },
  { key: "q", label: "quit" },
];
const DETAIL_HINTS = [
  { key: "↑↓/j/k", label: "scroll" },
  { key: "u/d", label: "half page" },
  { key: "g/f", label: "top/latest" },
  { key: "Tab/Esc", label: "sessions" },
  { key: "q", label: "quit" },
];

export const DashboardScreen: React.FC<Props> = ({
  state,
  config,
  sessionDetails,
  onQuitRequest,
  onLoadMessages,
}) => {
  const { stdout } = useStdout();
  const [rows, setRows] = useState(stdout.rows);
  const [columns, setColumns] = useState(stdout.columns);

  useEffect(() => {
    const onResize = () => {
      setRows(process.stdout.rows);
      setColumns(process.stdout.columns);
    };
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  // sidebar(32) + its border(1) + pane border(1) + pane padding(1+1) + pane border(1) = 37
  const contentWidth = Math.max(20, (columns || 120) - 37);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusedPane, setFocusedPane] = useState<"list" | "detail">("list");
  const [msgScrollOffset, setMsgScrollOffset] = useState(0);
  const [followTail, setFollowTail] = useState(true);

  const clampedIndex = Math.min(
    selectedIndex,
    Math.max(0, state.sessions.length - 1)
  );
  const selectedSession = state.sessions[clampedIndex];
  const selectedDetail = selectedSession
    ? sessionDetails.get(selectedSession.chatId) ?? null
    : null;

  const visibleRowCount = Math.max(4, rows - 12);
  const pageSize = Math.max(3, Math.floor(visibleRowCount / 2));

  // Memoize the row count so parseBlocks is not re-run on every keypress
  const totalDetailRows = useMemo(
    () => getSessionDisplayRowCount(selectedDetail, contentWidth),
    [selectedDetail, contentWidth]
  );

  // Synchronous state adjustment when switching sessions.
  // Effects fire AFTER Ink writes a frame, so correcting scroll offset in an
  // effect causes one visible frame with the new session's content at the old
  // session's scroll position (the blink). By adjusting state during render,
  // React discards the stale render and restarts — no intermediate frame is
  // written to the terminal.
  const prevSessionRef = useRef(clampedIndex);
  if (prevSessionRef.current !== clampedIndex) {
    prevSessionRef.current = clampedIndex;
    setFollowTail(true);
    setMsgScrollOffset(Math.max(0, totalDetailRows - visibleRowCount));
  }

  // Fetch messages for the newly selected session (side-effect, must stay in useEffect).
  useEffect(() => {
    const session = state.sessions[clampedIndex];
    if (session) {
      onLoadMessages(session.chatId);
    }
  }, [clampedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // When new messages arrive for the current session, keep tail-follow active.
  useEffect(() => {
    if (followTail && totalDetailRows > 0) {
      setMsgScrollOffset(Math.max(0, totalDetailRows - visibleRowCount));
    }
  }, [selectedDetail, followTail, visibleRowCount, totalDetailRows]);

  const scrollDetail = useCallback(
    (delta: number) => {
      const maxOffset = Math.max(0, totalDetailRows - visibleRowCount);
      setMsgScrollOffset((current) => {
        const next = Math.max(0, Math.min(maxOffset, current + delta));
        setFollowTail(next >= maxOffset);
        return next;
      });
    },
    [totalDetailRows, visibleRowCount]
  );

  const jumpToBottom = useCallback(() => {
    setMsgScrollOffset(Math.max(0, totalDetailRows - visibleRowCount));
    setFollowTail(true);
  }, [totalDetailRows, visibleRowCount]);

  useInput(
    useCallback(
      (input, key) => {
        if (key.tab) {
          setFocusedPane((p) => (p === "list" ? "detail" : "list"));
          return;
        }

        if (focusedPane === "list") {
          if (key.upArrow) {
            setSelectedIndex((i) => Math.max(0, i - 1));
          } else if (key.downArrow) {
            setSelectedIndex((i) => Math.min(state.sessions.length - 1, i + 1));
          } else if (key.return && selectedDetail) {
            setFocusedPane("detail");
          }
        } else {
          // detail pane: up/down scrolls messages
          const maxOffset = Math.max(0, totalDetailRows - visibleRowCount);
          if (key.upArrow || input === "k") {
            scrollDetail(-1);
          } else if (key.downArrow || input === "j") {
            scrollDetail(1);
          } else if (input === "u") {
            scrollDetail(-pageSize);
          } else if (input === "d") {
            scrollDetail(pageSize);
          } else if (input === "g") {
            setMsgScrollOffset(0);
            setFollowTail(false);
          } else if (input === "G" || input === "f") {
            jumpToBottom();
          } else if (key.escape) {
            setFocusedPane("list");
          } else if (msgScrollOffset >= maxOffset) {
            setFollowTail(true);
          }
        }

        if (input === "q" || input === "Q") {
          onQuitRequest();
        }
      },
      [
        focusedPane,
        state.sessions.length,
        selectedDetail,
        totalDetailRows,
        onQuitRequest,
        jumpToBottom,
        msgScrollOffset,
        pageSize,
        scrollDetail,
        visibleRowCount,
      ]
    )
  );

  const { symbol, color } = CONNECTION_BADGE[state.connection];
  const activeCount = state.sessions.filter(
    (s) => !["done", "failed", "aborted"].includes(s.status)
  ).length;

  return (
    <Box flexDirection="column" height={rows}>
      {/* Header — flat Box row so ink computes height correctly */}
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        flexDirection="row"
        flexShrink={0}
      >
        <Text color="#493bff" bold>
          MULTIPLAYER
        </Text>
        <Text dimColor> | </Text>
        <Text color={color as any}>
          {symbol} {state.connection}
        </Text>
        {state.connectionError && (
          <Text color="red"> {state.connectionError}</Text>
        )}
        {config.workspace && (
          <>
            <Text dimColor> | workspace: </Text>
            <Text>{config.workspace.slice(-8)}</Text>
          </>
        )}
        {config.project && (
          <>
            <Text dimColor> project: </Text>
            <Text>{config.project.slice(-8)}</Text>
          </>
        )}
        <Text dimColor> | model: </Text>
        <Text>{config.model}</Text>
        <Text dimColor> | </Text>
        {activeCount > 0 && (
          <>
            <Text color="yellow">{activeCount} active</Text>
            <Text dimColor> | </Text>
          </>
        )}
        <Text color="green">{state.resolvedCount} resolved</Text>
      </Box>

      {/* Body: two panes */}
      <Box flexDirection="row" flexGrow={1}>
        <SessionListPane
          sessions={state.sessions}
          selectedIndex={clampedIndex}
          isFocused={focusedPane === "list"}
        />
        <SessionDetailPane
          session={selectedDetail}
          scrollOffset={msgScrollOffset}
          visibleMessageCount={visibleRowCount}
          contentWidth={contentWidth}
          isFocused={focusedPane === "detail"}
        />
      </Box>

      {/* Footer */}
      <FooterHints hints={focusedPane === "list" ? LIST_HINTS : DETAIL_HINTS} />
    </Box>
  );
};
