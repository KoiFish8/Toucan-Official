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
  - Tables: `tutors` (id, name, instrument, email), `slots` (id, tutor_id, date, start_time, is_booked), `bookings` (id, slot_id, child_name, child_age, parent_name, parent_email, notes).
  - **RLS policies** — anonymous booking (`anon` role): `slots` SELECT where `is_booked=false`; `slots` UPDATE (true/true); `bookings` INSERT (true). Tutor dashboard (`authenticated` role, matched by `auth.jwt()->>'email'` = `tutors.email`): `slots` SELECT/INSERT/DELETE for own `tutor_id`; `bookings` SELECT for bookings on own slots.
  - **Known gap (fix when building parent dashboard):** the unbooked-`slots` SELECT and `bookings` INSERT policies are `anon`-only, so a **logged-in** visitor on `booking.html` currently sees no slots / can't book. Anonymous booking still works. Add `authenticated` versions of those policies when wiring booking into the parent dashboard.
- **Booking flow** (client-side JS in `booking.html`): mark slot `is_booked=true` → insert booking row → call email function → remove event from calendar → show success. Slot event is removed via a stored direct reference (not `getEventById`).
- **Confirmation email**: Netlify serverless function `netlify/functions/send-confirmation.mjs` calls the Resend API. The secret key is NEVER in the browser — it's a Netlify env var.
  - **Email only runs on the deployed site**, not local `file://` (it's best-effort; booking still works locally without it).
  - Netlify env vars: `RESEND_API_KEY` (required, secret), `RESEND_FROM` (optional sender, needs a verified Resend domain), `TEAM_EMAIL` (optional, gets a copy of each booking).
  - Resend test mode (no verified domain) only sends FROM `onboarding@resend.dev` and TO the account owner's email — verify a domain to email real parents.

## Accounts / Auth (`login.html`, `account.html`)

User accounts via **Supabase Auth**. Foundation only so far — signup, login, logout, roles, role-based routing. Dashboards not built yet.

- **Login methods**: email/password **and** Google sign-in (`signInWithOAuth`). Both configured and working. Google's consent screen is still in **"Testing"** mode (only emails added as Test users in Google Cloud can sign in) — must be **published** before real families can use Google login. Google OAuth client redirect URI = `https://avzvaemuvnieulukkyby.supabase.co/auth/v1/callback`.
- **`login.html`**: combined log in / sign up card (toggle). Signup passes `full_name` in user metadata. If already logged in, auto-redirects to `account.html`.
- **`account.html`**: the "My account" page. Checks session (redirects to `login.html` if none), reads `profiles.role`, and shows:
  - **Profile** (all roles): edit **Name** (saved to auth user_metadata via `auth.updateUser({ data })` — NOT profiles, so no profiles UPDATE policy is needed and role can't be self-edited), read-only email, and **change password** (`auth.updateUser({ password })`).
  - **My children** (parents only): full CRUD on the `children` table — add/edit/delete child cards via a modal. Fields: name (required), age, gender (optional), instrument (optional, incl. "N/A"), email (optional).
  - **Tutor dashboard** (tutors only): manage **lesson slots** — list own slots (with booked/open status + booking details for booked ones), add a slot (date + time → `slots` insert), remove an open slot. The account is linked to its `tutors` row **by matching email** (`tutors.email == auth email`); if no match, shows an "account not linked" notice. Only Sean's `tutors.email` is real so far — the other tutors need their real emails set in the `tutors` table before their dashboards work.
- **`children` table** (Supabase): `id`, `parent_id` (→ auth.users), `name`, `age`, `gender`, `instrument`, `email`, `created_at`. RLS: parents can fully manage (SELECT/INSERT/UPDATE/DELETE) only rows where `auth.uid() = parent_id`.
- **Editable name lives in auth `user_metadata.full_name`**, not `profiles.full_name` (which keeps its signup-time value). Display reads from metadata.
- **`profiles` table** (Supabase): `id` (PK → auth.users), `email`, `full_name`, `role` (default `'parent'`), `created_at`. Auto-created on signup by the `handle_new_user()` trigger. RLS: users can only SELECT their own row; **no UPDATE policy** (prevents self-promotion to tutor).
- **Making someone a tutor**: change their `profiles.role` to `tutor` in the Supabase Table Editor (dashboard uses service role, bypasses RLS). New signups are always `parent`.
- **Auth-aware homepage header** (`index.html`): loads supabase-js and checks the session on load. Logged out → default (`Log in` / `Book a lesson` / `Sign up`). Logged in → `Log in` becomes **My account** (→ `account.html`), `Sign up` is hidden, and for **tutors** the `Book a lesson` button becomes **Dashboard** (→ `account.html`); parents keep `Book a lesson`. Nav elements are tagged with `data-nav="login|primary|signup"` for the script to find them.
- **Supabase auth settings**: email confirmation is **ON** (signups get a confirm email; `login.html` passes `emailRedirectTo: account.html`). **Site URL = `https://toucanmusic.netlify.app`** and redirect allow-list includes `https://toucanmusic.netlify.app/**` — required so confirmation links and Google sign-in return to the live site (the default `localhost:3000` Site URL breaks the links).

### Planned next (not built yet)
- Two logged-in dashboards: **student/parent** (book lessons, see their bookings) and **tutor** (manage their own slots + see bookings).
- Gate `booking.html` behind login; tighten `slots`/`bookings` RLS to be per-user.

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
