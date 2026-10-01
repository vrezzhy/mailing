const DAYS = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"];
const MONTHS = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
let TODAY = iso(new Date());

let items = [], loaded = false;
let weekStart = monday(new Date());
let monthCur = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let editing = null; // {date, id|null, image, imageAuto}

/* ---------- API ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
async function api(path, opts = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-app-pin": store.get("pin"), ...(opts.headers || {}) },
  });
  if (r.status === 401) { showPin(true); throw Object.assign(new Error("pin"), { code: "pin" }); }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.message || "Chyba " + r.status), { code: data.error });
  return data;
}
const norm = (x) => ({ ...x, createdAt: Date.parse(x.created_at) || 0 });

async function loadItems() {
  try {
    const rows = await api("/api/items");
    const next = rows.map(norm);
    const changed = JSON.stringify(next) !== JSON.stringify(items);
    items = next; loaded = true;
    if (!changed && document.querySelector("form.edit")) return;
    if (editing && editing.id && !items.find((x) => x.id === editing.id)) editing = null;
    if (document.activeElement?.closest?.("form.edit")) { if (tab === "cal") renderCal(); return; }
    notice("");
    render();
  } catch (e) {
    if (e.code !== "pin") notice("Data se nepodařilo načíst: " + e.message, "warn");
    loaded = true; render();
  }
}

/* ---------- PIN ---------- */
function showPin(bad) {
  $("app").hidden = true; $("pinform").hidden = false;
  $("pin-err").hidden = !(bad && store.get("pin"));
  setTimeout(() => $("pin-in").focus(), 0);
}
$("pinform").onsubmit = (e) => {
  e.preventDefault();
  store.set("pin", $("pin-in").value.trim());
  $("pinform").hidden = true; $("app").hidden = false;
  loadItems();
};

function notice(msg, kind) { const n = $("notice"); if (!msg) { n.hidden = true; return; } n.textContent = msg; n.dataset.kind = kind || ""; n.hidden = false; }
function domain(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } }
function byDate() {
  const m = {};
  for (const it of items) (m[it.date] || (m[it.date] = [])).push(it);
  for (const k in m) m[k].sort((a, b) => a.createdAt - b.createdAt);
  return m;
}

/* ---------- Týden ---------- */
function renderWeek() {
  const map = byDate(), end = addDays(weekStart, 6);
  $("range").textContent = weekStart.getDate() + ". " + (weekStart.getMonth() + 1) + ". – " + end.getDate() + ". " + (end.getMonth() + 1) + ". " + end.getFullYear();
  let tot = 0, dn = 0;
  const wk = $("week"); wk.replaceChildren();
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i), key = iso(d), list = map[key] || [];
    tot += list.length; dn += list.filter((x) => x.done).length;
    const col = document.createElement("div"); col.className = "day" + (key === TODAY ? " today" : "");
    const h = document.createElement("div"); h.className = "dayhead";
    h.innerHTML = '<span class="dname"></span><span class="ddate"></span>';
    h.children[0].textContent = DAYS[i]; h.children[1].textContent = d.getDate() + ". " + (d.getMonth() + 1) + ".";
    col.append(h);
    const ul = document.createElement("div"); ul.className = "list";
    for (const it of list) ul.append(editing && editing.id === it.id ? editForm(key, it) : itemCard(it));
    if (!list.length && !(editing && editing.date === key && !editing.id)) {
      const e = document.createElement("div"); e.className = "empty"; e.textContent = loaded ? "Nic naplánováno" : "Načítám…"; ul.append(e);
    }
    col.append(ul);
    if (editing && editing.date === key && !editing.id) col.append(editForm(key, null));
    else {
      const a = document.createElement("button"); a.className = "add"; a.textContent = "+ Přidat firmu / produkt";
      a.onclick = () => { editing = { date: key, id: null, image: null, imageAuto: true }; render(); };
      col.append(a);
    }
    wk.append(col);
  }
  $("wprog").textContent = tot ? "Hotovo " + dn + " / " + tot : "";
}

function itemCard(it) {
  const c = document.createElement("div"); c.className = "item" + (it.done ? " done" : "");
  if (it.image_url) { const im = document.createElement("img"); im.src = it.image_url; im.alt = ""; im.loading = "lazy"; im.referrerPolicy = "no-referrer"; c.append(im); }
  const b = document.createElement("div"); b.className = "ibody";
  if (it.text) { const t = document.createElement("div"); t.className = "itext"; t.textContent = it.text; b.append(t); }
  if (it.url) { const a = document.createElement("a"); a.className = "ilink"; a.href = it.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = "↗ " + domain(it.url); b.append(a); }
  const act = document.createElement("div"); act.className = "iact";
  const lab = document.createElement("label"); lab.className = "check";
  const cb = document.createElement("input"); cb.type = "checkbox"; cb.id = "done-" + it.id; cb.checked = !!it.done;
  cb.onchange = () => setDone(it, cb.checked);
  lab.append(cb, document.createTextNode(it.done ? "Odesláno" : "Hotovo?"));
  const ed = document.createElement("button"); ed.className = "btn ghost"; ed.textContent = "Upravit";
  ed.onclick = () => { editing = { date: it.date, id: it.id, image: it.image_url || null, imageAuto: false }; render(); };
  act.append(lab, ed); b.append(act); c.append(b);
  return c;
}

/* ---------- Formulář ---------- */
const UPPER = new Set(["spf", "uv", "pha", "aha", "bha", "ha", "dna", "3lab", "cbd", "led", "xl", "xxl"]);
function titleFromUrl(u) {
  try {
    const p = new URL(u).pathname.split("/").filter(Boolean).pop();
    if (!p) return "";
    let t = decodeURIComponent(p).replace(/\.(html?|php|aspx?)$/i, "").replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
    t = t.replace(/\b(\d+) (\d+) (ml|g|mg|l)\b/gi, "$1–$2 $3").replace(/\b(\d+)(ml|g|mg|l)\b/gi, "$1 $2");
    return t.split(" ").map((w, i) => UPPER.has(w.toLowerCase()) ? w.toUpperCase()
      : /^(ml|g|mg|l|na|a|s|v|z|do|pro|by|of|and|the)$/i.test(w) && i > 0 ? w.toLowerCase()
      : w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  } catch { return ""; }
}

// Zmenšení obrázku v prohlížeči před nahráním
async function shrink(file, max = 1400) {
  const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = URL.createObjectURL(file); });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(img.src);
  return cv.toDataURL("image/jpeg", 0.85).split(",")[1];
}

function editForm(date, it) {
  const f = document.createElement("form"); f.className = "edit";
  f.innerHTML = `
    <label for="f-url">Odkaz na produkt</label>
    <input id="f-url" type="url" inputmode="url" autocomplete="off" placeholder="https://shop.centraleclinique.cz/…">
    <div class="status" id="f-status" hidden></div>
    <label for="f-name">Název <span class="hint">(vyplní se z odkazu, můžete přepsat)</span></label>
    <input id="f-name" type="text" placeholder="např. 3LAB Anti-Aging Oil 30 ml">
    <label>Obrázek <span class="hint">(načte se z odkazu, nebo vložte vlastní)</span></label>
    <div class="drop" id="f-drop" tabindex="0" role="button"><span id="f-droptxt"></span></div>
    <input id="f-file" type="file" accept="image/*" hidden>
    <div class="row"></div>`;
  const url = f.querySelector("#f-url"), ta = f.querySelector("#f-name"), drop = f.querySelector("#f-drop"), file = f.querySelector("#f-file"), st = f.querySelector("#f-status");
  url.value = it?.url || ""; ta.value = it?.text || "";
  let manual = !!it?.text;
  ta.addEventListener("input", () => { manual = ta.value.trim() !== ""; });

  const showImg = () => {
    drop.querySelector("img")?.remove(); drop.querySelector(".rm")?.remove();
    if (editing.image) {
      const im = document.createElement("img"); im.src = editing.image; im.alt = ""; im.referrerPolicy = "no-referrer"; drop.prepend(im);
      const rm = document.createElement("button"); rm.type = "button"; rm.className = "btn ghost rm"; rm.textContent = "Odebrat obrázek";
      rm.onclick = (e) => { e.stopPropagation(); editing.image = null; editing.imageAuto = false; showImg(); };
      drop.append(rm);
    }
    f.querySelector("#f-droptxt").textContent = editing.image ? "Změnit obrázek (vložit, přetáhnout, klik)" : "Vložte obrázek (Ctrl+V) nebo sem přetáhněte / klikněte";
  };
  showImg();

  // Načtení názvu a obrázku z odkazu
  let timer = null, seq = 0;
  async function fetchPreview() {
    const u = url.value.trim();
    if (!/^https?:\/\/\S+\.\S+/.test(u)) { st.hidden = true; return; }
    if (!manual) ta.value = titleFromUrl(u);
    const my = ++seq;
    st.hidden = false; st.textContent = "Načítám název a obrázek z odkazu…";
    try {
      const p = await api("/api/preview?url=" + encodeURIComponent(u));
      if (my !== seq) return;
      if (p.title && !manual) ta.value = p.title;
      if (p.image && (editing.imageAuto || !editing.image)) { editing.image = p.image; editing.imageAuto = true; showImg(); }
      st.textContent = p.title || p.image ? "Načteno z odkazu ✓" : "Ze stránky se nic načíst nepodařilo, doplňte ručně.";
    } catch (e) {
      if (my === seq) st.textContent = "Ze stránky se nic načíst nepodařilo, doplňte ručně.";
    }
  }
  url.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(fetchPreview, 450); });

  async function takeFile(fl) {
    if (!fl || !fl.type.startsWith("image/")) return;
    f.querySelector("#f-droptxt").textContent = "Nahrávám…";
    try {
      const data = await shrink(fl);
      const r = await api("/api/upload", { method: "POST", body: JSON.stringify({ data, type: "image/jpeg" }) });
      editing.image = r.url; editing.imageAuto = false;
    } catch (e) { notice("Obrázek se nepodařilo nahrát: " + e.message, "warn"); }
    showImg();
  }
  drop.onclick = () => file.click();
  drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } };
  file.onchange = () => takeFile(file.files[0]);
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); takeFile(e.dataTransfer.files[0]); };
  f.addEventListener("paste", (e) => {
    const fl = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/"));
    if (fl) { e.preventDefault(); takeFile(fl); }
  });

  const row = f.querySelector(".row");
  if (it) {
    const del = document.createElement("button"); del.type = "button"; del.className = "btn ghost"; del.textContent = "Smazat"; del.style.marginRight = "auto";
    let armed = false;
    del.onclick = async () => {
      if (!armed) { armed = true; del.textContent = "Opravdu smazat?"; del.style.color = "var(--warn)"; return; }
      try { await api("/api/items?id=" + it.id, { method: "DELETE" }); items = items.filter((x) => x.id !== it.id); editing = null; render(); }
      catch (e) { notice("Smazání se nepovedlo: " + e.message, "warn"); }
    };
    row.append(del);
  }
  const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "btn"; cancel.textContent = "Zrušit";
  cancel.onclick = () => { editing = null; render(); };
  const save = document.createElement("button"); save.type = "submit"; save.className = "btn primary"; save.textContent = it ? "Uložit změny" : "Přidat";
  row.append(cancel, save);

  f.onsubmit = async (e) => {
    e.preventDefault();
    const text = ta.value.trim(), u = url.value.trim();
    if (!text && !u && !editing.image) { url.focus(); return; }
    save.disabled = true; save.textContent = "Ukládám…";
    const body = { date, text, url: u, image_url: editing.image || null };
    try {
      if (it) {
        const [row] = await api("/api/items?id=" + it.id, { method: "PATCH", body: JSON.stringify(body) });
        items = items.map((x) => (x.id === it.id ? norm(row) : x));
      } else {
        const [row] = await api("/api/items", { method: "POST", body: JSON.stringify(body) });
        items.push(norm(row));
      }
      editing = null; notice(""); render();
    } catch (err) {
      save.disabled = false; save.textContent = it ? "Uložit změny" : "Přidat";
      notice("Uložení se nepovedlo: " + err.message, "warn");
    }
  };
  setTimeout(() => (it ? ta : url).focus(), 0);
  return f;
}

async function setDone(it, val) {
  const prev = { done: it.done, done_at: it.done_at };
  Object.assign(it, { done: val, done_at: val ? new Date().toISOString() : null });
  render();
  try { await api("/api/items?id=" + it.id, { method: "PATCH", body: JSON.stringify({ done: it.done, done_at: it.done_at }) }); }
  catch (e) { Object.assign(it, prev); notice("Změnu se nepodařilo uložit: " + e.message, "warn"); render(); }
}

/* ---------- Kalendář ---------- */
function renderCal() {
  const map = byDate(), y = monthCur.getFullYear(), m = monthCur.getMonth();
  $("mlabel").textContent = MONTHS[m].charAt(0).toUpperCase() + MONTHS[m].slice(1) + " " + y;
  const g = $("calgrid"); g.replaceChildren();
  for (const d of ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"]) { const e = document.createElement("div"); e.className = "dow"; e.textContent = d; g.append(e); }
  const start = monday(new Date(y, m, 1)); let tot = 0, dn = 0;
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i); if (i >= 35 && d.getMonth() !== m) break;
    const key = iso(d), list = map[key] || [], done = list.filter((x) => x.done).length;
    if (d.getMonth() === m) { tot += list.length; dn += done; }
    const c = document.createElement("button"); c.type = "button";
    c.className = "cell" + (d.getMonth() !== m ? " out" : "") + (key === TODAY ? " today" : "") + (list.length ? (done === list.length ? " all" : " part") : "");
    const n = document.createElement("span"); n.className = "cnum"; n.textContent = d.getDate(); c.append(n);
    if (list.length) {
      const s = document.createElement("span"); s.className = "cstat"; s.textContent = done + "/" + list.length + (done === list.length ? " ✓" : ""); c.append(s);
      const nm = document.createElement("span"); nm.className = "cnames"; nm.textContent = list.map((x) => (x.text || domain(x.url) || "obrázek").split("\n")[0]).join(" · "); c.append(nm);
    }
    c.onclick = () => { weekStart = monday(d); setTab("week"); };
    c.setAttribute("aria-label", d.getDate() + ". " + (d.getMonth() + 1) + ".: " + (list.length ? done + " z " + list.length + " hotovo" : "nic naplánováno"));
    g.append(c);
  }
  $("mprog").textContent = tot ? "Za měsíc hotovo " + dn + " / " + tot : "";
}

/* ---------- Ovládání ---------- */
let tab = "week";
function setTab(t) {
  tab = t;
  $("tab-week").setAttribute("aria-selected", t === "week"); $("tab-cal").setAttribute("aria-selected", t === "cal");
  $("view-week").hidden = t !== "week"; $("view-cal").hidden = t !== "cal";
  render();
}
function render() { TODAY = iso(new Date()); tab === "week" ? renderWeek() : renderCal(); }
$("tab-week").onclick = () => setTab("week"); $("tab-cal").onclick = () => setTab("cal");
$("prevW").onclick = () => { weekStart = addDays(weekStart, -7); editing = null; render(); };
$("nextW").onclick = () => { weekStart = addDays(weekStart, 7); editing = null; render(); };
$("todayW").onclick = () => { weekStart = monday(new Date()); editing = null; render(); };
$("prevM").onclick = () => { monthCur = new Date(monthCur.getFullYear(), monthCur.getMonth() - 1, 1); render(); };
$("nextM").onclick = () => { monthCur = new Date(monthCur.getFullYear(), monthCur.getMonth() + 1, 1); render(); };

render();
loadItems();
setInterval(() => { if (!document.hidden) loadItems(); }, 20000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) loadItems(); });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
