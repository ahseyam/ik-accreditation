import { derive, seedRows } from "./autofill.js";

/* محرّك عرض السجلات — يقرأ formFields من الحزمة ويبني نموذج إدخال عاملًا.
   قاعدة صارمة: كل نوع حقل له معالج مُسجَّل هنا. ما لا معالج له يظهر كتحذير
   مرئي ويُحصى في UNSUPPORTED كي لا نَدَّعي تغطية لا نملكها.                 */

export const UNSUPPORTED = [];

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowISO() { return new Date().toISOString().slice(0, 16); }

/** القيم التلقائية: ما يعلنه الـDSL، ثم ما يستطيع النظام اشتقاقه */
let FILL = null;
export function setFillContext(ctx) { FILL = ctx; }

function autoValue(field) {
  switch (field.autoFill) {
    case "NOW": case "NOW_ON_RETURN": return nowISO();
    case "TODAY": case "TODAY_HIJRI": return todayISO();
  }
  if (FILL) {
    const d = derive(field, FILL);
    if (d != null && d !== "") return d;
  }
  return field.default ?? "";
}

/* ⚠️ القوالب تحمل **متغيّرات غير مُستبدَلة** تظهر للمستخدم كما هي:
   «مَحضَر اجتِماع رقم {meetingNum} — فَصل {semester} أ.{week}». 14 نوعًا و585
   موضعًا. تُستبدَل من سياق المدرسة ومن بيانات العنصر نفسه، وما تعذّر يُحذف
   بلا أقواس — فلا يرى المستخدم رمزًا لاتينيًا أبدًا. */
const ROLE_CODE = /^[A-Z][A-Z_]{3,}$/;

export function interpolate(text, scope) {
  if (typeof text !== "string" || !text.includes("{")) return text;
  return text.replace(/\{\{?([a-zA-Z_][\w.]*)\}?\}/g, (_, key) => {
    const v = scope?.[key];
    return v == null || v === "" ? "" : String(v);
  }).replace(/\s{2,}/g, " ").replace(/[—·-]\s*$/, "").trim();
}

/** سياق الاستبدال: المدرسة والعام والأسبوع + بيانات العنصر + ترتيبه */
export function interpScope(index, item) {
  const f = FILL || {};
  const W = f.week;
  const n = (index ?? 0) + 1;
  const base = {
    year: f.school?.academicYear?.greg?.split("-")[0] || new Date().getFullYear(),
    sequence: String(n).padStart(3, "0"),
    schoolName: f.school?.nameAr,
    semester: W ? (W.semester === 1 ? "الأول" : "الثاني") : "",
    week: W?.weekNumber,
    meetingNum: n, meetingNumber: n, programNumber: n,
  };
  for (const [k, v] of Object.entries(item || {})) {
    if (typeof v === "string" && v.trim()) base[k] = v;
  }
  // أسماء شائعة تعتمد على حقل شقيق
  base.programName = base.programName || item?.programName || item?.name || "";
  base.clubName = base.clubName || item?.clubName || "";
  base.leaderName = base.leaderName || item?.leaderName || "";
  base.classLabel = base.classLabel || item?.classLabel || item?.className || "";
  base.categoryLabel = base.categoryLabel || item?.categoryLabel || "";
  base.fieldName = base.fieldName || item?.fieldName || "";
  base.name = base.name || item?.name || "";
  return base;
}

/* ⚠️ مصطلحات داخلية تتسرّب إلى النصّ الظاهر. تُعرَّب **ما له مقابل عربي فقط**،
   وتُترك الأسماء العلمية (PISA · STEM · POWER School) كما هي — تعريبها تشويه. */
export const TERM_AR = {
  ADMIN_BOARD: "اللجنة الإدارية", EXCELLENCE: "لجنة التميّز المدرسي",
  GUIDANCE: "لجنة التوجيه الطلابي", ACHIEVEMENT: "لجنة التحصيل الدراسي",
  SAFETY: "فريق الأمن والسلامة", FUND: "فريق الصندوق المدرسي",
  BOTH: "الفصلان معًا", FIRST: "الفصل الأول", SECOND: "الفصل الثاني",
  AUDIT_LOG: "سجل التدقيق", CONTINUOUS: "مستمر", NONE: "بلا تحديد",
  DAILY: "يومي", WEEKLY: "أسبوعي", MONTHLY: "شهري", YEARLY: "سنوي",
  PER_EVENT: "عند كل حدث", AS_NEEDED: "عند الحاجة", PER_SEMESTER: "كل فصل",
  semesterMode: "نطاق الفصل", weekType: "نوع الأسبوع",
  SCIENCE: "العلوم", MATH: "الرياضيات", ARABIC: "اللغة العربية", ENGLISH: "اللغة الإنجليزية",
};
/* أسماء علم لا تُعرَّب — تعريبها تشويه */
export const KEEP_LATIN = new Set(["PISA", "TIMSS", "STEM", "POWER", "ETEC", "SWOT",
  "PDF", "DOCX", "XLS", "XLSX", "HTML", "PPT", "AHSEYAM"]);

/** يعرّب رمز دور أو مصطلح داخلي إن ظهر كنصّ ظاهر */
export function arabizeCode(v) {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (TERM_AR[t]) return TERM_AR[t];
  if (ROLE_CODE.test(t)) {
    const ar = FILL?.roleArFn ? FILL.roleArFn(t) : null;
    if (ar && ar !== t) return ar;
  }
  return v;
}

/** يعرّب المصطلحات داخل نصّ طويل — الكلمات المعروفة وحدها */
export function arabizeText(t) {
  if (typeof t !== "string" || !/[A-Z]{3,}/.test(t)) return t;
  let out = t;
  for (const [k, ar] of Object.entries(TERM_AR)) {
    if (KEEP_LATIN.has(k)) continue;
    out = out.replace(new RegExp("(^|[^A-Za-z_])" + k + "([^A-Za-z_]|$)", "g"), "$1" + ar + "$2");
  }
  // تعريب رمز بعد نصّه العربي يُنتج تكرارًا: «في العلوم العلوم» ⇐ يُطوى
  out = out.replace(/(\S+)\s+\1(?=\s|$|[)،.])/g, "$1");
  const roles = FILL?.roleArFn;
  if (roles) out = out.replace(/\b[A-Z][A-Z_]{3,}\b/g, (m) => {
    if (KEEP_LATIN.has(m)) return m;
    const ar = roles(m); return ar && ar !== m ? ar : m;
  });
  return out;
}

function labelFor(field) {
  const wrap = el("div", "f-label");
  wrap.append(el("span", null, arabizeText(arabizeCode(interpolate(field.label || field.key || "", interpScope(0))))));
  if (field.required) wrap.append(el("span", "req", " *"));
  return wrap;
}

function help(field) {
  return field.helpText ? el("div", "f-help", interpolate(field.helpText, interpScope(0))) : null;
}

/** غلاف موحّد لكل حقل */
function box(field, control) {
  const b = el("div", "field");
  b.append(labelFor(field));
  if (control) b.append(control);
  const h = help(field);
  if (h) b.append(h);
  return b;
}

function bindValue(input, field, state, key) {
  const k = key ?? field.key ?? field.id;
  const initial = state[k] !== undefined ? state[k] : autoValue(field);
  if (input.type === "checkbox") input.checked = Boolean(initial);
  else input.value = initial ?? "";
  // يُسجَّل المشتقّ في الحالة فورًا كي يُحفظ ولو لم يلمسه المستخدم
  if (state[k] === undefined && initial !== "" && input.type !== "checkbox") {
    state[k] = initial;
    input.classList.add("auto");
    input.title = "عُبِّئ تلقائيًا — يمكنك تعديله";
  }
  if (field.readOnly) input.readOnly = true;
  input.addEventListener("input", () => {
    state[k] = input.type === "checkbox" ? input.checked : input.value;
  });
  input.addEventListener("change", () => {
    state[k] = input.type === "checkbox" ? input.checked : input.value;
  });
  return input;
}

function textInput(type, field, state, key) {
  const i = el("input", "f-in");
  i.type = type;
  if (field.placeholder) i.placeholder = field.placeholder;
  if (field.min != null) i.min = field.min;
  if (field.max != null) i.max = field.max;
  return bindValue(i, field, state, key);
}

/* ⚠️ الخيارات تأتي بشكلين في المصدر: نصوص، و**كائنات بمفتاحَي `v` و`l`**
   (261 من 367 قائمة أي 71%). كنت أقرأ `value`/`label` فقط فخرجت القوائم
   **فارغة** في أغلب السجلات. يُقرأ الشكلان معًا الآن، ويحرسه
   scripts/check-select-options.mjs. */
export function optionOf(o) {
  if (o == null) return null;
  if (typeof o === "string" || typeof o === "number") return { v: String(o), l: String(o) };
  const v = o.v ?? o.value ?? o.key ?? o.code ?? o.l ?? o.label;
  const l = o.l ?? o.label ?? o.text ?? o.nameAr ?? o.name ?? v;
  return v == null && l == null ? null : { v: String(v ?? l), l: String(l ?? v) };
}

function selectInput(field, state, key, options) {
  const s = el("select", "f-in");
  s.append(new Option("— اختر —", ""));
  for (const raw of options ?? field.options ?? []) {
    const o = optionOf(raw);
    if (o) s.append(new Option(arabizeText(arabizeCode(interpolate(o.l, interpScope(0)))), o.v));
  }
  return bindValue(s, field, state, key);
}

/** توقيع بالرسم — يعمل بلا خادم، يُخزَّن data URL */
function signaturePad(field, state, key) {
  const k = key ?? field.key ?? field.id;
  const wrap = el("div", "sig");
  const canvas = el("canvas", "sig-pad");
  canvas.width = 420; canvas.height = 120;
  const ctx2d = canvas.getContext("2d");
  ctx2d.lineWidth = 2; ctx2d.lineCap = "round"; ctx2d.strokeStyle = "#16232e";
  if (state[k]) { const img = new Image(); img.onload = () => ctx2d.drawImage(img, 0, 0); img.src = state[k]; }
  let drawing = false;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return [p.clientX - r.left, p.clientY - r.top];
  };
  const down = (e) => { drawing = true; ctx2d.beginPath(); ctx2d.moveTo(...pos(e)); e.preventDefault(); };
  const move = (e) => { if (!drawing) return; ctx2d.lineTo(...pos(e)); ctx2d.stroke(); e.preventDefault(); };
  const up = () => { if (!drawing) return; drawing = false; state[k] = canvas.toDataURL("image/png"); };
  canvas.addEventListener("mousedown", down); canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
  canvas.addEventListener("touchstart", down); canvas.addEventListener("touchmove", move);
  canvas.addEventListener("touchend", up);
  const bar = el("div", "sig-bar");
  const clear = el("button", "b-ghost b-sm", "مسح");
  clear.type = "button";
  clear.onclick = () => { ctx2d.clearRect(0, 0, canvas.width, canvas.height); state[k] = ""; };
  bar.append(clear);

  /* ⚠️ التوقيع يُرسم مرّة واحدة ويُستدعى — لا يُعاد رسمه في كل موضع.
     المحفوظ يخصّ الوظيفة، فيتغيّر بتغيّر شاغلها. */
  const mine = FILL?.mySignature?.dataUrl;
  if (mine) {
    const use = el("button", "b-main b-sm", "✍️ استخدم توقيعي المحفوظ");
    use.type = "button";
    use.onclick = () => {
      const img = new Image();
      img.onload = () => {
        ctx2d.clearRect(0, 0, canvas.width, canvas.height);
        const r = Math.min(canvas.width / img.width, canvas.height / img.height, 1);
        ctx2d.drawImage(img, 0, 0, img.width * r, img.height * r);
        state[k] = canvas.toDataURL("image/png");
      };
      img.src = mine;
    };
    bar.append(use);
  } else {
    bar.append(el("span", "f-help", "لم تحفظ توقيعك بعد — احفظه مرّة من «تفضيلاتي» ليظهر هنا بنقرة."));
  }
  wrap.append(canvas, bar);
  return wrap;
}

/** رفع الشواهد — تُكتب في مجلد الشخص داخل المجلد المزامَن */
function filesInput(field, state, ctx, key, multiple) {
  const k = key ?? field.key ?? field.id;
  const wrap = el("div", "files");
  const list = el("div", "files-list");
  const render = () => {
    list.innerHTML = "";
    for (const f of state[k] ?? []) {
      const row = el("div", "file-row");
      row.append(el("span", null, "📎 " + f.name));
      const rm = el("button", "btn-ghost sm", "حذف");
      rm.type = "button";
      rm.onclick = () => { state[k] = (state[k] ?? []).filter((x) => x !== f); render(); };
      row.append(rm);
      list.append(row);
    }
  };
  const input = el("input", "f-in");
  input.type = "file";
  input.multiple = Boolean(multiple);
  if (field.accept) input.accept = field.accept;
  input.onchange = async () => {
    const dir = ctx.evidenceDir + "/" + (field.key || "شواهد");
    for (const file of Array.from(input.files ?? [])) {
      const path = dir + "/" + file.name;
      try {
        await ctx.store.writeBinary(path, await file.arrayBuffer());
        state[k] = (state[k] ?? []).concat([{ name: file.name, path, size: file.size, type: file.type }]);
      } catch (e) {
        state[k] = (state[k] ?? []).concat([{ name: file.name, path: null, error: e.message }]);
      }
    }
    input.value = "";
    render();
  };
  wrap.append(input, list);
  render();
  return wrap;
}

/** جدول متكرر — عمود واحد لكل تعريف، وصفوف تُضاف وتُحذف */
function recurringTable(field, state, ctx) {
  const k = field.key ?? field.id;
  const cols = field.columns ?? [];
  if (!state[k]) {
    const seeded = FILL ? seedRows(field, FILL) : null;
    if (seeded && seeded.length) state[k] = seeded;
    else {
      const n = field.initialRows ?? field.defaultRows ?? 3;
      state[k] = Array.from({ length: n }, () => ({}));
    }
  }
  const wrap = el("div", "table-wrap");
  const table = el("table", "rec-table");
  const thead = el("thead");
  const htr = el("tr");
  htr.append(el("th", "num", "#"));
  for (const c of cols) htr.append(el("th", null, interpolate(c.label ?? c.key ?? "", interpScope(0))));
  htr.append(el("th", "num", ""));
  thead.append(htr);
  const tbody = el("tbody");
  table.append(thead, tbody);

  const drawRows = () => {
    tbody.innerHTML = "";
    state[k].forEach((row, i) => {
      const tr = el("tr");
      tr.append(el("td", "num", String(i + 1)));
      for (const c of cols) {
        const td = el("td");
        td.append(columnControl(c, row, ctx, field));
        tr.append(td);
      }
      const td = el("td", "num");
      const rm = el("button", "btn-ghost sm", "✕");
      rm.type = "button";
      rm.title = "حذف الصف";
      rm.onclick = () => { state[k].splice(i, 1); drawRows(); };
      td.append(rm);
      tr.append(td);
      tbody.append(tr);
    });
  };
  drawRows();
  wrap.append(table);
  if (field.allowAddRows !== false) {
    const add = el("button", "btn-ghost sm", "+ صف جديد");
    add.type = "button";
    add.onclick = () => { state[k].push({}); drawRows(); };
    wrap.append(add);
  }
  return wrap;
}

/** عناصر التحكم داخل خلايا الجدول — نفس الأنواع لكن بلا عنوان */
function columnControl(col, row, ctx, parent) {
  const f = { ...col, key: col.key };
  switch (col.type) {
    case "TEXTAREA": {
      const t = el("textarea", "f-in sm");
      t.rows = 2;
      return bindValue(t, f, row, col.key);
    }
    case "SELECT": return selectInput(f, row, col.key);
    case "MULTI_SELECT": return selectInput(f, row, col.key);
    case "DATE": return textInput("date", f, row, col.key);
    case "TIME": return textInput("time", f, row, col.key);
    case "NUMBER": return textInput("number", f, row, col.key);
    case "PHONE": return textInput("tel", f, row, col.key);
    case "EMAIL": return textInput("email", f, row, col.key);
    case "BOOLEAN": return textInput("checkbox", f, row, col.key);
    case "TEACHER_PICKER":
      return selectInput(f, row, col.key, (ctx.support?.teachers ?? []).map((t) => t.fullName));
    case "LOOKUP":
      return selectInput(f, row, col.key, lookupOptions(col, ctx));
    case "USER_SIGNATURE": case "REMOTE_SIGNATURE": case "SIGNATURE":
      return signaturePad(f, row, col.key);
    case "FILE": return filesInput(f, row, ctx, col.key, false);
    case "FILES": return filesInput(f, row, ctx, col.key, true);
    default: return textInput("text", f, row, col.key);
  }
}

/** خيارات الـLOOKUP: من البيانات المساندة أولًا، ثم من الإدخالات المحفوظة */
function lookupOptions(field, ctx) {
  const src = field.lookupSource ?? {};
  const from = String(src.field ?? "");
  if (/teacher|fullName|معلم/i.test(from)) return (ctx.support?.teachers ?? []).map((t) => t.fullName);
  if (/staff|منسوب/i.test(from)) return (ctx.support?.staff ?? []).map((s) => s.fullName);
  if (/action|program|برنامج/i.test(from)) return (ctx.support?.actions ?? []).map((a) => a.name);
  const pool = ctx.savedEntries?.[src.recordNumber] ?? [];
  return pool.map((e) => e.data?.[from]).filter(Boolean);
}

/** جدول مربوط تلقائيًا — عرض فقط، من البرامج أو الإدخالات المحفوظة */
function autoLinkedTable(field, ctx) {
  const cfg = field.autoLoad ?? {};
  const cols = field.columns ?? [];
  let rows = [];
  if (String(cfg.source ?? "").startsWith("PlanAction")) {
    rows = (ctx.support?.actions ?? [])
      .filter((a) => !cfg.templateNumber || a.recordTemplateNumber === cfg.templateNumber)
      .slice(0, 200);
  } else if (String(cfg.source ?? "").startsWith("RecordEntry@")) {
    const n = Number(String(cfg.source).split("@")[1]);
    rows = (ctx.savedEntries?.[n] ?? []).flatMap((e) => e.data?.[cfg.field] ?? []);
  }
  const wrap = el("div", "table-wrap");
  if (rows.length === 0) {
    wrap.append(el("div", "warn sm", "لا بيانات مرتبطة بعد — تظهر تلقائيًا حين تُعبَّأ في مصدرها."));
    return wrap;
  }
  const table = el("table", "rec-table ro");
  const htr = el("tr");
  for (const c of cols) htr.append(el("th", null, c.label ?? c.key));
  const thead = el("thead"); thead.append(htr);
  const tbody = el("tbody");
  for (const r of rows) {
    const tr = el("tr");
    for (const c of cols) tr.append(el("td", null, String(r[c.key] ?? "—")));
    tbody.append(tr);
  }
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

/** قسم مكرر — مجموعة حقول تتكرر كعناصر */
function repeatingSection(field, state, ctx) {
  const k = field.key ?? field.id;
  if (!state[k]) {
    const n = field.initialItems ?? field.defaultItems ?? 1;
    state[k] = Array.from({ length: n }, () => ({}));
  }
  const wrap = el("div", "repeat");
  const draw = () => {
    wrap.innerHTML = "";
    state[k].forEach((item, i) => {
      const card = el("div", "repeat-item");
      const head = el("div", "repeat-head");
      const lbl = interpolate(field.itemLabel ?? "", interpScope(i, item));
      head.append(el("b", null, lbl || "عنصر " + (i + 1)));
      const rm = el("button", "btn-ghost sm", "حذف");
      rm.type = "button";
      rm.onclick = () => { state[k].splice(i, 1); draw(); };
      head.append(rm);
      card.append(head);
      for (const sub of field.fields ?? []) card.append(renderField(sub, item, ctx));
      wrap.append(card);
    });
    const add = el("button", "btn-ghost sm", "+ إضافة عنصر");
    add.type = "button";
    add.onclick = () => { state[k].push({}); draw(); };
    wrap.append(add);
  };
  draw();
  return wrap;
}

/** قائمة المناوبات — أيام الأسبوع بأسماء */
function dutyRoster(field, state, ctx) {
  const k = field.key ?? field.id;
  if (!state[k]) state[k] = AR_DAYS.map((d) => ({ day: d, name: "" }));
  const wrap = el("div", "table-wrap");
  const table = el("table", "rec-table");
  const tbody = el("tbody");
  state[k].forEach((row) => {
    const tr = el("tr");
    tr.append(el("td", "num", row.day));
    const td = el("td");
    td.append(selectInput({ key: "name" }, row, "name", (ctx.support?.staff ?? []).map((s) => s.fullName)));
    tr.append(td);
    tbody.append(tr);
  });
  table.append(tbody);
  wrap.append(table);
  return wrap;
}

/* ⚠️ محتوى صناديق الإرشاد يأتي بثلاثة أشكال: **نصّ بماركداون خفيف** (42) ·
   **مصفوفة بنود** (84) · و**غائب تمامًا** (170). كان يُمرَّر كنصّ واحد، فالمصفوفة
   تُطبع بفواصل، والغائب يُظهر صندوقًا فارغًا رآه المستشار. */
function richText(t) {
  const frag = document.createDocumentFragment();
  String(t).split(/\n+/).forEach((line, i) => {
    if (i) frag.append(document.createElement("br"));
    // **غامق**
    line.split(/\*\*(.+?)\*\*/g).forEach((part, j) => {
      if (!part) return;
      frag.append(j % 2 ? Object.assign(document.createElement("b"), { textContent: part })
                        : document.createTextNode(part));
    });
  });
  return frag;
}

function infoBox(field) {
  const c = field.content;
  const has = Array.isArray(c) ? c.length > 0 : typeof c === "string" ? c.trim() !== "" : false;
  if (!has) return el("div", "hidden");          // لا صندوق فارغ
  const box = el("div", "note sm guide");
  if (field.label) box.append(el("b", "guide-t", arabizeText(interpolate(field.label, interpScope(0)))));
  if (Array.isArray(c)) {
    const ul = el("ul", "guide-list");
    for (const line of c) ul.append(el("li", null, arabizeText(interpolate(String(line), interpScope(0)))));
    box.append(ul);
  } else {
    const d = el("div");
    d.append(richText(arabizeText(interpolate(c, interpScope(0)))));
    box.append(d);
  }
  return box;
}

/* ── سجلّ المعالجات: مفتاح النوع ⇐ دالة ── */
export const HANDLERS = {
  SECTION_HEADER: (f) => el("h3", "sec", interpolate(f.label ?? "", interpScope(0))),
  INFO_BOX: (f) => infoBox(f),
  INFO_BLOCK: (f) => infoBox(f),
  COLOR_LEGEND: (f) => {
    const w = el("div", "legend");
    for (const it of f.items ?? f.options ?? []) {
      const chip = el("span", "chip", typeof it === "string" ? it : (it.label ?? ""));
      if (it && it.color) chip.style.background = it.color;
      w.append(chip);
    }
    return w;
  },
  JOB_DESCRIPTION_DISPLAY: (f) => el("div", "note sm", f.content ?? "الوصف الوظيفي — يُعرض من الدليل التنظيمي."),

  TEXT: (f, s) => box(f, textInput("text", f, s)),
  EMAIL: (f, s) => box(f, textInput("email", f, s)),
  PHONE: (f, s) => box(f, textInput("tel", f, s)),
  NUMBER: (f, s) => box(f, textInput("number", f, s)),
  SUM_THRESHOLD: (f, s) => box(f, textInput("number", f, s)),
  DATE: (f, s) => box(f, textInput("date", f, s)),
  DATE_DEADLINE: (f, s) => box(f, textInput("date", f, s)),
  TIME: (f, s) => box(f, textInput("time", f, s)),
  DATETIME: (f, s) => box(f, textInput("datetime-local", f, s)),
  CHECKBOX: (f, s) => box(f, textInput("checkbox", f, s)),
  BOOLEAN: (f, s) => box(f, textInput("checkbox", f, s)),
  STUDENT_NAME: (f, s) => box(f, textInput("text", f, s)),
  TEXTAREA: (f, s) => {
    const t = el("textarea", "f-in");
    t.rows = f.rows ?? 3;
    return box(f, bindValue(t, f, s));
  },
  SELECT: (f, s) => box(f, selectInput(f, s)),
  RADIO: (f, s) => box(f, selectInput(f, s)),
  MULTI_SELECT: (f, s) => {
    const w = el("div", "multi");
    const k = f.key ?? f.id;
    if (!s[k]) s[k] = [];
    for (const raw of f.options ?? []) {
      const o = optionOf(raw);
      if (!o) continue;
      const lab = el("label", "chk");
      const cb = el("input"); cb.type = "checkbox"; cb.checked = s[k].includes(o.v);
      cb.onchange = () => { s[k] = cb.checked ? s[k].concat([o.v]) : s[k].filter((x) => x !== o.v); };
      lab.append(cb, el("span", null, o.l));
      w.append(lab);
    }
    return box(f, w);
  },
  TEACHER_PICKER: (f, s, ctx) =>
    box(f, selectInput(f, s, null, (ctx.support?.teachers ?? []).map((t) => t.fullName))),
  LOOKUP: (f, s, ctx) => box(f, selectInput(f, s, null, lookupOptions(f, ctx))),
  SIGNATURE: (f, s) => box(f, signaturePad(f, s)),
  USER_SIGNATURE: (f, s) => box(f, signaturePad(f, s)),
  REMOTE_SIGNATURE: (f, s) => {
    const b = box(f, signaturePad(f, s));
    b.append(el("div", "warn sm", "التوقيع عن بُعد برابط غير متاح بلا خادم — يُوقَّع هنا مباشرة بحضور صاحبه."));
    return b;
  },
  FILE: (f, s, ctx) => box(f, filesInput(f, s, ctx, null, false)),
  FILES: (f, s, ctx) => box(f, filesInput(f, s, ctx, null, true)),
  RECURRING_LOG: (f, s, ctx) => box(f, recurringTable(f, s, ctx)),
  REPEATING_SECTION: (f, s, ctx) => box(f, repeatingSection(f, s, ctx)),
  AUTO_LINKED_TABLE: (f, s, ctx) => box(f, autoLinkedTable(f, ctx)),
  DUTY_ROSTER_LIST: (f, s, ctx) => box(f, dutyRoster(f, s, ctx)),
};

export function renderField(field, state, ctx) {
  if (!field || typeof field !== "object") return el("div");
  if (field.showWhen && !evalShowWhen(field.showWhen, state)) return el("div", "hidden");
  const h = HANDLERS[field.type];
  if (!h) {
    UNSUPPORTED.push({ type: field.type ?? "(بلا نوع)", key: field.key ?? field.id ?? "?" });
    const w = el("div", "err sm", "نوع حقل غير مدعوم: " + (field.type ?? "بلا نوع"));
    return w;
  }
  return h(field, state, ctx);
}

function evalShowWhen(rule, state) {
  if (typeof rule !== "object") return true;
  const [k, v] = Object.entries(rule)[0] ?? [];
  if (!k) return true;
  return Array.isArray(v) ? v.includes(state[k]) : state[k] === v;
}

/** يبني النموذج كاملًا لقالب سجل */
export function renderRecordForm(container, template, state, ctx) {
  container.innerHTML = "";
  const ff = template.formFields ?? {};
  if (ff.primaryData) {
    const head = el("div", "primary");
    for (const [k, def] of Object.entries(ff.primaryData)) {
      const v = resolvePrimary(def, ctx);
      const cell = el("div", "primary-cell");
      cell.append(el("span", "k", def.label ?? k), el("b", null, v ?? "—"));
      head.append(cell);
      state["__" + k] = v;
    }
    container.append(head);
  }
  for (const f of ff.fields ?? []) container.append(renderField(f, state, ctx));
  return container;
}

function resolvePrimary(def, ctx) {
  switch (def.from) {
    case "school.nameAr": return ctx.school?.nameAr;
    case "plan.academicYear.label": return ctx.school?.academicYear?.greg;
    case "context.currentSemester": return ctx.semester ?? "الفصل الأول";
    case "currentUser.fullName": return ctx.person?.fullName;
    case "currentUser.role": return ctx.roleAr;
    default: return def.value ?? (def.from?.includes("Date") ? todayISO() : "");
  }
}


const FREQ_HINT = {
  DAILY: "يُعبَّأ كل يوم دراسي", WEEKLY: "يُعبَّأ مرّة كل أسبوع",
  MONTHLY: "يُعبَّأ مرّة كل شهر", PER_SEMESTER: "يُعبَّأ مرّة كل فصل",
  YEARLY: "يُعبَّأ مرّة في العام", ANNUAL: "يُعبَّأ مرّة في العام",
  PER_EVENT: "يُعبَّأ عند كل حدث أو نشاط", AS_NEEDED: "يُعبَّأ عند الحاجة",
  CONTINUOUS: "يُحدَّث باستمرار",
};

/** لوحة «كيف يعمل هذا السجل» — كلها من بيانات القالب، بلا تأليف */
export function buildGuide(t, ctx) {
  const box = el("details", "guide-panel");
  box.open = true;
  const sum = el("summary", null, "كيف يعمل هذا السجل");
  box.append(sum);
  const body = el("div", "guide-body");

  if (t.descriptionAr) body.append(el("p", "guide-desc", arabizeText(t.descriptionAr)));

  const facts = [];
  if (t.fillFrequency) facts.push(["الدورية", FREQ_HINT[t.fillFrequency] || t.fillFrequency]);
  if (t.expectedEntriesPerSemester)
    facts.push(["المتوقَّع", t.expectedEntriesPerSemester + " إدخالًا في الفصل"]);
  if ((t.primaryRoles || []).length)
    facts.push(["المسؤول", t.primaryRoles.map(ctx.roleArFn).join("، ")]);
  if ((t.dataEntryRoles || []).length)
    facts.push(["يشارك في الإدخال", t.dataEntryRoles.map(ctx.roleArFn).join("، ")]);
  if ((t.etecIndicators || []).length)
    facts.push(["مؤشرات ETEC", t.etecIndicators.join("، ")]);
  if ((t.docAnalysisItems || []).length)
    facts.push(["فقرات تحليل الوثائق", t.docAnalysisItems.join("، ")]);
  const files = countFileFields(t);
  if (files) facts.push(["الشواهد", files + " حقل رفع — أرفق صورًا أو ملفات لكل عملية"]);

  const dl = el("div", "guide-facts");
  for (const [k, v] of facts) {
    const row = el("div", "gf");
    row.append(el("span", "gk", k), el("span", "gv", v));
    dl.append(row);
  }
  body.append(dl);
  box.append(body);
  return box;
}

function countFileFields(t) {
  let n = 0;
  const walk = (fields) => {
    for (const f of fields || []) {
      if (f.type === "FILE" || f.type === "FILES") n++;
      for (const c of f.columns || []) if (c.type === "FILE" || c.type === "FILES") n++;
      if (f.fields) walk(f.fields);
    }
  };
  walk(t.formFields?.fields);
  return n;
}
