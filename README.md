# Auto Repair Shop SaaS Platform

A production-grade, multi-tenant, multi-location Auto Repair Shop SaaS Platform built on a fully serverless AWS architecture.

## Applications

| App | Platform | Path | Status |
|---|---|---|---|
| Customer App | iOS + Android (React Native / Expo) | `apps/customer-app/` | Phase 1 ✅ |
| Admin Mobile App | iOS + Android (React Native / Expo) | `apps/admin-app/` | Phase 1 ✅ |
| Admin Web Portal | Web (React + Vite) | `apps/admin-portal/` | Phase 1 ✅ |
| Backend | AWS Serverless (SAM) | `backend/` | Phase 1 ✅ |

## Phase Status

| Phase | Description | Status |
|---|---|---|
| Phase 0 | Application Skeletons | ✅ Complete |
| Phase 1 | AWS Foundation + Authentication | ✅ Complete |
| Phase 2 | Core Business Features (Services, Vehicles, Bookings, Live Dashboard) | 🔜 Next |
| Phase 3 | Capacity Management + Blocked Times | 🔜 Pending |
| Phase 4 | Promotions + Marketing Campaigns | 🔜 Pending |
| Phase 5 | Analytics Dashboard | 🔜 Pending |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- AWS CLI + AWS SAM CLI (for backend deployment)
- Android Studio with an emulator (for Android development)
- Xcode (for iOS development — Mac only)

### Environment Setup

Each app reads from a `.env` file. Copy the example and fill in the values from your AWS stack outputs:

```bash
cp apps/customer-app/.env.example apps/customer-app/.env
cp apps/admin-app/.env.example apps/admin-app/.env
cp apps/admin-portal/.env.example apps/admin-portal/.env
```

---

## Customer App

**Technology:** React Native + Expo bare workflow (TypeScript)

```bash
cd apps/customer-app
npm install
npx expo run:android   # Android emulator
npx expo run:ios       # iOS simulator (Mac only)
```

> Uses `expo-dev-client`. Do not use `npx expo start` — it requires a native build.

### Environment variables (`apps/customer-app/.env`)

```
EXPO_PUBLIC_COGNITO_USER_POOL_ID=
EXPO_PUBLIC_COGNITO_CUSTOMER_CLIENT_ID=
EXPO_PUBLIC_API_BASE_URL=
```

---

## Admin Mobile App

**Technology:** React Native + Expo bare workflow (TypeScript)

```bash
cd apps/admin-app
npm install
npx expo run:android   # Android emulator
npx expo run:ios       # iOS simulator (Mac only)
```

> Uses `expo-dev-client`. Do not use `npx expo start` — it requires a native build.

### Environment variables (`apps/admin-app/.env`)

```
EXPO_PUBLIC_COGNITO_USER_POOL_ID=
EXPO_PUBLIC_COGNITO_ADMIN_CLIENT_ID=
EXPO_PUBLIC_API_BASE_URL=
```

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

### Environment variables (`apps/admin-portal/.env`)

```
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_PORTAL_CLIENT_ID=
VITE_API_BASE_URL=
```

---

## Backend

**Technology:** AWS SAM — Lambda (Node 20, TypeScript, arm64) + API Gateway + Cognito + DynamoDB + S3

```bash
cd backend
npm install
sam build
sam deploy          # first time: sam deploy --guided
```

### AWS Resources (deployed to us-east-1)

| Resource | Details |
|---|---|
| Cognito User Pool | Single pool, 3 app clients, 4 user groups |
| DynamoDB | 12 tables, on-demand billing, PK/SK pattern |
| S3 | 2 buckets (uploads + assets), versioning enabled |
| API Gateway | REST API, regional endpoint, `/prod` stage |
| Lambda | PreSignUp trigger + Health endpoint |

### Cognito User Groups

| Group | Who |
|---|---|
| `super-admins` | Platform administrators |
| `tenant-owners` | Shop owners |
| `location-managers` | Location-level staff |
| `customers` | End customers |

---

## Architecture

See [ADR.md](./ADR.md) for the full Architecture Decision Record covering:

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
├── ADR.md                        Architecture Decision Record
├── README.md                     This file
├── apps/
│   ├── customer-app/             Customer iOS + Android app
│   ├── admin-app/                Admin iOS + Android app
│   └── admin-portal/             Admin web portal (React + Vite)
└── backend/                      AWS Serverless backend
    ├── src/
    │   ├── functions/
    │   │   ├── auth/preSignUp/   Cognito Pre-SignUp trigger
    │   │   └── health/           GET /health
    │   └── shared/
    │       ├── middleware/        Tenant claim extraction
    │       ├── types/             Shared TypeScript interfaces
    │       └── utils/             DynamoDB client, HTTP response helpers
    ├── template.yaml             SAM template (all AWS resources)
    └── samconfig.toml            SAM deploy configuration
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

No data crosses tenant boundaries. See ADR.md for the full isolation strategy.
