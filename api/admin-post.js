import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  try {
    const { token } = req.query;
    if (token !== "daiana-2026") {
      return res.status(401).json({ ok: false, error: "Token inválido" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Método no permitido" });
    }

    const { action, walink, messages } = req.body || {};

    // ✅ ESTA ES LA CLAVE
    if (action === "set_all") {
      if (!walink || !Array.isArray(messages)) {
        return res.status(400).json({ ok: false, error: "Datos incompletos" });
      }

      const data = {
        walink,
        messages,
        rrIndex: 0,
        updatedAt: Date.now()
      };

      await redis.set("cfg", data);

      return res.json({ ok: true });
    }

    // ❌ cualquier otra acción
    return res.status(400).json({
      ok: false,
      error: "Acción inválida"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      error: "Error interno"
    });
  }
}
