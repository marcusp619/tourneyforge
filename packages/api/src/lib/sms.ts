import twilio from "twilio";

function getTwilio(): ReturnType<typeof twilio> | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  return twilio(accountSid, authToken);
}

const FROM = process.env.TWILIO_FROM_NUMBER ?? "";

/**
 * Send an SMS message. Best-effort — errors are logged but not thrown.
 */
export async function sendSms(to: string, body: string): Promise<void> {
  const client = getTwilio();
  if (!client || !FROM) return; // Twilio not configured

  try {
    await client.messages.create({ to, from: FROM, body });
  } catch (err) {
    console.error("[sms] send error:", err);
  }
}

export async function sendRegistrationConfirmationSms(params: {
  to: string;
  teamName: string;
  tournamentName: string;
  tournamentDate: string;
}): Promise<void> {
  const body =
    `TourneyForge: ${params.teamName} is registered for ` +
    `${params.tournamentName} on ${params.tournamentDate}. Good luck! 🎣`;
  await sendSms(params.to, body);
}

export async function sendTournamentStartSms(params: {
  to: string;
  tournamentName: string;
}): Promise<void> {
  const body = `TourneyForge: ${params.tournamentName} is now LIVE! Start submitting your catches. 🎣`;
  await sendSms(params.to, body);
}

export async function sendTournamentEndSms(params: {
  to: string;
  tournamentName: string;
  leaderboardUrl: string;
}): Promise<void> {
  const body =
    `TourneyForge: ${params.tournamentName} has ended! ` +
    `View results: ${params.leaderboardUrl}`;
  await sendSms(params.to, body);
}
