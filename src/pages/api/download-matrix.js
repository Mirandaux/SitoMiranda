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

export const POST = async ({ request }) => {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Richiesta non valida." }, 400);
  }

  const { email, honeypot } = body || {};

  // Honeypot anti-spam
  if (honeypot) return jsonResponse({ ok: true, skipped: true });

  if (!email || !isValidEmail(email)) {
    return jsonResponse({ ok: false, error: "Inserisci un indirizzo email valido." }, 400);
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = parseInt(process.env.BREVO_LIST_ID || "2");

  if (!apiKey) {
    console.error("[download-matrix] BREVO_API_KEY mancante");
    return jsonResponse({ ok: false, error: "Configurazione incompleta." }, 500);
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const pdfUrl = "https://mirandagiaccon.it/assets/matrice-decisionale-software-miranda.pdf";
  const headers = {
    "api-key": apiKey,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  try {
    // 1. Aggiungi il contatto alla lista Brevo
    const contactRes = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: cleanEmail,
        listIds: [listId],
        updateEnabled: true,
      }),
    });

    if (!contactRes.ok && contactRes.status !== 204) {
      const err = await contactRes.text();
      console.warn("[download-matrix] Brevo contacts error", contactRes.status, err);
    }

    // 2. Invia email di conferma con link PDF
    const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers,
      body: JSON.stringify({
        sender: { name: "Miranda Giaccon", email: "info@mirandagiaccon.it" },
        to: [{ email: cleanEmail }],
        subject: "La tua matrice decisionale",
        htmlContent: `
<!DOCTYPE html>
<html lang="it">
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#7c223f;padding:28px 40px;">
            <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">Miranda · UX &amp; Product Consulting</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 16px;font-size:24px;font-weight:800;color:#111;line-height:1.2;">Ecco la tua matrice decisionale.</h1>
            <p style="margin:0 0 14px;font-size:15px;color:#444;line-height:1.6;">Puoi usarla per confrontare software, evidenziare rischi e separare quello che sembra bello in demo da quello che regge il lavoro quotidiano.</p>
            <p style="margin:0 0 28px;font-size:15px;color:#444;line-height:1.6;">Le caselle vuote sono la parte più interessante: mostrano cosa non è ancora chiaro prima di decidere.</p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="border-radius:8px;background:#7c223f;">
                  <a href="${pdfUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                    Scarica la matrice
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;color:#888;line-height:1.5;">Se il bottone non funziona, copia questo link nel browser:</p>
            <p style="margin:0 0 32px;font-size:13px;color:#888;word-break:break-all;">${pdfUrl}</p>
            <hr style="border:0;border-top:1px solid #eee;margin:0 0 24px;">
            <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">Se stai valutando un software e vuoi una decisione difendibile prima di firmare, <a href="https://calendly.com/mirandauxdesigner/30min" style="color:#7c223f;">prenota una call di triage da 30 minuti</a>.</p>
            <p style="margin:20px 0 0;font-size:14px;color:#333;">A presto,<br><strong>Miranda</strong></p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;background:#f9f9f9;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">Hai ricevuto questa email perché hai richiesto la matrice decisionale su <a href="https://mirandagiaccon.it" style="color:#999;">mirandagiaccon.it</a>.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error("[download-matrix] Brevo email error", emailRes.status, err);
      return jsonResponse({ ok: false, error: "Invio email non riuscito. Riprova tra poco." }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("[download-matrix] Errore", err?.message);
    return jsonResponse({ ok: false, error: "Errore interno. Riprova tra poco." }, 500);
  }
};
