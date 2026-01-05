// /api/admin.js
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd, ...args) {
  const url = `${UPSTASH_REDIS_REST_URL}/${cmd}/${args.map(encodeURIComponent).join("/")}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  const data = await r.json();
  return data.result;
}

export default async function handler(req, res) {
  try {
    const walink = await redis("get", "cfg:walink");
    const messagesJson = await redis("get", "cfg:messages");
    const rrIndex = await redis("get", "cfg:rr_index");

    let messages = [];
    try { messages = messagesJson ? JSON.parse(messagesJson) : []; } catch { messages = []; }

    res.status(200).json({
      walink: walink || "",
      rrIndex: Number(rrIndex || 0),
      messages,
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || "unknown" });
  }
}
