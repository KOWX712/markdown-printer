<template>
  <div
    class="tab-item"
    :class="{ active: isActive }"
    @click="$emit('select')"
    @dblclick="startRename"
    @contextmenu.prevent="showContextMenu"
  >
    <input
      v-if="isRenaming"
      ref="renameInput"
      v-model="renameValue"
      class="tab-rename-input"
      @blur="finishRename"
      @keydown.enter="finishRename"
      @keydown.escape="cancelRename"
    />
    <span v-else class="tab-name">{{ tab.name }}</span>
    <button
      v-if="closable"
      class="tab-close"
      @click.stop="$emit('close')"
      title="Close tab"
    >
      <X :size="14" />
    </button>
    <div v-if="contextMenuVisible" class="tab-context-menu" :style="{ left: `${contextMenuX}px`, top: `${contextMenuY}px` }" @click.stop>
      <button class="context-menu-item" @click="startRenameFromContext">Rename</button>
      <button class="context-menu-item" @click="$emit('close')">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import type { Tab } from '../utils/types'
import { X } from '@lucide/vue';

const props = defineProps<{
  tab: Tab
  isActive: boolean
  closable: boolean
  isNewTab: boolean
}>()

const emit = defineEmits<{
  select: []
  close: []
  rename: [name: string]
}>()

const isRenaming = ref(false)
const renameValue = ref('')
const renameInput = ref<HTMLInputElement | null>(null)
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

function showContextMenu(e: MouseEvent) {
  if (props.isNewTab) return
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  contextMenuVisible.value = true
}

function startRenameFromContext() {
  contextMenuVisible.value = false
  startRename()
}

function hideContextMenu() {
  contextMenuVisible.value = false
}

onMounted(() => {
  document.addEventListener('click', hideContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', hideContextMenu)
})

function startRename() {
  if (props.isNewTab) return
  renameValue.value = props.tab.name
  isRenaming.value = true
  nextTick(() => {
    renameInput.value?.focus()
    renameInput.value?.select()
  })
}

function finishRename() {
  if (renameValue.value.trim()) {
    emit('rename', renameValue.value.trim())
  }
  isRenaming.value = false
}

function cancelRename() {
  isRenaming.value = false
}
</script>

<style scoped>
.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  cursor: pointer;
  user-select: none;
  width: 180px;
  transform-origin: left center;
}

.tab-item:hover {
  background: var(--border-color);
}

.tab-item.active {
  background: var(--bg-primary);
  border-bottom: 2px solid var(--accent-color);
}

.tab-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.tab-rename-input {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--accent-color);
  color: var(--text-primary);
  padding: 2px 4px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}

.tab-close {
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
  opacity: 0.6;
}

.tab-close:hover {
  opacity: 1;
  color: #ff4444;
}

.tab-context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 4px 0;
  z-index: 1000;
  min-width: 100px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.context-menu-item {
  display: block;
  width: 100%;
  padding: 6px 12px;
  background: none;
  border: none;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  font-size: 13px;
}

.context-menu-item:hover {
  background: var(--border-color);
}
</style>
