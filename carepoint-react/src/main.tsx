import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// The staff dashboard lives at /staff. Its code is only downloaded when someone opens
// that address, so customers never load it. There is no link to it on the public site.
const StaffApp = lazy(() => import('./staff/staff-app.tsx'))
const isStaff = window.location.pathname === '/staff' || window.location.pathname.startsWith('/staff/')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStaff ? (
      <Suspense fallback={null}>
        <StaffApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
