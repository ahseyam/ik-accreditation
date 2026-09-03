/* ── بوّابة الدخول ومُختار المدرسة ──
 *
 * رابطٌ واحد لكل مدارس ابن خلدون: كلمةٌ عامّة، ثم مجمع ← مسار ← مرحلة ←
 * بنين/بنات، فتصل المدرسة إلى مجلدها.
 *
 * ⚠️ **الكلمة لافتةٌ لا قفل.** الموقع صفحاتٌ ثابتة تُقرأ شيفرتها في المتصفّح،
 * فالكلمة مرئيّة لمن بحث عنها. تمنع الفضولي ولا تمنع القاصد. القفل الحقيقي
 * في صلاحيات OneDrive: من لا يملك صلاحية الكتابة في مجلد المدرسة لا يحفظ
 * فيه — والمنع عند مايكروسوفت لا عندنا. وهذا مكتوبٌ للمستخدم لا مخبوءٌ عنه.
 *
 * ⚠️ **الخطوة الرابعة (الجنس) ليست تحسينًا.** المجمع والمسار والمرحلة وحدها
 * تُنتج مدرستين في عشرين تركيبة من إحدى وعشرين — بنين وبنات. يُثبت ذلك
 * `build-school-index.mjs` عند كل توليد ويسقط إن لم يبقَ المفتاح الرباعي
 * فريدًا. */
import { $, esc } from "./ui-state.js?v=9bc00542";

const CODE = "ikc-2026";
const K_PASS = "ik.gate.pass.v1";
const K_PICK = "ik.gate.school.v1";

let INDEX = null;

export async function loadSchoolIndex() {
  if (INDEX) return INDEX;
  const r = await fetch("مدارس.json");
  if (!r.ok) throw new Error("تعذّر تحميل فهرس المدارس.");
  INDEX = (await r.json()).rows || [];
  return INDEX;
}

const ls = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch { /* وضع خاص */ } };
const drop = (k) => { try { localStorage.removeItem(k); } catch { /* وضع خاص */ } };

export const gatePassed = () => ls(K_PASS) === "1";
/** المدرسة المختارة — أو null. تُقارَن بما في المجلد فلا يُكتب في مجلد غيرها. */
export function chosenSchool() {
  try { return JSON.parse(ls(K_PICK) || "null"); } catch { return null; }
}
export function clearChoice() { drop(K_PICK); }
export function clearGate() { drop(K_PASS); drop(K_PICK); }

/* الترتيب مقصود: الأكبر عددًا أوّلًا في المجمعات، والمراحل بترتيبها الطبيعي */
const ORDER = { stage: ["ابتدائي", "متوسط", "ثانوي"], track: ["وطني", "عالمي"], gender: ["بنين", "بنات"] };
const sortBy = (key, vals) => {
  const o = ORDER[key];
  return o ? vals.slice().sort((a, b) => o.indexOf(a) - o.indexOf(b)) : vals.slice().sort((a, b) => a.localeCompare(b, "ar"));
};

/** يبني شاشة البوّابة كاملةً. يستدعي onDone(row) حين تُختار مدرسة. */
export async function renderGate(onDone) {
  const box = $("gateBody");
  if (!gatePassed()) return askCode(box, () => renderGate(onDone));
  const rows = await loadSchoolIndex();
  const pick = {};                       // ما اخترناه حتى الآن
  const STEPS = [
    { key: "complex", t: "المجمع التعليمي", ic: "🏫" },
    { key: "track",   t: "مسار التعليم",     ic: "🧭" },
    { key: "stage",   t: "المرحلة الدراسية", ic: "📚" },
    { key: "gender",  t: "بنين أم بنات",      ic: "👥" },
  ];

  const matches = () => rows.filter((r) => STEPS.every((s) => pick[s.key] == null || r[s.key] === pick[s.key]));

  function draw() {
    const left = matches();
    let html = "";
    for (let i = 0; i < STEPS.length; i++) {
      const s = STEPS[i];
      const prevDone = STEPS.slice(0, i).every((p) => pick[p.key] != null);
      if (!prevDone) break;
      // الخيارات المتاحة تُشتقّ ممّا بقي فعلًا — فلا يُعرض خيارٌ يقود إلى لا شيء
      const pool = rows.filter((r) => STEPS.slice(0, i).every((p) => r[p.key] === pick[p.key]));
      const opts = sortBy(s.key, [...new Set(pool.map((r) => r[s.key]))]);
      html += '<div class="gstep' + (pick[s.key] != null ? " done" : " now") + '">' +
        '<div class="gs-h"><span class="gs-n">' + s.ic + "</span>" + esc(s.t) +
        (pick[s.key] != null
          ? '<span class="gs-v">' + esc(pick[s.key]) + "</span>" +
            '<button class="gs-x" data-back="' + s.key + '">تغيير</button>'
          : "") + "</div>" +
        '<div class="gs-opts">' + opts.map((o) =>
          '<button class="gs-o' + (pick[s.key] === o ? " sel" : "") + '" data-k="' + esc(s.key) +
          '" data-v="' + esc(o) + '">' + esc(o) +
          '<span class="gs-c">' + pool.filter((r) => r[s.key] === o).length + "</span></button>").join("") +
        "</div></div>";
      if (pick[s.key] == null) break;
    }
    if (left.length === 1 && STEPS.every((s) => pick[s.key] != null)) {
      const r = left[0];
      html += '<div class="gfound"><div class="gf-ic">📁</div>' +
        "<div><b>" + esc(r.school) + "</b>" +
        '<span>مجلدك على OneDrive باسم:<br><code>' + esc(r.folder) + "</code></span></div></div>" +
        '<button class="b-main" id="gateGo">تابع إلى مدرستي ←</button>';
    }
    box.innerHTML = html;
    box.querySelectorAll(".gs-o").forEach((b) => {
      b.onclick = () => {
        pick[b.dataset.k] = b.dataset.v;
        // اختيار خطوةٍ يُلغي ما بعدها — وإلّا بقيت قيمةٌ لا تنتمي للفرع الجديد
        const i = STEPS.findIndex((s) => s.key === b.dataset.k);
        STEPS.slice(i + 1).forEach((s) => delete pick[s.key]);
        draw();
      };
    });
    box.querySelectorAll(".gs-x").forEach((b) => {
      b.onclick = () => {
        const i = STEPS.findIndex((s) => s.key === b.dataset.back);
        STEPS.slice(i).forEach((s) => delete pick[s.key]);
        draw();
      };
    });
    const go = $("gateGo");
    if (go) go.onclick = () => {
      const r = matches()[0];
      put(K_PICK, JSON.stringify(r));
      onDone(r);
    };
  }
  draw();
}

function askCode(box, onOk) {
  box.innerHTML =
    '<div class="gcode">' +
      "<label for=\"gateCode\">كلمة الدخول</label>" +
      '<input id="gateCode" class="f-in" type="password" autocomplete="off" ' +
        'inputmode="latin" placeholder="أدخل كلمة الدخول" spellcheck="false">' +
      '<button class="b-main" id="gateIn">دخول</button>' +
      '<div class="f-help" id="gateMsg"></div>' +
      '<div class="note gnote"><b>ما الذي تحميه هذه الكلمة — وما لا تحميه.</b> ' +
      "هي كلمةٌ تنظيمية تمنع الدخول العابر، ولا تُغني عن الصلاحيات: " +
      "<b>من لا يملك صلاحية التحرير في مجلد مدرستك على OneDrive لا يستطيع " +
      "الحفظ فيه</b> مهما فعل. الحماية الحقيقية هناك.</div>" +
    "</div>";
  const inp = $("gateCode"), msg = $("gateMsg");
  const tryIn = () => {
    // يُقارَن بعد تنظيف المسافات وتوحيد الحالة — لا يُعاقَب المستخدم على شكل الكتابة
    if ((inp.value || "").trim().toLowerCase() !== CODE) {
      msg.innerHTML = '<div class="err">كلمة الدخول غير صحيحة — اطلبها من مستشار الاعتماد.</div>';
      inp.select(); return;
    }
    put(K_PASS, "1");
    onOk();
  };
  $("gateIn").onclick = tryIn;
  inp.onkeydown = (e) => { if (e.key === "Enter") tryIn(); };
  inp.focus();
}
