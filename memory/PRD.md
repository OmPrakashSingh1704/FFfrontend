# FoundersLib - Product Requirements Document

## Original Problem Statement
The user wants to refactor an existing frontend application to "make this a perfect webapp" without disturbing the API calls. The design direction is "old money" style with a lean design, glass transparent style, and minimal animations.

## User Personas
- **Founders**: Looking to raise capital with discretion and meaningful investor connections
- **Investors**: Looking to discover and evaluate promising startups

## Core Requirements
1. **"Old Money" Aesthetic**: Serif fonts (Cormorant Garamond), cream/gold/dark-brown color palette, glass transparency effects
2. **Dynamic Theme**: Light/dark mode toggle
3. **Responsive Design**: Works on desktop and mobile devices
4. **Clean Navigation**: Remove unnecessary links and technical jargon
5. **Elegant Animations**: Subtle animations showing product vision

## Tech Stack
- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, PostCSS, Custom CSS (App.css, index.css)
- **Design System**: Custom "old money" theme with glass-morphism effects

## What's Been Implemented (December 2025)

### Completed Features
1. **Landing Page**
   - Hero section with animated investor cards
   - Features section with dashboard preview animation
   - Testimonials section
   - CTA section
   - Responsive mobile design with stats instead of animation

2. **Authentication Pages**
   - Login page with glass card styling
   - Signup page with role selection

3. **Onboarding Page** 
   - Progress tracking
   - Role selection (Founder/Investor/Both)
   - Multi-step form (Profile, Founder details, Startup details, Investor profile)
   - Glass card styling with proper padding

4. **Dashboard**
   - Stats cards (Active Intros, Pipeline Value, Response Rate, Avg Response)
   - Quick Actions section
   - Browse section (Founders, Startups, Investors, Funds, Applications, Files)
   - Activity Overview section

5. **App Shell Layout**
   - Responsive header with navigation
   - **Notification dropdown** (click bell icon to see recent notifications in a popover)
   - Mobile menu
   - Theme toggle

6. **Internal Pages Styling (Fixed Dec 2025)**
   - Search page with styled input and button
   - Uploads page with hidden file inputs and styled buttons
   - Admin page with styled forms, search, and cards
   - Admin Funds page with filter bar
   - Admin Applications page with filter bar
   - Admin Moderation page with filter bar and action cards
   - Analytics page with styled dropdown
   - Notifications page with empty state component

### Styling System
- **CSS Variables**: Theme colors defined in index.css
- **Tailwind Integration**: Custom configuration in tailwind.config.js
- **Component Styles**: All in App.css (buttons, cards, forms, navigation, search bar, uploads, admin, analytics)

## Pending Tasks

### P0 (Critical)
- None

### P1 (Important)
- None

### P2 (Nice to Have)
- Configure ESLint for TypeScript to resolve 69 parsing errors

## Architecture

```
/app/frontend/
├── src/
│   ├── components/     # Reusable UI components
│   ├── context/        # React context (Auth, Toast)
│   ├── hooks/          # Custom hooks (useTheme, useWebSocket)
│   ├── layouts/        # Page layouts (AppShell, AuthLayout)
│   ├── lib/            # Utilities (api, forms, env)
│   ├── pages/          # Page components
│   ├── types/          # TypeScript type definitions
│   ├── App.css         # Custom styles for "old money" theme
│   ├── App.tsx         # Main app with routing
│   ├── index.css       # Base styles and CSS variables
│   └── main.tsx        # Entry point
├── package.json
├── tailwind.config.js
└── vite.config.ts
```

## Key Files
- `/app/frontend/src/App.css`: All custom component styles
- `/app/frontend/src/index.css`: CSS variables, fonts, base styles
- `/app/frontend/src/pages/LandingPage.tsx`: Landing page with animations
- `/app/frontend/src/pages/OnboardingPage.tsx`: Multi-step onboarding
- `/app/frontend/src/pages/Dashboard.tsx`: Main dashboard
- `/app/frontend/src/layouts/AppShell.tsx`: App layout wrapper (with notification bell in header)

## Preview URL
https://glassmorphic-app-5.preview.emergentagent.com

## API Reference (Backend: D:\pynb\FF\ff_backend)

**Base API URL**
`/api/v1` (frontend uses `VITE_API_BASE_URL`, default `http://localhost:8000/api/v1`)

**Docs and Ops**
- `GET /api/schema/`
- `GET /api/docs/`
- `GET /api/redoc/`
- `GET /health/`
- `GET /health/live/`
- `GET /health/ready/`
- `GET /metrics/`
- `GET /s/<slug>/` (short URL redirect)

**Users** (`/api/v1/users/`)
- `/auth/register/`
- `/auth/login/`
- `/auth/logout/`
- `/auth/refresh/`
- `/auth/select-role/`
- `/auth/google/`
- `/auth/google/callback/`
- `/auth/session/`
- `/me/`
- `/me/profile/`

**Admin** (`/api/v1/admin/`)
- `/stats/`
- `/users/`
- `/users/<uuid:pk>/`
- `/funds/`
- `/applications/`
- `/moderate/<str:entity_type>/<uuid:pk>/`
- `/pending-verifications/`
- `/verify-investor/<uuid:pk>/`
- `/reject-investor/<uuid:pk>/`
- `/audit-logs/`
- `/reset-monthly-limits/`
- `/grant-credits/`
- `/deduct-credits/`

**Upload** (`/api/v1/upload/`)
- `/profile-picture/`
- `/background-picture/`
- `/startups/<uuid:pk>/logo/`

**Founders** (`/api/v1/founders/`)
- `/profile/`
- `/profile/me/`
- `/profile/update/`
- `/`
- `/<uuid:pk>/`
- `/startups/`
- `/startups/<uuid:pk>/`
- `/startups/<uuid:pk>/members/`
- `/startups/<uuid:pk>/documents/`
- `/my-startups/`
- `/save-startup/<uuid:pk>/`
- `/saved-startups/`

**Investors** (`/api/v1/investors/`)
- `/profile/`
- `/profile/me/`
- `/profile/update/`
- `/`
- `/<uuid:pk>/`
- `/dashboard/stats/`
- `/dashboard/deal-flow/`
- `/dashboard/portfolio/`
- `/dashboard/portfolio/<uuid:pk>/`
- `/saved-startups/`
- `/save-startup/<uuid:pk>/`

**Funds** (`/api/v1/funds/`)
- `/`
- `/<uuid:pk>/`
- `/saved/`
- `/saved/<uuid:pk>/`
- `/<uuid:pk>/apply/`
- `/<uuid:pk>/applicants/`
- `/my-applications/`
- `/my-opportunities/`

**Applications** (`/api/v1/applications/`)
- `/`
- `/<uuid:pk>/`
- `/<uuid:pk>/status/`
- `/<uuid:pk>/history/`
- `/reminders/`
- `/reminders/<uuid:pk>/`
- `/reminders/<uuid:pk>/complete/`
- `/stats/`

**Trust** (`/api/v1/trust/`)
- `/status/`
- `/credit-history/`
- `/leagues/`

**Intros** (`/api/v1/intros/`)
- `/`
- `/sent/`
- `/received/`
- `/<uuid:pk>/`
- `/<uuid:pk>/respond/`

**Respects** (`/api/v1/respects/`)
- `/`
- `/received/`
- `/given/`
- `/count/<uuid:pk>/`

**Feed** (`/api/v1/feed/`)
- `/`
- `/ranked/`
- `/trending/`
- `/signal/`
- `/attachments/upload/`
- `/attachments/<uuid:pk>/`
- `/create/`
- `/my/`
- `/<uuid:pk>/`
- `/<uuid:pk>/like/`
- `/<uuid:pk>/pin/`
- `/<uuid:pk>/attachments/`

**Notifications** (`/api/v1/notifications/`)
- `/`
- `/<uuid:pk>/read/`
- `/read-all/`
- `/unread-count/`
- `/devices/`
- `/devices/register/`
- `/devices/unregister/`
- `/preferences/`
- `/push/test/`
- `/push/status/`

**Onboarding** (`/api/v1/onboarding/`)
- `/status/`
- `/steps/`
- `/step/`
- `/skip/`
- `/founder-profile/`
- `/startup/`
- `/investor-profile/`

**Analytics** (`/api/v1/analytics/`)
- `/profile-views/`
- `/profile-views/stats/`
- `/dashboard/`
- `/dashboard/users/`
- `/dashboard/engagement/`
- `/dashboard/intros/`
- `/dashboard/time-series/`
- `/dashboard/real-time/`
- `/dashboard/daily/`
- `/dashboard/comparison/`
- `/dashboard/recalculate/`

**Search** (`/api/v1/search/`)
- `/`
- `/messages/`
- `/feed/`
- `/users/`
- `/startups/`
- `/autocomplete/`
- `/status/`

**Chat (REST)** (`/api/v1/chat/`)
- `/conversations/`
- `/conversations/<uuid:pk>/`
- `/conversations/<uuid:pk>/messages/`
- `/conversations/<uuid:pk>/messages/create/`
- `/conversations/<uuid:pk>/read/`
- `/conversations/<uuid:pk>/participants/add/`
- `/conversations/<uuid:pk>/participants/remove/`
- `/conversations/<uuid:pk>/leave/`
- `/dm/`
- `/groups/`
- `/unread-count/`
- `/messageable-users/`
- `/upload/`
- `/presence/`
- `/status/<uuid:user_id>/`
- `/status/`
- `/conversations/<uuid:conversation_id>/typing/`
- `/health/`
- `/metrics/`
- `/messages/<uuid:message_id>/reactions/`
- `/messages/<uuid:message_id>/reactions/add/`
- `/messages/<uuid:message_id>/reactions/remove/`
- `/messages/<uuid:message_id>/reactions/toggle/`
- `/messages/<uuid:message_id>/edit/`
- `/messages/<uuid:message_id>/history/`
- `/messages/<uuid:message_id>/delete/`

**Chat E2EE** (`/api/v1/chat/e2ee/`)
- `/keys/register/`
- `/keys/<uuid:user_id>/`
- `/keys/prekeys/`
- `/keys/prekeys/status/`
- `/keys/signed-prekey/rotate/`
- `/backup/`
- `/messages/send/`
- `/messages/pending/`
- `/messages/acknowledge/`
- `/status/`

**Chat Bots** (`/api/v1/chat/bots/`)
- `/`
- `/create/`
- `/<uuid:bot_id>/`
- `/<uuid:bot_id>/regenerate-key/`
- `/commands/`
- `/<uuid:bot_id>/commands/`
- `/<uuid:bot_id>/webhooks/`
- `/conversations/add/`
- `/conversations/remove/`
- `/api/send/`

**Chat Calls** (`/api/v1/chat/calls/`)
- `/initiate/`
- `/<uuid:call_id>/`
- `/<uuid:call_id>/answer/`
- `/<uuid:call_id>/decline/`
- `/<uuid:call_id>/end/`
- `/<uuid:call_id>/leave/`
- `/<uuid:call_id>/media/`
- `/<uuid:call_id>/signal/`
- `/<uuid:call_id>/quality/`
- `/history/`
- `/active/<uuid:conversation_id>/`
- `/ice-servers/`

**Core (URL Shortener + Audit)** (`/api/v1/`)
- `/shorten/`
- `/urls/`
- `/urls/<uuid:pk>/`
- `/urls/<uuid:pk>/stats/`
- `/audit/`
- `/audit/<uuid:log_id>/`
- `/audit/user/<uuid:user_id>/`
- `/audit/stats/`
- `/audit/security/`
- `/audit/export/`

**WebSockets**
- `ws/chat/`
- `ws/calls/`

**Not Mounted Yet**
- Integrations endpoints exist in `ff_backend/integrations/urls.py` but are not included in `config/urls.py` as of February 6, 2026.

## Notes
- This is a **frontend-only** application designed to connect to an external API
- Backend is not running (intentionally)
- API calls use VITE_API_BASE_URL environment variable
