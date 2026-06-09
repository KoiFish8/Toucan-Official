// ─────────────────────────────────────────────────────────────
// Netlify serverless function: booking emails.
//
// Runs on Netlify's servers (NOT the browser), so it's the safe place for
// secret keys. On each booking it sends:
//   1. a confirmation to the PARENT
//   2. a "new booking" notification to the SLOT'S TUTOR (email read from the
//      `tutors` table by tutorId — nothing hardcoded)
//   3. a copy to every FOUNDER (profiles.role = 'founder') — also read from
//      the DB, so adding tutors/founders later "just works".
//
// Required Netlify environment variables:
//   RESEND_API_KEY (or RESEND_API_KEY_TOUCAN) — secret Resend key ("re_…")
//   SUPABASE_SERVICE_KEY — secret Supabase service-role key (used ONLY here,
//                          server-side, to look up tutor/founder emails)
// Optional:
//   RESEND_FROM  — verified sender, e.g. "Toucan Music <lessons@toucanmusic.net>"
//                  (until a domain is verified in Resend, leave unset → test
//                  sender, which only delivers to the Resend account owner)
//   SUPABASE_URL — defaults to the Toucan project URL
//   TEAM_EMAIL   — an extra fixed address to copy on every booking
// ─────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://avzvaemuvnieulukkyby.supabase.co'

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_API_KEY_TOUCAN
  if (!apiKey) return json({ error: 'Email not configured (missing RESEND_API_KEY)' }, 500)

  let d
  try { d = await req.json() } catch { return json({ error: 'Invalid request body' }, 400) }

  const { parentEmail, parentName, childName, childAge,
          instrument, tutorName, tutorId, dateStr, timeStr, notes } = d
  if (!parentEmail) return json({ error: 'Missing parentEmail' }, 400)

  const from = process.env.RESEND_FROM || 'Toucan Music <onboarding@resend.dev>'

  // ── Parent confirmation ──
  const parentHtml = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1c1d21">
      <div style="background:#f5c451;border-radius:14px 14px 0 0;padding:24px 28px">
        <h1 style="margin:0;font-size:20px">🎵 Your Toucan lesson is booked!</h1>
      </div>
      <div style="border:1px solid #ecece8;border-top:none;border-radius:0 0 14px 14px;padding:24px 28px">
        <p style="margin:0 0 16px">Hi ${escape(parentName) || 'there'},</p>
        <p style="margin:0 0 16px">You're all set. Here are the details for ${escape(childName)}'s free lesson:</p>
        ${detailsTable({ childName, childAge, instrument, tutorName, dateStr, timeStr })}
        <p style="margin:20px 0 0;font-size:13px;color:#6b6f76">Need to reschedule or cancel? Reply to this email or reach us at toucanexec@gmail.com.</p>
        <p style="margin:16px 0 0;font-size:13px;color:#9aa0a6">We Can Teach, You Can Learn. — Toucan Music</p>
      </div>
    </div>`

  try {
    const result = await sendEmail(apiKey, {
      from, to: [parentEmail], reply_to: 'toucanexec@gmail.com',
      subject: `Lesson booked: ${instrument || 'music'} with ${tutorName || 'Toucan'}`,
      html: parentHtml,
    })
    if (result.error) return json({ error: result.error }, 502)

    // ── Staff notifications: the slot's tutor + all founders (dynamic) ──
    const staff = await collectStaffEmails(tutorId)
    const team = process.env.TEAM_EMAIL
    if (team && team.includes('@') && !staff.includes(team)) staff.push(team)

    const staffHtml = `
      <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1c1d21">
        <h2 style="font-size:18px">📅 New lesson booking</h2>
        ${detailsTable({ childName, childAge, instrument, tutorName, dateStr, timeStr })}
        <p style="margin:14px 0 0;font-size:14px"><b>Parent:</b> ${escape(parentName)} &lt;${escape(parentEmail)}&gt;</p>
        ${notes ? `<p style="margin:8px 0 0;font-size:14px;color:#6b6f76">Notes: ${escape(notes)}</p>` : ''}
      </div>`

    // best-effort: a slow/failed notification must never fail the booking
    await Promise.all(staff.map(to =>
      sendEmail(apiKey, {
        from, to: [to], reply_to: parentEmail,
        subject: `New booking: ${escape(childName)} — ${instrument || 'lesson'} (${dateStr || ''})`,
        html: staffHtml,
      }).catch(() => {})
    ))

    return json({ ok: true, notified: staff.length })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
}

// Look up who should be notified: the booking's tutor + every founder.
// Uses the Supabase service-role key so it can read emails server-side.
async function collectStaffEmails(tutorId) {
  // Accept either name — the Netlify env var may be SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_KEY_TOUCAN
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY_TOUCAN
  if (!key) return []   // not configured yet → just skip staff emails
  const headers = { apikey: key, Authorization: `Bearer ${key}` }
  const emails = new Set()
  try {
    if (tutorId) {
      const t = await fetch(`${SUPABASE_URL}/rest/v1/tutors?id=eq.${encodeURIComponent(tutorId)}&select=email`, { headers }).then(r => r.json())
      ;(Array.isArray(t) ? t : []).forEach(x => { if (x.email && x.email.includes('@')) emails.add(x.email) })
    }
    const f = await fetch(`${SUPABASE_URL}/rest/v1/profiles?role=eq.founder&select=email`, { headers }).then(r => r.json())
    ;(Array.isArray(f) ? f : []).forEach(x => { if (x.email && x.email.includes('@')) emails.add(x.email) })
  } catch (e) { /* best-effort */ }
  return [...emails]
}

// ── Helpers ──
function detailsTable({ childName, childAge, instrument, tutorName, dateStr, timeStr }) {
  const row = (k, v) => `<tr><td style="padding:6px 0;color:#6b6f76">${k}</td><td style="padding:6px 0;text-align:right;font-weight:600">${v}</td></tr>`
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">
    ${row('Student', `${escape(childName)}${childAge ? ' (age ' + escape(String(childAge)) + ')' : ''}`)}
    ${row('Instrument', escape(instrument))}
    ${row('Tutor', escape(tutorName))}
    ${row('Date', escape(dateStr))}
    ${row('Time', escape(timeStr))}
  </table>`
}

async function sendEmail(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { error: body?.message || `Resend HTTP ${res.status}` }
  return { id: body?.id }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })
}

function escape(str) {
  if (str == null) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
