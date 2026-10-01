import { checkPin } from "./_lib.js";

// Načte stránku produktu a vrátí název a obrázek (og:title, og:image)
export function decode(s = "") {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function meta(html, names) {
  for (const n of names) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${n}["'][^>]*content=["']([^"']*)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name|itemprop)=["']${n}["']`, "i");
    const m = html.match(re1) || html.match(re2);
    if (m && m[1].trim()) return decode(m[1]);
  }
  return "";
}

export function parse(html, pageUrl) {
  let title = meta(html, ["og:title", "twitter:title"]);
  if (!title) {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    title = decode((h1 ? h1[1] : t ? t[1] : "").replace(/<[^>]+>/g, ""));
  }
  const site = meta(html, ["og:site_name"]);
  // odstranit název e-shopu za pomlčkou / svislítkem
  title = title.replace(/\s+[-|–—]\s+[^-|–—]+$/, (m) => (site && m.toLowerCase().includes(site.toLowerCase().slice(0, 6))) || /shop|e-shop|\.cz|\.com/i.test(m) ? "" : m).trim();

  let image = meta(html, ["og:image", "og:image:url", "og:image:secure_url", "twitter:image", "image"]);
  if (!image) {
    const ld = html.match(/"image"\s*:\s*(?:\[\s*)?"([^"]+)"/i);
    if (ld) image = ld[1].replace(/\\\//g, "/");
  }
  if (image) { try { image = new URL(image, pageUrl).href; } catch { image = ""; } }
  return { title, image };
}

export default async function handler(req, res) {
  if (!checkPin(req, res)) return;
  let target;
  try {
    target = new URL(String(req.query.url || ""));
    if (!/^https?:$/.test(target.protocol)) throw 0;
  } catch {
    return res.status(400).json({ error: "url", message: "Neplatný odkaz." });
  }
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(target.href, {
      signal: ctl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36",
        "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.6",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timer);
    const html = (await r.text()).slice(0, 1_500_000);
    const out = parse(html, r.url || target.href);
    res.setHeader("Cache-Control", "s-maxage=86400");
    res.status(200).json(out);
  } catch (e) {
    res.status(200).json({ title: "", image: "", error: "fetch" });
  }
}
