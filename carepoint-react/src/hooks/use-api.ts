import { useEffect, useState } from 'react'

/**
 * Load data from the API once. Shows `fallback` until the response arrives,
 * and keeps showing it if the call fails, so the page never renders empty.
 * Swap for TanStack Query later if you need caching or refetching.
 */
export function useApi<T>(load: () => Promise<T>, fallback: T) {
  const [data, setData] = useState<T>(fallback)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    load()
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // `load` is expected to be a stable api function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { data, error, loading }
}
