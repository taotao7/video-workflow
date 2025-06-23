import { app, shell, BrowserWindow, ipcMain, Tray, Menu, dialog } from 'electron'
import { join, basename } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'fs'
import { homedir } from 'os'
import { spawn, ChildProcess } from 'child_process'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import pic2videoWin from '../../resources/pic2video.exe?asset&asarUnpack'
import pic2videoMac from '../../resources/pic2video_mac?asset&asarUnpack'
import pic2videoLinux from '../../resources/pic2video_linux?asset&asarUnpack'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuiting = false
let executableProcess: ChildProcess | null = null

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
    mainWindow?.show()

    // Open DevTools in development
    if (is.dev) {
      mainWindow?.webContents.openDevTools()
    }
  })

  mainWindow.on('close', (event) => {
    if (!isQuiting) {
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
  mainWindow.webContents.on('console-message', (_, level, message, line, sourceId) => {
    console.log(`[Renderer] ${level}: ${message}`)
    if (line) console.log(`  at line ${line} in ${sourceId}`)
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[Main] Renderer process became unresponsive')
  })

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    console.error('[Main] Renderer process crashed:', details)
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
        isQuiting = true
        stopPlatformExecutable()
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

// Auto updater configuration
if (!is.dev) {
  autoUpdater.logger = console
  autoUpdater.checkForUpdatesAndNotify()
}

// Handle auto-updater events
autoUpdater.on('checking-for-update', () => {
  console.log('正在检查更新...')
})

autoUpdater.on('update-available', (info) => {
  console.log('发现新版本:', info.version)
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info)
  }
})

autoUpdater.on('update-not-available', (info) => {
  console.log('当前已是最新版本:', info.version)
})

autoUpdater.on('error', (err) => {
  console.error('自动更新错误:', err)
})

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`下载进度: ${Math.round(progressObj.percent)}%`)
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj)
  }
})

autoUpdater.on('update-downloaded', (info) => {
  console.log('更新下载完成:', info.version)
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info)
  }
})

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

  // Handle update-related IPC calls
  ipcMain.handle('check-for-updates', async () => {
    if (!is.dev) {
      try {
        const result = await autoUpdater.checkForUpdates()
        return { success: true, updateInfo: result?.updateInfo }
      } catch (error) {
        console.error('检查更新失败:', error)
        return { success: false, error: (error as Error).message }
      }
    }
    return { success: false, error: '开发环境不支持自动更新' }
  })

  ipcMain.handle('restart-and-install-update', async () => {
    if (!is.dev) {
      autoUpdater.quitAndInstall()
      return { success: true }
    }
    return { success: false, error: '开发环境不支持自动更新' }
  })

  // Handle app config save/load
  ipcMain.handle('save-app-config', async (_, config) => {
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
      return { success: false, error: (error as Error).message }
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
      return { success: false, error: (error as Error).message }
    }
  })

  // Handle file dialog for images
  ipcMain.handle('select-images', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }]
    })

    if (!result.canceled) {
      const imageData = result.filePaths
        .map((filePath) => {
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
        })
        .filter(Boolean)

      return { success: true, imageData }
    }
    return { success: false, imageData: [] }
  })

  // Handle file dialog for audio
  ipcMain.handle('select-audio', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'aac', 'm4a', 'ogg'] }]
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      try {
        const buffer = readFileSync(filePath)
        const base64 = buffer.toString('base64')
        const fileName = basename(filePath)

        // Determine MIME type
        const ext = filePath.split('.').pop()?.toLowerCase()
        let mimeType = 'audio/mpeg'
        if (ext === 'wav') mimeType = 'audio/wav'
        else if (ext === 'aac') mimeType = 'audio/aac'
        else if (ext === 'm4a') mimeType = 'audio/mp4'
        else if (ext === 'ogg') mimeType = 'audio/ogg'

        return {
          success: true,
          audioData: {
            filePath,
            fileName,
            base64: `data:${mimeType};base64,${base64}`,
            mimeType
          }
        }
      } catch (error) {
        console.error('Error reading audio file:', filePath, error)
        return { success: false, audioData: null }
      }
    }
    return { success: false, audioData: null }
  })

  // Handle drag and drop file paths
  ipcMain.handle('get-file-paths', async (_, fileNames: string[]) => {
    // This is a simplified approach - in a real app you might want to
    // implement a more sophisticated file path resolution
    try {
      return { success: true, filePaths: fileNames }
    } catch (error) {
      console.error('Error getting file paths:', error)
      return { success: false, filePaths: [] }
    }
  })

  // 启动平台对应的执行文件
  startPlatformExecutable()

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
  if (process.platform !== 'darwin' && isQuiting) {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuiting = true
  stopPlatformExecutable()
})

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

// 启动平台对应的执行文件
function startPlatformExecutable(): void {
  try {
    let executablePath: string

    // 根据平台选择对应的执行文件
    switch (process.platform) {
      case 'win32':
        executablePath = pic2videoWin
        break
      case 'darwin':
        executablePath = pic2videoMac
        break
      case 'linux':
        executablePath = pic2videoLinux
        break
      default:
        console.warn('Unsupported platform:', process.platform)
        return
    }

    console.log('Starting executable:', executablePath)

    // 从路径中提取文件名用于日志
    const executableName = basename(executablePath)

    // 确保执行文件有可执行权限 (Linux/macOS)
    if (process.platform !== 'win32') {
      try {
        chmodSync(executablePath, '755')
      } catch (error) {
        console.warn('Failed to set executable permissions:', error)
      }
    }

    // 启动执行文件
    executableProcess = spawn(executablePath, [], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    if (executableProcess.stdout) {
      executableProcess.stdout.on('data', (data) => {
        console.log(`[${executableName}] stdout:`, data.toString())
      })
    }

    if (executableProcess.stderr) {
      executableProcess.stderr.on('data', (data) => {
        console.error(`[${executableName}] stderr:`, data.toString())
      })
    }

    executableProcess.on('close', (code) => {
      console.log(`[${executableName}] process exited with code ${code}`)
      executableProcess = null
    })

    executableProcess.on('error', (error) => {
      console.error(`[${executableName}] Failed to start process:`, error)
      executableProcess = null
    })
  } catch (error) {
    console.error('Error starting platform executable:', error)
  }
}

// 停止执行文件进程
function stopPlatformExecutable(): void {
  if (executableProcess) {
    console.log('Stopping platform executable...')
    executableProcess.kill()
    executableProcess = null
  }
}

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
