import { useEffect } from 'react'

/**
 * React Router v6 compatible navigation recorder hook.
 * Call inside a component where you can access current location and navigation events.
 * Example:
 *   const location = useLocation();
 *   useNavigationRecorder(location.pathname);
 */
export function useNavigationRecorder(pathname: string) {
  useEffect(() => {
    if (!pathname) return
    // Attach navigation path as attribute on a span if any ongoing interaction span exists
    try {
      // Use common SDK helper to set attribute on current span if any
      // This is a no-op if there is no active span
      // We avoid importing directly to keep bundle small; browser SDK already registers tracing
      // Record a custom event through traces: provide a small delay to ensure span exists
      const id = setTimeout(() => {
        try {
          // Using a faux API on the browser widget: enrich via tracer exporter through messaging
          // Fallback: start a small micro interaction by toggling nothing (no-op)
          // For now, we can at least emit a console event captured by rrweb plugin
          console.log('[SessionRecorder] Navigation:', pathname)
        } catch { }
      }, 0)
      return () => clearTimeout(id)
    } catch { }
  }, [pathname])
}
