import React, { useMemo } from "react";
import { Box, Text } from "ink";
import type {
  SessionDetail,
  SessionMessage,
  SessionStatus,
} from "../../runtime/types.js";
import type { AgentToolCall } from "../../types/index.js";

export const VISIBLE_MESSAGES = 12;

const STATUS_LABEL: Record<SessionStatus, { label: string; color: string }> = {
  pending: { label: "pending", color: "gray" },
  analyzing: { label: "analyzing", color: "yellow" },
  pushing: { label: "pushing", color: "blue" },
  done: { label: "done", color: "green" },
  failed: { label: "failed", color: "red" },
  aborted: { label: "aborted", color: "gray" },
};

const TOOL_STATUS_COLOR: Record<AgentToolCall["status"], string> = {
  pending: "yellow",
  running: "yellow",
  succeeded: "green",
  failed: "red",
};

const getToolStatusColor = (
  status: AgentToolCall["status"] | undefined
): string => TOOL_STATUS_COLOR[status ?? "pending"] ?? "yellow";

function getToolDetail(tc: AgentToolCall): string | null {
  const input = tc.input;
  switch (tc.name) {
    case "Read":
    case "Edit":
    case "Write": {
      if (typeof input.file_path === "string") {
        const parts = (input.file_path as string).split("/");
        return parts.slice(-2).join("/");
      }
      return null;
    }
    case "Glob":
      return typeof input.pattern === "string"
        ? (input.pattern as string)
        : null;
    case "Grep": {
      if (typeof input.pattern === "string") {
        const p = input.pattern as string;
        return p.length > 35 ? p.slice(0, 33) + "…" : p;
      }
      return null;
    }
    case "Bash": {
      if (typeof input.command === "string") {
        const cmd = (input.command as string).replace(/\n/g, " ").trim();
        return cmd.length > 50 ? cmd.slice(0, 48) + "…" : cmd;
      }
      return null;
    }
    case "Agent":
      if (typeof input.description === "string") {
        const d = input.description as string;
        return d.length > 40 ? d.slice(0, 38) + "…" : d;
      }
      if (typeof input.subagent_type === "string")
        return input.subagent_type as string;
      return null;
    default:
      return null;
  }
}

const ToolCallBadge: React.FC<{ tc: AgentToolCall; muted?: boolean }> = ({
  tc,
  muted = false,
}) => {
  const detail = getToolDetail(tc);
  const statusColor = getToolStatusColor(tc.status);
  return (
    <Box gap={1}>
      <Text color={statusColor as any} dimColor={muted}>
        [{tc.name}]
      </Text>
      {detail && <Text dimColor={true}>{detail}</Text>}
    </Box>
  );
};

// ─── Inline markdown segments ────────────────────────────────────────────────

type Segment = { text: string; bold?: boolean; code?: boolean; dim?: boolean };

function parseInline(text: string): Segment[] {
  const segments: Segment[] = [];
  // Match **bold**, `code`, *italic* (rendered as dim)
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index) });
    if (m[0].startsWith("**")) segments.push({ text: m[2]!, bold: true });
    else if (m[0].startsWith("`")) segments.push({ text: m[3]!, code: true });
    else segments.push({ text: m[4]!, dim: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

const InlineText: React.FC<{ segments: Segment[] }> = ({ segments }) => (
  <>
    {segments.map((s, i) =>
      s.bold ? (
        <Text key={i} bold>
          {s.text}
        </Text>
      ) : s.code ? (
        <Text key={i} color="yellow">
          {s.text}
        </Text>
      ) : s.dim ? (
        <Text key={i} dimColor>
          {s.text}
        </Text>
      ) : (
        <Text key={i}>{s.text}</Text>
      )
    )}
  </>
);

// Emoji are wide characters (2 columns) but Ink measures them as 1, breaking layout
const stripEmoji = (text: string): string =>
  text.replace(
    /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{1FA00}-\u{1FAFF}\u{FE00}-\u{FEFF}]/gu,
    ""
  );

// Agent message content can include terminal control characters from streaming output.
// Rendering those in Ink can overwrite parts of a line (e.g. '\r') and "corrupt" text.
const stripTerminalEscapes = (text: string): string =>
  text
    // OSC: ESC ] ... (BEL or ESC \)
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    // CSI: ESC [ ... command
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    // 2-char ESC sequences
    .replace(/\x1B[@-Z\\-_]/g, "");

const stripControlChars = (text: string): string =>
  stripTerminalEscapes(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "")
    .replace(/\t/g, "  ")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

// ─── Code block ───────────────────────────────────────────────────────────────

const CodeBlock: React.FC<{ lang: string; lines: string[] }> = ({
  lang,
  lines,
}) => (
  <Box
    flexDirection="column"
    borderStyle="single"
    borderColor="gray"
    borderLeft={true}
    borderTop={false}
    borderRight={false}
    borderBottom={false}
    paddingLeft={1}
  >
    {lang ? <Text dimColor>{lang}</Text> : null}
    {lines.map((l, i) =>
      l === "" ? (
        <Text key={`${i}-blank`}> </Text>
      ) : (
        <Text key={i} color="yellow">
          {l}
        </Text>
      )
    )}
  </Box>
);

// ─── Line-level markdown ──────────────────────────────────────────────────────

const MarkdownLine: React.FC<{ line: string; muted?: boolean }> = ({
  line,
  muted = false,
}) => {
  // IMPORTANT: This renderer must emit exactly one terminal row per input line.
  // Scroll calculations are based on line counts from parseBlocks.
  // H1 — bold cyan
  if (/^# /.test(line)) {
    const text = line.slice(2);
    return (
      <Text bold color="cyan" dimColor={muted}>
        {text}
      </Text>
    );
  }
  // H2 — bold cyan with left bar
  if (/^## /.test(line)) {
    const text = line.slice(3);
    return (
      <Text bold color="cyan" dimColor={muted}>
        ▌ {text}
      </Text>
    );
  }
  // H3 — bold dimmed cyan
  if (/^### /.test(line)) {
    const text = line.slice(4);
    return (
      <Text bold color="cyan" dimColor>
        {text}
      </Text>
    );
  }
  // Horizontal rule
  if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
    return <Text dimColor>{"─".repeat(50)}</Text>;
  }
  // Bullet list
  const bulletMatch = line.match(/^(\s*)[-*+] (.*)$/);
  if (bulletMatch) {
    const indent = bulletMatch[1]!.length;
    const content = bulletMatch[2]!;
    return (
      <Box flexDirection="row">
        <Text color="cyan" dimColor={muted}>
          {" ".repeat(indent)}
          {"›"}{" "}
        </Text>
        <Box flexGrow={1}>
          <Text dimColor={muted}>
            <InlineText segments={parseInline(content)} />
          </Text>
        </Box>
      </Box>
    );
  }
  // Numbered list
  const numMatch = line.match(/^(\s*)(\d+)\. (.*)$/);
  if (numMatch) {
    const indent = numMatch[1]!.length;
    const num = numMatch[2]!;
    const content = numMatch[3]!;
    return (
      <Box flexDirection="row">
        <Text color="cyan" dimColor={muted}>
          {" ".repeat(indent)}
          {num}.{" "}
        </Text>
        <Box flexGrow={1}>
          <Text dimColor={muted}>
            <InlineText segments={parseInline(content)} />
          </Text>
        </Box>
      </Box>
    );
  }
  // Blockquote
  if (line.startsWith("> ")) {
    return (
      <Box flexDirection="row">
        <Text color="cyan" dimColor>
          ▎{" "}
        </Text>
        <Box flexGrow={1}>
          <Text dimColor>
            <InlineText segments={parseInline(line.slice(2))} />
          </Text>
        </Box>
      </Box>
    );
  }
  // Normal line — pre-wrapped by parseBlocks so no Ink wrap needed
  return (
    <Text dimColor={muted}>
      <InlineText segments={parseInline(line)} />
    </Text>
  );
};

// ─── Block-aware renderer (handles fenced code blocks) ────────────────────────

type Block =
  | { type: "line"; line: string }
  | { type: "code"; lang: string; lines: string[] }
  | { type: "spacer" };

// Fallback width used only when no contentWidth prop is provided (e.g. MarkdownContent standalone).
// sidebar(32) + its border(1) + pane border(1) + pane padding(1+1) + pane border(1) = 37
const getContentWidth = (): number =>
  Math.max(20, (process.stdout.columns || 120) - 37);

// Returns true for lines whose rendered height is always 1 row — no pre-wrap needed
const isStructuralLine = (line: string): boolean =>
  /^#{1,3} /.test(line) ||
  /^(-{3,}|\*{3,})$/.test(line.trim()) ||
  /^(\s*)[-*+] /.test(line) ||
  /^(\s*)\d+\. /.test(line) ||
  line.startsWith("> ");

// Word-wrap a plain paragraph line so each chunk is at most maxWidth chars.
// Ink's layout engine counts wrapped Text as 1 row → pre-wrapping keeps heights accurate.
// Crucially: never split inside a backtick code span or **bold** span, or parseInline breaks.
function wrapParagraph(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) return [text];

  const hardSplit = (t: string): string[] => {
    if (t.length <= maxWidth) return [t];
    const out: string[] = [];
    for (let i = 0; i < t.length; i += maxWidth)
      out.push(t.slice(i, i + maxWidth));
    return out.length ? out : [t];
  };

  // Pre-compute valid split positions: spaces that are NOT inside a `code` or **bold** span
  const splitPoints: number[] = [];
  let inCode = false;
  let boldCount = 0; // count of ** tokens seen (even=outside, odd=inside)

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "`") {
      inCode = !inCode;
    } else if (ch === "*" && text[i + 1] === "*") {
      boldCount++;
      i++; // skip second *
    } else if (ch === " " && !inCode && boldCount % 2 === 0) {
      splitPoints.push(i);
    }
  }

  if (splitPoints.length === 0) return hardSplit(text);

  const lines: string[] = [];
  let start = 0;

  while (start < text.length) {
    const remaining = text.slice(start);
    if (remaining.length <= maxWidth) {
      lines.push(remaining);
      break;
    }
    const limit = start + maxWidth;
    // Find the last valid split at or before limit
    let splitAt = -1;
    for (const sp of splitPoints) {
      if (sp <= start) continue;
      if (sp <= limit) splitAt = sp;
      else break;
    }
    if (splitAt === -1) {
      // No split within limit — advance to the next valid split point after limit
      const next = splitPoints.find((sp) => sp > limit);
      if (next !== undefined) {
        lines.push(text.slice(start, next));
        start = next + 1;
      } else {
        // No more safe splits; hard-split the remainder so Ink never wraps it.
        lines.push(...hardSplit(text.slice(start)));
        break;
      }
    } else {
      lines.push(text.slice(start, splitAt));
      start = splitAt + 1;
    }
  }

  return lines.length > 0 ? lines : [text];
}

function parseBlocks(content: string, contentWidth?: number): Block[] {
  const blocks: Block[] = [];
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];
  let lastWasBlank = false;
  const width = contentWidth ?? getContentWidth();
  const codeWidth = Math.max(20, width - 3); // account for code border/padding

  const hardSplitPlain = (t: string, w: number): string[] => {
    if (t.length <= w) return [t];
    const out: string[] = [];
    for (let i = 0; i < t.length; i += w) out.push(t.slice(i, i + w));
    return out.length ? out : [t];
  };

  const wrapStructural = (line: string): string[] => {
    if (line.length <= width) return [line];

    const bullet = line.match(/^(\s*[-*+] )(.*)$/);
    if (bullet) {
      const prefix = bullet[1]!;
      const body = bullet[2]!;
      const bodyWidth = Math.max(10, width - prefix.length);
      const bodyChunks = wrapParagraph(body, bodyWidth);
      return bodyChunks.map((c, idx) =>
        idx === 0 ? prefix + c : " ".repeat(prefix.length) + c
      );
    }

    const num = line.match(/^(\s*\d+\. )(.*)$/);
    if (num) {
      const prefix = num[1]!;
      const body = num[2]!;
      const bodyWidth = Math.max(10, width - prefix.length);
      const bodyChunks = wrapParagraph(body, bodyWidth);
      return bodyChunks.map((c, idx) =>
        idx === 0 ? prefix + c : " ".repeat(prefix.length) + c
      );
    }

    if (line.startsWith("> ")) {
      const prefix = "> ";
      const body = line.slice(2);
      const bodyWidth = Math.max(10, width - prefix.length);
      const bodyChunks = wrapParagraph(body, bodyWidth);
      return bodyChunks.map((c, idx) =>
        idx === 0 ? prefix + c : " ".repeat(prefix.length) + c
      );
    }

    return hardSplitPlain(line, width);
  };

  const normalized = stripControlChars(content);

  for (const raw of normalized.split("\n")) {
    const line = stripEmoji(raw);
    if (line.startsWith("```")) {
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        // Pre-wrap code lines too; Ink wrapping inside code blocks causes overlap.
        const wrapped: string[] = [];
        for (const cl of codeLines)
          wrapped.push(...hardSplitPlain(cl, codeWidth));
        blocks.push({ type: "code", lang: codeLang, lines: wrapped });
        inCode = false;
      }
      lastWasBlank = false;
    } else if (inCode) {
      codeLines.push(line);
    } else if (line.trim().length === 0) {
      // Preserve a single blank line between paragraphs as a spacer
      if (!lastWasBlank && blocks.length > 0) {
        blocks.push({ type: "spacer" });
      }
      lastWasBlank = true;
    } else {
      lastWasBlank = false;
      if (isStructuralLine(line)) {
        for (const chunk of wrapStructural(line))
          blocks.push({ type: "line", line: chunk });
      } else {
        // Pre-wrap paragraph text so each chunk renders as exactly 1 terminal row
        for (const chunk of wrapParagraph(line, width)) {
          blocks.push({ type: "line", line: chunk });
        }
      }
    }
  }
  if (inCode && codeLines.length > 0) {
    const wrapped: string[] = [];
    for (const cl of codeLines) wrapped.push(...hardSplitPlain(cl, codeWidth));
    blocks.push({ type: "code", lang: codeLang, lines: wrapped });
  }
  return blocks;
}

const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
  const blocks = parseBlocks(content);
  return (
    <Box flexDirection="column">
      {blocks.map((b, i) =>
        b.type === "code" ? (
          <CodeBlock key={i} lang={b.lang} lines={b.lines} />
        ) : b.type === "spacer" ? (
          <Text key={i}> </Text>
        ) : (
          <MarkdownLine key={i} line={b.line} />
        )
      )}
    </Box>
  );
};

// ─── Row model ───────────────────────────────────────────────────────────────

type DetailRow =
  | { key: string; type: "toolLine"; roleColor: string; text: string }
  | { key: string; type: "prefix"; roleColor: string; prefix: string }
  | { key: string; type: "line"; line: string }
  | { key: string; type: "codeStart"; lang: string }
  | { key: string; type: "codeLine"; line: string }
  | { key: string; type: "codeEnd" }
  | { key: string; type: "spacer" }
  | { key: string; type: "messageGap" };

const buildMessageRows = (msg: SessionMessage, contentWidth?: number): DetailRow[] => {
  const roleColor =
    msg.role === "error"
      ? "red"
      : msg.role === "reasoning"
      ? "magenta"
      : "cyan";
  const prefix = msg.role === "assistant" ? "" : msg.role;
  const toolCalls = msg.toolCalls ?? [];
  const hasContent = Boolean(msg.content?.trim());
  const rows: DetailRow[] = [];
  const width = contentWidth ?? getContentWidth();

  if (hasContent) {
    if (prefix) {
      rows.push({
        key: `prefix-${msg.id}`,
        type: "prefix",
        roleColor,
        prefix,
      });
    }

    for (const [i, b] of parseBlocks(msg.content, contentWidth).entries()) {
      if (b.type === "spacer") {
        rows.push({ key: `spacer-${msg.id}-${i}`, type: "spacer" });
      } else if (b.type === "line") {
        rows.push({ key: `line-${msg.id}-${i}`, type: "line", line: b.line });
      } else {
        rows.push({
          key: `code-start-${msg.id}-${i}`,
          type: "codeStart",
          lang: b.lang || "text",
        });
        for (const [j, line] of b.lines.entries()) {
          rows.push({
            key: `code-line-${msg.id}-${i}-${j}`,
            type: "codeLine",
            line,
          });
        }
        rows.push({ key: `code-end-${msg.id}-${i}`, type: "codeEnd" });
      }
    }
  }

  for (const tc of toolCalls) {
    const base = prefix ? `${prefix} [${tc.name}]` : `[${tc.name}]`;
    const detail = getToolDetail(tc);
    if (!detail) {
      rows.push({
        key: `tool-${msg.id}-${tc.id}-0`,
        type: "toolLine",
        roleColor,
        text: base,
      });
      continue;
    }

    const available = Math.max(10, width - base.length - 1);
    const chunks = wrapParagraph(detail, available);
    rows.push({
      key: `tool-${msg.id}-${tc.id}-0`,
      type: "toolLine",
      roleColor,
      text: `${base} ${chunks[0] ?? ""}`.trimEnd(),
    });

    const indent = " ".repeat(base.length + 1);
    for (let i = 1; i < chunks.length; i++) {
      rows.push({
        key: `tool-${msg.id}-${tc.id}-${i}`,
        type: "toolLine",
        roleColor,
        text: `${indent}${chunks[i]}`,
      });
    }
  }

  if (rows.length > 0) rows.push({ key: `gap-${msg.id}`, type: "messageGap" });
  return rows;
};

const buildSessionRows = (session: SessionDetail | null, contentWidth?: number): DetailRow[] => {
  if (!session) return [];
  return session.messages.flatMap((msg) => buildMessageRows(msg, contentWidth));
};

export const getSessionDisplayRowCount = (
  session: SessionDetail | null,
  contentWidth?: number
): number => buildSessionRows(session, contentWidth).length;

interface Props {
  session: SessionDetail | null;
  scrollOffset: number;
  visibleMessageCount?: number;
  contentWidth?: number;
  isFocused: boolean;
}

export const SessionDetailPane: React.FC<Props> = ({
  session,
  scrollOffset,
  visibleMessageCount = VISIBLE_MESSAGES,
  contentWidth,
  isFocused,
}) => {
  const borderColor = isFocused ? "cyan" : "gray";
  const isMuted = !isFocused;

  // Memoize row building — avoids re-running parseBlocks on every keypress/focus change
  const allRows = useMemo(
    () => buildSessionRows(session, contentWidth),
    [session, contentWidth]
  );

  if (!session) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={borderColor}
        paddingX={1}
        paddingY={0}
        flexGrow={1}
      >
        <Text dimColor>Select a session to view details</Text>
      </Box>
    );
  }

  const { label, color } = STATUS_LABEL[session.status];
  const total = allRows.length;
  const start = Math.max(
    0,
    Math.min(scrollOffset, Math.max(0, total - visibleMessageCount))
  );
  const visibleRows = allRows.slice(start, start + visibleMessageCount);
  const hasMore = start > 0;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      paddingY={0}
      flexGrow={1}
      overflow="hidden"
    >
      {/* Session header */}
      <Box
        flexDirection="column"
        marginBottom={1}
        borderStyle="single"
        borderColor="gray"
        borderBottom={true}
        borderTop={false}
        borderLeft={false}
        borderRight={false}
        paddingBottom={0}
      >
        {/* Title row: title left, status badge right */}
        <Box flexDirection="row">
          <Box flexGrow={1}>
            <Text bold wrap="truncate-end" dimColor={isMuted}>
              {session.issueTitle}
            </Text>
          </Box>
          <Text color={color as any} dimColor={isMuted}>
            {" "}
            {label}
          </Text>
        </Box>
        {/* Meta row */}
        <Box flexDirection="row" gap={1}>
          {session.issueService ? (
            <Text dimColor>{session.issueService}</Text>
          ) : null}
          {session.branchName && (
            <>
              {session.issueService ? <Text dimColor>·</Text> : null}
              <Text color="blue" dimColor={isMuted} wrap="truncate-end">
                {session.branchName}
              </Text>
            </>
          )}
          {session.prUrl && (
            <>
              <Text dimColor>·</Text>
              <Text color="cyan" dimColor={isMuted} wrap="truncate-end">
                {session.prUrl}
              </Text>
            </>
          )}
        </Box>
        {session.error && (
          <Text color="red" wrap="wrap">
            ✗ {session.error}
          </Text>
        )}
      </Box>

      {/* Scroll indicator */}
      {hasMore && (
        <Text dimColor>
          ↑ {start} earlier row{start !== 1 ? "s" : ""}
        </Text>
      )}

      {/* Message stream */}
      {visibleRows.length === 0 ? (
        <Text dimColor>No messages yet...</Text>
      ) : (
        visibleRows.map((row) => {
          switch (row.type) {
            case "toolLine":
              return (
                <Text
                  key={row.key}
                  color={row.roleColor as any}
                  dimColor={isMuted}
                >
                  {row.text}
                </Text>
              );
            case "prefix":
              return (
                <Text key={row.key} color={row.roleColor as any} dimColor>
                  {row.prefix}{" "}
                </Text>
              );
            case "line":
              return (
                <MarkdownLine key={row.key} line={row.line} muted={isMuted} />
              );
            case "spacer":
            case "messageGap":
              return <Text key={row.key}> </Text>;
            case "codeStart":
              return (
                <Text key={row.key} color="gray">
                  {"┌─ "}
                  <Text dimColor>{row.lang}</Text>
                </Text>
              );
            case "codeLine":
              return (
                <Text key={row.key} color="yellow" dimColor={isMuted}>
                  {"│ "}
                  {row.line || " "}
                </Text>
              );
            case "codeEnd":
              return (
                <Text key={row.key} color="gray" dimColor={isMuted}>
                  └
                </Text>
              );
            default:
              return null;
          }
        })
      )}

      {/* Bottom scroll indicator */}
      {total > visibleMessageCount && start + visibleMessageCount < total && (
        <Text dimColor>
          ↓ {total - start - visibleMessageCount} more row
          {total - start - visibleMessageCount !== 1 ? "s" : ""}
        </Text>
      )}
    </Box>
  );
};
