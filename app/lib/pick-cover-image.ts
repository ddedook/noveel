import { toast } from '@/app/lib/toast'

const MAX_COVER_BYTES = 2 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('读取图片失败'))
    }
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

/** 选择本地图片并转为 data URL，写入封面字段。失败时 Toast，返回 null。 */
export async function pickCoverImageAsDataUrl(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = ACCEPT
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      if (!file.type.startsWith('image/')) {
        toast.error('请选择图片文件')
        resolve(null)
        return
      }
      if (file.size > MAX_COVER_BYTES) {
        toast.error('封面图片不能超过 2MB')
        resolve(null)
        return
      }
      try {
        const dataUrl = await readFileAsDataUrl(file)
        resolve(dataUrl)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '读取图片失败')
        resolve(null)
      }
    }
    input.click()
  })
}

export function isDisplayableCover(src: string | null | undefined): boolean {
  const c = src?.trim()
  if (!c) return false
  return (
    c.startsWith('http://') ||
    c.startsWith('https://') ||
    c.startsWith('file:') ||
    c.startsWith('data:image/') ||
    c.startsWith('/')
  )
}
