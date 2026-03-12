#!/usr/bin/env node
// Automatically keeps build/metainfo/com.miniclip.app.appdata.xml in sync
// with the version in package.json. Run as part of the build step.

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const version = pkg.version
const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD

const metainfoPath = resolve(root, 'build/metainfo/com.miniclip.app.appdata.xml')
let xml = readFileSync(metainfoPath, 'utf8')

// Check if this version already exists — skip if so (idempotent)
if (xml.includes(`version="${version}"`)) {
  console.log(`[metainfo] version ${version} already present, skipping.`)
  process.exit(0)
}

const newEntry = `    <release version="${version}" date="${date}">
      <description>
        <p>Release ${version}.</p>
      </description>
    </release>`

// Insert before the first existing <release ...>
xml = xml.replace('<releases>', `<releases>\n${newEntry}`)

writeFileSync(metainfoPath, xml, 'utf8')
console.log(`[metainfo] Added release ${version} (${date}).`)
