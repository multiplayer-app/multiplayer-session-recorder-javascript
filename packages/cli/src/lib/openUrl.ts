import { spawn } from 'child_process'
import { logToTui } from './tuiSink.js'

function isWsl(): boolean {
  if (process.platform !== 'linux') return false
  const env = process.env
  return Boolean(env.WSL_DISTRO_NAME || env.WSL_INTEROP)
}

interface OpenCommand {
  cmd: string
  args: string[]
  shell?: boolean
}

function getOpenCommands(url: string): OpenCommand[] {
  if (process.platform === 'win32') {
    return [{ cmd: 'cmd.exe', args: ['/c', 'start', '', url] }]
  }
  if (process.platform === 'darwin') {
    return [{ cmd: 'open', args: [url] }]
  }
  if (isWsl()) {
    return [
      { cmd: 'cmd.exe', args: ['/c', 'start', '', url] },
      { cmd: 'wslview', args: [url] },
      { cmd: 'xdg-open', args: [url] }
    ]
  }
  return [{ cmd: 'xdg-open', args: [url] }]
}

export function openUrl(url: string): void {
  const commands = getOpenCommands(url)

  const tryCommand = (index: number) => {
    const current = commands[index]
    if (!current) {
      logToTui('error', 'Could not open URL: no supported opener found on this system')
      return
    }

    try {
      const child = spawn(current.cmd, current.args, {
        detached: true,
        stdio: 'ignore',
        shell: current.shell ?? false
      })
      child.on('error', () => {
        tryCommand(index + 1)
      })
      child.on('exit', (code) => {
        if (typeof code === 'number' && code !== 0) tryCommand(index + 1)
      })
      child.unref()
    } catch {
      tryCommand(index + 1)
    }
  }

  tryCommand(0)
}
