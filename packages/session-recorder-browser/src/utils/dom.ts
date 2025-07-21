import DOMPurify from 'dompurify'

/**
 * DOM utility functions
 */

export function insertTrustedHTML(element: HTMLElement, html: string) {
  const sanitizedHTML = DOMPurify.sanitize(html, { RETURN_DOM: true })

  element.replaceChildren(...Array.from(sanitizedHTML.childNodes))
}