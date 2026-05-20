import { spawn } from 'child_process'

export function copyToClipboard(text: string): void {
  // OSC 52: terminal-native clipboard — no external tools needed.
  // Works in iTerm2, Terminal.app, Windows Terminal, xterm, and most modern terminals.
  const b64 = Buffer.from(text).toString('base64')
  process.stdout.write(`\x1b]52;c;${b64}\x07`)

  // Also try OS clipboard tools via spawn+stdin — avoids shell injection and
  // handles special characters (& in URLs etc.) correctly.
  let cmd: string
  let args: string[]

  if (process.platform === 'darwin') {
    cmd = 'pbcopy'
    args = []
  } else if (process.platform === 'win32') {
    // clip.exe reads from stdin directly, no echo needed
    cmd = 'clip'
    args = []
  } else {
    // Try wl-copy (Wayland), xclip (X11), xsel (X11) in order
    cmd = 'sh'
    args = ['-c', 'wl-copy 2>/dev/null || xclip -selection clipboard 2>/dev/null || xsel --clipboard --input 2>/dev/null']
  }

  try {
    const proc = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] })
    proc.stdin.write(text)
    proc.stdin.end()
  } catch {
    // OS tool unavailable — OSC 52 above is the primary path
  }
}
