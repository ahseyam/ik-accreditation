/* ── الطريق الثالث: بلا حساب ولا تسجيل دخول ──
   الآيفون لا يفتح مجلدًا ولا يكتب فيه. وحين لا يُراد حساب مايكروسوفت يبقى
   طريق واحد يعمل على كل جهاز اليوم: **حقيبة عمل** تُجهَّز على حاسب وتُرسل
   للتنفيذي بالواتساب، يعبّئها على جوّاله، ويُعيد **ملف إدخالات** يُستورَد
   على الحاسب فيُكتب في مواضعه الصحيحة داخل المجلد.

   ⚠️ لا يُخترع مسار: الاستيراد يكتب في المسار الذي حسبه المُصدِّر نفسه
   (`مخرجات/<الترتيب> - <الدور>/…`)، فلا يختلف موضع الملف باختلاف الطريق. */

export const PACK_VERSION = 1;

/* ⚠️ الحقيبة تحمل ما يلزم للعرض بلا اتصال، ولا تحمل ما لا يخصّ صاحبها:
   لا روستر المدرسة كاملًا ولا خطط الآخرين. أصغر حجمًا وأقلّ كشفًا. */

const stamp = () => new Date().toISOString().slice(0, 10);
const safe = (s) => String(s ?? "").replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();

/** حقيبة عمل لشخص واحد: هويّته وسجلاته وما يلزم لعرضها بلا اتصال */
export function buildWorkPack(bundle, person, records) {
  return {
    _نوع: "حقيبة عمل — الاعتماد الخارجي",
    _إصدار: PACK_VERSION,
    _أُنشئت: new Date().toISOString(),
    مدرسة: bundle.school,
    شخص: person,
    سجلات: records,
    مساند: {
      weeks: bundle.support?.weeks || [],
      teachers: bundle.support?.teachers || [],
      staff: bundle.support?.staff || [],
      committees: bundle.support?.committees || [],
    },
    تنفيذية: bundle.exec?.byRole?.[person.role] || [],
  };
}

export const workPackName = (school, person) =>
  "حقيبة — " + safe(person.fullName || person.role) + " — " + safe(school?.nameAr || "") + ".json";

/** ملف الإدخالات العائد من الجوّال */
export function buildEntryPack(school, person, entries) {
  return {
    _نوع: "إدخالات — الاعتماد الخارجي",
    _إصدار: PACK_VERSION,
    _أُرسلت: new Date().toISOString(),
    مدرسة: school?.nameAr || "",
    شخص: { id: person.id, fullName: person.fullName, role: person.role, orderNum: person.orderNum },
    إدخالات: entries,   // [{ path, data }]
  };
}

export const entryPackName = (person) =>
  "إدخالات — " + safe(person.fullName || person.role) + " — " + stamp() + ".json";

/** يتحقّق من ملف قبل قبوله — لا يُستورد ما لا يُعرف نوعه */
export function inspectPack(obj) {
  if (!obj || typeof obj !== "object") return { ok: false, why: "الملف ليس بيانات صالحة." };
  const t = obj._نوع || "";
  if (/حقيبة عمل/.test(t)) {
    if (!obj.شخص || !Array.isArray(obj.سجلات))
      return { ok: false, why: "حقيبة ناقصة — أعِد تصديرها من الحاسب." };
    return { ok: true, kind: "work", person: obj.شخص, count: obj.سجلات.length };
  }
  if (/إدخالات/.test(t)) {
    if (!Array.isArray(obj.إدخالات))
      return { ok: false, why: "ملف إدخالات ناقص." };
    const bad = obj.إدخالات.filter((e) => !e?.path || !String(e.path).startsWith("مخرجات/"));
    if (bad.length) return { ok: false, why: bad.length + " إدخالًا بمسار غير صالح — رُفض الملف كلّه." };
    return { ok: true, kind: "entries", person: obj.شخص, count: obj.إدخالات.length,
             sentAt: obj._أُرسلت, school: obj.مدرسة };
  }
  return { ok: false, why: "ملف غير معروف — يُقبل «حقيبة عمل» أو «إدخالات» فقط." };
}

/** يكتب إدخالات ملفٍّ مستورَد في مواضعها داخل المجلد */
export async function importEntries(store, pack) {
  const chk = inspectPack(pack);
  if (!chk.ok) throw new Error(chk.why);
  if (chk.kind !== "entries") throw new Error("هذا ليس ملف إدخالات.");
  const done = [], failed = [];
  for (const e of pack.إدخالات) {
    try {
      if (await store.exists(e.path)) { failed.push({ path: e.path, why: "موجود مسبقًا — لم يُستبدل" }); continue; }
      await store.writeJson(e.path, e.data);
      done.push(e.path);
    } catch (err) { failed.push({ path: e.path, why: err.message }); }
  }
  return { done, failed };
}

/** تنزيل أو مشاركة — الجوّال يشارك، والحاسب ينزّل */
export async function deliver(name, obj) {
  const text = JSON.stringify(obj, null, 1);
  const file = new File([text], name, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return "share"; }
    catch (e) { if (e.name === "AbortError") return "cancelled"; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "download";
}

export async function readPackFile(file) {
  const text = await file.text();
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error("الملف ليس بصيغة صالحة."); }
  const chk = inspectPack(obj);
  if (!chk.ok) throw new Error(chk.why);
  return { obj, chk };
}


/* ── محوّل الحقيبة ──
   يقرأ من حقيبة في الذاكرة، ويجمع ما يُكتب ليُصدَّر ملفًّا واحدًا. لا يكتب
   على قرص ولا شبكة — ولذلك **لا يُخفي عجزه**: `pending()` تُظهر ما لم
   يُرسَل بعد، والواجهة تُلحّ عليه حتى يُرسله. */
export class PackStore {
  constructor(pack) {
    this.pack = pack;
    this.kind = "pack";
    this.written = new Map();
    this.files = new Map();          // شواهد: اسم ← File
  }
  static supported() { return true; }
  label() { return "حقيبة عمل — " + (this.pack?.شخص?.fullName || ""); }

  _synth(rel) {
    const p = this.pack;
    switch (rel) {
      case "manifest.json": return { stage: p.مدرسة?.stage || "", counts: {}, من: "حقيبة عمل" };
      case "بيانات/school.json": return p.مدرسة;
      case "بيانات/roster.json": return { people: [p.شخص] };
      case "بيانات/records.json": return { records: p.سجلات, total: p.سجلات.length };
      case "بيانات/tools.json": return { tools: p.أدوات || [], total: (p.أدوات || []).length };
      case "بيانات/results.json": return p.نتائج || {};
      case "بيانات/support.json": return p.مساند || {};
      case "بيانات/تحسين.json": return p.تحسين || { indicatorScores: [] };
      case "بيانات/تنفيذية.json": return { byRole: { [p.شخص.role]: p.تنفيذية || [] } };
      default: return undefined;
    }
  }
  async exists(rel) { return this.written.has(rel) || this._synth(rel) !== undefined; }
  async readText(rel) { return JSON.stringify(await this.readJson(rel)); }
  async readJson(rel) {
    if (this.written.has(rel)) return JSON.parse(this.written.get(rel));
    const v = this._synth(rel);
    if (v === undefined) throw new Error("غير متاح في حقيبة العمل: " + rel);
    return v;
  }
  async writeText(rel, text) { this.written.set(rel, text); }
  async writeJson(rel, data) { await this.writeText(rel, JSON.stringify(data, null, 1)); }
  async mutateJson(rel, mutate, fallback = {}) {
    let cur = fallback;
    try { if (await this.exists(rel)) cur = await this.readJson(rel); } catch { /* لا شيء */ }
    const next = await mutate(structuredClone(cur));
    next._rev = (cur._rev ?? 0) + 1;
    next._revAt = new Date().toISOString();
    await this.writeJson(rel, next);
    return next;
  }
  /* الشواهد لا تُرسَل داخل ملف الإدخالات (قد تبلغ ميجابايتات) — يُسجَّل
     وصفها ويُطالَب صاحبها بإرسالها مع الملف، فلا يظنّ أنها وصلت. */
  async writeBinary(rel, buf) {
    this.files.set(rel, buf?.byteLength ?? 0);
    this.written.set(rel, "[شاهد " + (buf?.byteLength ?? 0) + " بايت — يُرسَل منفصلًا]");
  }
  async readBinary() { throw new Error("الشواهد لا تُقرأ من حقيبة العمل."); }
  async fileUrl() { return null; }
  async list(rel = "") {
    const base = String(rel || "").replace(/^\/+|\/+$/g, "");
    const out = new Map();
    for (const k of this.written.keys()) {
      const parts = k.split("/");
      const dir = parts.slice(0, -1).join("/");
      if (dir === base) out.set(parts[parts.length - 1], { name: parts[parts.length - 1], kind: "file" });
      else if (base === "" ? parts.length > 1 : dir.startsWith(base + "/")) {
        const rest = base === "" ? parts[0] : dir.slice(base.length + 1).split("/")[0];
        if (rest) out.set(rest, { name: rest, kind: "directory" });
      }
    }
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }

  /** ما كُتب ولم يُرسَل بعد */
  /* ⚠️ بطاقة `_الاتصال.json` بيان جلسة لا إدخالَ عمل: إرسالها يجعل الاستيراد
     يصطدم بملف موجود ويبدو كأنه أخفق. تُستثنى. */
  pending() {
    return [...this.written.entries()]
      .filter(([k]) => (k.startsWith("مخرجات/") || k.startsWith("تقويم ذاتي/")) &&
                       !k.endsWith("/_الاتصال.json"))
      .map(([path, text]) => ({ path, data: safeParse(text) }));
  }
  evidenceCount() { return this.files.size; }
}
const safeParse = (t) => { try { return JSON.parse(t); } catch { return t; } };


/* ── الإرسال السحابي: يُسقط الوسيط اليدوي ──
   نقطة استقبال Cloudflare مجانية بحساب المستشار — بلا تقنية معلومات وبلا
   مايكروسوفت. الجوّال يُرسل، وحاسب المستودع يسحب ويكتب في المجلد.
   ⚠️ لا يُحذف من السحابة إلا ما كُتب فعلًا على القرص. */
const API_KEY_ = "ik-relay";
export const relay = () => {
  try { return JSON.parse(localStorage.getItem(API_KEY_) || "null"); } catch { return null; }
};
export const setRelay = (v) => v ? localStorage.setItem(API_KEY_, JSON.stringify(v))
                                 : localStorage.removeItem(API_KEY_);

const base = (url) => String(url || "").replace(/\/(submit|pull|ack|collect)\/?$/, "").replace(/\/+$/, "");

export async function submitToCloud(pack) {
  const r = relay();
  if (!r?.url) throw new Error("لم تُضبط نقطة الاستقبال بعد.");
  const res = await fetch(base(r.url) + "/submit", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(pack),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || ("تعذّر الإرسال (" + res.status + ")"));
  return out;
}

export async function pullFromCloud(school) {
  const r = relay();
  if (!r?.url || !r?.key) throw new Error("تلزم نقطة الاستقبال ومفتاح السحب.");
  const u = base(r.url) + "/pull?key=" + encodeURIComponent(r.key) +
            (school ? "&school=" + encodeURIComponent(school) : "");
  const res = await fetch(u);
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || ("تعذّر السحب (" + res.status + ")"));
  return out.items || [];
}

export async function ackCloud(keys) {
  const r = relay();
  if (!r?.url || !r?.key || !keys.length) return;
  await fetch(base(r.url) + "/ack", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: r.key, keys }),
  }).catch(() => {});
}

/** يسحب ثم يكتب ثم يحذف — بهذا الترتيب، فلا يضيع ما لم يُكتب */
export async function syncFromCloud(store, school) {
  const items = await pullFromCloud(school);
  const done = [], failed = [], acked = [];
  for (const it of items) {
    try {
      const res = await importEntries(store, it.pack);
      done.push(...res.done); failed.push(...res.failed);
      if (!res.done.length && res.failed.length) continue;   // لا يُحذف ما لم يُكتب
      acked.push(it.key);
    } catch (e) { failed.push({ path: it.key, why: e.message }); }
  }
  await ackCloud(acked);
  return { packs: items.length, done, failed };
}
