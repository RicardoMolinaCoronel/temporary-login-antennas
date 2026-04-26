const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {

  // Auth
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),

  // Session & config
  getSession:          ()           => ipcRenderer.invoke('app:getSession'),
  getCompany:          ()           => ipcRenderer.invoke('app:getCompany'),
  getAntennas:         ()           => ipcRenderer.invoke('app:getAntennas'),
  getLocalities:       ()           => ipcRenderer.invoke('app:getLocalities'),
  getAntennaStatuses:  ()           => ipcRenderer.invoke('app:getAntennaStatuses'),

  // Navigation
  navigateTo:          (antennaId)  => ipcRenderer.invoke('navigate:to', antennaId),
  openAntennasStatus:  ()           => ipcRenderer.invoke('view:openAntennasStatus'),
  openExternal:        (url)        => ipcRenderer.send('shell:openExternal', url),

  // Events from main process
  onViewError:         (cb) => ipcRenderer.on('view:error',      (_e, msg) => cb(msg)),
  onViewStatus:        (cb) => ipcRenderer.on('view:status',     (_e, msg) => cb(msg)),
  onAntennaChanged:    (cb) => ipcRenderer.on('antenna:changed', (_e, ant) => cb(ant)),

  platform: process.platform
})
