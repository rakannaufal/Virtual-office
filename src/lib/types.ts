export type RoleKind = 'ceo' | 'marketing' | 'admin' | 'documents' | 'data' | 'quality'
export type Phase = 'new' | 'working' | 'waiting' | 'review' | 'revision' | 'done'
export type ActivityState = 'idle' | 'walking' | 'working' | 'coffee' | 'resting' | 'reading' | 'off'
export type Vec2 = { x: number; z: number }

export interface Role {
  id: string
  name: string
  title: string
  kind: RoleKind
  responsibility: string
  model: string
  skin: string
  shirt: string
  hair: string
  active: boolean
  automatic: boolean
  home: Vec2
}
export interface Settings {
  layoutVersion: 2
  company: string
  tagline: string
  contact: string
  logo: string
  primary: string
  accent: string
  theme: 'light' | 'dark'
  quality: 'low' | 'high'
  labelSize: number
  speed: number
  reducedMotion: boolean
  animation: boolean
  coffee: boolean
  coffeeDuration: number
  idleDuration: number
  coffeeCooldown: number
  resting: boolean
  reading: boolean
  social: boolean
  workHours: boolean
  workStart: string
  workEnd: string
  workDays: number[]
  timezone: string
  breakStart: string
  breakDuration: number
  autoCEO: boolean
  sound: boolean
  notifications: boolean
  requireApproval: boolean
  roomNames: { ceo: string; production: string; reception: string; lounge: string }
}
export interface Workflow {
  id: string
  label: string
  phase: Phase
  color: string
  active: boolean
}
export interface Service {
  id: string
  name: string
  scope: string
  price: number
  revisions: number
  active: boolean
  checklist: string[]
}
export interface ChecklistItem {
  id: string
  label: string
  done: boolean
}
export interface Revision {
  id: string
  note: string
  createdAt: string
  resolved: boolean
}
export interface FileRecord {
  id: string
  orderId: string
  name: string
  size: number
  type: string
  category: 'source' | 'result'
  path?: string
  backend: 'local' | 'cloud'
  createdAt: string
}
export interface Order {
  id: string
  title: string
  customer: string
  contact: string
  serviceId: string
  roleId: string
  statusId: string
  priority: 'normal' | 'high'
  due: string
  price: number
  paid: number
  notes: string
  checklist: ChecklistItem[]
  revisions: Revision[]
  files: FileRecord[]
  createdAt: string
  updatedAt: string
  archived: boolean
  qcApproved: boolean
  ceoApproved: boolean
}
export interface Furniture {
  id: string
  type: 'desk' | 'plant' | 'sofa' | 'coffee' | 'shelf' | 'art'
  roleId?: string
  x: number
  z: number
  rotation: number
  room: string
  movable: boolean
}
export interface Log {
  id: string
  at: string
  message: string
  orderId?: string
  roleId?: string
}
export interface Lead {
  id: string
  name: string
  business: string
  contact: string
  stage: 'new' | 'contacted' | 'interested' | 'customer'
  notes: string
}
export interface Campaign {
  id: string
  title: string
  channel: string
  body: string
  createdAt: string
}
export interface Workspace {
  version: 1
  settings: Settings
  roles: Role[]
  workflows: Workflow[]
  services: Service[]
  orders: Order[]
  objects: Furniture[]
  logs: Log[]
  leads: Lead[]
  campaigns: Campaign[]
  demo: boolean
}
export interface CharacterRuntime {
  id: string
  position: Vec2
  state: ActivityState
  destination?: Vec2
  path: Vec2[]
  elapsed: number
  nextChange: number
  seat?: string
  intent?: 'home' | 'coffee' | 'rest' | 'read'
  lastCoffee: number
}
export const uid = (prefix = 'id') => `${prefix}_${crypto.randomUUID()}`
export const money = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    value,
  )
export const prettyDate = (value: string, timezone = 'Asia/Jakarta') =>
  value
    ? new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
      }).format(new Date(value))
    : '-'
