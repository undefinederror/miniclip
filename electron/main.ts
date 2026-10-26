process.env.ELECTRON_DISABLE_SANDBOX = '1'
import { app, BrowserWindow, ipcMain, clipboard, Tray, Menu, nativeImage, shell, protocol, ClipboardItem as ElectronClipboardItem } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import crypto from 'crypto'
import { type Settings, defaultSettings } from '../src/shared/settings'
import log from 'electron-log/main'
import { screen } from 'electron'

// --- Logging setup ---
log.initialize()
log.transports.file.level = 'debug'
log.transports.console.level = 'debug'
log.transports.file.maxSize = 5 * 1024 * 1024 // 5 MB

// Catch unhandled errors BEFORE anything else so crashes are always logged
process.on('uncaughtException', (error) => {
  log.error('[uncaughtException]', error)
})
process.on('unhandledRejection', (reason) => {
  log.error('[unhandledRejection]', reason)
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

const APP_ID = 'com.miniclip.app'
const APP_NAME = 'Miniclip'
const APP_CLASS = 'miniclip'

app.setName(APP_CLASS)
app.setAppUserModelId(APP_ID)

// Snap: do NOT rename the app id / desktop name to match the name snapd installs the desktop
// file under (miniclip_com.miniclip.app.desktop). GNOME splits an app id containing "_" at the
// underscore, treats the window as sandboxed by that snap, and then only accepts desktop files
// whose id starts with "<sandbox>." -- which snapd's "<snap>_<file>.desktop" naming never
// satisfies. The dock then falls back to a generic icon and the raw app id instead of the
// Miniclip icon and name. Keeping the app id free of underscores (com.miniclip.app, set through
// desktopName in package.json) leaves the window unsandboxed, and the snap's desktop file is
// matched through StartupWMClass instead -- electron-builder derives that from desktopName too.
// deb/AppImage match on the app id directly.

let win: BrowserWindow | null
let prefsWin: BrowserWindow | null = null
let aboutWin: BrowserWindow | null = null
let tray: Tray | null = null
let db: Database.Database | null = null
let isQuitting = false

interface ClipboardHistoryRow {
  id: number
  content: string
  content_type: 'text' | 'image' | null
  original_format?: string | null
  created_at: string
  hash?: string | null
  pinned?: number
  sort_time?: number
}


protocol.registerSchemesAsPrivileged([
  { scheme: 'miniclip-img', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
])

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

  // Use a file-based DB in userData so image blobs are paged to disk
  // instead of accumulating in RAM (was :memory: — caused OOM kills)
  const dbPath = path.join(app.getPath('userData'), 'clipboard_history.db')
  log.info(`Opening DB at: ${dbPath}`)
  db = new Database(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS clipboard_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      content_type TEXT DEFAULT 'text',
      original_format TEXT
    )
  `)

  // Migration for existing data
  try {
    db.prepare('UPDATE clipboard_history SET content_type = ? WHERE content_type IS NULL').run('text')
  } catch (e) {
    log.info('Migration completed or not needed:', e)
  }

  try {
    db.exec('ALTER TABLE clipboard_history ADD COLUMN hash TEXT')
  } catch (e) {
    // Ignore if column already exists
  }

  // Migration: drop unused image_data column
  try {
    db.exec('ALTER TABLE clipboard_history DROP COLUMN image_data')
  } catch (e) {
    // Ignore if column doesn't exist or already dropped
  }

  // Migration: add pinned column
  try {
    db.exec('ALTER TABLE clipboard_history ADD COLUMN pinned INTEGER DEFAULT 0')
  } catch (e) {
    // Ignore if column already exists
  }

  // Migration: add sort_time column (epoch ms, used to order pinned/unpinned)
  try {
    db.exec('ALTER TABLE clipboard_history ADD COLUMN sort_time INTEGER')
  } catch (e) {
    // Ignore if column already exists
  }
  // Backfill sort_time for existing rows using id (monotonic proxy for time).
  // New rows will use Date.now() which is much larger, preserving relative order.
  try {
    db.prepare('UPDATE clipboard_history SET sort_time = id WHERE sort_time IS NULL').run()
  } catch (e) {
    log.error('Failed to backfill sort_time', e)
  }

  return db
}

function getSettings(): Settings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return { ...defaultSettings, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) }
    }
  } catch (e) {
    log.error('Failed to read settings:', e)
  }
  return defaultSettings
}

function trimHistory(maxSize: number) {
  try {
    const db = getDb()
    // Only count non-pinned items toward the size limit.
    // Pinned items are exempt and never trimmed.
    const rowsToDelete = db.prepare<[number], ClipboardHistoryRow>(
      `SELECT id, content, content_type FROM clipboard_history
       WHERE pinned = 0
         AND id NOT IN (
           SELECT id FROM clipboard_history
           WHERE pinned = 0
           ORDER BY id DESC LIMIT ?
         )`
    ).all(maxSize)
    for (const row of rowsToDelete) {
      if (row.content_type === 'image' && row.content.startsWith('miniclip-img://')) {
        try {
          const filename = new URL(row.content).hostname
          const filepath = path.join(app.getPath('userData'), 'images', filename)
          if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
        } catch (e) { log.error('Failed to delete trimmed image file', e) }
      }
      db.prepare('DELETE FROM clipboard_history WHERE id = ?').run(row.id)
    }
  } catch (e) {
    log.error('Failed to trim history', e)
  }
}

async function writeImageToClipboard(buffer: Buffer) {
  // Stored images are JPEG; re-encode to PNG for universal paste compatibility.
  const png = nativeImage.createFromBuffer(buffer).toPNG()
  const blob = new Blob([new Uint8Array(png)], { type: 'image/png' })
  await clipboard.write([new ElectronClipboardItem({ 'image/png': blob })])
}

function saveSettings(settings: Settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2))
    updateAutostart(settings.launchOnStartup)
    // Always trim DB on setting change
    trimHistory(settings.maxHistorySize)

    // Notify windows to refresh
    win?.webContents.send('settings-changed')
  } catch (e) {
    log.error('Failed to save settings:', e)
  }
}

function updateAutostart(enable: boolean) {
  if (process.platform !== 'linux') return
  // In a snap, app.getPath('home') correctly resolves to $SNAP_USER_DATA.
  // snapd monitors $SNAP_USER_DATA/.config/autostart/ and automatically manages the real autostart entry.
  const autostartDir = path.join(app.getPath('home'), '.config', 'autostart')

  // Snap autostart requires the filename to match the app name in snapcraft.yaml (miniclip.desktop)
  const desktopFileName = process.env.SNAP_NAME ? `${APP_CLASS}.desktop` : `${APP_ID}.desktop`
  const desktopFilePath = path.join(autostartDir, desktopFileName)

  if (enable) {
    // Determine the correct executable path per packaging format:
    //   - Snap:     use the snapd shim at /snap/bin/<name> (preserves confinement)
    //   - AppImage: APPIMAGE env var holds the path to the .AppImage file
    //   - Deb/pkg:  the installed binary is on $PATH as the executableName
    //   - Dev mode: fall back to the raw Electron executable
    const snapName = process.env.SNAP_NAME
    let execPath: string
    if (snapName) {
      execPath = `/snap/bin/${snapName}`
    } else if (process.env.APPIMAGE) {
      execPath = process.env.APPIMAGE
    } else {
      // For deb/rpm installs, electron-builder places the binary at
      // /usr/bin/<executableName>. Use that if it exists, otherwise
      // fall back to the raw exe path (covers dev mode and portable builds).
      const installedBin = `/usr/bin/${APP_CLASS}`
      execPath = fs.existsSync(installedBin) ? installedBin : app.getPath('exe')
    }

    // Icon path varies by packaging format:
    //   - Snap:     icon lives at $SNAP/meta/gui/icon.png inside the bundle
    //   - AppImage: dist/ is inside the asar, unreadable by the session manager;
    //               extract it to ~/.local/share/icons/ so it's findable by name
    //   - Deb:      registered in the system icon theme by app ID
    //   - Dev:      absolute path from the public/ directory (not in asar)
    let iconPath: string
    if (snapName) {
      iconPath = path.join(process.env.SNAP as string, 'meta', 'gui', 'icon.png')
    } else if (process.env.APPIMAGE) {
      // Extract the icon from the asar so the session manager can find it
      // Use the actual user home for AppImage desktop integration
      const userHome = process.env.HOME || app.getPath('home')
      const userIconDir = path.join(userHome, '.local', 'share', 'icons', 'hicolor', '256x256', 'apps')
      const userIconPath = path.join(userIconDir, `${APP_CLASS}.png`)
      try {
        if (!fs.existsSync(userIconPath)) {
          fs.mkdirSync(userIconDir, { recursive: true })
          // Electron's fs transparently reads from asar archives
          const iconBuffer = fs.readFileSync(path.join(process.env.VITE_PUBLIC as string, 'icon.png'))
          fs.writeFileSync(userIconPath, iconBuffer)
        }
      } catch (e) {
        log.error('Failed to install AppImage icon:', e)
      }
      iconPath = APP_CLASS // now discoverable via the hicolor icon theme
    } else if (process.env.VITE_DEV_SERVER_URL) {
      iconPath = path.join(process.env.VITE_PUBLIC as string, 'icon.png')
    } else {
      iconPath = APP_ID // deb: installed into system icon theme by the package
    }

    const desktopFileContent = [
      '[Desktop Entry]',
      'Type=Application',
      'Version=1.0',
      `Name=${APP_NAME}`,
      'Comment=Clipboard Manager',
      `Exec=${execPath}`,
      `Icon=${iconPath}`,
      'Terminal=false',
      'StartupNotify=false',
      `StartupWMClass=${APP_CLASS}`,
      'Hidden=false',
      'X-GNOME-Autostart-enabled=true',
    ].join('\n') + '\n'

    try {
      if (!fs.existsSync(autostartDir)) {
        fs.mkdirSync(autostartDir, { recursive: true })
      }
      fs.writeFileSync(desktopFilePath, desktopFileContent)
      log.info(`Autostart enabled: wrote ${desktopFilePath}`)
    } catch (e) {
      log.error('Failed to create autostart file:', e)
    }
  } else {
    try {
      if (fs.existsSync(desktopFilePath)) {
        fs.unlinkSync(desktopFilePath)
        log.info(`Autostart disabled: removed ${desktopFilePath}`)
      }
    } catch (e) {
      log.error('Failed to remove autostart file:', e)
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
      log.error(`Tray icon ${name} is empty! Checked path: ${p}`)
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

function createMainWindow(show: boolean = false) {
  const { height } = screen.getPrimaryDisplay().workAreaSize

  win = new BrowserWindow({
    title: `Miniclip`,
    icon: nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, 'icon.png')),
    frame: true, // Spotlight style
    width: 350,
    height: height - 50,
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
    if (!isQuitting) {
      event.preventDefault()
      win?.webContents.send('window-hidden')
      win?.hide()
    }
  })

  // Enable F12 to open DevTools
  if (VITE_DEV_SERVER_URL) {
    win.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') {
        win?.webContents.toggleDevTools()
      }
    })
  }

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function unlockClipboardAccess() {
  // On Wayland, clipboard reads are blocked for clients with no visible (mapped)
  // window. Briefly showing a window grants clipboard access for the whole
  // session (persists even after the window is hidden/destroyed).
  const unlockWin = new BrowserWindow({
    width: 0,
    height: 0,
    show: false,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    frame: false,
    webPreferences: {},
  })
  unlockWin.loadURL('about:blank')
  unlockWin.once('ready-to-show', () => {
    unlockWin.show()
    unlockWin.focus()
    log.info('Unlock window shown and focused')
    setTimeout(() => {
      if (!unlockWin.isDestroyed()) {
        unlockWin.destroy()
        log.info('Unlock window destroyed')
      }
    }, 500)
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow(getSettings().firstLaunch)
    saveSettings({ ...getSettings(), firstLaunch: false })
    win?.show()
  } else {
    win?.show()
  }
  win?.focus()
})

app.on('before-quit', () => {
  isQuitting = true
})

app.whenReady().then(() => {
  log.info(`=== Miniclip starting up === v${app.getVersion()}`)
  log.info(`Log file: ${log.transports.file.getFile().path}`)
  const mem = process.memoryUsage()
  log.info(`Memory on startup: RSS=${(mem.rss / 1024 / 1024).toFixed(1)}MB heap=${(mem.heapUsed / 1024 / 1024).toFixed(1)}/${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`)

  const IMAGES_DIR = path.join(app.getPath('userData'), 'images')
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true })

  protocol.registerFileProtocol('miniclip-img', (request, callback) => {
    try {
      const url = new URL(request.url)
      const filename = url.hostname
      callback({ path: path.join(IMAGES_DIR, filename) })
    } catch (e) {
      log.error('Protocol handling error:', e)
      callback({ error: -2 }) // net::ERR_FAILED
    }
  })

  // Log native sub-process crashes (renderer, GPU, utility)
  app.on('render-process-gone', (_event, _webContents, details) => {
    log.error('[render-process-gone]', details.reason, 'exitCode:', details.exitCode)
  })
  app.on('child-process-gone', (_event, details) => {
    log.error('[child-process-gone]', details.type, details.reason, 'exitCode:', details.exitCode)
  })

  const settings = getSettings()
  updateAutostart(settings.launchOnStartup)
  createTray()
  createMainWindow(getSettings().firstLaunch)
  saveSettings({ ...getSettings(), firstLaunch: false })
  win?.focus()
  unlockClipboardAccess()
  // Start hidden on login/launch

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
    // Pinned items always appear first.
    // Pinned:   sort_time ASC  -> newly pinned lands at the END of pinned section
    // Unpinned: sort_time DESC -> newly unpinned lands at the START of unpinned section
    const stmt = getDb().prepare<[number], ClipboardHistoryRow>(
      `SELECT * FROM clipboard_history 
       ORDER BY pinned DESC,
         CASE WHEN pinned = 1 THEN sort_time END ASC,
         CASE WHEN pinned = 0 THEN sort_time END DESC
       LIMIT ?`
    )
    const rows = stmt.all(settings.maxHistorySize)
    const IMAGES_DIR = path.join(app.getPath('userData'), 'images')

    return rows.map(row => {
      let content_size = 0

      if (row.content_type === 'image') {
        // For images, stat the file to get actual size
        if (row.content.startsWith('miniclip-img://')) {
          try {
            const filename = new URL(row.content).hostname
            const filepath = path.join(IMAGES_DIR, filename)
            const stats = fs.statSync(filepath)
            content_size = stats.size
          } catch (e) {
            // File missing or invalid URL, size stays 0
            content_size = 0
          }
        }
      } else {
        // For text, calculate byte length
        content_size = Buffer.byteLength(row.content, 'utf-8')
      }

      return {
        ...row,
        content_size,
      }
    })
  })

  ipcMain.handle('copy-to-clipboard', async (_event, itemId: number) => {
    // Retrieve the item from database using the ID
    try {
      const stmt = getDb().prepare<[number], ClipboardHistoryRow>('SELECT * FROM clipboard_history WHERE id = ?')
      const row = stmt.get(itemId)

      if (!row) {
        log.error('Item not found in database')
        return
      }

      if (row.content_type === 'image') {
        // Handle image copying using raw image data
        log.info('Copying image from database, ID:', itemId)

        // Only reset lastImageHash for non-pinned items so the clipboard monitor
        // will detect the re-written image as new content and re-insert it at the top.
        // For pinned items, we keep the hash so the monitor skips re-insertion
        // (the pinned item stays in place and isn't deleted).
        if (!row.pinned) {
          lastImageHash = ''
        }



        if (row.content.startsWith('miniclip-img://')) {
          try {
            const filename = new URL(row.content).hostname
            const filepath = path.join(app.getPath('userData'), 'images', filename)
            const buffer = fs.readFileSync(filepath)
            if (buffer.length > 0) {
              await writeImageToClipboard(buffer)
              log.info('Successfully copied image from file')
              return
            } else {
              log.error('Failed to create image from file path')
            }
          } catch (e) { log.error('Error copying image from file:', e) }
        } else {
          log.error('No image data found in database')
        }

        // Fallback to data URL if raw data fails
        log.warn('Falling back to data URL method')
        const base64Data = row.content.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        if (buffer.length > 0) {
          await writeImageToClipboard(buffer)
          log.info('Successfully copied image from data URL')
        } else {
          log.error('Failed to create image from data URL')
        }
      } else {
        // Handle text copying
        await clipboard.writeText(row.content)
        log.info('Successfully copied text from database')
      }
    } catch (e) {
      log.error('Database error when retrieving item:', e)
    }
  })

  ipcMain.handle('delete-history-item', (_event, id: number) => {
    try {
      const stmt = getDb().prepare<[number], ClipboardHistoryRow>('SELECT content, content_type FROM clipboard_history WHERE id = ?')
      const row = stmt.get(id)
      if (row && row.content_type === 'image' && row.content.startsWith('miniclip-img://')) {
        const filename = new URL(row.content).hostname
        const filepath = path.join(app.getPath('userData'), 'images', filename)
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
      }
    } catch (e) {
      log.error('Failed to delete image file', e)
    }
    getDb().prepare('DELETE FROM clipboard_history WHERE id = ?').run(id)
  })

  ipcMain.handle('toggle-pin', (_event, id: number) => {
    try {
      const db = getDb()
      // Flip the pinned state and bump sort_time so the item re-sorts:
      //   - pinning   -> newest sort_time among pinned  -> lands at the END of pinned section
      //   - unpinning -> newest sort_time among unpinned -> lands at the START of unpinned section
      db.prepare(
        'UPDATE clipboard_history SET pinned = CASE WHEN pinned = 1 THEN 0 ELSE 1 END, sort_time = ? WHERE id = ?'
      ).run(Date.now(), id)
    } catch (e) {
      log.error('Failed to toggle pin', e)
    }
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
  let lastText = ''
  let lastImageHash = ''

  try {
    const lastItem = getDb().prepare<[], ClipboardHistoryRow>('SELECT content, content_type, hash FROM clipboard_history ORDER BY id DESC LIMIT 1').get()
    if (lastItem) {
      if (lastItem.content_type === 'text') {
        lastText = lastItem.content
      } else if (lastItem.content_type === 'image') {
        lastImageHash = lastItem.hash || ''
      }
    }
  } catch (e) {
    log.error('Failed to init last state from DB:', e)
  }

  setInterval(async () => {
    try {
      let imageData: Buffer | null = null
      try {
        const items = await clipboard.read()
        for (const item of items) {
          const imageType = item.types.find(t => t.startsWith('image/'))
          if (imageType) {
            const blob = await item.getType(imageType) as Blob
            imageData = Buffer.from(await blob.arrayBuffer())
            break
          }
        }
      } catch (e) {
        log.error('Clipboard image read error:', e)
      }

      const text = await clipboard.readText()

      if (imageData && imageData.length > 0) {
        // Create a hash to detect changes
        const imageHash = crypto.createHash('md5').update(imageData).digest('hex')

        if (imageHash !== lastImageHash) {
          lastImageHash = imageHash
          lastText = '' // Reset text since we have an image
          const settings = getSettings()

          try {
            // Check image size limit
            const imageSizeKB = imageData.length / 1024
            if (settings.maxImageSize > 0 && imageSizeKB > settings.maxImageSize) {
              log.info(`Image too large (${imageSizeKB.toFixed(2)}KB > ${settings.maxImageSize}KB), skipping`)
              return
            }

            // Save image to disk and store the custom protocol URL in DB.
            // Convert to JPEG to reduce storage size (fullscreen screenshots
            // compress from ~1MB PNG to ~0.3MB). Fall back to raw bytes if
            // nativeImage can't decode the format.
            const IMAGES_DIR = path.join(app.getPath('userData'), 'images')
            if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true })

            const nativeImg = nativeImage.createFromBuffer(imageData)
            const jpeg = nativeImg.isEmpty() ? Buffer.alloc(0) : nativeImg.toJPEG(90)
            const isJpeg = jpeg.length > 0

            const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${isJpeg ? 'jpg' : 'png'}`
            const filepath = path.join(IMAGES_DIR, filename)
            fs.writeFileSync(filepath, isJpeg ? jpeg : imageData)

            const imgUrl = `miniclip-img://${filename}`
            const format = isJpeg ? 'image/jpeg' : 'image/png'

            const stmt = getDb().prepare('INSERT INTO clipboard_history (content, content_type, original_format, hash, sort_time) VALUES (?, ?, ?, ?, ?)')
            stmt.run(imgUrl, 'image', format, imageHash, Date.now())

            // Always trim DB and associated files
            trimHistory(settings.maxHistorySize)

            // Notify Renderer with the protocol URL instead of base64
            win?.webContents.send('clipboard-change', imgUrl)
            const storedKB = (isJpeg ? jpeg.length : imageData.length) / 1024
            log.info(`Image saved to clipboard history (${imageSizeKB.toFixed(1)}KB -> ${storedKB.toFixed(1)}KB) -> ${filename}`)
          } catch (e) {
            log.error('DB Image Insert Error:', e)
          }
        }
      }
      // Handle text content (only if no image)
      else if (text && text !== lastText) {
        lastText = text
        const settings = getSettings()
        // Save text to DB
        try {
          const stmt = getDb().prepare('INSERT INTO clipboard_history (content, content_type, sort_time) VALUES (?, ?, ?)')
          stmt.run(text, 'text', Date.now())

          // Always trim DB by default
          trimHistory(settings.maxHistorySize)

          // Notify Renderer
          win?.webContents.send('clipboard-change', text)
          log.info('Text saved to clipboard history')
        } catch (e) {
          log.error('DB Insert Error:', e)
        }
      }
    } catch (err) {
      log.error('Error in clipboard monitor:', err)
    }
  }, 500) // Reduced from 1000ms to 500ms for faster detection
})

app.on('will-quit', () => {
  db?.close()
})
