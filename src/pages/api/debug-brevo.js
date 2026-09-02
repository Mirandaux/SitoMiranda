export const prerender = false;

// Endpoint temporaneo di diagnostica Brevo.
// NON espone valori di chiavi. Da rimuovere dopo la diagnosi.

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET = async () => {
  const apiKey = process.env.BREVO_API_KEY;
  const listId = parseInt(process.env.BREVO_LIST_ID || "2");
  const sfsListId = parseInt(process.env.BREVO_SFS_LIST_ID || "3");

  if (!apiKey) {
    return json({ ok: false, error: "BREVO_API_KEY mancante in Vercel" });
  }

  const headers = {
    "api-key": apiKey,
    "Accept": "application/json",
  };

  const results = {};

  // 1. Controlla account / chiave
  try {
    const r = await fetch("https://api.brevo.com/v3/account", { headers });
    const body = await r.json().catch(() => ({}));
    results.account = {
      status: r.status,
      ok: r.ok,
      email: body.email ?? null,
      plan: body.plan?.[0]?.type ?? null,
      error: !r.ok ? (body.message ?? body.code ?? "errore sconosciuto") : null,
    };
  } catch (e) {
    results.account = { error: e.message };
  }

  // 2. Controlla lista matrice
  try {
    const r = await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}`, { headers });
    const body = await r.json().catch(() => ({}));
    results.list_matrix = {
      id: listId,
      status: r.status,
      ok: r.ok,
      name: body.name ?? null,
      error: !r.ok ? (body.message ?? body.code ?? null) : null,
    };
  } catch (e) {
    results.list_matrix = { id: listId, error: e.message };
  }

  // 3. Controlla lista SFS
  try {
    const r = await fetch(`https://api.brevo.com/v3/contacts/lists/${sfsListId}`, { headers });
    const body = await r.json().catch(() => ({}));
    results.list_sfs = {
      id: sfsListId,
      status: r.status,
      ok: r.ok,
      name: body.name ?? null,
      error: !r.ok ? (body.message ?? body.code ?? null) : null,
    };
  } catch (e) {
    results.list_sfs = { id: sfsListId, error: e.message };
  }

  // 4. Controlla sender verificato
  try {
    const r = await fetch("https://api.brevo.com/v3/senders", { headers });
    const body = await r.json().catch(() => ({}));
    const senders = body.senders ?? [];
    results.senders = senders.map((s) => ({
      name: s.name,
      email: s.email,
      active: s.active,
    }));
  } catch (e) {
    results.senders = { error: e.message };
  }

  // 5. Controlla attributi personalizzati
  try {
    const r = await fetch("https://api.brevo.com/v3/contacts/attributes", { headers });
    const body = await r.json().catch(() => ({}));
    const attrs = body.attributes ?? [];
    results.attributes = attrs.map((a) => ({ name: a.name, type: a.type, category: a.category }));
  } catch (e) {
    results.attributes = { error: e.message };
  }

  const keyPrefix = apiKey.slice(0, 6);
  const keySuffix = apiKey.slice(-4);

  return json({
    ok: results.account?.ok ?? false,
    key_hint: `${keyPrefix}...${keySuffix} (${apiKey.length} chars)`,
    env: {
      BREVO_LIST_ID: listId,
      BREVO_SFS_LIST_ID: sfsListId,
      BREVO_MKT_LIST_ID: process.env.BREVO_MKT_LIST_ID ?? "(non impostata)",
    },
    results,
  });
};
