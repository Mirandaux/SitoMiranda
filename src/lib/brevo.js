/**
 * Brevo REST API client — server-side only.
 * Non importare questo modulo in componenti client.
 */

const BREVO_BASE = "https://api.brevo.com/v3";

/**
 * Ritorna gli header HTTP per Brevo o lancia un errore se la chiave manca.
 * @throws {Error} se BREVO_API_KEY non è impostata
 */
export function brevoHeaders() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY mancante");
  return {
    "api-key": apiKey,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

/**
 * Aggiunge o aggiorna un contatto in Brevo.
 * @param {object} params
 * @param {string} params.email
 * @param {object} [params.attributes]
 * @param {number[]} [params.listIds]
 * @returns {{ ok: boolean, status: number, body: object }}
 */
export async function upsertContact({ email, attributes = {}, listIds = [] }) {
  const headers = brevoHeaders();
  const res = await fetch(`${BREVO_BASE}/contacts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, attributes, listIds, updateEnabled: true }),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok || res.status === 204, status: res.status, body };
}

/**
 * Invia un'email transazionale tramite Brevo.
 * @param {object} params
 * @param {{ name: string, email: string }} params.sender
 * @param {{ email: string, name?: string }[]} params.to
 * @param {string} params.subject
 * @param {string} params.htmlContent
 * @param {{ email: string, name?: string }} [params.replyTo]
 * @returns {{ ok: boolean, status: number, body: object }}
 */
export async function sendTransactional({ sender, to, subject, htmlContent, replyTo }) {
  const headers = brevoHeaders();
  const payload = { sender, to, subject, htmlContent };
  if (replyTo) payload.replyTo = replyTo;
  const res = await fetch(`${BREVO_BASE}/smtp/email`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}
