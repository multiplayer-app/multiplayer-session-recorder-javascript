import type { GitSettings } from '../cli/profile.js'

export type GitMode = 'dry-run' | 'local-commit' | 'full-pr'

export const GIT_MODE_PRESETS: Record<GitMode, Required<GitSettings>> = {
  'dry-run': { use_worktree: false, branch_create: false, commit: false, push: false, pr_create: false },
  'local-commit': { use_worktree: true, branch_create: true, commit: true, push: false, pr_create: false },
  'full-pr': { use_worktree: true, branch_create: true, commit: true, push: true, pr_create: true },
}

export const GIT_MODE_OPTIONS: { mode: GitMode; label: string; desc: string }[] = [
  { mode: 'dry-run', label: 'Dry run', desc: 'Apply patches only — no commit, push, or PR' },
  { mode: 'local-commit', label: 'Local commit', desc: 'Create branch + commit, no remote push' },
  { mode: 'full-pr', label: 'Open pull request', desc: 'Branch, commit, push, and open a PR' },
]

/**
 * Returns the named mode that matches `git`, or null if the toggles don't form a preset.
 * Uses the runtime convention `value !== false` ⇒ enabled.
 */
export function detectGitMode(git: GitSettings): GitMode | null {
  const eff = (k: keyof GitSettings) => git[k] ?? true
  for (const opt of GIT_MODE_OPTIONS) {
    const preset = GIT_MODE_PRESETS[opt.mode]
    if (
      eff('use_worktree') === preset.use_worktree &&
      eff('branch_create') === preset.branch_create &&
      eff('commit') === preset.commit &&
      eff('push') === preset.push &&
      eff('pr_create') === preset.pr_create
    ) return opt.mode
  }
  return null
}
