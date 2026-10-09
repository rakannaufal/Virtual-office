import { z } from 'zod'
import type { Order, Phase, Role, Workspace } from './types'
import { models } from './seed'

const text = z.string().max(12000),
  short = z.string().max(200),
  id = z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/)
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/),
  point = z.object({ x: z.number().min(-10).max(10), z: z.number().min(-7).max(7) })
const date = z.string().refine((v) => v === '' || !Number.isNaN(Date.parse(v)), 'Tanggal tidak valid')
export const workspaceSchema = z.object({
  version: z.literal(1),
  demo: z.boolean(),
  settings: z.object({
    layoutVersion: z.union([z.literal(1), z.literal(2)]).default(1),
    company: short.min(1),
    tagline: short,
    contact: short,
    logo: short.max(10),
    primary: color,
    accent: color,
    theme: z.enum(['light', 'dark']),
    quality: z.enum(['low', 'high']),
    labelSize: z.number().min(10).max(18),
    speed: z.number().min(0.5).max(3),
    reducedMotion: z.boolean(),
    animation: z.boolean(),
    coffee: z.boolean(),
    coffeeDuration: z.number().min(5).max(300),
    idleDuration: z.number().min(5).max(300),
    coffeeCooldown: z.number().min(10).max(1800),
    resting: z.boolean(),
    reading: z.boolean(),
    social: z.boolean(),
    workHours: z.boolean(),
    workStart: z.string().regex(/^\d{2}:\d{2}$/),
    workEnd: z.string().regex(/^\d{2}:\d{2}$/),
    workDays: z.array(z.number().int().min(0).max(6)).max(7),
    timezone: short.refine((v) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: v })
        return true
      } catch {
        return false
      }
    }, 'Zona waktu tidak valid'),
    breakStart: z.string().regex(/^\d{2}:\d{2}$/),
    breakDuration: z.number().min(0).max(240),
    autoCEO: z.boolean(),
    sound: z.boolean(),
    notifications: z.boolean(),
    requireApproval: z.boolean(),
    roomNames: z.object({ ceo: short, production: short, reception: short, lounge: short }),
  }),
  roles: z
    .array(
      z.object({
        id,
        name: short.min(1),
        title: short.min(1),
        kind: z.enum(['ceo', 'marketing', 'admin', 'documents', 'data', 'quality']),
        responsibility: text,
        model: z.string().refine((v) => models.includes(v)),
        skin: color,
        shirt: color,
        hair: color,
        active: z.boolean(),
        automatic: z.boolean(),
        home: point,
      }),
    )
    .min(1)
    .max(6),
  workflows: z
    .array(
      z.object({
        id,
        label: short.min(1),
        phase: z.enum(['new', 'working', 'waiting', 'review', 'revision', 'done']),
        color,
        active: z.boolean(),
      }),
    )
    .length(6),
  services: z
    .array(
      z.object({
        id,
        name: short.min(1),
        scope: text,
        price: z.number().min(0).max(1e10),
        revisions: z.number().int().min(0).max(100),
        active: z.boolean(),
        checklist: z.array(short.min(1)).max(50),
      }),
    )
    .max(100),
  orders: z
    .array(
      z.object({
        id,
        title: short.min(1),
        customer: short.min(1),
        contact: short,
        serviceId: id,
        roleId: id,
        statusId: id,
        priority: z.enum(['normal', 'high']),
        due: date,
        price: z.number().min(0).max(1e10),
        paid: z.number().min(0).max(1e10),
        notes: text,
        checklist: z.array(z.object({ id, label: short.min(1), done: z.boolean() })).max(50),
        revisions: z
          .array(z.object({ id, note: text.min(1), createdAt: date, resolved: z.boolean() }))
          .max(100),
        files: z
          .array(
            z.object({
              id,
              orderId: id,
              name: short,
              size: z
                .number()
                .min(0)
                .max(20 * 1024 * 1024),
              type: short,
              category: z.enum(['source', 'result']),
              path: z.string().max(500).optional(),
              backend: z.enum(['local', 'cloud']),
              createdAt: date,
            }),
          )
          .max(100),
        createdAt: date,
        updatedAt: date,
        archived: z.boolean(),
        qcApproved: z.boolean(),
        ceoApproved: z.boolean(),
      }),
    )
    .max(10000),
  objects: z
    .array(
      z.object({
        id,
        type: z.enum(['desk', 'plant', 'sofa', 'coffee', 'shelf', 'art']),
        roleId: id.optional(),
        x: z.number().min(-9.5).max(9.5),
        z: z.number().min(-6.5).max(6.5),
        rotation: z.number(),
        room: short,
        movable: z.boolean(),
      }),
    )
    .max(100),
  logs: z
    .array(z.object({ id, at: date, message: text, orderId: id.optional(), roleId: id.optional() }))
    .max(500),
  leads: z
    .array(
      z.object({
        id,
        name: short.min(1),
        business: short,
        contact: short,
        stage: z.enum(['new', 'contacted', 'interested', 'customer']),
        notes: text,
      }),
    )
    .max(10000),
  campaigns: z
    .array(z.object({ id, title: short.min(1), channel: short, body: text, createdAt: date }))
    .max(1000),
})
export function validateWorkspace(value: unknown): Workspace {
  const w = workspaceSchema.parse(value) as Workspace
  if (w.settings.layoutVersion !== 2) {
    // Preserve desk positions and stable role IDs when upgrading older backups.
    for (const desk of w.objects.filter((o) => o.type === 'desk')) {
      desk.rotation += Math.PI
      const role = w.roles.find((r) => r.id === desk.roleId)
      if (role)
        role.home = {
          x: desk.x + Math.sin(desk.rotation) * 1.2,
          z: desk.z + Math.cos(desk.rotation) * 1.2,
        }
    }
    w.settings.layoutVersion = 2
  }
  for (const list of [w.roles, w.services, w.workflows, w.orders, w.objects, w.leads, w.campaigns]) {
    if (new Set(list.map((x) => x.id)).size !== list.length) throw Error('ID duplikat pada cadangan.')
  }
  if (w.roles.filter((r) => r.kind === 'ceo' && r.active).length !== 1)
    throw Error('Harus ada tepat satu CEO aktif.')
  if (new Set(w.workflows.map((x) => x.phase)).size !== 6) throw Error('Enam tahapan wajib tersedia.')
  if (
    w.workflows.some((f) => ['new', 'working', 'review', 'revision', 'done'].includes(f.phase) && !f.active)
  )
    throw Error('Tahapan utama harus aktif.')
  const fileIds = w.orders.flatMap((o) => o.files.map((f) => f.id))
  if (new Set(fileIds).size !== fileIds.length) throw Error('ID file duplikat pada cadangan.')
  for (const o of w.orders) {
    if (
      !w.roles.some((r) => r.id === o.roleId) ||
      !w.services.some((s) => s.id === o.serviceId) ||
      !w.workflows.some((s) => s.id === o.statusId)
    )
      throw Error('Referensi pesanan tidak ditemukan.')
    if (o.files.some((f) => f.orderId !== o.id)) throw Error('Referensi file salah.')
    if (o.paid > o.price) throw Error('Pembayaran melebihi harga pesanan.')
  }
  return w
}
export function sameWorkspace(a: Workspace, b: Workspace): boolean {
  return JSON.stringify(validateWorkspace(a)) === JSON.stringify(validateWorkspace(b))
}
export const phaseOf = (w: Workspace, o: Order): Phase =>
  w.workflows.find((f) => f.id === o.statusId)?.phase ?? 'new'
export const isReady = (w: Workspace, r: Role): boolean =>
  w.orders.some(
    (o) =>
      !o.archived &&
      (r.kind === 'ceo'
        ? phaseOf(w, o) === 'review' && o.qcApproved && !o.ceoApproved
        : r.kind === 'quality'
          ? phaseOf(w, o) === 'review' && !o.qcApproved
          : r.kind === 'admin'
            ? phaseOf(w, o) === 'new'
            : o.roleId === r.id && ['working', 'revision'].includes(phaseOf(w, o))),
  )
export function transitionError(w: Workspace, o: Order, target: Phase): string | null {
  if (['review', 'done'].includes(target) && !o.checklist.every((c) => c.done))
    return 'Selesaikan semua checklist sebelum pemeriksaan.'
  if (target === 'done' && o.revisions.some((r) => !r.resolved)) return 'Selesaikan catatan revisi dahulu.'
  if (target === 'done' && !o.qcApproved) return 'Quality Control belum menyetujui hasil.'
  if (target === 'done' && w.settings.requireApproval && !o.ceoApproved)
    return 'CEO belum menyetujui hasil akhir.'
  if (target === 'done' && !o.files.some((f) => f.category === 'result'))
    return 'Unggah file hasil sebelum menyelesaikan pesanan.'
  return null
}
