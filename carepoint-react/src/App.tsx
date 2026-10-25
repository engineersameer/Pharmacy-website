import { MotionConfig } from 'motion/react'
import { Footer } from '@/components/sections/footer'
import { Header } from '@/components/sections/header'
import { Hero } from '@/components/sections/hero'
import { HowItWorks } from '@/components/sections/how-it-works'
import { Refill } from '@/components/sections/refill'
import { Reviews } from '@/components/sections/reviews'
import { Services } from '@/components/sections/services'
import { StoreProvider } from '@/hooks/use-store'

export default function App() {
  return (
    // reducedMotion="user": motion drops movement for people who ask their device for less
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <a
          href="#main"
          className="absolute -top-24 left-4 z-[100] rounded-xl bg-primary px-4 py-2.5 text-primary-foreground focus:top-3"
        >
          Skip to content
        </a>
        <Header />
        <main id="main">
          <Hero />
          <Services />
          <HowItWorks />
          <Reviews />
          <Refill />
        </main>
        <Footer />
      </StoreProvider>
    </MotionConfig>
  )
}
