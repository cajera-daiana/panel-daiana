// /api/admin-post.js
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd, ...args) {
  const url = `${UPSTASH_REDIS_REST_URL}/${cmd}/${args.map(encodeURIComponent).join("/")}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` } });
  const data = await r.json();
  return data.result;
}

async function getMessages() {
  const raw = await redis("get", "cfg:messages");
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

async function setMessages(messages) {
  return redis("set", "cfg:messages", JSON.stringify(messages));
}

function uid() {
  return "m_" + Math.random().toString(36).slice(2, 10);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Method not allowed");

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { action } = body || {};

    if (action === "set_walink") {
      const walink = String(body.walink || "").trim();
      await redis("set", "cfg:walink", walink);
      return res.status(200).json({ ok: true });
    }

    if (action === "add_message") {
      const messages = await getMessages();
      const newMsg = {
        id: uid(),
        title: String(body.title || "Nuevo mensaje").trim(),
        text: String(body.text || "").trim(),
        active: true,
      };
      messages.push(newMsg);
      await setMessages(messages);
      return res.status(200).json({ ok: true, message: newMsg });
    }

    if (action === "update_message") {
      const { id, patch } = body;
      const messages = await getMessages();
      const i = messages.findIndex(m => m.id === id);
      if (i === -1) return res.status(404).json({ ok: false, error: "No existe ese mensaje" });

      messages[i] = {
        ...messages[i],
        ...(patch || {}),
        title: String((patch?.title ?? messages[i].title) || "").trim(),
        text: String((patch?.text ?? messages[i].text) || "").trim(),
        active: Boolean(patch?.active ?? messages[i].active),
      };

      await setMessages(messages);
      return res.status(200).json({ ok: true });
    }

    if (action === "delete_message") {
      const { id } = body;
      const messages = await getMessages();
      const filtered = messages.filter(m => m.id !== id);
      await setMessages(filtered);
      return res.status(200).json({ ok: true });
    }

    if (action === "reorder_messages") {
      // body.order = [id1,id2,id3]
      const order = Array.isArray(body.order) ? body.order : [];
      const messages = await getMessages();
      const map = new Map(messages.map(m => [m.id, m]));
      const reordered = order.map(id => map.get(id)).filter(Boolean);

      // si falta alguno (por error), lo agregamos al final
      const leftovers = messages.filter(m => !order.includes(m.id));
      await setMessages([...reordered, ...leftovers]);

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: "Acción inválida" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || "unknown" });
  }
}
