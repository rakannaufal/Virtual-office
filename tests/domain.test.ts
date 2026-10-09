import { describe, it, expect } from 'vitest'
import { seed } from '../src/lib/seed'
import { isReady, transitionError, validateWorkspace, sameWorkspace } from '../src/lib/domain'

describe('workflow and data integrity', () => {
  it('compares Supabase JSONB data without false conflicts from key ordering', () => {
    const w = seed(),
      reordered = JSON.parse(
        JSON.stringify(w, (_key, value) =>
          value && typeof value === 'object' && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
            : value,
        ),
      )
    expect(sameWorkspace(w, reordered)).toBe(true)
    reordered.orders[0].notes = 'Perubahan dari perangkat lain'
    expect(sameWorkspace(w, reordered)).toBe(false)
  })
  it('rejects disabled required workflow phases', () => {
    const w = seed()
    w.workflows.find((f) => f.phase === 'revision')!.active = false
    expect(() => validateWorkspace(w)).toThrow('Tahapan utama')
  })
  it('keeps orders attached after role rename', () => {
    const w = seed(),
      role = w.roles.find((r) => r.id === 'documents')!
    role.name = 'Nama baru'
    role.title = 'Dokumen RN'
    expect(validateWorkspace(w).orders[0].roleId).toBe(role.id)
    expect(isReady(w, role)).toBe(true)
  })
  it('blocks premature approval/completion', () => {
    const w = seed(),
      o = w.orders[0]
    expect(transitionError(w, o, 'review')).toMatch(/checklist/)
    o.checklist.forEach((c) => (c.done = true))
    expect(transitionError(w, o, 'done')).toMatch(/Quality/)
    o.qcApproved = true
    expect(transitionError(w, o, 'done')).toMatch(/CEO/)
    o.ceoApproved = true
    expect(transitionError(w, o, 'done')).toMatch(/file hasil/)
    o.files.push({
      id: 'f',
      orderId: o.id,
      name: 'hasil.pdf',
      size: 1,
      type: 'application/pdf',
      category: 'result',
      backend: 'local',
      createdAt: o.createdAt,
    })
    expect(transitionError(w, o, 'done')).toBeNull()
    o.revisions.push({ id: 'r', note: 'Perbaiki tanggal', createdAt: o.createdAt, resolved: false })
    expect(transitionError(w, o, 'done')).toMatch(/revisi/)
  })
  it('rejects missing roles, duplicate IDs, invalid colors, owner removal, and overpayment', () => {
    for (const mutate of [
      (w: ReturnType<typeof seed>) => (w.orders[0].roleId = 'missing'),
      (w: ReturnType<typeof seed>) => (w.roles[1].id = w.roles[0].id),
      (w: ReturnType<typeof seed>) => (w.settings.accent = 'javascript:alert(1)'),
      (w: ReturnType<typeof seed>) => (w.roles[0].active = false),
      (w: ReturnType<typeof seed>) => (w.orders[0].paid = 1000000),
    ]) {
      const w = seed()
      mutate(w)
      expect(() => validateWorkspace(w)).toThrow()
    }
  })
})
