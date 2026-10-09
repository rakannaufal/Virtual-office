export function dateInput(value: string, timezone: string): string {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const get = (name: string) => parts.find((p) => p.type === name)!.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
export function dateISO(value: string, timezone: string): string {
  if (!value) return ''
  if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) return new Date(value).toISOString()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw Error('Tanggal tidak valid.')
  const wall = Date.parse(value + ':00Z')
  if (!Number.isFinite(wall)) throw Error('Tanggal tidak valid.')
  let instant = wall
  for (let i = 0; i < 3; i++) {
    const displayed = Date.parse(dateInput(new Date(instant).toISOString(), timezone) + ':00Z')
    instant += wall - displayed
  }
  const iso = new Date(instant).toISOString()
  if (dateInput(iso, timezone) !== value) throw Error('Waktu tidak tersedia pada zona waktu ini.')
  return iso
}
