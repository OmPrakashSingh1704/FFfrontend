# FoundersLib Frontend

React + TypeScript + Vite application for FoundersLib.

## Requirements
- Node.js 20+
- npm 10+

## Setup
```bash
cd frontend
npm install
cp .env.example .env
```

## Common Scripts
```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Bundle Analysis
```bash
npm run analyze
```
Generates `dist/bundle-report.html`.

## Unit Tests
```bash
npm run test
npm run test:run
npm run test:ui
```

## E2E Tests (Playwright)
```bash
npm run test:e2e
npm run test:e2e:ui
```
Optional login test requires:
```
E2E_USER_EMAIL=you@example.com
E2E_USER_PASSWORD=your-password
```

## Docker
```bash
docker build -t founderslib-frontend .
docker run -p 3000:80 founderslib-frontend
```

## Environment Variables
```
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_API_USE_COOKIES=false
VITE_SENTRY_DSN=
VITE_CAPTURE_CONSOLE_ERRORS=false
```
