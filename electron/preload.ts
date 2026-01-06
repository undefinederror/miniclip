import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  onClipboardChange: (callback: (text: string) => void) => {
    const subscription = (_event: any, text: string) => callback(text)
    ipcRenderer.on('clipboard-change', subscription)
    return () => {
      ipcRenderer.removeListener('clipboard-change', subscription)
    }
  },
  onSettingsChanged: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('settings-changed', listener)
    return () => ipcRenderer.removeListener('settings-changed', listener)
  },
  onWindowHidden: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('window-hidden', listener)
    return () => ipcRenderer.removeListener('window-hidden', listener)
  },
  getHistory: () => ipcRenderer.invoke('get-history'),
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  deleteHistoryItem: (id: number) => ipcRenderer.invoke('delete-history-item', id),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings: any) => ipcRenderer.invoke('set-settings', settings),
})
