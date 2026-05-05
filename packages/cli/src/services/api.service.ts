import { URL } from 'url'
import type { AgentConfig } from '../types/index.js'
import { getAuthHeaders } from '../lib/authHeaders.js'
import { AuthError, AUTH_STATUS_CODES } from '../lib/authError.js'

/** Subset of GET /v0/api/workspaces/:workspaceId */
export interface ApiWorkspace {
  name: string
  _id: string
}

/** Subset of GET /v0/api/workspaces/:workspaceId/projects/:projectId */
export interface ApiProject {
  name: string
  _id: string
}

/** Response from POST /v0/git/workspaces/:workspaceId/integrations */
export interface ApiIntegration {
  _id: string
  workspace: string
  project: string
  type: string
  name: string
  otel: {
    apiKey: string
    autoMergeEnabled: boolean
    autoCreateRelease: boolean
  }
  createdAt: string
  updatedAt: string
}

export interface MultiplayerApiService {
  fetchWorkspace: (workspaceId: string) => Promise<ApiWorkspace | null>
  fetchProject: (workspaceId: string, projectId: string) => Promise<ApiProject | null>
  fetchProjects: (workspaceId: string) => Promise<ApiProject[]>
  createIntegration: (workspaceId: string, projectId: string, name: string) => Promise<ApiIntegration>
  createWorkspace: (name: string, handle: string) => Promise<ApiWorkspace>
  createProject: (workspaceId: string, name: string) => Promise<ApiProject>
}

/** Only `url` and `apiKey` are used; accepts full AgentConfig for convenience. */
export type ApiServiceAuth = Pick<AgentConfig, 'url' | 'apiKey'> & { bearerToken?: string }

export interface UserSessionWorkspace {
  _id: string
  name: string
}

export interface UserSession {
  email?: string
  workspaces: UserSessionWorkspace[]
}

export const createApiService = (
  config: ApiServiceAuth,
): MultiplayerApiService & {
  fetchUserSession: () => Promise<UserSession>
} => {
  const host = new URL(config.url).origin
  const apiBase = `${host}/v0`
  const headers: Record<string, string> = config.bearerToken
    ? { Authorization: `Bearer ${config.bearerToken}` }
    : getAuthHeaders(config.apiKey)

  const throwIfAuthFailure = (res: Response, label: string): void => {
    if (AUTH_STATUS_CODES.has(res.status)) {
      throw new AuthError(res.status, `${label}: ${res.status} ${res.statusText}`)
    }
  }

  const fetchWorkspace = async (workspaceId: string): Promise<ApiWorkspace | null> => {
    const res = await fetch(`${apiBase}/api/workspaces/${workspaceId}`, { headers })
    throwIfAuthFailure(res, 'Failed to fetch workspace')
    if (!res.ok) return null
    return (await res.json()) as ApiWorkspace
  }

  const fetchProject = async (workspaceId: string, projectId: string): Promise<ApiProject | null> => {
    const res = await fetch(`${apiBase}/api/workspaces/${workspaceId}/projects/${projectId}`, { headers })
    throwIfAuthFailure(res, 'Failed to fetch project')
    if (!res.ok) return null
    return (await res.json()) as ApiProject
  }

  const fetchProjects = async (workspaceId: string): Promise<ApiProject[]> => {
    const res = await fetch(`${apiBase}/api/workspaces/${workspaceId}/projects`, { headers })
    throwIfAuthFailure(res, 'Failed to fetch projects')
    if (!res.ok) return []
    const data = (await res.json()) as any
    return (data?.data ?? data ?? []) as ApiProject[]
  }

  const fetchUserSession = async (): Promise<UserSession> => {
    const res = await fetch(`${apiBase}/auth/user-session`, { headers })
    throwIfAuthFailure(res, 'Failed to fetch user session')
    if (!res.ok) throw new Error(`Failed to fetch user session: ${res.status} ${res.statusText}`)
    const data = (await res.json()) as any
    // API returns { email?, sessions: [{ workspaces: [...] }] }
    const session = Array.isArray(data?.sessions) ? data.sessions[0] : data
    if (!session) throw new Error('No session found in user session response')
    // email lives at the root of the response, not inside sessions[0]
    return { email: session.primaryEmail, ...session } as UserSession
  }

  const createIntegration = async (workspaceId: string, projectId: string, name: string): Promise<ApiIntegration> => {
    const res = await fetch(`${apiBase}/git/workspaces/${workspaceId}/integrations`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, project: projectId, type: 'OTEL' }),
    })
    throwIfAuthFailure(res, 'Failed to create integration')
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Failed to create integration: ${res.status} ${res.statusText} ${body}`)
    }
    return (await res.json()) as ApiIntegration
  }

  const createWorkspace = async (name: string, handle: string): Promise<ApiWorkspace> => {
    const res = await fetch(`${apiBase}/api/workspaces`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, handle }),
    })
    throwIfAuthFailure(res, 'Failed to create workspace')
    if (!res.ok) throw new Error(`Failed to create workspace: ${res.status} ${res.statusText} ${await res.text()}`)
    return (await res.json()) as ApiWorkspace
  }

  const createProject = async (workspaceId: string, name: string): Promise<ApiProject> => {
    const res = await fetch(`${apiBase}/api/workspaces/${workspaceId}/projects`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    throwIfAuthFailure(res, 'Failed to create project')
    if (!res.ok) throw new Error(`Failed to create project: ${res.status} ${res.statusText}`)
    return (await res.json()) as ApiProject
  }

  return {
    fetchWorkspace,
    fetchProject,
    fetchProjects,
    fetchUserSession,
    createWorkspace,
    createProject,
    createIntegration,
  }
}
