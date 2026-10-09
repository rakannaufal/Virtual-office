import { describe, expect, it } from 'vitest'
import { seed } from '../src/lib/seed'
import { validateWorkspace } from '../src/lib/domain'
import { actionOrders, roleSummary } from '../src/lib/roleSummary'
import { layoutError } from '../src/scene/navigation'

describe('role details and existing workspace upgrades', () => {
  it('routes review tasks to QC before CEO and excludes completed or archived orders', () => {
    const w = seed(),
      review = w.orders.find((o) => o.statusId === 'review')!
    const qc = w.roles.find((r) => r.kind === 'quality')!,
      ceo = w.roles[0]
    expect(actionOrders(w, qc).map((o) => o.id)).toEqual([review.id])
    expect(actionOrders(w, ceo)).toHaveLength(0)
    review.qcApproved = true
    expect(actionOrders(w, qc)).toHaveLength(0)
    expect(actionOrders(w, ceo).map((o) => o.id)).toEqual([review.id])
    review.statusId = 'done'
    expect(actionOrders(w, ceo)).toHaveLength(0)
    review.statusId = 'review'
    review.archived = true
    expect(actionOrders(w, ceo)).toHaveLength(0)
  })
  it('keeps real task readiness separate from schedules, logs, and a renamed role', () => {
    const w = seed(),
      role = w.roles.find((r) => r.id === 'documents')!
    role.name = 'Alya RN'
    w.logs.push({ id: 'specific', at: '2026-10-09T11:00:00Z', roleId: role.id, message: 'Profil diperbarui' })
    w.settings.workHours = true
    let s = roleSummary(w, role, new Date('2026-10-09T12:00:00Z'))
    expect(s.status).toBe('Di luar jam kerja')
    expect(s.actions).toHaveLength(1)
    expect(s.initials).toBe('AR')
    expect(s.last?.message).toBe('Profil diperbarui')
    s = roleSummary(w, role, new Date('2026-10-09T03:00:00Z'))
    expect(s.status).toBe('1 tugas perlu tindakan')
    expect(s.waiting).toBe(1)
    w.orders = []
    w.logs = []
    expect(roleSummary(w, role).last).toBeUndefined()
  })
  it('upgrades older layouts once without moving desks or changing role/order IDs', () => {
    const old = JSON.parse(JSON.stringify(seed()))
    delete old.settings.layoutVersion
    for (const desk of old.objects.filter((o: { type: string }) => o.type === 'desk')) {
      desk.rotation = 0
      old.roles.find((r: { id: string }) => r.id === desk.roleId).home = { x: desk.x, z: desk.z + 1.2 }
    }
    const upgraded = validateWorkspace(old)
    expect(upgraded.settings.layoutVersion).toBe(2)
    expect(upgraded.orders.map((o) => o.roleId)).toEqual(old.orders.map((o: { roleId: string }) => o.roleId))
    expect(upgraded.objects.map((o) => [o.x, o.z])).toEqual(
      old.objects.map((o: { x: number; z: number }) => [o.x, o.z]),
    )
    expect(layoutError(upgraded.objects, upgraded.roles)).toBeNull()
    expect(validateWorkspace(upgraded)).toEqual(upgraded)
  })
})
