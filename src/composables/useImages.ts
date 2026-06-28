import { ref } from 'vue'
import type { StoredImage } from '../utils/types'
import { saveImage, getAllImages, deleteImage, getImage } from '../utils/storage'

const images = ref<StoredImage[]>([])
const loading = ref(false)

export function useImages() {
  async function loadImages() {
    loading.value = true
    try {
      images.value = await getAllImages()
    } finally {
      loading.value = false
    }
  }

  async function uploadImage(file: File): Promise<StoredImage | null> {
    const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const image: StoredImage = {
      id,
      name: file.name,
      mimeType: file.type,
      blob: file,
      createdAt: Date.now(),
    }
    await saveImage(image)
    images.value = [image, ...images.value]
    return image
  }

  async function removeImage(id: string) {
    await deleteImage(id)
    images.value = images.value.filter(img => img.id !== id)
  }

  function getImageUrl(id: string): string | null {
    const img = images.value.find(i => i.id === id)
    if (!img) return null
    return URL.createObjectURL(img.blob)
  }

  async function getImageUrlById(id: string): Promise<string | null> {
    const img = await getImage(id)
    if (!img) return null
    return URL.createObjectURL(img.blob)
  }

  return {
    images,
    loading,
    loadImages,
    uploadImage,
    removeImage,
    getImageUrl,
    getImageUrlById,
  }
}
