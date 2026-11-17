# My Health Diary

A mobile-first React + TypeScript health organizer. Built with Vite, Tailwind, Lucide, Supabase Auth/Postgres/private Storage, and a small shell-only service worker.

## Run the application

Use Node.js 22.12+ (tested with Node 24).

```powershell
npm ci
npm run dev
```

Open the Local URL printed by Vite (normally `http://127.0.0.1:5173`). Without the two Supabase environment values, the app explicitly runs in **demo mode**. The sample data is fictional. Demo changes and uploaded files are kept only in memory and disappear on refresh. No authentication, cloud upload, or durable persistence is simulated.

```powershell
npm test
npm run build
```

The production app is generated in `dist/`. Serve that folder over HTTPS. A file:// URL cannot run the app properly.

## Connect Supabase Free

No project has been created or upgraded, and no paid service has been activated by this delivery. Use an existing or new **Free-plan project**. Do not select Pro, paid compute, paid image transformations, custom domains, or paid add-ons. The app makes no billing or plan-management calls.

1. In the Supabase dashboard, create a Free project and choose a suitable region. Keep the database password private.
2. Open the SQL Editor and run `supabase/migrations/202611170001_health_diary.sql` once against the new project. The migration creates the record tables, domain views, HR audit, constraints, RLS, and a **private** `health-files` bucket. Do not mark this bucket public.
3. Copy `.env.example` to `.env` in this directory. Set `VITE_SUPABASE_URL` to the project URL and `VITE_SUPABASE_ANON_KEY` to the project's **public anon key** (or compatible public publishable key). These public values identify the project; RLS supplies authorization. **Never put a service-role key, database password, or privileged secret in a VITE variable.**
4. In Authentication → URL Configuration, set the Site URL to the production HTTPS origin. Add the production origin and `http://127.0.0.1:5173` to allowed redirect URLs as needed for your development setup. Use exact trusted origins rather than wildcards.
5. Enable email/password authentication and email confirmation. Configure the project's auth email delivery as appropriate. The Free default email service has delivery/rate restrictions; signup or recovery delivery may require project configuration. No paid email service is configured here.
6. Restart Vite (or rebuild for production). The demo banner and sample data are replaced by real authentication. Create an account, confirm its email, and sign in. Cloud sessions are deliberately kept in memory, so reloading requires signing in again.
7. Deploy the account-deletion function below. Verify the supplied two-account integration tests before using real health data.

Free-plan limits checked on 17 November 2026: 500 MB database, 1 GB file storage, maximum 50 MB per file; projects may pause after inactivity. This app deliberately caps each file at **20 MB**. Monitor usage in Supabase; optimization reduces some photo sizes but does not guarantee a quota will never be reached. If a limit is reached, uploads fail with an error; the app does not purchase capacity or upgrade a plan.

Official references: [Supabase pricing](https://supabase.com/pricing), [file upload limits](https://supabase.com/docs/guides/storage/uploads/file-limits), [storage usage](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size).

## Account deletion function

Install the official Supabase CLI using its documented installation method. From this folder:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set APP_ORIGIN=https://YOUR_APP_ORIGIN
supabase functions deploy delete-account
```

The function uses Supabase-provided server environment variables. The service-role key stays in the function environment, never the browser. It verifies the caller's token and only deletes that caller's files, records, HR history, profile, and account. It never accepts a target user ID from request input. A failed deletion may be partial and can be retried. Deploy this function before offering account deletion to users.

## Included workflows

- Dashboard with upcoming appointments, current medicines, latest visit, current leave, pending HR submissions, and follow-up reminders.
- Visits: add, edit, search, filter, delete, exact diagnosis text, advice, follow-up date, contact details, and notes. Save doctors separately and reuse them in visits/prescriptions.
- Medicines: separate strength/dose, form, start/end, duration, status, prescribing doctor, linked visit, instructions, notes, and comma-separated administration times. As-needed medicines require no daily schedule.
- Sick leave: required visit link, start/end, inclusive **calendar days**, work-incapacity percentage, return date, HR status/sent date/method/recipient, reminder date, and extensions linked to the prior leave. Extensions are separate records, preserving earlier certificates.
- HR status updates only record information. The app has no HR email integration and never shares diagnoses, medicines, or photos automatically. Database HR changes are retained in an owner-only audit table.
- **Later uploads**: open any saved visit, medicine, or leave, then choose **Upload document**. Add several files without recreating the parent. Each attachment has its own caption/category/date and links. Open an attachment to preview, download, edit its caption, replace its file, or delete it. Replacement preserves the attachment ID and parent link; the new file is saved before the old file is removed. If old-file cleanup fails, the app reports it.
- Camera capture uses the phone's native file/camera picker where supported. Existing JPG, PNG, WebP and PDF files are supported. HEIC is not supported; export it as JPG first. Multi-file uploads show the current file number and an indeterminate in-flight indicator, not a fabricated byte percentage.
- Photo optimization runs locally in the browser, with a 3200px maximum edge and high-quality re-encoding. It only substitutes a smaller result. **Prescription, certificate, submission-proof, report categories and PDFs remain unchanged**. Disable optimization to retain original photos. Downloads return the stored version, which can be optimized for photo categories. No external AI or paid image-transform API receives files.
- English/German interface, light/dark mode, DD.MM.YYYY display, 24-hour times and Europe/Zurich scheduling. User-entered health text is never translated. Record timestamps are UTC; visit dates/times are stored as Zurich civil date/time. Time-zone selection is not implemented.
- Selected-record PDF and JSON exports, with optional notes/treatment fields. HR-only export includes selected leave fields and excludes visit links, diagnoses, medicines, free-text notes, and private photos. Download selected certificates separately from their attachment records. JSON backups contain records/links/metadata; **file binaries must be downloaded separately**. There is no import/restore UI yet.
- Installable PWA shell on supported browsers. On iOS, use Safari → Share → Add to Home Screen. Install UI varies by browser. The service worker caches only same-origin shell assets, never Supabase requests, health records, or file URLs. No offline health-data storage is implemented.
- Optional browser reminders, enabled only after clicking the reminder button. They run only while this app remains open and active enough for browser timers. No push server, closed-app guarantee, background delivery, or medical advice. Notification titles/bodies contain no medical information. Medicine reminders only use the entered schedule; use `HH:mm, HH:mm` in Zurich time.

## Privacy and access model

`profiles` holds preferences. `records` stores a versioned record envelope (`id`, `user_id`, `kind`, `data`, UTC timestamps). The typed collections are exposed through security-invoker views: doctors, visits, prescriptions, sick_leave_periods, attachments, reminders. A medicine record represents a personal prescribed medicine rather than a global drug catalog. HR events use a separate audit table. Extensions link to earlier leave records; each certificate is a separate attachment.

RLS requires `auth.uid() = user_id` for every record operation. Database triggers validate owner-and-kind relationships, making it impossible to link to another user's record. Parent deletion is blocked while related children exist; remove or unlink children explicitly first. Storage access checks `health-files` and the authenticated user's UUID folder for every read/write/delete. Attachment paths use random IDs; file names are retained only as private metadata. Viewing creates a 60-second signed URL after authorization and fetches the file into memory with `cache: no-store`. Uploaded files use zero cache lifetime.

There is no analytics SDK, advertising, external font request, AI processing, health-data logging, public attachment URL, automatic email, or claimed legal compliance/end-to-end encryption. Supabase administrators still have administrative access. Signed URLs are temporary bearer URLs and must not be shared. Ordinary screenshots, downloads, or OS/browser memory are outside the app's cache guarantees. Sign-out clears the app's health state, file object URLs and reminder state; it cannot retract files already downloaded by the user.

## Verification

The local suite tests real form interactions, inclusive dates across leap years and Swiss DST, record saving/editing, exact diagnosis preservation, HR transitions, later uploads, parent deletion protection, file validation, and path ownership. Database tests execute the **actual migration** in embedded PostgreSQL (PGlite), with two authenticated roles and minimal Auth/Storage schema stand-ins. They exercise RLS, cross-account reads/writes/links, anonymous access, HR audit visibility, and file-object policies. These are not substitutes for a deployed Supabase Storage/Auth integration test.

To verify live integration, create two **disposable confirmed test users** in your test project and supply the following environment variables privately in your shell. Do not commit them:

```text
TEST_SUPABASE_URL
TEST_SUPABASE_ANON_KEY
TEST_USER_A_EMAIL
TEST_USER_A_PASSWORD
TEST_USER_B_EMAIL
TEST_USER_B_PASSWORD
```

```powershell
node tests/isolation.mjs
```

The test creates synthetic records and a tiny test PDF, verifies owner access and denial for the other account (including signed file URLs), checks HR audit, then cleans up only those fixtures. It requires no admin secret.

Manual release checklist:

1. Create and confirm an account; sign in, recover password, sign out and back in.
2. Add a doctor and a visit with diagnosis. Add two medicines (one as needed).
3. Add sick leave spanning a DST change; check the inclusive calendar-day total.
4. Upload a certificate and medicine photo. Reopen the saved records later, add more files, edit a caption, replace a file, and delete an attachment.
5. Mark leave Sent with a date; confirm no email is dispatched. Add an extension and confirm the prior certificate remains accessible.
6. Search and edit the original visit. Export a selected visit, medicines, and an HR-only leave PDF. Inspect each output for the selected content.
7. Run `tests/isolation.mjs` with two accounts. Verify the private bucket does not have public URLs.
8. Check mobile camera capture, install flow, permission denial, foreground reminders, quota errors, and account deletion on the target devices/project.

## Deployment

Use any existing HTTPS static host capable of serving `dist/` at the origin root. Provide the two public Supabase variables **at build time**, run `npm ci && npm run build`, and upload `dist/`. There are no client-side path routes requiring a rewrite. Ensure Auth redirect URLs and `APP_ORIGIN` match the final origin. Do not deploy the project source, `.env`, tests, or server function secrets into the public static directory.

The Sites connector failed to initialize during this build, so no hosted URL was provisioned. No Supabase credentials were supplied, so live account creation, recovery emails, file storage, real two-account isolation, and deployed account deletion have **not** been verified. The functional demo, unit/UI tests, SQL policy tests, and production build are delivered locally.

## Remaining limits

- No closed-app/background push notifications, offline health-record persistence, working-day calculations, backup import, or automatic HR sending.
- Fixed Europe/Zurich appointment time zone. Preferences currently last for the open app session.
- No byte-level upload progress, resumable uploads, malware scanning, or attachment image OCR. Camera availability depends on device/browser.
- PDFs use the standard Latin font and support English/German; arbitrary non-Latin patient text needs an embedded Unicode font before multilingual PDF use.
- Full-screen attachment viewing is a large in-app preview; no OS fullscreen API is requested. PDF previews depend on browser PDF support; original download remains available.
- Real Supabase deployment and the device-specific checklist remain necessary before relying on this for personal health data.
