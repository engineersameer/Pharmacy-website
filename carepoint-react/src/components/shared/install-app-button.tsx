import { Download, Share, SquarePlus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useInstallApp } from '@/lib/install-app'
import { cn } from '@/lib/utils'

/**
 * "Install app", the same on the customer site and the staff dashboard. Each side installs its
 * own app (the page's manifest decides which). Hidden when it is already installed, or when the
 * browser can't install apps.
 */
export function InstallAppButton({ appName, className }: { appName: string; className?: string }) {
  const { mode, install } = useInstallApp()
  const [showSteps, setShowSteps] = useState(false)

  if (mode === 'installed' || mode === 'none') return null

  return (
    <>
      <button
        type="button"
        onClick={() => (mode === 'prompt' ? void install() : setShowSteps(true))}
        className={cn(buttonVariants({ size: 'sm', variant: 'ghost' }), 'size-11 px-0 sm:w-auto sm:px-4', className)}
        aria-label={`Install the ${appName} app`}
        title={`Install the ${appName} app on this device`}
      >
        <Download />
        <span className="hidden sm:inline">Install app</span>
      </button>

      {/* iPhones have no install button for websites: show the steps instead */}
      <Dialog open={showSteps} onOpenChange={setShowSteps}>
        <DialogContent className="glass gap-4 bg-popover p-6 sm:max-w-sm">
          <DialogTitle className="text-xl">Install the {appName} app</DialogTitle>
          <DialogDescription>Add it to your Home Screen to open it like an app.</DialogDescription>
          <ol className="flex flex-col gap-3 text-[0.95rem]">
            <Step n={1}>
              Tap <Share className="mx-0.5 inline size-4 -translate-y-px text-primary" /> <b>Share</b> in Safari’s toolbar
            </Step>
            <Step n={2}>
              Scroll down and tap <SquarePlus className="mx-0.5 inline size-4 -translate-y-px text-primary" /> <b>Add to Home Screen</b>
            </Step>
            <Step n={3}>
              Tap <b>Add</b>, then open it from the new icon
            </Step>
          </ol>
          <button type="button" onClick={() => setShowSteps(false)} className={buttonVariants()}>
            Got it
          </button>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}
