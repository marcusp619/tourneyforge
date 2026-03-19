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

export interface SponsorInquiryData {
  to: string;           // sponsor's contactEmail
  sponsorName: string;
  directorName: string; // tenant name
  replyTo: string;      // director's email
  message: string;
}

export async function sendSponsorInquiry(data: SponsorInquiryData): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "Email not configured" };

  const fromDomain = process.env.EMAIL_FROM_DOMAIN ?? "noreply@tourneyforge.com";

  try {
    await resend.emails.send({
      from: `TourneyForge Marketplace <${fromDomain}>`,
      to: data.to,
      replyTo: data.replyTo,
      subject: `Sponsorship Inquiry from ${data.directorName} via TourneyForge`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #111;">
          <h2 style="color: #1d4ed8;">New Sponsorship Inquiry 🎣</h2>
          <p>Hi ${data.sponsorName},</p>
          <p>
            <strong>${data.directorName}</strong> is interested in partnering with you for an upcoming
            fishing tournament on TourneyForge.
          </p>
          <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0;white-space:pre-wrap;">${data.message}</p>
          </div>
          <p>
            Reply directly to this email to get in touch with ${data.directorName}
            at <a href="mailto:${data.replyTo}">${data.replyTo}</a>.
          </p>
          <p style="margin-top:32px;font-size:12px;color:#9ca3af;">
            This inquiry was sent via the TourneyForge Sponsor Marketplace.
          </p>
        </div>
      `,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
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
