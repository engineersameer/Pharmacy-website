import { createContext, useContext, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { storeInfo as defaultStoreInfo } from '@/lib/mock-api'
import type { StoreInfo } from '@/lib/types'
import { useApi } from './use-api'

// Store details (phone, address, hours, stats) are used across the page,
// so they are loaded once here and shared.

const StoreContext = createContext<StoreInfo>(defaultStoreInfo)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { data } = useApi(api.getStoreInfo, defaultStoreInfo)
  return <StoreContext.Provider value={data}>{children}</StoreContext.Provider>
}

export function useStore() {
  return useContext(StoreContext)
}
