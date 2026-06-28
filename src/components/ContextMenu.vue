<template>
  <div class="editor-context-menu">
    <PrimeContextMenu ref="menuRef" :model="items" @hide="onHide" >
      <template #item="{ item, props }">
        <!-- Inline button row -->
        <div
          v-if="item._type === 'row'"
          class="inline-row"
          @click.stop
        >
          <Button
            v-for="btn in item._buttons!"
            :key="btn.action"
            :class="{ active: btn.active }"
            @click.stop="btn.handler()"
            :title="btn.label"
            :severity="btn.active ? 'info' : 'contrast'"
            :variant="btn.active ? '' : 'text'"
            size="small"
          >
            <component :is="btn.icon" :size="16" />
          </Button>
        </div>
        <!-- Table grid picker -->
        <div v-else-if="item._type === 'grid'" class="table-grid-wrapper" @click.stop>
          <div class="table-grid" @mouseleave="hoverRows = 0; hoverCols = 0">
            <div v-for="row in 7" :key="row" class="table-grid-row">
              <div
                v-for="col in 7" :key="col"
                class="table-cell"
                :class="{ selected: row <= hoverRows && col <= hoverCols }"
                @mouseenter="hoverRows = row; hoverCols = col"
                @click.stop="insertTable(row, col)"
              />
            </div>
          </div>
          <div class="table-size-label">
            <template v-if="hoverRows > 0 && hoverCols > 0">{{ hoverRows }} × {{ hoverCols }}</template>
            <template v-else>&nbsp;</template>
          </div>
        </div>
        <!-- Regular PrimeVue item (with submenu arrow if it has items) -->
        <a v-else v-bind="props.action" class="context-menu-item" :class="{ 'item-active': item.isActive }">
          <component :is="item.iconComponent" v-if="item.iconComponent" :size="16" class="menu-item-icon" />
          <span class="menu-item-label">{{ item.label }}</span>
          <ChevronRight v-if="item.items" :size="14" class="submenu-end-icon" />
        </a>
      </template>
    </PrimeContextMenu>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw } from 'vue'
import type { Component } from 'vue'
import PrimeContextMenu from 'primevue/contextmenu'
import type { MenuItem } from 'primevue/menuitem'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  TextAlignStart,
  TextAlignCenter,
  TextAlignEnd,
  Copy,
  ClipboardPaste,
  Table,
  ChevronRight,
} from '@lucide/vue'
import Button from 'primevue/button'

interface ActiveFormats {
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  code: boolean
  heading: 0 | 1 | 2 | 3 | 4 | 5 | 6
  alignment: 'left' | 'center' | 'right' | null
  listType: 'ul' | 'ol' | null
}

interface ContextMenuItem extends MenuItem {
  iconComponent?: Component
  isActive?: boolean
  _type?: 'row' | 'grid'
  _buttons?: InlineButton[]
}

interface InlineButton {
  icon: Component
  action: string
  label: string
  active: boolean
  handler: () => void
}

const props = defineProps<{
  selectedText?: string
  activeFormats?: ActiveFormats
}>()

const emit = defineEmits<{
  action: [type: string, value?: string]
  close: []
}>()

const menuRef = ref<InstanceType<typeof PrimeContextMenu>>()
const hoverRows = ref(0)
const hoverCols = ref(0)

function show(event: MouseEvent) {
  menuRef.value?.show(event)
}

function hide() {
  menuRef.value?.hide()
}

function onHide() {
  emit('close')
}

function handleAction(type: string, value?: string) {
  emit('action', type, value || props.selectedText)
  emit('close')
}

function insertTable(rows: number, cols: number) {
  emit('action', 'table', `${rows}x${cols}`)
  menuRef.value?.hide()
}

function handleCopy() {
  const text = props.selectedText
  if (!text) return
  emit('close')

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {
      fallbackCopy(text)
    })
  } else {
    fallbackCopy(text)
  }
}

function fallbackCopy(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function handlePaste() {
  emit('close')

  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then(text => {
      emit('action', 'paste', text)
    }).catch(() => {
      emit('action', 'focus-editor')
    })
  } else {
    emit('action', 'focus-editor')
  }
}

const BoldIcon = markRaw(Bold)
const ItalicIcon = markRaw(Italic)
const UnderlineIcon = markRaw(Underline)
const StrikethroughIcon = markRaw(Strikethrough)
const CodeIcon = markRaw(Code)
const ListIcon = markRaw(List)
const ListOrderedIcon = markRaw(ListOrdered)
const AlignLeftIcon = markRaw(TextAlignStart)
const AlignCenterIcon = markRaw(TextAlignCenter)
const AlignRightIcon = markRaw(TextAlignEnd)
const CopyIcon = markRaw(Copy)
const ClipboardPasteIcon = markRaw(ClipboardPaste)
const TableIcon = markRaw(Table)
const HeadingIcons = [
  markRaw(Heading1), markRaw(Heading2), markRaw(Heading3),
  markRaw(Heading4), markRaw(Heading5), markRaw(Heading6),
]

function makeRowButton(action: string, label: string, icon: Component, active: boolean): InlineButton {
  return { icon, action, label, active, handler: () => handleAction(action) }
}

const items = computed<ContextMenuItem[]>(() => {
  const af = props.activeFormats

  return [
    // Clipboard row
    {
      _type: 'row',
      command: () => {},
      _buttons: [
        { icon: CopyIcon, action: 'copy', label: 'Copy', active: false, handler: handleCopy },
        { icon: ClipboardPasteIcon, action: 'paste', label: 'Paste', active: false, handler: handlePaste },
      ],
    } as ContextMenuItem,
    { separator: true },

    // Inline formatting row
    {
      _type: 'row',
      command: () => {},
      _buttons: [
        makeRowButton('bold', 'Bold', BoldIcon, af?.bold ?? false),
        makeRowButton('italic', 'Italic', ItalicIcon, af?.italic ?? false),
        makeRowButton('underline', 'Underline', UnderlineIcon, af?.underline ?? false),
        makeRowButton('strikethrough', 'Strikethrough', StrikethroughIcon, af?.strikethrough ?? false),
        makeRowButton('code', 'Code', CodeIcon, af?.code ?? false),
      ],
    } as ContextMenuItem,

    // Headings row
    {
      _type: 'row',
      command: () => {},
      _buttons: HeadingIcons.map((comp, i) =>
        makeRowButton(`heading${i + 1}`, `Heading ${i + 1}`, comp, af?.heading === (i + 1) as 1 | 2 | 3 | 4 | 5 | 6)
      ),
    } as ContextMenuItem,

    // Lists row
    {
      _type: 'row',
      command: () => {},
      _buttons: [
        makeRowButton('unorderedList', 'Unordered List', ListIcon, af?.listType === 'ul'),
        makeRowButton('orderedList', 'Ordered List', ListOrderedIcon, af?.listType === 'ol'),
      ],
    } as ContextMenuItem,

    // Alignment row
    {
      _type: 'row',
      command: () => {},
      _buttons: [
        makeRowButton('alignLeft', 'Align Left', AlignLeftIcon, af?.alignment === 'left'),
        makeRowButton('alignCenter', 'Align Center', AlignCenterIcon, af?.alignment === 'center'),
        makeRowButton('alignRight', 'Align Right', AlignRightIcon, af?.alignment === 'right'),
      ],
    } as ContextMenuItem,
    { separator: true },

    // Insert items
    { label: 'Link', command: () => handleAction('link') },
    { label: 'Image', command: () => handleAction('image') },
    { label: 'Code Block', command: () => handleAction('codeBlock') },
    {
      label: 'Blockquote',
      items: [
        { label: 'Basic', command: () => handleAction('blockquote') },
        { label: 'Note', command: () => handleAction('alertNote') },
        { label: 'Tip', command: () => handleAction('alertTip') },
        { label: 'Important', command: () => handleAction('alertImportant') },
        { label: 'Warning', command: () => handleAction('alertWarning') },
        { label: 'Caution', command: () => handleAction('alertCaution') },
      ],
    } as ContextMenuItem,
    { label: 'Horizontal Rule', command: () => handleAction('horizontalRule') },
    { separator: true },

    // Table submenu (grid picker)
    {
      label: 'Table',
      iconComponent: TableIcon,
      items: [
        { _type: 'grid', command: () => {} } as ContextMenuItem,
      ],
    } as ContextMenuItem,
  ]
})

defineExpose({ show, hide })
</script>

<style scoped>
.context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  white-space: nowrap;
}

.menu-item-icon {
  flex-shrink: 0;
}

.menu-item-label {
  flex: 1;
}

.inline-row {
  display: flex;
  gap: 4px;
  margin: 2px 0;
}

.submenu-end-icon {
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0.5;
}

/* Table grid picker */
.table-grid-wrapper {
  padding: 8px;
}

.table-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.table-grid-row {
  display: flex;
  width: 100%;
  gap: 2px;
}

.table-cell {
  flex: 1;
  aspect-ratio: 1 / 1;
  height: auto;
  border: 2px solid var(--border-color);
  border-radius: 2px;
  cursor: pointer;
  background: transparent;
  transition: border 0.08s ease;
}

.table-cell.selected {
  border-color: var(--accent-color);
}

.table-size-label {
  text-align: center;
  margin-top: 6px;
  font-size: 12px;
  color: color-mix(in srgb, var(--text-primary) 60%, transparent);
  min-height: 16px;
}
</style>

<style>
.p-contextmenu {
  --p-contextmenu-background: var(--bg-secondary);
}
.p-contextmenu-item {
  --p-contextmenu-item-focus-background: var(--bg-primary);
  --p-contextmenu-item-hover-background: var(--bg-primary);
  --p-contextmenu-item-active-background: var(--bg-primary);
}
.p-contextmenu-item:has(.inline-row),
.p-contextmenu-item:has(.table-grid-wrapper) {
  --p-contextmenu-item-focus-background: transparent;
  --p-contextmenu-item-hover-background: transparent;
  --p-contextmenu-item-active-background: transparent;
}
</style>
