import { sbHeaders, sb, checkEnv, checkPin } from "./_lib.js";
import { randomUUID } from "node:crypto";

// Přijme obrázek jako base64 (už zmenšený v prohlížeči) a uloží ho do Supabase Storage
export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

export default async function handler(req, res) {
  if (!checkEnv(res) || !checkPin(req, res)) return;
  if (req.method !== "POST") return res.status(405).end();
  const { data, type } = req.body || {};
  if (!data || !/^image\/(jpeg|png|webp|gif)$/.test(type || "")) return res.status(400).json({ error: "image" });
  const buf = Buffer.from(String(data), "base64");
  if (buf.length > 3_500_000) return res.status(413).json({ error: "size" });
  const ext = type.split("/")[1].replace("jpeg", "jpg");
  const path = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${ext}`;
  const r = await fetch(sb(`/storage/v1/object/images/${path}`), {
    method: "POST",
    headers: sbHeaders({ "Content-Type": type, "x-upsert": "true" }),
    body: buf,
  });
  if (!r.ok) return res.status(502).json({ error: "storage", message: (await r.text()).slice(0, 300) });
  res.status(200).json({ url: sb(`/storage/v1/object/public/images/${path}`) });
}
