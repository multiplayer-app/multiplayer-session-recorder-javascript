import { simpleGit, SimpleGit } from 'simple-git'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const isGitRepo = async (dir: string): Promise<boolean> => {
  try {
    const git: SimpleGit = simpleGit(dir)
    const result = await git.revparse(['--is-inside-work-tree'])
    return result.trim() === 'true'
  } catch {
    return false
  }
}

export const getCurrentBranch = async (dir: string): Promise<string> => {
  const git: SimpleGit = simpleGit(dir)
  const branch = await git.revparse(['--abbrev-ref', 'HEAD'])
  return branch.trim()
}

export const createBranch = async (dir: string, branchName: string): Promise<void> => {
  const git: SimpleGit = simpleGit(dir)
  await git.checkoutLocalBranch(branchName)
}

export const commitAll = async (dir: string, message: string): Promise<string> => {
  const git: SimpleGit = simpleGit(dir)
  await git.add('.')
  const result = await git.commit(message)
  return result.commit
}

export const push = async (dir: string, branchName: string): Promise<void> => {
  const git: SimpleGit = simpleGit(dir)
  await git.push('origin', branchName, ['--set-upstream'])
}

export const getRemoteUrl = async (dir: string): Promise<string | undefined> => {
  try {
    const git: SimpleGit = simpleGit(dir)
    const remotes = await git.getRemotes(true)
    const origin = remotes.find((r) => r.name === 'origin')
    return origin?.refs?.push
  } catch {
    return undefined
  }
}

export const sanitizeBranchName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export const getBranchUrl = (repositoryUrl: string, branchName: string): string | undefined => {
  try {
    let httpsUrl = repositoryUrl.trim()
    // Convert SSH URL (git@github.com:org/repo.git) to HTTPS
    if (httpsUrl.startsWith('git@')) {
      httpsUrl = httpsUrl.replace(/^git@([^:]+):/, 'https://$1/')
    }
    // Strip .git suffix
    httpsUrl = httpsUrl.replace(/\.git$/, '')
    return `${httpsUrl}/tree/${branchName}`
  } catch {
    return undefined
  }
}

export const makeBranchName = (issueComponentHash: string, issueTitle: string): string => {
  const slug = sanitizeBranchName(issueTitle)
  return `fix/issue-${slug}-${issueComponentHash.slice(-8)}`
}

export const getDefaultBranch = async (dir: string): Promise<string> => {
  const git: SimpleGit = simpleGit(dir)
  try {
    // Query the remote directly — always reflects the current default branch,
    // even if it was renamed after the repo was cloned.
    const result = await git.raw(['ls-remote', '--symref', 'origin', 'HEAD'])
    const match = result.match(/^ref: refs\/heads\/(\S+)\s+HEAD/m)
    if (match?.[1]) return match[1]
  } catch {
    // network unreachable — fall through to local refs
  }
  try {
    const result = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD'])
    return result.trim().replace('refs/remotes/origin/', '')
  } catch {
    // refs/remotes/origin/HEAD not set (common with shallow clones)
  }
  try {
    await git.raw(['rev-parse', '--verify', 'origin/main'])
    return 'main'
  } catch {
    return 'master'
  }
}

export const getDiffStats = async (dir: string): Promise<{ additions: number; deletions: number }> => {
  const git: SimpleGit = simpleGit(dir)
  try {
    const result = await git.diff(['--shortstat', 'HEAD~1', 'HEAD'])
    const additions = Number(result.match(/(\d+) insertion/)?.[1] ?? 0)
    const deletions = Number(result.match(/(\d+) deletion/)?.[1] ?? 0)
    return { additions, deletions }
  } catch {
    return { additions: 0, deletions: 0 }
  }
}

export const makeWorktreeDir = (issueId: string): string => {
  return path.join(os.tmpdir(), `mp-agent-${issueId.slice(-8)}-${Date.now()}`)
}

export const getWorktreeForBranch = async (repoDir: string, branchName: string): Promise<string | undefined> => {
  try {
    const git = simpleGit(repoDir)
    const result = await git.raw(['worktree', 'list', '--porcelain'])
    const blocks = result.trim().split('\n\n')
    for (const block of blocks) {
      const lines = block.trim().split('\n')
      const worktreeLine = lines.find(l => l.startsWith('worktree '))
      const branchLine = lines.find(l => l.startsWith('branch '))
      if (worktreeLine && branchLine) {
        const worktreePath = worktreeLine.slice('worktree '.length)
        const branch = branchLine.slice('branch refs/heads/'.length)
        if (branch === branchName) {
          // Only reuse if the directory actually exists on disk (guard against stale entries)
          if (fs.existsSync(worktreePath)) {
            return worktreePath
          }
          // Prune the stale entry so future worktree adds don't fail
          try { await git.raw(['worktree', 'prune']) } catch { /* best-effort */ }
        }
      }
    }
    return undefined
  } catch {
    return undefined
  }
}

export const createWorktree = async (
  repoDir: string,
  worktreeDir: string,
  branchName: string,
): Promise<string> => {
  const existing = await getWorktreeForBranch(repoDir, branchName)
  if (existing) {
    return existing
  }
  const git = simpleGit(repoDir)
  const defaultBranch = await getDefaultBranch(repoDir)
  try {
    await git.fetch('origin', defaultBranch)
  } catch {
    // best-effort fetch
  }
  try {
    await git.raw(['worktree', 'add', '-b', branchName, worktreeDir, `origin/${defaultBranch}`])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('already exists')) {
      // Branch exists locally from a previous attempt — reset it to the latest
      // default branch so the new fix starts from the correct base commit.
      await git.raw(['branch', '-f', branchName, `origin/${defaultBranch}`])
      await git.raw(['worktree', 'add', worktreeDir, branchName])
      return worktreeDir
    } else {
      throw err
    }
  }
  return worktreeDir
}

export const branchExistsLocally = async (dir: string, branchName: string): Promise<boolean> => {
  try {
    const git = simpleGit(dir)
    await git.raw(['rev-parse', '--verify', branchName])
    return true
  } catch {
    return false
  }
}

export const branchExistsRemotely = async (dir: string, branchName: string): Promise<boolean> => {
  try {
    const git = simpleGit(dir)
    await git.fetch('origin', branchName)
    await git.raw(['rev-parse', '--verify', `origin/${branchName}`])
    return true
  } catch {
    return false
  }
}

export const createWorktreeFromExisting = async (repoDir: string, worktreeDir: string, branchName: string): Promise<string> => {
  const existing = await getWorktreeForBranch(repoDir, branchName)
  if (existing) {
    return existing
  }
  const git = simpleGit(repoDir)
  const local = await branchExistsLocally(repoDir, branchName)
  if (local) {
    await git.raw(['worktree', 'add', worktreeDir, branchName])
  } else {
    // track remote branch
    await git.raw(['worktree', 'add', '--track', '-b', branchName, worktreeDir, `origin/${branchName}`])
  }
  return worktreeDir
}

export const hasUncommittedChanges = async (dir: string): Promise<boolean> => {
  const git = simpleGit(dir)
  const status = await git.status()
  return !status.isClean()
}

export const removeWorktree = async (repoDir: string, worktreeDir: string): Promise<void> => {
  const git = simpleGit(repoDir)
  await git.raw(['worktree', 'remove', worktreeDir, '--force'])
}
