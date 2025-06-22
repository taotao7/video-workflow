import { useRef, useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import './ImageSelector.css'

interface ImageData {
  file: File
  path: string
}

interface ImageSelectorProps {
  images: ImageData[]
  onImagesSelect: (images: ImageData[]) => void
}

interface ElectronFile {
  path?: string
}

interface ImageFileData {
  filePath: string
  fileName: string
  base64: string
  mimeType: string
}

interface SelectImagesResult {
  success: boolean
  imageData: ImageFileData[]
}

function ImageSelector({ images, onImagesSelect }: ImageSelectorProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewImage, setPreviewImage] = useState<ImageData | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>): void => {
    console.log('🟡 FILE INPUT USED')
    const files = Array.from(event.target.files || [])
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    const imageDataList: ImageData[] = imageFiles.map((file) => {
      // In Electron, file input files also have a 'path' property
      const electronFile = file as File & ElectronFile
      const systemPath = electronFile.path || file.name
      console.log('File input file:', {
        name: file.name,
        systemPath: systemPath,
        hasPath: !!electronFile.path
      })
      return {
        file,
        path: systemPath
      }
    })
    console.log(
      'File input selected images:',
      imageDataList.map((img) => ({ name: img.file.name, path: img.path }))
    )
    onImagesSelect([...images, ...imageDataList])
  }

  const handleDrop = async (event: React.DragEvent): Promise<void> => {
    event.preventDefault()

    console.log('🔴 DRAG AND DROP USED')
    const files = Array.from(event.dataTransfer.files)
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))

    if (imageFiles.length > 0) {
      try {
        // Try to get system paths from dragged files
        const imageDataList: ImageData[] = imageFiles.map((file) => {
          const electronFile = file as File & ElectronFile
          const systemPath = electronFile.path || file.name
          console.log('Drag drop file:', {
            name: file.name,
            systemPath: systemPath,
            hasPath: !!electronFile.path
          })
          return {
            file,
            path: systemPath
          }
        })

        console.log(
          'Drag drop selected images:',
          imageDataList.map((img) => ({ name: img.file.name, path: img.path }))
        )
        onImagesSelect([...images, ...imageDataList])
      } catch (error) {
        console.error('Error processing dragged files:', error)
        // Fallback to basic file handling
        const imageDataList: ImageData[] = imageFiles.map((file) => ({
          file,
          path: file.name
        }))
        onImagesSelect([...images, ...imageDataList])
      }
    }
  }

  const handleDragOver = (event: React.DragEvent): void => {
    event.preventDefault()
  }

  const handleDragEnter = (event: React.DragEvent): void => {
    event.preventDefault()
  }

  const handleClick = async (): Promise<void> => {
    try {
      console.log('🔵 BUTTON CLICKED: Invoking select-images...')
      const result = (await window.electron.ipcRenderer.invoke(
        'select-images'
      )) as SelectImagesResult
      console.log('select-images result:', result)

      if (result.success && result.imageData.length > 0) {
        const imageDataList: ImageData[] = result.imageData.map((data: ImageFileData) => {
          console.log('Processing image data:', data)
          // Create a File object from the base64 data
          const byteCharacters = atob(data.base64.split(',')[1])
          const byteNumbers = new Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
          }
          const byteArray = new Uint8Array(byteNumbers)
          const blob = new Blob([byteArray], { type: data.mimeType })
          const file = new File([blob], data.fileName, { type: data.mimeType })

          console.log('Created image data with path:', data.filePath)
          return { file, path: data.filePath }
        })

        console.log(
          'Final imageDataList:',
          imageDataList.map((img) => ({ name: img.file.name, path: img.path }))
        )
        onImagesSelect([...images, ...imageDataList])
      }
    } catch (error) {
      console.error('Error selecting images:', error)
      // Fallback to regular file input
      fileInputRef.current?.click()
    }
  }

  const handleRemove = (index: number): void => {
    const newImages = images.filter((_, i) => i !== index)
    onImagesSelect(newImages)
  }

  const handleDragEnd = (result: DropResult): void => {
    if (!result.destination) return

    const items = Array.from(images)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    onImagesSelect(items)
  }

  const createImageUrl = (imageData: ImageData): string => {
    try {
      return URL.createObjectURL(imageData.file)
    } catch (error) {
      console.error('Error creating image URL:', error)
      return ''
    }
  }

  const handleImageClick = (imageData: ImageData, event: React.MouseEvent): void => {
    // 阻止拖拽事件
    event.stopPropagation()
    setPreviewImage(imageData)
  }

  const closePreview = (): void => {
    setPreviewImage(null)
  }

  return (
    <div className="image-selector">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {images.length > 0 && (
        <div className="images-header">
          <span className="images-count">已选择 {images.length} 张图片</span>
          <span className="drag-hint">拖拽调整顺序，点击图片放大查看</span>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="images" direction="horizontal">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`images-container ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
            >
              {images.map((imageData, index) => (
                <Draggable
                  key={`${imageData.file.name}-${index}`}
                  draggableId={`${imageData.file.name}-${index}`}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`image-item ${snapshot.isDragging ? 'dragging' : ''}`}
                    >
                      <div className="image-order">{index + 1}</div>
                      <img
                        src={createImageUrl(imageData)}
                        alt={imageData.file.name}
                        className="image-preview"
                        onClick={(e) => handleImageClick(imageData, e)}
                      />
                      <div className="image-info">
                        <div className="image-name">{imageData.file.name}</div>
                        <div className="image-path" title={imageData.path}>
                          {imageData.path}
                        </div>
                      </div>
                      <button
                        className="image-remove"
                        onClick={() => handleRemove(index)}
                        title="移除图片"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div
        className="image-dropzone"
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
      >
        <div className="dropzone-content">
          <div className="dropzone-icon">🖼️</div>
          <div className="dropzone-text">
            <div className="dropzone-main">点击选择图片</div>
            <div className="dropzone-sub">或拖拽图片到这里 (支持多选)</div>
          </div>
        </div>
      </div>

      {/* 图片预览模态框 */}
      {previewImage && (
        <div className="image-preview-modal" onClick={closePreview}>
          <div className="modal-overlay" />
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closePreview}>
              ✕
            </button>
            <img
              src={createImageUrl(previewImage)}
              alt={previewImage.file.name}
              className="modal-image"
            />
            <div className="modal-info">
              <div className="modal-filename">{previewImage.file.name}</div>
              <div className="modal-path">{previewImage.path}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageSelector
