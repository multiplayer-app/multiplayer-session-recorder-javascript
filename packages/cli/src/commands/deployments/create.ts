import jwt from 'jsonwebtoken'
import * as API from '../api.js'

interface DeploymentOptions {
  apiKey: string
  service: string
  release: string
  environment: string
  baseUrl?: string
}

export const create = async (
  options: DeploymentOptions,
  callback: (err: Error | null, result: unknown) => void,
): Promise<void> => {
  try {
    const { apiKey, service, release, environment, baseUrl } = options
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
    const releaseId = await API.getReleaseId(
      apiKey,
      jwtToken.workspace,
      jwtToken.project,
      serviceId,
      release,
      baseUrl,
    )
    const environmentId = await API.getEntityId(
      apiKey,
      jwtToken.workspace,
      jwtToken.project,
      branchId,
      environment,
      'environment',
      baseUrl,
    )

    await API.createDeployment(apiKey, jwtToken.workspace, jwtToken.project, {
      entity: serviceId,
      release: releaseId,
      environment: environmentId,
    }, baseUrl)

    callback(null, { message: 'Deployment created successfully' })
  } catch (err) {
    callback(err as Error, null)
  }
}
