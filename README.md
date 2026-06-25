# Auto Repair Shop SaaS Platform

A production-grade, multi-tenant, multi-location Auto Repair Shop SaaS Platform built on a fully serverless AWS architecture.

## Applications

| App | Platform | Path | Status |
|---|---|---|---|
| Customer App | iOS + Android (React Native / Expo) | `apps/customer-app/` | Phase 0 ✅ |
| Admin Mobile App | iOS (React Native / Expo) | `apps/admin-app/` | Phase 0 ✅ |
| Admin Web Portal | Web (React + Vite) | `apps/admin-portal/` | Phase 0 ✅ |
| Backend | AWS Serverless | `backend/` | Phase 1 🔜 |

## Phase Status

| Phase | Description | Status |
|---|---|---|
| Phase 0 | Application Skeletons | ✅ Complete |
| Phase 1 | AWS Foundation (CF, API GW, Lambda, DynamoDB, Cognito) | 🔜 Pending |
| Phase 2 | Authentication & Authorization | 🔜 Pending |
| Phase 3 | Tenant & Location Onboarding | 🔜 Pending |
| Phase 4 | Vehicle Management & NHTSA Integration | 🔜 Pending |
| Phase 5 | Service Management | 🔜 Pending |
| Phase 6 | Appointment Booking Engine | 🔜 Pending |
| Phase 7 | Capacity Management | 🔜 Pending |
| Phase 8 | Blocked Times | 🔜 Pending |
| Phase 9 | Promotions | 🔜 Pending |
| Phase 10 | Marketing Campaigns | 🔜 Pending |
| Phase 11 | Analytics Dashboard | 🔜 Pending |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI (for device builds): `npm install -g eas-cli`

---

## Customer App

**Technology:** React Native + Expo (TypeScript)

```bash
cd apps/customer-app
npm install
npx expo start
```

### Run Options

| Command | Target |
|---|---|
| `npx expo start` | Opens Expo Dev Tools (choose target from there) |
| `npx expo start --ios` | iOS Simulator |
| `npx expo start --android` | Android Emulator |
| `npx expo start --web` | Web Browser |

### Physical Device
1. Install **Expo Go** from the App Store or Google Play
2. Run `npx expo start`
3. Scan the QR code with Expo Go (Android) or Camera app (iOS)

---

## Admin Mobile App

**Technology:** React Native + Expo (TypeScript)

```bash
cd apps/admin-app
npm install
npx expo start
```

Same run options as Customer App above.

---

## Admin Web Portal

**Technology:** React + Vite (TypeScript)

```bash
cd apps/admin-portal
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

---

## Architecture

See [ADR.md](./ADR.md) for full Architecture Decision Record covering:

- Tenant Isolation Strategy
- Location Isolation Strategy
- DynamoDB Design
- Cognito Architecture
- API Versioning
- Cost Estimates (10 → 10,000 shops)

---

## Project Structure

```
auto-repair/
├── ADR.md                    Architecture Decision Record
├── README.md                 This file
├── apps/
│   ├── customer-app/         Customer iOS + Android app
│   ├── admin-app/            Admin iOS app
│   └── admin-portal/         Admin web portal
└── backend/                  AWS Serverless backend (Phase 1+)
    ├── functions/            Lambda functions
    ├── infrastructure/       CloudFormation templates
    └── shared/               Shared utilities and types
```

---

## Design System

| Token | Value | Usage |
|---|---|---|
| Primary | `#0F2044` | Navigation, headers, buttons |
| Secondary | `#F59E0B` | Accents, highlights, CTAs |
| Background | `#F1F5F9` | Screen backgrounds |
| Surface | `#FFFFFF` | Cards, modals |
| Text Primary | `#1E293B` | Main text |
| Text Secondary | `#64748B` | Subtitles, placeholders |
| Border | `#E2E8F0` | Dividers, card borders |

---

## Multi-Tenant Architecture

Every API call, database query, and UI operation is scoped by:

```
tenantId + locationId
```

Example tenant hierarchy:
```
Joe's Auto Repair (Tenant)
  ├── San Jose (Location)
  ├── Fremont (Location)
  └── Oakland (Location)
```

No data crosses tenant boundaries. See ADR.md for full isolation strategy.
