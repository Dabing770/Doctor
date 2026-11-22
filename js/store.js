// 用 IndexedDB 把解析结果保存在本机浏览器里（只存在你的电脑上）
const DB = 'apple-health-viewer'
const STORE = 'kv'
const KEY = 'data-v1'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const r = fn(t.objectStore(STORE))
    t.oncomplete = () => { db.close(); resolve(r?.result) }
    t.onerror = () => { db.close(); reject(t.error) }
  })
}

export const loadData = () => tx('readonly', (s) => s.get(KEY)).catch(() => undefined)
export const saveData = (d) => tx('readwrite', (s) => s.put(d, KEY)).catch(() => {})
export const clearData = () => tx('readwrite', (s) => s.delete(KEY)).catch(() => {})
