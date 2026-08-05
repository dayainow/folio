/**
 * P42 — 모바일 미디어 헬퍼 (이미지 → Markdown)
 */

const MAX_EDGE = 1280
const JPEG_QUALITY = 0.72
const MAX_BYTES = 900_000

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 읽을 수 없습니다'))
    }
    img.src = url
  })
}

/** 긴 변 MAX_EDGE 이하로 리사이즈 후 JPEG data URL */
export async function compressImageFile(file: File): Promise<{ dataUrl: string; alt: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 첨부할 수 있습니다')
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('파일이 너무 큽니다 (최대 12MB)')
  }

  const img = await loadImage(file)
  let { width, height } = img
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  width = Math.max(1, Math.round(width * scale))
  height = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas를 사용할 수 없습니다')
  ctx.drawImage(img, 0, 0, width, height)

  let quality = JPEG_QUALITY
  let dataUrl = canvas.toDataURL('image/jpeg', quality)
  while (dataUrl.length > MAX_BYTES && quality > 0.4) {
    quality -= 0.08
    dataUrl = canvas.toDataURL('image/jpeg', quality)
  }
  if (dataUrl.length > MAX_BYTES * 1.4) {
    throw new Error('압축 후에도 이미지가 큽니다. 더 작은 사진을 선택해 주세요')
  }

  const alt = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'image'
  // 메모리 누수 방지 — 캔버스 해제
  canvas.width = 0
  canvas.height = 0
  return { dataUrl, alt }
}

export async function fileToMarkdownImage(file: File): Promise<string> {
  const { dataUrl, alt } = await compressImageFile(file)
  return `\n\n![${alt}](${dataUrl})\n\n`
}
