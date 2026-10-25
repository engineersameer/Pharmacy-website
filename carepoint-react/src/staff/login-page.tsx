import { ArrowLeft, Mail } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BrandMark } from '@/components/brand-mark'
import { GlassCard } from '@/components/shared/glass-card'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { useAuth } from './auth'
import { useStoreName } from './use-store-name'

const RESEND_SECONDS = 60
const field =
  'h-[50px] w-full rounded-xl border border-input bg-field px-4 text-foreground outline-none transition-[border-color,box-shadow] focus:border-primary focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_18%,transparent)] aria-invalid:border-destructive'

export function LoginPage() {
  const { requestCode, verifyCode } = useAuth()
  const storeName = useStoreName()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
  }, [step])

  const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Could not reach the server. Check your internet.')

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    if (busy) return
    setError('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter your work email.')
      return
    }
    setBusy(true)
    try {
      await requestCode(email.trim())
      setStep('code')
      setCode('')
      setWait(RESEND_SECONDS)
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  async function checkCode(value = code) {
    if (busy || value.length !== 6) return
    setBusy(true)
    setError('')
    try {
      await verifyCode(email.trim(), value)
    } catch (err) {
      setError(message(err))
      setCode('')
      codeRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-svh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-2.5 font-heading text-2xl font-semibold">
          <BrandMark />
          {storeName} <span className="rounded-full bg-secondary px-2.5 py-0.5 font-sans text-xs font-semibold tracking-wide text-secondary-foreground uppercase">Staff</span>
        </div>

        <GlassCard spotlight={false} className="p-7 sm:p-9">
          {step === 'email' ? (
            <form onSubmit={sendCode} noValidate>
              <h1 className="mb-2 text-[1.9rem]">Staff login</h1>
              <p className="mb-6 text-muted-foreground">We'll email you a 6-digit code. No password needed.</p>
              <label htmlFor="staff-email" className="mb-2 block text-[0.92rem] font-medium">
                Work email
              </label>
              <input
                id="staff-email"
                type="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
                className={field}
                autoFocus
              />
              {error && (
                <p id="login-error" role="alert" className="mt-2 text-[0.88rem] font-medium text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="mt-6 w-full" disabled={busy}>
                <Mail />
                {busy ? 'Sending…' : 'Email me a code'}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                checkCode()
              }}
              noValidate
            >
              <button
                type="button"
                onClick={() => {
                  setStep('email')
                  setError('')
                }}
                className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" /> Change email
              </button>
              <h1 className="mb-2 text-[1.9rem]">Enter your code</h1>
              <p className="mb-6 text-muted-foreground">
                If <span className="font-medium text-foreground">{email.trim()}</span> is a staff email, a code is on its way. It
                works for 10 minutes.
              </p>
              <label htmlFor="staff-code" className="mb-2 block text-[0.92rem] font-medium">
                6-digit code
              </label>
              <input
                id="staff-code"
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setCode(digits)
                  if (digits.length === 6) checkCode(digits) // submit as soon as all 6 digits are in
                }}
                aria-invalid={!!error}
                aria-describedby={error ? 'login-error' : undefined}
                className={`${field} text-center text-2xl font-semibold tracking-[0.5em]`}
              />
              {error && (
                <p id="login-error" role="alert" className="mt-2 text-[0.88rem] font-medium text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="mt-6 w-full" disabled={busy || code.length !== 6}>
                {busy ? 'Checking…' : 'Log in'}
              </Button>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Didn't get it? Check spam, or{' '}
                {wait > 0 ? (
                  <span>ask again in {wait}s</span>
                ) : (
                  <button type="button" onClick={() => sendCode()} className="font-semibold text-primary hover:underline">
                    send a new code
                  </button>
                )}
              </p>
            </form>
          )}
        </GlassCard>
        <p className="mt-6 text-center text-xs text-muted-foreground">For {storeName} staff only.</p>
      </div>
    </main>
  )
}
