import { app, shell, BrowserWindow, ipcMain, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { homedir } from 'os'
import icon from '../../resources/icon.png?asset'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow(): void {
  // Load saved window bounds
  const savedBounds = loadWindowBounds()
  
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    x: savedBounds.x,
    y: savedBounds.y,
    minWidth: 1400,
    minHeight: 900,
    maxWidth: savedBounds.width,
    maxHeight: savedBounds.height,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    frame: true,
    resizable: false,
    maximizable: false,
    minimizable: true,
    title: 'Video Workflow',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    
    // Open DevTools in development
    if (is.dev) {
      mainWindow.webContents.openDevTools()
    }
  })

  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault()
      mainWindow?.hide()
    } else {
      // Save window bounds before closing
      saveWindowBounds()
    }
  })

  // Save window bounds when moved (resized disabled)
  mainWindow.on('moved', saveWindowBounds)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Log renderer process errors
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${level}: ${message}`)
    if (line) console.log(`  at line ${line} in ${sourceId}`)
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[Main] Renderer process became unresponsive')
  })

  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('[Main] Renderer process crashed:', { killed })
  })
}

function createTray(): void {
  tray = new Tray(icon)
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        mainWindow?.show()
      }
    },
    {
      label: '隐藏窗口',
      click: () => {
        mainWindow?.hide()
      }
    },
    {
      type: 'separator'
    },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true
        app.quit()
      }
    }
  ])
  
  tray.setContextMenu(contextMenu)
  tray.setToolTip('Video Workflow')
  
  tray.on('double-click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
    }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))


  // Handle app config save/load
  ipcMain.handle('save-app-config', async (event, config) => {
    try {
      let existingConfig = {}
      
      if (existsSync(configPath)) {
        try {
          existingConfig = JSON.parse(readFileSync(configPath, 'utf8'))
        } catch {
          existingConfig = {}
        }
      }
      
      const newConfig = {
        ...existingConfig,
        appConfig: config
      }
      
      writeFileSync(configPath, JSON.stringify(newConfig, null, 2))
      return { success: true }
    } catch (error) {
      console.error('Failed to save app config:', error)
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('load-app-config', async () => {
    try {
      if (!existsSync(configPath)) {
        return { success: true, config: null }
      }
      
      const config = JSON.parse(readFileSync(configPath, 'utf8'))
      return { success: true, config: config.appConfig || null }
    } catch (error) {
      console.error('Failed to load app config:', error)
      return { success: false, error: error.message }
    }
  })

  // Handle file dialog for images
  ipcMain.handle('select-images', async () => {
    const { dialog } = require('electron')
    const { readFileSync } = require('fs')
    const { basename } = require('path')
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }
      ]
    })
    
    if (!result.canceled) {
      const imageData = result.filePaths.map(filePath => {
        try {
          const buffer = readFileSync(filePath)
          const base64 = buffer.toString('base64')
          const fileName = basename(filePath)
          
          // Determine MIME type
          const ext = filePath.split('.').pop()?.toLowerCase()
          let mimeType = 'image/jpeg'
          if (ext === 'png') mimeType = 'image/png'
          else if (ext === 'gif') mimeType = 'image/gif'
          else if (ext === 'webp') mimeType = 'image/webp'
          else if (ext === 'bmp') mimeType = 'image/bmp'
          
          return {
            filePath,
            fileName,
            base64: `data:${mimeType};base64,${base64}`,
            mimeType
          }
        } catch (error) {
          console.error('Error reading file:', filePath, error)
          return null
        }
      }).filter(Boolean)
      
      return { success: true, imageData }
    }
    return { success: false, imageData: [] }
  })

  // Handle file dialog for audio
  ipcMain.handle('select-audio', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Audio', extensions: ['mp3', 'wav', 'aac', 'm4a', 'ogg'] }
      ]
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] }
    }
    return { success: false, filePath: null }
  })

  createWindow()
  createTray()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && app.isQuiting) {
    app.quit()
  }
})

app.on('before-quit', () => {
  app.isQuiting = true
})

// Helper function to get content type
function getContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'srt': 'text/plain',
    'txt': 'text/plain'
  }
  return mimeTypes[ext || ''] || 'application/octet-stream'
}

// Window bounds management
const configPath = join(homedir(), '.video-workflow-config.json')

interface WindowBounds {
  width: number
  height: number
  x?: number
  y?: number
}

function loadWindowBounds(): WindowBounds {
  const defaultBounds = { width: 1600, height: 1000 }
  
  if (!existsSync(configPath)) {
    return defaultBounds
  }
  
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    return {
      width: config.windowBounds?.width || defaultBounds.width,
      height: config.windowBounds?.height || defaultBounds.height,
      x: config.windowBounds?.x,
      y: config.windowBounds?.y
    }
  } catch {
    return defaultBounds
  }
}

function saveWindowBounds(): void {
  if (!mainWindow) return
  
  const bounds = mainWindow.getBounds()
  let config = {}
  
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8'))
    } catch {
      config = {}
    }
  }
  
  config = {
    ...config,
    windowBounds: bounds
  }
  
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2))
  } catch (error) {
    console.error('Failed to save window bounds:', error)
  }
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
