import * as API from '../../api.js'
import { decodeJwtToken } from '../../helper.js'

export const create = async (options, callback) => {
  try {
    const {
      apiKey,
      service,
      release,
      environment,
      baseUrl,
    } = options

    const jwtToken = decodeJwtToken(apiKey) || {}

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

    await API.createDeployment(
      apiKey,
      jwtToken.workspace,
      jwtToken.project,
      {
        entity: serviceId,
        release: releaseId,
        environment: environmentId,
      },
      baseUrl,
    )

    callback(null, {
      message: 'Deployment created successfully',
    })
  } catch (err) {
    callback(err, null)
  }
}
