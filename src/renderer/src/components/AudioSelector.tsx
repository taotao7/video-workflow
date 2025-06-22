import { useRef } from 'react'
import './AudioSelector.css'

interface AudioSelectorProps {
  audioFile: File | null
  onAudioSelect: (file: File | null) => void
}

function AudioSelector({ audioFile, onAudioSelect }: AudioSelectorProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    onAudioSelect(file)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) {
      onAudioSelect(file)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemove = (event: React.MouseEvent) => {
    event.stopPropagation()
    onAudioSelect(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
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
              <div className="audio-name">{audioFile.name}</div>
              <div className="audio-size">{formatFileSize(audioFile.size)}</div>
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
