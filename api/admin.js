import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  try {
    const { token, get } = req.query;

    if (token !== "daiana-2026") {
      return res.status(401).json({ ok: false, error: "Token inválido" });
    }

    // solo soportamos GET de config
    if (req.method !== "GET" || get !== "1") {
      return res.status(400).json({ ok: false, error: "Parámetros inválidos" });
    }

    const cfg = (await redis.get("cfg")) || {
      walink: "",
      rrIndex: 0,
      messages: [],
      updatedAt: null,
    };

    // normalizamos por si guardaste algo raro antes
    const walink = typeof cfg.walink === "string" ? cfg.walink : "";
    const rrIndex = Number.isInteger(cfg.rrIndex) ? cfg.rrIndex : 0;
    const messages = Array.isArray(cfg.messages) ? cfg.messages : [];

    return res.json({ ok: true, walink, rrIndex, messages });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
}
