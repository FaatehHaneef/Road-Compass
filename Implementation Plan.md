# Spotter AI — Full Stack Developer Assessment
## ELD Trip Planner: End-to-End Implementation Plan (Overdeliver Edition)

---

## 1. What We're Building

A premium, interactive **web application** for truck drivers and dispatchers. The user inputs a trip (current location → pickup → dropoff) along with their current hours-used in the weekly cycle. The app:

1. Geocodes all addresses to coordinates
2. Calculates the real driving route (distance + duration)
3. Runs an advanced HOS (Hours of Service) scheduling engine per FMCSA rules
4. Outputs an interactive, animated map with all stops
5. Outputs pixel-perfect, filled-out ELD Driver's Daily Log sheets, drawn graphically on HTML5 Canvas.

**Overdelivery Goals:**
- **UI/UX:** Premium dark-mode aesthetics, micro-animations, responsive layout.
- **Robustness:** Strict adherence to FMCSA rules, edge-case handling (e.g., 34-hour restarts).
- **Architecture:** Clean separation of concerns, well-documented code.

---

## 2. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Backend framework | Django 4.2 LTS | Required by assessment |
| Backend API | Django REST Framework 3.15 | Standard Django REST |
| Backend CORS | django-cors-headers 4.4 | Cross-origin React → Django |
| Backend WSGI | gunicorn 21.x | Production server |
| Backend static files | whitenoise 6.x | Serve static without separate server |
| Frontend framework | React 18 + Vite 5 | Fast, modern, Vercel-optimized |
| Map display | Leaflet 1.9 + react-leaflet 4.2 | Free, no API key, OpenStreetMap tiles |
| Routing API | OSRM (public demo server) | Completely free, no API key required |
| Geocoding API | Nominatim (OSM) | Completely free, no API key required |
| Log rendering | HTML5 Canvas (react-konva 18.x) | Pixel-perfect ELD log drawing |
| HTTP client | axios 1.6 | Frontend API calls |
| Styling | Vanilla CSS + CSS variables | Premium, custom design system |
| Animation | Framer Motion | Smooth UI transitions and micro-interactions |
| Icons | Lucide React | Clean, modern iconography |
| Font | Google Fonts: Inter & Roboto Mono | Modern typography |

---

## 3. Deployment Architecture

```
┌─────────────────────────────────────────────┐
│              USER BROWSER                   │
└───────────────────┬─────────────────────────┘
                    │ HTTPS
        ┌───────────▼───────────┐
        │  Vercel (Frontend)    │
        │  React + Vite build   │
        │  vercel.json (SPA)    │
        └───────────┬───────────┘
                    │ REST API calls
        ┌───────────▼───────────┐
        │  Render.com (Backend) │
        │  Django 4.2           │
        │  gunicorn             │
        │  No DB (stateless)    │
        └───────────┬───────────┘
                    │ HTTP requests
        ┌───────────▼───────────┐
        │  External Free APIs   │
        │  OSRM (routing)       │
        │  Nominatim (geocode)  │
        └───────────────────────┘
```

> [!TIP]
> **Why Render for backend (not Vercel)?** Vercel's Python runtime uses serverless functions with a 10-second timeout on the free plan. Django's HOS engine can take a few seconds for complex trips. Render's free tier gives a persistent web service with no timeout issues — far more reliable for Django. Vercel is ideal for the React frontend.

---

## 4. Version Compatibility Matrix (Vercel + Render)

| Package | Version | Compatibility & Clashes to Avoid |
|---|---|---|
| Python | 3.11.x | Render free tier default |
| Django | 4.2.x (LTS) | Stable, long-term support |
| React | 18.3.x | Vercel fully supported |
| Vite | 5.x | Vercel build plugin support |
| react-leaflet | 4.2.x | **CRITICAL:** `react-leaflet@3.x` is NOT compatible with React 18. Must use 4.x. |
| react-konva | 18.2.x | **CRITICAL:** `react-konva@17.x` is NOT compatible with React 18. Must use 18.x. |

> [!WARNING]
> **API Limits:** Nominatim has a strict limit of 1 request/second. The backend must respect this to avoid being blocked.

---

## 5. HOS Rules Engine (Core Logic)

These are the FMCSA rules we implement, per the attached FMCSA guide and assessment assumptions:

| Rule | Value |
|---|---|
| Max driving per shift | 11 hours |
| Max on-duty window | 14 hours |
| Mandatory break after | 8 hours driving → 30 min break |
| Required off-duty rest | 10 hours (before next shift) |
| Weekly cycle | 70 hours / 8 days |
| Fuel stop interval | Every 1,000 miles (30 min stop) |
| Pickup stop duration | 1 hour |
| Dropoff stop duration | 1 hour |
| Driver type | Property-carrying |
| Adverse conditions | None assumed |

### Algorithm Overview
The engine simulates the trip sequentially:
1. Geocode locations and fetch route segments.
2. Initialize driver state (hours driven, hours on duty, cycle hours).
3. Process each route segment, breaking it down into chunks if necessary to insert fuel stops, 30-minute breaks, 10-hour rests, or 34-hour restarts.
4. Record each state change as an "Event".
5. Group events by calendar day to generate ELD Log Sheet data.

---

## 6. Premium UI/UX Design Plan

### Aesthetics
- **Theme:** Sleek Dark Mode (Glassmorphism accents).
- **Colors:** Deep blues/grays background, vibrant blue/green accents.
- **Typography:** Inter for UI, Roboto Mono for data/logs.

### Layout
- **Hero Section:** Clean input form with animated submit button.
- **Split View Results:**
  - **Left Panel:** Interactive Trip Timeline (Framer Motion animations).
  - **Right Panel:** Interactive Leaflet Map (animated route drawing).
- **ELD Section:** Scrollable horizontal list of pixel-perfect Canvas-drawn log sheets.

---

## 7. Build & Deployment Steps

### Phase 1: Backend Setup (Django)
1. Initialize Django project (`core`) and app (`api`).
2. Build services: Geocoding (`Nominatim`), Routing (`OSRM`), HOS Engine.
3. Expose REST endpoint (`/api/trip/`).
4. Configure for Render (Gunicorn, requirements.txt, render.yaml).

### Phase 2: Frontend Setup (React/Vite)
1. Initialize Vite React project.
2. Build design system (CSS vars, layout components).
3. Implement interactive form, map, and timeline.
4. Implement pixel-perfect Canvas ELD renderer (`react-konva`).
5. Configure for Vercel.

### Phase 3: Integration & Testing
1. Connect frontend to backend.
2. Test complex multi-day trips to verify HOS logic and Log sheet rendering.

### Phase 4: Deployment
1. Deploy Backend to Render.
2. Deploy Frontend to Vercel.

---

## User Review Required

Please review the plan above. 

> [!IMPORTANT]
> If everything looks good, please approve so I can begin building the backend logic and the React frontend!

Approved!

------------------------------------------------------------------

⏸️ CHECKPOINT (July 20th)
We are pausing here for today.

Current State
Phase 1 (Backend): Complete. Robust, stateless, zero-hardcoded secrets, loop-safe HOS engine.
Phase 2 (Frontend): React scaffolding and UI Components completed (MapView, StopsList, LogSheet, and global CSS). All dependencies installed successfully.
Next Steps for Tomorrow
Start the local dev servers (Django backend + Vite frontend) to verify the integration.
Test a full long-haul trip (e.g. Chicago to Los Angeles) to verify the map, timeline, and ELD Canvas sheets render beautifully.
Move onto Phase 3 & 4 (Integration testing and Deployment to Vercel/Render).
Ready to resume when you are!
