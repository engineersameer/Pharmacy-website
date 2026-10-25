import { BrandMark } from '@/components/brand-mark'
import { useStore } from '@/hooks/use-store'

export function Footer() {
  const store = useStore()
  return (
    <footer className="py-9 text-[0.92rem]">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-4 md:px-8">
        <p className="m-0 inline-flex items-center gap-2.5">
          <BrandMark className="size-6" />© {new Date().getFullYear()} {store.name}. A demo website.
        </p>
        <p className="m-0 text-muted-foreground">In an emergency, call Rescue 1122.</p>
      </div>
    </footer>
  )
}
