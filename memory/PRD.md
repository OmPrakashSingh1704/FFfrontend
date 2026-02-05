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
   - **Notification bell icon added to header** (next to theme toggle and logout)
   - Mobile menu
   - Theme toggle

6. **Internal Pages Styling (Fixed Dec 2025)**
   - Search page with styled input and button
   - Uploads page with hidden file inputs and styled buttons
   - Admin page with styled forms, search, and cards
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

## Notes
- This is a **frontend-only** application designed to connect to an external API
- Backend is not running (intentionally)
- API calls use VITE_API_BASE_URL environment variable
