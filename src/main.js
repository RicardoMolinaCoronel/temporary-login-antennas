const { app, BrowserWindow, BrowserView, ipcMain, shell, Menu, WebContentsView } = require('electron')
const path = require('path')
const fs = require('fs')

const CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config', 'antennas.json'), 'utf8')
)

let loginWin = null
let mainWin = null
let view = null

const HEADER_HEIGHT = 72
const IS_DEV = !!process.env.ELECTRON_START_URL

const sessionState = {
  user: null,             // { username, displayName }
  currentAntenna: null    // antenna object
}

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

  // Evita que la ventana navegue a sitios externos
  loginWin.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) e.preventDefault()
  })
}

function createMainWindow() {
  /*mainWin = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })*/
    const isMac = process.platform === 'darwin'
    mainWin = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      autoHideMenuBar: true,
      titleBarStyle: isMac ? 'hidden' : 'default', // overlay solo con hidden/hiddenInset
      ...(isMac ? {
        titleBarOverlay: {
          color: '#0f172a',          // mismo color que tu header
          symbolColor: '#e5e7eb',
          height: HEADER_HEIGHT      // ¡que coincida con tu header!
        },
        trafficLightPosition: { x: 12, y: 16 } // baja un poco los botones
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

  // Crea el BrowserView (contenedor sin barra de URL)
  view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  })


  mainWin.setBrowserView(view)
  resizeViewBounds()

  // Seguridad: bloquear popups y navegación a orígenes no permitidos
  /*view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  view.webContents.on('will-navigate', (event, url) => {
    if (!isAllowed(url)) event.preventDefault()
  })
  view.webContents.on('will-redirect', (event, url) => {
    if (!isAllowed(url)) event.preventDefault()
  })*/


  // Reportar errores de carga al renderer (log)
  view.webContents.on('did-fail-load', (_ev, errorCode, errorDesc, validatedURL) => {
    mainWin?.webContents.send('view:error', `[${errorCode}] ${errorDesc} → ${validatedURL}`)
  })
  view.webContents.on('did-navigate', (_ev, url) => {
    mainWin?.webContents.send('view:status', `Navegado: ${url}`)
  })

  mainWin.on('resize', resizeViewBounds)
  mainWin.on('closed', () => { mainWin = null; view = null })
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

// --------- Auth & IPC ---------

// DEMO auth — cámbialo por tu backend real
function verifyCredentials({ username, password }) {
  // ejemplo
  if (username === 'admin' && password === 'admin123') {
    return { ok: true, displayName: 'Administrador' }
  }
  return { ok: false }
}

ipcMain.handle('auth:login', async (_ev, { username, password }) => {
  const res = verifyCredentials({ username, password })
  if (!res.ok) return { ok: false, message: 'Usuario o contraseña inválidos' }

  sessionState.user = { username, displayName: res.displayName || username }
  sessionState.currentAntenna = null

  // Abrir Main y cerrar Login
  createMainWindow()
  loginWin?.close()
  loginWin = null

  return { ok: true }
})

ipcMain.handle('app:getSession', async () => {
  return {
    user: sessionState.user,
    currentAntenna: sessionState.currentAntenna
  }
})

ipcMain.handle('app:getAntennas', async () => {
  return CONFIG.antennas
})

ipcMain.handle('navigate:to', async (_ev, antennaId) => {
  const ant = CONFIG.antennas.find(a => a.id === antennaId)
  if (!ant) return { ok: false, message: 'Antena no encontrada' }
  if (!isAllowed(ant.url)) return { ok: false, message: 'Destino no permitido por configuración' }

  try {
    sessionState.currentAntenna = ant
    //await view.webContents.loadURL(ant.url, { userAgent: 'AntennaApp/1.1' })
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

app.whenReady().then(createLoginWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (!loginWin && !mainWin) createLoginWindow()
})
