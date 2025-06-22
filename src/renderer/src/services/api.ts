import { SettingsConfig } from '../components/Settings'

// Convert milliseconds to SRT time format (HH:MM:SS,mmm)
function msToTimeString(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const milliseconds = ms % 1000
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`
}

interface ByteDanceUtterance {
  start_time: number
  end_time: number
  text: string
}

interface ByteDanceResponse {
  utterances?: ByteDanceUtterance[]
}

interface VideoGenerateResponse {
  success: boolean
  message: string
  output: string
  download_url: string
}

// Convert ByteDance API response to SRT format
function convertToSRT(apiResponse: ByteDanceResponse): string {
  const srts: string[] = []

  if (apiResponse.utterances && Array.isArray(apiResponse.utterances)) {
    apiResponse.utterances.forEach((utterance: ByteDanceUtterance, index: number) => {
      const startTime = msToTimeString(utterance.start_time)
      const endTime = msToTimeString(utterance.end_time)
      const text = utterance.text

      srts.push(`${index + 1}\n${startTime} --> ${endTime}\n${text}\n\n`)
    })
  }

  return srts.join('')
}

export class APIService {
  private config: SettingsConfig

  constructor(config: SettingsConfig) {
    this.config = config
  }

  updateConfig(config: SettingsConfig): void {
    this.config = config
  }

  async generateSRT(audioFile: File): Promise<string> {
    try {
      console.log('Starting SRT generation for file:', audioFile.name)
      console.log('Config check:', {
        hasToken: !!this.config.bytedanceToken,
        hasAppId: !!this.config.bytedanceAppId,
        tokenLength: this.config.bytedanceToken?.length || 0,
        appId: this.config.bytedanceAppId
      })

      // 直接使用二进制提交，不需要上传到R2
      console.log('Converting audio file to binary...')
      const audioBuffer = await audioFile.arrayBuffer()

      // 获取音频文件的MIME类型
      const contentType = audioFile.type || 'audio/mpeg'
      console.log('Audio content type:', contentType)

      const apiUrl = `https://openspeech.bytedance.com/api/v1/vc/submit?appid=${this.config.bytedanceAppId}&language=${this.config.bytedanceLanguage || 'zh-CN'}&use_itn=${this.config.bytedanceUseItn ?? true}&use_punc=${this.config.bytedanceUsePunc ?? true}&max_lines=${this.config.bytedanceMaxLines || 1}&words_per_line=${this.config.bytedanceWordsPerLine || 15}`

      console.log('Making API request to:', apiUrl)
      console.log('Audio file size:', audioBuffer.byteLength, 'bytes')
      console.log(
        'Using token:',
        this.config.bytedanceToken ? `${this.config.bytedanceToken.slice(0, 10)}...` : 'NO TOKEN'
      )

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer; ${this.config.bytedanceToken}`,
          'Content-Type': contentType,
          'User-Agent': 'video-workflow/1.0.0'
        },
        body: audioBuffer
      })

      console.log('Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error Response:', errorText)
        throw new Error(
          `SRT generation failed: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      const result = await response.json()
      console.log('ByteDance API Response:', result)

      // 检查API响应格式
      if (result.code === 0) {
        // 提交成功，使用id作为task_id查询结果
        if (result.id) {
          console.log('Received task_id:', result.id)
          return await this.pollForSRTResult(result.id)
        }

        // 或者使用task_id字段
        if (result.task_id) {
          console.log('Received task_id:', result.task_id)
          return await this.pollForSRTResult(result.task_id)
        }
      }

      // Handle direct response with utterances (同步响应)
      if (result.utterances && Array.isArray(result.utterances)) {
        const srtContent = convertToSRT(result)
        console.log('Generated SRT:', srtContent)
        return srtContent
      }

      throw new Error(`Unexpected response format: ${JSON.stringify(result)}`)
    } catch (error) {
      console.error('Error generating SRT:', error)
      throw error
    }
  }

  private async pollForSRTResult(taskId: string): Promise<string> {
    const maxAttempts = 15
    const interval = 20000 // 20 seconds

    console.log(`Starting to poll for task ${taskId}`)

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.log(`Polling attempt ${attempt + 1}/${maxAttempts}`)

        const queryUrl = `https://openspeech.bytedance.com/api/v1/vc/query?appid=${this.config.bytedanceAppId}&id=${taskId}`
        console.log('Query URL:', queryUrl)

        const response = await fetch(queryUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer; ${this.config.bytedanceToken}`,
            'Content-Type': 'application/json'
          }
        })

        console.log('Query response status:', response.status, response.statusText)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Query API Error:', errorText)
          throw new Error(`Query failed: ${response.status} ${response.statusText} - ${errorText}`)
        }

        const result = await response.json()
        console.log('Query result:', result)

        // 检查任务状态和结果
        if (result.code === 0) {
          // 直接检查是否有utterances（任务已完成）
          if (result.utterances && Array.isArray(result.utterances)) {
            const srtContent = convertToSRT(result)
            console.log('Final SRT content:', srtContent)
            return srtContent
          }

          // 检查data字段中的状态
          if (result.data) {
            if (result.data.status === 'success' || result.data.status === 'completed') {
              // 任务完成，获取结果
              if (result.data.utterances && Array.isArray(result.data.utterances)) {
                const srtContent = convertToSRT(result.data)
                console.log('Final SRT content:', srtContent)
                return srtContent
              }
            } else if (result.data.status === 'processing' || result.data.status === 'pending') {
              // 任务还在处理中，继续轮询
              console.log('Task still processing, waiting...')
            } else if (result.data.status === 'failed') {
              throw new Error(`Task failed: ${result.data.message || 'Unknown error'}`)
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, interval))
      } catch (error) {
        console.error('Error polling for SRT result:', error)
        if (attempt === maxAttempts - 1) {
          throw error
        }
      }
    }

    throw new Error('SRT generation timed out after 15 attempts (300 seconds)')
  }

  async generateVideo(
    audioData: { file: File; path: string },
    imageFiles: { file: File; path: string }[],
    srtContent: string
  ): Promise<VideoGenerateResponse> {
    try {
      console.log('Starting video generation...')

      // Get file paths for images
      const imagePaths: string[] = []
      for (let i = 0; i < imageFiles.length; i++) {
        const imageData = imageFiles[i]
        console.log(`Getting path for image ${i + 1}/${imageFiles.length}:`, {
          fileName: imageData.file.name,
          path: imageData.path,
          fullImageData: imageData
        })
        imagePaths.push(imageData.path)
      }

      const requestData = {
        images: imagePaths,
        mp3: audioData.path,
        srt: srtContent
      }

      const response = await fetch(`${this.config.videoGenBaseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      if (!response.ok) {
        throw new Error('Video generation failed')
      }

      const result = await response.json()
      console.log('Video generation API response:', result)

      // Return the complete response object that matches VideoGenerateResponse interface
      return result as VideoGenerateResponse
    } catch (error) {
      console.error('Error generating video:', error)
      throw error
    }
  }

  // Create a temporary local file URL for display purposes
  createLocalFileUrl(file: File): string {
    return URL.createObjectURL(file)
  }

  // Get file path for electron main process
  async getFilePath(file: File): Promise<string> {
    // This would need to be implemented with electron main process
    // For now, return the file name
    return file.name
  }
}
