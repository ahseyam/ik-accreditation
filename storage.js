/* محوّل التخزين — مصدران خلف واجهة واحدة.
   FolderStore: المجلد المزامَن على OneDrive (الإنتاج) — File System Access API.
   HttpStore  : جلب عبر HTTP (التطوير والاختبار الآلي) — للقراءة فقط.            */

const IDB = { name: "ik-accreditation", store: "handles", version: 1 };

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB.name, IDB.version);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB.store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const r = db.transaction(IDB.store, "readonly").objectStore(IDB.store).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbSet(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const t = db.transaction(IDB.store, "readwrite");
    t.objectStore(IDB.store).put(value, key);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

/** يفصل مسارًا نسبيًا إلى أجزاء، متجاهلًا الفراغات والشرطات الزائدة */
function segments(relPath) {
  return String(relPath).split("/").map((s) => s.trim()).filter(Boolean);
}

/** أسماء المجلدات والملفات: نمنع المحارف التي يرفضها ويندوز */
export function safeName(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

export class FolderStore {
  constructor(rootHandle) { this.root = rootHandle; this.kind = "folder"; }

  /** اسم المجلد المتصل — ليعرف المستخدم أين يكتب */
  label() { return this.root?.name || "—"; }

  static supported() {
    return typeof window !== "undefined" && "showDirectoryPicker" in window;
  }

  /** يفتح منتقي المجلدات (يلزم إيماءة مستخدم) ويحفظ المقبض للجلسات القادمة */
  static async pick() {
    const handle = await window.showDirectoryPicker({ id: "ik-accred", mode: "readwrite" });
    await idbSet("root", handle);
    return new FolderStore(handle);
  }

  /** يستعيد المقبض المحفوظ. يعيد null إن لم يوجد أو لم يُمنح الإذن بعد. */
  static async restore() {
    const handle = await idbGet("root").catch(() => null);
    if (!handle) return null;
    const opts = { mode: "readwrite" };
    let state = await handle.queryPermission(opts);
    if (state === "prompt") state = await handle.requestPermission(opts);
    return state === "granted" ? new FolderStore(handle) : null;
  }

  static async forget() { await idbSet("root", undefined); }

  /* ⚠️ لوحة الإدارة تفتح **جذر الأربعين** لا مجلد مدرسة، فلو حُفظ بالمفتاح
     نفسه لدَهَس أحدُهما الآخر: يفتح المستشار اللوحة فيفقد المستخدمُ مجلد
     مدرسته. مفتاحٌ مستقلّ لكلٍّ. */
  static async pickRoot(key = "adminRoot", id = "ik-admin") {
    const handle = await window.showDirectoryPicker({ id, mode: "readwrite" });
    await idbSet(key, handle);
    return handle;
  }
  static async restoreRoot(key = "adminRoot") {
    const handle = await idbGet(key).catch(() => null);
    if (!handle) return null;
    const opts = { mode: "readwrite" };
    let state = await handle.queryPermission(opts);
    if (state === "prompt") state = await handle.requestPermission(opts);
    return state === "granted" ? handle : null;
  }
  static async forgetRoot(key = "adminRoot") { await idbSet(key, undefined); }

  async _dir(parts, create = false) {
    let dir = this.root;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create });
    return dir;
  }

  async _file(relPath, create = false) {
    const parts = segments(relPath);
    const name = parts.pop();
    const dir = await this._dir(parts, create);
    return dir.getFileHandle(name, { create });
  }

  async exists(relPath) {
    try { await this._file(relPath); return true; } catch { return false; }
  }

  async readText(relPath) {
    const handle = await this._file(relPath);
    return (await handle.getFile()).text();
  }

  async readJson(relPath) { return JSON.parse(await this.readText(relPath)); }

  async writeText(relPath, text) {
    const handle = await this._file(relPath, true);
    const w = await handle.createWritable();
    await w.write(text);
    await w.close();
  }

  async writeJson(relPath, data) {
    await this.writeText(relPath, JSON.stringify(data, null, 1));
  }

  /* ⚠️ **الملفات المشتركة يكتبها عدة مستخدمين** (الإعدادات · الروستر · فهرس
     المستودع). والكتابة من نسخة محمَّلة في الذاكرة منذ بداية الجلسة **تمحو عمل
     من كتب بعدك** بلا إنذار. تُعاد القراءة **لحظة الكتابة** ويُطبَّق التغيير على
     الأحدث، فيضيق التعارض إلى أجزاء الثانية بدل ساعات. */
  async mutateJson(relPath, mutate, fallback = {}) {
    let current = fallback;
    try { if (await this.exists(relPath)) current = await this.readJson(relPath); } catch { /* تالف */ }
    const next = await mutate(structuredClone(current));
    next._rev = (current._rev ?? 0) + 1;
    next._revAt = new Date().toISOString();
    await this.writeJson(relPath, next);
    return next;
  }

  /** كتابة ملف ثنائي (شاهد: صورة أو PDF) */
  async writeBinary(relPath, arrayBuffer) {
    const handle = await this._file(relPath, true);
    const w = await handle.createWritable();
    await w.write(arrayBuffer);
    await w.close();
  }

  /** قراءة ملف ثنائي — تلزم النسخة الاحتياطية الكاملة */
  async readBinary(relPath) {
    const handle = await this._file(relPath);
    return (await handle.getFile()).arrayBuffer();
  }

  /** رابط عرض مؤقت لملف ثنائي (PDF مثلًا) — يُحرَّر بـ revokeObjectURL */
  async fileUrl(relPath) {
    const handle = await this._file(relPath);
    return URL.createObjectURL(await handle.getFile());
  }

  async list(relPath = "") {
    const dir = await this._dir(segments(relPath));
    const out = [];
    for await (const [name, h] of dir.entries()) out.push({ name, kind: h.kind });
    return out.sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }
}

/** مصدر قراءة عبر HTTP — للتطوير والاختبار الآلي فقط. الكتابة تبقى في الذاكرة. */
export class HttpStore {
  constructor(baseUrl) {
    this.base = String(baseUrl).replace(/\/+$/, "");
    this.kind = "http";
    this.written = new Map();
  }
  label() { return this.base.split("/").filter(Boolean).pop() || this.base; }
  _url(relPath) { return this.base + "/" + segments(relPath).map(encodeURIComponent).join("/"); }
  async exists(relPath) {
    if (this.written.has(relPath)) return true;
    const r = await fetch(this._url(relPath), { method: "HEAD" });
    return r.ok;
  }
  async readText(relPath) {
    if (this.written.has(relPath)) return this.written.get(relPath);
    const r = await fetch(this._url(relPath));
    if (!r.ok) throw new Error("تعذّر جلب " + relPath + " (" + r.status + ")");
    return r.text();
  }
  async readJson(relPath) { return JSON.parse(await this.readText(relPath)); }
  async writeText(relPath, text) { this.written.set(relPath, text); }
  async writeJson(relPath, data) { await this.writeText(relPath, JSON.stringify(data, null, 1)); }
  async mutateJson(relPath, mutate, fallback = {}) {
    let current = fallback;
    try { if (await this.exists(relPath)) current = await this.readJson(relPath); } catch { /* تالف */ }
    const next = await mutate(structuredClone(current));
    next._rev = (current._rev ?? 0) + 1;
    next._revAt = new Date().toISOString();
    await this.writeJson(relPath, next);
    return next;
  }
  async writeBinary(relPath, buf) { this.written.set(relPath, "[ثنائي " + buf.byteLength + " بايت]"); }
  async readBinary(relPath) {
    const r = await fetch(this._url(relPath));
    if (!r.ok) throw new Error("تعذّر جلب " + relPath);
    return r.arrayBuffer();
  }
  async fileUrl(relPath) { return this._url(relPath); }
  /** يدمج فهرس الخادم مع ما كُتب في الذاكرة كي يتصرّف كالمجلد الحقيقي */
  async list(relPath = "") {
    const base = segments(relPath).join("/");
    const out = new Map();
    try {
      const r = await fetch(this._url(relPath ? relPath + "/_فهرس.json" : "_فهرس.json"));
      if (r.ok) for (const e of await r.json()) out.set(e.name, e);
    } catch { /* لا فهرس */ }
    for (const key of this.written.keys()) {
      const parts = segments(key);
      const dir = parts.slice(0, -1).join("/");
      if (dir === base) out.set(parts[parts.length - 1], { name: parts[parts.length - 1], kind: "file" });
      else if (base === "" ? parts.length > 1 : dir.startsWith(base + "/")) {
        const rest = base === "" ? parts[0] : dir.slice(base.length + 1).split("/")[0];
        if (rest) out.set(rest, { name: rest, kind: "directory" });
      }
    }
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }
}


/* ── محوّل القراءة فقط ──
   ⚠️ سفاري وأجهزة iPad لا تدعم File System Access API، فكان المستخدم يصطدم
   برسالة اعتذار وطريق مسدود. لكنها تدعم `<input webkitdirectory>` الذي يقرأ
   مجلدًا كاملًا **بلا كتابة**. فبدل المنع: يُعرَض كل شيء ويُمنَع الحفظ صراحةً. */
export class ReadOnlyStore {
  constructor(files) {
    this.kind = "readonly";
    this.readOnly = true;
    this.map = new Map();
    for (const f of files) {
      // webkitRelativePath يبدأ باسم المجلد المختار — يُنزع
      const rel = String(f.webkitRelativePath || f.name).split("/").slice(1).join("/");
      if (rel) this.map.set(rel, f);
    }
    const first = files[0];
    this.rootName = String(first?.webkitRelativePath || "").split("/")[0] || "—";
  }
  label() { return this.rootName; }

  static supported() {
    const i = document.createElement("input");
    return "webkitdirectory" in i;
  }

  /** يفتح منتقي المجلدات عبر input ويعيد محوّلًا للقراءة */
  static pick() {
    return new Promise((resolve, reject) => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.webkitdirectory = true;
      inp.multiple = true;
      inp.style.display = "none";
      inp.onchange = () => {
        const files = Array.from(inp.files || []);
        inp.remove();
        files.length ? resolve(new ReadOnlyStore(files)) : reject(new Error("لم يُختر مجلد"));
      };
      document.body.append(inp);
      inp.click();
    });
  }

  async exists(rel) { return this.map.has(segments(rel).join("/")); }
  async readText(rel) {
    const f = this.map.get(segments(rel).join("/"));
    if (!f) throw new Error("غير موجود: " + rel);
    return f.text();
  }
  async readJson(rel) { return JSON.parse(await this.readText(rel)); }
  async readBinary(rel) {
    const f = this.map.get(segments(rel).join("/"));
    if (!f) throw new Error("غير موجود: " + rel);
    return f.arrayBuffer();
  }
  async fileUrl(rel) {
    const f = this.map.get(segments(rel).join("/"));
    if (!f) throw new Error("غير موجود: " + rel);
    return URL.createObjectURL(f);
  }
  async list(rel = "") {
    const base = segments(rel).join("/");
    const out = new Map();
    for (const key of this.map.keys()) {
      if (base && !key.startsWith(base + "/")) continue;
      const rest = base ? key.slice(base.length + 1) : key;
      const head = rest.split("/")[0];
      if (!head) continue;
      out.set(head, { name: head, kind: rest.includes("/") ? "directory" : "file" });
    }
    return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }
  /** الكتابة ممنوعة صراحةً — لا صمت ولا تظاهر بالنجاح */
  async writeText() { throw new Error("وضع القراءة: الحفظ غير متاح على هذا الجهاز."); }
  async writeJson() { throw new Error("وضع القراءة: الحفظ غير متاح على هذا الجهاز."); }
  async writeBinary() { throw new Error("وضع القراءة: الحفظ غير متاح على هذا الجهاز."); }
  async mutateJson() { throw new Error("وضع القراءة: الحفظ غير متاح على هذا الجهاز."); }
}
