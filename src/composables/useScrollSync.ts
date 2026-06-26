import { ref, watch, onUnmounted, type Ref } from 'vue'
import { EditorView } from '@codemirror/view'

export function useScrollSync(
  editorView: Ref<EditorView | null>,
  previewContainer: Ref<HTMLElement | null>,
) {
  const syncDriver = ref<'editor' | 'preview' | null>(null)
  let editorScrollCleanup: (() => void) | null = null
  let previewScrollCleanup: (() => void) | null = null

  const PREVIEW_SMOOTH_THRESHOLD = 50
  const PREVIEW_LERP_FACTOR = 0.22
  let previewScrollTarget: number | null = null
  let previewScrollRaf: number | null = null

  let programmaticEditorScroll = false
  let programmaticPreviewScroll = false
  let programmaticEditorScrollTimer: ReturnType<typeof setTimeout> | null = null
  let programmaticPreviewScrollTimer: ReturnType<typeof setTimeout> | null = null

  function markProgrammaticEditorScroll() {
    programmaticEditorScroll = true
    if (programmaticEditorScrollTimer !== null) clearTimeout(programmaticEditorScrollTimer)
    programmaticEditorScrollTimer = setTimeout(() => {
      programmaticEditorScroll = false
      programmaticEditorScrollTimer = null
    }, 50)
  }

  function markProgrammaticPreviewScroll() {
    programmaticPreviewScroll = true
    if (programmaticPreviewScrollTimer !== null) clearTimeout(programmaticPreviewScrollTimer)
    programmaticPreviewScrollTimer = setTimeout(() => {
      programmaticPreviewScroll = false
      programmaticPreviewScrollTimer = null
    }, 50)
  }

  function resetSyncDriverSoon() {
    setTimeout(() => {
      if (previewScrollRaf === null) {
        syncDriver.value = null
      }
    }, 100)
  }

  function cancelPreviewScrollAnimation() {
    if (previewScrollRaf !== null) {
      cancelAnimationFrame(previewScrollRaf)
      previewScrollRaf = null
    }
    previewScrollTarget = null
    resetSyncDriverSoon()
  }

  function tickPreviewScroll() {
    const container = previewContainer.value
    if (!container || previewScrollTarget === null) {
      previewScrollRaf = null
      resetSyncDriverSoon()
      return
    }

    const diff = previewScrollTarget - container.scrollTop
    if (Math.abs(diff) < 1) {
      markProgrammaticPreviewScroll()
      container.scrollTop = previewScrollTarget
      previewScrollRaf = null
      previewScrollTarget = null
      resetSyncDriverSoon()
      return
    }

    markProgrammaticPreviewScroll()
    container.scrollTop = container.scrollTop + diff * PREVIEW_LERP_FACTOR
    previewScrollRaf = requestAnimationFrame(tickPreviewScroll)
  }

  function animatePreviewScrollTo(target: number) {
    previewScrollTarget = target
    if (previewScrollRaf !== null) return

    syncDriver.value = 'editor'
    previewScrollRaf = requestAnimationFrame(tickPreviewScroll)
  }

  function setPreviewScrollTop(target: number) {
    const container = previewContainer.value
    if (!container) return

    const delta = Math.abs(target - container.scrollTop)

    if (previewScrollRaf !== null) {
      previewScrollTarget = target
      if (delta < 1) {
        cancelPreviewScrollAnimation()
        markProgrammaticPreviewScroll()
        container.scrollTop = target
        resetSyncDriverSoon()
      }
      return
    }

    if (delta > PREVIEW_SMOOTH_THRESHOLD) {
      animatePreviewScrollTo(target)
    } else {
      markProgrammaticPreviewScroll()
      container.scrollTop = target
      resetSyncDriverSoon()
    }
  }

  interface MappedElement {
    line: number
    center: number
  }

  function getMappedElements(container: HTMLElement): MappedElement[] {
    const pages = container.querySelectorAll<HTMLElement>('.preview-page')
    const savedTransforms: string[] = []
    pages.forEach((p) => {
      savedTransforms.push(p.style.transform)
      p.style.transform = 'none'
    })

    const containerRect = container.getBoundingClientRect()
    const elements = container.querySelectorAll<HTMLElement>('[data-source-line]')
    const result: MappedElement[] = []

    for (const el of elements) {
      const line = parseInt(el.getAttribute('data-source-line') || '0', 10)
      if (line <= 0) continue

      const rect = el.getBoundingClientRect()
      const contentTop = rect.top - containerRect.top + container.scrollTop
      const center = contentTop + rect.height / 2
      result.push({ line, center })
    }

    pages.forEach((p, i) => {
      p.style.transform = savedTransforms[i]
    })

    return result.sort((a, b) => a.line - b.line)
  }

  function onEditorScroll() {
    if (syncDriver.value === 'preview') return
    if (programmaticEditorScroll) return
    syncDriver.value = 'editor'

    if (!editorView.value || !previewContainer.value) {
      setTimeout(() => {
        syncDriver.value = null
      }, 100)
      return
    }

    const scrollDOM = editorView.value.scrollDOM
    const editorHeight = scrollDOM.clientHeight
    const editorScrollTop = scrollDOM.scrollTop

    if (editorScrollTop === 0) {
      animatePreviewScrollTo(0)
      return
    }

    const editorCenterY = editorScrollTop + editorHeight / 3
    const block = editorView.value.lineBlockAtHeight(editorCenterY)
    const blockLine = editorView.value.state.doc.lineAt(block.from)
    const blockHeight = block.bottom - block.top
    const offsetPercent = blockHeight > 0 ? (editorCenterY - block.top) / blockHeight : 0
    const editorLineFraction = blockLine.number + offsetPercent

    const mapped = getMappedElements(previewContainer.value)
    if (mapped.length === 0) {
      setTimeout(() => {
        syncDriver.value = null
      }, 100)
      return
    }

    const totalLines = editorView.value.state.doc.lines
    let targetCenter = 0

    if (editorLineFraction <= mapped[0].line) {
      const t = mapped[0].line > 1 ? (editorLineFraction - 1) / (mapped[0].line - 1) : 0
      targetCenter = t * mapped[0].center
    } else if (editorLineFraction >= mapped[mapped.length - 1].line) {
      const last = mapped[mapped.length - 1]
      const maxScroll = previewContainer.value.scrollHeight - previewContainer.value.clientHeight / 2
      const denom = totalLines - last.line
      const t = denom > 0 ? (editorLineFraction - last.line) / denom : 0
      targetCenter = last.center + t * (maxScroll - last.center)
    } else {
      let lower = mapped[0]
      let upper = mapped[mapped.length - 1]
      for (let i = 0; i < mapped.length - 1; i++) {
        if (mapped[i].line <= editorLineFraction && mapped[i + 1].line >= editorLineFraction) {
          lower = mapped[i]
          upper = mapped[i + 1]
          break
        }
      }
      const denom = upper.line - lower.line
      const t = denom > 0 ? (editorLineFraction - lower.line) / denom : 0
      targetCenter = lower.center + t * (upper.center - lower.center)
    }

    setPreviewScrollTop(targetCenter - previewContainer.value.clientHeight / 2)
  }

  function onPreviewScroll() {
    if (syncDriver.value === 'editor') {
      // Programmatic scroll from animation — don't cancel, let it continue
      if (programmaticPreviewScroll) return
      // User manually scrolled during editor-initiated sync — cancel animation so it doesn't fight
      cancelPreviewScrollAnimation()
      return
    }
    if (programmaticPreviewScroll) return
    syncDriver.value = 'preview'

    if (!editorView.value || !previewContainer.value) {
      setTimeout(() => {
        syncDriver.value = null
      }, 100)
      return
    }

    const container = previewContainer.value
    const previewScrollTop = container.scrollTop
    const previewHeight = container.clientHeight
    const previewScrollHeight = container.scrollHeight

    const previewCenterY = previewScrollTop + previewHeight / 2
    const mapped = getMappedElements(container)
    if (mapped.length === 0) {
      setTimeout(() => {
        syncDriver.value = null
      }, 100)
      return
    }

    const totalLines = editorView.value.state.doc.lines
    let targetLineFraction = 1

    if (previewCenterY <= mapped[0].center) {
      const denom = mapped[0].center
      const t = denom > 0 ? previewCenterY / denom : 0
      targetLineFraction = 1 + t * (mapped[0].line - 1)
    } else if (previewCenterY >= mapped[mapped.length - 1].center) {
      const last = mapped[mapped.length - 1]
      const maxScroll = previewScrollHeight - previewHeight / 2
      const denom = maxScroll - last.center
      const t = denom > 0 ? (previewCenterY - last.center) / denom : 0
      targetLineFraction = last.line + t * (totalLines - last.line)
    } else {
      let lower = mapped[0]
      let upper = mapped[mapped.length - 1]
      for (let i = 0; i < mapped.length - 1; i++) {
        if (mapped[i].center <= previewCenterY && mapped[i + 1].center >= previewCenterY) {
          lower = mapped[i]
          upper = mapped[i + 1]
          break
        }
      }
      const denom = upper.center - lower.center
      const t = denom > 0 ? (previewCenterY - lower.center) / denom : 0
      targetLineFraction = lower.line + t * (upper.line - lower.line)
    }

    const lineInt = Math.floor(targetLineFraction)
    const lineFraction = targetLineFraction - lineInt
    const safeLineInt = Math.max(1, Math.min(totalLines, lineInt))

    const pos = editorView.value.state.doc.line(safeLineInt).from
    const block = editorView.value.lineBlockAt(pos)
    const blockHeight = block.bottom - block.top
    const targetEditorCenter = block.top + lineFraction * blockHeight

    markProgrammaticEditorScroll()
    editorView.value.scrollDOM.scrollTop = targetEditorCenter - editorView.value.scrollDOM.clientHeight / 2

    setTimeout(() => {
      syncDriver.value = null
    }, 100)
  }

  function bindListeners() {
    editorScrollCleanup?.()
    previewScrollCleanup?.()

    if (editorView.value) {
      const scrollDOM = editorView.value.scrollDOM
      scrollDOM.addEventListener('scroll', onEditorScroll, { passive: true })
      editorScrollCleanup = () =>
        scrollDOM.removeEventListener('scroll', onEditorScroll)
    }

    if (previewContainer.value) {
      const pc = previewContainer.value
      pc.addEventListener('scroll', onPreviewScroll, { passive: true })
      const onPreviewWheel = () => {
        if (syncDriver.value === 'editor') cancelPreviewScrollAnimation()
      }
      const onPreviewTouchMove = () => {
        if (syncDriver.value === 'editor') cancelPreviewScrollAnimation()
      }
      const onPreviewKeyDown = (e: KeyboardEvent) => {
        if (syncDriver.value !== 'editor') return
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
          cancelPreviewScrollAnimation()
        }
      }
      pc.addEventListener('wheel', onPreviewWheel, { passive: true })
      pc.addEventListener('touchmove', onPreviewTouchMove, { passive: true })
      pc.addEventListener('keydown', onPreviewKeyDown)

      previewScrollCleanup = () => {
        pc.removeEventListener('scroll', onPreviewScroll)
        pc.removeEventListener('wheel', onPreviewWheel)
        pc.removeEventListener('touchmove', onPreviewTouchMove)
        pc.removeEventListener('keydown', onPreviewKeyDown)
      }
    }
  }

  watch([editorView, previewContainer], () => {
    bindListeners()
  })

  function onPreviewClick(e: MouseEvent) {
    if (!previewContainer.value || !editorView.value) return

    const target = e.target as HTMLElement
    const sourceLine = target
      .closest('[data-source-line]')
      ?.getAttribute('data-source-line')

    if (sourceLine) {
      const line = parseInt(sourceLine, 10)
      const linePos = editorView.value.state.doc.line(line).from
      const editor = editorView.value
      editor.dispatch({ selection: { anchor: linePos }})

      const block = editor.lineBlockAt(linePos)
      const viewHeight = editor.scrollDOM.clientHeight
      const maxScroll = editor.scrollDOM.scrollHeight - viewHeight
      const blockCenter = block.top + (block.bottom - block.top) / 2

      markProgrammaticEditorScroll()
      editor.scrollDOM.scrollTop = Math.max(0, Math.min(blockCenter - viewHeight / 2, maxScroll))
      editor.focus()
    }
  }

  onUnmounted(() => {
    cancelPreviewScrollAnimation()
    editorScrollCleanup?.()
    previewScrollCleanup?.()
  })

  return {
    onPreviewClick,
  }
}
