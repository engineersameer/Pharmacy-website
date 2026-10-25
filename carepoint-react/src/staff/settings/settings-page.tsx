import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, Save, Store } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { hoursLabel } from '@/lib/hours'
import { cn } from '@/lib/utils'
import { fullTime } from '../format'
import { useStaffApi } from '../staff-api'
import type { StaffHours, StoreSettings } from '../types'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_NUMBER = [1, 2, 3, 4, 5, 6, 0] // the backend counts Sunday as 0
const input =
  'h-11 w-full rounded-xl border border-input bg-field px-4 text-foreground outline-none focus:border-primary aria-invalid:border-destructive'

const errorText = (e: unknown) => (e instanceof ApiError ? Object.values(e.fields)[0] || e.message : 'Could not save. Check your internet.')

export function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-[2rem]">Store settings</h1>
      <p className="-mt-3 text-muted-foreground">Changes show on the public website straight away.</p>
      <StoreForm />
      <HoursForm />
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="glass p-6 sm:p-8">
      <h2 className="mb-6 flex items-center gap-2.5 font-sans text-lg font-semibold [&_svg]:size-5 [&_svg]:text-primary">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

function StoreForm() {
  const api = useStaffApi()
  const qc = useQueryClient()
  const store = useQuery({ queryKey: ['store'], queryFn: api.store })
  const [form, setForm] = useState<StoreSettings | null>(null)

  useEffect(() => {
    if (store.data) setForm(store.data)
  }, [store.data])

  const save = useMutation({
    mutationFn: (data: StoreSettings) =>
      api.saveStore({
        name: data.name,
        phone: data.phone,
        address: data.address,
        yearsServing: Number(data.yearsServing),
        avgRefillMinutes: Number(data.avgRefillMinutes),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['store'], data)
      toast.success('Store details saved')
    },
    onError: (e) => toast.error(errorText(e)),
  })

  if (!form) return <Card title="Pharmacy details" icon={<Store />}>{store.isError ? 'Could not load.' : 'Loading…'}</Card>

  const set = (k: keyof StoreSettings) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate(form)
  }

  return (
    <Card title="Pharmacy details" icon={<Store />}>
      <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
        <Field label="Pharmacy name" id="s-name">
          <input id="s-name" className={input} value={form.name} onChange={set('name')} required maxLength={120} />
        </Field>
        <Field label="Phone shown on the website" id="s-phone">
          <input id="s-phone" className={input} value={form.phone} onChange={set('phone')} required maxLength={20} inputMode="tel" />
        </Field>
        <Field label="Address" id="s-address" hint="Each line shows on its own line on the website." wide>
          <textarea id="s-address" className={cn(input, 'h-auto min-h-[88px] py-3')} value={form.address} onChange={set('address')} required />
        </Field>
        <Field label="Years serving customers" id="s-years">
          <input id="s-years" type="number" min={0} max={200} className={input} value={form.yearsServing} onChange={set('yearsServing')} required />
        </Field>
        <Field label="Average refill time (minutes)" id="s-refill">
          <input id="s-refill" type="number" min={1} max={600} className={input} value={form.avgRefillMinutes} onChange={set('avgRefillMinutes')} required />
        </Field>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            <Save /> {save.isPending ? 'Saving…' : 'Save details'}
          </Button>
          <LastEdit at={store.data?.updatedAt} by={store.data?.updatedBy} />
        </div>
      </form>
    </Card>
  )
}

function HoursForm() {
  const api = useStaffApi()
  const qc = useQueryClient()
  const hours = useQuery({ queryKey: ['hours'], queryFn: api.hours })
  const [week, setWeek] = useState<StaffHours[] | null>(null)

  useEffect(() => {
    if (hours.data) setWeek(hours.data)
  }, [hours.data])

  const save = useMutation({
    mutationFn: api.saveHours,
    onSuccess: (data) => {
      qc.setQueryData(['hours'], data)
      toast.success('Opening hours saved')
    },
    onError: (e) => toast.error(errorText(e)),
  })

  if (!week) return <Card title="Opening hours" icon={<Clock />}>{hours.isError ? 'Could not load.' : 'Loading…'}</Card>

  const update = (day: number, patch: Partial<StaffHours>) => setWeek(week.map((d) => (d.day === day ? { ...d, ...patch } : d)))
  const missing = week.some((d) => !d.isClosed && (!d.opensAt || !d.closesAt))

  return (
    <Card title="Opening hours" icon={<Clock />}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(week)
        }}
      >
        <div className="flex flex-col divide-y divide-glass-border">
          {DAY_NUMBER.map((n, i) => {
            const d = week.find((x) => x.day === n)!
            return (
              <fieldset key={n} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[120px_1fr_auto]">
                <legend className="sr-only">{DAYS[i]}</legend>
                <span className="font-medium">{DAYS[i]}</span>
                <label className="flex items-center gap-2 text-sm sm:order-3">
                  <input type="checkbox" checked={d.isClosed} onChange={(e) => update(n, { isClosed: e.target.checked })} className="size-4 accent-[var(--primary)]" />
                  Closed
                </label>
                <div className={cn('col-span-2 flex items-center gap-2 sm:col-span-1', d.isClosed && 'opacity-40')}>
                  <input
                    type="time"
                    aria-label={`${DAYS[i]} opens at`}
                    disabled={d.isClosed}
                    value={d.opensAt ?? ''}
                    onChange={(e) => update(n, { opensAt: e.target.value || null })}
                    className={cn(input, 'h-10 min-w-0 flex-1 px-3 [color-scheme:inherit] md:w-36 md:flex-none')}
                  />
                  <span className="text-muted-foreground">to</span>
                  <input
                    type="time"
                    aria-label={`${DAYS[i]} closes at`}
                    disabled={d.isClosed}
                    value={d.closesAt ?? ''}
                    onChange={(e) => update(n, { closesAt: e.target.value || null })}
                    className={cn(input, 'h-10 min-w-0 flex-1 px-3 [color-scheme:inherit] md:w-36 md:flex-none')}
                  />
                  <span className="hidden text-xs text-muted-foreground md:inline">{hoursLabel(d)}</span>
                </div>
              </fieldset>
            )
          })}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Open past midnight? Set the closing time earlier than the opening time, e.g. 9:00 am to 2:00 am. Same time for both means open
          24 hours.
        </p>
        {missing && <p className="mt-2 text-sm font-medium text-destructive">Add both times for every open day, or tick Closed.</p>}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={save.isPending || missing}>
            <Save /> {save.isPending ? 'Saving…' : 'Save hours'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function Field({ label, id, hint, wide, children }: { label: string; id: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn(wide && 'sm:col-span-2')}>
      <label htmlFor={id} className="mb-2 block text-[0.92rem] font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[0.85rem] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function LastEdit({ at, by }: { at?: string; by?: string | null }) {
  if (!at) return null
  return (
    <span className="text-sm text-muted-foreground">
      Last saved {fullTime(at)}
      {by ? ` by ${by}` : ''}
    </span>
  )
}
