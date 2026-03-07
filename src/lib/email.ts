import { Resend } from "resend";

type EmailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getClient() {
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

export async function sendEmail(params: { to: string; subject: string; html: string; attachments?: EmailAttachment[] }) {
  const client = getClient();
  const from = process.env.EMAIL_FROM_ADDRESS;
  if (!client || !from) {
    throw new Error("Email sender is not configured.");
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await client.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments
    });

    if (!result.error) {
      return result.data;
    }

    const shouldRetry = result.error.name === "rate_limit_exceeded";

    if (!shouldRetry || attempt === 3) {
      throw new Error(result.error.message);
    }

    await sleep(700 * (attempt + 1));
  }
}
