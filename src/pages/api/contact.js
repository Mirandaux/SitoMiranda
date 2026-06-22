import nodemailer from "nodemailer";

export const prerender = false;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nl2br(value = "") {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function normalizeUrl(url = "") {
  if (!url) return "";

  const value = String(url).trim();

  try {
    const withProtocol = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`;

    const parsed = new URL(withProtocol);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }

    return parsed.toString();
  } catch {
    return "";
  }
}

function parseEmailList(value = "") {
  return String(value)
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export const POST = async ({ request }) => {
  const requestId =
    request.headers.get("x-vercel-id") ||
    globalThis.crypto?.randomUUID?.() ||
    Date.now().toString(36);

  let body = {};

  try {
    body = await request.json();
  } catch {
    console.warn("[contact-api] Body JSON non valido", { requestId });

    return jsonResponse(
      {
        ok: false,
        error: "Richiesta non valida.",
        requestId,
      },
      400,
    );
  }

  const {
    nome,
    azienda,
    email,
    link,
    decisione,
    attrito,
    tempi,
    "azienda-web": honeypot,
  } = body || {};

  console.info("[contact-api] Richiesta ricevuta", {
    requestId,
    hasRequiredFields: Boolean(nome && azienda && email && decisione),
    hasHoneypot: Boolean(honeypot),
  });

  /**
   * Honeypot anti-spam:
   * se questo campo è valorizzato, risponde 200 ma non invia email.
   */
  if (honeypot) {
    console.info("[contact-api] Bloccata da honeypot", { requestId });

    return jsonResponse({
      ok: true,
      skipped: true,
      requestId,
    });
  }

  if (!nome || !azienda || !email || !decisione) {
    return jsonResponse(
      {
        ok: false,
        error: "Compila tutti i campi obbligatori.",
        requestId,
      },
      400,
    );
  }

  if (!isValidEmail(email)) {
    return jsonResponse(
      {
        ok: false,
        error: "Inserisci un indirizzo email valido.",
        requestId,
      },
      400,
    );
  }

  const missingEnv = [
    "SMTP_USER",
    "SMTP_PASS",
    "MAIL_TO",
  ].filter((key) => !process.env[key]);

  if (missingEnv.length) {
    console.error("[contact-api] Variabili ambiente mancanti", {
      requestId,
      missingEnv,
    });

    return jsonResponse(
      {
        ok: false,
        error: "Configurazione email incompleta.",
        requestId,
      },
      500,
    );
  }

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const mailTo = parseEmailList(process.env.MAIL_TO);
  const replyToMiranda = process.env.REPLY_TO_MIRANDA || smtpUser;

  if (!mailTo.length) {
    console.error("[contact-api] MAIL_TO non contiene destinatari validi", {
      requestId,
    });

    return jsonResponse(
      {
        ok: false,
        error: "Nessun destinatario configurato.",
        requestId,
      },
      500,
    );
  }

  const cleanNome = String(nome).trim();
  const cleanAzienda = String(azienda).trim();
  const cleanEmail = String(email).trim();
  const cleanDecisione = String(decisione).trim();
  const cleanAttrito = attrito ? String(attrito).trim() : "";
  const cleanTempi = tempi ? String(tempi).trim() : "Non specificato";
  const cleanLink = normalizeUrl(link);

  const safeNome = escapeHtml(cleanNome);
  const safeAzienda = escapeHtml(cleanAzienda);
  const safeEmail = escapeHtml(cleanEmail);
  const safeDecisione = nl2br(cleanDecisione);
  const safeAttrito = nl2br(cleanAttrito);
  const safeTempi = escapeHtml(cleanTempi);
  const safeLink = cleanLink ? escapeHtml(cleanLink) : "";

  const transporter = nodemailer.createTransport({
    host: "smtp.ionos.it",
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  const riepilogoText = [
    `Nome: ${cleanNome}`,
    `Azienda: ${cleanAzienda}`,
    `Email: ${cleanEmail}`,
    cleanLink ? `Sito/prodotto: ${cleanLink}` : "",
    "",
    "Decisione da affrontare:",
    cleanDecisione,
    "",
    cleanAttrito ? `Attrito attuale:\n${cleanAttrito}` : "",
    "",
    `Tempistiche: ${cleanTempi}`,
  ]
    .filter(Boolean)
    .join("\n");

  const riepilogoHtml = `
    <table style="font-family:Arial,sans-serif;font-size:15px;color:#222;max-width:640px;width:100%;border-collapse:collapse;line-height:1.5;">
      <tr>
        <td style="padding:6px 0;">
          <strong>Nome:</strong> ${safeNome}
        </td>
      </tr>

      <tr>
        <td style="padding:6px 0;">
          <strong>Azienda:</strong> ${safeAzienda}
        </td>
      </tr>

      <tr>
        <td style="padding:6px 0;">
          <strong>Email:</strong>
          <a href="mailto:${safeEmail}">${safeEmail}</a>
        </td>
      </tr>

      ${
        safeLink
          ? `
            <tr>
              <td style="padding:6px 0;">
                <strong>Sito/prodotto:</strong>
                <a href="${safeLink}" target="_blank" rel="noopener noreferrer">${safeLink}</a>
              </td>
            </tr>
          `
          : ""
      }

      <tr>
        <td style="padding:18px 0 6px;">
          <strong>Decisione da affrontare:</strong><br>
          ${safeDecisione}
        </td>
      </tr>

      ${
        cleanAttrito
          ? `
            <tr>
              <td style="padding:6px 0;">
                <strong>Attrito attuale:</strong><br>
                ${safeAttrito}
              </td>
            </tr>
          `
          : ""
      }

      <tr>
        <td style="padding:6px 0;">
          <strong>Tempistiche:</strong> ${safeTempi}
        </td>
      </tr>
    </table>
  `;

  const internalMail = {
    from: `"Miranda · Sito" <${smtpUser}>`,
    to: mailTo,
    replyTo: cleanEmail,
    subject: `Nuova richiesta di triage da ${cleanNome} · ${cleanAzienda}`,
    text: [riepilogoText, "", `ID richiesta: ${requestId}`].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;color:#222;">
        <h2 style="font-size:20px;margin:0 0 16px;">
          Nuova richiesta dal form
        </h2>

        ${riepilogoHtml}

        <p style="margin-top:24px;color:#777;font-size:13px;">
          ID richiesta: ${escapeHtml(requestId)}
        </p>
      </div>
    `,
  };

  const userMail = {
    from: `"Miranda" <${smtpUser}>`,
    to: cleanEmail,
    replyTo: replyToMiranda,
    subject: `Abbiamo ricevuto la tua richiesta · ${cleanAzienda}`,
    text: [
      `Ciao ${cleanNome},`,
      "",
      "grazie per aver inviato la tua richiesta.",
      "Abbiamo ricevuto correttamente le informazioni e ti ricontatteremo appena possibile.",
      "",
      "Ecco il riepilogo della tua richiesta:",
      "",
      riepilogoText,
      "",
      "A presto,",
      "Miranda",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.6;max-width:640px;">
        <p>Ciao ${safeNome},</p>

        <p>
          grazie per aver inviato la tua richiesta.<br>
          Abbiamo ricevuto correttamente le informazioni e ti ricontatteremo appena possibile.
        </p>

        <p style="margin-top:24px;">
          <strong>Ecco il riepilogo della tua richiesta:</strong>
        </p>

        ${riepilogoHtml}

        <p style="margin-top:24px;">
          A presto,<br>
          Miranda
        </p>

        <p style="margin-top:24px;color:#777;font-size:13px;">
          Questa è una risposta automatica. Puoi rispondere direttamente a questa email se vuoi aggiungere altre informazioni.
        </p>
      </div>
    `,
  };

  try {
    console.info("[contact-api] Invio email interna avviato", { requestId });

    const internalInfo = await transporter.sendMail(internalMail);

    console.info("[contact-api] Email interna inviata", {
      requestId,
      messageId: internalInfo.messageId,
    });

    let confirmationSent = false;

    try {
      const userInfo = await transporter.sendMail(userMail);
      confirmationSent = true;

      console.info("[contact-api] Email automatica inviata", {
        requestId,
        messageId: userInfo.messageId,
      });
    } catch (error) {
      console.warn("[contact-api] Email automatica non inviata", {
        requestId,
        name: error?.name,
        message: error?.message,
        code: error?.code,
        command: error?.command,
        responseCode: error?.responseCode,
      });
    }

    return jsonResponse({
      ok: true,
      confirmationSent,
      requestId,
    });
  } catch (error) {
    console.error("[contact-api] Errore invio email", {
      requestId,
      name: error?.name,
      message: error?.message,
      code: error?.code,
      command: error?.command,
      responseCode: error?.responseCode,
    });

    return jsonResponse(
      {
        ok: false,
        error: "Invio email non riuscito.",
        requestId,
      },
      500,
    );
  }
};
