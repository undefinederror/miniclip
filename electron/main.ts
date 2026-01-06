import { app, BrowserWindow, ipcMain, clipboard, globalShortcut, Tray, Menu, nativeImage } from 'electron'

app.commandLine.appendSwitch('no-sandbox')
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

app.setName('Miniclip')
app.setAppUserModelId('com.miniclip.app')

let win: BrowserWindow | null
let prefsWin: BrowserWindow | null = null
let tray: Tray | null = null
let db: any

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

interface Settings {
  launchOnStartup: boolean
  maxHistorySize: number
  autoCloseOnSelect: boolean
  globalShortcut: string
}

const defaultSettings: Settings = {
  launchOnStartup: true,
  maxHistorySize: 20,
  autoCloseOnSelect: true,
  globalShortcut: 'CommandOrControl+Alt+G'
}

function getSettings(): Settings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return { ...defaultSettings, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) }
    }
  } catch (e) {
    console.error('Failed to read settings:', e)
  }
  return defaultSettings
}

function saveSettings(settings: Settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))
    updateAutostart(settings.launchOnStartup)
    // Always trim DB on setting change
    if (db) {
      db.prepare('DELETE FROM clipboard_history WHERE id NOT IN (SELECT id FROM clipboard_history ORDER BY id DESC LIMIT ?)').run(settings.maxHistorySize)

      // Update global shortcut if changed
      globalShortcut.unregisterAll()
      registerShortcut(settings.globalShortcut)

      // Notify windows to refresh
      win?.webContents.send('settings-changed')
    }
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}

function updateAutostart(enable: boolean) {
  if (process.platform !== 'linux') return
  const autostartDir = path.join(app.getPath('home'), '.config', 'autostart')
  const desktopFilePath = path.join(autostartDir, 'miniclip.desktop')

  if (enable) {
    const desktopFileContent = `[Desktop Entry]
Type=Application
Version=1.0
Name=Miniclip
Comment=Clipboard Manager
Exec=${process.env.APPIMAGE || app.getPath('exe')}
Icon=${path.join(process.env.VITE_PUBLIC, 'icon.png')}
Terminal=false
StartupNotify=false
`
    try {
      if (!fs.existsSync(autostartDir)) {
        fs.mkdirSync(autostartDir, { recursive: true })
      }
      fs.writeFileSync(desktopFilePath, desktopFileContent)
    } catch (e) {
      console.error('Failed to create autostart file:', e)
    }
  } else {
    try {
      if (fs.existsSync(desktopFilePath)) {
        fs.unlinkSync(desktopFilePath)
      }
    } catch (e) {
      console.error('Failed to remove autostart file:', e)
    }
  }
}

function initDB() {
  db = new Database(':memory:')
  db.exec(`
    CREATE TABLE IF NOT EXISTS clipboard_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

function registerShortcut(accelerator: string) {
  try {
    const success = globalShortcut.register(accelerator, () => {
      if (win) {
        win.show()
        win.focus()
      }
    })
    if (!success) {
      console.error(`Failed to register shortcut: ${accelerator}`)
    }
  } catch (e) {
    console.error(`Error registering shortcut: ${accelerator}`, e)
  }
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, 'icon.png'))
  tray = new Tray(icon)

  // Use createFromPath for PNGs - usually more reliable
  const loadIcon = (name: string) => {
    const p = path.join(process.env.VITE_PUBLIC, name)
    const img = nativeImage.createFromPath(p)
    if (img.isEmpty()) {
      console.error(`Tray icon ${name} is empty! Checked path: ${p}`)
    }
    return img
  }

  const showIcon = loadIcon('tray_show.png')
  const prefsIcon = loadIcon('tray_preferences.png')
  const quitIcon = loadIcon('tray_quit.png')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      icon: showIcon,
      click: () => {
        win?.show()
        win?.focus()
      },
    },
    {
      label: 'Preferences',
      icon: prefsIcon,
      click: () => {
        createPreferencesWindow()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      icon: quitIcon,
      click: () => {
        app.quit()
      },
    },
  ])
  tray.setToolTip('Miniclip')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (win?.isVisible()) {
      win.hide()
    } else {
      win?.show()
      win?.focus()
    }
  })
}

function createPreferencesWindow() {
  if (prefsWin) {
    prefsWin.focus()
    return
  }

  prefsWin = new BrowserWindow({
    title: 'Preferences',
    icon: nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, 'icon.png')),
    width: 350,
    height: 450,
    resizable: false,
    frame: true,
    backgroundColor: '#242424', // GNOME Dark BG
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  prefsWin.setMenu(null)

  if (VITE_DEV_SERVER_URL) {
    prefsWin.loadURL(`${VITE_DEV_SERVER_URL}#preferences`)
  } else {
    prefsWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: 'preferences' })
  }

  prefsWin.on('closed', () => {
    prefsWin = null
  })
}

function createWindow() {
  const iconPath = path.join(process.env.VITE_PUBLIC, 'icon.png')
  win = new BrowserWindow({
    icon: nativeImage.createFromPath(iconPath),
    frame: true, // Spotlight style
    width: 600,
    height: 400,
    backgroundColor: '#242424', // GNOME Dark BG
    show: false, // Start hidden to prevent white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'), // Auto-compiled to mjs
    },
  })

  win.once('ready-to-show', () => {
    win?.show()
  })

  // Prevent closing, just hide
  win.setMenu(null) // Hide the default menu bar
  win.on('close', (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault()
      win?.webContents.send('window-hidden')
      win?.hide()
    }
  })

  // Enable F12 to open DevTools
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      win?.webContents.toggleDevTools()
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  ; (app as any).isQuitting = true
})

app.whenReady().then(() => {
  initDB()
  const settings = getSettings()
  updateAutostart(settings.launchOnStartup)
  createTray()
  createWindow()

  // --- IPC Handlers ---
  ipcMain.handle('close-window', () => {
    win?.webContents.send('window-hidden')
    win?.hide()
  })

  ipcMain.handle('get-settings', () => {
    return getSettings()
  })

  ipcMain.handle('set-settings', (_event, settings: Settings) => {
    saveSettings(settings)
    win?.webContents.send('settings-changed')
  })

  ipcMain.handle('get-history', () => {
    const settings = getSettings()
    const stmt = db.prepare('SELECT * FROM clipboard_history ORDER BY id DESC LIMIT ?')
    return stmt.all(settings.maxHistorySize)
  })

  ipcMain.handle('copy-to-clipboard', (_event, text) => {
    clipboard.writeText(text)
  })

  ipcMain.handle('delete-history-item', (_event, id: number) => {
    db.prepare('DELETE FROM clipboard_history WHERE id = ?').run(id)
  })

  ipcMain.handle('hide-window', () => {
    win?.webContents.send('window-hidden')
    win?.hide()
  })

  ipcMain.handle('minimize-window', () => {
    win?.minimize()
  })

  // --- Global Shortcut ---
  registerShortcut(getSettings().globalShortcut)

  // --- Clipboard Monitoring ---
  let lastText = clipboard.readText()
  setInterval(() => {
    const text = clipboard.readText()
    if (text && text !== lastText) {
      lastText = text
      const settings = getSettings()
      // Save to DB
      try {
        const stmt = db.prepare('INSERT INTO clipboard_history (content) VALUES (?)')
        stmt.run(text)

        // Always trim DB by default
        db.prepare('DELETE FROM clipboard_history WHERE id NOT IN (SELECT id FROM clipboard_history ORDER BY id DESC LIMIT ?)').run(settings.maxHistorySize)

        // Notify Renderer
        win?.webContents.send('clipboard-change', text)
      } catch (e) {
        console.error('DB Insert Error:', e)
      }
    }
  }, 1000)
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  db?.close()
})
