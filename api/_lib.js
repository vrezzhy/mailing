// Sdílené pomocné funkce pro API (soubory začínající "_" nejsou samostatné endpointy)
const env = () => ({
  url: (process.env.SUPABASE_URL || "").trim().replace(/\/+$/, ""),
  key: (process.env.SUPABASE_SERVICE_KEY || "").trim(),
});

export function sbHeaders(extra = {}) {
  const { key } = env();
  const h = { apikey: key, ...extra };
  if (key.startsWith("eyJ")) h.Authorization = "Bearer " + key; // starý typ klíče (JWT)
  return h;
}
export const sb = (path) => env().url + path;

export function checkEnv(res) {
  const { url, key } = env();
  if (!url || !key) {
    res.status(500).json({ error: "config", message: "Chybí SUPABASE_URL nebo SUPABASE_SERVICE_KEY ve Vercel → Settings → Environment Variables." });
    return false;
  }
  return true;
}

// Volitelný PIN: když je nastaven APP_PIN, musí ho klient posílat v hlavičce x-app-pin
export function checkPin(req, res) {
  const pin = process.env.APP_PIN;
  if (!pin) return true;
  if ((req.headers["x-app-pin"] || "") === pin) return true;
  res.status(401).json({ error: "pin", message: "Špatný PIN." });
  return false;
}
