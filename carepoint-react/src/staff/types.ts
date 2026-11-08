// Shapes the backend's admin API sends (see carepoint-api/apps/orders/admin_serializers.py).

export type OrderStatus = 'received' | 'confirmed' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled'

export interface Admin {
  id: number
  email: string
  name: string
}

export interface StaffPrescription {
  id: number
  number: number // same as id: the prescription number 1, 2, 3, …
  fileUrl: string // admin-only, needs the login token
  fileType: 'image' | 'pdf'
  createdAt: string
}

/** A search result: a prescription plus the orders it was used in */
export interface PrescriptionResult extends StaffPrescription {
  usedIn: { orderId: number; customerName: string; customerPhone: string; createdAt: string }[]
}

export interface OrderWarning {
  code: 'no_prescription' | 'phone_mismatch'
  message: string
}

export interface StaffOrder {
  id: number
  customerName: string
  customerPhone: string // +923001234567
  orderType: 'new_prescription' | 'refill'
  method: 'pickup' | 'delivery'
  deliveryAddress: string
  notes: string
  status: OrderStatus
  nextStatuses: OrderStatus[]
  warnings: OrderWarning[]
  prescriptions: StaffPrescription[]
  createdAt: string
  updatedAt: string
  /** Someone pressed Accept on the new-order alarm (stops it on every screen) */
  acceptedAt: string | null
  acceptedBy: string | null
}

export interface Page<T> {
  count: number
  next: string | null
  results: T[]
}

export interface StoreSettings {
  name: string
  phone: string
  address: string
  yearsServing: number
  avgRefillMinutes: number
  updatedAt: string
  updatedBy: string | null
}

export interface StaffHours {
  day: number
  opensAt: string | null
  closesAt: string | null
  isClosed: boolean
}
