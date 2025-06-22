# Video Workflow

- 选择音频文件,然后上传到cf的r2服务,在配置页面配置key
- 选择本机图片，要保持顺序,能多选
- 音频文件调用api，拿到srt文件
- 调用其他/generate服务拿到生成的视频
- ui要大气美观

- 这是调用音频api的方式,注意token的值和appid的值都是可以配置的，在配置页面配置，其他都是默认的
  curl -X POST -H 'Accept: _/_' -H 'Authorization: Bearer; ${token}' -H 'Connection: keep-alive' -H 'User-Agent: python-requests/2.22.0' -H 'content-type: application/json' -d '{"url": "${your_url}"}' 'https://openspeech.bytedance.com/api/v1/vc/submit?appid=${appid}&language=zh-CN&use_itn=True&use_capitalize=True&max_lines=1&words_per_line=15'

- 这是调用生成视频的方式
  curl --location 'localhost:9999/generate' \
  --header 'Content-Type: text/plain' \
  --data '{
  "images": [
  "http://localhost:6788/1_.png",
  "http://localhost:6788/2_.png",
  "http://localhost:6788/3_.png",
  "http://localhost:6788/4_.png",
  "http://localhost:6788/5_.png",
  "http://localhost:6788/6_.png"
  ],
  "mp3": "http://localhost:6788/第一段前几页.mp3",
  "srt": "http://localhost:6788/asr.srt"
  }

'
