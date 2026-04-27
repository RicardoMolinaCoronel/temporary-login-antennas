#!/usr/bin/env node
/**
 * Build script: converts the PNG logo to ICO and then runs electron-packager.
 * Run via: npm run build
 */

const { execSync }      = require('child_process')
const pngToIcoMod       = require('png-to-ico')
const pngToIco          = pngToIcoMod.default ?? pngToIcoMod
const { Jimp, JimpMime } = require('jimp')
const fs                = require('fs')
const path              = require('path')

const ROOT     = path.join(__dirname, '..')
const PNG_SRC  = path.join(ROOT, 'src', 'renderer', 'SINPRO_ONLY_LOGO.png')
const BUILD_DIR = path.join(ROOT, 'build')
const ICO_OUT  = path.join(BUILD_DIR, 'icon.ico')

async function main() {
  // ── 1. Convert icon ───────────────────────────────────────────────────────
  if (!fs.existsSync(PNG_SRC)) {
    console.warn(`[build] Icon PNG not found at ${PNG_SRC}, using Electron default.`)
  } else {
    if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true })
    console.log('[build] Resizing PNG to square and converting → ICO…')

    // Resize to 256×256 (the PNG is nearly square so this looks fine)
    const img = await Jimp.read(PNG_SRC)
    img.resize({ w: 256, h: 256 })
    const canvas = new Jimp({ width: 256, height: 256, color: 0x00000000 })
    canvas.composite(img)
    const squareBuf = await canvas.getBuffer(JimpMime.png)

    const buf = await pngToIco(squareBuf)
    fs.writeFileSync(ICO_OUT, buf)
    console.log(`[build] Icon written to ${ICO_OUT}`)
  }

  // ── 2. Run electron-packager ──────────────────────────────────────────────
  const iconFlag = fs.existsSync(ICO_OUT) ? `--icon=build/icon.ico` : ''

  const cmd = [
    'electron-packager',
    '.',
    '"SINPRO Console"',
    '--platform=win32',
    '--arch=x64',
    '--out=dist',
    '--overwrite',
    '--asar',
    iconFlag,
    '--extra-resource=src/config',
    '--extra-resource=src/assets',
    '--ignore="^/src/(config|assets)|^/dist|^/node_modules|^/build|^/scripts"',
  ].filter(Boolean).join(' ')

  console.log('[build] Running electron-packager…')
  execSync(cmd, { stdio: 'inherit', cwd: ROOT })
  console.log('[build] Done! Output: dist/SINPRO Console-win32-x64/')
}

main().catch(err => { console.error('[build] Error:', err); process.exit(1) })
