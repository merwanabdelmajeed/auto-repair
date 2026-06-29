# Auto Repair Shop SaaS Platform

A production-grade, multi-tenant, multi-location Auto Repair Shop SaaS Platform built on a fully serverless AWS architecture.

## Applications

| App | Platform | Path | Status |
|---|---|---|---|
| Customer App | iOS + Android (React Native / Expo) | `apps/customer-app/` | Phase 6 🔄 |
| Admin Mobile App | iOS + Android (React Native / Expo) | `apps/admin-app/` | Phase 6 🔄 |
| Admin Web Portal | Web (React + Vite) | `apps/admin-portal/` | Phase 6 🔄 |
| Backend | AWS Serverless (SAM) | `backend/` | Phase 6 🔄 |

## Phase Status

| Phase | Description | Status |
|---|---|---|
| Phase 0 | Application Skeletons | ✅ Complete |
| Phase 1 | AWS Foundation + Authentication | ✅ Complete |
| Phase 2 | Core Business Features (Services, Vehicles, Bookings, Live Dashboard) | ✅ Complete |
| Phase 3 | Email Notifications + Customer Names + All Admin Screens | ✅ Complete |
| Phase 4 | Capacity Management + Blocked Times | ✅ Complete |
| Phase 5 | Promotions + Booking UX Polish | ✅ Complete |
| Phase 6 | Customer Experience & Vehicle Intelligence | 🔄 In Progress |
| Phase 7 | Analytics & Reporting | 🔜 Pending |
| Phase 8 | Notifications & Communication | 🔜 Pending |
| Phase 9 | Admin & Multi-Location Management | 🔜 Pending |
| Phase 10 | Data Integrity, Scale & Production Hardening | 🔜 Pending |

---

### Phase 2 Delivered
- Service catalog — full CRUD (admin portal + admin app)
- Vehicle management — add / delete (customer app)
- 4-step booking flow — service → date/time → vehicle → confirm (customer app)
- Appointment management — status transitions (admin portal + admin app)
- Live KPI dashboard — bookings today, customers, vehicles, revenue (admin portal + admin app)
- Customer list (admin portal + admin app)
- PostConfirmation Lambda — writes customer record on signup
- API Gateway Cognito Authorizer using ID token

### Phase 3 Delivered
- SES email notifications on appointment status change
- First + last name collected at customer registration
- Customer name shown in Bookings views (admin portal + admin app)
- Admin portal Vehicles page — real data
- Admin app ServicesScreen — full CRUD with modal
- Admin app CustomersScreen — real data, search by name or email
- Admin app VehiclesScreen — real data, search by make / model / plate / VIN
- Customer app SettingsScreen — account card + sign out

### Phase 4 Delivered
- Availability API — returns open/closed status + time slots with booked counts per date
- Capacity settings — configurable slot duration, max concurrent bookings, per-day operating hours
- Blocked times — label + date range blocks that close availability for a given period
- Customer booking flow — date strip + slot chip grid replaces free-text date/time input; unavailable slots shown as greyed out
- 409 Conflict on booking if selected slot is full or outside operating hours
- Status change confirmation — Alert dialog (admin app) and inline modal (admin portal) before advancing or cancelling
- Admin app: Capacity screen + Blocked Times screen
- Admin portal: Capacity page + Blocked Times page
- Time display: 12-hour AM/PM format in capacity UI; slot chips already 12h in customer app
- Default schedule: 30-min slots, 7:00 AM – 5:00 PM Mon–Sat, Sunday closed (last slot 4:30 PM)

### Phase 5 Delivered
- **Promotions** — full CRUD (admin app + portal): create/edit modal, code read-only in edit mode, active/inactive toggle, expiry date, max uses, percent/fixed discount type
- **Promo apply** — admin marks a promo code as applied against an appointment; optimistic UI update with revert on failure; per-customer usage tracked in DynamoDB to prevent reuse
- **Status picker — admin app** — custom React Native bottom sheet modal replaces Alert sheet: forward action buttons (color-coded by target status) + "Cancel Appointment" and "Dismiss" side-by-side; shared component across Bookings and Dashboard screens
- **Status picker — admin portal** — anchor-relative popover that opens centered on the clicked status badge; auto-positions above/below based on viewport space; scale + fade animation
- **Today's Bookings dashboard** — Promo, Status, and Actions columns added to both admin app and portal dashboard; status badge tappable (▾) when transitions are available
- **Appointments sort** — admin Bookings (app + portal) sorted ascending by scheduled date; customer app appointment list has a clickable ↑/↓ date sort toggle
- **Valid transitions** — `VALID_NEXT` map: `pending → confirmed/cancelled`, `confirmed → in-progress/cancelled`, `in-progress → completed/cancelled`

### Phase 6 Delivered (so far)
- **NHTSA vehicle form** — year-first form with cascading NHTSA lookups: year → make → model (year+make-specific) → trim (dropdown when NHTSA has variants, free-text fallback); VIN at top auto-fills all fields; duplicate model name deduplication
- **Trim intelligence** — trim variants extracted from NHTSA model-name entries (e.g. "GLS 450 4MATIC"); cached per make+year+model; `trimsFetched` state drives dropdown vs. free-text toggle
- **License plate optional** — backend and customer app updated; admin portal handles null gracefully
- **Trim in vehicle summary** — `vehicleSummary` in appointments includes trim (e.g. "2021 Mercedes GLS 450 4MATIC"); admin vehicles table shows trim in name column
- **Phone number** — collected at customer registration (optional); stored as `custom:phone` Cognito attribute + DynamoDB; displayed in admin app customer cards and admin portal customer table; included in search

### Phase 6 Remaining
- Customer profile editing — update name and phone from the customer app Settings screen
- Appointment & vehicle history — per-vehicle service history view in customer app

---

### Phase 7 — Analytics & Reporting (Pending)
- **Analytics dashboard** — real revenue totals, bookings over time chart, service popularity breakdown, daily/weekly/monthly periods
- **Customer retention metrics** — repeat vs. new customer ratio, average visits per customer
- **Data export** — CSV download for bookings and customer lists (admin portal)
- **Dashboard date range picker** — filter KPIs by custom date range

### Phase 8 — Notifications & Communication (Pending)
- **Push notifications** — Expo Notifications + AWS SNS: appointment reminders (24h before), status change alerts delivered to customer device
- **Email verification** — remove PreSignUp auto-confirm; Cognito sends OTP to email on signup; add verification code screen to customer app registration flow
- **SMS notifications** — requires phone verification (migrate from `custom:phone` to standard `phone_number` Cognito attribute in E.164 format + SNS/Pinpoint origination)
- **In-app notification center** — admin app + portal notification feed using `autorepair-notifications` DynamoDB table (already provisioned)

### Phase 9 — Admin & Multi-Location Management (Pending)
- **Admin user invite flow** — tenant owner sends invite link/code; invitee registers via admin app; replaces current manual Cognito user creation
- **Role management UI** — tenant owner can assign/revoke Location Manager role per location
- **Location management UI** — create/edit/deactivate locations; assign services and capacity settings per location
- **Multi-location booking** — customer selects shop location before choosing a time slot
- **Tenant profile** — shop name, address, logo, contact info configurable from admin portal Settings page

### Phase 10 — Data Integrity, Scale & Production Hardening (Pending)
- **Pagination** — DynamoDB `LastEvaluatedKey` loop + cursor-based API endpoints + `FlatList` `onEndReached` in admin app + server-side paginated tables in admin portal (currently all lists silently truncate at 1MB)
- **Atomic slot booking** — replace check-then-write with DynamoDB conditional PutItem + atomic counter to eliminate concurrent booking race condition
- **Availability GSI** — add GSI on `tenantId + scheduledDate` to replace full-table FilterExpression scans on appointment queries
- **Rate limiting** — AWS WAF on API Gateway; per-tenant request throttling
- **Multi-environment** — dev / staging / prod SAM parameter overrides; separate Cognito pools and DynamoDB tables per environment
- **Custom domain + CDN** — CloudFront distribution for admin portal; custom domain via Route 53 + ACM
- **Observability** — CloudWatch alarms on Lambda error rates and p99 latency; structured JSON logging across all functions

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

### Screens
| Screen | Description |
|---|---|
| Login / Register | Email + password auth; first name, last name, phone (optional) on registration |
| Appointments | Upcoming / past tabs, date strip + slot picker booking modal, cancel, sort toggle |
| Vehicles | Add / delete vehicles; NHTSA-driven year → make → model → trim cascade; VIN auto-fill |
| Settings | Account info, sign out |

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

### Screens
| Screen | Description |
|---|---|
| Login | Email + password, handles new-password challenge |
| Dashboard | Live KPIs, today's bookings with inline status bottom sheet and promo apply |
| Bookings | Appointment list, status tabs, bottom-sheet status picker, promo apply |
| Customers | Customer list with name, email, phone, joined date; searchable by name / email / phone |
| Vehicles | All tenant vehicles, searchable by make / model / plate / VIN; trim shown in name |
| Services | Full CRUD — add, edit, delete, active toggle |
| Promotions | Full CRUD — create/edit modal, active/inactive card toggle |
| Capacity | Slot duration, max concurrent, per-day operating hours |
| Blocked Times | Block date ranges from accepting bookings |

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

### Pages
| Page | Description |
|---|---|
| Dashboard | Live KPIs, today's bookings with inline popover status picker and promo apply |
| Bookings | Appointment table, status tabs, popover status picker, promo apply |
| Customers | Customer table with name, email, phone, status, joined date; searchable by name / email / phone |
| Vehicles | All tenant vehicles with trim; searchable by make / model / plate / VIN |
| Services | Full CRUD — add, edit, delete, active toggle |
| Promotions | Full CRUD — create/edit modal, active/inactive card toggle |
| Capacity | Slot duration, max concurrent, per-day operating hours |
| Blocked Times | Block date ranges from accepting bookings |

### Environment variables (`apps/admin-portal/.env`)

```
VITE_COGNITO_USER_POOL_ID=
VITE_COGNITO_PORTAL_CLIENT_ID=
VITE_API_BASE_URL=
```

---

## Backend

**Technology:** AWS SAM — Lambda (Node 20, TypeScript, arm64) + API Gateway + Cognito + DynamoDB + SES + S3

```bash
cd backend
npm install
sam build
sam deploy          # first time: sam deploy --guided
```

### AWS Resources (deployed to us-east-1)

| Resource | Details |
|---|---|
| Cognito User Pool | Single pool, 3 app clients (customer, admin-mobile, admin-portal), 4 user groups |
| DynamoDB | 12 tables, on-demand billing, PK/SK pattern with GSIs |
| S3 | 2 buckets (uploads + assets), versioning enabled |
| API Gateway | REST API, regional endpoint, `/prod` stage, Cognito authorizer |
| SES | Appointment status change emails (sandbox — sender: verified email) |
| Lambda | 12 functions — see table below |

### Lambda Functions

| Function | Trigger | Purpose |
|---|---|---|
| `autorepair-pre-signup` | Cognito PreSignUp | Auto-confirm customers, block self-signup for admin clients |
| `autorepair-post-confirmation` | Cognito PostConfirmation | Write customer record to DynamoDB on signup |
| `autorepair-health` | GET /health | Health check (no auth) |
| `autorepair-services` | GET/POST/PUT/DELETE /services | Service catalog CRUD |
| `autorepair-vehicles` | GET/POST/DELETE /vehicles | Vehicle management |
| `autorepair-appointments` | GET/POST/PATCH /appointments | Booking flow + status updates + SES email |
| `autorepair-customers` | GET /customers | Customer list (admin only) |
| `autorepair-dashboard` | GET /dashboard/summary | KPI aggregation |
| `autorepair-capacity` | GET/PUT /capacity | Slot duration, max concurrent, operating hours |
| `autorepair-blocked-times` | GET/POST/DELETE /blocked-times | Date range blocks |
| `autorepair-availability` | GET /availability | Available slots for a given date |
| `autorepair-promotions` | GET/POST/PUT /promotions + POST /promotions/{id}/apply | Promotions CRUD + per-customer apply |

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
├── ADR.md
├── README.md
├── apps/
│   ├── customer-app/             Customer iOS + Android app
│   ├── admin-app/                Admin iOS + Android app
│   └── admin-portal/             Admin web portal (React + Vite)
└── backend/
    ├── src/
    │   ├── functions/
    │   │   ├── auth/
    │   │   │   ├── preSignUp/    Cognito Pre-SignUp trigger
    │   │   │   └── postConfirmation/ Cognito Post-Confirmation trigger
    │   │   ├── health/           GET /health
    │   │   ├── services/         Service catalog CRUD
    │   │   ├── vehicles/         Vehicle management
    │   │   ├── appointments/     Booking flow + SES notifications
    │   │   ├── customers/        Customer list
    │   │   ├── dashboard/        KPI aggregation
    │   │   ├── capacity/         Slot duration, max concurrent, operating hours
    │   │   ├── blocked-times/    Date range blocks
    │   │   ├── availability/     Available slots for a given date
    │   │   └── promotions/       Promotions CRUD + per-customer apply
    │   └── shared/
    │       ├── middleware/        Tenant claim extraction
    │       ├── types/             Shared TypeScript interfaces
    │       └── utils/             DynamoDB client, SES client, HTTP responses, availability logic
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
