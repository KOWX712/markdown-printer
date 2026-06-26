import { ref, watch, nextTick, type Ref } from 'vue'
import { PAGE_SIZES } from '../utils/constants'
import { fontFamilyCSS } from '../utils/css'

export interface Page {
  index: number
  elements: string[]
}

const MM_TO_PX = 96 / 25.4

export function usePagination(
  html: Ref<string>,
  pageHeight: Ref<number>,
  scale: Ref<number>,
  pageSize: Ref<string>,
  margin: Ref<{ top: string; right: string; bottom: string; left: string }>,
  font: Ref<string>,
  fontSize: Ref<number>,
) {
  const pages = ref<Page[]>([{ index: 0, elements: [] }])
  const totalPages = ref(1)

  let measureContainer: HTMLElement | null = null

  function getMeasureContainer(): HTMLElement {
    if (!measureContainer) {
      measureContainer = document.createElement('div')
      measureContainer.style.cssText =
        'position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;'
      document.body.appendChild(measureContainer)
    }
    return measureContainer
  }

  function parseMarginValue(val: string): number {
    if (val.endsWith('mm')) return parseFloat(val) * MM_TO_PX
    if (val.endsWith('in')) return parseFloat(val) * 96
    if (val.endsWith('px')) return parseFloat(val)
    return parseFloat(val) || 0
  }

function getElementHeight(el: HTMLElement): number {
  const rect = el.getBoundingClientRect()
  const style = window.getComputedStyle(el)
  const marginTop = parseFloat(style.marginTop) || 0
  const marginBottom = parseFloat(style.marginBottom) || 0
  return rect.height + marginTop + marginBottom
}

  function splitIntoPages() {
    const container = getMeasureContainer()

    const size = PAGE_SIZES.find(p => p.name === pageSize.value) || PAGE_SIZES[0]
    const widthMm = parseFloat(size.width)
    const pageWidthPx = widthMm * MM_TO_PX

    const padTop = parseMarginValue(margin.value.top)
    const padRight = parseMarginValue(margin.value.right)
    const padBottom = parseMarginValue(margin.value.bottom)
    const padLeft = parseMarginValue(margin.value.left)
    const contentWidth = pageWidthPx - padLeft - padRight

    container.className = 'markdown-body'
    container.style.width = `${contentWidth}px`
    container.style.fontFamily = `${fontFamilyCSS(font.value)}, sans-serif`
    container.style.fontSize = `${fontSize.value}px`
    container.style.lineHeight = '1.5'
    container.style.padding = '0'
    container.style.margin = '0'
    container.innerHTML = html.value

    const children = Array.from(container.children) as HTMLElement[]
    if (children.length === 0) {
      pages.value = [{ index: 0, elements: [] }]
      totalPages.value = 1
      return
    }

    const maxPageHeight = pageHeight.value - padTop - padBottom
    const result: Page[] = []
    let currentPageElements: string[] = []
    let currentHeight = 0
    let prevMarginBottom = 0

    const ATOMIC_TAGS = new Set(['PRE', 'TABLE', 'BLOCKQUOTE'])

    for (const child of children) {
      const isPageBreak = child.dataset?.pageBreak === 'true'

      if (isPageBreak) {
        if (currentPageElements.length > 0) {
          result.push({ index: result.length, elements: currentPageElements })
        }
        currentPageElements = []
        currentHeight = 0
        prevMarginBottom = 0
        continue
      }

      const childHeight = getElementHeight(child)
      const style = window.getComputedStyle(child)
      const childMarginTop = parseFloat(style.marginTop) || 0
      const childMarginBottom = parseFloat(style.marginBottom) || 0
      const collapsedMargin = Math.min(prevMarginBottom, childMarginTop)
      const effectiveHeight = childHeight - collapsedMargin
      const isAtomic = ATOMIC_TAGS.has(child.tagName)

      // At a page break, the browser print engine truncates the last element's 
      // marginBottom to 0. Account for this in the overflow check so the preview 
      // matches print output. Without this, the preview counts marginBottom that 
      // print discards, causing slightly different page fills.
      const effectivePageHeight = currentPageElements.length === 0
        ? maxPageHeight
        : maxPageHeight + prevMarginBottom

      if (currentHeight + effectiveHeight > effectivePageHeight && currentPageElements.length > 0) {
        result.push({ index: result.length, elements: currentPageElements })
        currentPageElements = []
        currentHeight = 0
        prevMarginBottom = 0
      }

      if (isAtomic && childHeight > maxPageHeight && currentPageElements.length > 0) {
        result.push({ index: result.length, elements: currentPageElements })
        currentPageElements = []
        currentHeight = 0
        prevMarginBottom = 0
      }

      currentPageElements.push(child.outerHTML)
      currentHeight += effectiveHeight
      prevMarginBottom = childMarginBottom
    }

    if (currentPageElements.length > 0) {
      result.push({ index: result.length, elements: currentPageElements })
    }

    pages.value = result.length > 0 ? result : [{ index: 0, elements: [] }]
    totalPages.value = result.length || 1
  }

  let recalcTimeout: ReturnType<typeof setTimeout>
  watch(
    [html, pageHeight, scale, pageSize, margin, font, fontSize],
    () => {
      clearTimeout(recalcTimeout)
      recalcTimeout = setTimeout(() => {
        nextTick(splitIntoPages)
      }, 100)
    },
    { immediate: true },
  )

  return { pages, totalPages }
}
