/* ── محوّل Microsoft Graph ──
   الآيفون والآيباد لا يملكان File System Access API بقرار آبل، ومعظم
   التنفيذيين يعملون من الآيفون. ولا توجد حيلة في المتصفّح تصل إلى OneDrive
   من iOS: اختيار المجلد غير مدعوم، ومشاركة الملفات لا تقرأ ولا تكتب في
   موضعها. الطريق الوحيد اتصال شبكي بواجهة Graph — وهي تعمل على كل جهاز.

   ⚠️ لا يُخزَّن اسم مستخدم ولا كلمة مرور: تسجيل الدخول يتم في صفحة مايكروسوفت
   نفسها، ولا نحتفظ إلا برمز وصول مؤقّت في ذاكرة المتصفّح.
   ⚠️ مُعرّف التطبيق (clientId) ليس سرًّا — يُنشر في كل تطبيقات المتصفّح. */

const GRAPH = "https://graph.microsoft.com/v1.0";
const CFG_KEY = "ik-graph-cfg";      // { clientId }
const ROOT_KEY = "ik-graph-root";    // { driveId, itemId, name }
const SMALL = 4 * 1024 * 1024;       // ما فوقها يُرفع بجلسة

/* ⚠️ لو بقي المعرّف في localStorage وحده لرأى **كل** مستخدم شاشة الضبط على
   جهازه — والضبط شأن المستشار مرّة واحدة. فيُشحن مع القشرة في
   `graph-config.json`، ويبقى التخزين المحلّي تجاوزًا للتجربة. */
let SHIPPED = null;
export async function loadShippedConfig() {
  if (SHIPPED !== null) return SHIPPED;
  try {
    const r = await fetch("graph-config.json", { cache: "no-cache" });
    SHIPPED = r.ok ? await r.json() : {};
  } catch { SHIPPED = {}; }
  return SHIPPED;
}
export const graphConfig = () => {
  let local = null;
  try { local = JSON.parse(localStorage.getItem(CFG_KEY) || "null"); } catch { /* لا شيء */ }
  const shipped = SHIPPED || {};
  const clientId = local?.clientId || shipped.clientId || "";
  return clientId ? { clientId, tenant: local?.tenant || shipped.tenant || "organizations" } : null;
};
export const setGraphConfig = (cfg) => localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
export const graphRoot = () => {
  try { return JSON.parse(localStorage.getItem(ROOT_KEY) || "null"); } catch { return null; }
};
export const setGraphRoot = (r) =>
  r ? localStorage.setItem(ROOT_KEY, JSON.stringify(r)) : localStorage.removeItem(ROOT_KEY);

let MSAL = null, APP = null, ACCOUNT = null;

async function loadMsal() {
  if (window.msal) return window.msal;
  await new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js";
    s.onload = res; s.onerror = () => rej(new Error("تعذّر تحميل مكتبة تسجيل الدخول — تحقّق من الاتصال."));
    document.head.append(s);
  });
  return window.msal;
}

async function app() {
  if (APP) return APP;
  const cfg = graphConfig();
  if (!cfg?.clientId) throw new Error("لم يُضبط مُعرّف التطبيق بعد.");
  MSAL = await loadMsal();
  APP = new MSAL.PublicClientApplication({
    auth: { clientId: cfg.clientId,
            authority: "https://login.microsoftonline.com/" + (cfg.tenant || "organizations"),
            redirectUri: location.origin + location.pathname },
    cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
  });
  if (APP.initialize) await APP.initialize();
  const found = APP.getAllAccounts();
  if (found.length) ACCOUNT = found[0];
  return APP;
}

const SCOPES = ["Files.ReadWrite.All", "User.Read"];

async function token(interactive = false) {
  const a = await app();
  if (!ACCOUNT || interactive) {
    const r = await a.loginPopup({ scopes: SCOPES, prompt: interactive ? "select_account" : undefined });
    ACCOUNT = r.account;
    return r.accessToken;
  }
  try {
    const r = await a.acquireTokenSilent({ scopes: SCOPES, account: ACCOUNT });
    return r.accessToken;
  } catch {
    const r = await a.loginPopup({ scopes: SCOPES });
    ACCOUNT = r.account;
    return r.accessToken;
  }
}

async function api(pathOrUrl, opts = {}) {
  const t = await token();
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : GRAPH + pathOrUrl;
  const r = await fetch(url, {
    ...opts,
    headers: { Authorization: "Bearer " + t, ...(opts.headers || {}) },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("Graph " + r.status + ": " + (await r.text()).slice(0, 160));
  return r;
}

const enc = (rel) => segments(rel).map(encodeURIComponent).join("/");
const segments = (rel) => String(rel ?? "").split("/").map((x) => x.trim()).filter(Boolean);

export class GraphStore {
  constructor(root) { this.root = root; this.kind = "graph"; }

  static supported() { return typeof window !== "undefined" && typeof fetch === "function"; }
  static configured() { return Boolean(graphConfig()?.clientId); }

  label() { return this.root?.name || "OneDrive"; }

  /** تسجيل الدخول واختيار مجلد المدرسة مرّة واحدة */
  static async signIn() { await token(true); return GraphStore.me(); }

  static async me() {
    const r = await api("/me");
    return r ? await r.json() : null;
  }

  /** المجلدات المشاركة معي + مجلدات OneDrive الخاصة بي */
  static async candidates() {
    const out = [];
    const shared = await api("/me/drive/sharedWithMe");
    if (shared) for (const it of (await shared.json()).value || []) {
      if (it.folder && it.remoteItem)
        out.push({ name: it.name, driveId: it.remoteItem.parentReference.driveId,
                   itemId: it.remoteItem.id, from: "مشاركة" });
    }
    const mine = await api("/me/drive/root/children?$top=200");
    if (mine) {
      const d = await api("/me/drive");
      const driveId = d ? (await d.json()).id : null;
      for (const it of (await mine.json()).value || [])
        if (it.folder && driveId) out.push({ name: it.name, driveId, itemId: it.id, from: "OneDrive" });
    }
    return out;
  }

  static async restore() {
    if (!GraphStore.configured()) return null;
    const root = graphRoot();
    if (!root) return null;
    try { await token(); } catch { return null; }
    return new GraphStore(root);
  }
  static async forget() { setGraphRoot(null); }

  _base() { return "/drives/" + this.root.driveId + "/items/" + this.root.itemId; }
  _item(rel) {
    const p = enc(rel);
    return p ? this._base() + ":/" + p : this._base();
  }

  async exists(rel) { return Boolean(await api(this._item(rel))); }

  async readText(rel) {
    const r = await api(this._item(rel) + ":/content");
    if (!r) throw new Error("تعذّر جلب " + rel);
    return r.text();
  }
  async readJson(rel) { return JSON.parse(await this.readText(rel)); }

  async writeText(rel, text) {
    await this._put(rel, new Blob([text], { type: "application/json; charset=utf-8" }));
  }
  async writeJson(rel, data) { await this.writeText(rel, JSON.stringify(data, null, 1)); }

  /* ⚠️ الملفات فوق 4 ميجابايت لا تُقبل بطلب واحد — الشواهد صور وPDF وقد
     تتجاوزها، فتُرفع بجلسة مقسّمة. */
  async writeBinary(rel, buf) {
    const blob = buf instanceof Blob ? buf : new Blob([buf]);
    if (blob.size <= SMALL) return this._put(rel, blob);
    const s = await api(this._item(rel) + ":/createUploadSession", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }),
    });
    const { uploadUrl } = await s.json();
    const CHUNK = 5 * 1024 * 1024;
    for (let start = 0; start < blob.size; start += CHUNK) {
      const end = Math.min(start + CHUNK, blob.size);
      const r = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Range": `bytes ${start}-${end - 1}/${blob.size}` },
        body: blob.slice(start, end),
      });
      if (!r.ok && r.status !== 202) throw new Error("رفع متقطّع: " + r.status);
    }
  }

  async _put(rel, blob) {
    const r = await api(this._item(rel) + ":/content", { method: "PUT", body: blob });
    if (!r) throw new Error("تعذّر حفظ " + rel);
    return r;
  }

  async readBinary(rel) {
    const r = await api(this._item(rel) + ":/content");
    if (!r) throw new Error("تعذّر جلب " + rel);
    return r.arrayBuffer();
  }

  async fileUrl(rel) {
    const r = await api(this._item(rel));
    if (!r) return null;
    return (await r.json())["@microsoft.graph.downloadUrl"] || null;
  }

  /* ⚠️ القراءة ثم الكتابة على الشبكة نافذتها أوسع من المجلد المحلّي:
     يُعاد الجلب لحظة الكتابة ويُرفع الإصدار، كما في بقيّة المحوّلات. */
  async mutateJson(rel, mutate, fallback = {}) {
    let current = fallback;
    try { if (await this.exists(rel)) current = await this.readJson(rel); } catch { /* تالف */ }
    const next = await mutate(structuredClone(current));
    next._rev = (current._rev ?? 0) + 1;
    next._revAt = new Date().toISOString();
    await this.writeJson(rel, next);
    return next;
  }

  async list(rel = "") {
    const r = await api(this._item(rel) + ":/children?$top=400");
    if (!r) return [];
    return ((await r.json()).value || []).map((x) => ({
      name: x.name, kind: x.folder ? "directory" : "file",
    })).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }
}
