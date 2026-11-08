import { useCallback, useEffect, useRef, useState } from 'react'
import type { StaffOrder } from './types'

// New-order alerts: a chime that repeats until staff accept the order, and an optional
// desktop notification. Browsers only allow sound after the person clicks something, so
// staff turn alerts on once.

const KEY = 'carepoint-staff-alerts'

/** One round of the alarm: four soft bell notes rising (E major), then a short rest.
 *  Drawn once into a sound clip, then played on a loop so it never has gaps, even when
 *  the browser slows down timers in a background tab. */
let chime: Promise<AudioBuffer> | null = null
function makeChime(sampleRate: number) {
  const seconds = 2.4
  const ctx = new OfflineAudioContext(1, Math.ceil(sampleRate * seconds), sampleRate)
  ;[659.25, 830.61, 987.77, 1318.51].forEach((freq, i) => {
    const t = i * 0.16
    // The note plus a quieter overtone, so it sounds like a bell rather than a beep
    for (const [mult, level] of [[1, 0.2], [2, 0.05]]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq * mult
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(level, t + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 1.15)
    }
  })
  return ctx.startRendering()
}

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
  const ringing = useRef(false) // a new order is waiting to be accepted
  const enabledNow = useRef(enabled)
  const loop = useRef<{ source: AudioBufferSourceNode; gain: GainNode } | null>(null)

  /** Start or stop the looping alarm so it matches: ringing, alerts on, and sound allowed */
  const syncAlarm = useCallback(async () => {
    const ctx = audio.current
    const shouldPlay = ringing.current && enabledNow.current && ctx?.state === 'running'
    if (shouldPlay && !loop.current) {
      chime ??= makeChime(ctx.sampleRate)
      const buffer = await chime
      if (!ringing.current || loop.current) return // stopped or started while it was being made
      const source = ctx.createBufferSource()
      const gain = ctx.createGain()
      source.buffer = buffer
      source.loop = true
      source.connect(gain).connect(ctx.destination)
      source.start()
      loop.current = { source, gain }
    } else if (!shouldPlay && loop.current) {
      const { source, gain } = loop.current
      loop.current = null
      const now = source.context.currentTime
      gain.gain.setTargetAtTime(0, now, 0.05) // fade out instead of a hard cut
      source.stop(now + 0.3)
    }
  }, [])

  useEffect(() => {
    enabledNow.current = enabled
    void syncAlarm()
  }, [enabled, syncAlarm])

  // Browsers keep sound off after every page load until the person clicks the page.
  // soundReady tells the page whether to ask for that click.
  const [soundReady, setSoundReady] = useState(false)
  const unlock = useCallback(async () => {
    if (!audio.current) {
      const ctx = new AudioContext()
      ctx.onstatechange = () => setSoundReady(ctx.state === 'running')
      audio.current = ctx
    }
    await audio.current.resume()
    setSoundReady(audio.current.state === 'running')
    void syncAlarm() // starts ringing now if an order is already waiting
  }, [syncAlarm])

  // While alerts are on but sound is still blocked, the next click anywhere turns it on
  useEffect(() => {
    if (!enabled || soundReady) return
    const wake = () => void unlock()
    window.addEventListener('pointerdown', wake)
    window.addEventListener('keydown', wake)
    return () => {
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [enabled, soundReady, unlock])

  /** Ring until it is switched off again (true while a new order waits to be accepted) */
  const setAlarm = useCallback(
    (on: boolean) => {
      ringing.current = on
      void syncAlarm()
    },
    [syncAlarm],
  )

  const toggle = useCallback(async () => {
    const next = !enabled
    setEnabled(next)
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off')
    } catch {
      // storage blocked: still works for this visit
    }
    if (next) {
      await unlock()
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
    }
  }, [enabled, unlock])

  // The sound itself comes from setAlarm; this adds a desktop notification when the tab is in the background
  const announce = useCallback(
    (orders: StaffOrder[]) => {
      if (!enabled || orders.length === 0) return
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        const first = orders[0]
        new Notification(orders.length === 1 ? `New order #${first.id}` : `${orders.length} new orders`, {
          body: orders.length === 1 ? `${first.customerName} · ${first.method === 'delivery' ? 'Delivery' : 'Pickup'}` : 'Open CarePoint Staff to see them.',
          tag: 'carepoint-new-order',
          requireInteraction: true, // stays on screen until clicked
        })
      }
    },
    [enabled],
  )

  return { enabled, soundReady, enableSound: unlock, toggle, announce, setAlarm }
}
