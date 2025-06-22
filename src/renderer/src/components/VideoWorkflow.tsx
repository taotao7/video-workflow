import { useState, useEffect } from 'react'
import StepSelector from './StepSelector'
import VideoGenerator from './VideoGenerator'
import Settings, { SettingsConfig, defaultConfig } from './Settings'
import { APIService } from '../services/api'
import './VideoWorkflow.css'

interface ImageData {
  file: File
  path: string
}

interface AudioData {
  file: File
  path: string
}

export interface WorkflowState {
  // Step 1: File selection
  audioFile: AudioData | null
  images: ImageData[]
  srtMode: 'generate' | 'upload' | null // generate from audio or upload SRT file
  srtFile: File | null // uploaded SRT file

  // Step 2: SRT generation/processing
  srtContent: string | null
  isGeneratingSRT: boolean

  // Step 3: Video generation
  videoUrl: string | null
  isGeneratingVideo: boolean

  // UI state
  currentStep: 1 | 2 | 3
}

function VideoWorkflow(): React.JSX.Element {
  const [state, setState] = useState<WorkflowState>({
    audioFile: null,
    images: [],
    srtMode: null,
    srtFile: null,
    srtContent: null,
    isGeneratingSRT: false,
    videoUrl: null,
    isGeneratingVideo: false,
    currentStep: 1
  })

  const [config, setConfig] = useState<SettingsConfig>(defaultConfig)
  const [showSettings, setShowSettings] = useState(false)
  const [apiService] = useState(() => new APIService(defaultConfig))

  useEffect(() => {
    // Load settings from main process
    const loadConfig = async (): Promise<void> => {
      try {
        const result = await window.electron.ipcRenderer.invoke('load-app-config')
        if (result.success && result.config) {
          setConfig(result.config)
          apiService.updateConfig(result.config)
        }
      } catch (error) {
        console.error('Failed to load config:', error)
        // Fallback to localStorage for backwards compatibility
        const savedConfig = localStorage.getItem('video-workflow-config')
        if (savedConfig) {
          const parsedConfig = JSON.parse(savedConfig)
          setConfig(parsedConfig)
          apiService.updateConfig(parsedConfig)
        }
      }
    }
    loadConfig()
  }, [])

  const handleConfigChange = async (newConfig: SettingsConfig): Promise<void> => {
    setConfig(newConfig)
    apiService.updateConfig(newConfig)

    // Save to main process
    try {
      await window.electron.ipcRenderer.invoke('save-app-config', newConfig)
    } catch (error) {
      console.error('Failed to save config to main process:', error)
      // Fallback to localStorage
      localStorage.setItem('video-workflow-config', JSON.stringify(newConfig))
    }
  }

  const updateState = (updates: Partial<WorkflowState>): void => {
    setState((prev) => ({ ...prev, ...updates }))
  }

  const handleNextStep = async (): Promise<void> => {
    if (state.currentStep === 1) {
      // Process SRT if uploaded
      if (state.srtMode === 'upload' && state.srtFile) {
        try {
          const srtContent = await state.srtFile.text()
          updateState({ srtContent, currentStep: 3 })
        } catch (error) {
          console.error('Error reading SRT file:', error)
          alert('读取SRT文件失败，请重新选择')
        }
      } else {
        // Go to SRT generation step
        updateState({ currentStep: 2 })
      }
    } else if (state.currentStep === 2) {
      // After SRT generation, go to video generation
      updateState({ currentStep: 3 })
    }
  }

  const handlePreviousStep = (): void => {
    if (state.currentStep > 1) {
      updateState({ currentStep: (state.currentStep - 1) as 1 | 2 | 3 })
    }
  }

  const handleReset = (): void => {
    setState({
      audioFile: null,
      images: [],
      srtMode: null,
      srtFile: null,
      srtContent: null,
      isGeneratingSRT: false,
      videoUrl: null,
      isGeneratingVideo: false,
      currentStep: 1
    })
  }

  return (
    <div className="video-workflow">
      <header className="workflow-header">
        <div className="header-content">
          <div>
            <h1 className="workflow-title">Video Workflow</h1>
            <p className="workflow-subtitle">Create videos from audio and images</p>
          </div>
          <button
            className="settings-button"
            onClick={() => setShowSettings(true)}
            title="配置设置"
          >
            ⚙️
          </button>
        </div>
      </header>

      <div className="workflow-content">
        {state.currentStep === 1 && (
          <StepSelector
            audioFile={state.audioFile}
            images={state.images}
            srtMode={state.srtMode}
            srtFile={state.srtFile}
            onAudioSelect={(file) => updateState({ audioFile: file })}
            onImagesSelect={(images) => updateState({ images })}
            onSrtModeSelect={(mode) => updateState({ srtMode: mode, srtFile: null })}
            onSrtFileSelect={(file) => updateState({ srtFile: file })}
            onNext={handleNextStep}
          />
        )}

        {(state.currentStep === 2 || state.currentStep === 3) && (
          <VideoGenerator
            state={state}
            updateState={updateState}
            apiService={apiService}
            onNext={handleNextStep}
            onPrevious={handlePreviousStep}
            onReset={handleReset}
          />
        )}
      </div>

      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={config}
        onConfigChange={handleConfigChange}
      />
    </div>
  )
}

export default VideoWorkflow
