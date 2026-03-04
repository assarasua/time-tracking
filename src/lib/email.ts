import { Resend } from "resend";

function getClient() {
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

export async function sendEmail(params: { to: string; subject: string; html: string }) {
  const client = getClient();
  const from = process.env.EMAIL_FROM_ADDRESS;
  if (!client || !from) {
    return;
  }

  await client.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html
  });
}
