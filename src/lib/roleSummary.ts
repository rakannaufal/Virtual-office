import type { Order, Role, Workspace } from './types'
import { money } from './types'
import { phaseOf } from './domain'
import { onDuty } from '../scene/routines'

export function roleOrders(w: Workspace, role: Role): Order[] {
  return w.orders.filter(
    (o) =>
      !o.archived &&
      (['ceo', 'admin'].includes(role.kind) ||
        (role.kind === 'quality' && ['review', 'revision'].includes(phaseOf(w, o))) ||
        o.roleId === role.id),
  )
}
export function actionOrders(w: Workspace, role: Role): Order[] {
  return roleOrders(w, role)
    .filter((o) => {
      const phase = phaseOf(w, o)
      if (role.kind === 'ceo') return phase === 'review' && o.qcApproved && !o.ceoApproved
      if (role.kind === 'quality') return phase === 'review' && !o.qcApproved
      if (role.kind === 'admin') return phase === 'new'
      return o.roleId === role.id && ['working', 'revision'].includes(phase)
    })
    .sort(
      (a, b) =>
        Number(b.priority === 'high') - Number(a.priority === 'high') ||
        (a.due ? Date.parse(a.due) : Infinity) - (b.due ? Date.parse(b.due) : Infinity),
    )
}
export function roleSummary(w: Workspace, role: Role, now = new Date()) {
  const orders = roleOrders(w, role),
    actions = actionOrders(w, role)
  const pending = orders.filter((o) => phaseOf(w, o) !== 'done')
  const waiting = pending.filter((o) => phaseOf(w, o) === 'waiting').length
  const overdue = pending.filter((o) => o.due && Date.parse(o.due) < now.getTime()).length
  const due = pending.filter((o) => o.due).sort((a, b) => Date.parse(a.due) - Date.parse(b.due))[0]?.due ?? ''
  const leads = w.leads.filter((l) => l.stage !== 'customer').length
  const ready = role.active && onDuty(w, now)
  const status = !role.active
    ? 'Role nonaktif'
    : !ready
      ? 'Di luar jam kerja'
      : actions.length
        ? `${actions.length} tugas perlu tindakan`
        : role.kind === 'marketing' && leads
          ? `${leads} calon pelanggan untuk ditinjau`
          : pending.length
            ? 'Menunggu tahap berikutnya'
            : 'Siap membantu'
  const logs = w.logs
    .filter((l) => l.roleId === role.id || orders.some((o) => o.id === l.orderId))
    .map((l) => ({ message: l.message, at: l.at }))
  // A shared order event is a related record, not a claim that this avatar performed it.
  if (!logs.length)
    for (const order of orders)
      logs.push({ message: `Pesanan diperbarui: ${order.title}`, at: order.updatedAt })
  if (role.kind === 'marketing')
    for (const campaign of w.campaigns)
      logs.push({ message: `Draf tersedia: ${campaign.title}`, at: campaign.createdAt })
  logs.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const metrics =
    role.kind === 'ceo'
      ? [
          { label: 'Persetujuan akhir', value: String(actions.length) },
          { label: 'Pemasukan tercatat', value: money(w.orders.reduce((sum, o) => sum + o.paid, 0)) },
        ]
      : role.kind === 'quality'
        ? [
            { label: 'Menunggu QC', value: String(actions.length) },
            {
              label: 'Revisi terkait',
              value: String(orders.filter((o) => phaseOf(w, o) === 'revision').length),
            },
          ]
        : role.kind === 'admin'
          ? [
              { label: 'Pesanan baru', value: String(actions.length) },
              { label: 'Menunggu bahan', value: String(waiting) },
            ]
          : role.kind === 'marketing'
            ? [
                { label: 'Calon pelanggan', value: String(leads) },
                { label: 'Draf promosi', value: String(w.campaigns.length) },
              ]
            : [
                { label: 'Tugas aktif', value: String(pending.length) },
                {
                  label: 'File hasil',
                  value: String(
                    orders.reduce((sum, o) => sum + o.files.filter((f) => f.category === 'result').length, 0),
                  ),
                },
              ]
  return {
    role,
    status,
    ready,
    actions,
    orders,
    waiting,
    overdue,
    due,
    next: actions[0],
    last: logs[0],
    metrics,
    initials: role.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join('')
      .toUpperCase(),
  }
}
