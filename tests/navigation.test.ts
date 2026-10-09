import { describe, expect, it } from 'vitest'
import { seed } from '../src/lib/seed'
import { findPath, layoutError, walkable } from '../src/scene/navigation'
import { RoutineSystem, onDuty } from '../src/scene/routines'

describe('office navigation and routines', () => {
  it('routes CEO through the real doorway, never a wall or furniture', () => {
    const w = seed(),
      path = findPath(w.roles[0].home, { x: -8, z: 4.25 }, w.objects)
    expect(path.length).toBeGreaterThan(5)
    expect(path.every((p) => walkable(p, w.objects))).toBe(true)
    const crossings = path.slice(1).flatMap((p, i) => {
      const prev = path[i]
      if (p.x + 2.8 >= 0 === prev.x + 2.8 >= 0) return []
      const z = prev.z + ((p.z - prev.z) * (-2.8 - prev.x)) / (p.x - prev.x)
      return z < -0.5 ? [z] : []
    })
    expect(crossings.length).toBeGreaterThan(0)
    expect(crossings.every((z) => z > -3.8 && z < -2.2)).toBe(true)
    expect(findPath(w.roles[0].home, { x: -6.3, z: -4.5 }, w.objects)).toEqual([])
  })
  it('validates an initial layout and rejects blocked desks', () => {
    const w = seed()
    expect(layoutError(w.objects, w.roles)).toBeNull()
    w.objects.find((o) => o.id === 'plant1')!.x = w.roles[2].home.x
    w.objects.find((o) => o.id === 'plant1')!.z = w.roles[2].home.z
    expect(layoutError(w.objects, w.roles)).not.toBeNull()
  })
  it('reserves coffee for one avatar, interrupts leisure on ready task', () => {
    const w = seed()
    w.orders = []
    const system = new RoutineSystem(
      () => w,
      () => 0.2,
    )
    expect(system.leisure('documents', 'coffee')).toBe(true)
    expect(system.leisure('data', 'coffee')).toBe(false)
    const o = seed().orders[0]
    w.orders.push(o)
    system.step(0.1)
    expect(system.characters.get('documents')?.intent).toBe('home')
    expect(system.reservations.has('coffee')).toBe(false)
  })
  it('returns from a lounge seat without trapping the avatar inside furniture', () => {
    const w = seed()
    w.orders = []
    const system = new RoutineSystem(
      () => w,
      () => 0.2,
    )
    expect(system.leisure('documents', 'sofa1')).toBe(true)
    for (let n = 0; n < 600; n++) system.step(0.05)
    expect(system.home('documents')).toBe(true)
  })
  it('uses the configured timezone and breaks', () => {
    const w = seed()
    w.settings.workHours = true
    expect(onDuty(w, new Date('2026-10-09T03:00:00Z'))).toBe(true)
    expect(onDuty(w, new Date('2026-10-09T05:30:00Z'))).toBe(false)
    expect(onDuty(w, new Date('2026-10-10T03:00:00Z'))).toBe(false)
  })
})
