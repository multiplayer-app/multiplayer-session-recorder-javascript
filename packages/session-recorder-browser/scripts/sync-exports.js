#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const pkgPath = path.join(root, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

const optional = {
  './browser': './dist/browser/index.js',
  './exporters': './dist/exporters/index.js',
}

const next = { '.': pkg.exports['.'] }

for (const [key, file] of Object.entries(optional)) {
  if (fs.existsSync(path.join(root, file))) {
    next[key] = file
  }
}

pkg.exports = next
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

const added = Object.keys(next).filter((k) => k !== '.')
console.log(`exports synced: ${added.length ? added.join(', ') : 'core only'}`)
