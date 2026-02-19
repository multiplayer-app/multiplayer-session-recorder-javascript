import superagent from 'superagent'

const MULTIPLAYER_BASE_API_URL = 'https://api.multiplayer.app/v0'

export const getDefaultBranchId = async (
  apiKey,
  workspaceId,
  projectId,
  baseUrl = MULTIPLAYER_BASE_API_URL,
) => {
  const response = await superagent.get(`${baseUrl}/version/workspaces/${workspaceId}/projects/${projectId}/branches/default`)
    .set('x-api-key', apiKey)

  return response.body?._id
}

export const getEntityId = async (
  apiKey,
  workspaceId,
  projectId,
  branchId,
  entityName,
  entityType,
  baseUrl = MULTIPLAYER_BASE_API_URL,
) => {
  const response = await superagent.get(`${baseUrl}/version/workspaces/${workspaceId}/projects/${projectId}/branches/${branchId}/entities?key=${entityName}&type=${entityType}&limit=1&skip=0`)
    .set('x-api-key', apiKey)

  const entityId = response.body?.data?.[0]?.entityId
  if (!entityId) {
    throw new Error(`Entity ${entityName} not found`)
  }
  return entityId
}

export const createRelease = async (
  apiKey,
  workspaceId,
  projectId,
  payload,
  baseUrl = MULTIPLAYER_BASE_API_URL,
) => {
  const response = await superagent.post(`${baseUrl}/version/workspaces/${workspaceId}/projects/${projectId}/releases`)
    .set('x-api-key', apiKey)
    .send(payload)

  return response.body
}

export const getReleaseId = async (
  apiKey,
  workspaceId,
  projectId,
  entityId,
  version,
  baseUrl = MULTIPLAYER_BASE_API_URL,
) => {
  const response = await superagent.get(`${baseUrl}/version/workspaces/${workspaceId}/projects/${projectId}/releases?version=${version}&entity=${entityId}`)
    .set('x-api-key', apiKey)

  const versionId = response.body?.data?.[0]?._id
  if (!versionId) {
    throw new Error(`Version ${version} not found`)
  }
  return versionId
}

export const createDeployment = async (
  apiKey,
  workspaceId,
  projectId,
  payload,
  baseUrl = MULTIPLAYER_BASE_API_URL,
) => {
  const response = await superagent.post(`${baseUrl}/version/workspaces/${workspaceId}/projects/${projectId}/deployments`)
    .set('x-api-key', apiKey)
    .send(payload)

  return response.body
}

export const uploadSourcemap = async (
  apiKey,
  workspaceId,
  projectId,
  releaseId,
  filePath,
  stream,
  baseUrl = MULTIPLAYER_BASE_API_URL,
) => {
  const response = await superagent.post(`${baseUrl}/version/workspaces/${workspaceId}/projects/${projectId}/releases/${releaseId}/sourcemaps`)
    .set('x-api-key', apiKey)
    .set('Content-disposition', `attachment; filename=${filePath}`)
    .attach('file', stream, filePath)

  return response.body
}
