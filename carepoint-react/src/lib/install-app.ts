import { useSyncExternalStore } from 'react'

// "Install app" for both the customer site and the staff dashboard.
//
// Chrome, Edge and Samsung Internet fire `beforeinstallprompt` once the page can be installed.
// We keep that event and show our own "Install app" button, because the browser's own pop-up
// only shows now and then. iPhones never fire it: there, people install with
// Share → Add to Home Screen, so the button shows those steps instead.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** installed: opened from the Home Screen icon (or just installed). prompt: the browser can install
 *  it now. ios: an iPhone that can add it to the Home Screen by hand. none: this browser can't. */
export type InstallMode = 'installed' | 'prompt' | 'ios' | 'none'

let deferred: InstallPromptEvent | null = null
let justInstalled = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

const isIPhone = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const openedAsApp = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

/** Call once at startup: the browser can send its install offer before React has drawn anything */
export function listenForInstallOffer() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // we show our own button instead of the browser's pop-up
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    justInstalled = true
    notify()
  })
}

function currentMode(): InstallMode {
  if (justInstalled || openedAsApp()) return 'installed'
  if (deferred) return 'prompt'
  if (isIPhone()) return 'ios'
  return 'none'
}

/** Open the browser's install window. Only works while the mode is 'prompt'. */
async function install() {
  const offer = deferred
  if (!offer) return
  await offer.prompt()
  await offer.userChoice
  deferred = null // each offer can be used once; the browser sends a new one if needed
  notify()
}

export function useInstallApp() {
  const mode = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    currentMode,
  )
  return { mode, install }
}
