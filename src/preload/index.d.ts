import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      checkForUpdates: () => Promise<{ success: boolean; updateInfo?: any; error?: string }>
      restartAndInstallUpdate: () => Promise<{ success: boolean; error?: string }>
      onUpdateAvailable: (callback: (info: any) => void) => void
      onDownloadProgress: (callback: (progress: any) => void) => void
      onUpdateDownloaded: (callback: (info: any) => void) => void
    }
  }
}
