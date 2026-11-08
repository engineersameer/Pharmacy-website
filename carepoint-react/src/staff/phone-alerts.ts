import { useCallback, useEffect, useState } from 'react'
import { useStaffApi } from './staff-api'

// Phone alerts (web push): a new order reaches this device even when the browser is closed.
//
// 1. Turning on: the browser asks permission, then gets an address for this device at its
//    push service (Google, Apple or Mozilla) and we save that address on our server.
// 2. New order: our server sends a locked message to every saved address, and the push
//    service delivers it over the phone's always-on connection. public/sw.js shows it.

export type PhoneAlertState =
  | 'checking'
  | 'unsupported' // this browser can't receive push alerts
  | 'add-to-home-screen' // iPhone: only works from the Home Screen icon
  | 'server-off' // the server has no push keys
  | 'blocked' // notifications were refused in the browser settings
  | 'off'
  | 'busy'
  | 'on'

const isIPhone = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const fromHomeScreen = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** The server's public key is base64url text; the browser wants the raw bytes */
function keyBytes(key: string) {
  const text = atob((key + '='.repeat((4 - (key.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(text, (c) => c.charCodeAt(0))
}

export function usePhoneAlerts() {
  const api = useStaffApi()
  const [state, setState] = useState<PhoneAlertState>('checking')
  const [error, setError] = useState('')

  // Work out where this device stands. If alerts are already on, tell the server again,
  // so the device stays linked to whoever is logged in now.
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (!supported()) return setState(isIPhone() && !fromHomeScreen() ? 'add-to-home-screen' : 'unsupported')
      const { publicKey } = await api.pushKey()
      if (cancelled) return
      if (!publicKey) return setState('server-off')
      if (Notification.permission === 'denied') return setState('blocked')
      const registration = await navigator.serviceWorker.register('/sw.js')
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) await api.savePush(subscription.toJSON())
      if (!cancelled) setState(subscription ? 'on' : 'off')
    }
    check().catch(() => !cancelled && setState('off'))
    return () => {
      cancelled = true
    }
  }, [api])

  const turnOn = useCallback(async () => {
    setError('')
    setState('busy')
    try {
      // Ask first, straight from the button press (browsers require that)
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return setState(permission === 'denied' ? 'blocked' : 'off')
      const { publicKey } = await api.pushKey()
      if (!publicKey) return setState('server-off')
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      // Start fresh, in case an old address was made with different server keys
      await (await registration.pushManager.getSubscription())?.unsubscribe()
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true, // every push shows an alert; browsers require this
        applicationServerKey: keyBytes(publicKey),
      })
      const res = await api.savePush(subscription.toJSON())
      if (!res.ok) throw new Error('not saved')
      setState('on')
    } catch {
      setError('Could not turn on phone alerts. Check your internet and try again.')
      setState('off')
    }
  }, [api])

  /** Stop alerts on this device (also used when logging out) */
  const turnOff = useCallback(async () => {
    if (!supported()) return
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) {
      await api.removePush(subscription.endpoint).catch(() => undefined)
      await subscription.unsubscribe()
    }
    setState((s) => (s === 'on' || s === 'busy' ? 'off' : s))
  }, [api])

  return { state, error, turnOn, turnOff }
}
