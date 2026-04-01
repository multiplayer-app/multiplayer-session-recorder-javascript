import { URL } from 'url'
import type { AgentConfig } from '../types/index.js'

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
}

/** Only `url` and `apiKey` are used; accepts full AgentConfig for convenience. */
export type ApiServiceAuth = Pick<AgentConfig, 'url' | 'apiKey'>

export const createApiService = (config: ApiServiceAuth): MultiplayerApiService => {
  const host = new URL(config.url).origin
  const apiBase = `${host}/v0/api`
  const headers = { 'x-api-key': config.apiKey }

  const fetchWorkspace = async (workspaceId: string): Promise<ApiWorkspace | null> => {
    const res = await fetch(`${apiBase}/workspaces/${workspaceId}`, { headers })
    if (!res.ok) return null
    return (await res.json()) as ApiWorkspace
  }

  const fetchProject = async (workspaceId: string, projectId: string): Promise<ApiProject | null> => {
    const res = await fetch(`${apiBase}/workspaces/${workspaceId}/projects/${projectId}`, { headers })
    if (!res.ok) return null
    return (await res.json()) as ApiProject
  }

  return { fetchWorkspace, fetchProject }
}
