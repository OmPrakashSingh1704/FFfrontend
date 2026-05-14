# `secrets/`

Local-only secret material lives here. **Everything in this directory is
gitignored except this README** (see `.gitignore` for the explicit rule).

## What belongs here (frontend-specific)

| Kind | Examples |
|---|---|
| Local env overrides | `.env.local`, `.env.development.local` |
| Sentry / Datadog tokens for local debugging | `sentry.token` |
| Local TLS for `https` dev server | `dev-cert.pem`, `dev-key.pem` |
| OAuth client JSONs used by local proxies | `google-oauth-client.json` |

Vite reads `.env*.local` automatically when running `npm run dev` — point
those env files at this folder if they're sensitive enough not to ship,
or symlink/copy them to the project root as `.env.local` (also gitignored).

## What does NOT belong here

- `VITE_API_BASE_URL` and other public-facing env vars — those go in
  `.env` (committed) or your hosting platform's env config.
- Production secrets — never. Production secrets live in Vercel /
  Cloudflare / your platform's env settings.
- Anything you wouldn't email yourself in plaintext.

## How to keep this safe

1. Never `git add -A`.
2. If you accidentally commit a secret: rotate it, then rewrite history.
