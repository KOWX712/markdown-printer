<template>
  <Dialog
    v-model:visible="localVisible"
    modal
    header="Image Gallery"
    :style="{ width: '720px' }"
    :contentStyle="{ padding: 0 }"
  >
    <div class="gallery-container">
      <div class="gallery-upload">
        <FileUpload
          mode="basic"
          name="image"
          accept="image/*"
          :maxFileSize="10000000"
          chooseLabel="Upload Image"
          chooseIcon="pi pi-upload"
          @select="onUpload"
          :auto="true"
          severity="secondary"
        />
      </div>

      <div v-if="loading" class="gallery-loading">
        <ProgressSpinner />
      </div>

      <div v-else-if="images.length === 0" class="gallery-empty">
        No images uploaded yet.
      </div>

      <div v-else class="gallery-grid">
        <div
          v-for="img in images"
          :key="img.id"
          class="gallery-item"
          @click="onSelect(img)"
        >
          <img :src="getImageUrl(img.id) || ''" :alt="img.name" class="gallery-thumb" />
          <div class="gallery-item-name">{{ img.name }}</div>
          <Button
            icon="pi pi-trash"
            severity="danger"
            text
            rounded
            size="small"
            class="gallery-delete-btn"
            @click.stop="onRemove(img.id)"
          />
        </div>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { useImages } from '../composables/useImages'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  select: [filename: string]
}>()

const { images, loading, loadImages, uploadImage, removeImage, getImageUrl } = useImages()

const localVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

watch(() => props.visible, (val) => {
  if (val) {
    loadImages()
  }
})

async function onUpload(event: FileUploadSelectEvent) {
  const file = event.files[0]
  if (file) {
    await uploadImage(file)
  }
}

function onSelect(img: { id: string; name: string }) {
  emit('select', img.name)
  localVisible.value = false
}

async function onRemove(id: string) {
  await removeImage(id)
}
</script>

<style scoped>
.gallery-container {
  max-height: 500px;
  display: flex;
  flex-direction: column;
}

.gallery-upload {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.gallery-loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.gallery-empty {
  text-align: center;
  padding: 40px;
  color: color-mix(in srgb, var(--text-primary) 50%, transparent);
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  padding: 16px;
  overflow-y: auto;
  max-height: 400px;
}

.gallery-item {
  position: relative;
  border: 2px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s;
}

.gallery-item:hover {
  border-color: var(--accent-color);
}

.gallery-thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}

.gallery-item-name {
  padding: 4px 8px;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.gallery-delete-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.5) !important;
  color: white !important;
}
</style>
