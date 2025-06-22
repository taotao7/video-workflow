import { useState, useEffect } from 'react'
import './Settings.css'
import { defaultConfig } from '../config/settings-config'

export interface SettingsConfig {
  bytedanceToken: string
  bytedanceAppId: string
  bytedanceLanguage: string
  bytedanceWordsPerLine: number
  bytedanceMaxLines: number
  bytedanceUseItn: boolean
  bytedanceUsePunc: boolean
  videoGenBaseUrl: string
}

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
  config: SettingsConfig
  onConfigChange: (config: SettingsConfig) => void
}

function Settings({ isOpen, onClose, config, onConfigChange }: SettingsProps): React.JSX.Element {
  const [formData, setFormData] = useState<SettingsConfig>(() => ({
    ...defaultConfig,
    ...config
  }))

  useEffect(() => {
    setFormData(() => ({
      ...defaultConfig,
      ...config
    }))
  }, [config])

  const handleChange = (field: keyof SettingsConfig, value: string | number | boolean): void => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = (): void => {
    onConfigChange(formData)
    onClose()
  }

  const handleReset = (): void => {
    setFormData(defaultConfig)
  }

  if (!isOpen) return <></>

  return (
    <div className="settings-overlay">
      <div className="settings-modal">
        <div className="settings-header">
          <h2>配置设置</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <h3>字节跳动语音识别 API</h3>
            <div className="form-group">
              <label>Token</label>
              <input
                type="text"
                value={formData.bytedanceToken || ''}
                onChange={(e) => handleChange('bytedanceToken', e.target.value)}
                placeholder="输入 ByteDance Token"
              />
            </div>
            <div className="form-group">
              <label>App ID</label>
              <input
                type="text"
                value={formData.bytedanceAppId || ''}
                onChange={(e) => handleChange('bytedanceAppId', e.target.value)}
                placeholder="输入 ByteDance App ID"
              />
            </div>
            <div className="form-group">
              <label>语言</label>
              <select
                value={formData.bytedanceLanguage || 'zh-CN'}
                onChange={(e) => handleChange('bytedanceLanguage', e.target.value)}
              >
                <option value="zh-CN">中文 (zh-CN)</option>
                <option value="en-US">英文 (en-US)</option>
                <option value="ja-JP">日文 (ja-JP)</option>
                <option value="es-ES">西班牙文 (es-ES)</option>
              </select>
            </div>
            <div className="form-group">
              <label>每行字数</label>
              <input
                type="number"
                min="5"
                max="50"
                value={formData.bytedanceWordsPerLine || 15}
                onChange={(e) =>
                  handleChange('bytedanceWordsPerLine', parseInt(e.target.value) || 15)
                }
              />
            </div>
            <div className="form-group">
              <label>最大行数</label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.bytedanceMaxLines || 1}
                onChange={(e) => handleChange('bytedanceMaxLines', parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.bytedanceUseItn ?? true}
                  onChange={(e) => handleChange('bytedanceUseItn', e.target.checked)}
                />
                启用智能数字转换 (use_itn)
              </label>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.bytedanceUsePunc ?? true}
                  onChange={(e) => handleChange('bytedanceUsePunc', e.target.checked)}
                />
                启用智能标点 (use_punc)
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h3>视频生成服务</h3>
            <div className="form-group">
              <label>视频生成服务地址</label>
              <input
                type="text"
                value={formData.videoGenBaseUrl || 'http://localhost:9999'}
                onChange={(e) => handleChange('videoGenBaseUrl', e.target.value)}
                placeholder="视频生成 API 地址 (默认: http://localhost:9999)"
              />
            </div>
            <p className="settings-note">
              注意：音频文件将直接发送给字节跳动API进行语音识别，SRT内容将直接传递给视频生成服务
            </p>
          </div>
        </div>

        <div className="settings-footer">
          <button className="reset-button" onClick={handleReset}>
            重置为默认值
          </button>
          <div className="footer-actions">
            <button className="cancel-button" onClick={onClose}>
              取消
            </button>
            <button className="save-button" onClick={handleSave}>
              保存设置
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
