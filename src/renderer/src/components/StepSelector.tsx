import { useState } from 'react'
import AudioSelector from './AudioSelector'
import ImageSelector from './ImageSelector'
import './StepSelector.css'

interface ImageData {
  file: File
  path: string
}

interface AudioData {
  file: File
  path: string
}

interface StepSelectorProps {
  audioFile: AudioData | null
  images: ImageData[]
  srtMode: 'generate' | 'upload' | null
  srtFile: File | null
  onAudioSelect: (audio: AudioData | null) => void
  onImagesSelect: (images: ImageData[]) => void
  onSrtModeSelect: (mode: 'generate' | 'upload') => void
  onSrtFileSelect: (file: File | null) => void
  onNext: () => void
}

function StepSelector({
  audioFile,
  images,
  srtMode,
  srtFile,
  onAudioSelect,
  onImagesSelect,
  onSrtModeSelect,
  onSrtFileSelect,
  onNext
}: StepSelectorProps): React.JSX.Element {
  const [draggedOver, setDraggedOver] = useState(false)

  const canProceed =
    audioFile && images.length > 0 && srtMode && (srtMode === 'generate' || srtFile)

  const handleSrtFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0] || null
    onSrtFileSelect(file)
  }

  const handleSrtFileDrop = (event: React.DragEvent): void => {
    event.preventDefault()
    setDraggedOver(false)

    const files = Array.from(event.dataTransfer.files)
    const srtFile = files.find((file) => file.name.endsWith('.srt'))
    if (srtFile) {
      onSrtFileSelect(srtFile)
    }
  }

  const handleDragOver = (event: React.DragEvent): void => {
    event.preventDefault()
    setDraggedOver(true)
  }

  const handleDragLeave = (): void => {
    setDraggedOver(false)
  }

  return (
    <div className="step-selector">
      <div className="step-header">
        <h2>第一步：选择文件和字幕方式</h2>
        <p>请选择音频文件、图片，并选择字幕生成方式</p>
      </div>

      <div className="step-content">
        {/* Audio Selection */}
        <div className="section">
          <h3>音频文件 *</h3>
          <AudioSelector audioFile={audioFile} onAudioSelect={onAudioSelect} />
        </div>

        {/* Image Selection */}
        <div className="section">
          <h3>图片选择 * (请按顺序选择)</h3>
          <ImageSelector images={images} onImagesSelect={onImagesSelect} />
        </div>

        {/* SRT Mode Selection */}
        <div className="section">
          <h3>字幕文件方式 *</h3>
          <div className="srt-mode-options">
            <div
              className={`srt-option ${srtMode === 'generate' ? 'selected' : ''}`}
              onClick={() => onSrtModeSelect('generate')}
            >
              <div className="option-icon">🎤</div>
              <div className="option-content">
                <div className="option-title">从音频生成字幕</div>
                <div className="option-description">使用AI语音识别从音频文件自动生成SRT字幕</div>
              </div>
              <div className="option-radio">
                <input type="radio" checked={srtMode === 'generate'} readOnly />
              </div>
            </div>

            <div
              className={`srt-option ${srtMode === 'upload' ? 'selected' : ''}`}
              onClick={() => onSrtModeSelect('upload')}
            >
              <div className="option-icon">📄</div>
              <div className="option-content">
                <div className="option-title">上传SRT文件</div>
                <div className="option-description">直接上传已有的SRT字幕文件</div>
              </div>
              <div className="option-radio">
                <input type="radio" checked={srtMode === 'upload'} readOnly />
              </div>
            </div>
          </div>

          {/* SRT File Upload */}
          {srtMode === 'upload' && (
            <div className="srt-upload-section">
              <input
                type="file"
                accept=".srt"
                onChange={handleSrtFileSelect}
                style={{ display: 'none' }}
                id="srt-file-input"
              />
              <div
                className={`srt-dropzone ${draggedOver ? 'dragged-over' : ''} ${srtFile ? 'has-file' : ''}`}
                onClick={() => document.getElementById('srt-file-input')?.click()}
                onDrop={handleSrtFileDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {srtFile ? (
                  <div className="srt-file-selected">
                    <div className="file-icon">📄</div>
                    <div className="file-info">
                      <div className="file-name">{srtFile.name}</div>
                      <div className="file-size">{(srtFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button
                      className="file-remove"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSrtFileSelect(null)
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="srt-dropzone-content">
                    <div className="dropzone-icon">📄</div>
                    <div className="dropzone-text">
                      <div className="dropzone-main">点击选择SRT文件</div>
                      <div className="dropzone-sub">或拖拽SRT文件到这里</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="step-footer">
        <div className="requirements">
          <div className="requirement-item">
            <span className={`requirement-status ${audioFile ? 'completed' : 'pending'}`}>
              {audioFile ? '✓' : '○'}
            </span>
            <span>音频文件已选择</span>
          </div>
          <div className="requirement-item">
            <span className={`requirement-status ${images.length > 0 ? 'completed' : 'pending'}`}>
              {images.length > 0 ? '✓' : '○'}
            </span>
            <span>图片已选择 ({images.length} 张)</span>
          </div>
          <div className="requirement-item">
            <span className={`requirement-status ${srtMode ? 'completed' : 'pending'}`}>
              {srtMode ? '✓' : '○'}
            </span>
            <span>字幕方式已选择</span>
          </div>
          {srtMode === 'upload' && (
            <div className="requirement-item">
              <span className={`requirement-status ${srtFile ? 'completed' : 'pending'}`}>
                {srtFile ? '✓' : '○'}
              </span>
              <span>SRT文件已上传</span>
            </div>
          )}
        </div>

        <button
          className={`next-button ${canProceed ? 'enabled' : 'disabled'}`}
          onClick={onNext}
          disabled={!canProceed}
        >
          下一步：{srtMode === 'generate' ? '生成字幕' : '处理字幕'}
        </button>
      </div>
    </div>
  )
}

export default StepSelector
