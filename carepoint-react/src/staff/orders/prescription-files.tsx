import { Download, ExternalLink, FileText, ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useStaffApi } from '../staff-api'
import type { StaffPrescription } from '../types'

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

export function PrescriptionFiles({ prescriptions }: { prescriptions: StaffPrescription[] }) {
  const [open, setOpen] = useState<StaffPrescription | null>(null)
  if (prescriptions.length === 0) return null
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {prescriptions.map((p) => (
          <li key={p.id}>
            <FileTile p={p} onOpen={() => setOpen(p)} />
          </li>
        ))}
      </ul>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="glass max-h-[92svh] gap-3 bg-popover p-4 sm:max-w-3xl">
          {open && <BigView p={open} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function FileTile({ p, onOpen }: { p: StaffPrescription; onOpen: () => void }) {
  const { url, failed } = useFileUrl(p)
  const [broken, setBroken] = useState(false) // e.g. iPhone HEIC photos many browsers can't show

  return (
    <div className="overflow-hidden rounded-xl border border-glass-border bg-glass-strong">
      <button type="button" onClick={onOpen} className="block aspect-[3/4] w-full" aria-label={`Open prescription ${p.number}`}>
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
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
        <span className="font-semibold tracking-wider">{p.number}</span>
        {url && (
          <a href={url} download={`prescription-${p.number}`} className="text-muted-foreground hover:text-primary" aria-label="Download">
            <Download className="size-4" />
          </a>
        )}
      </div>
    </div>
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
