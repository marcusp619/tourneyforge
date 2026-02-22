import { Resend } from "resend";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export interface RegistrationConfirmData {
  to: string;
  tenantName: string;
  tournamentName: string;
  teamName: string;
  tournamentDate: string;
  tournamentUrl: string;
}

export async function sendRegistrationConfirmation(data: RegistrationConfirmData) {
  const resend = getResend();
  if (!resend) return; // No key configured — skip silently

  const fromDomain = process.env.EMAIL_FROM_DOMAIN ?? "noreply@tourneyforge.com";

  await resend.emails.send({
    from: `${data.tenantName} via TourneyForge <${fromDomain}>`,
    to: data.to,
    subject: `You're registered for ${data.tournamentName}!`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #111;">
        <h2 style="color: #1d4ed8;">Registration Confirmed 🎣</h2>
        <p>Hi ${data.teamName},</p>
        <p>Your registration for <strong>${data.tournamentName}</strong> hosted by <strong>${data.tenantName}</strong> is confirmed!</p>
        <p style="color: #6b7280;">Tournament date: ${data.tournamentDate}</p>
        <a
          href="${data.tournamentUrl}"
          style="display:inline-block;margin-top:16px;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;"
        >
          View Tournament
        </a>
        <p style="margin-top: 32px; font-size: 12px; color: #9ca3af;">
          This email was sent because you registered for a tournament on TourneyForge.
          If you believe this was a mistake, please ignore this email.
        </p>
      </div>
    `,
  });
}
