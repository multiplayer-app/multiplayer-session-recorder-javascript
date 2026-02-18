import fs from 'fs'
import path from 'path'
import * as API from '../../api.js'
import { decodeJwtToken } from '../../helper.js'

const collectSourcemaps = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectSourcemaps(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.map')) {
      files.push(fullPath)
    }
  }
  return files
}

export const upload = async (directories, options, callback) => {
  try {
    const { apiKey, service, release, baseUrl } = options

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

    const files = directories.flatMap(collectSourcemaps)

    if (files.length === 0) {
      return callback(new Error(`No sourcemap files found in directories: ${directories.join(', ')}`), null)
    }

    for (const filePath of files) {
      const stream = fs.createReadStream(filePath)
      await API.uploadSourcemap(
        apiKey,
        jwtToken.workspace,
        jwtToken.project,
        releaseId,
        filePath,
        stream,
        baseUrl,
      )
    }

    callback(null, { message: `Uploaded ${files.length} sourcemap(s) successfully` })
  } catch (err) {
    callback(err, null)
  }
}
