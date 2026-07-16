// Firebase Cloud Messaging (HTTP v1) sender for native iOS/Android push.
// Dependency-free: signs a service-account JWT with Node crypto, exchanges it
// for an OAuth access token (cached), then posts to the FCM v1 endpoint. FCM
// delivers to Android directly and to iOS via APNs, so the server has a single
// code path for both platforms.
//
// Configure with FCM_SERVICE_ACCOUNT = the full service-account JSON (as a
// string). When unset, everything here no-ops so the web-push path is
// unaffected.
import crypto from 'node:crypto';

type Notif = { title: string; body: string; url?: string };
type ServiceAccount = { client_email: string; private_key: string; project_id: string };

let cachedToken: { value: string; exp: number } | null = null;

function getServiceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    if (!sa.client_email || !sa.private_key || !sa.project_id) return null;
    return sa as ServiceAccount;
  } catch {
    return null;
  }
}

export function fcmConfigured(): boolean {
  return getServiceAccount() !== null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value;

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  // Env-stored keys often carry escaped newlines; normalize before signing.
  const signature = base64url(signer.sign(sa.private_key.replace(/\\n/g, '\n')));
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`FCM auth failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = { value: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return cachedToken.value;
}

/**
 * Delivers a notification to each device token. Returns the tokens that FCM
 * reported as permanently invalid so the caller can prune them.
 */
export async function sendToTokens(
  tokens: string[],
  notif: Notif
): Promise<{ staleTokens: string[]; sent: number }> {
  const sa = getServiceAccount();
  if (!sa || tokens.length === 0) return { staleTokens: [], sent: 0 };

  const accessToken = await getAccessToken(sa);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  const staleTokens: string[] = [];
  let sent = 0;

  await Promise.all(
    tokens.map(async (token) => {
      const message = {
        message: {
          token,
          notification: { title: notif.title, body: notif.body },
          ...(notif.url ? { data: { url: notif.url } } : {}),
          android: { priority: 'HIGH', notification: { sound: 'default' } },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        },
      };
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        });
        if (res.ok) {
          sent++;
          return;
        }
        const text = await res.text().catch(() => '');
        // 404 UNREGISTERED or an invalid-token 400 means the token is dead.
        if (res.status === 404 || (res.status === 400 && /not.?registered|invalid.*token/i.test(text))) {
          staleTokens.push(token);
        }
      } catch {
        // transient network error — leave the token in place
      }
    })
  );

  return { staleTokens, sent };
}
