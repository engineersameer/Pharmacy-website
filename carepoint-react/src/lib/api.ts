import { mockApi, reviews } from './mock-api'
import type { OrderResponse, PrescriptionUploadRequest, RefillRequest, Review, StoreInfo } from './types'

// All calls to the backend go through this file.
// Components never call fetch() directly, so swapping mocks for the real backend is one switch.

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'

export class ApiError extends Error {
  status: number
  /** Per-field messages from the backend, e.g. { phone: "Please enter a valid…" } */
  fields: Record<string, string>

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

// DRF errors look like {"phone": ["msg"]} or {"detail": "msg"}; keep the first message per field
function readErrors(body: unknown): { message: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {}
  let message = ''
  if (body && typeof body === 'object') {
    for (const [key, value] of Object.entries(body)) {
      const text = Array.isArray(value) ? String(value[0]) : typeof value === 'string' ? value : ''
      if (!text) continue
      if (key === 'detail' || key === 'non_field_errors') message ||= text
      else fields[key] = text
    }
  }
  return { message: message || Object.values(fields)[0] || '', fields }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Let the browser set the multipart boundary for file uploads
  const isForm = init?.body instanceof FormData
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), Accept: 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    let parsed = { message: res.statusText, fields: {} as Record<string, string> }
    try {
      parsed = readErrors(await res.json())
    } catch {
      // response had no JSON body
    }
    throw new ApiError(res.status, parsed.message || res.statusText, parsed.fields)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const realApi = {
  getStoreInfo: () => request<StoreInfo>('/store'),
  // No reviews in the backend yet; the site shows its own
  getReviews: async (): Promise<Review[]> => reviews,
  createRefill: (data: RefillRequest) =>
    request<OrderResponse>('/refills', { method: 'POST', body: JSON.stringify(data) }),
  uploadPrescription: ({ files, ...fields }: PrescriptionUploadRequest) => {
    const body = new FormData()
    Object.entries(fields).forEach(([k, v]) => v != null && body.append(k, String(v)))
    files.forEach((f) => body.append('files', f))
    return request<OrderResponse>('/prescriptions', { method: 'POST', body })
  },
}

export const api: typeof realApi = USE_MOCKS ? mockApi : realApi
