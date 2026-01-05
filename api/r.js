// /api/r.js
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd, ...args) {
  const url = `${UPSTASH_REDIS_REST_URL}/${cmd}/${args.map(encodeURIComponent).join("/")}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
  });
  const data = await r.json();
  return data.result;
}

function normalizeWaLink(walink) {
  // Acepta wa.me o api.whatsapp.com, etc. y devuelve URL lista para agregar ?text=
  try {
    // si ya es https://wa.me/...
    if (walink.includes("wa.me")) return walink;
    // si es numero pelado
    if (/^\+?\d+$/.test(walink)) return `https://wa.me/${walink.replace("+", "")}`;
    return walink; // si ya lo manejás como link final
  } catch {
    return walink;
  }
}

export default async function handler(req, res) {
  try {
    const walinkRaw = await redis("get", "cfg:walink");
    const walink = normalizeWaLink(walinkRaw || "");

    if (!walink) {
      res.status(400).send("Falta configurar WALINK en el panel");
      return;
    }

    const messagesJson = await redis("get", "cfg:messages");
    let messages = [];
    try {
      messages = messagesJson ? JSON.parse(messagesJson) : [];
    } catch {
      messages = [];
    }

    const active = messages.filter(m => m && m.active && String(m.text || "").trim().length > 0);

    // Si no hay mensajes activos, cae en un texto default (opcional)
    const fallbackText = "Hola! Te hablo por tu solicitud. Decime tu nombre/apodo y te registro 🙌";
    if (active.length === 0) {
      const url = `${walink}?text=${encodeURIComponent(fallbackText)}`;
      res.writeHead(302, { Location: url });
      res.end();
      return;
    }

    // Round robin atómico
    const n = await redis("incr", "cfg:rr_index"); // devuelve 1,2,3...
    const idx = (Number(n) - 1) % active.length;
    const chosen = active[idx];

    const url = `${walink}?text=${encodeURIComponent(chosen.text)}`;

    res.writeHead(302, { Location: url });
    res.end();
  } catch (e) {
    res.status(500).send("Error en r.js: " + (e?.message || "unknown"));
  }
}
