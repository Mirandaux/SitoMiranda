import nodemailer from "nodemailer";

export default async function handler(req, res) {
  const requestId = req.headers["x-vercel-id"] || globalThis.crypto?.randomUUID?.() || Date.now().toString(36);

  if (req.method !== "POST") {
    console.warn("[contact-api] Metodo non consentito", { requestId, method: req.method });
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed", requestId });
  }

  const { nome, azienda, email, link, decisione, attrito, tempi, "azienda-web": honeypot } = req.body || {};

  console.info("[contact-api] Richiesta ricevuta", {
    requestId,
    hasRequiredFields: Boolean(nome && azienda && email && decisione),
    hasOptionalFields: Boolean(link || attrito || tempi),
  });

  // honeypot anti-spam
  if (honeypot) {
    console.info("[contact-api] Richiesta scartata dall'honeypot", { requestId });
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
    return res.status(400).json({ error: "Campi obbligatori mancanti.", requestId });
  }

  const missingEnv = ["SMTP_USER", "SMTP_PASS", "MAIL_TO"].filter((key) => !process.env[key]);
  if (missingEnv.length) {
    console.error("[contact-api] Configurazione incompleta", { requestId, missingEnv });
    return res.status(500).json({ error: "Configurazione email incompleta.", requestId });
  }

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

  const mailOptions = {
    from: `"Miranda · Sito" <${process.env.SMTP_USER}>`,
    to: process.env.MAIL_TO,
    replyTo: email,
    subject: `Nuova richiesta di triage da ${nome} · ${azienda}`,
    text: [
      `Nome: ${nome}`,
      `Azienda: ${azienda}`,
      `Email: ${email}`,
      link ? `Sito/prodotto: ${link}` : "",
      ``,
      `Decisione da affrontare:`,
      decisione,
      ``,
      attrito ? `Attrito attuale:\n${attrito}` : "",
      ``,
      `Tempistiche: ${tempi || "non specificato"}`,
    ].filter(Boolean).join("\n"),
    html: `
      <table style="font-family:sans-serif;font-size:15px;color:#222;max-width:600px;">
        <tr><td style="padding:6px 0"><b>Nome:</b> ${nome}</td></tr>
        <tr><td style="padding:6px 0"><b>Azienda:</b> ${azienda}</td></tr>
        <tr><td style="padding:6px 0"><b>Email:</b> <a href="mailto:${email}">${email}</a></td></tr>
        ${link ? `<tr><td style="padding:6px 0"><b>Sito/prodotto:</b> <a href="${link}">${link}</a></td></tr>` : ""}
        <tr><td style="padding:18px 0 6px"><b>Decisione da affrontare:</b><br>${decisione.replace(/\n/g, "<br>")}</td></tr>
        ${attrito ? `<tr><td style="padding:6px 0"><b>Attrito attuale:</b><br>${attrito.replace(/\n/g, "<br>")}</td></tr>` : ""}
        <tr><td style="padding:6px 0"><b>Tempistiche:</b> ${tempi || "non specificato"}</td></tr>
      </table>
    `,
  };

  try {
    console.info("[contact-api] Invio SMTP avviato", { requestId });
    const info = await transporter.sendMail(mailOptions);
    console.info("[contact-api] Email inviata", { requestId, messageId: info.messageId });
    return res.status(200).json({ ok: true, requestId });
  } catch (err) {
    console.error("[contact-api] Errore SMTP", {
      requestId,
      name: err?.name,
      message: err?.message,
      code: err?.code,
      command: err?.command,
      responseCode: err?.responseCode,
    });
    return res.status(500).json({ error: "Invio non riuscito.", requestId });
  }
}
