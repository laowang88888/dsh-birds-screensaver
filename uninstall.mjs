#!/usr/bin/env node
/**
 * Remove the birds-screensaver registration and its node_modules link.
 * The checkout itself is left untouched.
 *
 * Usage:
 *   node uninstall.mjs [--profile desktop]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const i = argv.indexOf('--profile')
const profile = i >= 0 && argv[i + 1] ? argv[i + 1] : 'desktop'

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name
const dshHome = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const linkPath = path.join(dshHome, 'profiles', 'node_modules', ...pkg.split('/'))
const patchPath = path.join(dshHome, 'profiles', profile, 'cordis.patch.yml')

try {
  const st = fs.lstatSync(linkPath)
  if (st.isSymbolicLink()) {
    fs.unlinkSync(linkPath)
    console.log(`unlinked: ${linkPath}`)
  }
} catch {
  console.log('link not present')
}

if (fs.existsSync(patchPath)) {
  const text = fs.readFileSync(patchPath, 'utf8')
  const next = text.replace(/\n- insert:\n(?: {4}[^\n]*\n)+/g, (block) =>
    block.includes('birds-screensaver') ? '' : block,
  )
  if (next !== text) {
    fs.copyFileSync(patchPath, `${patchPath}.bak`)
    fs.writeFileSync(patchPath, next, 'utf8')
    console.log('registration removed from cordis.patch.yml')
  } else {
    console.log('registration not found')
  }
}

console.log('Done. Restart DeepSeek Harness.')
