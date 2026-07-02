#!/usr/bin/env node
'use strict'

const { put } = require('@vercel/blob')
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN

if (!TOKEN) {
  console.error('ERROR: BLOB_READ_WRITE_TOKEN not set')
  process.exit(1)
}

async function main() {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
  console.log(`Uploading ${files.length} files to Vercel Blob...`)
  let ok = 0, fail = 0
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(DATA_DIR, file))
      const result = await put(file, content, {
        access: 'public',
        token: TOKEN,
        addRandomSuffix: false,
      })
      console.log(`  OK  ${file}`)
      // Print URL only for first file so you can set BLOB_BASE_URL
      if (ok === 0) {
        const baseUrl = result.url.substring(0, result.url.lastIndexOf('/'))
        console.log(`  >>> Set BLOB_BASE_URL=${baseUrl}`)
      }
      ok++
    } catch (e) {
      console.error(`  ERR ${file}: ${e.message}`)
      fail++
    }
  }
  console.log(`Done: ${ok} uploaded, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
