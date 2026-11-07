import { Check, Download, ExternalLink, FileText, ImageOff, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { fullTime, localPhone } from '../format'
import { useStaffApi } from '../staff-api'
import type { PrescriptionResult, StaffPrescription } from '../types'

/** Loads a private prescription file with the login token and gives back a temporary local URL. */
function useFileUrl(p: StaffPrescription) {
  const api = useStaffApi()
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    api
      .prescriptionFile(p.fileUrl)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl) // free the memory when no longer shown
    }
  }, [api, p.fileUrl])

  return { url, failed }
}

/** Prescriptions attached to the order. With onRemove, each one gets a Remove button. */
export function PrescriptionFiles({
  prescriptions,
  onRemove,
  removing,
}: {
  prescriptions: StaffPrescription[]
  onRemove?: (p: StaffPrescription) => void
  removing?: boolean
}) {
  const [open, setOpen] = useState<StaffPrescription | null>(null)
  if (prescriptions.length === 0) return null
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {prescriptions.map((p) => (
          <li key={p.id}>
            <FileTile
              p={p}
              onOpen={() => setOpen(p)}
              footer={
                onRemove && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-9 w-full hover:border-destructive hover:text-destructive"
                    onClick={() => onRemove(p)}
                    disabled={removing}
                  >
                    <Trash2 /> Remove
                  </Button>
                )
              }
            />
          </li>
        ))}
      </ul>
      <BigViewDialog p={open} onClose={() => setOpen(null)} />
    </>
  )
}

/** Search results to review before attaching: photo, where it was used, and an Attach button. */
export function PrescriptionResults({
  results,
  attachedIds,
  onAttach,
  attaching,
}: {
  results: PrescriptionResult[]
  attachedIds: Set<number>
  onAttach: (p: PrescriptionResult) => void
  attaching?: boolean
}) {
  const [open, setOpen] = useState<StaffPrescription | null>(null)
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2">
        {results.map((p) => (
          <li key={p.id}>
            <FileTile
              p={p}
              onOpen={() => setOpen(p)}
              footer={
                <>
                  <p className="mt-1 text-xs text-muted-foreground">Uploaded {fullTime(p.createdAt)}</p>
                  {p.usedIn.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-xs break-words text-muted-foreground">
                      {p.usedIn.map((u) => (
                        <li key={u.orderId}>
                          <span className="font-medium text-foreground">Order #{u.orderId}</span> · {u.customerName} ·{' '}
                          {localPhone(u.customerPhone)}
                        </li>
                      ))}
                    </ul>
                  )}
                  {attachedIds.has(p.id) ? (
                    <p className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 text-sm font-medium text-primary">
                      <Check className="size-4" /> On this order
                    </p>
                  ) : (
                    <Button size="sm" className="mt-2 h-9 w-full" onClick={() => onAttach(p)} disabled={attaching}>
                      <Plus /> Attach
                    </Button>
                  )}
                </>
              }
            />
          </li>
        ))}
      </ul>
      <BigViewDialog p={open} onClose={() => setOpen(null)} />
    </>
  )
}

function FileTile({ p, onOpen, footer }: { p: StaffPrescription; onOpen: () => void; footer?: ReactNode }) {
  const { url, failed } = useFileUrl(p)
  const [broken, setBroken] = useState(false) // e.g. iPhone HEIC photos many browsers can't show

  return (
    <div className="overflow-hidden rounded-xl border border-glass-border bg-popover">
      <button type="button" onClick={onOpen} className="block aspect-[3/4] w-full" aria-label={`View prescription ${p.number}`} title="Click to view full size">
        {p.fileType === 'pdf' ? (
          <span className="grid size-full place-items-center text-primary">
            <FileText className="size-10" />
          </span>
        ) : url && !broken ? (
          <img src={url} alt={`Prescription ${p.number}`} onError={() => setBroken(true)} className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-xs text-muted-foreground">
            {failed || broken ? <ImageOff className="size-7" /> : 'Loading…'}
          </span>
        )}
      </button>
      <div className="px-3 py-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold tracking-wider">No. {p.number}</span>
          {url && (
            <a href={url} download={`prescription-${p.number}`} className="text-muted-foreground hover:text-primary" aria-label="Download">
              <Download className="size-4" />
            </a>
          )}
        </div>
        {footer}
      </div>
    </div>
  )
}

function BigViewDialog({ p, onClose }: { p: StaffPrescription | null; onClose: () => void }) {
  return (
    <Dialog open={!!p} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass max-h-[92svh] gap-3 bg-popover p-4 sm:max-w-3xl">{p && <BigView p={p} />}</DialogContent>
    </Dialog>
  )
}

function BigView({ p }: { p: StaffPrescription }) {
  const { url, failed } = useFileUrl(p)
  const [broken, setBroken] = useState(false)
  return (
    <>
      <DialogTitle className="pr-12 text-lg">Prescription {p.number}</DialogTitle>
      <div className="grid min-h-[50svh] place-items-center overflow-auto rounded-xl bg-black/30">
        {p.fileType === 'pdf' || broken ? (
          <p className="p-8 text-center text-muted-foreground">
            {p.fileType === 'pdf' ? 'This is a PDF.' : "This photo type can't be shown in the browser."} Download it to view.
          </p>
        ) : url ? (
          <img src={url} alt={`Prescription ${p.number}`} onError={() => setBroken(true)} className="max-h-[75svh] w-auto object-contain" />
        ) : (
          <p className="text-muted-foreground">{failed ? 'Could not load this file.' : 'Loading…'}</p>
        )}
      </div>
      {url && (
        <div className="flex flex-wrap gap-2">
          <a href={url} download={`prescription-${p.number}`} className={buttonVariants({ size: 'sm' })}>
            <Download /> Download
          </a>
          {p.fileType === 'image' && (
            <a href={url} target="_blank" rel="noreferrer" className={cn(buttonVariants({ size: 'sm', variant: 'ghost' }))}>
              <ExternalLink /> Open full size
            </a>
          )}
        </div>
      )}
    </>
  )
}
