/* ── شاشة «خطط مدرستي» ──
 *
 * كانت روابط PDF ثابتة (٢٫٢٣ ج.ب في الحزم، ٩٣٪ من وزنها) لا تُحرَّر ولا
 * تُبحث ولا تعكس تعديلات المدرسة. صارت تُبنى من بيانات الحزمة نفسها:
 * الخطة التشغيلية وتحليل سوات والخطة التنفيذية — تُحرَّر وتُطبع بكليشة
 * المدرسة وتُنزَّل ملفًّا قائمًا بذاته.
 */
import { $, esc, only, markNav } from "./ui-state.js?v=e168b883";
import { canEditPlans } from "./scope.js?v=e168b883";
import { roleAr, loadOperationalOverride, loadExecMasterOverride,
         saveOperationalEdits, saveExecMasterEdits } from "./app.js?v=e168b883";
import { printDocument, downloadStandaloneDocument } from "./print.js?v=e168b883";
import { setSaver, markDirty, markSaved, guardLeave } from "./draft.js?v=e168b883";
import { OPS_COLUMNS, buildOperationalRows, groupOperational, groupExecByWeek,
         groupSwot, filterRows, SWOT_AR, operationalDocHtml, executiveDocHtml,
         swotDocHtml } from "./plans.js?v=e168b883";

let CTX = null;
let tab = "ops";                 // ops | exec | swot
let opsRows = [], opsGroups = [], opsOv = null, execOv = null;
let execRole = null, execSem = 1;
const pendingOps = new Map();    // id ⇒ {field: value}
const pendingExec = new Map();   // key ⇒ {field: value}
const PAGE = 60;                 // صفوف الدفعة الواحدة

const canEdit = () => canEditPlans(CTX?.me?.role);
const stat = (t) => { const e = $("plansStat"); if (e) e.innerHTML = t; };

export function bindPlansScreen(ctx) { CTX = ctx; }

export async function goPlansScreen(ctx) {
  CTX = ctx || CTX;
  only("screenPlans"); markNav("plans");
  const { store, bundle } = CTX;
  $("plansBody").innerHTML = '<div class="muted" style="padding:20px">جارٍ بناء خطط مدرستك…</div>';
  [opsOv, execOv] = await Promise.all([
    loadOperationalOverride(store).catch(() => ({ edits: {} })),
    loadExecMasterOverride(store).catch(() => ({ edits: {} })),
  ]);
  opsRows = buildOperationalRows(bundle.support?.actions ?? [], opsOv);
  opsGroups = groupOperational(opsRows, bundle.support?.actions ?? []);
  execRole = execRole || CTX.me?.role;
  render();
}

function render() {
  const swot = groupSwot(CTX.bundle.results?.swot);
  const tabs = [
    ["ops", "الخطة التشغيلية", opsRows.length],
    ["exec", "الخطة التنفيذية", (CTX.bundle.exec?.byRole?.[execRole] || []).length],
    ["swot", "تحليل سوات", swot.reduce((a, x) => a + x.items.length, 0)],
  ];
  $("plansTabs").innerHTML = tabs.map(([k, l, n]) =>
    '<button class="plans-tab' + (tab === k ? " on" : "") + '" data-t="' + k + '">' +
    esc(l) + '<span class="n">' + n + "</span></button>").join("");
  $("plansTabs").querySelectorAll("button").forEach((b) => {
    b.onclick = () => guardLeave(() => { tab = b.dataset.t; render(); }, "ما عدّلتَه في الخطة");
  });

  if (!canEdit()) {
    stat('<span class="muted">العرض والطباعة والتنزيل متاحة لك · التعديل بصلاحية ' +
      'مدير المدرسة أو منسق الجودة.</span>');
  } else stat("");

  if (tab === "ops") renderOps();
  else if (tab === "exec") renderExec();
  else renderSwot();
  setSaver(() => saveActive());
}

/* ── الخطة التشغيلية ── */
function renderOps() {
  const q = ($("plansSearch")?.value || "").trim();
  const groups = q
    ? [{ key: "q", label: "نتائج البحث", rows: filterRows(opsRows, q) }]
    : opsGroups;
  $("plansBody").innerHTML =
    '<div class="note sm">خطة مدرستك التشغيلية — ' + opsRows.length + " إجراءً. " +
    (canEdit() ? "عدّل ما تشاء ثم احفظ؛ " : "") +
    "يُطبع بكليشة مدرستك ويُنزَّل ملفًّا يعمل بلا إنترنت.</div>" +
    groups.map((g, gi) =>
      '<details class="plan-group"' + (gi === 0 || q ? " open" : "") + ' data-g="' + gi + '">' +
      "<summary>" + esc(g.label) + '<span class="tag gray">' + g.rows.length + "</span></summary>" +
      '<div class="tbl-wrap"><table class="rec-table plan-t"><thead><tr>' +
      OPS_COLUMNS.map((c) => '<th style="width:' + c.w + '">' + esc(c.t) + "</th>").join("") +
      "</tr></thead><tbody></tbody></table></div>" +
      '<div class="load-more-row hidden"><button class="b-ghost b-sm">عرض المزيد</button>' +
      '<span class="muted"></span></div></details>').join("");
  groups.forEach((g, gi) => mountGroup(gi, g.rows));
}

/** يرسم الدفعة الأولى ويترك زرًّا للباقي — 831 صفًّا دفعةً واحدة تُجمّد الجوّال */
function mountGroup(gi, rows) {
  const det = $("plansBody").querySelector('[data-g="' + gi + '"]');
  if (!det) return;
  const tb = det.querySelector("tbody");
  const more = det.querySelector(".load-more-row");
  let shown = 0;
  const draw = () => {
    const next = rows.slice(shown, shown + PAGE);
    tb.insertAdjacentHTML("beforeend", next.map(opsRowHtml).join(""));
    shown += next.length;
    more.classList.toggle("hidden", shown >= rows.length);
    more.querySelector("span").textContent = shown < rows.length
      ? "عُرض " + shown + " من " + rows.length : "";
    wireOps(tb);
  };
  more.querySelector("button").onclick = draw;
  draw();
}

const cell = (v, attr) => (canEdit()
  ? '<td><div class="p-cell" contenteditable="true" ' + attr + ">" + esc(v) + "</div></td>"
  : "<td>" + esc(v) + "</td>");

function opsRowHtml(r) {
  return '<tr' + (r.excellence ? ' class="exc-row"' : "") + ">" +
    cell(r.name, 'data-op="' + esc(r.id) + '|name"') +
    (r.excellence ? "" : "") +
    cell(r.method, 'data-op="' + esc(r.id) + '|method"') +
    "<td>" + esc(r.who) + "</td>" +
    "<td>" + esc(r.support) + "</td>" +
    cell(r.achievementIndicator, 'data-op="' + esc(r.id) + '|achievementIndicator"') +
    "<td>" + esc(r.target) + "</td>" +
    "<td>" + esc(r.when) + "</td></tr>";
}

function wireOps(scope) {
  scope.querySelectorAll("[data-op]").forEach((el) => {
    if (el.dataset.wired) return;
    el.dataset.wired = "1";
    el.oninput = () => {
      const [id, field] = el.dataset.op.split("|");
      pendingOps.set(id, { ...(pendingOps.get(id) || {}), [field]: el.textContent.trim() });
      markDirty(); showSave();
    };
  });
}

/* ── الخطة التنفيذية ── */
function renderExec() {
  const byRole = CTX.bundle.exec?.byRole || {};
  const roles = Object.keys(byRole);
  const pick = canEdit() || roles.length === 1
    ? '<select class="f-in" id="planRole" style="width:auto">' +
      roles.map((r) => '<option value="' + r + '"' + (r === execRole ? " selected" : "") + ">" +
        esc(roleAr(r)) + "</option>").join("") + "</select>"
    : '<b>' + esc(roleAr(execRole)) + "</b>";
  const weeks = groupExecByWeek(byRole[execRole] || [], execSem, execOv, execRole);
  $("plansBody").innerHTML =
    '<div class="plan-bar">' + pick +
    '<select class="f-in" id="planSem" style="width:auto">' +
    '<option value="1"' + (execSem === 1 ? " selected" : "") + ">الفصل الأول</option>" +
    '<option value="2"' + (execSem === 2 ? " selected" : "") + ">الفصل الثاني</option></select>" +
    '<span class="muted">' + (byRole[execRole] || []).length + " مهمّة عبر الفصلين</span></div>" +
    (weeks.length
      ? weeks.map((w) =>
        '<details class="plan-group"><summary>الأسبوع ' + w.week +
        '<span class="tag gray">' + w.rows.length + "</span></summary>" +
        '<div class="tbl-wrap"><table class="rec-table plan-t"><thead><tr>' +
        '<th style="width:38px">م</th><th>المهمّة</th><th style="width:170px">المصدر</th>' +
        "</tr></thead><tbody>" +
        w.rows.map((t, i) =>
          '<tr' + (t.excellence ? ' class="exc-row"' : "") + "><td>" + (i + 1) + "</td>" +
          cell(t.text, 'data-ex="' + esc(t.key) + '|text"') +
          '<td class="muted">' + esc(t.source) + "</td></tr>").join("") +
        "</tbody></table></div></details>").join("")
      : '<div class="empty">لا مهامّ لهذا الدور في هذا الفصل.</div>');
  const rs = $("planRole");
  if (rs) rs.onchange = () => guardLeave(() => { execRole = rs.value; render(); }, "ما عدّلتَه");
  $("planSem").onchange = (e) => guardLeave(() => { execSem = Number(e.target.value); render(); }, "ما عدّلتَه");
  $("plansBody").querySelectorAll("[data-ex]").forEach((el) => {
    el.oninput = () => {
      const [key, field] = el.dataset.ex.split("|");
      pendingExec.set(key, { ...(pendingExec.get(key) || {}), [field]: el.textContent.trim() });
      markDirty(); showSave();
    };
  });
}

/* ── تحليل سوات ── */
function renderSwot() {
  const g = groupSwot(CTX.bundle.results?.swot);
  $("plansBody").innerHTML = g.length
    ? '<div class="note sm">تحليل البيئة الداخلية والخارجية كما اعتُمد في خطة مدرستك.</div>' +
      '<div class="swot-grid">' + g.map((s) =>
        '<div class="swot-box s-' + s.key.toLowerCase() + '"><h3>' + esc(s.label) +
        '<span class="tag gray">' + s.items.length + "</span></h3><ul>" +
        s.items.map((x) => "<li>" + esc(x.text) + "</li>").join("") + "</ul></div>").join("") + "</div>"
    : '<div class="empty">لا تحليل سوات في حزمة مدرستك.</div>';
}

/* ── الحفظ ── */
function showSave() {
  const b = $("plansSave");
  if (!b) return;
  const n = pendingOps.size + pendingExec.size;
  b.classList.toggle("hidden", n === 0);
  b.textContent = "حفظ " + n + " تعديلًا";
}

export async function saveActive() {
  if (!pendingOps.size && !pendingExec.size) return;
  const who = CTX.me?.fullName || roleAr(CTX.me?.role);
  stat("جارٍ الحفظ…");
  if (pendingOps.size) {
    opsOv = await saveOperationalEdits(CTX.store, [...pendingOps], who);
    pendingOps.clear();
    opsRows = buildOperationalRows(CTX.bundle.support?.actions ?? [], opsOv);
    opsGroups = groupOperational(opsRows, CTX.bundle.support?.actions ?? []);
  }
  if (pendingExec.size) {
    execOv = await saveExecMasterEdits(CTX.store, execRole, [...pendingExec], who);
    pendingExec.clear();
  }
  markSaved(); showSave();
  stat('<span style="color:var(--brand)">✅ حُفظ في مجلد مدرستك — ' +
    new Date().toLocaleTimeString("ar-SA") + "</span>");
  CTX.afterSave?.();
}

/* ── الطباعة والتنزيل: من البيانات كاملةً لا من الشاشة ──
 * ⚠️ الشاشة ترسم 60 صفًّا ثم تنتظر الزرّ. فنسخُ الـDOM يُخرج خطّةً ناقصةً
 * بصمت — والمقيّم لا يعلم أن ما بين يديه ناقص. */
/* ⚠️ يُبنى من **البيانات كاملةً** لا من الشاشة: الشاشة ترسم 60 صفًّا وتنتظر
   الزرّ، فنسخُ الـDOM يُخرج خطّةً ناقصةً بصمت. والبناء في `plans.js` ليكون
   ما يُطبع وما يُنزَّل وما يُولَّد ملفًّا في مجلد المدرسة **شيئًا واحدًا**. */
function buildDoc() {
  const d = document.createElement("div");
  d.className = "p-doc";
  const school = CTX.bundle.school;
  d.innerHTML =
    tab === "ops" ? operationalDocHtml({ actions: CTX.bundle.support?.actions ?? [], ov: opsOv, school })
  : tab === "exec" ? executiveDocHtml({ tasks: CTX.bundle.exec?.byRole?.[execRole] ?? [],
                                        ov: execOv, role: execRole, roleArFn: roleAr, school })
  : swotDocHtml({ swot: CTX.bundle.results?.swot, school });
  return d;
}

const docTitle = () => (tab === "ops" ? "الخطة التشغيلية"
  : tab === "exec" ? "الخطة التنفيذية - " + roleAr(execRole) : "تحليل سوات") +
  " — " + CTX.bundle.school.nameAr;

/** التشغيلية عريضة الأعمدة فتُطبع أفقيًّا، وما سواها طوليًّا */
const orientation = () => (tab === "ops" ? "landscape" : "portrait");

export async function printPlans() {
  stat("جارٍ تجهيز المطبوع…");
  try {
    await printDocument(buildDoc(), { store: CTX.store, school: CTX.bundle.school,
      person: CTX.me, roleAr: roleAr(CTX.me?.role), orientation: orientation() });
    stat("");
  } catch (e) { stat('<span class="err">تعذّرت الطباعة: ' + esc(e.message) + "</span>"); }
}

export async function downloadPlans() {
  stat("جارٍ تجهيز الملف…");
  try {
    const r = await downloadStandaloneDocument(buildDoc(),
      { store: CTX.store, orientation: orientation() }, docTitle());
    stat('<span style="color:var(--brand)">✅ نُزِّل الملف (' +
      Math.round(r.bytes / 1024) + "KB) — يفتح بأي متصفّح بلا إنترنت</span>");
  } catch (e) { stat('<span class="err">تعذّر التنزيل: ' + esc(e.message) + "</span>"); }
}

export const searchPlans = () => { if (tab === "ops") renderOps(); };
