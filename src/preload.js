const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {

  // login window
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),

  // main window
  getSession: () => ipcRenderer.invoke('app:getSession'),
  getAntennas: () => ipcRenderer.invoke('app:getAntennas'),
  navigateTo: (antennaId) => ipcRenderer.invoke('navigate:to', antennaId),
  openExternal: (url) => ipcRenderer.send('shell:openExternal', url),

  // events from main process
  onViewError: (cb) => ipcRenderer.on('view:error', (_e, msg) => cb(msg)),
  onViewStatus: (cb) => ipcRenderer.on('view:status', (_e, msg) => cb(msg)),
  onAntennaChanged: (cb) => ipcRenderer.on('antenna:changed', (_e, ant) => cb(ant)),
  platform: process.platform

  
})
