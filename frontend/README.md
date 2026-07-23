# Spotter ELD Frontend

This frontend is designed to work in two modes:

- Local development: Vite proxies `/api` to the Django backend on `http://127.0.0.1:8000`
- Deployed production: set `VITE_API_URL` to the public backend URL in Vercel

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

If the Django backend is running locally on port 8000, the frontend will talk to it automatically through the Vite proxy.

## Production deployment

Set this environment variable in Vercel:

```bash
VITE_API_URL=https://your-backend-host.example.com
```

The frontend build will then call that backend directly.
