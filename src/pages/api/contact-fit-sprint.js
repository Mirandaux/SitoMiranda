export const prerender = false;

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
  if (honeypot) return jsonResponse({ ok: true, skipped: true });

  // Validation
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
    return jsonResponse({ ok: false, field: "privacy_consent", error: "Il consenso alla privacy è obbligatorio." }, 400);

  const apiKey = process.env.BREVO_API_KEY;
  const sfsListId = parseInt(process.env.BREVO_SFS_LIST_ID || "3");

  if (!apiKey) {
    console.error("[contact-fit-sprint] BREVO_API_KEY mancante");
    return jsonResponse({ ok: false, error: "Configurazione incompleta." }, 500);
  }

  const headers = {
    "api-key": apiKey,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  // Build Brevo attributes
  const nameParts = cleanNome.split(" ");
  const attributes = {
    FIRSTNAME: nameParts[0] || cleanNome,
    LASTNAME: nameParts.slice(1).join(" ") || "",
    COMPANY: cleanAzienda,
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

  // Marketing list: only if explicit consent, same list for now
  const listIds = [sfsListId];
  if (marketing_consent) {
    const mktListId = parseInt(process.env.BREVO_MKT_LIST_ID || sfsListId);
    if (!listIds.includes(mktListId)) listIds.push(mktListId);
  }

  try {
    // 1. Upsert contact in Brevo
    const contactRes = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({ email: cleanEmail, attributes, listIds, updateEnabled: true }),
    });

    if (!contactRes.ok && contactRes.status !== 204) {
      const err = await contactRes.text();
      console.warn("[contact-fit-sprint] Brevo contacts error", contactRes.status, err);
    }

    // 2. Notification email to Miranda
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

    const notifyRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers,
      body: JSON.stringify({
        sender:  { name: "Miranda Giaccon", email: "info@mirandagiaccon.it" },
        to:      [{ email: "info@mirandagiaccon.it" }],
        replyTo: { email: cleanEmail, name: cleanNome },
        subject: `Nuovo lead SFS · ${cleanNome} · ${cleanAzienda}`,
        htmlContent: `
<!DOCTYPE html>
<html lang="it">
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#7c223f;padding:24px 40px;">
            <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;">Nuovo lead · Software Fit Sprint</p>
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
                <span style="font-size:15px;color:#111;">${marketing_consent ? "Sì" : "No"}</span>
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
      }),
    });

    if (!notifyRes.ok) {
      const err = await notifyRes.text();
      console.error("[contact-fit-sprint] Brevo notify error", notifyRes.status, err);
      // Non fallire: il contatto è stato salvato
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("[contact-fit-sprint] Errore", err?.message);
    return jsonResponse({ ok: false, error: "Errore interno. Riprova tra poco." }, 500);
  }
};
