import type { Tab, EditorSettings } from './types'
import { STORAGE_KEYS } from './constants'

export function loadTabs(): Tab[] {
  try {
    const data = sessionStorage.getItem(STORAGE_KEYS.TABS)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveTabs(tabs: Tab[]): void {
  sessionStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(tabs))
}

export function loadSettings(): Partial<EditorSettings> {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

export function saveSettings(settings: EditorSettings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
}

export function loadActiveTabId(): string | null {
  return sessionStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)
}

export function saveActiveTabId(id: string): void {
  sessionStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, id)
}

export function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const DB_NAME = 'markdown-printer'
const DB_VERSION = 2
const TAB_HISTORY_STORE = 'tab-history'
const FONTS_STORE = 'fonts'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(TAB_HISTORY_STORE)) {
        db.createObjectStore(TAB_HISTORY_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(FONTS_STORE)) {
        db.createObjectStore(FONTS_STORE, { keyPath: 'family' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function deleteAndReopen(): Promise<IDBDatabase> {
  await new Promise<void>((res) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => res()
    req.onerror = () => res()
  })
  dbPromise = null
  return getDB()
}

async function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = openDB()
  try {
    const db = await dbPromise
    if (!db.objectStoreNames.contains(TAB_HISTORY_STORE) || !db.objectStoreNames.contains(FONTS_STORE)) {
      db.close()
      dbPromise = null
      return deleteAndReopen()
    }
    return db
  } catch (e: any) {
    dbPromise = null
    if (e?.name === 'VersionError') {
      return deleteAndReopen()
    }
    throw e
  }
}

export async function loadTabHistory(): Promise<Tab[]> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TAB_HISTORY_STORE, 'readonly')
      const store = tx.objectStore(TAB_HISTORY_STORE)
      const request = store.getAll()
      request.onsuccess = () => {
        const tabs = request.result as Tab[]
        tabs.sort((a, b) => b.updatedAt - a.updatedAt)
        resolve(tabs)
      }
      request.onerror = () => reject(request.error)
    })
  } catch (e) {
    console.error('[IDB] Failed to load tab history:', e)
    return []
  }
}

export async function saveTabToHistory(tab: Tab): Promise<void> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TAB_HISTORY_STORE, 'readwrite')
      const store = tx.objectStore(TAB_HISTORY_STORE)
      store.put({ ...tab })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.error('[IDB] Failed to save tab to history:', e)
  }
}

export async function removeTabFromHistory(id: string): Promise<void> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TAB_HISTORY_STORE, 'readwrite')
      const store = tx.objectStore(TAB_HISTORY_STORE)
      store.delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.error('[IDB] Failed to remove tab from history:', e)
  }
}

export async function clearTabHistory(): Promise<void> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TAB_HISTORY_STORE, 'readwrite')
      const store = tx.objectStore(TAB_HISTORY_STORE)
      store.clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.error('[IDB] Failed to clear tab history:', e)
  }
}

export interface StoredFont {
  family: string
  name: string
  group: string
  blob: Blob
}

export async function getAllStoredFonts(): Promise<StoredFont[]> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FONTS_STORE, 'readonly')
      const store = tx.objectStore(FONTS_STORE)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result as StoredFont[])
      request.onerror = () => reject(request.error)
    })
  } catch (e) {
    console.error('[IDB] Failed to load fonts:', e)
    return []
  }
}

export async function putFont(font: StoredFont): Promise<void> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FONTS_STORE, 'readwrite')
      const store = tx.objectStore(FONTS_STORE)
      store.put(font)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.error('[IDB] Failed to save font:', e)
  }
}

export async function deleteFont(family: string): Promise<void> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FONTS_STORE, 'readwrite')
      const store = tx.objectStore(FONTS_STORE)
      store.delete(family)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.error('[IDB] Failed to delete font:', e)
  }
}
