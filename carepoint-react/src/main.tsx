import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// The staff dashboard lives at /staff. Its code is only downloaded when someone opens
// that address, so customers never load it. There is no link to it on the public site.
const StaffApp = lazy(() => import('./staff/staff-app.tsx'))
const isStaff = window.location.pathname === '/staff' || window.location.pathname.startsWith('/staff/')

// Staff pages install as the separate staff app (only /staff), not the customer app
if (isStaff) {
  document.getElementById('app-manifest')?.setAttribute('href', '/api/manifest/staff.webmanifest')
  // iPhone names Home Screen icons from this (otherwise from the page title)
  const title = document.createElement('meta')
  title.name = 'apple-mobile-web-app-title'
  title.content = 'Staff'
  document.head.append(title)
}

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
