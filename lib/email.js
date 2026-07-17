// Transactional email via Resend's HTTP API (resend.com) — no SDK needed, matches this
// app's existing fetch-based pattern for external services (Ollama, Kiwi, Amadeus).

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

export async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.warn(`RESEND_API_KEY is not set — skipping email send to ${to} ("${subject}").`);
    return { ok: false, error: 'Email is not configured on the server.' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Resend send failed:', data);
      return { ok: false, error: data.message || 'Failed to send email.' };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    console.error('Resend send error:', err.message);
    return { ok: false, error: err.message };
  }
}
