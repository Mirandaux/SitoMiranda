export const prerender = false;

import { brevoHeaders, upsertContact, sendTransactional } from "../../lib/brevo.js";

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sanitize(str = "", maxLen = 2000) {
  return String(str).trim().slice(0, maxLen);
}

const VALID_DECISIONI = [
  "Scegliere un nuovo software",
  "Sostituire quello attuale",
  "Migliorare l'adozione del team",
  "Valutare uno sviluppo su misura",
  "Altro",
];

export const POST = async ({ request }) => {
  const tag = "[sfs]";

  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Richiesta non valida." }, 400);
  }

  const {
    nome, email, azienda, decisione, problema,
    privacy_consent, marketing_consent, honeypot,
    utm_source, utm_medium, utm_campaign, utm_id, utm_term, utm_content,
    page_url,
  } = body || {};

  // Honeypot anti-spam
  if (honeypot) {
    console.log(`${tag} honeypot triggered, skipped`);
    return jsonResponse({ ok: true, skipped: true });
  }

  // Validazione
  const cleanNome = sanitize(nome);
  const cleanEmail = sanitize(email).toLowerCase();
  const cleanAzienda = sanitize(azienda);
  const cleanDecisione = sanitize(decisione);
  const cleanProblema = sanitize(problema);

  if (cleanNome.length < 2)
    return jsonResponse({ ok: false, field: "nome", error: "Inserisci il tuo nome e cognome." }, 400);
  if (!isValidEmail(cleanEmail))
    return jsonResponse({ ok: false, field: "email", error: "Inserisci un indirizzo email valido." }, 400);
  if (cleanAzienda.length < 1)
    return jsonResponse({ ok: false, field: "azienda", error: "Inserisci il nome dell'azienda." }, 400);
  if (!VALID_DECISIONI.includes(cleanDecisione))
    return jsonResponse({ ok: false, field: "decisione", error: "Seleziona il tipo di decisione." }, 400);
  if (cleanProblema.length < 10)
    return jsonResponse({ ok: false, field: "problema", error: "Descrivi il problema (almeno 10 caratteri)." }, 400);
  if (!privacy_consent)
    return jsonResponse({ ok: false, field: "privacy_consent", error: "Il consenso alla privacy e' obbligatorio." }, 400);

  console.log(`${tag} validation ok — email=${cleanEmail.slice(0,3)}***`);

  // Verifica chiave API presente
  try {
    brevoHeaders();
  } catch {
    console.error(`${tag} BREVO_API_KEY mancante`);
    return jsonResponse({ ok: false, error: "Configurazione incompleta." }, 500);
  }

  const sfsListId = parseInt(process.env.BREVO_SFS_LIST_ID || "3");

  // Attributi contatto
  const nameParts = cleanNome.split(" ");
  const attributes = {
    NOME: nameParts[0] || cleanNome,
    COGNOME: nameParts.slice(1).join(" ") || "",
    AZIENDA: cleanAzienda,
    SFS_DECISIONE: cleanDecisione,
    SFS_PROBLEMA: cleanProblema,
    SFS_LEAD_SOURCE: "sfs_form",
  };

  if (utm_source)   attributes.UTM_SOURCE   = sanitize(utm_source, 200);
  if (utm_medium)   attributes.UTM_MEDIUM   = sanitize(utm_medium, 200);
  if (utm_campaign) attributes.UTM_CAMPAIGN = sanitize(utm_campaign, 200);
  if (utm_id)       attributes.UTM_ID       = sanitize(utm_id, 200);
  if (utm_term)     attributes.UTM_TERM     = sanitize(utm_term, 200);
  if (utm_content)  attributes.UTM_CONTENT  = sanitize(utm_content, 200);
  if (page_url)     attributes.PAGE_URL     = sanitize(page_url, 500);

  const listIds = [sfsListId];
  if (marketing_consent) {
    const mktListId = parseInt(process.env.BREVO_MKT_LIST_ID || String(sfsListId));
    if (!isNaN(mktListId) && !listIds.includes(mktListId)) listIds.push(mktListId);
  }

  try {
    // --- CHECKPOINT 1: upsert contatto ---
    console.log(`${tag} CP1 upsert — listIds=${JSON.stringify(listIds)} attrs=${Object.keys(attributes).join(",")}`);
    const contactResult = await upsertContact({ email: cleanEmail, attributes, listIds });
    console.log(`${tag} CP1 result — status=${contactResult.status} ok=${contactResult.ok} body=${JSON.stringify(contactResult.body).slice(0, 200)}`);

    if (!contactResult.ok) {
      console.error(`${tag} CP1 FAILED — contatto non salvato`);
      return jsonResponse({ ok: false, error: "Errore nel salvataggio. Riprova tra poco." }, 500);
    }

    // --- CHECKPOINT 2: costruzione payload email ---
    console.log(`${tag} CP2 building notification email`);

    const utmLine = utm_source
      ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;">
           <strong style="font-size:13px;color:#888;display:block;">UTM</strong>
           <span style="font-size:13px;color:#555;">
             source: ${sanitize(utm_source || "", 100)}
             &nbsp;·&nbsp;medium: ${sanitize(utm_medium || "", 100)}
             &nbsp;·&nbsp;campaign: ${sanitize(utm_campaign || "", 100)}
           </span>
         </td></tr>`
      : "";

    const notifyPayload = {
      sender:  { name: "Miranda Giaccon", email: "info@mirandagiaccon.it" },
      to:      [{ email: "info@mirandagiaccon.it" }],
      replyTo: { email: cleanEmail, name: cleanNome },
      subject: `Nuovo lead SFS - ${cleanNome} - ${cleanAzienda}`,
      htmlContent: `<!DOCTYPE html>
<html lang="it">
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#7c223f;padding:24px 40px;">
            <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;">Nuovo lead - Software Fit Sprint</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;">
                <strong style="font-size:13px;color:#888;display:block;">Nome</strong>
                <span style="font-size:15px;color:#111;">${cleanNome}</span>
              </td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;">
                <strong style="font-size:13px;color:#888;display:block;">Email</strong>
                <a href="mailto:${cleanEmail}" style="font-size:15px;color:#7c223f;">${cleanEmail}</a>
              </td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;">
                <strong style="font-size:13px;color:#888;display:block;">Azienda</strong>
                <span style="font-size:15px;color:#111;">${cleanAzienda}</span>
              </td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;">
                <strong style="font-size:13px;color:#888;display:block;">Decisione</strong>
                <span style="font-size:15px;color:#111;">${cleanDecisione}</span>
              </td></tr>
              <tr><td style="padding:8px 0;border-bottom:1px solid #eee;">
                <strong style="font-size:13px;color:#888;display:block;">Problema</strong>
                <span style="font-size:15px;color:#111;white-space:pre-wrap;">${cleanProblema}</span>
              </td></tr>
              ${utmLine}
              <tr><td style="padding:8px 0;">
                <strong style="font-size:13px;color:#888;display:block;">Consenso marketing</strong>
                <span style="font-size:15px;color:#111;">${marketing_consent ? "Si" : "No"}</span>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;background:#f9f9f9;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#999;">Rispondi a questa email per scrivere direttamente a ${cleanNome}.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    };

    // --- CHECKPOINT 3: invio email ---
    console.log(`${tag} CP3 sending notify to info@mirandagiaccon.it — subject="${notifyPayload.subject.slice(0, 60)}"`);
    const notifyResult = await sendTransactional(notifyPayload);
    console.log(`${tag} CP3 result — status=${notifyResult.status} ok=${notifyResult.ok} body=${JSON.stringify(notifyResult.body).slice(0, 200)}`);

    if (!notifyResult.ok) {
      // Contatto salvato in Brevo, ma notifica fallita.
      // Miranda non riceve l'email ma il lead e' in Brevo.
      console.error(`${tag} CP3 notify FAILED — contatto salvato ma email non inviata`);
    }

    // --- CHECKPOINT 4: successo ---
    console.log(`${tag} CP4 done — contact_ok=true notify_ok=${notifyResult.ok}`);
    return jsonResponse({ ok: true });

  } catch (err) {
    console.error(`${tag} uncaught error — ${err?.message}`, err?.stack?.slice(0, 500));
    return jsonResponse({ ok: false, error: "Errore interno. Riprova tra poco." }, 500);
  }
};
