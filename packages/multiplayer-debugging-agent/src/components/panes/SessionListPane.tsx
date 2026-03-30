import React from "react";
import { Box, Text } from "ink";
import type { SessionSummary, SessionStatus } from "../../runtime/types.js";

const SIDEBAR_WIDTH = 32;

const STATUS_SYMBOL: Record<SessionStatus, { symbol: string; color: string }> =
  {
    pending: { symbol: "○", color: "gray" },
    analyzing: { symbol: "◐", color: "yellow" },
    pushing: { symbol: "◑", color: "blue" },
    done: { symbol: "●", color: "green" },
    failed: { symbol: "✕", color: "red" },
    aborted: { symbol: "◌", color: "gray" },
  };

interface Props {
  sessions: SessionSummary[];
  selectedIndex: number;
  isFocused: boolean;
}

export const SessionListPane: React.FC<Props> = ({
  sessions,
  selectedIndex,
  isFocused,
}) => {
  const borderColor = isFocused ? "cyan" : "gray";
  const isMuted = !isFocused;
  const contentWidth = SIDEBAR_WIDTH - 4; // border(2) + paddingX(2)
  const rowTextWidth = Math.max(12, contentWidth - 5); // arrow + status + gaps

  if (sessions.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={borderColor}
        paddingX={1}
        paddingY={0}
        width={SIDEBAR_WIDTH}
        flexShrink={0}
      >
        <Box marginBottom={1}>
          <Text bold dimColor>
            Sessions
          </Text>
        </Box>
        <Text dimColor>Waiting for issues...</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
      width={SIDEBAR_WIDTH}
      flexShrink={0}
    >
      <Box marginBottom={1}>
        <Text bold dimColor>
          Sessions ({sessions.length})
        </Text>
      </Box>
      {sessions.map((s, i) => {
        const isSelected = i === selectedIndex;
        const { symbol, color } = STATUS_SYMBOL[s.status];
        return (
          <Box key={s.chatId} flexDirection="column">
            <Box gap={1}>
              <Text
                color={isSelected ? "cyan" : undefined}
                dimColor={isMuted && !isSelected}
              >
                {isSelected ? "▶" : " "}
              </Text>
              <Text color={color as any} dimColor={isMuted}>
                {symbol}
              </Text>
              <Box flexDirection="column" width={rowTextWidth}>
                <Text
                  bold={isSelected}
                  color={isSelected ? "white" : undefined}
                  dimColor={isMuted && !isSelected}
                  wrap="truncate-end"
                >
                  {s.issueTitle}
                </Text>
                <Text dimColor={isMuted && !isSelected} wrap="truncate-end">
                  {s.issueService}
                </Text>
              </Box>
            </Box>
            {i < sessions.length - 1 ? <Text dimColor> </Text> : null}
          </Box>
        );
      })}
    </Box>
  );
};
