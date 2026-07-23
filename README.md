# Road Compass / Spotter ELD Planner

This repository contains a Django REST API and a React/Vite frontend for an FMCSA-oriented trip planner.

## Local development

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
cp .env.example .env
npm run dev
```

The frontend expects the backend at `http://127.0.0.1:8000` by default.

## Deployment notes

- Backend: Render via [backend/render.yaml](backend/render.yaml)
- Frontend: Vercel via [frontend/vercel.json](frontend/vercel.json)
