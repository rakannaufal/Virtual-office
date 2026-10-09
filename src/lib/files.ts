import JSZip from 'jszip'
import type { Workspace } from './types'
import { validateWorkspace } from './domain'

let database: Promise<IDBDatabase> | undefined
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('rn-group-files', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('files')
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  }))
}
export async function putBlob(id: string, blob: Blob): Promise<void> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction('files', 'readwrite')
    t.objectStore('files').put(blob, id)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}
export async function getBlob(id: string): Promise<Blob | undefined> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const r = d.transaction('files').objectStore('files').get(id)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
export async function deleteBlob(id: string): Promise<void> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const t = d.transaction('files', 'readwrite')
    t.objectStore('files').delete(id)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a')
  a.href = url
  a.download = name
  a.hidden = true
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
export async function backup(
  w: Workspace,
  fetchBlob: (id: string) => Promise<Blob | undefined>,
): Promise<Blob> {
  const zip = new JSZip(),
    metadata = structuredClone(w)
  let total = 0
  for (const o of metadata.orders)
    for (const f of o.files) {
      const blob = await fetchBlob(f.id)
      if (!blob) throw Error(`File ${f.name} tidak tersedia; cadangan dibatalkan.`)
      total += blob.size
      if (total > 128 * 1024 * 1024)
        throw Error('Cadangan maksimal 128 MB file. Unduh file besar secara terpisah sebelum mencadangkan.')
      zip.file(`files/${f.id}`, await blob.arrayBuffer())
      f.backend = 'local'
      delete f.path
    }
  zip.file('workspace.json', JSON.stringify(metadata, null, 2))
  zip.file(
    'README.txt',
    'RN GROUP backup v1. Berisi data pribadi. Simpan di tempat aman. Impor melalui Pengaturan > Data.',
  )
  return zip.generateAsync({ type: 'blob' })
}
export async function readBackup(file: File) {
  if (file.size > 150 * 1024 * 1024) throw Error('Cadangan maksimal 150 MB.')
  const zip = await JSZip.loadAsync(await file.arrayBuffer()),
    json = zip.file('workspace.json')
  if (!json) throw Error('workspace.json tidak ditemukan.')
  // Reject oversized ZIP entries before decompression.
  const declaredSize = (entry: JSZip.JSZipObject) =>
    (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0
  if (declaredSize(json) > 8 * 1024 * 1024) throw Error('Metadata cadangan terlalu besar.')
  const w = validateWorkspace(JSON.parse(await json.async('string'))),
    blobs = new Map<string, Blob>()
  let total = 0
  for (const o of w.orders)
    for (const f of o.files) {
      const entry = zip.file(`files/${f.id}`)
      if (!entry) throw Error(`File cadangan hilang: ${f.name}`)
      if (declaredSize(entry) > 20 * 1024 * 1024) throw Error('File cadangan melebihi 20 MB.')
      const data = await entry.async('blob')
      total += data.size
      if (data.size > 20 * 1024 * 1024 || total > 150 * 1024 * 1024 || data.size !== f.size)
        throw Error('Ukuran file cadangan tidak valid.')
      blobs.set(f.id, data)
      f.backend = 'local'
      delete f.path
    }
  return { workspace: w, blobs }
}
