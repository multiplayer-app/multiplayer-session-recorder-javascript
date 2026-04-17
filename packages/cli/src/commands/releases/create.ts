import jwt from 'jsonwebtoken'
import * as API from '../../services/version-api.service.js'

interface ReleaseOptions {
  apiKey: string
  service: string
  release: string
  commitHash?: string
  repositoryUrl?: string
  releaseNotes?: string
  baseUrl?: string
}

export const create = async (
  options: ReleaseOptions,
  callback: (err: Error | null, result: unknown) => void,
): Promise<void> => {
  try {
    const {
      apiKey,
      service,
      release,
      commitHash,
      repositoryUrl,
      releaseNotes,
      baseUrl,
    } = options
    const jwtToken = (jwt.decode(apiKey) || {}) as Record<string, string>

    const branchId = await API.getDefaultBranchId(
      apiKey,
      jwtToken.workspace,
      jwtToken.project,
      baseUrl,
    )
    const serviceId = await API.getEntityId(
      apiKey,
      jwtToken.workspace,
      jwtToken.project,
      branchId,
      service,
      'platform_component',
      baseUrl,
    )

    await API.createRelease(
      apiKey,
      jwtToken.workspace,
      jwtToken.project,
      {
        entity: serviceId,
        version: release,
        releaseNotes: releaseNotes || '',
        commitHash,
        repositoryUrl,
      },
      baseUrl,
    )

    callback(null, { message: 'Release created successfully' })
  } catch (err) {
    callback(err as Error, null)
  }
}
