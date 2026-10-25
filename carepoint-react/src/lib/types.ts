// Shapes of the data the backend sends and receives (see carepoint-api).
// Keep these in sync with the backend's API.

export type DeliveryMethod = 'pickup' | 'delivery'

/** Returning customer: refill using the prescription number we gave them, or we find it by their phone if they lost it. */
export interface RefillRequest {
  name: string
  phone: string
  method: DeliveryMethod
  deliveryAddress?: string // required when method is 'delivery'
  prescriptionNumber?: string // empty = customer doesn't have it, staff look it up by phone
}

/** New customer: photos or PDFs of their paper prescription. Sent as multipart/form-data. */
export interface PrescriptionUploadRequest {
  name: string
  phone: string
  method: DeliveryMethod
  deliveryAddress?: string
  files: File[]
  notes?: string
}

export interface OrderResponse {
  id: number // the order number shown to the customer, e.g. 1001
  status: string
  prescriptionNumbers: string[]
}

/** Opening hours for one day. Times are "HH:MM". A closing time earlier than the
 * opening time means past midnight; the same time for both means open 24 hours. */
export interface DayHours {
  day: number // 0 = Sunday … 6 = Saturday
  opensAt: string | null
  closesAt: string | null
  isClosed: boolean
}

export interface StoreInfo {
  name: string
  phone: string
  phoneHref: string
  address: string // may contain line breaks
  hours: DayHours[]
  stats: { avgRefillMinutes: number; yearsServing: number; ordersCompleted: number }
}

export interface Review {
  id: string
  quote: string
  author: string
  initials: string
  detail: string
}
