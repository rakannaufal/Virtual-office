import { describe, expect, it } from 'vitest'
import { dateInput, dateISO } from '../src/lib/dates'

describe('business timezone deadlines', () => {
  it('converts wall time to an unambiguous instant independent of browser timezone', () => {
    expect(dateISO('2026-10-09T09:00', 'Asia/Jakarta')).toBe('2026-10-09T02:00:00.000Z')
    expect(dateISO('2026-10-09T09:00', 'Asia/Jayapura')).toBe('2026-10-09T00:00:00.000Z')
    expect(dateInput('2026-10-09T02:00:00Z', 'Asia/Makassar')).toBe('2026-10-09T10:00')
  })
  it('rejects malformed dates and keeps empty deadlines empty', () => {
    expect(dateISO('', 'UTC')).toBe('')
    expect(() => dateISO('nonsense', 'UTC')).toThrow()
  })
})
