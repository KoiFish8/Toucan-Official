// ─────────────────────────────────────────────────────────────
// Netlify serverless function: send a booking confirmation email.
//
// This runs on Netlify's servers, NOT in the visitor's browser, so it's
// the only safe place to use the secret Resend API key.
//
// The browser calls it at:  /.netlify/functions/send-confirmation
//
// Required Netlify environment variables (set in the Netlify dashboard):
//   RESEND_API_KEY  — your secret Resend key (starts with "re_")
//   RESEND_FROM     — (optional) the "from" address, e.g.
//                     "Toucan Music <lessons@toucanmusic.net>".
//                     Falls back to Resend's test sender if not set.
//   TEAM_EMAIL      — (optional) address that gets a copy of each booking.
// ─────────────────────────────────────────────────────────────

export default async (req) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // Accept either name — the Netlify env var may be RESEND_API_KEY or RESEND_API_KEY_TOUCAN
  const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_API_KEY_TOUCAN
  if (!apiKey) {
    return json({ error: 'Email not configured (missing RESEND_API_KEY)' }, 500)
  }

  // Read the booking details the browser sent
  let d
  try {
    d = await req.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  const {
    parentEmail, parentName, childName, childAge,
    instrument, tutorName, dateStr, timeStr, notes,
  } = d

  if (!parentEmail) {
    return json({ error: 'Missing parentEmail' }, 400)
  }

  const from = process.env.RESEND_FROM || 'Toucan Music <onboarding@resend.dev>'

  // ── Build the confirmation email (sent to the parent) ──
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1c1d21">
      <div style="background:#f5c451;border-radius:14px 14px 0 0;padding:24px 28px">
        <h1 style="margin:0;font-size:20px">🎵 Your Toucan lesson is booked!</h1>
      </div>
      <div style="border:1px solid #ecece8;border-top:none;border-radius:0 0 14px 14px;padding:24px 28px">
        <p style="margin:0 0 16px">Hi ${escape(parentName) || 'there'},</p>
        <p style="margin:0 0 16px">
          You're all set. Here are the details for ${escape(childName)}'s free lesson:
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#6b6f76">Student</td><td style="padding:6px 0;text-align:right;font-weight:600">${escape(childName)}${childAge ? ' (age ' + escape(String(childAge)) + ')' : ''}</td></tr>
          <tr><td style="padding:6px 0;color:#6b6f76">Instrument</td><td style="padding:6px 0;text-align:right;font-weight:600">${escape(instrument)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b6f76">Tutor</td><td style="padding:6px 0;text-align:right;font-weight:600">${escape(tutorName)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b6f76">Date</td><td style="padding:6px 0;text-align:right;font-weight:600">${escape(dateStr)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b6f76">Time</td><td style="padding:6px 0;text-align:right;font-weight:600">${escape(timeStr)}</td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:13px;color:#6b6f76">
          Need to reschedule or cancel? Just reply to this email or reach us at toucanexec@gmail.com.
        </p>
        <p style="margin:16px 0 0;font-size:13px;color:#9aa0a6">We Can Teach, You Can Learn. — Toucan Music</p>
      </div>
    </div>`

  try {
    // Send the parent's confirmation
    const result = await sendEmail(apiKey, {
      from,
      to: [parentEmail],
      reply_to: 'toucanexec@gmail.com',
      subject: `Lesson booked: ${instrument || 'music'} with ${tutorName || 'Toucan'}`,
      html,
    })

    if (result.error) {
      return json({ error: result.error }, 502)
    }

    // Best-effort copy to the team (won't fail the request if it bounces)
    const team = process.env.TEAM_EMAIL
    if (team) {
      await sendEmail(apiKey, {
        from,
        to: [team],
        reply_to: parentEmail,
        subject: `New booking: ${escape(childName)} — ${instrument} (${dateStr})`,
        html: `<div style="font-family:Inter,Arial,sans-serif">
          <h2>New lesson booking</h2>
          <p><b>Student:</b> ${escape(childName)} (age ${escape(String(childAge))})<br>
          <b>Parent:</b> ${escape(parentName)} &lt;${escape(parentEmail)}&gt;<br>
          <b>Instrument:</b> ${escape(instrument)} with ${escape(tutorName)}<br>
          <b>When:</b> ${escape(dateStr)} at ${escape(timeStr)}<br>
          <b>Notes:</b> ${escape(notes) || '—'}</p></div>`,
      }).catch(() => {})
    }

    return json({ ok: true })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
}

// ── Helpers ──
async function sendEmail(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { error: body?.message || `Resend HTTP ${res.status}` }
  return { id: body?.id }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Minimal HTML-escaping so names/notes can't break the email markup
function escape(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
