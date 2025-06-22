import { useState } from 'react'
import { WorkflowState } from './VideoWorkflow'
import { APIService } from '../services/api'
import './VideoGenerator.css'

interface VideoGeneratorProps {
  state: WorkflowState
  updateState: (updates: Partial<WorkflowState>) => void
  apiService: APIService
  onNext: () => void
  onPrevious: () => void
  onReset: () => void
}

function VideoGenerator({
  state,
  updateState,
  apiService,
  onNext,
  onPrevious,
  onReset
}: VideoGeneratorProps): React.JSX.Element {
  const [progress, setProgress] = useState(0)

  const generateSRT = async (): Promise<void> => {
    if (!state.audioFile) return

    updateState({ isGeneratingSRT: true })
    setProgress(0)

    try {
      console.log('Checking API configuration...')
      // 检查配置是否完整
      if (!apiService['config'].bytedanceToken) {
        throw new Error('ByteDance Token 未配置，请在设置中配置')
      }
      if (!apiService['config'].bytedanceAppId) {
        throw new Error('ByteDance App ID 未配置，请在设置中配置')
      }
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + Math.random() * 5
        })
      }, 300)

      // Generate SRT using ByteDance API (will upload to R2 internally)
      const srtContent = await apiService.generateSRT(state.audioFile.file)

      clearInterval(progressInterval)
      setProgress(100)

      updateState({ srtContent, isGeneratingSRT: false })

      // Auto proceed to next step after SRT generation
      setTimeout(() => {
        onNext()
      }, 1000)
    } catch (error) {
      console.error('Error generating SRT:', error)
      updateState({ isGeneratingSRT: false })
      alert('生成SRT文件失败，请检查ByteDance API配置并重试')
    }
  }

  const generateVideo = async (): Promise<void> => {
    if (!state.audioFile || state.images.length === 0) return

    updateState({ isGeneratingVideo: true })
    setProgress(0)

    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 80) {
            clearInterval(progressInterval)
            return 80
          }
          return prev + Math.random() * 3
        })
      }, 500)

      if (!state.audioFile) {
        throw new Error('音频文件不存在')
      }

      // Generate video (will upload files to R2 internally)
      const response = await apiService.generateVideo(
        state.audioFile,
        state.images,
        state.srtContent || ''
      )

      clearInterval(progressInterval)
      setProgress(100)

      // Handle the API response structure
      if (response.success) {
        updateState({
          videoUrl: response.download_url,
          videoFilename: response.output,
          isGeneratingVideo: false
        })
      } else {
        throw new Error(response.message || '视频生成失败')
      }
    } catch (error) {
      console.error('Error generating video:', error)
      updateState({ isGeneratingVideo: false })
      alert('生成视频失败，请检查视频生成服务并重试')
    }
  }

  const downloadVideo = (): void => {
    if (state.videoUrl) {
      const a = document.createElement('a')
      a.href = state.videoUrl
      a.download = state.videoFilename || 'generated-video.mp4'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  if (state.currentStep === 2) {
    // Step 2: SRT Generation
    return (
      <div className="video-generator">
        <div className="step-header">
          <h2>第二步：生成字幕文件</h2>
          <p>从音频文件生成SRT字幕文件</p>
        </div>

        <div className="step-content">
          <div className="file-summary">
            <div className="summary-item">
              <span className="label">音频文件:</span>
              <span className="value">{state.audioFile?.file.name}</span>
            </div>
            <div className="summary-item">
              <span className="label">图片数量:</span>
              <span className="value">{state.images.length} 张</span>
            </div>
          </div>

          <div className="generation-area">
            {state.srtContent ? (
              <div className="srt-generated">
                <div className="success-icon">✓</div>
                <div className="success-content">
                  <h3>SRT文件已生成</h3>
                  <p>字幕文件生成成功，准备进行视频生成</p>
                </div>
              </div>
            ) : (
              <div className="srt-generation">
                <button
                  className="generate-button primary"
                  onClick={generateSRT}
                  disabled={state.isGeneratingSRT}
                >
                  {state.isGeneratingSRT ? '正在生成字幕...' : '开始生成字幕'}
                </button>
                <p className="generation-hint">使用AI语音识别技术从音频文件生成SRT字幕文件</p>
              </div>
            )}

            {state.isGeneratingSRT && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="progress-text">{Math.round(progress)}%</div>
              </div>
            )}
          </div>
        </div>

        <div className="step-footer">
          <button className="back-button" onClick={onPrevious}>
            上一步
          </button>
          {state.srtContent && (
            <button className="next-button" onClick={onNext}>
              下一步：生成视频
            </button>
          )}
        </div>
      </div>
    )
  }

  // Step 3: Video Generation
  return (
    <div className="video-generator">
      <div className="step-header">
        <h2>第三步：生成视频</h2>
        <p>使用音频、图片和字幕生成最终视频</p>
      </div>

      <div className="step-content">
        <div className="file-summary">
          <div className="summary-item">
            <span className="label">音频文件:</span>
            <span className="value">{state.audioFile?.file.name}</span>
          </div>
          <div className="summary-item">
            <span className="label">图片数量:</span>
            <span className="value">{state.images.length} 张</span>
          </div>
          <div className="summary-item">
            <span className="label">字幕方式:</span>
            <span className="value">
              {state.srtMode === 'generate' ? '从音频生成' : '上传SRT文件'}
            </span>
          </div>
        </div>

        <div className="generation-area">
          {state.videoUrl ? (
            <div className="video-generated">
              <div className="success-icon">✓</div>
              <div className="success-content">
                <h3>视频已生成</h3>
                <div className="video-actions">
                  <button className="download-button" onClick={downloadVideo}>
                    下载视频
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="video-generation">
              <button
                className="generate-button primary"
                onClick={generateVideo}
                disabled={state.isGeneratingVideo}
              >
                {state.isGeneratingVideo ? '正在生成视频...' : '开始生成视频'}
              </button>
              <p className="generation-hint">将音频、图片和字幕合成为最终视频文件</p>
            </div>
          )}

          {state.isGeneratingVideo && (
            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="progress-text">{Math.round(progress)}%</div>
            </div>
          )}

          {state.videoUrl && (
            <div className="video-preview">
              <video controls src={state.videoUrl} className="generated-video">
                您的浏览器不支持视频播放
              </video>
            </div>
          )}
        </div>
      </div>

      <div className="step-footer">
        <button className="back-button" onClick={onPrevious}>
          上一步
        </button>
        <button className="reset-button" onClick={onReset}>
          重新开始
        </button>
      </div>
    </div>
  )
}

export default VideoGenerator
