import { Resend } from "resend";

import { env } from "@/lib/env";

function getClient() {
  if (!env.EMAIL_API_KEY) {
    return null;
  }
  return new Resend(env.EMAIL_API_KEY);
}

export async function sendEmail(params: { to: string; subject: string; html: string }) {
  const client = getClient();
  if (!client || !env.EMAIL_FROM_ADDRESS) {
    return;
  }

  await client.emails.send({
    from: env.EMAIL_FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    html: params.html
  });
}
