import { sbHeaders, sb, checkEnv, checkPin } from "./_lib.js";

const FIELDS = ["date", "text", "url", "image_url", "done", "done_at"];
const pick = (o = {}) => Object.fromEntries(Object.entries(o).filter(([k]) => FIELDS.includes(k)));
const validId = (id) => /^[0-9a-f-]{36}$/i.test(id || "");

export default async function handler(req, res) {
  if (!checkEnv(res) || !checkPin(req, res)) return;
  const base = sb("/rest/v1/items");
  const id = req.query.id;
  let r;
  try {
    if (req.method === "GET") {
      r = await fetch(base + "?select=*&order=created_at.asc", { headers: sbHeaders() });
    } else if (req.method === "POST") {
      const body = pick(req.body);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || "")) return res.status(400).json({ error: "date" });
      r = await fetch(base, {
        method: "POST",
        headers: sbHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
        body: JSON.stringify(body),
      });
    } else if (req.method === "PATCH") {
      if (!validId(id)) return res.status(400).json({ error: "id" });
      r = await fetch(base + "?id=eq." + id, {
        method: "PATCH",
        headers: sbHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
        body: JSON.stringify(pick(req.body)),
      });
    } else if (req.method === "DELETE") {
      if (!validId(id)) return res.status(400).json({ error: "id" });
      r = await fetch(base + "?id=eq." + id, { method: "DELETE", headers: sbHeaders() });
    } else {
      return res.status(405).end();
    }
  } catch (e) {
    return res.status(502).json({ error: "db", message: String(e) });
  }
  const text = await r.text();
  if (!r.ok) return res.status(502).json({ error: "db", message: text.slice(0, 300) });
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(text || "{}");
}
