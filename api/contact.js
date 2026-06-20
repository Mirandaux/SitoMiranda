import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { nome, azienda, email, link, decisione, attrito, tempi, "azienda-web": honeypot } = req.body;

  // honeypot anti-spam
  if (honeypot) {
    return res.status(200).json({ ok: true });
  }

  if (!nome || !azienda || !email || !decisione) {
    return res.status(400).json({ error: "Campi obbligatori mancanti." });
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.ionos.it",
    port: 465,
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
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("SMTP error:", err);
    return res.status(500).json({ error: "Invio non riuscito." });
  }
}
