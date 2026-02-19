import * as API from '../../api.js'
import { decodeJwtToken } from '../../helper.js'

export const create = async (options, callback) => {
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

    callback(null, {
      message: 'Release created successfully',
    })
  } catch (err) {
    callback(err, null)
  }
}
