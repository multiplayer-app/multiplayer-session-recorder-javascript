import { spawn } from 'child_process'

export function openUrl(url: string): void {
  const cmd =
    process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open'
  const args = process.platform === 'win32' ? ['""', url] : [url]
  const child = spawn(cmd, args, {
    detached: true,
    stdio: 'ignore',
    shell: process.platform === 'win32',
  })
  child.unref()
}
