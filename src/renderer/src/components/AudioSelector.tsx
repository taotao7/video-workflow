import { useRef } from 'react'
import './AudioSelector.css'

interface AudioData {
  file: File
  path: string
}

interface AudioSelectorProps {
  audioFile: AudioData | null
  onAudioSelect: (audio: AudioData | null) => void
}

interface ElectronFile {
  path?: string
}

interface AudioFileData {
  filePath: string
  fileName: string
  base64: string
  mimeType: string
}

interface SelectAudioResult {
  success: boolean
  audioData: AudioFileData | null
}

function AudioSelector({ audioFile, onAudioSelect }: AudioSelectorProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0] || null
    if (file) {
      const electronFile = file as File & ElectronFile
      const hasRealPath = !!electronFile.path
      console.log('Audio file selected:', {
        name: file.name,
        path: electronFile.path,
        hasRealPath: hasRealPath
      })
      onAudioSelect({
        file,
        path: hasRealPath ? electronFile.path! : file.name
      })
    } else {
      onAudioSelect(null)
    }
  }

  const handleDrop = (event: React.DragEvent): void => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) {
      const electronFile = file as File & ElectronFile
      const hasRealPath = !!electronFile.path
      console.log('Audio file dropped:', {
        name: file.name,
        path: electronFile.path,
        hasRealPath: hasRealPath
      })
      onAudioSelect({
        file,
        path: hasRealPath ? electronFile.path! : file.name
      })
    }
  }

  const handleDragOver = (event: React.DragEvent): void => {
    event.preventDefault()
  }

  const handleClick = async (): Promise<void> => {
    try {
      console.log('🔵 BUTTON CLICKED: Invoking select-audio...')
      const result = (await window.electron.ipcRenderer.invoke('select-audio')) as SelectAudioResult
      console.log('select-audio result:', result)

      if (result.success && result.audioData) {
        const data = result.audioData
        console.log('Processing audio data:', data)

        // 对于通过 Electron 选择的文件，我们不需要处理 base64 数据
        // 直接使用文件路径信息创建一个轻量级的 File 对象
        if (data.filePath) {
          // 从 base64 数据估算文件大小（base64 大约比原文件大 1.37 倍）
          const estimatedSize = data.base64 ? Math.floor(data.base64.length * 0.75) : 0

          // 检查文件大小限制（200MB）
          const maxSize = 200 * 1024 * 1024 // 200MB
          if (estimatedSize > maxSize) {
            throw new Error(
              `文件过大 (${(estimatedSize / (1024 * 1024)).toFixed(1)}MB)，请选择小于 200MB 的音频文件`
            )
          }

          // 创建一个轻量级的 File 对象，只包含基本信息
          // 实际的文件内容通过文件路径在后端处理
          const dummyBlob = new Blob([''], { type: data.mimeType || 'audio/mpeg' })
          const file = new File([dummyBlob], data.fileName, {
            type: data.mimeType || 'audio/mpeg',
            lastModified: Date.now()
          })

          // 设置文件大小属性（如果可能的话）
          Object.defineProperty(file, 'size', {
            value: estimatedSize,
            writable: false
          })

          // 标记这是一个轻量级文件对象，必须通过路径读取
          Object.defineProperty(file, 'isLightweight', {
            value: true,
            writable: false
          })

          console.log('Created lightweight audio file object with path:', data.filePath)
          onAudioSelect({
            file,
            path: data.filePath
          })

          return
        }

        // 如果没有文件路径，尝试处理 base64 数据（用于小文件）
        if (!data.base64 || typeof data.base64 !== 'string') {
          throw new Error('未收到有效的文件数据')
        }

        // Handle base64 data with or without data URL prefix
        let base64Data = data.base64
        if (base64Data.includes(',')) {
          const parts = base64Data.split(',')
          if (parts.length < 2) {
            throw new Error('无效的 base64 格式')
          }
          base64Data = parts[1]
        }

        // 检查 base64 数据大小（限制为 200MB 的 base64 数据）
        const maxBase64Size = 200 * 1024 * 1024 * 1.37 // 200MB 文件对应的 base64 大小
        if (base64Data.length > maxBase64Size) {
          throw new Error('文件过大，请选择小于 200MB 的音频文件')
        }

        // 使用更高效的方法处理小文件的 base64 数据
        try {
          // 直接使用 fetch API 来处理 base64 数据
          const dataUrl = `data:${data.mimeType || 'audio/mpeg'};base64,${base64Data}`
          const response = await fetch(dataUrl)
          const blob = await response.blob()
          const file = new File([blob], data.fileName, { type: data.mimeType })

          console.log('Created audio data from base64 with path:', data.filePath)
          onAudioSelect({
            file,
            path: data.filePath || data.fileName
          })
        } catch (e) {
          throw new Error('处理音频数据失败: ' + e)
        }
      }
    } catch (error) {
      console.error('Error selecting audio:', error)
      // 显示更友好的错误信息
      if (error instanceof Error && error.message.includes('文件过大')) {
        alert(error.message)
      }
      // Fallback to regular file input
      fileInputRef.current?.click()
    }
  }

  const handleRemove = (event: React.MouseEvent): void => {
    event.stopPropagation()
    onAudioSelect(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="audio-selector">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {audioFile ? (
        <div className="audio-selected">
          <div className="audio-info">
            <div className="audio-icon">🎵</div>
            <div className="audio-details">
              <div className="audio-name">{audioFile.file.name}</div>
              <div className="audio-size">{formatFileSize(audioFile.file.size)}</div>
            </div>
          </div>
          <button className="remove-button" onClick={handleRemove} title="移除音频文件">
            ✕
          </button>
        </div>
      ) : (
        <div
          className="audio-dropzone"
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="dropzone-content">
            <div className="dropzone-icon">🎵</div>
            <div className="dropzone-text">
              <div className="dropzone-main">点击选择音频文件</div>
              <div className="dropzone-sub">或拖拽音频文件到这里</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AudioSelector
