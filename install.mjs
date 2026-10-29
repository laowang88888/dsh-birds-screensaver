#!/usr/bin/env node
/**
 * Install the birds-screensaver plugin into a DeepSeek Harness profile.
 *
 * It does two things, both idempotent:
 *   1. links  <DSH_HOME>/profiles/node_modules/<package>  ->  this checkout
 *   2. appends an `insert` row to  <DSH_HOME>/profiles/<profile>/cordis.patch.yml
 *
 * Usage:
 *   node install.mjs [--profile desktop] [--password 1234] [--idle-ms 180000]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback
}

const profile = arg('--profile', 'desktop')
const password = arg('--password', '1234')
const idleMs = Number(arg('--idle-ms', '180000'))
if (!Number.isFinite(idleMs) || idleMs < 10000) {
  console.error('--idle-ms must be a number >= 10000')
  process.exit(1)
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name
const dshHome = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const linkPath = path.join(dshHome, 'profiles', 'node_modules', ...pkg.split('/'))
const patchPath = path.join(dshHome, 'profiles', profile, 'cordis.patch.yml')

if (!fs.existsSync(patchPath)) {
  console.error(`profile patch not found: ${patchPath}`)
  console.error('Start DeepSeek Harness once so it creates the profile, or pass --profile <name>.')
  process.exit(1)
}

// 1) link the package so the Loader can resolve it by name
fs.mkdirSync(path.dirname(linkPath), { recursive: true })
try {
  const st = fs.lstatSync(linkPath)
  if (st.isSymbolicLink()) {
    fs.unlinkSync(linkPath)
  } else {
    console.error(`refusing to replace a real directory: ${linkPath}`)
    process.exit(1)
  }
} catch {
  /* not present */
}
fs.symlinkSync(root, linkPath, process.platform === 'win32' ? 'junction' : 'dir')
console.log(`linked: ${linkPath} -> ${root}`)

// 2) register the plugin with an `insert` patch row
const block =
  '- insert:\n' +
  '    - id: birds-screensaver\n' +
  `      name: "${pkg}"\n` +
  '      config:\n' +
  `        defaultPassword: "${password}"\n` +
  `        idleMs: ${idleMs}\n`

let text = fs.readFileSync(patchPath, 'utf8')
if (/^\s*- id: birds-screensaver\s*$/m.test(text)) {
  console.log('birds-screensaver already registered; existing config left untouched.')
} else {
  fs.copyFileSync(patchPath, `${patchPath}.bak`)
  fs.writeFileSync(patchPath, text.trimEnd() + '\n' + block, 'utf8')
  console.log(`registered in ${patchPath}`)
}

console.log('\nDone. Restart DeepSeek Harness.')
console.log('A 🔒 button appears at the bottom-right; Ctrl+Shift+L also locks.')
