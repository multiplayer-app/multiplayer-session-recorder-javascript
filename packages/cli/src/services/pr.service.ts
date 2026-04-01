import { execFileSync } from 'child_process'
import { AgentConfig } from '../types/index.js'
import { getRemoteUrl, getDefaultBranch } from './git.service.js'

export type GitPlatform = 'github' | 'gitlab' | 'bitbucket'

export interface PrParams {
  repositoryUrl: string
  branchName: string
  baseBranch: string
  title: string
  body: string
}

export const detectPlatform = (remoteUrl: string): GitPlatform | null => {
  if (remoteUrl.includes('github.com')) return 'github'
  if (remoteUrl.includes('gitlab.com') || /gitlab\.[a-z]/.test(remoteUrl)) return 'gitlab'
  if (remoteUrl.includes('bitbucket.org')) return 'bitbucket'
  return null
}

export const isCliAvailable = (cmd: string): boolean => {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const parsePrUrlFromOutput = (output: string, platform: GitPlatform): string | null => {
  const patterns: Record<GitPlatform, RegExp> = {
    github: /https:\/\/github\.com\/[^\s]+\/pull\/\d+/,
    gitlab: /https:\/\/[^\s]+\/-\/merge_requests\/\d+/,
    bitbucket: /https:\/\/bitbucket\.org\/[^\s]+\/pull-requests\/\d+/,
  }
  return output.match(patterns[platform])?.[0] ?? null
}

export const createPrViaCli = async (
  dir: string,
  platform: GitPlatform,
  params: PrParams,
): Promise<string | null> => {
  try {
    let output: string

    if (platform === 'github' && isCliAvailable('gh')) {
      output = execFileSync('gh', [
        'pr', 'create',
        '--base', params.baseBranch,
        '--head', params.branchName,
        '--title', params.title,
        '--body', params.body,
      ], { cwd: dir, encoding: 'utf8' })
      return parsePrUrlFromOutput(output, 'github')
    }

    if (platform === 'gitlab' && isCliAvailable('glab')) {
      output = execFileSync('glab', [
        'mr', 'create',
        '--base', params.baseBranch,
        '--source-branch', params.branchName,
        '--title', params.title,
        '--description', params.body,
        '--yes',
      ], { cwd: dir, encoding: 'utf8' })
      return parsePrUrlFromOutput(output, 'gitlab')
    }

    if (platform === 'bitbucket' && isCliAvailable('bb')) {
      output = execFileSync('bb', [
        'pr', 'create',
        '--title', params.title,
        '--source', params.branchName,
        '--destination', params.baseBranch,
        '--description', params.body,
      ], { cwd: dir, encoding: 'utf8' })
      return parsePrUrlFromOutput(output, 'bitbucket')
    }

    return null
  } catch {
    return null
  }
}

export const createPrViaApi = async (
  config: AgentConfig,
  params: PrParams,
): Promise<string | null> => {
  if (!config.workspace || !config.project) return null
  try {
    const base = config.url.replace(/\/$/, '')
    const res = await fetch(
      `${base}/v0/radar/workspaces/${config.workspace}/projects/${config.project}/pull-request`,
      {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      },
    )

    if (!res.ok) return null
    const data = await res.json() as { prUrl?: string }
    return data.prUrl ?? null
  } catch {
    return null
  }
}

export const createPullRequest = async (
  dir: string,
  config: AgentConfig,
  branchName: string,
  title: string,
  body: string,
): Promise<string | null> => {
  const remoteUrl = await getRemoteUrl(dir)
  if (!remoteUrl) return null

  const platform = detectPlatform(remoteUrl)
  if (!platform) return null

  const baseBranch = await getDefaultBranch(dir)
  const params: PrParams = { repositoryUrl: remoteUrl, branchName, baseBranch, title, body }

  // Try CLI first
  const cliPrUrl = await createPrViaCli(dir, platform, params)
  if (cliPrUrl) return cliPrUrl

  // Fall back to radar service integration
  return createPrViaApi(config, params)
}
