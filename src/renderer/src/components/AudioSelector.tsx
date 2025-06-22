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
      const systemPath = electronFile.path || file.name
      console.log('Audio file selected:', {
        name: file.name,
        systemPath: systemPath,
        hasPath: !!electronFile.path
      })
      onAudioSelect({
        file,
        path: systemPath
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
      const systemPath = electronFile.path || file.name
      console.log('Audio file dropped:', {
        name: file.name,
        systemPath: systemPath,
        hasPath: !!electronFile.path
      })
      onAudioSelect({
        file,
        path: systemPath
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

        // Create a File object from the base64 data
        const byteCharacters = atob(data.base64.split(',')[1])
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: data.mimeType })
        const file = new File([blob], data.fileName, { type: data.mimeType })

        console.log('Created audio data with path:', data.filePath)
        onAudioSelect({
          file,
          path: data.filePath
        })
      }
    } catch (error) {
      console.error('Error selecting audio:', error)
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
