const { app, BrowserWindow, BrowserView, ipcMain, shell, Menu } = require('electron')
const path = require('path')
const fs   = require('fs')
const net  = require('net')

const CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config', 'antennas.json'), 'utf8')
)

let loginWin      = null
let mainWin       = null
let view          = null
let antennasWin   = null

const HEADER_HEIGHT = 72
const IS_DEV = !!process.env.ELECTRON_START_URL

const sessionState = {
  user: null,          // { id, username, displayName, company_id }
  currentAntenna: null
}

// --------- Windows ---------

function createLoginWindow() {
  loginWin = new BrowserWindow({
    width: 550,
    height: 500,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  Menu.setApplicationMenu(null)
  loginWin.loadFile(path.join(__dirname, 'renderer', 'login.html'))

  loginWin.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault()
  })
}

function createMainWindow() {
  const isMac = process.platform === 'darwin'
  mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    titleBarStyle: isMac ? 'hidden' : 'default',
    ...(isMac ? {
      titleBarOverlay: {
        color: '#0f172a',
        symbolColor: '#e5e7eb',
        height: HEADER_HEIGHT
      },
      trafficLightPosition: { x: 12, y: 16 }
    } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  Menu.setApplicationMenu(null)
  mainWin.loadFile(path.join(__dirname, 'renderer', 'main.html'))

  view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  })

  mainWin.setBrowserView(view)
  resizeViewBounds()

  view.webContents.on('did-fail-load', (_ev, errorCode, errorDesc, validatedURL) => {
    mainWin?.webContents.send('view:error', `[${errorCode}] ${errorDesc} → ${validatedURL}`)
  })
  view.webContents.on('did-navigate', (_ev, url) => {
    mainWin?.webContents.send('view:status', `Navegado: ${url}`)
  })

  mainWin.on('resize', resizeViewBounds)
  mainWin.on('closed', () => {
    antennasWin?.close()
    antennasWin = null
    mainWin = null
    view = null
  })
}

function createAntennasWindow() {
  if (antennasWin && !antennasWin.isDestroyed()) {
    antennasWin.focus()
    return
  }
  antennasWin = new BrowserWindow({
    width: 860,
    height: 600,
    minWidth: 640,
    minHeight: 400,
    autoHideMenuBar: true,
    parent: mainWin,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  Menu.setApplicationMenu(null)
  antennasWin.loadFile(path.join(__dirname, 'renderer', 'antennas-view.html'))
  antennasWin.on('closed', () => { antennasWin = null })
}

function resizeViewBounds() {
  if (!mainWin || !view) return
  const [w, h] = mainWin.getContentSize()
  view.setBounds({ x: 0, y: HEADER_HEIGHT, width: w, height: h - HEADER_HEIGHT })
  view.setAutoResize({ width: true, height: true })
}

function isAllowed(url) {
  return CONFIG.allowedOrigins.some(origin => url.startsWith(origin))
}

// --------- Utilities ---------

/**
 * TCP-level reachability check. Faster than a full HTTP request and avoids
 * auth/redirect issues. Returns true if the host:port is reachable.
 */
function checkAntennaOnline(antennaUrl, timeoutMs = 3000) {
  return new Promise((resolve) => {
    try {
      const u     = new URL(antennaUrl)
      const port  = u.port ? parseInt(u.port) : (u.protocol === 'https:' ? 443 : 80)
      const host  = u.hostname
      const sock  = new net.Socket()

      sock.setTimeout(timeoutMs)
      sock.connect(port, host, () => { sock.destroy(); resolve(true)  })
      sock.on('timeout', ()      => { sock.destroy(); resolve(false) })
      sock.on('error',   ()      => { sock.destroy(); resolve(false) })
    } catch {
      resolve(false)
    }
  })
}

/** Read a local image and return a base64 data-URL, or null on failure. */
function imageToDataUrl(imagePath) {
  try {
    const abs  = path.resolve(__dirname, imagePath)
    const data = fs.readFileSync(abs)
    const ext  = path.extname(abs).slice(1).toLowerCase()
    const mime = ext === 'png' ? 'image/png'
               : (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg'
               : 'image/png'
    return `data:${mime};base64,${data.toString('base64')}`
  } catch {
    return null
  }
}

// --------- Auth ---------

function verifyCredentials({ username, password }) {
  const user = (CONFIG.users || []).find(
    u => u.username === username && u.password === password
  )
  if (user) {
    return { ok: true, userId: user.id, name: user.name, companyId: user.company_id }
  }
  return { ok: false }
}

// --------- IPC Handlers ---------

ipcMain.handle('auth:login', async (_ev, { username, password }) => {
  const res = verifyCredentials({ username, password })
  if (!res.ok) return { ok: false, message: 'Usuario o contraseña inválidos' }

  sessionState.user = {
    id:          res.userId,
    username,
    displayName: res.name || username,
    company_id:  res.companyId
  }
  sessionState.currentAntenna = null

  createMainWindow()
  loginWin?.close()
  loginWin = null

  return { ok: true }
})

ipcMain.handle('app:getSession', async () => ({
  user:           sessionState.user,
  currentAntenna: sessionState.currentAntenna
}))

ipcMain.handle('app:getCompany', async () => {
  const companyId = sessionState.user?.company_id
  if (!companyId) return null

  const company = (CONFIG.companies || []).find(c => c.id === companyId)
  if (!company) return null

  return {
    ...company,
    imageDataUrl: company.image_path ? imageToDataUrl(company.image_path) : null
  }
})

ipcMain.handle('app:getAntennas', async () => {
  const companyId = sessionState.user?.company_id
  if (!companyId) return []

  return CONFIG.antennas.filter(ant => {
    const locality = CONFIG.localities.find(l => l.id === ant.locality_id)
    return locality?.company_id === companyId
  })
})

ipcMain.handle('app:getLocalities', async () => {
  const companyId = sessionState.user?.company_id
  if (!companyId) return []

  return CONFIG.localities.filter(l => l.company_id === companyId)
})

ipcMain.handle('app:getAntennaStatuses', async () => {
  const companyId = sessionState.user?.company_id
  if (!companyId) return []

  const companyAntennas = CONFIG.antennas.filter(ant => {
    const locality = CONFIG.localities.find(l => l.id === ant.locality_id)
    return locality?.company_id === companyId
  })

  const results = await Promise.all(
    companyAntennas.map(async (ant) => {
      const online   = await checkAntennaOnline(ant.url)
      const locality = CONFIG.localities.find(l => l.id === ant.locality_id)
      return {
        id:            ant.id,
        name:          ant.name,
        ip:            ant.ip,
        url:           ant.url,
        locality_name: locality?.name || '—',
        online
      }
    })
  )

  return results
})

ipcMain.handle('view:openAntennasStatus', async () => {
  createAntennasWindow()
  return { ok: true }
})

ipcMain.handle('navigate:to', async (_ev, antennaId) => {
  const ant = CONFIG.antennas.find(a => a.id === antennaId)
  if (!ant) return { ok: false, message: 'Antena no encontrada' }
  if (!isAllowed(ant.url)) return { ok: false, message: 'Destino no permitido por configuración' }

  try {
    sessionState.currentAntenna = ant
    view.webContents.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    )
    await view.webContents.loadURL(ant.url)
    mainWin?.webContents.send('antenna:changed', ant)
    return { ok: true }
  } catch (err) {
    return { ok: false, message: String(err) }
  }
})

ipcMain.on('shell:openExternal', (_ev, url) => {
  if (typeof url === 'string') shell.openExternal(url)
})

// --------- App lifecycle ---------

app.whenReady().then(createLoginWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (!loginWin && !mainWin) createLoginWindow()
})
