import nodemailer from "nodemailer";

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

export default async function handler(req, res) {
  const requestId =
    req.headers["x-vercel-id"] ||
    globalThis.crypto?.randomUUID?.() ||
    Date.now().toString(36);

  if (req.method !== "POST") {
    console.warn("[contact-api] Metodo non consentito", {
      requestId,
      method: req.method,
    });

    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed", requestId });
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
  } = req.body || {};

  console.info("[contact-api] Richiesta ricevuta", {
    requestId,
    hasRequiredFields: Boolean(nome && azienda && email && decisione),
    hasOptionalFields: Boolean(link || attrito || tempi),
  });

  // Honeypot anti-spam
  if (honeypot) {
    console.info("[contact-api] Richiesta scartata dall'honeypot", {
      requestId,
    });

    return res.status(200).json({ ok: true, requestId });
  }

  if (!nome || !azienda || !email || !decisione) {
    console.warn("[contact-api] Validazione fallita", {
      requestId,
      missingFields: [
        !nome && "nome",
        !azienda && "azienda",
        !email && "email",
        !decisione && "decisione",
      ].filter(Boolean),
    });

    return res.status(400).json({
      error: "Campi obbligatori mancanti.",
      requestId,
    });
  }

  if (!isValidEmail(email)) {
    console.warn("[contact-api] Email non valida", {
      requestId,
      email,
    });

    return res.status(400).json({
      error: "Indirizzo email non valido.",
      requestId,
    });
  }

  const missingEnv = ["SMTP_USER", "SMTP_PASS", "MAIL_TO"].filter(
    (key) => !process.env[key],
  );

  if (missingEnv.length) {
    console.error("[contact-api] Configurazione incompleta", {
      requestId,
      missingEnv,
    });

    return res.status(500).json({
      error: "Configurazione email incompleta.",
      requestId,
    });
  }

  const safeNome = escapeHtml(nome);
  const safeAzienda = escapeHtml(azienda);
  const safeEmail = escapeHtml(email);
  const safeDecisione = nl2br(decisione);
  const safeAttrito = nl2br(attrito);
  const safeTempi = escapeHtml(tempi || "non specificato");

  const normalizedLink = normalizeUrl(link);
  const safeLink = normalizedLink ? escapeHtml(normalizedLink) : "";

  const transporter = nodemailer.createTransport({
    host: "smtp.ionos.it",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const internalMailOptions = {
    from: `"Miranda · Sito" <${process.env.SMTP_USER}>`,
    to: process.env.MAIL_TO,
    replyTo: email,
    subject: `Nuova richiesta di triage da ${nome} · ${azienda}`,
    text: [
      `Nome: ${nome}`,
      `Azienda: ${azienda}`,
      `Email: ${email}`,
      normalizedLink ? `Sito/prodotto: ${normalizedLink}` : "",
      ``,
      `Decisione da affrontare:`,
      decisione,
      ``,
      attrito ? `Attrito attuale:\n${attrito}` : "",
      ``,
      `Tempistiche: ${tempi || "non specificato"}`,
      ``,
      `ID richiesta: ${requestId}`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <table style="font-family:Arial,sans-serif;font-size:15px;color:#222;max-width:640px;width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0"><b>Nome:</b> ${safeNome}</td>
        </tr>

        <tr>
          <td style="padding:6px 0"><b>Azienda:</b> ${safeAzienda}</td>
        </tr>

        <tr>
          <td style="padding:6px 0"><b>Email:</b> <a href="mailto:${safeEmail}">${safeEmail}</a></td>
        </tr>

        ${
          safeLink
            ? `
              <tr>
                <td style="padding:6px 0"><b>Sito/prodotto:</b> <a href="${safeLink}" target="_blank" rel="noopener noreferrer">${safeLink}</a></td>
              </tr>
            `
            : ""
        }

        <tr>
          <td style="padding:18px 0 6px">
            <b>Decisione da affrontare:</b><br>
            ${safeDecisione}
          </td>
        </tr>

        ${
          attrito
            ? `
              <tr>
                <td style="padding:6px 0">
                  <b>Attrito attuale:</b><br>
                  ${safeAttrito}
                </td>
              </tr>
            `
            : ""
        }

        <tr>
          <td style="padding:6px 0"><b>Tempistiche:</b> ${safeTempi}</td>
        </tr>

        <tr>
          <td style="padding:18px 0 0;color:#777;font-size:13px;">
            ID richiesta: ${escapeHtml(requestId)}
          </td>
        </tr>
      </table>
    `,
  };

  const autoReplyOptions = {
    from: `"Miranda" <${process.env.SMTP_USER}>`,
    to: email,
    replyTo: process.env.MAIL_TO,
    subject: `Abbiamo ricevuto la tua richiesta · ${azienda}`,
    text: [
      `Ciao ${nome},`,
      ``,
      `grazie per aver inviato la tua richiesta.`,
      `Abbiamo ricevuto correttamente le informazioni e ti ricontatteremo appena possibile.`,
      ``,
      `Ecco il riepilogo della richiesta:`,
      ``,
      `Nome: ${nome}`,
      `Azienda: ${azienda}`,
      `Email: ${email}`,
      normalizedLink ? `Sito/prodotto: ${normalizedLink}` : "",
      ``,
      `Decisione da affrontare:`,
      decisione,
      ``,
      attrito ? `Attrito attuale:\n${attrito}` : "",
      ``,
      `Tempistiche: ${tempi || "non specificato"}`,
      ``,
      `A presto,`,
      `Miranda`,
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.6;max-width:640px;">
        <p>Ciao ${safeNome},</p>

        <p>
          grazie per aver inviato la tua richiesta.<br>
          Abbiamo ricevuto correttamente le informazioni e ti ricontatteremo appena possibile.
        </p>

        <p style="margin-top:24px;"><b>Ecco il riepilogo della richiesta:</b></p>

        <table style="font-family:Arial,sans-serif;font-size:15px;color:#222;width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0"><b>Nome:</b> ${safeNome}</td>
          </tr>

          <tr>
            <td style="padding:6px 0"><b>Azienda:</b> ${safeAzienda}</td>
          </tr>

          <tr>
            <td style="padding:6px 0"><b>Email:</b> ${safeEmail}</td>
          </tr>

          ${
            safeLink
              ? `
                <tr>
                  <td style="padding:6px 0"><b>Sito/prodotto:</b> <a href="${safeLink}" target="_blank" rel="noopener noreferrer">${safeLink}</a></td>
                </tr>
              `
              : ""
          }

          <tr>
            <td style="padding:18px 0 6px">
              <b>Decisione da affrontare:</b><br>
              ${safeDecisione}
            </td>
          </tr>

          ${
            attrito
              ? `
                <tr>
                  <td style="padding:6px 0">
                    <b>Attrito attuale:</b><br>
                    ${safeAttrito}
                  </td>
                </tr>
              `
              : ""
          }

          <tr>
            <td style="padding:6px 0"><b>Tempistiche:</b> ${safeTempi}</td>
          </tr>
        </table>

        <p style="margin-top:24px;">
          A presto,<br>
          Miranda
        </p>

        <p style="margin-top:24px;color:#777;font-size:13px;">
          Questa è una risposta automatica. Puoi rispondere direttamente a questa email se hai bisogno di aggiungere informazioni.
        </p>
      </div>
    `,
  };

  try {
    console.info("[contact-api] Invio SMTP avviato", { requestId });

    const internalInfo = await transporter.sendMail(internalMailOptions);

    console.info("[contact-api] Email interna inviata", {
      requestId,
      messageId: internalInfo.messageId,
    });

    const autoReplyInfo = await transporter.sendMail(autoReplyOptions);

    console.info("[contact-api] Email automatica inviata", {
      requestId,
      messageId: autoReplyInfo.messageId,
    });

    return res.status(200).json({
      ok: true,
      requestId,
    });
  } catch (err) {
    console.error("[contact-api] Errore SMTP", {
      requestId,
      name: err?.name,
      message: err?.message,
      code: err?.code,
      command: err?.command,
      responseCode: err?.responseCode,
    });

    return res.status(500).json({
      error: "Invio non riuscito.",
      requestId,
    });
  }
}
