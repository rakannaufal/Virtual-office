import type { Furniture, Vec2, Workspace } from '../lib/types'

export interface Rect {
  x: number
  z: number
  w: number
  d: number
}
export const walls: Rect[] = [
  { x: -2.8, z: -5.45, w: 0.16, d: 2.9 },
  { x: -2.8, z: -1.25, w: 0.16, d: 1.5 },
  { x: -6.4, z: -0.5, w: 7.2, d: 0.16 },
]
export function footprint(o: Furniture): Rect {
  const sizes = {
    desk: [o.roleId === 'ceo' ? 3.2 : 2.5, 1.25],
    plant: [0.65, 0.65],
    sofa: [3.2, 1.25],
    coffee: [2.4, 0.9],
    shelf: [0.65, 2],
    art: [0.15, 0.15],
  }
  let [w, d] = sizes[o.type]
  if (Math.abs(Math.sin(o.rotation)) > 0.7) [w, d] = [d, w]
  return { x: o.x, z: o.z, w, d }
}
export function contains(p: Vec2, r: Rect, margin = 0.3): boolean {
  return Math.abs(p.x - r.x) < r.w / 2 + margin && Math.abs(p.z - r.z) < r.d / 2 + margin
}
export function walkable(p: Vec2, objects: Furniture[]): boolean {
  return (
    Math.abs(p.x) <= 9.5 &&
    Math.abs(p.z) <= 6.5 &&
    ![...walls, ...objects.filter((o) => o.type !== 'art').map(footprint)].some((r) => contains(p, r))
  )
}
export function layoutError(objects: Furniture[], roles: Workspace['roles']): string | null {
  for (let i = 0; i < objects.length; i++) {
    const o = objects[i],
      a = footprint(o)
    if (Math.abs(o.x) + a.w / 2 > 9.8 || Math.abs(o.z) + a.d / 2 > 6.8) return 'Objek keluar dari lantai.'
    if (
      walls.some(
        (b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 0.1 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + 0.1,
      )
    )
      return 'Objek menabrak partisi.'
    if (
      objects.slice(i + 1).some((ob) => {
        const b = footprint(ob)
        return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 0.1 && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + 0.1
      })
    )
      return 'Objek saling bertumpuk.'
  }
  for (const r of roles.filter((r) => r.active)) {
    if (!walkable(r.home, objects) || !findPath(r.home, { x: -1.5, z: 0 }, objects).length)
      return `Akses meja ${r.title} terhalang.`
  }
  const ceo = roles.find((r) => r.kind === 'ceo')
  if (ceo && !findPath(ceo.home, { x: -8, z: 4.25 }, objects).length)
    return 'Akses pintu CEO atau sudut kopi terhalang.'
  return null
}
const STEP = 0.35,
  MIN_X = -9.45,
  MIN_Z = -6.3,
  NX = 55,
  NZ = 37
const toPoint = (n: number): Vec2 => ({ x: MIN_X + (n % NX) * STEP, z: MIN_Z + Math.floor(n / NX) * STEP })
const nearest = (p: Vec2): number =>
  Math.max(0, Math.min(NZ - 1, Math.round((p.z - MIN_Z) / STEP))) * NX +
  Math.max(0, Math.min(NX - 1, Math.round((p.x - MIN_X) / STEP)))
export function findPath(from: Vec2, to: Vec2, objects: Furniture[]): Vec2[] {
  if (!walkable(to, objects)) return []
  const goal = nearest(to),
    start = nearest(from)
  const open = new Set([start]),
    previous = new Map<number, number>(),
    g = new Map([[start, 0]]),
    f = new Map([[start, distance(from, to)]])
  const clear = (n: number) => n >= 0 && n < NX * NZ && walkable(toPoint(n), objects)
  if (!clear(goal)) return []
  while (open.size) {
    let current = -1,
      best = Infinity
    for (const n of open)
      if ((f.get(n) ?? Infinity) < best) {
        current = n
        best = f.get(n)!
      }
    if (current === goal) {
      const path: Vec2[] = [to]
      let node = current
      while (previous.has(node)) {
        path.unshift(toPoint(node))
        node = previous.get(node)!
      }
      return path
    }
    open.delete(current)
    const x = current % NX,
      z = Math.floor(current / NX)
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      if (x + dx < 0 || x + dx >= NX || z + dz < 0 || z + dz >= NZ) continue
      const n = current + dz * NX + dx
      if (!clear(n) || (dx && dz && (!clear(current + dx) || !clear(current + dz * NX)))) continue
      const cost = (g.get(current) ?? Infinity) + Math.hypot(dx, dz) * STEP
      if (cost < (g.get(n) ?? Infinity)) {
        previous.set(n, current)
        g.set(n, cost)
        f.set(n, cost + distance(toPoint(n), to))
        open.add(n)
      }
    }
  }
  return []
}
export const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z)
