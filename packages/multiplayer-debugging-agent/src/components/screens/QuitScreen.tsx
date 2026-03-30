import React, { useState, useLayoutEffect } from "react";
import { Box, Text, useInput } from "ink";
import type { QuitMode } from "../../runtime/types.js";

type Option = QuitMode | "cancel";

const OPTIONS: { value: Option; label: string; description: string }[] = [
  {
    value: "now",
    label: "Quit now",
    description: "Stop immediately, abandoning any active sessions",
  },
  {
    value: "after-current",
    label: "Quit after current sessions",
    description: "Wait for active sessions to finish, then exit",
  },
  {
    value: "cancel",
    label: "Cancel",
    description: "Return to dashboard",
  },
];

interface Props {
  onQuit: (mode: QuitMode) => void;
  onCancel: () => void;
}

export const QuitScreen: React.FC<Props> = ({ onQuit, onCancel }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    console.clear();
    setReady(true);
  }, []);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex((i) => Math.min(OPTIONS.length - 1, i + 1));
    } else if (key.return) {
      const opt = OPTIONS[selectedIndex];
      if (!opt) return;
      if (opt.value === "cancel") {
        onCancel();
      } else {
        onQuit(opt.value);
      }
    } else if (key.escape || input === "q") {
      onCancel();
    }
  });

  if (!ready) return null;

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} gap={1}>
      <Text bold>Quit Multiplayer Debugging Agent?</Text>
      <Box flexDirection="column" gap={0} marginTop={1}>
        {OPTIONS.map((opt, i) => {
          const isSelected = i === selectedIndex;
          return (
            <Box key={opt.value} flexDirection="column" marginBottom={1}>
              <Box gap={2}>
                <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
                  {isSelected ? ">" : " "} {opt.label}
                </Text>
              </Box>
              <Box paddingLeft={3}>
                <Text dimColor>{opt.description}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>
      <Text dimColor>↑↓ navigate · Enter select · Esc cancel</Text>
    </Box>
  );
};
