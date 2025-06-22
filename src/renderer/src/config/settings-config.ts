import type { SettingsConfig } from '../components/Settings'

export const defaultConfig: SettingsConfig = {
  bytedanceToken: '',
  bytedanceAppId: '',
  bytedanceLanguage: 'zh-CN',
  bytedanceWordsPerLine: 15,
  bytedanceMaxLines: 1,
  bytedanceUseItn: true,
  bytedanceUsePunc: true,
  videoGenBaseUrl: 'http://localhost:9999'
}
