import React, { useState, useEffect } from 'react'
import './UpdateNotification.css'

interface UpdateInfo {
  version: string
  releaseNotes: string
  releaseDate: string
}

interface ProgressInfo {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<ProgressInfo | null>(null)
  const [updateDownloaded, setUpdateDownloaded] = useState<UpdateInfo | null>(null)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)

  useEffect(() => {
    // 监听更新事件
    window.api.onUpdateAvailable((info: UpdateInfo) => {
      setUpdateAvailable(info)
    })

    window.api.onDownloadProgress((progress: ProgressInfo) => {
      setDownloadProgress(progress)
    })

    window.api.onUpdateDownloaded((info: UpdateInfo) => {
      setUpdateDownloaded(info)
      setDownloadProgress(null)
    })
  }, [])

  const handleCheckUpdate = async (): Promise<void> => {
    setIsCheckingUpdate(true)
    try {
      const result = await window.api.checkForUpdates()
      if (!result.success) {
        console.error('检查更新失败:', result.error)
      }
    } catch (error) {
      console.error('检查更新错误:', error)
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const handleInstallUpdate = async (): Promise<void> => {
    try {
      await window.api.restartAndInstallUpdate()
    } catch (error) {
      console.error('安装更新错误:', error)
    }
  }

  const handleDismissUpdate = (): void => {
    setUpdateAvailable(null)
  }

  const handleDismissDownloaded = (): void => {
    setUpdateDownloaded(null)
  }

  // 如果有更新可下载
  if (updateAvailable && !updateDownloaded) {
    return (
      <div className="update-notification update-available">
        <div className="update-content">
          <h3>🎉 发现新版本 v{updateAvailable.version}</h3>
          <p>新版本正在后台下载中...</p>
          {downloadProgress && (
            <div className="download-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${downloadProgress.percent}%` }} />
              </div>
              <span className="progress-text">
                {Math.round(downloadProgress.percent)}% (
                {(downloadProgress.transferred / 1024 / 1024).toFixed(1)}MB /{' '}
                {(downloadProgress.total / 1024 / 1024).toFixed(1)}MB)
              </span>
            </div>
          )}
          <div className="update-actions">
            <button onClick={handleDismissUpdate} className="btn-secondary">
              稍后提醒
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 如果更新已下载完成
  if (updateDownloaded) {
    return (
      <div className="update-notification update-downloaded">
        <div className="update-content">
          <h3>✅ 更新已准备就绪</h3>
          <p>新版本 v{updateDownloaded.version} 已下载完成，重启应用即可完成更新。</p>
          <div className="update-actions">
            <button onClick={handleInstallUpdate} className="btn-primary">
              立即重启并更新
            </button>
            <button onClick={handleDismissDownloaded} className="btn-secondary">
              稍后更新
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 检查更新按钮（可选，用于手动检查）
  return (
    <div className="update-checker">
      <button onClick={handleCheckUpdate} disabled={isCheckingUpdate} className="btn-check-update">
        {isCheckingUpdate ? '检查中...' : '检查更新'}
      </button>
    </div>
  )
}

export default UpdateNotification
