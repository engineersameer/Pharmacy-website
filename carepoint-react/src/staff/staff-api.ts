import { useMemo } from 'react'
import { useAuth } from './auth'
import type { OrderStatus, Page, StaffHours, StaffOrder, StaffPrescription, StoreSettings } from './types'

/** Every admin API call the dashboard makes. */
export function useStaffApi() {
  const { apiFetch } = useAuth()

  return useMemo(() => {
    const json = async <T,>(path: string, init?: RequestInit) => (await apiFetch(path, init)).json() as Promise<T>

    return {
      /** All orders with these statuses, following every page */
      ordersWithStatus: async (statuses: OrderStatus[], maxPages = 10) => {
        const all: StaffOrder[] = []
        for (let page = 1; page <= maxPages; page++) {
          const p = await json<Page<StaffOrder>>(`/admin/orders?status=${statuses.join(',')}&page=${page}`)
          all.push(...p.results)
          if (!p.next) break
        }
        return all
      },
      search: (q: string) => json<Page<StaffOrder>>(`/admin/orders?q=${encodeURIComponent(q)}`).then((p) => p.results),
      order: (id: number) => json<StaffOrder>(`/admin/orders/${id}`),
      changes: (since: string) =>
        json<{ serverTime: string; orders: StaffOrder[] }>(`/admin/orders/changes?since=${encodeURIComponent(since)}`),

      /** Returns the updated order, or { conflict } if another admin changed it first */
      setStatus: async (order: StaffOrder, status: OrderStatus) => {
        const res = await apiFetch(`/admin/orders/${order.id}/status`, {
          method: 'POST',
          body: JSON.stringify({ status, expectedStatus: order.status }),
        })
        const body = await res.json()
        return res.status === 409 ? { conflict: true as const, order: body.order as StaffOrder } : { conflict: false as const, order: body as StaffOrder }
      },
      attachPrescription: (orderId: number, prescriptionNumber: number) =>
        json<StaffOrder>(`/admin/orders/${orderId}/prescriptions`, {
          method: 'POST',
          body: JSON.stringify({ prescriptionNumber }),
        }),
      prescriptionsByPhone: (phone: string) =>
        json<StaffPrescription[]>(`/admin/prescriptions?phone=${encodeURIComponent(phone)}`),
      /** The private file, as a blob (an <img> tag can't send the login token itself) */
      prescriptionFile: async (fileUrl: string) => (await apiFetch(fileUrl)).blob(),

      store: () => json<StoreSettings>('/admin/store'),
      saveStore: (data: Partial<StoreSettings>) =>
        json<StoreSettings>('/admin/store', { method: 'PATCH', body: JSON.stringify(data) }),
      hours: () => json<StaffHours[]>('/admin/hours'),
      saveHours: (week: StaffHours[]) => json<StaffHours[]>('/admin/hours', { method: 'PUT', body: JSON.stringify(week) }),
    }
  }, [apiFetch])
}
