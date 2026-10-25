import type { DayHours } from './types'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "21:30" → 21.5 */
const toHours = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h + m / 60
}

/** 21 → "9 pm", 8.5 → "8:30 am", 0 → "12 am" */
export function formatHour(h: number) {
  const hour = Math.floor(h) % 24
  const mins = Math.round((h - Math.floor(h)) * 60)
  const suffix = hour >= 12 ? 'pm' : 'am'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return mins ? `${h12}:${String(mins).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`
}

/** Open and close as numbers, or null if closed that day. close <= open means past midnight (equal = 24 hours). */
function span(d: DayHours | undefined) {
  if (!d || d.isClosed || !d.opensAt || !d.closesAt) return null
  const open = toHours(d.opensAt)
  const close = toHours(d.closesAt)
  return { open, close, allDay: open === close, overnight: close < open }
}

export function openStatus(hours: DayHours[], now = new Date()) {
  const day = now.getDay()
  const h = now.getHours() + now.getMinutes() / 60
  const today = span(hours.find((d) => d.day === day))
  const yesterday = span(hours.find((d) => d.day === (day + 6) % 7))

  if (today?.allDay) return { isOpen: true, label: 'Open 24 hours' }
  // Still open from last night (e.g. yesterday 9 am – 2 am, now 1 am)
  if (yesterday?.overnight && h < yesterday.close) return { isOpen: true, label: `Open now · until ${formatHour(yesterday.close)}` }
  if (today && h >= today.open && (today.overnight || h < today.close)) {
    return { isOpen: true, label: `Open now · until ${formatHour(today.close)}` }
  }

  // Closed: find the next opening, later today or on a following day
  for (let i = 0; i < 7; i++) {
    const w = span(hours.find((x) => x.day === (day + i) % 7))
    if (!w || (i === 0 && h >= w.open)) continue
    const when = i === 0 ? '' : i === 1 ? ' tomorrow' : ` ${DAY_NAMES[(day + i) % 7]}`
    return { isOpen: false, label: `Closed · opens${when} ${formatHour(w.open)}` }
  }
  return { isOpen: false, label: 'Closed' }
}

/** Text for one day's hours: "8 am – 9 pm", "9 am – 2 am", "Open 24 hours" or "Closed". */
export function hoursLabel(d: Pick<DayHours, 'opensAt' | 'closesAt' | 'isClosed'>) {
  const w = span({ day: 0, ...d })
  if (!w) return 'Closed'
  if (w.allDay) return 'Open 24 hours'
  return `${formatHour(w.open)} – ${formatHour(w.close)}`
}

/** Group days with the same hours: Mon – Fri, Saturday, Sunday */
export function groupHours(hours: DayHours[]) {
  const order = [1, 2, 3, 4, 5, 6, 0]
  const rows: { days: number[]; text: string }[] = []
  for (const day of order) {
    const d = hours.find((x) => x.day === day)
    if (!d) continue
    const text = hoursLabel(d)
    const last = rows[rows.length - 1]
    if (last && last.text === text) last.days.push(day)
    else rows.push({ days: [day], text })
  }
  return rows.map((r) => ({
    ...r,
    label:
      r.days.length === 1
        ? DAY_NAMES[r.days[0]]
        : `${DAY_NAMES[r.days[0]].slice(0, 3)} – ${DAY_NAMES[r.days[r.days.length - 1]].slice(0, 3)}`,
  }))
}
