const { app, BrowserWindow, BrowserView, ipcMain, shell, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
//const contextMenu = require('electron-context-menu')

const CONFIG = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'config', 'antennas.json'), 'utf8')
)

let win = null
let view = null

const HEADER_HEIGHT = 72 // altura ocupada por el header/toolbar HTML (selector/login)
const IS_DEV = !!process.env.ELECTRON_START_URL

function createMainWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: true,
    autoHideMenuBar: true, // sin menú (oculta barra)
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  Menu.setApplicationMenu(null) // sin menú app

// Desactiva menú contextual dentro del BrowserView también
view = new BrowserView({
    webPreferences: { contextIsolation: true, sandbox: true }
  })
  win.setBrowserView(view)
  view.webContents.on('context-menu', (e) => e.preventDefault())
  // Desactiva menú contextual o limítalo
  /*contextMenu({
    window: win,
    showCopyImageAddress: false,
    showInspectElement: IS_DEV, // Solo en dev
    shouldShowMenu: () => IS_DEV // en prod, no mostrar
  })*/

  // Opcional: quita completamente el Application Menu
  //Menu.setApplicationMenu(null)

  // Carga la UI de login/selector
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  // Crea el BrowserView pero no navega aún (hasta login+selección)
  view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  })
  win.setBrowserView(view)
  resizeViewBounds()

  // Seguridad de navegación en el BrowserView
  view.webContents.setWindowOpenHandler(({ url }) => {
    // Bloquea popups nuevas; si quieres permitir abrir externas en el navegador:
    // return { action: 'allow' } y maneja con shell.openExternal
    return { action: 'deny' }
  })

  view.webContents.on('will-navigate', (event, url) => {
    if (!isAllowed(url)) {
      event.preventDefault()
    }
  })

  view.webContents.on('did-attach-webview', (e) => {
    // No usamos <webview>, así que en teoría no debiera disparar
  })

  view.webContents.on('new-window', (e, url) => {
    e.preventDefault()
  })

  // Evita arrastrar archivos al BrowserView que cambien la navegación
  win.webContents.on('will-navigate', (event, url) => {
    // La ventana principal solo muestra la UI local
    const isLocal = url.startsWith('file://')
    if (!isLocal) event.preventDefault()
  })

  // Recalcula bounds del BrowserView al redimensionar
  win.on('resize', resizeViewBounds)
}

function resizeViewBounds() {
  if (!win || !view) return
  const [width, height] = win.getContentSize()
  view.setBounds({ x: 0, y: HEADER_HEIGHT, width, height: height - HEADER_HEIGHT })
  view.setAutoResize({ width: true, height: true })
}

function isAllowed(url) {
  // Permite navegar solo a orígenes definidos
  return CONFIG.allowedOrigins.some(origin => url.startsWith(origin))
}

// ---- IPC: autenticación y navegación ---------------------------------

// DEMO: auth simple. Cambia por tu backend real (API, LDAP, OAuth, etc.)
function verifyCredentials({ username, password }) {
  // Ejemplo: admin / admin123
  return username === 'admin' && password === 'admin123'
}

ipcMain.handle('auth:login', async (_ev, { username, password }) => {
  const ok = verifyCredentials({ username, password })
  return { ok, message: ok ? 'OK' : 'Usuario o contraseña inválidos' }
})

ipcMain.handle('app:getAntennas', async () => {
  return CONFIG.antennas
})

ipcMain.handle('navigate:to', async (_ev, url) => {
  if (!isAllowed(url)) {
    return { ok: false, message: 'Destino no permitido por configuración.' }
  }
  try {
    await view.webContents.loadURL(url, { userAgent: 'AntennaApp/1.0' })
    return { ok: true }
  } catch (err) {
    return { ok: false, message: String(err) }
  }
})

// (Opcional) abrir enlaces externos desde la UI (si los hubiera)
ipcMain.on('shell:openExternal', (_ev, url) => {
  if (typeof url === 'string') shell.openExternal(url)
})

// ----------------------------------------------------------------------

app.whenReady().then(createMainWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
})
