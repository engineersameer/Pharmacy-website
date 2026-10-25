import { useQuery } from '@tanstack/react-query'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

/** The pharmacy's name from Store settings (public data, no login needed) */
export function useStoreName() {
  const store = useQuery({
    queryKey: ['public-store'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/store`)
      if (!res.ok) throw new Error('store')
      return (await res.json()) as { name: string }
    },
    staleTime: 5 * 60_000,
  })
  return store.data?.name ?? 'CarePoint Pharmacy'
}
