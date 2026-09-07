/* ── نموذج خطط المدرسة — بناءٌ نقيّ بلا DOM ولا تخزين ──
 *
 * الخطة التشغيلية والتنفيذية موجودتان في حزمة كل مدرسة (`support.actions`
 * و`تنفيذية.byRole`)، وكانتا تُعرضان روابطَ PDF ثابتة لا تُحرَّر ولا تُبحث.
 * هذا الملف يحوّلهما إلى بنيةٍ تُعرض وتُطبع وتُنزَّل.
 */
import { roleAr, normalizeAr } from "./app.js?v=81ef2448";

/** ⚠️ مفتاح المهمّة يُشتقّ هنا وحده — نسخُه في شاشتين يجعلهما تنحرفان بصمت */
export const execTaskKey = (t) => t.semester + "-" + t.week + "-" + t.order;

export const SEMESTER_MODE_AR = {
  FIRST_ONLY: "الفصل الأول", SECOND_ONLY: "الفصل الثاني", BOTH: "الفصلان",
  CONTINUOUS: "مستمر طوال العام", PERIODIC: "دوري", PREP_WEEK: "أسبوع التحضير",
};
const MODE_ORDER = ["PREP_WEEK", "FIRST_ONLY", "BOTH", "CONTINUOUS", "PERIODIC", "SECOND_ONLY"];

/** أعمدة الخطة التشغيلية — `edit` يعني أن المدرسة تملك تعديله */
export const OPS_COLUMNS = [
  { k: "name", t: "الإجراء", edit: true, w: "26%" },
  { k: "method", t: "آلية التنفيذ", edit: true, w: "20%" },
  { k: "who", t: "المسؤول", edit: false, w: "13%" },
  { k: "support", t: "المساند", edit: false, w: "11%" },
  { k: "achievementIndicator", t: "مؤشر النجاح", edit: true, w: "16%" },
  { k: "target", t: "المستهدف", edit: false, w: "7%" },
  { k: "when", t: "التوقيت", edit: false, w: "7%" },
];

/* ⚠️ **يُوحَّد عند العرض لا في المصدر**: 380 إسنادًا في 21 مدرسة تكتب المسؤول
   بالرمز `EDUCATIONAL_VP` بدل «الوكيل التعليمي» — فيظهر حرفٌ لاتيني في واجهة
   عربية. يُترجَم وقت الرسم، وملفّ الحزمة لا يُمَسّ. */
const isCode = (v) => typeof v === "string" && /^[A-Z][A-Z_]{3,}$/.test(v.trim());
export const roleLabel = (v) => (isCode(v) ? roleAr(v.trim()) : String(v ?? "").trim());
export const roleList = (v) =>
  (Array.isArray(v) ? v : String(v ?? "").split(","))
    .map(roleLabel).filter(Boolean).join("، ");

/** وصف توقيت الإجراء بالعربية — من weekType وweekValues وsemesterMode */
export function timingLabel(a) {
  const w = a.weekType;
  if (w === "CONTINUOUS") return "مستمر";
  if (w === "MONTHLY_TRIGGER") return "شهري";
  if (w === "NONE" || !w) return SEMESTER_MODE_AR[a.semesterMode] || "—";
  let vals = a.weekValues;
  if (typeof vals === "string") { try { vals = JSON.parse(vals); } catch { vals = [vals]; } }
  if (!Array.isArray(vals) || !vals.length) return SEMESTER_MODE_AR[a.semesterMode] || "—";
  if (w === "FREE_TEXT") return vals.join("، ");
  return (vals.length === 1 ? "الأسبوع " : "الأسابيع ") + vals.join("، ");
}

/** ⚠️ مبادرات «تميز معارف» تُميَّز لا تُخلَط: صفٌّ مستقلّ في المرآة أضافه
    المستشار، والمقيّم يسأل عنه بعينه. */
export const EXCELLENCE_PREFIX = "مبادرات تميز معارف";
export const isExcellence = (a) => String(a?.name || "").startsWith(EXCELLENCE_PREFIX);

/** يبني صفوف العرض للخطة التشغيلية بعد دمج تعديلات المدرسة */
export function buildOperationalRows(actions, ov) {
  const edits = ov?.edits || {};
  return (actions || []).map((a) => {
    const e = edits[a.id] || {};
    return {
      id: a.id,
      name: e.name ?? a.name,
      method: e.method ?? a.method,
      achievementIndicator: e.achievementIndicator ?? a.achievementIndicator,
      who: roleList(a.mainResponsibleRoles),
      support: roleList(a.supporterRoles),
      target: [a.targetCount, a.targetCategory].filter(Boolean).join(" "),
      when: timingLabel(a),
      indicatorId: a.indicatorId ?? null,
      recordNumber: a.recordTemplateNumber ?? null,
      excellence: isExcellence(a),
      edited: Object.keys(e).length > 0,
    };
  });
}

/** يجمع الإجراءات بنمط الفصل — 6 مجموعات كحدّ أقصى بترتيبٍ زمني */
export function groupOperational(rows, actions) {
  const modeById = new Map((actions || []).map((a) => [a.id, a.semesterMode || "BOTH"]));
  const by = new Map();
  for (const r of rows) {
    const m = modeById.get(r.id) || "BOTH";
    (by.get(m) || by.set(m, []).get(m)).push(r);
  }
  return MODE_ORDER.filter((m) => by.has(m))
    .concat([...by.keys()].filter((m) => !MODE_ORDER.includes(m)))
    .map((m) => ({ key: m, label: SEMESTER_MODE_AR[m] || m, rows: by.get(m) }));
}

/** يجمع مهامّ دورٍ في فصلٍ بأسابيعها — نفس منطق شاشة الخطة التنفيذية */
export function groupExecByWeek(tasks, semester, ov, role) {
  const edits = ov?.edits?.[role] || {};
  const mine = (tasks || []).filter((t) => t.semester === semester);
  const weeks = [...new Set(mine.map((t) => t.week))].sort((a, b) => a - b);
  return weeks.map((w) => ({
    week: w,
    rows: mine.filter((t) => t.week === w).map((t) => {
      const k = execTaskKey(t);
      const e = edits[k] || {};
      return { key: k, order: t.order, text: e.text ?? t.text,
               source: t.rowLabel || t.source || "—",
               recordNumber: t.recordNumber ?? null,
               excellence: (t.rowLabel || "") === "التميز في معارف",
               edited: Object.keys(e).length > 0 };
    }),
  }));
}

/** أقسام تحليل سوات بترتيبها المعتاد */
export const SWOT_AR = {
  STRENGTH: "نقاط القوة", WEAKNESS: "نقاط الضعف",
  OPPORTUNITY: "الفرص", THREAT: "التهديدات",
};
const SWOT_ORDER = ["STRENGTH", "WEAKNESS", "OPPORTUNITY", "THREAT"];

export function groupSwot(swot) {
  const items = swot?.items || [];
  if (!items.length) return [];
  const by = new Map();
  for (const x of items) (by.get(x.category) || by.set(x.category, []).get(x.category)).push(x);
  return SWOT_ORDER.filter((c) => by.has(c))
    .map((c) => ({ key: c, label: SWOT_AR[c] || c, items: by.get(c) }));
}

/** يبحث في صفوف الخطة — على **البيانات** لا على نصّ الشاشة، فالصفوف قد لا تكون مرسومة */
export function filterRows(rows, q) {
  const n = normalizeAr(String(q || "").trim());
  if (!n) return rows;
  return rows.filter((r) =>
    normalizeAr([r.name, r.method, r.who, r.achievementIndicator, r.text].filter(Boolean).join(" ")).includes(n));
}


/* ── بناء مستند الخطة نصًّا ──
 *
 * ⚠️ **مصدرٌ واحد للثلاثة**: ما يُطبع، وما يُنزَّل من الموقع، وما يُولَّد ملفًّا
 * في مجلد المدرسة — كلّها من هنا. ولو بُني كلٌّ على حدة لانحرفت النسخ بصمت:
 * تُطبع خطّةً وتُنزّل أخرى. ولذلك يعيد **نصًّا** لا عقدة DOM، فيصلح للمتصفّح
 * وللسكربت معًا.
 */
const esc2 = (v) => String(v ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function head(title, school, sub) {
  return '<div class="p-title"><h1>' + esc2(title) + "</h1><div class=\"p-meta\">" +
    esc2(school.nameAr) + " · العام " + esc2(school.academicYear?.greg ?? "") +
    (sub ? " · " + esc2(sub) : "") + "</div></div>";
}

/** الخطة التشغيلية — كل الإجراءات مجموعةً بنمط الفصل */
export function operationalDocHtml({ actions, ov, school }) {
  const rows = buildOperationalRows(actions, ov);
  return head("الخطة التشغيلية", school) +
    groupOperational(rows, actions).map((g) =>
      "<h2>" + esc2(g.label) + "</h2><table><thead><tr>" +
      OPS_COLUMNS.map((c) => "<th>" + esc2(c.t) + "</th>").join("") +
      "<th>ما نُفِّذ</th><th>ملاحظات المدرسة</th></tr></thead><tbody>" +
      g.rows.map((r) => "<tr" + (r.excellence ? ' class="exc"' : "") + ">" +
        OPS_COLUMNS.map((c) => "<td>" + esc2(r[c.k] ?? "") + "</td>").join("") +
        /* ⚠️ عمودان فارغان: كل خلايا الخطة التشغيلية معبّأة، فبلا هذين لا يجد
           المستخدم موضعًا يكتب فيه — يفتح ملفًّا «قابلًا للتحرير» ولا يحرّر. */
        '<td class="fill"></td><td class="fill"></td></tr>').join("") +
      "</tbody></table>").join("");
}

/** الخطة التنفيذية لدورٍ واحد — الفصلان معًا */
export function executiveDocHtml({ tasks, ov, role, roleArFn, school }) {
  return head("الخطة التنفيذية", school, roleArFn(role)) +
    [1, 2].map((sem) => {
      const w = groupExecByWeek(tasks, sem, ov, role);
      if (!w.length) return "";
      return "<h2>" + (sem === 1 ? "الفصل الأول" : "الفصل الثاني") + "</h2>" +
        "<table><thead><tr><th>الأسبوع</th><th>م</th><th>المهمّة</th><th>المصدر</th>" +
        "<th>التنفيذ</th><th>ملاحظات</th></tr></thead><tbody>" +
        w.flatMap((x) => x.rows.map((t, i) =>
          "<tr" + (t.excellence ? ' class="exc"' : "") + "><td>" + x.week + "</td><td>" + (i + 1) +
          "</td><td>" + esc2(t.text) + "</td><td>" + esc2(t.source) +
          /* ⚠️ عمودان فارغان عمدًا: الملفّ يُطبع ويُملأ بالقلم، أو يُحرَّر في
             المتصفّح. وبلا خانةٍ للتنفيذ يصير المطبوع قراءةً لا أداةَ عمل. */
          '</td><td class="fill"></td><td class="fill"></td></tr>')).join("") +
        "</tbody></table>";
    }).join("");
}

/** تحليل سوات */
export function swotDocHtml({ swot, school }) {
  const g = groupSwot(swot);
  if (!g.length) return head("تحليل سوات", school) + "<p>لا تحليل في حزمة هذه المدرسة.</p>";
  return head("تحليل سوات", school) + g.map((s) =>
    "<h2>" + esc2(s.label) + "</h2><ul>" +
    s.items.map((x) => "<li>" + esc2(x.text) + "</li>").join("") + "</ul>").join("");
}
