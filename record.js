import { agendaForMeeting, meetingTitle, meetingScope, committeeMeetings, fmtDate } from "./meetings.js?v=2ef416d9";
import { derive, seedRows, committeePositionAr } from "./autofill.js?v=2ef416d9";
import { shrinkImage, kb } from "./shrink.js?v=2ef416d9";

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

function autoValue(field, opts = {}) {
  switch (field.autoFill) {
    case "NOW": case "NOW_ON_RETURN": return nowISO();
    case "TODAY": case "TODAY_HIJRI": return todayISO();
  }
  if (FILL) {
    const d = derive(field, FILL, opts);
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
  /* ⚠️ كان الشرط `typeof v === "string"` فتُتجاهل القيم الرقمية: رقم الاجتماع
     والأسبوع مبذوران أرقامًا، فيغلبهما الأسبوع الجاري ويتكرّر في كل محضر. */
  for (const [k, v] of Object.entries(item || {})) {
    if (typeof v === "number" && Number.isFinite(v)) base[k] = v;
    else if (typeof v === "string" && v.trim()) base[k] = v;
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

/* ── توحيد صيغة «ملاحظات» ──
   القوالب تحمل ثماني صيغ للكلمة نفسها في 53 موضعًا: مُلاحَظات · ملحوظات ·
   ملاحَظات · ملحوظة · ملاحظات · مَلاحَظة · مَلحوظة · المُلاحَظات. الاختلاف
   بلا معنى، ويظهر للمقيّم الخارجي تفاوتًا في وثيقة واحدة. تُوحَّد **عند
   العرض** على الصيغة الأكثر ورودًا، فيسري على الحزم الإحدى والأربعين معًا
   ويبقى بعد إعادة توليدها.
   ⚠️ المركّبة لا تُمَسّ: «ملحوظات عامة (اختياري)» و«مُلاحَظة المدير»
   و«ملاحظات وإجراءات المتعثّرين» لها معانٍ إضافية. */
/* والعلّة أوسع: 35 مسمّى آخر يظهر بصيغتين لا يفرّق بينهما إلا التشكيل
   («بَيانات الخِطة» و«بَيانات الخطة»، «عُنوان التَقرير» و«عنوان التقرير»).
   يُبنى جدول توحيد من الحزمة نفسها: لكل مجموعة تتطابق بعد تجريد التشكيل
   تُختار الصيغة الأكثر ورودًا، وعند التساوي الأوفى تشكيلًا — فأسلوب
   الحزمة مُشكَّل. لا قائمة مكتوبة بيدي تُنسى عند تغيّر البيانات. */
let LABEL_CANON = new Map();
// ⚠️ المفتاح يجب أن يُبنى بعد نزع الزخرفة أيضًا: عناوين الأقسام تُعرض
//    بلا «═══» فلا يجدها الجدول إن حُفظت بها.
const stripTashkeel = (t) =>
  stripDecor(String(t ?? "")).replace(/[\u064B-\u0652\u0640]/g, "").trim();
const tashkeelCount = (t) => (String(t).match(/[\u064B-\u0652]/g) || []).length;

export function buildLabelCanon(records) {
  const groups = new Map();
  const visit = (o) => {
    if (Array.isArray(o)) { o.forEach(visit); return; }
    if (!o || typeof o !== "object") return;
    const raw = o.label;
    if (typeof raw === "string" && raw.trim() && !raw.includes("{")) {
      /* ⚠️ تُخزَّن الصيغة **بلا زخرفة**: عناوين الأقسام تُعرض بعد stripDecor،
         فتخزين الخام يُعيد «═══» إلى الشاشة بعد أن نُزعت. */
      const lab = stripDecor(raw);
      const k = stripTashkeel(lab);
      if (k) {
        if (!groups.has(k)) groups.set(k, new Map());
        const g = groups.get(k);
        g.set(lab, (g.get(lab) ?? 0) + 1);
      }
    }
    for (const v of Object.values(o)) visit(v);
  };
  for (const r of records || []) visit(r.formFields);
  const canon = new Map();
  for (const [k, forms] of groups) {
    if (forms.size < 2) continue;
    const best = [...forms].sort((a, b) =>
      b[1] - a[1] || tashkeelCount(b[0]) - tashkeelCount(a[0]) || a[0].localeCompare(b[0], "ar"))[0][0];
    canon.set(k, best);
  }
  LABEL_CANON = canon;
  return canon;
}

const NOTES_CANON = "مُلاحَظات";
const NOTES_BARE = /^(?:ال)?(?:ملاحظات|ملحوظات|ملاحظة|ملحوظة)$/;
export function canonLabel(text) {
  if (typeof text !== "string") return text;
  const bare = stripTashkeel(text);
  if (NOTES_BARE.test(bare)) return NOTES_CANON;
  return LABEL_CANON.get(bare) ?? text;
}

function labelFor(field) {
  const wrap = el("div", "f-label");
  wrap.append(el("span", null, canonLabel(arabizeText(arabizeCode(interpolate(field.label || field.key || "", interpScope(0)))))));
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

function bindValue(input, field, state, key, opts = {}) {
  const k = key ?? field.key ?? field.id;
  const initial = state[k] !== undefined ? state[k] : autoValue(field, opts);
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

function textInput(type, field, state, key, opts = {}) {
  const i = el("input", "f-in");
  i.type = type;
  if (field.placeholder) i.placeholder = field.placeholder;
  if (field.min != null) i.min = field.min;
  if (field.max != null) i.max = field.max;
  return bindValue(i, field, state, key, opts);
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
      /* يُعرض الوفر صراحةً: المستخدم يرى أن الضغط حدث ولا يُفاجَأ بحجم مختلف */
      if (f.shrunk) row.append(el("span", "file-note",
        "ضُغطت " + kb(f.shrunk.before) + " ⇐ " + kb(f.size) +
        (f.shrunk.note ? " · " + f.shrunk.note : "")));
      else if (f.size) row.append(el("span", "file-note", kb(f.size)));
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
    // مجلد المجال يفصل شواهد حقلين في سجل واحد. وإن كان مفتاحه «شواهد»
    // نفسه فلا يُضاف، وإلا صار المسار …/شواهد/<الإدخال>/شواهد/
    const sub = field.key && field.key !== "شواهد" ? "/" + field.key : "";
    const dir = ctx.evidenceDir + sub;
    /* ⚠️ الهاتف يُخرج صورة 3–5 ميجابايت، والشاهد لا يحتاجها. تُضغط قبل
       الكتابة فيهبط التخزين إلى السُّدس — وما لا يُجدي ضغطُه يُرفع كما هو. */
    for (const file of Array.from(input.files ?? [])) {
      try {
        const r = await shrinkImage(file);
        const path = dir + "/" + r.name;
        await ctx.store.writeBinary(path, await r.blob.arrayBuffer());
        state[k] = (state[k] ?? []).concat([{ name: r.name, path, size: r.after,
          type: r.blob.type || file.type,
          shrunk: r.after < r.before ? { before: r.before, note: r.note } : null }]);
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
/* عمود المسلسل: القالب يصرّح `autoFill:"ROW_NUMBER"` وكان المحرّك يتجاهله
   فيظهر عمود «م» مربّعًا فارغًا للقراءة فقط بجوار عمود «#» الذي يرسمه المحرّك —
   عمودان لرقم واحد، وأحدهما يسأل المستخدم عمّا لا جواب له. */
/* ── عرض الخليّة بقدر ما يُكتب فيها ──
   قياس: 416 كلمة تنكسر حروفها على سطرين، جُلّها «الأول» في عمود «الفَصل»
   لأن عرضه تبع عنوانه لا محتواه. يُشتقّ حدّ أدنى لكل عمود من نوعه وطول
   عنوانه وأطول خيار فيه، فلا يضيق عن كلمته ولا يتمدّد بلا داع.
   التشكيل لا يشغل عرضًا فيُنزع قبل القياس. */
const bareLen = (t) => String(t ?? "").replace(/[\u064B-\u0652\u0640]/g, "").trim().length;
function colMinWidth(c) {
  if (isSerialCol(c)) return 46;
  const t = String(c.type ?? "TEXT").toUpperCase();
  const head = bareLen(c.label) * 7.4 + 26;          // العنوان لا ينكسر أيضًا
  const opts = (c.options ?? []).map((o) => bareLen(o?.l ?? o?.label ?? o));
  const widest = opts.length ? Math.max(...opts) * 7.4 + 52 : 0;
  switch (t) {
    case "DATE": return Math.max(138, head);
    case "TIME": return Math.max(100, head);
    case "NUMBER": return Math.max(88, head);
    case "BOOLEAN": return Math.max(64, head);
    case "SELECT": case "MULTI_SELECT": case "LOOKUP": case "TEACHER_PICKER":
      return Math.max(150, head, widest);
    case "TEXTAREA": return Math.max(210, head);
    case "SIGNATURE": case "USER_SIGNATURE": case "REMOTE_SIGNATURE": return Math.max(150, head);
    default: return Math.max(112, head);
  }
}

const isSerialCol = (c) =>
  c.autoFill === "ROW_NUMBER" || /^(م|#|مسلسل|الرقم)$/.test(String(c.label ?? "").trim());

/* ── جدول الاجتماعات السنوي ──
   خمس لجان فيها جدول «الاجتِماعات المُجَدوَلة» بـ`autoLoad: null` — أي بلا أي
   بذر، فيظهر ثمانية صفوف خاوية والمستخدم يخمّن التواريخ. والمواعيد معلومة:
   ثلاثاء كل دورة حسب أسابيع المرآة وتواتر اللجنة، والبنود تُبنى من مهامّها
   الرسمية موزّعةً على الاجتماعات. */
// selectInput يضيف «— اختر —» من عنده، فلا يُكرَّر خيار فارغ
const SCHEDULE_STATUS = [
  { v: "DONE", l: "✅ نُفِّذ" },
  { v: "NOT_DONE", l: "✖ لم يُنفَّذ" },
];
const isScheduleTable = (cols) =>
  cols.some((c) => c.key === "meetingNum") && cols.some((c) => c.key === "scheduledAt");

const isoDay = (d) => {
  if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
};

const countAr = (n, one, two, few, many) =>
  n === 1 ? one : n === 2 ? two : n <= 10 ? n + " " + few : n + " " + many;

/** المحاضر تحمل مواعيدها من الجدول نفسه — لا تُملأ باليد ولا تُترك خاوية */
function seedMinutes(field, ctx) {
  const committee = (ctx.support?.committees ?? []).find((c) => c.key === ctx.committeeKey)
                 ?? (ctx.support?.committees ?? [])[0];
  const weeks = ctx.support?.weeks ?? [];
  if (!committee || !weeks.length) return null;
  return committeeMeetings(weeks, committee.meetingFrequency).map((m) => ({
    meetingNum: m.n,
    semester: m.semester === 1 ? "الأول" : "الثاني",
    week: m.weekNumber,
    scheduledAt: isoDay(m.date),
  }));
}

function seedSchedule(field, ctx) {
  const cols = field.columns ?? [];
  if (!isScheduleTable(cols)) return null;
  const committee = (ctx.support?.committees ?? []).find((c) => c.key === ctx.committeeKey)
                 ?? (ctx.support?.committees ?? [])[0];
  const weeks = ctx.support?.weeks ?? [];
  if (!committee || !weeks.length) return null;
  const meetings = committeeMeetings(weeks, committee.meetingFrequency);
  if (!meetings.length) return null;
  return meetings.map((m) => ({
    num: m.n,
    meetingNum: m.n,
    semester: m.semester === 1 ? "الأول" : "الثاني",
    week: m.weekNumber,
    scheduledAt: isoDay(m.date),
    // مفتاح العمود `itemsCount` — عدد لا نصّ. البنود كاملةً تُكتب في محضر
    // الاجتماع نفسه (CommitteeMeeting.agendaItems)، فلا تُكرَّر هنا وتُطيل الصفّ.
    itemsCount: countAr(agendaForMeeting(committee, m, meetings.length).length, "بند", "بندان", "بنود", "بندًا"),
    status: "",
  }));
}

/* ── اشتقاق داخل الصف ──
   عناوين تَعِد بالتلقائية ولا شيء يُنفّذها: «التَخصُّص (تلقائي)» في 21 جدولًا،
   و«اليَوم» مقرونًا بـ«التاريخ» في 20 جدولًا، و«الأُسبوع» في 12. كان المستخدم
   يكتب بيده ما تعرفه الحزمة. يُشتقّ الآن من خليّة أخرى في الصف نفسه.
   ⚠️ لا يُشتقّ ما لا مصدر له: «الفَصل» و«الصَف» يتبعان الطالب، ولا قائمة طلاب
   في بيانات الحزمة، فيبقيان إدخالًا يدويًا صريحًا. */
const DAY_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const colBy = (cols, re) =>
  cols.find((c) => re.test(String(c.key ?? "")) || re.test(String(c.label ?? "")));

function weekNumberOf(iso, weeks) {
  if (!iso || !Array.isArray(weeks)) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const w = weeks.find((x) => t >= new Date(x.startDate).getTime() &&
                              t <= new Date(x.endDate).getTime() + 864e5 * 2);
  return w ? String(w.weekNumber) : "";
}

/** يربط الخلايا المشتقّة بمصادرها داخل الصف الواحد */
function wireRowDerivations(cols, row, controls, ctx) {
  const set = (col, value) => {
    if (!col || value == null || value === "") return;
    const elm = controls[col.key];
    row[col.key] = value;
    if (!elm) return;
    if (elm.tagName === "SELECT") {
      const opt = [...elm.options].find((o) => o.value === value || o.textContent.trim() === value);
      if (opt) elm.value = opt.value; else return;
    } else if (elm.isContentEditable) elm.textContent = value;
    else elm.value = value;
    elm.classList.add("auto");
    elm.title = "عُبِّئ تلقائيًا — يمكنك تعديله";
  };

  const dateC = cols.find((c) => c.type === "DATE") ?? colBy(cols, /^date$|تاريخ/i);
  const dayC = colBy(cols, /^(.*day.*)$|^اليَوم$|^اليوم$/i);
  const weekC = colBy(cols, /week|^الأُسبوع$|^الأسبوع$/i);
  const fromDate = () => {
    const v = row[dateC?.key];
    if (!v) return;
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return;
    set(dayC, DAY_AR[d.getDay()]);
    set(weekC, weekNumberOf(v, ctx.support?.weeks));
  };

  const teachC = cols.find((c) => c.type === "TEACHER_PICKER") ?? colBy(cols, /teacherName|اسم المُعَلِّم|اسم المعلم/i);
  const specC = colBy(cols, /^specialty$|^specialization$|التَخصُّص|التخصص/i);
  const subjC = colBy(cols, /^subject$|^المادة$|المادة \(تلقائي\)/i);
  const fromTeacher = () => {
    const name = row[teachC?.key];
    if (!name) return;
    const t = (ctx.support?.teachers ?? []).find((x) => x.fullName === name);
    if (!t) return;
    set(specC, t.specialization || "");
    set(subjC, (Array.isArray(t.subjects) ? t.subjects.join("، ") : t.subjects) || t.specialization || "");
  };

  if (dateC && (dayC || weekC)) {
    fromDate();
    const e = controls[dateC.key];
    if (e) { e.addEventListener("change", fromDate); e.addEventListener("input", fromDate); }
  }
  if (teachC && (specC || subjC)) {
    fromTeacher();
    const e = controls[teachC.key];
    if (e) { e.addEventListener("change", fromTeacher); e.addEventListener("input", fromTeacher); }
  }
}

/* عمود «🏷️ ETEC» في محاضر اللجان الخمس يطلب من المُقَرِّر رمز مؤشّر أثناء
   تدوين المحضر — لا هو يعرفه ولا هو موضعه؛ ربط السجل بالمؤشرات مذكور في
   ترويسة السجل أصلًا. يُخفى من العرض ولا يُحذف من القالب. */
const isNoiseCol = (c) =>
  c.key === "linkedIndicatorCode" || /^🏷️\s*ETEC$/.test(String(c.label ?? "").trim());

function recurringTable(field, state, ctx) {
  const k = field.key ?? field.id;
  const cols = (field.columns ?? []).filter((c) => !isNoiseCol(c));
  if (!state[k]) {
    const seeded = seedSchedule(field, ctx) ?? (FILL ? seedRows(field, FILL) : null);
    if (seeded && seeded.length) state[k] = seeded;
    else {
      const n = field.initialRows ?? field.defaultRows ?? 3;
      state[k] = Array.from({ length: n }, () => ({}));
    }
  }
  const serialCol = cols.find(isSerialCol);
  /* ⚠️ جدولان لا يُقرآن على شاشة: سجل 96 بـ42 عمودًا (4342px في 1072px = 405%)
     وسجل 165 بـ27. لا تُحذَف أعمدة من قالب اعتماد، لكن لا تُعرض دفعةً واحدة:
     تُعرض الأساسية ويُطوى الباقي خلف زرّ. القيم المطويّة محفوظة في الصف كما هي. */
  const PRIMARY = 8;
  const foldable = cols.length > 12;
  let showAll = !foldable;
  const shownCols = () => (showAll ? cols : cols.slice(0, PRIMARY));
  const wrap = el("div", "table-wrap");
  const table = el("table", "rec-table");
  const thead = el("thead");
  const tbody = el("tbody");
  table.append(thead, tbody);
  const drawHead = () => {
    thead.innerHTML = "";
    const htr = el("tr");
    if (!serialCol) htr.append(el("th", "num", "#"));
    for (const c of shownCols()) {
      const th = el("th", isSerialCol(c) ? "num" : null,
        canonLabel(interpolate(c.label ?? c.key ?? "", interpScope(0))));
      if (c.width) th.style.width = c.width;
      else th.style.minWidth = colMinWidth(c) + "px";
      htr.append(th);
    }
    htr.append(el("th", "num", ""));
    thead.append(htr);
  };

  // شريط التراجع: الحذف كان نهائيًا بلا رجعة — صفٌّ مبذور يُحذف بالخطأ فلا يعود
  const undoBar = el("div", "undo-bar hidden");
  let removed = null;
  const showUndo = (row, i) => {
    removed = { row, i };
    undoBar.innerHTML = "";
    const t = el("span", null, "حُذف الصف " + (i + 1) + ".");
    const b = el("button", "btn-ghost sm", "↶ تراجع");
    b.type = "button";
    b.onclick = () => {
      if (!removed) return;
      state[k].splice(removed.i, 0, removed.row);
      removed = null;
      undoBar.classList.add("hidden");
      drawRows();
    };
    undoBar.append(t, b);
    undoBar.classList.remove("hidden");
  };

  const drawRows = () => {
    tbody.innerHTML = "";
    const thisWeek = FILL?.week?.weekNumber;
    state[k].forEach((row, i) => {
      const tr = el("tr");
      // اجتماع هذا الأسبوع يُميَّز ليعرف المستخدم ما عليه الآن
      if (thisWeek != null && isScheduleTable(cols) && String(row.week) === String(thisWeek))
        tr.className = "row-now";
      if (!serialCol) tr.append(el("td", "num", String(i + 1)));
      const controls = {};
      for (const c of shownCols()) {
        const td = el("td");
        if (isSerialCol(c)) {
          td.className = "num";
          td.textContent = String(i + 1);
          row[c.key] = i + 1;          // يُحفظ مع الإدخال كما لو أُدخل
        } else {
          if (c.width) td.style.width = c.width;
          const ctrl = columnControl(c, row, ctx, field);
          controls[c.key] = ctrl.querySelector?.("input,select,textarea,[contenteditable]") ?? ctrl;
          // القصير يُوسَّط، والطويل يبدأ من اليمين — توسيط فقرة يُتعب القراءة
          const long = bareLen(row[c.key]) > 42 || String(c.type).toUpperCase() === "TEXTAREA";
          if (long) td.classList.add("t-start");
          td.append(ctrl);
        }
        tr.append(td);
      }
      wireRowDerivations(shownCols(), row, controls, ctx);
      const td = el("td", "num");
      const rm = el("button", "btn-ghost sm", "✕");
      rm.type = "button";
      rm.title = "حذف الصف";
      rm.onclick = () => {
        const [gone] = state[k].splice(i, 1);
        drawRows();
        showUndo(gone, i);
      };
      td.append(rm);
      tr.append(td);
      tbody.append(tr);
    });
  };
  const drawTable = () => { drawHead(); drawRows(); };
  drawTable();
  wrap.append(table, undoBar);
  if (foldable) {
    const more = el("button", "btn-ghost sm fold-btn");
    more.type = "button";
    const label = () => {
      more.textContent = showAll
        ? "▲ الاكتفاء بالأعمدة الأساسية (" + PRIMARY + " من " + cols.length + ")"
        : "▼ عرض كل الأعمدة (" + cols.length + ")";
    };
    label();
    more.onclick = () => { showAll = !showAll; label(); drawTable(); };
    wrap.append(more);
  }
  if (field.allowAddRows !== false) {
    const add = el("button", "btn-ghost sm", "+ صف جديد");
    add.type = "button";
    add.onclick = () => { state[k].push({}); drawRows(); };
    wrap.append(add);
  }
  return wrap;
}

/* ── شريط تنسيق عربي عائم: غامق · تحته خطّ · توسيط · لون ──
   يظهر فوق الخلية المحرَّرة، ويعمل من اليمين لليسار كبقية الواجهة. */
let RICH_BAR = null, RICH_TARGET = null;
function richBar() {
  if (RICH_BAR) return RICH_BAR;
  const bar = el("div", "rich-bar hidden");
  const mk = (label, title, fn) => {
    const b = el("button", "rb", label);
    b.type = "button"; b.title = title;
    b.onmousedown = (e) => { e.preventDefault(); fn(); };
    return b;
  };
  const cmd = (c, v) => { RICH_TARGET?.focus(); document.execCommand(c, false, v); syncRich(); };
  bar.append(
    mk("غ", "غامق", () => cmd("bold")),
    mk("تحته خطّ", "تحته خطّ", () => cmd("underline")),
    mk("توسيط", "توسيط النصّ", () => cmd("justifyCenter")),
    mk("يمين", "محاذاة لليمين", () => cmd("justifyRight")),
  );
  for (const [name, color] of [["أخضر", "#155e4e"], ["ذهبي", "#a97c1f"], ["أحمر", "#a32b22"], ["أسود", "#122a25"]]) {
    bar.append(mk("●", name, () => cmd("foreColor", color)));
    bar.lastChild.style.color = color;
  }
  bar.append(mk("مسح", "إزالة التنسيق", () => cmd("removeFormat")));
  document.body.append(bar);
  RICH_BAR = bar;
  return bar;
}
function syncRich() {
  if (!RICH_TARGET) return;
  const { state, key } = RICH_TARGET._bind || {};
  if (state) state[key] = RICH_TARGET.innerHTML;
}
/* ⚠️ `inset-inline-end` في صفحة RTL يعني **اليسار**، فكان الشريط يُثبَّت بحافته
   اليسرى على مسافة حُسبت لحافته اليمنى — انعكاس كامل عبر الصفحة: خليّة في
   يسار الشاشة وشريطها في يمينها، وأحيانًا خارج الشاشة أصلًا. تُستعمل الحافة
   الفيزيائية صراحةً، ويُحبَس الشريط داخل الشاشة، ويهبط تحت الخليّة إن ضاق
   ما فوقها. */
function placeBar(elm) {
  const bar = richBar();
  bar.classList.remove("hidden");
  bar.style.insetInlineEnd = "";
  bar.style.left = "auto";
  const r = elm.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  /* على الشاشات الضيّقة الشريط أعرض من الخليّة نفسها، فمحاذاته بها تدفعه خارج
     الشاشة أو تزيحه بمئات البكسلات. يُرصف أسفل الشاشة كما في محرّرات الجوال —
     ثابت المكان، تصله الإبهام، ولا يحجب سطر الكتابة. */
  if (vw <= 620) {
    bar.classList.add("docked");
    bar.style.top = bar.style.right = bar.style.left = "";
    return;
  }
  bar.classList.remove("docked");
  const bw = bar.offsetWidth || 300;
  const bh = bar.offsetHeight || 34;
  // المحاذاة بالحافة اليمنى — بداية السطر في العربية
  const right = Math.max(8, Math.min(vw - r.right, vw - bw - 8));
  bar.style.right = right + "px";
  const above = r.top - bh - 6;
  bar.style.top = (window.scrollY + (above > 8 ? above : r.bottom + 6)) + "px";
}

/** خلية نصّية غنيّة — تحلّ محلّ TEXTAREA حيث يلزم التنسيق */
function richCell(field, state, key) {
  const k = key ?? field.key ?? field.id;
  const d = el("div", "f-in rich");
  d.contentEditable = "true";
  d.dir = "rtl";
  d.innerHTML = state[k] ?? "";
  d._bind = { state, key: k };
  d.addEventListener("focus", () => { RICH_TARGET = d; placeBar(d); });
  d.addEventListener("input", syncRich);
  d.addEventListener("blur", () => {
    syncRich();
    setTimeout(() => { if (RICH_TARGET === d) { RICH_BAR?.classList.add("hidden"); RICH_TARGET = null; } }, 150);
  });
  return d;
}

/* كل نصّ حرّ يحمل شريط تنسيق فوقه — كما في المنصّات. كان الشريط يظهر على
   «البنود والتوصيات» وحدها، فبقيت بقيّة النصوص بلا أي تنسيق. تُستثنى أعمدة
   المسلسل والحقول التي لها نوع خاص (تاريخ/رقم/اختيار) لأنها ليست نصًّا حرًّا. */
const isRich = (c) => (c.type === "TEXTAREA" || c.type === "TEXT" || c.type == null) &&
  !isSerialCol(c) && c.autoFill !== "ROW_NUMBER";

/** عناصر التحكم داخل خلايا الجدول — نفس الأنواع لكن بلا عنوان */
function columnControl(col, row, ctx, parent) {
  /* «الحالة» في جداول الاجتماعات وحدها تُصبح قائمة نُفِّذ/لم يُنفَّذ. أعمدة
     «الحالة» الأخرى لها خياراتها المعرّفة ومعانيها المختلفة (شراكة، طالب،
     تجهيزة، توصية) فلا تُمَسّ. */
  if (col.key === "status" && !col.options && isScheduleTable(parent?.columns ?? []))
    return selectInput({ ...col, key: col.key, readOnly: false }, row, col.key,
      SCHEDULE_STATUS.map((o) => ({ v: o.v, l: o.l })));
  /* ⚠️ `readOnly: true` في القوالب معناه «يُجلَب من جدارة»، ونحن منفصلون عنها.
     فكان المستخدم يرى خلايا مبذورة لا يستطيع تصحيح حرف فيها — والنصّ فوق الجدول
     يقول «راجعه وعدّله كما تريد». تُفتَح للتحرير، ويبقى المسلسل وحده محسوبًا. */
  const f = { ...col, key: col.key, readOnly: false };
  switch (col.type) {
    case "TEXTAREA": {
      if (isRich(col)) return richCell(f, row, col.key);
      const t = el("textarea", "f-in sm");
      t.rows = 2;
      return bindValue(t, f, row, col.key);
    }
    case "SELECT": return selectInput(f, row, col.key);
    case "MULTI_SELECT": return selectInput(f, row, col.key);
    case "DATE": return textInput("date", f, row, col.key, { inTable: true });
    case "TIME": return textInput("time", f, row, col.key, { inTable: true });
    case "NUMBER": return textInput("number", f, row, col.key, { inTable: true });
    case "PHONE": return textInput("tel", f, row, col.key, { inTable: true });
    case "EMAIL": return textInput("email", f, row, col.key, { inTable: true });
    case "BOOLEAN": return textInput("checkbox", f, row, col.key, { inTable: true });
    case "TEACHER_PICKER":
      return selectInput(f, row, col.key, (ctx.support?.teachers ?? []).map((t) => t.fullName));
    case "LOOKUP":
      return selectInput(f, row, col.key, lookupOptions(col, ctx));
    case "USER_SIGNATURE": case "REMOTE_SIGNATURE": case "SIGNATURE":
      return signaturePad(f, row, col.key);
    case "FILE": return filesInput(f, row, ctx, col.key, false);
    case "FILES": return filesInput(f, row, ctx, col.key, true);
    default: return isRich(col) ? richCell(f, row, col.key) : textInput("text", f, row, col.key, { inTable: true });
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

/* ⚠️ **الجداول «المرتبطة تلقائيًا» أُعيد تصميمها**. كانت تعرض «لا بيانات مرتبطة
   بعد — تظهر تلقائيًا حين تُعبَّأ في مصدرها»، وهذا إخفاء لارتباط مكسور: المشروع
   منفصل عن جدارة فلا ضامن لأي جلب حيّ. صارت **تُبذَر من بيانات الحزمة نفسها ثم
   تُحرَّر** — فتؤدّي غرضها ولا تظهر فارغة أبدًا. */
function pickCol(cols, ...res) {
  for (const re of res) {
    const c = cols.find((x) => re.test(String(x.key ?? "")) || re.test(String(x.label ?? "")));
    if (c) return c;
  }
  return null;
}

function seedLinkedRows(field, ctx) {
  // ⚠️ لا يُفترض وجود roleArFn في السياق: الحارس يمرّر سياقًا مختصرًا فانهار
  //    البذر في سجلَّي لجنتين. تُشتقّ محليًا مع بديل آمن.
  const roleArFn = ctx.roleArFn || ctx.roleAr && typeof ctx.roleAr === "function"
    ? (ctx.roleArFn || ctx.roleAr) : (r) => String(r ?? "");
  ctx = { ...ctx, roleArFn };
  const cfg = field.autoLoad ?? {};
  const src = String(cfg.source ?? "");
  const cols = field.columns ?? [];
  const key = cfg.whereKey || ctx.committeeKey;
  const committee = (ctx.support?.committees ?? []).find((c) => c.key === key)
                 ?? (ctx.support?.committees ?? [])[0];
  const members = committee?.members ?? [];
  const nameC = pickCol(cols, /name|الاسم|العضو/i);
  /* ⚠️ عمودان مختلفان كانا يُلتَقطان بتعبير واحد: «الدَور الإداري» (وظيفته في
     المدرسة) و«المَنصب في اللجنة» (رئيس/مُقَرِّر/عُضو). البيانات تحمل
     `roleInCommittee` وكان مهمَلًا تمامًا، فبقي عمود المنصب بلا بذر. */
  const posC = pickCol(cols, /^position$|المنصب في اللجنة|الصفة في اللجنة|صفة العضو/i);
  const roleC = pickCol(cols.filter((c) => c !== posC), /^role$|الدور الإداري|الوظيفة|الصفة/i);
  const seatOf = (m) => committeePositionAr(m.roleInCommittee);
  const memberRow = (m) => ({
    [nameC?.key ?? "name"]: m.fullName || "",
    ...(roleC ? { [roleC.key]: ctx.roleArFn(m.role) } : {}),
    ...(posC ? { [posC.key]: seatOf(m) } : {}),
  });

  if (src === "SchoolCommittee.members") return members.map(memberRow);
  if (src === "CommitteeMeeting.attendances") {
    const statusC = pickCol(cols, /status|الحضور|حالة/i);
    return members.map((m) => ({
      ...memberRow(m),
      ...(statusC ? { [statusC.key]: "حاضر" } : {}),
    }));
  }
  if (src === "MeetingSignature") return members.map(memberRow);
  if (src === "CommitteeMeeting.agendaItems") {
    const textC = pickCol(cols, /text|البند|الموضوع|المناقشة/i) ?? cols[1] ?? cols[0];
    const numC = pickCol(cols, /^n$|num|م$|رقم/i);
    const items = agendaForMeeting(committee, ctx.meeting, ctx.meetings?.length ?? 1);
    return items.map((it) => ({
      ...(numC ? { [numC.key]: it.n } : {}),
      [textC?.key ?? "text"]: it.text,
    }));
  }
  if (src.startsWith("PlanAction")) {
    const acts = (ctx.support?.actions ?? [])
      .filter((a) => !cfg.templateNumber || a.recordTemplateNumber === cfg.templateNumber)
      .slice(0, 60);
    return acts.map((a) => {
      const row = {};
      for (const c of cols) {
        const k = String(c.key ?? "");
        row[k] = a[k] ?? (Array.isArray(a[k]) ? a[k].join("، ") : "") ?? "";
        if (k === "name") row[k] = a.name;
        if (/responsible|مسؤول/i.test(k)) row[k] = (a.mainResponsibleRoles || []).map(ctx.roleArFn).join("، ");
      }
      return row;
    });
  }
  if (src.startsWith("RecordEntry@")) {
    const n = Number(src.split("@")[1]);
    const rows = (ctx.savedEntries?.[n] ?? []).flatMap((e) => e.data?.[cfg.field] ?? []);
    return rows.length ? rows : null;
  }
  return null;
}

/** جدول كان «مرتبطًا» — يُبذَر بما نعرفه ثم يُحرَّر كأي جدول */
function linkedTable(field, state, ctx) {
  const k = field.key ?? field.id;
  if (!state[k]) {
    const seeded = seedLinkedRows(field, ctx);
    state[k] = seeded && seeded.length ? seeded
             : Array.from({ length: field.initialRows ?? 3 }, () => ({}));
  }
  const box = el("div");
  const seededNote = el("div", "note sm",
    "عُبِّئ مبدئيًا من بيانات مدرستك — راجعه وعدّله كما تريد، وأضف صفوفًا عند الحاجة.");
  box.append(seededNote, recurringTable({ ...field, allowAddRows: true }, state, ctx));
  return box;
}

/** قسم مكرر — مجموعة حقول تتكرر كعناصر */
function repeatingSection(field, state, ctx) {
  const k = field.key ?? field.id;
  if (!state[k]) {
    // ⚠️ `defaultItems` مصفوفة لا عدد: تمريرها إلى Array.from({length}) يُنتج صفرًا
    const n = Number.isFinite(field.initialItems) ? field.initialItems
            : Array.isArray(field.defaultItems) ? field.defaultItems.length : 1;
    // المحاضر تُبذَر بمواعيدها من مرآة الخطة لا تُترك خاوية
    const seeded = field.meetingSource ? seedMinutes(field, ctx) : null;
    state[k] = seeded && seeded.length ? seeded
             : Array.from({ length: Math.max(1, n) }, () => ({}));
  }
  const wrap = el("div", "repeat");
  const draw = () => {
    wrap.innerHTML = "";
    state[k].forEach((item, i) => {
      const card = el("div", "repeat-item");
      const head = el("div", "repeat-head");
      const lbl = interpolate(field.itemLabel ?? "", interpScope(i, item));
      head.append(el("b", "repeat-t", lbl || "عنصر " + (i + 1)));
      const rm = el("button", "btn-ghost sm", "حذف");
      rm.type = "button";
      rm.onclick = () => { state[k].splice(i, 1); draw(); };
      head.append(rm);
      card.append(head);
      for (const sub of field.fields ?? []) card.append(renderField(sub, item, { ...ctx, insideRepeat: true }));
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

/* ⚠️ تدرّج بصري بثلاث مراتب — العناوين في القوالب ليست سواءً:
   524 عنوانًا مزخرفًا بـ«═══» (رئيسي) · 151 عاديًا (فرعي) · 12 داخل أقسام
   متكرّرة (ثانوي). كانت كلها تُرسم بنمط واحد فتضيع الهرمية، وتظهر الزخرفة
   «═══» نصًّا خامًا. الآن: تُنزع الزخرفة وتُترجَم إلى **مرتبة ولون**. */
export function headingLevel(label) {
  const l = String(label ?? "").trim();
  if (/^═+/.test(l)) return 1;
  if (/^[▪▫◾•▸]/.test(l) || /^\d️⃣/.test(l)) return 2;
  return 2;
}
export const stripDecor = (l) => String(l ?? "").replace(/^[═\s]+|[═\s]+$/g, "").trim();

function sectionHeader(field, ctx) {
  const raw = interpolate(field.label ?? "", interpScope(0));
  const lvl = ctx?.insideRepeat ? 3 : headingLevel(raw);
  const h = el(lvl === 1 ? "h3" : "h4", "sec lvl" + lvl);
  h.append(el("span", "sec-mark"), el("span", "sec-t", canonLabel(arabizeText(stripDecor(raw)))));
  return h;
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
  SECTION_HEADER: (f, s, ctx) => sectionHeader(f, ctx),
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
    if (isRich(f)) return box(f, richCell(f, s));
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
  AUTO_LINKED_TABLE: (f, s, ctx) => box(f, linkedTable(f, s, ctx)),
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

/** نموذج شواهد عام — يُستعمل حين يخلو القالب من الحقول */
const GENERIC_EVIDENCE_FIELDS = [
  { type: "SECTION_HEADER", label: "بيانات العمل" },
  { type: "TEXT", key: "title", label: "عنوان العمل أو النشاط", required: true },
  { type: "DATE", key: "entryDate", label: "التاريخ", autoFill: "TODAY" },
  { type: "TEXTAREA", key: "summary", label: "وصف ما نُفِّذ", rows: 4 },
  { type: "TEXTAREA", key: "outcome", label: "الأثر والنتائج", rows: 3 },
  { type: "SECTION_HEADER", label: "الشواهد" },
  { type: "FILES", key: "evidence", label: "أرفق الشواهد",
    helpText: "صور · تقارير · كشوف حضور · أي شاهد رسمي." },
  { type: "SECTION_HEADER", label: "الاعتماد" },
  { type: "USER_SIGNATURE", key: "sign", label: "توقيع المسؤول" },
];

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
  const fields = ff.fields ?? [];
  /* ⚠️ سجل بلا حقول ولا حاوية يفتح **فارغًا** أمام صاحبه (رُصد في سجل 36).
     يُعطى نموذج شواهد عامًّا بدل الفراغ: وصف · شواهد · توقيع. */
  if (fields.length === 0 && !template.isContainer) {
    container.append(el("div", "note sm",
      "هذا السجل بلا نموذج محدَّد في القالب — استعمله ملفَّ شواهد: صف العمل وأرفق أدلّته."));
    for (const f of GENERIC_EVIDENCE_FIELDS) container.append(renderField(f, state, ctx));
    return container;
  }
  for (const f of fields) container.append(renderField(f, state, ctx));
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

  /* دلالات التحقق الرسمية للمؤشرات التي يحملها هذا السجل — ما يفتحه الزائر */
  const verify = [];
  for (const code of t.etecIndicators || []) {
    const d = (ctx.verifyTool?.domains || []).find((x) => x.key === code);
    for (const it of d?.items || []) verify.push({ code, text: it.r || it.rephrased || "" });
  }

  const dl = el("div", "guide-facts");
  for (const [k, v] of facts) {
    const row = el("div", "gf");
    row.append(el("span", "gk", k), el("span", "gv", v));
    dl.append(row);
  }
  body.append(dl);

  if (verify.length) {
    body.append(el("div", "guide-vt", "ما يبحث عنه الزائر في هذا السجل (" + verify.length + " دلالة تحقّق)"));
    const ul = el("ul", "guide-list");
    for (const v of verify) {
      const li = el("li");
      li.append(el("span", "vcode", v.code), document.createTextNode(" " + v.text));
      ul.append(li);
    }
    body.append(ul);
  }

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
