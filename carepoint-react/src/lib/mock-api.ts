import type { OrderResponse, PrescriptionUploadRequest, RefillRequest, Review, StoreInfo } from './types'

// Fake backend used while VITE_USE_MOCKS is true. Same functions and shapes as the real API.
// storeInfo is also what the page shows for a split second before the real data arrives.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
let nextOrderId = 1001
let nextPrescription = 1

export const storeInfo: StoreInfo = {
  name: 'CarePoint Pharmacy',
  phone: '0300 0000000',
  phoneHref: 'tel:+923000000000',
  address: 'Shop 12, Main Boulevard, Gulberg III\nLahore, Punjab',
  hours: [
    { day: 0, opensAt: '10:00', closesAt: '16:00', isClosed: false },
    { day: 1, opensAt: '08:00', closesAt: '21:00', isClosed: false },
    { day: 2, opensAt: '08:00', closesAt: '21:00', isClosed: false },
    { day: 3, opensAt: '08:00', closesAt: '21:00', isClosed: false },
    { day: 4, opensAt: '08:00', closesAt: '21:00', isClosed: false },
    { day: 5, opensAt: '08:00', closesAt: '21:00', isClosed: false },
    { day: 6, opensAt: '09:00', closesAt: '18:00', isClosed: false },
  ],
  stats: { avgRefillMinutes: 15, yearsServing: 18, ordersCompleted: 0 },
}

// Reviews are written into the site for now; the backend has no reviews yet.
export const reviews: Review[] = [
  { id: '1', quote: 'They caught a drug interaction my doctor missed. I trust them completely.', author: 'Ayesha R.', initials: 'AR', detail: 'Customer since 2015' },
  { id: '2', quote: 'Delivery the same afternoon when my son was sick. Lifesavers.', author: 'Bilal K.', initials: 'BK', detail: 'Parent of two' },
  { id: '3', quote: 'Friendly staff, no long lines, and they always remember me.', author: 'Nasreen T.', initials: 'NT', detail: 'Customer since 2009' },
]

export const mockApi = {
  getStoreInfo: async () => {
    await wait(150)
    return storeInfo
  },
  getReviews: async () => reviews,
  createRefill: async (_data: RefillRequest): Promise<OrderResponse> => {
    await wait(800)
    return { id: nextOrderId++, status: 'received', prescriptionNumbers: [] }
  },
  uploadPrescription: async (data: PrescriptionUploadRequest): Promise<OrderResponse> => {
    await wait(1200)
    return { id: nextOrderId++, status: 'received', prescriptionNumbers: data.files.map(() => nextPrescription++) }
  },
}
