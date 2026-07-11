# Auto Repair Shop SaaS Platform

A production-grade, multi-tenant, multi-location Auto Repair Shop SaaS Platform built on a fully serverless AWS architecture.

## Applications

| App              | Platform                            | Path                 | Status     |
| ---------------- | ----------------------------------- | -------------------- | ---------- |
| Customer App     | iOS + Android (React Native / Expo) | `apps/customer-app/` | Phase 6 ✅ |
| Admin Mobile App | iOS + Android (React Native / Expo) | `apps/admin-app/`    | Phase 7 ✅ |
| Admin Web Portal | Web (React + Vite)                  | `apps/admin-portal/` | Phase 7 ✅ |
| Backend          | AWS Serverless (SAM)                | `backend/`           | Phase 7 ✅ |

## Phase Status

| Phase    | Description                                                           | Status         |
| -------- | --------------------------------------------------------------------- | -------------- |
| Phase 0  | Application Skeletons                                                 | ✅ Complete    |
| Phase 1  | AWS Foundation + Authentication                                       | ✅ Complete    |
| Phase 2  | Core Business Features (Services, Vehicles, Bookings, Live Dashboard) | ✅ Complete    |
| Phase 3  | Email Notifications + Customer Names + All Admin Screens              | ✅ Complete    |
| Phase 4  | Capacity Management + Blocked Times                                   | ✅ Complete    |
| Phase 5  | Promotions + Booking UX Polish                                        | ✅ Complete    |
| Phase 6  | Customer Experience & Vehicle Intelligence                            | ✅ Complete    |
| Phase 7  | Analytics & Reporting                                                 | ✅ Complete    |
| Phase 8  | Notifications & Communication                                         | 🟡 In Progress |
| Phase 9  | Admin & Multi-Location Management                                     | ✅ Complete    |
| Phase 10 | Unit Testing (Frontend & Backend)                                     | ✅ Complete    |
| Phase 11 | Data Integrity, Scale & Production Hardening                          | 🟡 In Progress |
| Phase 12 | Tenant Onboarding & White-Label App Distribution                      | 🔜 Pending     |
| Phase 13 | Tenant Billing & Subscriptions                                        | 🔜 Pending     |
| Phase 14 | Platform Owner Dashboard (adds Dashboard section to Phase 12's app)   | 🔜 Pending     |

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
- DynamoDB `LastEvaluatedKey` pagination loops — `queryAll`/`scanAll`/`queryCount` helpers in `shared/utils/dynamodb.ts` fully page through `Query`/`Scan` results server-side before returning, closing a silent-data-loss bug where any single-page response over 1MB (or any `Select: COUNT` query — a single page's count was only a partial total) would drop data with no error. Applied across appointments, availability, customers, vehicles, promotions, services, blocked times, dashboard KPIs, analytics, and the cross-tenant reminder scan. Endpoints still return one full response rather than exposing pagination to clients — see Phase 11

### Phase 3 Delivered

- ~~SES email notifications on appointment status change~~ — removed (see Phase 8: push + in-app notifications replace this)
- First + last name collected at customer registration
- Customer name shown in Bookings views (admin portal + admin app)
- Admin portal Vehicles page — real data
- Admin app ServicesScreen — full CRUD with modal
- Admin app CustomersScreen — real data, search by name or email
- Admin app VehiclesScreen — real data, search by make / model / plate / VIN
- Customer app SettingsScreen — account card + sign out

### Phase 4 Delivered

- Availability API — returns open/closed status + time slots with booked counts per date; queries a `tenantId + scheduledAt` GSI (GSI2) directly rather than scanning a tenant's full appointment history with a `FilterExpression`
- Capacity settings — configurable slot duration, max concurrent bookings, per-day operating hours, and a separate per-day last-appointment cutoff (the shop can stay open later than it accepts new bookings)
- Blocked times — label + date range blocks that close availability for a given period
- Customer booking flow — date strip + slot chip grid replaces free-text date/time input; unavailable slots shown as greyed out
- 409 Conflict on booking if selected slot is full or outside operating hours — enforced by an atomic DynamoDB counter per slot (`TransactWriteItems`, conditional on `count < maxConcurrent`), not just a check-then-write read, so two concurrent booking requests for the last open slot can't both succeed; the counter decrements when a booking is newly cancelled
- Status change confirmation — Alert dialog (admin app) and inline modal (admin portal) before advancing or cancelling
- Admin app: Capacity screen + Blocked Times screen
- Admin portal: Capacity page + Blocked Times page
- Time display: 12-hour AM/PM format in capacity UI; slot chips already 12h in customer app
- Default schedule: 30-min slots, 7:00 AM – 5:30 PM Mon–Sat, Sunday closed, last appointment accepted at 3:30 PM (a separate `lastAppointment` cutoff per day, independent of the shop's actual closing time — older tenant records without it fall back to the previous behavior of last-slot = close minus slot duration)

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
- ~~Phone number collected at customer registration~~ — removed 2026-07-09 from the customer-app UI, see Phase 11 below. Admin app/portal customer cards and search still show/filter on phone for any pre-existing data, but no new customer will have one going forward
- **Vehicle inline edit in booking detail** — Bookings and Dashboard detail panels (admin app + portal) show an expandable vehicle section with Plate, Color, VIN, and Added date; Plate and VIN are editable inline via `PUT /vehicles/{vehicleId}`; admin app values are selectable (press-and-hold to copy)
- **Promotions detail view** — admin portal: clicking a row opens a right-side detail panel with status toggle, Edit, and Delete; Edit button removed from table Actions column; admin app: tapping a card opens a bottom sheet with the same actions
- **Dashboard bookings table** — admin portal today's bookings section converted from card layout to a full table matching the Bookings page exactly (same 7 columns, same hover and selected-row styles)
- **Services click-to-edit** — admin portal and admin app: clicking/tapping a service row/card opens the edit modal directly; standalone Edit button removed
- **Customer profile editing** — Profile screen in customer app: edit first name, last name, and phone number via bottom sheet modal; updates Cognito attributes in real time
- **Vehicle service history** — per-vehicle history modal in customer app Vehicles screen: lists all appointments booked for that vehicle with status, date, and service name

### Phase 7 Delivered

- **Price field on services** — optional `price` added to `Service` type and `ServiceInput` in both admin app and admin portal; stored and returned by `GET/POST/PUT /services`; shown in services table (portal) and card meta line (app); Duration + Price rendered as a 2-column row in the edit modal
- **Analytics Lambda** — `GET /analytics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` aggregates all appointments + services for the tenant; returns summary KPIs, per-day breakdown, per-service breakdown, and status counts; new and returning customers computed by comparing period customers against historical bookings; admin-role gated
- **Analytics API clients** — `apps/admin-portal/src/api/analytics.ts` and `apps/admin-app/src/api/analytics.ts` with typed `AnalyticsResponse`
- **Admin portal Statistics page** — full rewrite: Last 7 / 30 / 90 Days period toggle; 6-KPI grid (bookings, revenue, unique/new customers, avg service time, cancellation rate, returning customers); SVG bar chart with hover tooltips, switchable between Bookings and Revenue view, weekly grouping for 90-day period; horizontal service popularity bars with revenue; status breakdown with colored progress bars; CSV export (daily + service tables in one file)
- **Admin app Statistics screen** — full rewrite: 7D / 30D / 90D period tabs; 4-tile KPI grid; View-based bookings mini bar chart; service popularity list with progress bars and revenue; status breakdown with color-coded bars; non-blocking activity indicator on refresh

---

### Phase 8 — Notifications & Communication (In Progress)

Delivered:

- **Push notifications (Android)** — confirmed working end-to-end on a physical device. Expo push token registered on login (`autorepair-push-token`); appointment status changes (confirmed/cancelled/completed), new promotions, and 24h/2h appointment reminders all trigger a push via Expo's push API (`https://exp.host/--/api/v2/push/send`), not AWS SNS. Required native setup: `google-services.json` + Google Services Gradle plugin in `apps/customer-app/android/`, and an FCM V1 service account key uploaded via `eas credentials`
- **Reminder scheduler** — `autorepair-notification-reminder` runs hourly, scans appointments in the 24h and 2h windows, and sends each reminder at most once via a conditional DynamoDB update (idempotent even if the scan overlaps). Its `FilterExpression` used SQL-style `#s NOT IN (...)`, which isn't valid DynamoDB syntax (`NOT (#s IN (...))` is) — every hourly run failed silently since the function was created until the new CloudWatch `Errors` alarm caught it and this got fixed
- **In-app notification center** — customer app notification screen backed by `autorepair-notifications`; unread badge in the header bell, 30-second poll + refresh-on-foreground via `NotificationsContext`
- **Notification tap-to-navigate** — tapping a notification routes to the relevant screen: a promotion notification opens Promotions; an appointment notification (confirmed/cancelled/completed/reminder) navigates to Appointments with an `appointmentId` param, which auto-opens that appointment's detail modal then clears the param so it doesn't reopen on a later, unrelated screen focus
- **Admin-side notification center** — admin app (drawer entry + header bell with unread badge) and admin portal (bell dropdown in the header) both now have a real notification feed backed by the same `autorepair-notifications` API, triggered on two events: a customer books a new appointment, or a customer cancels one (not when an admin cancels it themselves — no self-notification). Fan-out now queries DynamoDB directly (see Phase 9). Tapping a notification deep-links to the Bookings list (`appointmentId` route param / `?appointmentId=` query param) and auto-opens that appointment's existing detail view
- **Notification bell fixes + "Mark all as read"** — the admin-app bell icon's touchable area was just the bare 24×24 icon glyph with no `hitSlop`, well under the usual ~44dp minimum tap target — the likely cause of it intermittently not registering taps; added `hitSlop` to both mobile bells (admin-app and customer-app share identical code). The unread badge no longer caps at `9+`, it always shows the real count, across all three apps. Added `PUT /notifications/read-all` (new `notifications` Lambda route) plus a "Mark all as read" control in each app's notification UI — safe per-admin by construction, since notifications were already stored one row per individual recipient (`PK = USER#{userId}`) rather than shared per tenant, so one admin marking their own notifications read can never touch another admin's or a customer's
- **Customer-cancel permission fix** — found while building the above: `PATCH /appointments/{id}/status` required an admin role for _any_ status change, including cancellation — but the customer app's own "Cancel" button calls this same endpoint. A real `CUSTOMER`-role account would have gotten a 403 trying to cancel; this had gone unnoticed because testing had only ever been done as the tenant-owner account. Fixed: customers may now cancel (only) their own (not any) appointment; admins retain full access to any valid status transition on any appointment
- **Admin app stale-data fix (found via real end-to-end testing)** — Dashboard (and 7 other screens: Bookings, Customers, Vehicles, Services, Capacity, Blocked Times, Promotions, Statistics) used a plain `useEffect` that only fires once on mount; since React Navigation drawer screens stay mounted in the background, navigating back never refetched, so Dashboard kept showing a cancelled appointment as "pending". Fixed all 8 to use `useFocusEffect`. Admin **portal** didn't have this bug — React Router fully remounts each route on navigation already
- **"Today's Bookings" now shows cancelled appointments** (both admin app and portal) with their Cancelled badge instead of silently hiding them — the KPI tile itself is unaffected, it comes from a separate backend-computed count that already excludes cancelled
- **Removed SES customer status-change emails** — push + in-app notifications already cover this, and SES sandbox mode was blocking delivery to unverified test recipients anyway; deleted `shared/utils/ses.ts` and the now-unused `ses:SendEmail` IAM permission
- **Push notifications (admin app, Android)** — confirmed working end-to-end on a physical device. Same `usePushNotifications` hook as the customer app, mirrored into admin-app; `notify.ts`'s `notifyAdmins()` no longer forces the push lookup to skip. Required its own native setup even though the Firebase project (`auto-repair-c4e99`) is shared with customer-app: registering `com.autorepair.admin` as a second Android app in that Firebase project + its own `google-services.json`/Gradle plugin wiring, a new EAS project (`eas init` — admin-app had none before), and its own FCM V1 service-account key uploaded via `eas credentials` for that project specifically (credentials are scoped per EAS project, not per Firebase project, so this step repeats even when reusing the same underlying key file). Debugging this surfaced a real observability gap: Expo's push API returns HTTP 200 for a request it *accepted*, not one it successfully *delivered* — the real per-notification result comes back as a "ticket" inside the response body (e.g. `DeviceNotRegistered`, `InvalidCredentials`), which `sendPush()` wasn't inspecting, so a bad send looked identical to a good one in the logs. Fixed by parsing the ticket status and logging ticket-level errors, not just HTTP-level ones
- **Push notifications (iOS)** — not yet set up; Android is confirmed working but iOS needs its own native configuration:
  - Apple Developer Program membership (paid) to generate an APNs authentication key
  - Upload the APNs key to EAS via `eas credentials` (iOS → Push Notifications), separate from the Android FCM V1 key
  - iOS push capability/entitlement (`aps-environment`) needs to be enabled — likely automatic via EAS Build, but unverified since this project has no native `ios/` directory yet (Android-only bare workflow so far)
  - Requires a Mac (Xcode) or EAS Build's cloud iOS build service, since there's no local `ios/` project to build from directly
  - Real push delivery can't be tested on the iOS Simulator — needs a physical iPhone/iPad

### Phase 9 — Admin & Multi-Location Management (Complete)

- **Admin user invite flow** — tenant owner invites a Location Manager or co-Owner from admin portal Settings (email + role + assigned locations); backend calls Cognito's `AdminCreateUser` directly, which auto-emails a temporary password (no SES/email setup needed) and writes a real DynamoDB `USER#` record immediately, since `AdminCreateUser`'d users never fire the `PostConfirmation_ConfirmSignUp` trigger. The invitee logs into the admin portal/app with the temp password and is forced through the existing new-password-challenge screen — no new registration screen was needed. This also unblocked `notify.ts`'s admin notification fan-out, which now queries DynamoDB directly instead of paginating/filtering Cognito's `ListUsers`
- **Role & access management UI** (admin portal Settings only) — list admin users with role/locations/status, invite modal, and per-user activate/deactivate (`AdminDisableUser`/`AdminEnableUser` + Cognito attribute sync) — a tenant owner can't deactivate or demote their own account through this endpoint
- **Location management UI** (admin portal Settings only) — full CRUD for locations (name/address/phone); deactivating a location is a soft-delete (`isActive: false`) since appointments/capacity/blocked-times reference it, and the last remaining active location can't be deactivated. Services intentionally stay tenant-wide, not per-location, to keep the booking flow simple — every location offers the same catalog
- **Multi-location booking** — customer picks a location as the first step of the booking flow, before service/date/time; capacity settings, blocked times, and the atomic slot-booking counter are now all scoped per-location (previously one shared counter per tenant), so two locations can independently book the same time slot without conflicting. Capacity and Blocked Times screens in both the admin app and admin portal gained a location selector
- **Tenant profile** — a real `Tenant` DynamoDB record + `GET/PUT /tenants/me`, wired to a working Business Profile form (name/address/phone/contact email) in admin portal Settings. Deliberately scoped to just this settings page — the `shop.config.json` build-time branding shown in headers/login screens across all 3 apps is untouched; unifying that into one live, per-tenant source is Phase 12's job
- **Admin login role gate (security fix)** — a customer account could log into admin-portal/admin-app: both apps only checked that Cognito auth succeeded, never that the account actually held an admin role. Fixed by rejecting non-admin roles (only `SUPER_ADMIN`/`TENANT_OWNER`/`LOCATION_MANAGER` allowed) at login, at the forced-password-change step, and on session restore, signing the account back out immediately if the check fails
- **Admin user delete** — tenant owners/super-admins can permanently remove a location manager or co-owner from admin portal Settings (`AdminDeleteUser` + DynamoDB record delete), gated to the same owner-only roles as invite; a user can't delete their own account. Found and fixed two real bugs while building this: the existing PATCH (role/location/status) endpoint checked the caller's own role but never verified the *target* user belonged to the caller's tenant — a cross-tenant authorization gap — and the deactivate/reactivate PATCH always sent both `#role`/`#status` into `ExpressionAttributeNames` even when only one was being updated, which DynamoDB rejects outright; this surfaced to admins as a false "Failed to update user" even though the underlying Cognito enable/disable call had already succeeded

### Phase 10 — Unit Testing (Frontend & Backend) (Complete)

Added after Phase 9 rather than left as an ongoing "someday" task: 9 phases had shipped with zero automated test coverage despite Jest already being configured in `backend/` (the `"test": "jest"` script existed, but `jest` itself was never installed), and several real bugs (the pagination truncation, the broken Cognito `ListUsers` filter, the invalid DynamoDB `NOT IN` expression) were only ever caught by production monitoring, not tests. This phase backfills coverage on the highest-value/highest-risk logic and establishes real per-package testing conventions; from Phase 11 onward, new work ships with tests as part of its own definition of done rather than deferring further. **52 tests across 10 suites, all 4 packages, all passing.**

- **Extraction refactors (no behavior change)** — the identically-duplicated `VALID_NEXT` appointment-status-transition map (4 copies across `admin-app`'s `BookingsScreen`/`DashboardScreen` and `admin-portal`'s `Bookings`/`Dashboard` pages) was hoisted into one shared `src/utils/appointmentTransitions.ts` per app; customer-app's private date-formatting helpers (`localDateStr`, `parseDateParts`, `fmt12h`, `fmtDate`) were moved out of `AppointmentsScreen.tsx` into `src/utils/bookingDate.ts`. Both were pure "make existing logic importable" moves, not new logic
- **Backend (Jest + ts-jest + `aws-sdk-client-mock`)** — 38 tests across 6 suites: `shared/utils/availability.test.ts` (slot generation, blocked-date boundaries, cancelled-appointment exclusion, the `lastAppointment` cutoff and its legacy fallback), `shared/utils/dynamodb.test.ts` (a direct regression test proving `queryAll`/`scanAll`/`queryCount` correctly loop across multiple pages — the exact bug class that caused the earlier silent 1MB truncation), `shared/middleware/tenant.test.ts` (claim extraction, role/tenant guards), and handler-level tests for `appointments`, `admin-users`, and `locations` mocking the DynamoDB Document Client and Cognito client directly rather than hitting a live table — covering the atomic booking transaction (success/409-conflict), location-scoping validation, the admin-invite role/locationId validation, and the two self-lockout guards (an owner can't deactivate their own account; can't deactivate a tenant's last active location)
- **`admin-portal` (Vitest + React Testing Library)** — the `VALID_NEXT` unit test, plus one component test rendering the real `Settings` page (mocking its API modules) to verify the self-lockout UI guard added in Phase 9's follow-up work actually hides the Deactivate/Reactivate button on the caller's own row
- **`admin-app` / `customer-app` (jest-expo + React Native Testing Library)** — tooling installed and working (pinned to the `jest`/`jest-expo` 29.x/52.x line to match this project's Expo SDK 52 — `npm install jest-expo` alone resolves to the latest major, which targets a much newer Expo SDK and silently breaks the preset), but **pure-logic unit tests only** this phase, matching "Unit Testing" literally — the `VALID_NEXT` test for admin-app and the full `bookingDate` helper suite for customer-app. No full-screen component-mounting tests yet; `@testing-library/react-native` is installed and ready for whenever that's taken on
- **No coverage-percentage gate at the time** — "done" for this phase meant the listed test files exist and pass, not a numeric threshold. A 70% overall coverage target was decided the same day; it's since been enforced across all 4 packages as part of Phase 11 (see below). No CI wiring (GitHub Actions or similar) either — tests are currently run locally via each package's `npm test`; automatically running them on every push is a natural follow-on, see "Future Improvements" further down

### Phase 11 — Data Integrity, Scale & Production Hardening (In Progress)

Delivered:

- **Structured JSON logging** — a shared `logger` util (`shared/utils/logger.ts`) replaces every ad-hoc `console.log`/`console.error` across all 17 deployed Lambda functions with structured `{ level, message, timestamp, ...meta }` JSON lines, so CloudWatch Logs Insights can query fields (e.g. `error.name`, `appointmentId`) directly instead of grepping free text. `Error` objects are explicitly serialized (name/message/stack), since they don't `JSON.stringify` usefully on their own
- **CloudWatch alarms** — an `Errors` alarm (any error within a 5-minute window) on all 17 functions, plus a p99 `Duration` alarm (>5s over two consecutive 5-minute windows) on the five latency-sensitive, synchronous request paths (appointments, availability, vehicles, plate-lookup, capacity). All alarms notify an SNS topic (`autorepair-alarms`) with an email subscription
- **Pagination — cursor-based API + paginated UI** — `customers`, `vehicles` (admin branch), and `appointments` (admin branch) now return `{ items, nextCursor }` instead of a flat array, backed by a shared `queryPage()` helper (`shared/utils/dynamodb.ts`) that base64-encodes DynamoDB's `LastEvaluatedKey` as an opaque client cursor (`?cursor=`/`?limit=`, capped at 100, default 25). `services` and `promotions` were deliberately excluded — their GET endpoints are shared unbranched with `customer-app`'s booking flow, which expects a flat array, and paginating them would have broken it. Client-side, a `fetchAllPages()` helper (both `admin-app` and `admin-portal`) loops through all pages so screens keep their existing full-dataset search/cross-reference/date-filter behavior unchanged — this was a deliberate design adjustment from true infinite-scroll, since e.g. the Dashboard's "today's bookings" filter needs to see every appointment (the appointments table's sort key is a random UUID, not chronological, so any single page could miss today's bookings). `admin-app`'s three list screens (Customers, Vehicles, Bookings) also switched from `ScrollView`+`.map()` to `FlatList` for virtualized rendering; `admin-portal`'s table-based pages needed no rendering change, just the `fetchAllPages` wiring
- **Multi-environment — template capability** — `template.yaml` gained an `Environment` parameter (`dev`/`staging`/`prod`, default `prod`) and an `EnvironmentMap` mapping to a name suffix, applied to every environment-scoped resource name (12 DynamoDB tables, Cognito pool/clients, S3 buckets, Lambda function names, CloudWatch alarms, IAM role/policy names, SNS topic, EventBridge schedule, and CloudFormation exports). `prod`'s suffix is empty specifically so redeploying the live stack with this template produces zero resource renames/replacements. `samconfig.toml` gained `[dev]`/`[staging]` profiles (distinct `stack_name`s, `Environment` parameter override) so `sam deploy --config-env dev` *could* stand up an independent stack — **no new stack has been deployed**, this is template/config capability only, per the roadmap decision above
- **Email verification (Cognito OTP)** — customer registration no longer auto-confirms; the `PreSignUp` trigger's `autoConfirmUser`/`autoVerifyEmail` overrides were removed (Cognito's `AutoVerifiedAttributes: [email]` was already set), so Cognito sends its own 6-digit code on signup. `customer-app` gained a `VerifyEmailScreen` (code entry + resend) wired into `RootNavigator`'s auth flow between Register and Login; `AuthContext.register()` no longer auto-logs-in immediately after signup (the account isn't confirmed yet) — login now happens right after successful code verification instead. Admin invites (`AdminCreateUser`) are unaffected, still land straight in `FORCE_CHANGE_PASSWORD`. Deployed and manually verified live: registration → OTP email → code entry → login, plus confirmed admin invites are unaffected
- ~~Phone verification (test/demo tier)~~ — originally a "Verify" step in `customer-app`'s Profile screen using Cognito's `getAttributeVerificationCode`/`verifyAttribute` APIs. Never actually worked in this AWS account (see the phone-primary rollback note below — no SMS origination path exists at all), so on 2026-07-09 the phone field and its Verify/Verified UI were removed entirely from `customer-app` (Register and Profile screens), rather than leave a visibly broken button in front of real customers. `CognitoService.ts`'s `sendPhoneVerificationCode()`/`confirmPhoneVerification()` and the `phone`/`phoneVerified` fields on `AuthUser` were deleted along with it. `template.yaml`'s `CognitoSmsRole`/`SmsConfiguration` and the `phone_number` Cognito attribute are unaffected (still provisioned, just unused by any current UI) — cheap to re-wire a Verify step later if SMS sending gets fixed
- **Phone-primary signup — attempted, then rolled back (2026-07-08/09)** — briefly replaced customer-app's email+password signup with phone+password (SMS OTP verifying the phone at signup, closing the gap where the Profile-screen phone verification above could be silently skipped). Reverted before shipping: the AWS account has no working SMS origination path at all (confirmed via the SNS/End User Messaging SMS APIs — zero phone numbers, sender IDs, or pools provisioned; the sandbox destination-number verification itself failed with `No origination entities available to send`), and getting one provisioned requires an AWS Support case with no guaranteed turnaround. Customer signup is back to email + password / email OTP as described above; revisit phone-primary once SMS sending is confirmed working end-to-end in this account
- **Test coverage threshold — all 4 packages now enforced at 70%** — the target decided in Phase 10 is no longer just a number on paper. Every package now sets an explicit coverage `include`/`collectCoverageFrom` glob (so the reported percentage reflects the whole codebase, not just whatever files the existing tests happened to import) plus a `70%` threshold on statements/branches/functions/lines — `test:coverage` now **fails the command** if coverage regresses below that, not just reports it.
- **Rate limiting (AWS WAF)** — a regional `AWS::WAFv2::WebACL` associated with the API Gateway `prod` stage, with a rate-based rule blocking any single source IP once it exceeds 2000 requests in a rolling 5-minute window (WAF's fixed evaluation window; not independently configurable). Generous enough not to throttle several legitimate users sharing one office/school NAT, while still catching scripted abuse against the REST API (booking spam, availability scraping, etc.). **Does not cover Cognito's own SignUp/OTP APIs** — those are called directly from the apps, never through this API Gateway, so they rely on Cognito's own built-in account-level quotas instead. No IAM/Lambda changes needed; pure CloudFormation resource plus one association.

Still pending:

- **Custom domain + CDN** — CloudFront distribution for admin portal; custom domain via Route 53 + ACM
- **SMS carrier registration (separate, one-time, do early — approval can take days):** this account currently has no working SMS send path at all — confirmed via the End User Messaging SMS APIs (zero phone numbers/sender IDs/pools provisioned) and an AWS Support case is pending. Phone verification/phone-primary signup are both parked until this is resolved (see above). Once fixed, real SMS volume still requires registering a dedicated sending identity with carriers — either a toll-free number ("toll-free verification") or a 10DLC long code ("campaign" registration in AWS End User Messaging/SNS terminology; not a marketing campaign, just carrier compliance for transactional messages) — since carriers increasingly filter unregistered SMS as spam past low volume.

### Phase 12 — Tenant Onboarding & White-Label App Distribution (Pending)

Decision: one native mobile app build per client (white-label), not one shared app serving all tenants. The backend is already multi-tenant (shared infra, `tenantId`-isolated data) and needs no changes for this; what's missing is a clean, non-manual way to produce and onboard each client's app.

- **Platform operator web app** — a new application (distinct from the existing per-tenant admin portal), authenticated as the platform operator, not any tenant's Cognito group. Phase 12 builds its first section, **Onboarding**: create a tenant record, capture branding (shop name, city, address, logo, colors), seed the tenant-owner Cognito account, and generate that client's app config. Replaces today's fully-manual process (hand-editing `shop.config.json`, hand-creating DynamoDB/Cognito records). Phase 14 adds a second section, **Dashboard**, to this same app — see below

- **Consolidate per-client config** — `tenantId` is currently a separate hardcoded constant (`DEFAULT_TENANT_ID` in `apps/customer-app/src/screens/RegisterScreen.tsx`), not part of `shop.config.json` alongside `shopName`/`shopCity`/`shopAddress`. Fold it in so a new client is genuinely a single config change, not a config file plus a source edit
- **Move to Continuous Native Generation** — both mobile apps currently commit prebuilt native `android/` folders and hardcode the package name/bundle identifier in `app.json`. That means changing a client's package name doesn't take effect without manually re-running `expo prebuild --clean`, which risks losing any native customizations. Moving to CNG (native folders generated fresh from config, not committed) makes bundle ID / app icon / app name fully config-driven per client build
- **Build/submit automation** — trigger `eas build` (and possibly `eas submit`) for a new client's app directly from the onboarding tool or a script, instead of a human running these by hand per client
- **Distribution model caveat** — full automation only works cleanly if every client's app is published under one shared Apple/Google developer account (just different bundle ID/branding per app). If any client wants their _own_ developer account / app store presence instead, that requires their direct involvement (account credentials, store agreements) and can't be centrally automated

### Phase 13 — Tenant Billing & Subscriptions (Pending)

Separate from Phase 12 on purpose: onboarding is a one-time "get this client set up" flow, billing is an ongoing concern a tenant owner manages for as long as they're a customer — different lifecycle, different UI surface, different failure modes to handle.

- **Payment processor integration** — Stripe (or similar) for recurring subscription billing; card data goes directly to the processor, never through our backend, so this doesn't pull the whole platform into PCI-DSS scope
- **Plan tiers** — pricing likely keyed off location count / booking volume / feature tier; depends on Phase 9's multi-location model existing first
- **Billing page in admin portal** — tenant owner views their current plan, updates payment method, sees invoice history, upgrades/downgrades/cancels
- **Initial plan selection during onboarding** — Phase 12's onboarding web app collects the first payment method/plan choice before a new tenant's app build kicks off
- **Backend webhook handler** — new Lambda receiving the payment processor's webhook events (payment succeeded/failed, subscription cancelled, etc.) to update each tenant's billing status in DynamoDB
- **Access enforcement on failed/lapsed payment** — needs a real decision: grace period length, a "payment past due" banner vs. hard lockout, and whether lockout applies to the admin portal only or the tenant's customer-facing app too

### Phase 14 — Platform Owner Dashboard / Super-Admin Portal (Pending)

Pulled out into its own phase rather than built as part of Phase 12, because it serves a different purpose and breaks a core architectural rule on purpose: every existing API and DynamoDB query in this platform is deliberately scoped to one tenant (`tenantId` off the caller's JWT), and this is the one piece of the system that intentionally needs to see _across_ tenants. It ships as a second section (**Dashboard**) added to the same platform-operator web app that Phase 12 builds — not a separate app — since both are tools only the platform operator uses, with the same login.

- **Adds a "Dashboard" section to the Phase 12 platform operator app** — same app, same auth, new tab/route; the underlying cross-tenant backend endpoints still need their own careful review since they're the one deliberate exception to tenant isolation in this codebase
- **Tenant roster** — list of all tenants, signup date, status (active/trial/past-due/cancelled), plan tier
- **Revenue reporting** — MRR and revenue-by-period (date range picker), fed by the billing status data written to DynamoDB by Phase 13's payment-webhook handler
- **Missed/failed payments view** — tenants currently past-due or in a failed-payment state, surfaced from the same billing status data
- **Churn / cancellations** — tenants who've cancelled, over time
- **Access control** — needs its own Cognito group (e.g. `platform-owner`) or a fully separate, smaller user pool; new backend endpoints that intentionally scan/aggregate across all tenants (the opposite of every other endpoint in this codebase, so these need to be reviewed carefully and locked down tightly)
- **Depends on Phase 13** — there's no billing/payment data to report on until the Stripe integration and webhook handler exist

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

### Shop Branding

`shop.config.json` (repo root) holds the shop's display name, city, and address. It's read at build time by `app.config.js` in both `customer-app` and `admin-app` and exposed via `src/constants.ts` (`SHOP_NAME`, `SHOP_CITY`, `SHOP_ADDRESS`) — no code changes needed to rebrand:

```json
{
  "shopName": "Purrfect Auto Service #17",
  "shopCity": "Lake Forest",
  "shopAddress": "20732 Lake Forest Dr suit b1, Lake Forest, CA 92630"
}
```

---

## Running Tests

Each package has its own independent test setup (this isn't an npm-workspaces monorepo, so `npm install` and the test command below both need to run from inside that package's directory). See Phase 10 and Phase 11 above for what's actually covered.

```bash
# Backend — Jest + ts-jest, mocked DynamoDB/Cognito clients (no AWS calls, no live table needed)
cd backend && npm test

# Customer App — jest-expo + React Native Testing Library, full component-mounting tests
cd apps/customer-app && npm test

# Admin Mobile App — jest-expo + React Native Testing Library, full component-mounting tests
cd apps/admin-app && npm test

# Admin Web Portal — Vitest + React Testing Library
cd apps/admin-portal && npm test
```

All four run non-interactively and exit after one pass (`jest`'s default in these packages, and admin-portal's `"test": "vitest run"` script) — none of them watch files or require AWS credentials, a running emulator, or a deployed backend.

### Coverage reports

Each package also has a `test:coverage` script that prints a per-file statement/branch/function/line breakdown to the terminal:

```bash
cd backend && npm run test:coverage           # Jest's built-in Istanbul coverage
cd apps/customer-app && npm run test:coverage # jest-expo, same Istanbul coverage
cd apps/admin-app && npm run test:coverage    # jest-expo, same Istanbul coverage
cd apps/admin-portal && npm run test:coverage # Vitest + @vitest/coverage-v8
```

All 4 packages set an explicit `collectCoverageFrom`/`coverage.include` glob covering their whole `src/`, so the reported percentage reflects the whole codebase rather than just whatever files the existing tests happen to import — and all 4 now enforce a **70% threshold on statements/branches/functions/lines**, so `test:coverage` exits non-zero if coverage regresses. Current numbers:

| Package | Statements | Branches | Functions | Lines | Threshold enforced? |
| --- | --- | --- | --- | --- | --- |
| `backend` | 83.69% | 76.68% | 85.71% | 86.14% | ✅ 70% |
| `apps/admin-portal` | 83.30% | 74.69% | 76.03% | 86.67% | ✅ 70% |
| `apps/customer-app` | 89.45% | 84.39% | 88.88% | 92.85% | ✅ 70% |
| `apps/admin-app` | 94.05% | 81.53% | 91.34% | 95.73% | ✅ 70% |

New code should keep these gates green — see "Contributing" below for what that means in practice.

### Future Improvements

- **CI wiring** — none of the four `test:coverage` gates above run automatically anywhere yet; they only run when someone remembers to run them locally. Standing up GitHub Actions (or similar) to run all four on every push/PR is the natural next step now that every package has a real threshold to enforce.

### Contributing

Every package enforces a 70% coverage floor on statements/branches/functions/lines — new code should ship with tests, not defer them. In practice:

- Any new handler/screen/page/component/util gets a corresponding `*.test.ts(x)` file in the same change, not a follow-up.
- Before considering a change done, run that package's `npm run test:coverage` and confirm it still exits 0 — don't just eyeball the number, since a regression under threshold fails the command.
- Bug fixes should add a regression test reproducing the bug, not just the fix.

---

## Customer App

**Technology:** React Native + Expo bare workflow (TypeScript)

```bash
cd apps/customer-app
npm install
npx expo run:android   # Android emulator / device — always runs on port 8081
npx expo run:ios       # iOS simulator (Mac only) — always runs on port 8081
```

> Uses `expo-dev-client`. Do not use `npx expo start` — it requires a native build. `adb reverse` is not required; Metro connects to the device automatically.

### Screens

| Screen           | Description                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login / Register | Email + password auth; first name, last name on registration                                                                                                              |
| Home             | Shop-branded header; welcome banner; Quick Actions; shop location card (today's operating hours, copy address, navigate via native maps app); active promotions preview   |
| Appointments     | Upcoming / past tabs, date strip + slot picker booking modal, cancel, sort toggle                                                                                         |
| Vehicles         | Add / delete vehicles; license plate → VIN auto-fill (CarAPI + NHTSA) or manual VIN entry; NHTSA-driven year → make → model → trim cascade; tap for service history modal |
| Profile          | View name, email; edit first name, last name via modal; sign out                                                                                                         |
| Settings         | App info (terms, privacy, help, version); sign out                                                                                                                        |

> Home, Appointments, Vehicles, Promotions, and Notifications all support pull-to-refresh, so changes made elsewhere (e.g. an admin updating today's hours) show up without navigating away and back.

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
npx expo run:android   # Android emulator / device — always runs on port 8082
npx expo run:ios       # iOS simulator (Mac only) — always runs on port 8082
```

> Uses `expo-dev-client`. Do not use `npx expo start` — it requires a native build. `adb reverse` is not required; Metro connects to the device automatically.
>
> Ports are pinned in each app's `package.json` scripts (customer-app: 8081, admin-app: 8082) so both can run at once without colliding.

### Screens

| Screen        | Description                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------- |
| Login         | Email + password, handles new-password challenge                                                  |
| Dashboard     | Live KPIs; today's bookings with status bottom sheet, promo apply, and expandable vehicle detail  |
| Bookings      | Appointment list, status tabs, bottom-sheet status picker, promo apply, expandable vehicle detail |
| Customers     | Customer list with name, email, phone, joined date; searchable by name / email / phone            |
| Vehicles      | All tenant vehicles, searchable by make / model / plate / VIN; trim shown in name                 |
| Services      | Full CRUD — tap card to edit, delete button; active toggle in edit modal                          |
| Promotions    | Full CRUD — tap card for detail sheet with edit/delete/toggle; create via FAB                     |
| Capacity      | Slot duration, max concurrent, per-day operating hours                                            |
| Blocked Times | Block date ranges from accepting bookings                                                         |
| Notifications | New-booking and customer-cancellation alerts; unread badge on the header bell                     |

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

| Command           | Description              |
| ----------------- | ------------------------ |
| `npm run dev`     | Start development server |
| `npm run build`   | Build for production     |
| `npm run preview` | Preview production build |

### Pages

| Page          | Description                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard     | Live KPIs; today's bookings table (matches Bookings page) with popover status picker, promo apply, and expandable vehicle detail                 |
| Bookings      | Appointment table, status tabs, popover status picker, promo apply, right-panel detail with expandable vehicle section and inline Plate/VIN edit |
| Customers     | Customer table with name, email, phone, status, joined date; searchable by name / email / phone                                                  |
| Vehicles      | All tenant vehicles with trim; searchable by make / model / plate / VIN                                                                          |
| Services      | Full CRUD — click row to edit, delete button in Actions column; active toggle in edit modal                                                      |
| Promotions    | Full CRUD — click row for right-side detail panel with edit/delete/toggle; create via Add button                                                 |
| Capacity      | Slot duration, max concurrent, per-day operating hours                                                                                           |
| Blocked Times | Block date ranges from accepting bookings                                                                                                        |
| Notifications | Dropdown from the header bell — new-booking and customer-cancellation alerts, unread badge, click-through to the relevant booking                |
| Settings      | Business Profile (name/address/phone/contact email); Role & Access — invite/list/activate/deactivate/**delete** admin users (owner-only, can't touch own account); Locations — full CRUD with soft-deactivate |

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

### Bootstrapping the First Admin Account

There's no seed script yet (Phase 12's onboarding tool will add one). The admin-user invite flow (`POST /admin-users`) requires an already-authenticated tenant owner to call it, so the very first tenant-owner account on a fresh deploy — or after any deploy that replaces the Cognito User Pool, e.g. a `UsernameAttributes` change — has to be created by hand, mirroring what that endpoint does internally:

```bash
# 1. Create the Cognito user (temp password emailed automatically, same as a normal invite)
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId>          `# from the stack outputs` \
  --username <owner-email> \
  --user-attributes Name=email,Value=<owner-email> Name=email_verified,Value=true \
    Name=given_name,Value=<First> Name=family_name,Value=<Last> \
    Name=custom:tenantId,Value=<tenantId> Name=custom:role,Value=TENANT_OWNER \
    Name=custom:userType,Value=ADMIN Name=custom:locationIds,Value= \
  --desired-delivery-mediums EMAIL \
  --region us-east-1
# Note the returned "sub" — that's the Cognito userId used as the DynamoDB sort key below.

# 2. Write the matching DynamoDB USER# record
aws dynamodb put-item --table-name autorepair-users --region us-east-1 --item '{
  "PK": {"S": "TENANT#<tenantId>"}, "SK": {"S": "USER#<sub>"},
  "GSI1PK": {"S": "TENANT#<tenantId>"}, "GSI1SK": {"S": "EMAIL#<owner-email>"},
  "userId": {"S": "<sub>"}, "tenantId": {"S": "<tenantId>"},
  "email": {"S": "<owner-email>"}, "firstName": {"S": "<First>"}, "lastName": {"S": "<Last>"},
  "role": {"S": "TENANT_OWNER"}, "userType": {"S": "ADMIN"}, "locationIds": {"L": []},
  "status": {"S": "ACTIVE"}, "createdAt": {"S": "<ISO timestamp>"}, "updatedAt": {"S": "<ISO timestamp>"}
}'
```

Log into admin-portal/admin-app with the temp password — you'll land on the existing new-password-challenge screen, same as any invited admin.

### AWS Resources (deployed to us-east-1)

| Resource          | Details                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| Cognito User Pool | Single pool, 3 app clients (customer, admin-mobile, admin-portal), 4 user groups |
| DynamoDB          | 12 tables, on-demand billing, PK/SK pattern with GSIs                            |
| S3                | 2 buckets (uploads + assets), versioning enabled                                 |
| API Gateway       | REST API, regional endpoint, `/prod` stage, Cognito authorizer                   |
| Lambda            | 20 functions — see table below                                                   |

### Lambda Functions

| Function                           | Trigger                                                | Purpose                                                     |
| ---------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| `autorepair-pre-signup`            | Cognito PreSignUp                                      | Auto-confirm customers, block self-signup for admin clients |
| `autorepair-post-confirmation`     | Cognito PostConfirmation                               | Write customer record to DynamoDB on signup                 |
| `autorepair-health`                | GET /health                                            | Health check (no auth)                                      |
| `autorepair-services`              | GET/POST/PUT/DELETE /services                          | Service catalog CRUD                                        |
| `autorepair-vehicles`              | GET/POST/PUT/DELETE /vehicles                          | Vehicle management + admin Plate/VIN edit                   |
| `autorepair-appointments`          | GET/POST/PATCH /appointments                           | Booking flow + status updates + push/in-app notifications   |
| `autorepair-customers`             | GET /customers                                         | Customer list (admin only)                                  |
| `autorepair-dashboard`             | GET /dashboard/summary                                 | KPI aggregation                                             |
| `autorepair-capacity`              | GET/PUT /capacity                                      | Slot duration, max concurrent, operating hours              |
| `autorepair-blocked-times`         | GET/POST/DELETE /blocked-times                         | Date range blocks                                           |
| `autorepair-availability`          | GET /availability                                      | Available slots for a given date                            |
| `autorepair-promotions`            | GET/POST/PUT /promotions + POST /promotions/{id}/apply | Promotions CRUD + per-customer apply                        |
| `autorepair-plate-lookup`          | GET /vehicles/plate                                    | License plate → VIN (CarAPI) → make/model/year/trim (NHTSA) |
| `autorepair-push-token`            | PUT /users/push-token                                  | Register a customer's Expo push token                       |
| `autorepair-notifications`         | GET /notifications, PUT /notifications/{notifId}/read, PUT /notifications/read-all | In-app notification list + mark-one/mark-all-as-read |
| `autorepair-notification-reminder` | Scheduled (hourly)                                     | Sends 24h and 2h appointment reminders (push + in-app)      |
| `autorepair-analytics`             | GET /analytics                                         | KPI aggregation for admin Statistics screens                |
| `autorepair-locations`             | GET/POST/PUT/DELETE /locations                         | Multi-location CRUD; soft-deactivate with last-active-location guard |
| `autorepair-tenants`               | GET/PUT /tenants/me                                    | Tenant business-profile record (name/address/phone/contact email) |
| `autorepair-admin-users`           | GET/POST/PATCH/DELETE /admin-users                     | Admin invite (`AdminCreateUser`), list, role/location/status update, and permanent delete — all gated to tenant owner / super admin |

### Third-Party Integrations

License plate lookup (`autorepair-plate-lookup`) calls [CarAPI](https://carapi.app) for plate → VIN resolution, then NHTSA's free `vPIC` API to decode make/model/year/trim from the VIN. CarAPI credentials are read from SSM Parameter Store at runtime (not env vars, so they never appear in the template or deploy history):

```bash
aws ssm put-parameter --name /autorepair/carapi-token  --type SecureString --value "<api_token>"  --region us-east-1
aws ssm put-parameter --name /autorepair/carapi-secret --type SecureString --value "<api_secret>" --region us-east-1
```

### Cognito User Groups

| Group               | Who                     |
| ------------------- | ----------------------- |
| `super-admins`      | Platform administrators |
| `tenant-owners`     | Shop owners             |
| `location-managers` | Location-level staff    |
| `customers`         | End customers           |

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
    │   │   ├── appointments/     Booking flow + push/in-app notifications
    │   │   ├── customers/        Customer list
    │   │   ├── dashboard/        KPI aggregation
    │   │   ├── capacity/         Slot duration, max concurrent, operating hours
    │   │   ├── blocked-times/    Date range blocks
    │   │   ├── availability/     Available slots for a given date
    │   │   └── promotions/       Promotions CRUD + per-customer apply
    │   └── shared/
    │       ├── middleware/        Tenant claim extraction
    │       ├── types/             Shared TypeScript interfaces
    │       └── utils/             DynamoDB client, HTTP responses, availability logic
    ├── template.yaml             SAM template (all AWS resources)
    └── samconfig.toml            SAM deploy configuration
```

---

## Design System

| Token          | Value     | Usage                        |
| -------------- | --------- | ---------------------------- |
| Primary        | `#0F2044` | Navigation, headers, buttons |
| Secondary      | `#F59E0B` | Accents, highlights, CTAs    |
| Background     | `#F1F5F9` | Screen backgrounds           |
| Surface        | `#FFFFFF` | Cards, modals                |
| Text Primary   | `#1E293B` | Main text                    |
| Text Secondary | `#64748B` | Subtitles, placeholders      |
| Border         | `#E2E8F0` | Dividers, card borders       |

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
