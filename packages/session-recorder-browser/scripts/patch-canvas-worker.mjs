import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const bundlePath = resolve(__dirname, '../dist/browser/index.js')

let content = readFileSync(bundlePath, 'utf-8')

// Replace rrweb's inline base64 canvas worker with a URL-based Worker.
// The URL is read from a <meta name="mp-rrweb-worker-url"> tag injected by
// content.js (using chrome.runtime.getURL). A meta tag is used instead of an
// inline script so this works on pages with strict Content Security Policies.
//
// Pattern matches from `const encodedJs = "..."` through the closing `}` of
// WorkerWrapper, using `class CanvasManager {` as the right-boundary anchor.
const pattern = /const encodedJs = "[^"]+";[\s\S]*?\n\}(?=\nclass CanvasManager \{)/

const replacement = `function WorkerWrapper(options) {
  const meta = typeof document !== "undefined" && document.querySelector('meta[name="mp-rrweb-worker-url"]');
  const workerUrl = meta && meta.content;
  if (!workerUrl) return null;
  return new Worker(workerUrl, { name: options == null ? void 0 : options.name });
}`

if (!pattern.test(content)) {
  console.error('❌ patch-canvas-worker: could not find rrweb WorkerWrapper pattern.')
  console.error('   The rrweb bundle structure may have changed — update the patch regex.')
  process.exit(1)
}

content = content.replace(pattern, replacement)
writeFileSync(bundlePath, content, 'utf-8')
console.log('✓ Patched rrweb canvas worker: replaced inline base64 with window.__MP_RRWEB_WORKER_URL__')
