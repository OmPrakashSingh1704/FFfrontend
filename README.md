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

## Secure Localhost (HTTPS)
The dev and preview servers automatically switch to HTTPS when certificates are available. By default the project looks
for `.cert/localhost-key.pem` and `.cert/localhost-cert.pem` inside `frontend/`. You can also override the paths with
`DEV_SSL_KEY` and `DEV_SSL_CERT` environment variables.

### Generate certificates with mkcert
```bash
cd frontend
mkdir -p .cert
mkcert -install
mkcert -key-file .cert/localhost-key.pem -cert-file .cert/localhost-cert.pem localhost 127.0.0.1 ::1
```

Restart `npm run dev` and open https://localhost:3000. Trust the generated certificate in your browser the first time to
remove the "Not Secure" warning.

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
