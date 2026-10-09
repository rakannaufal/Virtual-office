import type { ActivityState, CharacterRuntime, Role, Vec2, Workspace } from '../lib/types'
import { isReady } from '../lib/domain'
import { distance, findPath } from './navigation'

export const activities: Record<ActivityState, string> = {
  idle: 'Siap',
  walking: 'Berjalan',
  working: 'Di meja kerja',
  coffee: 'Ngopi',
  resting: 'Santai',
  reading: 'Membaca',
  off: 'Di luar jam kerja',
}
export const seats: Record<string, { position: Vec2; activity: ActivityState }> = {
  coffee: { position: { x: -8, z: 4.25 }, activity: 'coffee' },
  sofa1: { position: { x: -7.25, z: 2.45 }, activity: 'resting' },
  sofa2: { position: { x: -5.7, z: 2.45 }, activity: 'reading' },
}
export function onDuty(w: Workspace, now: Date): boolean {
  if (!w.settings.workHours) return true
  const s = w.settings,
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: s.timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now)
  const get = (n: string) => parts.find((p) => p.type === n)!.value
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  const minutes = Number(get('hour')) * 60 + Number(get('minute')),
    parse = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3))
  const start = parse(s.workStart),
    end = parse(s.workEnd),
    inWindow = start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end
  const breakStart = parse(s.breakStart),
    inBreak = (minutes - breakStart + 1440) % 1440 < s.breakDuration
  return s.workDays.includes(weekday) && inWindow && !inBreak
}
export class RoutineSystem {
  characters = new Map<string, CharacterRuntime>()
  reservations = new Map<string, string>()
  clock = 0
  constructor(
    private getWorkspace: () => Workspace,
    private random: () => number = Math.random,
  ) {
    this.reconcile()
  }
  reconcile() {
    const w = this.getWorkspace()
    for (const role of w.roles.filter((r) => r.active))
      if (!this.characters.has(role.id))
        this.characters.set(role.id, {
          id: role.id,
          position: { ...role.home },
          state: 'idle',
          path: [],
          elapsed: 0,
          nextChange: 8 + this.random() * 18,
          lastCoffee: -999,
        })
    for (const [id] of this.characters)
      if (!w.roles.some((r) => r.id === id && r.active)) {
        this.release(id)
        this.characters.delete(id)
      }
  }
  release(id: string) {
    const c = this.characters.get(id)
    if (c?.seat) this.reservations.delete(c.seat)
    if (c) c.seat = undefined
  }
  go(id: string, point: Vec2, intent?: CharacterRuntime['intent']) {
    const w = this.getWorkspace(),
      c = this.characters.get(id)
    if (!c) return false
    let target = point
    // Lounge seats lie inside the sofa footprint; navigate to the clear aisle first.
    if (intent === 'rest' || intent === 'read') target = { x: point.x, z: 3.25 }
    const path = findPath(c.position, target, w.objects)
    if (!path.length) return false
    c.path = path
    c.destination = point
    c.intent = intent
    c.state = 'walking'
    c.elapsed = 0
    return true
  }
  moveCEO(point: Vec2) {
    const r = this.getWorkspace().roles.find((r) => r.kind === 'ceo')!
    this.release(r.id)
    return this.go(r.id, point)
  }
  home(id: string) {
    const role = this.getWorkspace().roles.find((r) => r.id === id)
    if (!role) return false
    this.release(id)
    return this.go(id, role.home, 'home')
  }
  leisure(id: string, key: string): boolean {
    if (this.reservations.has(key)) return false
    const c = this.characters.get(id),
      seat = seats[key]
    if (!c || !seat) return false
    this.release(id)
    const intent = key === 'coffee' ? 'coffee' : key === 'sofa1' ? 'rest' : 'read'
    if (!this.go(id, seat.position, intent)) return false
    this.reservations.set(key, id)
    c.seat = key
    return true
  }
  step(dt: number, now = new Date(), reducedMotion = false) {
    this.clock += dt
    this.reconcile()
    const w = this.getWorkspace(),
      duty = onDuty(w, now)
    for (const r of w.roles.filter((r) => r.active)) {
      const c = this.characters.get(r.id)!,
        automatic = r.kind === 'ceo' ? w.settings.autoCEO : r.automatic
      const ready = duty && isReady(w, r)
      c.elapsed += dt
      if (
        automatic &&
        ready &&
        c.intent !== 'home' &&
        (c.state !== 'working' || distance(c.position, r.home) > 0.1)
      )
        this.home(r.id)
      if (c.state === 'walking') {
        const next = c.path[0]
        if (next) {
          const dist = distance(c.position, next),
            amount = Math.min(dist, dt * w.settings.speed)
          if (dist > 0.001) {
            c.position.x += ((next.x - c.position.x) / dist) * amount
            c.position.z += ((next.z - c.position.z) / dist) * amount
          }
          if (dist < 0.06 || amount === dist) c.path.shift()
        } else {
          c.state =
            c.intent === 'coffee'
              ? 'coffee'
              : c.intent === 'rest'
                ? 'resting'
                : c.intent === 'read'
                  ? 'reading'
                  : ready
                    ? 'working'
                    : 'idle'
          if (c.state === 'coffee') c.lastCoffee = this.clock
          c.elapsed = 0
          c.nextChange = w.settings.coffeeDuration
          c.intent = undefined
        }
        continue
      }
      if (automatic && ready) {
        c.state = 'working'
        continue
      }
      if (c.state === 'working') {
        c.state = 'idle'
        c.elapsed = 0
      }
      if (!automatic) continue
      if (['coffee', 'resting', 'reading'].includes(c.state)) {
        if (c.elapsed > c.nextChange) this.home(r.id)
        continue
      }
      c.state = duty ? 'idle' : 'off'
      if (c.elapsed > c.nextChange && w.settings.animation && !w.settings.reducedMotion && !reducedMotion) {
        const available = [
          w.settings.coffee && this.clock - c.lastCoffee > w.settings.coffeeCooldown ? 'coffee' : '',
          w.settings.resting ? 'sofa1' : '',
          w.settings.reading ? 'sofa2' : '',
        ]
          .filter(Boolean)
          .filter((key) => !this.reservations.has(key))
        if (available.length) this.leisure(r.id, available[Math.floor(this.random() * available.length)])
        c.elapsed = 0
        c.nextChange = w.settings.idleDuration + this.random() * 12
      }
    }
  }
}
