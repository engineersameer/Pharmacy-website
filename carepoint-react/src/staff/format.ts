import type { OrderStatus } from './types'

export const STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'New',
  confirmed: 'Confirmed',
  ready: 'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

/** What the button says for moving an order to this status */
export const ACTION_LABEL: Record<OrderStatus, string> = {
  received: 'Mark as new',
  confirmed: 'Confirm order',
  ready: 'Mark ready for pickup',
  out_for_delivery: 'Send out for delivery',
  completed: 'Mark completed',
  cancelled: 'Cancel order',
}

export const STATUS_STYLE: Record<OrderStatus, string> = {
  received: 'bg-primary text-primary-foreground',
  confirmed: 'bg-secondary text-secondary-foreground',
  ready: 'bg-secondary text-secondary-foreground',
  out_for_delivery: 'bg-secondary text-secondary-foreground',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/12 text-destructive',
}

/** +923001234567 → 0300 1234567 */
export function localPhone(e164: string) {
  const d = e164.replace(/^\+92/, '0')
  return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4)}` : e164
}

/** +923001234567 → https://wa.me/923001234567 */
export const whatsappLink = (e164: string) => `https://wa.me/${e164.replace(/\D/g, '')}`

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "just now", "5 minutes ago", "yesterday" */
export function timeAgo(iso: string, now = Date.now()) {
  const secs = Math.round((new Date(iso).getTime() - now) / 1000)
  if (Math.abs(secs) < 45) return 'just now'
  const mins = Math.round(secs / 60)
  if (Math.abs(mins) < 60) return rtf.format(mins, 'minute')
  const hours = Math.round(mins / 60)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  return rtf.format(Math.round(hours / 24), 'day')
}

export const fullTime = (iso: string) =>
  new Date(iso).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
