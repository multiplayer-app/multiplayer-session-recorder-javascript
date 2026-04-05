import { URL } from 'url'
import type { AgentConfig } from '../types/index.js'
import { getAuthHeaders } from '../lib/authHeaders.js'

/** Subset of GET /v0/api/workspaces/:workspaceId */
export interface ApiWorkspace {
  name?: string
  _id?: string
}

/** Subset of GET /v0/api/workspaces/:workspaceId/projects/:projectId */
export interface ApiProject {
  name?: string
  _id?: string
}

export interface MultiplayerApiService {
  fetchWorkspace: (workspaceId: string) => Promise<ApiWorkspace | null>
  fetchProject: (workspaceId: string, projectId: string) => Promise<ApiProject | null>
  fetchProjects: (workspaceId: string) => Promise<ApiProject[]>
}

/** Only `url` and `apiKey` are used; accepts full AgentConfig for convenience. */
export type ApiServiceAuth = Pick<AgentConfig, 'url' | 'apiKey'> & { bearerToken?: string }

export interface UserSessionWorkspace {
  _id: string
  name: string
  projects: { _id: string; name: string; role: string }[]
}

export interface UserSession {
  workspaces: UserSessionWorkspace[]
}

export const createApiService = (config: ApiServiceAuth): MultiplayerApiService & {
  fetchUserSession: () => Promise<UserSession>
} => {
  const host = new URL(config.url).origin
  const apiBase = `${host}/v0`
  const headers: Record<string, string> = config.bearerToken
    ? { Authorization: `Bearer ${config.bearerToken}` }
    : getAuthHeaders(config.apiKey)

  const fetchWorkspace = async (workspaceId: string): Promise<ApiWorkspace | null> => {
    const res = await fetch(`${apiBase}/api/workspaces/${workspaceId}`, { headers })
    if (!res.ok) return null
    return (await res.json()) as ApiWorkspace
  }

  const fetchProject = async (workspaceId: string, projectId: string): Promise<ApiProject | null> => {
    const res = await fetch(`${apiBase}/api/workspaces/${workspaceId}/projects/${projectId}`, { headers })
    if (!res.ok) return null
    return (await res.json()) as ApiProject
  }

  const fetchProjects = async (workspaceId: string): Promise<ApiProject[]> => {
    const res = await fetch(`${apiBase}/api/workspaces/${workspaceId}/projects`, { headers })
    if (!res.ok) return []
    const data = (await res.json()) as any
    return (data?.data ?? data ?? []) as ApiProject[]
  }

  const fetchUserSession = async (): Promise<UserSession> => {
    const res = await fetch(`${apiBase}/auth/user-session`, { headers })
    if (!res.ok) throw new Error(`Failed to fetch user session: ${res.status} ${res.statusText}`)
    const data = (await res.json()) as any
    // API returns { sessions: [{ workspaces: [...] }] }
    const session = Array.isArray(data?.sessions) ? data.sessions[0] : data
    if (!session) throw new Error('No session found in user session response')
    return session as UserSession
  }

  return { fetchWorkspace, fetchProject, fetchProjects, fetchUserSession }
}
