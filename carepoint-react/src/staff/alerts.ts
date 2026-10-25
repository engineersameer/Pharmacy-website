import { useCallback, useEffect, useRef, useState } from 'react'
import type { StaffOrder } from './types'

// New-order alerts: a short "ding" and an optional desktop notification.
// Browsers only allow sound after the person clicks something, so staff turn alerts on once.

const KEY = 'carepoint-staff-alerts'

function readPref() {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

export function useOrderAlerts() {
  const [enabled, setEnabled] = useState(readPref)
  const audio = useRef<AudioContext | null>(null)

  // If alerts were on last time, the sound wakes up on the first click anywhere
  useEffect(() => {
    if (!enabled) return
    const wake = () => {
      audio.current ??= new AudioContext()
      void audio.current.resume()
    }
    window.addEventListener('pointerdown', wake, { once: true })
    return () => window.removeEventListener('pointerdown', wake)
  }, [enabled])

  const toggle = useCallback(async () => {
    const next = !enabled
    setEnabled(next)
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off')
    } catch {
      // storage blocked: still works for this visit
    }
    if (next) {
      audio.current ??= new AudioContext()
      await audio.current.resume()
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
    }
  }, [enabled])

  const ding = useCallback(() => {
    const ctx = audio.current
    if (!ctx || ctx.state !== 'running') return
    // Two soft notes, like a shop doorbell
    ;[880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const t = ctx.currentTime + i * 0.18
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.55)
    })
  }, [])

  const announce = useCallback(
    (orders: StaffOrder[]) => {
      if (!enabled || orders.length === 0) return
      ding()
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        const first = orders[0]
        new Notification(orders.length === 1 ? `New order #${first.id}` : `${orders.length} new orders`, {
          body: orders.length === 1 ? `${first.customerName} · ${first.method === 'delivery' ? 'Delivery' : 'Pickup'}` : 'Open CarePoint Staff to see them.',
          tag: 'carepoint-new-order',
        })
      }
    },
    [enabled, ding],
  )

  return { enabled, toggle, announce }
}
