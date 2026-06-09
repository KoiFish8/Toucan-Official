# Toucan Music — Project Context

Toucan is a nonprofit providing free music lessons for underprivileged children.
Tagline: "We Can Teach, You Can Learn."
Contact email: toucanexec@gmail.com

## Tech Stack

- **Single static site** — one `index.html` file, no framework
- **Tailwind CSS v3** — compiled/purged via CLI (NOT the CDN script)
  - Config: `tailwind.config.js`
  - Source CSS: `src/input.css` (all custom styles live here)
  - Output: `styles.css` (build artifact, gitignored — Netlify regenerates it)
  - Build command: `npm run build`
  - Watch command: `npm run watch` (for local development)
- **Images**: all in `images/`, served as `.webp` (converted from JPG with sharp)
- **Font**: Inter via Google Fonts CDN

## Deployment

- **GitHub repo**: https://github.com/KoiFish8/Toucan-Official
- **Netlify**: auto-deploys on every push to `main`
  - Netlify runs `npm run build` → regenerates `styles.css` → publishes the folder
  - Config: `netlify.toml` (already set up)
- **Git identity**: user.name = KoiFish8, user.email = seanjiho@gmail.com

### Push workflow
```bash
cd "/Users/seanchoi/Desktop/Coding/Web Design AI/Toucan Website"
git add .
git commit -m "describe what changed"
git push
```
Netlify picks it up automatically and redeploys in ~1–2 minutes.

### Branch workflow (for big/risky changes)
```bash
git checkout -b branch-name   # create + switch to new branch
# make changes, then:
git add . && git commit -m "..."
git push -u origin branch-name
# open PR on GitHub → review → merge into main
```

## Forms (Formspree)

Formspree endpoint: `https://formspree.io/f/xqeopewq`

- **Volunteer form** (`#volunteer-form`, in the "Join the Toucan family" section) — fields: name, email, instruments (checkboxes), experience, availability, about. Hidden subject: "New volunteer application — Toucan". Plain HTML POST → Formspree thank-you page. This is still how tutors are recruited.
- **The old lesson sign-up form was removed.** That left card now routes parents into the account system instead (Create account → add child → book): buttons link to `login.html#signup` / `login.html` and `booking.html`.

## Color Palette (light/off-white theme)

| Token | Value | Use |
|---|---|---|
| `bg` | `#fafaf7` | Page background |
| `surface` | `#ffffff` | Cards, inputs |
| `surface2` | `#f4f4f0` | Secondary surfaces |
| `border` | `#ecece8` | Default borders |
| `border2` | `#e0e0da` | Stronger borders |
| `fg` | `#1c1d21` | Primary text |
| `fg2` | `#3a3b41` | Secondary text |
| `fg3` | `#6b6f76` | Muted text |
| `fg4` | `#9aa0a6` | Placeholder text |
| `beak` | `#f5c451` | Primary accent (yellow) |
| `beakdeep` | `#e9a93b` | Yellow hover state |
| `face` | `#4f6db8` | Blue accent |
| `leaf` | `#4e9e5e` | Green accent |

## Booking System (`booking.html`)

A lesson-booking page: parent picks an instrument → sees open Sunday slots on a
**month-view calendar** → books one → slot is marked taken and a confirmation
email is sent.

- **Frontend**: `booking.html` (separate page, uses Tailwind CDN with the same color tokens — NOT the compiled build). FullCalendar + Supabase JS both via CDN.
- **Calendar**: FullCalendar `dayGridMonth` view (we host ~2–3 Sundays/month, so month view fits better than week view).
- **Database**: Supabase
  - URL: `https://avzvaemuvnieulukkyby.supabase.co` (anon key is in `booking.html` — safe to be public; it's the anon key, protected by RLS).
  - Tables: `tutors` (id, name, instrument, email), `slots` (id, tutor_id, date, start_time, is_booked), `bookings` (id, slot_id, child_name, child_age, parent_name, parent_email, notes, **parent_id** → auth.users, **child_id** → children, **instrument**, **tutor_name**, **lesson_date**, **lesson_time**). The last 6 are nullable; `parent_id`/`child_id` are set only for logged-in bookings, and `instrument`/`tutor_name`/`lesson_date`/`lesson_time` are denormalized copies so "My lessons" is a single-table read.
  - **RLS policies** — anonymous booking (`anon` role): `slots` SELECT where `is_booked=false`; `slots` UPDATE (true/true); `bookings` INSERT (true). Tutor dashboard (`authenticated` role, matched by `auth.jwt()->>'email'` = `tutors.email`): `slots` SELECT/INSERT/DELETE for own `tutor_id`; `bookings` SELECT for bookings on own slots. Parent booking (`authenticated`): `slots` SELECT where `is_booked=false` + `slots` UPDATE (true/true, to book/free); `bookings` INSERT/SELECT/DELETE where `parent_id = auth.uid()`.
  - **Both booking paths work**: anonymous visitors book by typing child info (anon policies); logged-in parents book with a saved child and the booking links to their account (authenticated policies). The earlier "logged-in can't see slots" gap is closed.
- **Booking flow** (client-side JS in `booking.html`): mark slot `is_booked=true` → insert booking row → call email function → remove event from calendar → show success. Slot event is removed via a stored direct reference (not `getEventById`). **Auth-aware**: on load `getSession()` — if logged in, the modal swaps the typed child/parent fields for a **saved-child dropdown** (loaded from `children`) and the booking is stamped with `parent_id`/`child_id`; guests still type everything. Calendar events carry `date`/`startTime` in `extendedProps` so the booking can store `lesson_date`/`lesson_time`.
- **Booking emails**: Netlify serverless function `netlify/functions/send-confirmation.mjs` (Resend API). On each booking it sends **3 kinds**: (1) confirmation to the **parent**; (2) "new booking" notice to the **slot's tutor** — email looked up dynamically from `tutors` by `tutorId` in the payload; (3) a copy to every **founder** (`profiles.role = 'founder'`). Tutor/founder lookups are **not hardcoded** — add a tutor/founder in the DB and they're notified automatically. Staff sends are best-effort (never block the booking).
  - **Email only runs on the deployed site**, not local `file://`.
  - Netlify env vars: `RESEND_API_KEY` (required, secret), **`SUPABASE_SERVICE_KEY`** (required for tutor/founder lookups — secret service-role key, used ONLY in this server-side function), `RESEND_FROM` (optional sender, needs a verified Resend domain), `SUPABASE_URL` (optional, defaults to the project URL), `TEAM_EMAIL` (optional fixed copy).
  - ⚠️ Resend test mode (no verified domain) only delivers TO the Resend account owner (`seanjiho@gmail.com`) FROM `onboarding@resend.dev` — so **tutor/founder/parent emails to other addresses won't actually deliver until a domain is verified in Resend**. The code is correct; this is purely a Resend-account limitation.
- The booking payload carries `tutorId` (from the calendar event's `extendedProps`) so the function can find the tutor's email.

## Accounts / Auth (`login.html`, `account.html`)

User accounts via **Supabase Auth**. Foundation only so far — signup, login, logout, roles, role-based routing. Dashboards not built yet.

- **Login methods**: email/password **and** Google sign-in (`signInWithOAuth`). Both configured and working. Google's consent screen is still in **"Testing"** mode (only emails added as Test users in Google Cloud can sign in) — must be **published** before real families can use Google login. Google OAuth client redirect URI = `https://avzvaemuvnieulukkyby.supabase.co/auth/v1/callback`.
- **`login.html`**: combined log in / sign up card (toggle). Signup passes `full_name` in user metadata. If already logged in, auto-redirects to `account.html`.
- **`account.html`**: the "My account" / "Dashboard" page (label says "Dashboard" for tutors). Checks session (redirects to `login.html` if none), reads `profiles.role`. Sections are **collapsible** (`<details>`): **Profile & password** is collapsed by default; the role section (children / lesson slots) is open by default. Shows:
  - **Profile** (all roles): edit **Name** (saved to auth user_metadata via `auth.updateUser({ data })` — NOT profiles, so no profiles UPDATE policy is needed and role can't be self-edited), read-only email, and **change password** (`auth.updateUser({ password })`).
  - **My lessons** (parents only): lists the parent's booked lessons (read from `bookings` where `parent_id = auth.uid()`), each with a **Cancel** button that deletes the booking and frees the slot (`is_booked=false`). Reschedule = cancel + rebook.
  - **My children** (parents only): full CRUD on the `children` table — add/edit/delete child cards via a modal. Fields: name (required), age, gender (optional), instrument (optional, incl. "N/A"), email (optional).
  - **Tutor dashboard** (tutors only): manage **lesson slots** — list own slots (with booked/open status + booking details for booked ones), add slots (pick **one start time + one or more dates** → inserts a `slots` row per date), remove an open slot. The account is linked to its `tutors` row **by matching email** (`tutors.email == auth email`); if no match, shows an "account not linked" notice. Only Sean's `tutors.email` is real so far — the other tutors need their real emails set in the `tutors` table before their dashboards work.
- **`children` table** (Supabase): `id`, `parent_id` (→ auth.users), `name`, `age`, `gender`, `instrument`, `email`, `created_at`. RLS: parents can fully manage (SELECT/INSERT/UPDATE/DELETE) only rows where `auth.uid() = parent_id`.
- **Editable name lives in auth `user_metadata.full_name`**, not `profiles.full_name` (which keeps its signup-time value). Display reads from metadata.
- **`profiles` table** (Supabase): `id` (PK → auth.users), `email`, `full_name`, `role` (default `'parent'`), `created_at`. Auto-created on signup by the `handle_new_user()` trigger. RLS: users can only SELECT their own row; **no UPDATE policy** (prevents self-promotion to tutor).
- **Roles**: `parent` (default), `tutor`, and **`founder`** (Nathan). `founder` = tutor + a bit more: the app treats `tutor`/`founder` identically for the **dashboard + header** (founders manage their own slots via their `tutors` row, matched by email), and founders additionally receive a copy of **every** booking email. Account badge shows "Founder".
- **Making someone a tutor/founder**: change their `profiles.role` in the Supabase Table Editor (dashboard uses service role, bypasses RLS). New signups are always `parent`. For booking-email notifications to reach a tutor, their `tutors.email` must be a real address.
- **Auth-aware homepage header** (`index.html`): a **pre-paint** inline script (in `<head>`) reads the saved Supabase session from localStorage and adds `is-authed` to `<html>` *before* the page draws, so CSS instantly shows the right links with **no flash**. Markup uses `data-auth="out"` (Log in, Sign up — shown to guests) and `data-auth="in"` (My account — shown when logged in). After load, a script confirms the session (corrects a stale guess) and, for **tutors**, hides "My account" and relabels the `data-nav="primary"` button to **Dashboard** (parents keep **Book a lesson**). So: guests see Log in/Book a lesson/Sign up; parents see My account/Book a lesson; tutors see just **Dashboard**.
- **Supabase auth settings**: email confirmation is **ON** (signups get a confirm email; `login.html` passes `emailRedirectTo: account.html`). **Site URL = `https://toucanmusic.netlify.app`** and redirect allow-list includes `https://toucanmusic.netlify.app/**` — required so confirmation links and Google sign-in return to the live site (the default `localhost:3000` Site URL breaks the links).

### Status — core app is functionally complete
Tutor dashboard ✅, parent dashboard ✅ (my lessons + cancel), booking with saved child ✅, logged-in booking gap closed ✅.

### Planned next (polish / launch — Tier 2 & 3)
- **Launch checklist (Tier 2):** connect `toucanmusic.net` domain + update Supabase URLs; verify a Resend domain so confirmation emails aren't from `onboarding@resend.dev`; **publish the Google consent screen** (currently "Testing"); set real emails for the other tutors in the `tutors` table.
- **Polish (Tier 3):** tutor-side cancel; email the tutor when their slot is booked; privacy policy page (collecting children's data); raise min password length; "delete account"; SEO/social meta.
- **NOTE:** several batches are **edited locally but NOT pushed** (collapsible account, tutor Dashboard-only header, multi-date slots, header FOUC fix, parent dashboard, booking-with-child). User is conserving Netlify build credits and will push everything together. **Requires running the bookings SQL** (parent_id/child_id columns + authenticated RLS) before the parent dashboard works live.

## Team / Tutors

- **Nathan** — Founder & Piano Tutor. 9 years piano, 3 years viola.
- **Sean** — Co-Founder, Head of Tech & Viola Tutor. 8 years viola/violin. Enjoys programming and hockey.
- **Bryan** — Co-Founder, Violin & Cello Tutor. 8 years violin, 3 years cello.
- **Sameer** — Co-Founder & Graphic Designer. Into 3D modeling, mathematics, guitar.

## File Structure

```
index.html              ← the marketing site (homepage)
booking.html            ← lesson booking page (Supabase + FullCalendar, Tailwind CDN)
login.html              ← log in / sign up (Supabase Auth: email+password + Google)
account.html            ← logged-in landing page (reads role, routes by role)
netlify/functions/
  send-confirmation.mjs ← serverless function: sends booking email via Resend
styles.css              ← BUILD ARTIFACT (gitignored, regenerated by Netlify)
tailwind.config.js      ← Tailwind config + color tokens
src/input.css           ← all custom CSS (field styles, animations, glow effects)
package.json            ← build/watch scripts, tailwindcss devDep
netlify.toml            ← Netlify build config + functions directory
.gitignore              ← excludes node_modules/, styles.css, archive-nextjs/
images/
  toucan.png            ← logo (PNG, used as favicon + img)
  homeimg.webp          ← hero photo (1200×900)
  nathan.webp           ← tutor photo (600×800)
  sean.webp             ← tutor photo (600×800)
  bran.webp             ← tutor photo (600×800)
  asm.webp              ← tutor photo (600×800)
archive-nextjs/         ← old Next.js version (gitignored, 542MB)
```

## Key Implementation Details

- **Mobile nav**: hamburger button (`#menu-toggle`) toggles `#mobile-menu` panel. JS in the bottom `<script>` block.
- **Scroll reveal**: `.reveal` elements animate in with blur+slide+fade via IntersectionObserver.
- **Glow effects**: `.glow-btn` (pulsing gold glow on buttons), `.glow-box` (hover bloom on cards). Both defined in `src/input.css`.
- **Images**: all `<img>` tags have explicit `width`/`height` (prevents CLS). Below-fold images have `loading="lazy"`. Hero has `fetchpriority="high"`.
- **DO NOT** switch back to the Tailwind CDN script — the compiled build is intentional.

## When Making Changes

- **HTML/content changes** → edit `index.html`, commit, push. Netlify rebuilds CSS automatically.
- **Style changes** → edit `src/input.css` or `tailwind.config.js`, then run `npm run build` locally to preview, then push.
- **Adding new Tailwind classes** → just add them in `index.html`; Netlify's build will pick them up (it scans `index.html` per `tailwind.config.js`).
- **Images** → convert to `.webp` first (use `sharp`), add `width`/`height`/`loading="lazy"` attributes, place in `images/`.
