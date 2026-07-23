# Road Compass

Road Compass is a trip planning web app for commercial driving workflows. It takes a current location, pickup, dropoff, and current cycle hours used, then calculates a route, applies hours-of-service logic, and renders the result in a polished dashboard with a live map, route timeline, and optional compliance log sheets.

## What the app does

- Builds a trip plan from three locations and a current cycle-hours value
- Geocodes each location into coordinates
- Fetches real driving routes and route geometry
- Simulates the trip against FMCSA-style hours-of-service constraints
- Renders the trip on an interactive map
- Shows a step-by-step timeline of stops, breaks, rests, and driving segments
- Generates ELD-style daily log sheets for compliance review

## Key features

- Full-screen intro screen with a smooth transition into the planner
- Dark, futuristic UI with a flowing animated background
- Trip input form with validation and responsive styling
- Interactive map with origin, pickup, dropoff, and route line
- Horizontal route timeline that reads left to right
- Optional ELD compliance logs that can be shown or hidden
- Stateless backend API with no database dependency for trip planning

## Tech stack

- Frontend: React, Vite, Framer Motion, Axios
- Map rendering: Leaflet and React Leaflet
- Log rendering: React Konva
- Backend: Django, Django REST Framework
- CORS: django-cors-headers
- Production hosting: Vercel for the frontend, any Python web host for the backend

## How it works

1. The user enters the current location, pickup, dropoff, and hours already used in the cycle.
2. The frontend sends the request to the backend API.
3. The backend geocodes the locations and gets route geometry.
4. The HOS engine breaks the route into driving segments and inserts required breaks or rests.
5. The backend returns route data, timeline events, daily logs, and stop markers.
6. The frontend renders the route map, trip timeline, and logs in the dashboard.

## Local development

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+

### Backend

```bash
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

If you are on macOS or Linux, use `cp .env.example .env` instead of `copy`.

### Local API behavior

- In development, Vite proxies `/api` requests to the local Django server on port `8000`
- The frontend will work with the backend running locally without extra configuration

## Environment variables

### Frontend

Set this in Vercel or in your local `.env` file:

```bash
VITE_API_URL=https://your-backend-host.example.com
```

If `VITE_API_URL` is not set in production, the frontend will show a clear error.

### Backend

Recommended backend environment variables:

```bash
DJANGO_SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=your-backend-host.example.com
CORS_ALLOWED_ORIGINS=https://your-frontend-host.example.com
```

## API endpoint

### `POST /api/trip/`

Request body:

```json
{
	"current_location": "Chicago, IL",
	"pickup_location": "St. Louis, MO",
	"dropoff_location": "Dallas, TX",
	"current_cycle_used": 12
}
```

Response includes:

- route summary
- waypoint coordinates
- route geometry
- schedule events
- daily log sheets
- stop list and summary totals

## Deployment

### Frontend

Deploy the `frontend` folder to Vercel.

Important:
- Set `VITE_API_URL` to the public backend URL
- Keep the Vercel rewrite config in [frontend/vercel.json](frontend/vercel.json)

### Backend

Deploy the `backend` folder to any Python web host that supports Django.

The backend uses:
- [backend/requirements.txt](backend/requirements.txt)
- [backend/render.yaml](backend/render.yaml) for Render-style configuration

## Project structure

```text
backend/
	api/
		hos_engine.py
		log_generator.py
		route_service.py
		views.py
	core/
		settings.py
		urls.py
	manage.py

frontend/
	src/
		App.jsx
		index.css
		components/
			FlowBackground.jsx
			LogSheet.jsx
			MapView.jsx
			StopsList.jsx
```

## Notes on the logs

The log sheets are the ELD-style daily compliance views. They are included so the trip plan can be reviewed in a format that mirrors a driver log instead of just a plain route summary. If you only want the planning view, the logs can stay hidden in the UI.

## Troubleshooting

- If the frontend says the backend URL is missing, check `VITE_API_URL`
- If the map is blank, confirm the backend is returning route geometry
- If requests fail in production, confirm CORS is allowing the frontend origin
- If the backend build fails, confirm `backend/requirements.txt` is saved as UTF-8 text

## License

No license is included. Add one if you want this project to be public or reusable.
