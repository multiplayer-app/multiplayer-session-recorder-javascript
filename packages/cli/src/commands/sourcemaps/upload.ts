import fs from 'fs'
import path from 'path'
import jwt from 'jsonwebtoken'
import * as API from '../../services/version-api.service.js'

interface SourcemapOptions {
  apiKey: string
  service: string
  release: string
  baseUrl?: string
}

const collectSourcemaps = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files: string[] = []

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

export const upload = async (
  directories: string[],
  options: SourcemapOptions,
  callback: (err: Error | null, result: unknown) => void,
): Promise<void> => {
  try {
    const { apiKey, service, release, baseUrl } = options
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
      branchId, service, 'platform_component', baseUrl)
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
      const stream: import('fs').ReadStream = fs.createReadStream(filePath)
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
    callback(err as Error, null)
  }
}
