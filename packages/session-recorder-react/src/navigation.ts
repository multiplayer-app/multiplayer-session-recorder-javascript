import { useEffect, useRef } from 'react'
import SessionRecorderBrowser, {
  NavigationSignal,
} from '@multiplayer-app/session-recorder-browser'

export interface UseNavigationRecorderOptions
  extends Partial<Omit<NavigationSignal, 'path' | 'timestamp'>> {
  /**
   * Overrides the path sent to the recorder. Defaults to the provided pathname argument.
   */
  path?: string
  /**
   * When true (default), document.title is captured if available.
   */
  captureDocumentTitle?: boolean
}

/**
 * React Router compatible navigation recorder hook.
 * Call inside a component where you can access current location and navigation events.
 * Example:
 *   const location = useLocation();
 *   useNavigationRecorder(location.pathname);
 */
export function useNavigationRecorder(
  pathname: string,
  options?: UseNavigationRecorderOptions,
): void {
  const optionsRef = useRef(options)
  const hasRecordedInitialRef = useRef(false)
  const lastPathRef = useRef<string | null>(null)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    if (!pathname || !SessionRecorderBrowser?.navigation) {
      return
    }

    const resolvedOptions = optionsRef.current || {}
    const resolvedPath = resolvedOptions.path ?? pathname

    if (!resolvedPath) {
      return
    }

    if (lastPathRef.current === resolvedPath && !resolvedOptions.navigationType) {
      return
    }

    const captureDocumentTitle =
      resolvedOptions.captureDocumentTitle ?? true

    const signal: NavigationSignal = {
      path: resolvedPath,
      routeName: resolvedOptions.routeName ?? resolvedPath,
      title:
        resolvedOptions.title ??
        (captureDocumentTitle && typeof document !== 'undefined'
          ? document.title
          : undefined),
      url: resolvedOptions.url,
      params: resolvedOptions.params,
      state: resolvedOptions.state,
      navigationType:
        resolvedOptions.navigationType ??
        (hasRecordedInitialRef.current ? undefined : 'initial'),
      framework: resolvedOptions.framework ?? 'react',
      source: resolvedOptions.source ?? 'react-router',
      metadata: resolvedOptions.metadata,
    }

    try {
      SessionRecorderBrowser.navigation.record(signal)
      hasRecordedInitialRef.current = true
      lastPathRef.current = resolvedPath
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[SessionRecorder][React] Failed to record navigation', error)
      }
    }
  }, [pathname])
}
