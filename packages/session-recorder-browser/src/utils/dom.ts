import DOMPurify from 'dompurify'

/**
 * DOM utility functions
 */

export function insertTrustedHTML(element: HTMLElement | ShadowRoot, html: string) {
  const sanitizedHTML = DOMPurify.sanitize(html, { RETURN_DOM: true })

  element.replaceChildren(...Array.from(sanitizedHTML.childNodes))
}

/**
 * Injects CSS styles into a ShadowRoot
 * @param shadowRoot - The shadow root to inject styles into
 * @param cssText - The CSS text to inject
 */
export function injectStylesIntoShadowRoot(shadowRoot: ShadowRoot, cssText: string): void {
  const style = document.createElement('style')
  style.textContent = cssText
  shadowRoot.appendChild(style)
}
