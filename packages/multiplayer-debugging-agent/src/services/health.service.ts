import http from 'http'
import type { RuntimeController } from '../runtime/controller.js'

/**
 * Minimal HTTP health server for Kubernetes liveness/readiness probes.
 *
 * GET /healthz  — liveness:  returns 200 as long as the process is running
 * GET /readyz   — readiness: returns 200 when connected to Multiplayer, 503 otherwise
 * GET /metrics  — basic stats as JSON (active sessions, resolved count, etc.)
 */
export function startHealthServer(port: number, controller: RuntimeController): http.Server {
  const server = http.createServer((req, res) => {
    const state = controller.getState()

    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
      return
    }

    if (req.url === '/readyz') {
      if (state.connection === 'connected') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('ok')
      } else {
        res.writeHead(503, { 'Content-Type': 'text/plain' })
        res.end(state.connection)
      }
      return
    }

    if (req.url === '/metrics') {
      const body = JSON.stringify({
        connection: state.connection,
        activeSessions: state.rateLimitState.active,
        maxConcurrent: state.rateLimitState.limit,
        resolvedCount: state.resolvedCount,
        sessions: state.sessions.map((s) => ({
          chatId: s.chatId,
          issueTitle: s.issueTitle,
          status: s.status,
          startedAt: s.startedAt,
        })),
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(body)
      return
    }

    res.writeHead(404)
    res.end()
  })

  server.listen(port)
  return server
}
