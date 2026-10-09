import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { backup, readBackup } from '../src/lib/files'
import { seed } from '../src/lib/seed'

describe('complete portable backups', () => {
  it('round trips metadata plus actual file bytes and converts cloud references to local', async () => {
    const w = seed(),
      contents = new Blob(['Produk,Jumlah\nKopi,3\n'], { type: 'text/csv' })
    w.orders[0].files.push({
      id: 'test-file',
      orderId: w.orders[0].id,
      name: 'rekap.csv',
      size: contents.size,
      type: contents.type,
      category: 'result',
      backend: 'cloud',
      path: 'owner/order/test-file',
      createdAt: w.orders[0].createdAt,
    })
    const output = await backup(w, async () => contents)
    const restored = await readBackup(new File([output], 'backup.zip'))
    expect(restored.workspace.roles[0].name).toBe(w.roles[0].name)
    expect(restored.workspace.orders[0].files[0].backend).toBe('local')
    expect(restored.workspace.orders[0].files[0].path).toBeUndefined()
    expect(await restored.blobs.get('test-file')!.text()).toBe(await contents.text())
    expect(w.orders[0].files[0].backend).toBe('cloud')
  })
  it('fails explicitly when a referenced file is missing', async () => {
    const w = seed()
    w.orders[0].files.push({
      id: 'missing-file',
      orderId: w.orders[0].id,
      name: 'missing.csv',
      size: 2,
      type: 'text/csv',
      category: 'source',
      backend: 'local',
      createdAt: w.orders[0].createdAt,
    })
    await expect(backup(w, async () => undefined)).rejects.toThrow('tidak tersedia')
    const zip = new JSZip()
    zip.file('workspace.json', JSON.stringify(w))
    const blob = await zip.generateAsync({ type: 'blob' })
    await expect(readBackup(new File([blob], 'incomplete.zip'))).rejects.toThrow('File cadangan hilang')
  })
})
