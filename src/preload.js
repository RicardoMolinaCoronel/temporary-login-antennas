const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  getAntennas: () => ipcRenderer.invoke('app:getAntennas'),
  navigateTo: (url) => ipcRenderer.invoke('navigate:to', url),
  openExternal: (url) => ipcRenderer.send('shell:openExternal', url)
})
