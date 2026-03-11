process.env.ELECTRON_DISABLE_SANDBOX = '1'
import { app, BrowserWindow, ipcMain, clipboard, Tray, Menu, nativeImage, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import crypto from 'crypto'
import { Settings, defaultSettings } from '../src/shared/settings'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

const APP_ID = VITE_DEV_SERVER_URL ? 'miniclip-dev' : 'com.miniclip.app'
const APP_NAME = VITE_DEV_SERVER_URL ? 'Miniclip Dev' : 'Miniclip'

app.setName(APP_NAME)
app.setAppUserModelId(APP_ID)

let win: BrowserWindow | null
let prefsWin: BrowserWindow | null = null
let aboutWin: BrowserWindow | null = null
let tray: Tray | null = null
let db: Database.Database | null = null

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine) => {
    // If 'show' is in commandLine, show the window
    if (commandLine.includes('show')) {
      if (win) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
    } else {
      // Default behavior for second instance without arguments
      if (win) {
        if (win.isMinimized()) win.restore()
        win.focus()
      }
    }
  })
}

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

function getDb(): Database.Database {
  if (db) return db

  db = new Database(':memory:')
  db.exec(`
    CREATE TABLE IF NOT EXISTS clipboard_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      image_data BLOB,
      content_type TEXT DEFAULT 'text',
      original_format TEXT
    )
  `)

  // Migration for existing data
  try {
    db.prepare('UPDATE clipboard_history SET content_type = ? WHERE content_type IS NULL').run('text')
  } catch (e) {
    console.log('Migration completed or not needed:', e)
  }

  return db
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
    getDb().prepare('DELETE FROM clipboard_history WHERE id NOT IN (SELECT id FROM clipboard_history ORDER BY id DESC LIMIT ?)').run(settings.maxHistorySize)

    // Notify windows to refresh
    win?.webContents.send('settings-changed')
  } catch (e) {
    console.error('Failed to save settings:', e)
  }
}

function updateAutostart(enable: boolean) {
  if (process.platform !== 'linux') return
  const autostartDir = path.join(app.getPath('home'), '.config', 'autostart')
  const desktopFilePath = path.join(autostartDir, `${APP_ID}.desktop`)

  if (enable) {
    const desktopFileContent = `[Desktop Entry]
Type=Application
Version=1.0
Name=${APP_NAME}
Comment=Clipboard Manager
Exec=${process.env.APPIMAGE || app.getPath('exe')}
Icon=${path.join(process.env.VITE_PUBLIC, 'icon.png')}
Terminal=false
StartupNotify=false
StartupWMClass=${APP_ID}
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
    {
      label: 'About',
      icon: loadIcon('tray_info.png'),
      click: () => {
        createAboutWindow()
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
    title: `Preferences`,
    icon: nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, 'icon.png')),
    width: 350,
    height: 550,
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

function createAboutWindow() {
  if (aboutWin) {
    aboutWin.focus()
    return
  }

  aboutWin = new BrowserWindow({
    title: `About`,
    icon: nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, 'icon.png')),
    width: 350,
    height: 400,
    resizable: false,
    frame: true,
    backgroundColor: '#242424', // GNOME Dark BG
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  aboutWin.setMenu(null)

  aboutWin.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      aboutWin?.webContents.toggleDevTools()
    }
  })


  if (VITE_DEV_SERVER_URL) {
    aboutWin.loadURL(`${VITE_DEV_SERVER_URL}#about`)
  } else {
    aboutWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { hash: 'about' })
  }

  aboutWin.on('closed', () => {
    aboutWin = null
  })
}

function createWindow(show: boolean = false) {
  const iconPath = path.join(process.env.VITE_PUBLIC, 'icon.png')
  const icon = nativeImage.createFromPath(iconPath)

  if (icon.isEmpty()) {
    console.error(`[CRITICAL] Icon file is EMPTY or NOT FOUND at: ${iconPath}`)
  }

  win = new BrowserWindow({
    title: `Miniclip`,
    icon: icon,
    frame: true, // Spotlight style
    width: 350,
    height: 550,
    backgroundColor: '#242424', // GNOME Dark BG
    show: false, // Start hidden to prevent white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'), // Auto-compiled to mjs
    },
  })

  win.once('ready-to-show', () => {
    if (show) {
      win?.show()
    }
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
    createWindow(true)
  } else {
    win?.show()
  }
})

app.on('before-quit', () => {
  (app as any).isQuitting = true
})

app.whenReady().then(() => {
  const settings = getSettings()
  updateAutostart(settings.launchOnStartup)
  createTray()
  createWindow(false) // Start hidden on login/launch

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
    const stmt = getDb().prepare('SELECT * FROM clipboard_history ORDER BY id DESC LIMIT ?')
    const rows = stmt.all(settings.maxHistorySize) as ClipboardItem[]
    return rows.map(row => ({
      ...row,
      image_data: row.image_data ? Buffer.from(row.image_data) : undefined,
      content_size: row.content_type === 'image'
        ? (row.image_data ? row.image_data.length : 0)
        : Buffer.byteLength(row.content, 'utf-8'),
    }))
  })

  ipcMain.handle('copy-to-clipboard', (_event, itemId: number) => {
    // Retrieve the item from database using the ID
    try {
      const stmt = getDb().prepare('SELECT * FROM clipboard_history WHERE id = ?')
      const row = stmt.get(itemId) as ClipboardItem | undefined

      if (!row) {
        console.error('Item not found in database')
        return
      }

      if (row.content_type === 'image') {
        // Handle image copying using raw image data
        console.log('Copying image from database, ID:', itemId)

        // Reset lastImageHash so the clipboard monitor will detect the
        // re-written image as new content and re-insert it at the top of history.
        // Without this, the hash would match and the monitor would skip re-inserting,
        // causing the item to disappear after being deleted from the old position.
        lastImageHash = ''

        if (row.image_data) {
          const imageFromData = nativeImage.createFromBuffer(Buffer.from(row.image_data))
          if (!imageFromData.isEmpty()) {
            clipboard.writeImage(imageFromData)
            console.log('Successfully copied image from raw data')
            return
          } else {
            console.error('Failed to create image from raw data buffer')
          }
        } else {
          console.error('No image data found in database')
        }

        // Fallback to data URL if raw data fails
        console.log('Falling back to data URL method')
        const image = nativeImage.createFromDataURL(row.content)
        if (!image.isEmpty()) {
          clipboard.writeImage(image)
          console.log('Successfully copied image from data URL')
        } else {
          console.error('Failed to create image from data URL')
        }
      } else {
        // Handle text copying
        clipboard.writeText(row.content)
        console.log('Successfully copied text from database')
      }
    } catch (e) {
      console.error('Database error when retrieving item:', e)
    }
  })

  ipcMain.handle('delete-history-item', (_event, id: number) => {
    getDb().prepare('DELETE FROM clipboard_history WHERE id = ?').run(id)
  })

  ipcMain.handle('hide-window', () => {
    win?.webContents.send('window-hidden')
    win?.hide()
  })

  ipcMain.handle('minimize-window', () => {
    win?.minimize()
  })


  ipcMain.handle('get-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('open-external', (_event, url: string) => {
    shell.openExternal(url)
  })

  // --- Clipboard Monitoring ---
  let lastText = clipboard.readText()
  let lastImageHash = ''

  setInterval(() => {
    const clipboardFormats = clipboard.availableFormats()
    const hasImage = clipboardFormats.some(format => format.startsWith('image/'))
    const text = clipboard.readText()

    if (hasImage) {
      const image = clipboard.readImage()
      if (!image.isEmpty()) {
        // Create a hash to detect changes
        const imageData = image.toPNG()
        const imageHash = crypto.createHash('md5').update(imageData).digest('hex')

        if (imageHash !== lastImageHash) {
          lastImageHash = imageHash
          lastText = '' // Reset text since we have an image
          const settings = getSettings()

          try {
            // Detect original format
            const originalFormat = clipboardFormats.find(format => format.startsWith('image/'))

            let imageData: Buffer
            if (originalFormat === 'image/jpeg' || originalFormat === 'image/jpg') {
              imageData = image.toJPEG(90)
            } else {
              imageData = image.toPNG()
            }

            // Check image size limit
            const imageSizeKB = imageData.length / 1024
            if (settings.maxImageSize > 0 && imageSizeKB > settings.maxImageSize) {
              console.log(`Image too large (${imageSizeKB.toFixed(2)}KB > ${settings.maxImageSize}KB), skipping`)
              return
            }

            // Save image to DB - store the data URL for display and raw data for copying
            const stmt = getDb().prepare('INSERT INTO clipboard_history (content, image_data, content_type, original_format) VALUES (?, ?, ?, ?)')
            stmt.run(image.toDataURL(), imageData, 'image', originalFormat)

            // Always trim DB by default
            getDb().prepare('DELETE FROM clipboard_history WHERE id NOT IN (SELECT id FROM clipboard_history ORDER BY id DESC LIMIT ?)').run(settings.maxHistorySize)

            // Notify Renderer
            win?.webContents.send('clipboard-change', image.toDataURL())
            console.log('Image saved to clipboard history')
          } catch (e) {
            console.error('DB Image Insert Error:', e)
          }
        }
      }
    }
    // Handle text content (only if no image)
    else if (text && text !== lastText) {
      lastText = text
      const settings = getSettings()
      // Save text to DB
      try {
        const stmt = getDb().prepare('INSERT INTO clipboard_history (content, content_type) VALUES (?, ?)')
        stmt.run(text, 'text')

        // Always trim DB by default
        getDb().prepare('DELETE FROM clipboard_history WHERE id NOT IN (SELECT id FROM clipboard_history ORDER BY id DESC LIMIT ?)').run(settings.maxHistorySize)

        // Notify Renderer
        win?.webContents.send('clipboard-change', text)
        console.log('Text saved to clipboard history')
      } catch (e) {
        console.error('DB Insert Error:', e)
      }
    }
  }, 500) // Reduced from 1000ms to 500ms for faster detection
})

app.on('will-quit', () => {
  db?.close()
})
