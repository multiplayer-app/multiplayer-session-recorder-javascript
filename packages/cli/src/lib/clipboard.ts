import { exec } from 'child_process'

export function copyToClipboard(text: string): void {
  const cmd =
    process.platform === 'win32'
      ? `echo ${text.replace(/"/g, '\\"')} | clip`
      : process.platform === 'darwin'
        ? `echo ${JSON.stringify(text)} | pbcopy`
        : `echo ${JSON.stringify(text)} | xclip -selection clipboard 2>/dev/null || echo ${JSON.stringify(text)} | xdg-open /dev/stdin`
  exec(cmd)
}
