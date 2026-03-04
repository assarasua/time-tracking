import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

import { getAppBaseUrl } from "@/lib/app-config";
import { cleanEnv } from "@/lib/env-utils";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function getOAuthConfig() {
  return {
    clientId: cleanEnv(process.env.GOOGLE_CLIENT_ID),
    clientSecret: cleanEnv(process.env.GOOGLE_CLIENT_SECRET),
    redirectUri: `${getAppBaseUrl()}/api/auth/google/callback`,
    authSecret: cleanEnv(process.env.AUTH_SECRET)
  };
}

export function createSignedOAuthState() {
  const { authSecret } = getOAuthConfig();
  if (!authSecret) {
    throw new Error("AUTH_SECRET is required for OAuth state signing");
  }

  const payload = {
    nonce: randomBytes(16).toString("hex"),
    ts: Date.now()
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", authSecret).update(encoded).digest("hex");

  return `${encoded}.${signature}`;
}

export function verifySignedOAuthState(state: string) {
  const { authSecret } = getOAuthConfig();
  if (!authSecret) {
    return false;
  }

  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) {
    return false;
  }

  const expected = createHmac("sha256", authSecret).update(encoded).digest("hex");
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { ts?: number };
    if (!parsed.ts) {
      return false;
    }
    const ageMs = Date.now() - parsed.ts;
    return ageMs >= 0 && ageMs <= 10 * 60 * 1000;
  } catch {
    return false;
  }
}

export function buildGoogleAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = getOAuthConfig();
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is required");
  }

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");

  return url;
}

export async function exchangeGoogleCodeForAccessToken(code: string) {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are missing");
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body,
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Google token exchange returned no access_token");
  }

  return payload.access_token;
}

export type GoogleProfile = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google userinfo fetch failed (${response.status}): ${text}`);
  }

  const profile = (await response.json()) as GoogleProfile;
  if (!profile.email || !profile.sub) {
    throw new Error("Google profile is missing required sub/email fields");
  }

  if (profile.email_verified === false) {
    throw new Error("Google profile email is not verified");
  }

  return profile;
}
