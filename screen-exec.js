/* ── شاشة الخطة التنفيذية ──
   أُخرجت من index.html بحالتها: `execState` ملكُ هذه الشاشة، ويُقرأ من
   الخارج بـcurrentExecState() لا بمشاركة متغيّر.
   ctx = { CTX.store, CTX.bundle, CTX.me, afterSave } */
import { $, esc, only, markNav } from "./ui-state.js?v=cca7ee86";
import { execPlanPath, roleAr } from "./app.js?v=cca7ee86";
import { currentWeek } from "./autofill.js?v=cca7ee86";
import { backupEntry } from "./vault.js?v=cca7ee86";

let execState = null, CTX = null;
export const currentExecState = () => execState;

export async function goExec(ctx) {
  /* ⚠️ تُستدعى أيضًا معالِجًا لحدث (تبديل الفصل) فيصلها كائن Event بدل
     السياق. ما لا يحمل `store` ليس سياقًا — فيُتجاهل ويبقى القائم. */
  if (ctx && ctx.store) CTX = ctx;
  const { store, bundle, me } = CTX;
  only("screenExec"); markNav("exec");
  const mine = (bundle.exec?.byRole?.[me.role] || []);
  if (!execState) {
    try { execState = await store.readJson(execPlanPath(me)); }
    catch { execState = { edits: {}, added: {}, done: {}, notes: {} }; }
  }
  const sem = Number($("execSem").value || 1);
  const weeks = [...new Set(mine.filter((t) => t.semester === sem).map((t) => t.week))].sort((a, b) => a - b);
  const cur = currentWeek(bundle.support?.weeks);
  $("execMeta").textContent = mine.length + " مهمة عبر الفصلين · " + roleAr(me.role) +
    (cur ? " · الأسبوع الحالي " + cur.weekNumber : "");

  $("execWeeks").innerHTML = weeks.map((w) => {
    const tasks = mine.filter((t) => t.semester === sem && t.week === w);
    const isNow = cur && cur.semester === sem && cur.weekNumber === w;
    const added = execState.added[sem + "-" + w] || [];
    return '<details class="tree exec-w"' + (isNow ? " open" : "") + '><summary>' +
      "الأسبوع " + w + (isNow ? '<span class="tag gold" style="margin-inline-start:9px">الأسبوع الحالي</span>' : "") +
      '<span class="tag gray" style="margin-inline-start:9px">' + (tasks.length + added.length) + "</span></summary>" +
      '<table><thead><tr><th style="width:38px">م</th><th>المهمة</th><th style="width:150px">المصدر</th>' +
      '<th style="width:92px">التنفيذ</th><th>ملاحظات</th></tr></thead><tbody>' +
      tasks.map((t, i) => {
        const id = sem + "-" + w + "-" + t.order;
        const val = execState.edits[id] ?? t.text;
        return "<tr><td>" + (i + 1) + '</td><td><input class="f-in sm" data-edit="' + id + '" value="' +
          esc(val) + '"></td><td class="muted">' + esc(t.rowLabel || t.source || "—") + "</td>" +
          '<td><input type="checkbox" data-done="' + id + '"' + (execState.done[id] ? " checked" : "") + "></td>" +
          '<td><input class="f-in sm" data-note="' + id + '" value="' + esc(execState.notes[id] ?? "") + '"></td></tr>';
      }).join("") +
      added.map((t, i) => {
        const id = sem + "-" + w + "-x" + i;
        return "<tr><td>+</td><td><input class=\"f-in sm\" data-add=\"" + sem + "|" + w + "|" + i +
          '" value="' + esc(t) + '"></td><td class="muted">مهمة مضافة</td>' +
          '<td><input type="checkbox" data-done="' + id + '"' + (execState.done[id] ? " checked" : "") + "></td>" +
          '<td><input class="f-in sm" data-note="' + id + '" value="' + esc(execState.notes[id] ?? "") + '"></td></tr>';
      }).join("") +
      '</tbody></table><button class="b-ghost b-sm" data-addw="' + sem + "|" + w + '">+ مهمة في هذا الأسبوع</button></details>';
  }).join("");

  const bind = (attr, fn) => $("execWeeks").querySelectorAll("[data-" + attr + "]").forEach((el2) => {
    const h = () => fn(el2.dataset[attr], el2);
    el2.addEventListener(el2.type === "checkbox" ? "change" : "input", h);
  });
  bind("edit", (id, el2) => { execState.edits[id] = el2.value; });
  bind("note", (id, el2) => { execState.notes[id] = el2.value; });
  bind("done", (id, el2) => { execState.done[id] = el2.checked; });
  bind("add", (k, el2) => {
    const [sm, wk, i] = k.split("|");
    (execState.added[sm + "-" + wk] ||= [])[+i] = el2.value;
  });
  $("execWeeks").querySelectorAll("[data-addw]").forEach((b) => {
    b.onclick = () => {
      const [sm, wk] = b.dataset.addw.split("|");
      (execState.added[sm + "-" + wk] ||= []).push("");
      goExec();
    };
  });
}

/** يربط أزرار الشاشة مرّة واحدة */
export function bindExecScreen(ctx) {
  CTX = ctx;
  $("execSem").onchange = goExec;
  $("execSave").onclick = async () => {
    $("execStat").textContent = "جارٍ الحفظ…";
    try {
      await CTX.store.writeJson(execPlanPath(CTX.me), {
        ...execState, role: CTX.me.role, roleAr: roleAr(CTX.me.role), person: CTX.me.fullName,
        school: CTX.bundle.school.nameAr, savedAt: new Date().toISOString(),
      });
      const bk = await backupEntry(CTX.store, { kind: "خطط تنفيذية", sourcePath: execPlanPath(CTX.me),
        data: execState, person: CTX.me.fullName, roleAr: roleAr(CTX.me.role) });
      CTX.afterSave && CTX.afterSave();
      $("execStat").textContent = "✅ حُفظت خطتك" + (bk.ok ? " · ونُسخت للمستودع" : "");
    } catch (e) { $("execStat").textContent = "❌ " + e.message; }
  };
}
