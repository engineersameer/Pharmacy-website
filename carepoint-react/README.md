# CarePoint Pharmacy (React)

The CarePoint website rebuilt in React + TypeScript, with Tailwind CSS v4, shadcn/ui and Motion for animation.
Same "clinical luxe" look as the original HTML site: midnight ink, one teal color, frosted glass, dark first with a light "pearl" mode.

## Run it

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # type check + production build into dist/
```

## Folders

```
src/
  App.tsx                    page layout: which sections, in what order
  index.css                  theme colors, fonts, glass and other shared styles
  components/
    sections/                one file per page section (header, hero, services, …)
    shared/                  small reusable pieces (GlassCard, Reveal, SectionHeading, Magnetic)
    ui/                      shadcn + motion-primitives components (button, spotlight, text-effect, animated-number)
  hooks/                     useTheme, useApi, useStore
  lib/
    api.ts                   the ONLY place that talks to the backend
    mock-api.ts              fake backend used until the real one exists
    types.ts                 data shapes shared with the backend
    hours.ts                 opening-hours helpers
```

## Connecting the backend

1. Copy `.env.example` to `.env.local` (already done for you).
2. Set `VITE_USE_MOCKS=false`.
3. Set `VITE_API_PROXY` to your backend's address, for example `http://localhost:8000`.
   In development, Vite forwards every `/api/...` call there, so you don't need CORS.
4. In production, set `VITE_API_URL` to the full API address, for example `https://api.example.com`.

The backend needs these endpoints (shapes are in `src/lib/types.ts`):

| Method | Path           | Returns          | Used by                   |
| ------ | -------------- | ---------------- | ------------------------- |
| GET    | `/api/store`   | `StoreInfo`      | phone, address, hours, stats |
| GET    | `/api/reviews` | `Review[]`       | reviews carousel          |
| POST   | `/api/refills` | `OrderResponse`  | order form, returning customer (`RefillRequest` JSON body) |
| POST   | `/api/prescriptions` | `OrderResponse` | order form, new customer (`multipart/form-data`: name, phone, method, notes, `files`) |

To add a feature: add the type to `types.ts`, add the call to `realApi` and `mockApi`, then use it in a component with `useApi()`.
