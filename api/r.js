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

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function normalizeWaLink(walink) {
  let w = String(walink || "").trim();
  if (!w) return "";

  // Si viene con texto predefinido, lo sacamos (porque /api/r agrega su propio text)
  // Ej: https://wa.me/549.. ?text=...
  w = w.split("?")[0].trim();

  // Si es número pelado
  if (/^\+?\d+$/.test(w)) return `https://wa.me/${w.replace("+", "")}`;

  // Si viene sin protocolo (raro), se lo ponemos
  if (w.startsWith("wa.me/")) return `https://${w}`;

  return w;
}

async function getCfgFromRedis() {
  // ✅ Nuevo formato: todo junto en una key "cfg"
  const cfgJson = await redis("get", "cfg");
  const cfgParsed = cfgJson ? safeJsonParse(cfgJson) : null;

  if (cfgParsed) {
    // por si alguna vez guardaste {cfg:{...}}
    const cfg = cfgParsed.cfg || cfgParsed;
    return {
      walink: cfg.walink || "",
      messages: Array.isArray(cfg.messages) ? cfg.messages : [],
    };
  }

  // ✅ Fallback a formato viejo: keys separadas
  const walinkRaw = await redis("get", "cfg:walink");
  const messagesJson = await redis("get", "cfg:messages");
  const messagesParsed = messagesJson ? safeJsonParse(messagesJson) : [];

  return {
    walink: walinkRaw || "",
    messages: Array.isArray(messagesParsed) ? messagesParsed : [],
  };
}

export default async function handler(req, res) {
  try {
    const cfg = await getCfgFromRedis();

    const walink = normalizeWaLink(cfg.walink);
    if (!walink) {
      res.status(400).send("Falta configurar WALINK en el panel");
      return;
    }

    const messages = Array.isArray(cfg.messages) ? cfg.messages : [];
    const active = messages.filter(
      (m) => m && m.active && String(m.text || "").trim().length > 0
    );

    const fallbackText =
      "Hola! Te hablo por tu solicitud. Decime tu nombre/apodo y te registro 🙌";

    // Si no hay mensajes activos, igual manda uno default
    if (active.length === 0) {
      const url = `${walink}?text=${encodeURIComponent(fallbackText)}`;
      res.writeHead(302, { Location: url });
      res.end();
      return;
    }

    // Round robin atómico (contador separado)
    const n = await redis("incr", "cfg:rr_index"); // 1,2,3...
    const idx = (Number(n) - 1) % active.length;
    const chosen = active[idx];

    const url = `${walink}?text=${encodeURIComponent(chosen.text)}`;
    res.writeHead(302, { Location: url });
    res.end();
  } catch (e) {
    res.status(500).send("Error en r.js: " + (e?.message || "unknown"));
  }
}
