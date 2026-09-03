/* ── شاشة أداة التقويم ──
   أُخرجت من index.html **بحالتها معها**: الأداة الجارية وإجاباتها وترتيبها
   ملكُ هذه الشاشة لا حالة عامّة يقرؤها الجميع. من يريدها يسأل عنها.
   ctx = { store, bundle, me, myTools, recordCounts, settings, roleAr,
           onSettings, afterSave, goList } */
import { $, esc, only, markNav, setStatus } from "./ui-state.js?v=2ef416d9";
import { flattenTool, scaleMax, levelFromEvidence, isEvidenceBased, isVerification,
         evidenceFromRecords, toolResponsePath } from "./tools.js?v=2ef416d9";
import { newEntryId } from "./app.js?v=2ef416d9";
import { backupEntry } from "./vault.js?v=2ef416d9";
import { renderPublish } from "./publish.js?v=2ef416d9";

let curTool = null, toolState = null, toolIndex = -1, CTX = null;

export const currentTool = () => curTool;
export const currentToolIndex = () => toolIndex;

export function openTool(key, ctx) {
  CTX = ctx || CTX;
  const { myTools, recordCounts } = CTX;
  toolIndex = myTools.findIndex((x) => x.tool.key === key);
  curTool = myTools[toolIndex]?.tool;
  if (!curTool) return;
  toolState = { respondent: "", answers: {}, evidence: {}, notes: {} };
  only("screenTool"); markNav("tools");
  const items = flattenTool(curTool), max = scaleMax(curTool), ev = isEvidenceBased(curTool);
  $("toolTitle").textContent = curTool.nameAr;
  $("toolMeta").textContent = items.length + (isVerification(curTool) ? " دلالة تحقّق" : " فقرة") +
    " · مقياس من " + max +
    (ev ? " · الدرجة تُشتقّ من عدد الشواهد لا تُختار" : "") +
    (curTool.credit ? " · " + curTool.credit : "");
  $("toolPos").textContent = (toolIndex + 1) + " من " + CTX.myTools.length;
  $("toolPrev").disabled = toolIndex <= 0;
  $("toolNext").disabled = toolIndex >= CTX.myTools.length - 1;

  publishBox();
  $("respondentBox").innerHTML =
    '<div class="f-label">وصف المستجيب (بلا أسماء)</div>' +
    '<input class="f-in" id="respondent" placeholder="' +
    (curTool.type === "SURVEY" ? "الطالب الأول / المعلمة الثانية…" : "المُقيِّم أو الفصل المُلاحَظ") + '">';
  $("respondent").oninput = (e) => { toolState.respondent = e.target.value; };

  const html = []; let lastGroup = null;
  for (const it of items) {
    if (it.group && it.group !== lastGroup) {
      html.push('<div class="grp">' + esc(it.group) +
        (it.indicatorAr ? '<div class="muted" style="font-weight:400;margin-top:5px">' +
          esc(it.indicatorAr) + "</div>" : "") + "</div>");
      lastGroup = it.group;
    }
    html.push('<div class="item-card" data-n="' + esc(it.uid) + '">');
    html.push('<div class="item-txt"><span class="item-n">' + it.n + ".</span>" + esc(it.text) + "</div>");
    if (it.etec.length) html.push('<div class="muted" style="margin-bottom:9px">مؤشرات: ' + esc(it.etec.join("، ")) + "</div>");
    /* شواهد الروبرك المتوقّعة: ما الذي يبحث عنه المقيّم بالضبط، وفي أي سجل،
       وممّن يُطلب. كانت في البيانات ولا تُعرض، فيحكم المستخدم بلا معيار. */
    if (it.evidences && it.evidences.length) {
      html.push('<details class="vevi"><summary>ما الذي يُتحقَّق منه؟ · ' +
        it.evidences.length + " شاهدًا</summary><ul>" +
        it.evidences.map((e) => "<li>" + esc(e) + "</li>").join("") + "</ul>" +
        (it.documents && it.documents.length
          ? '<div class="vsrc"><b>السجل:</b> ' + esc(it.documents.join(" · ")) + "</div>" : "") +
        (it.source ? '<div class="vsrc"><b>يقدّمه:</b> ' + esc(it.source) + "</div>" : "") +
        "</details>");
    }
    if (ev && it.observations && it.observations.length) {
      html.push('<div class="obs">' + it.observations.map((o, i) =>
        '<label><input type="checkbox" data-obs="' + esc(it.uid) + '" data-i="' + i + '"><span>' + esc(o) + "</span></label>").join("") + "</div>");
      html.push('<div class="derived" data-derived="' + esc(it.uid) + '">الشواهد: 0 ← ' + esc(curTool.scaleLabels[0]) + "</div>");
    } else if (ev) {
      const auto = evidenceFromRecords(it, recordCounts);
      html.push('<div class="scale"><span class="muted">عدد الشواهد المتوافرة:</span>' +
        '<input class="f-in sm" style="width:92px" type="number" min="0" data-count="' + esc(it.uid) + '" value="' + (auto ?? 0) + '">' +
        (it.records ? '<span class="muted">السجلات المرتبطة: ' + it.records.join("، ") +
          (auto != null ? " · محسوبة تلقائيًا من إدخالاتكم: " + auto : "") + "</span>" : "") + "</div>");
      html.push('<div class="derived" data-derived="' + esc(it.uid) + '"></div>');
    } else {
      html.push('<div class="scale">' + curTool.scaleLabels.map((lab, i) =>
        '<label><input type="radio" name="q' + esc(it.uid) + '" data-q="' + esc(it.uid) + '" value="' + (i + 1) +
        '"><span>' + esc(lab) + "</span></label>").join("") + "</div>");
    }
    if (curTool.hasNote)
      html.push('<div style="margin-top:9px"><input class="f-in sm" data-note="' + esc(it.uid) +
        '" placeholder="' + esc(curTool.noteLabel || "ملاحظة") + '"></div>');
    html.push("</div>");
  }
  $("toolItems").innerHTML = html.join("");
  $("toolItems").querySelectorAll("input[data-note]").forEach((i) => {
    i.oninput = () => { (toolState.notes ||= {})[i.dataset.note] = i.value; };
  });

  const thr = (uid) => (items.find((x) => x.uid === uid) || {}).thresholds;
  const setLvl = (uid, cnt) => {
    const lvl = levelFromEvidence(cnt, thr(uid), curTool);
    toolState.answers[uid] = lvl; toolState.evidence[uid] = cnt;
    const d = $("toolItems").querySelector('[data-derived="' + CSS.escape(uid) + '"]');
    if (d) d.textContent = "الشواهد: " + cnt + " ← " + curTool.scaleLabels[lvl - 1];
  };
  $("toolItems").querySelectorAll("input[data-obs]").forEach((cb) => {
    cb.onchange = () => setLvl(cb.dataset.obs,
      $("toolItems").querySelectorAll('input[data-obs="' + CSS.escape(cb.dataset.obs) + '"]:checked').length);
  });
  $("toolItems").querySelectorAll("input[data-count]").forEach((inp) => {
    const apply = () => setLvl(inp.dataset.count, Number(inp.value) || 0);
    inp.oninput = apply; apply();
  });
  $("toolItems").querySelectorAll("input[data-q]").forEach((r) => {
    r.onchange = () => { toolState.answers[r.dataset.q] = Number(r.value); };
  });
  $("toolStatus").textContent = "";
  window.scrollTo(0, 0);
}

function publishBox() {
  const box = $("publishBox");
  if (!curTool || curTool.type !== "SURVEY") { box.classList.add("hidden"); return; }
  renderPublish({ tool: curTool, store: CTX.store, school: CTX.bundle.school,
                  settings: CTX.settings, onSettings: CTX.onSettings });
}

/** يربط أزرار الشاشة مرّة واحدة عند الإقلاع */
export function bindToolScreen(ctx) {
  CTX = ctx;
  $("toolBack").onclick = () => CTX.goList && CTX.goList();
  $("toolPrev").onclick = () => toolIndex > 0 && openTool(CTX.myTools[toolIndex - 1].tool.key);
  $("toolNext").onclick = () => toolIndex < CTX.myTools.length - 1 && openTool(CTX.myTools[toolIndex + 1].tool.key);
  $("toolSave").onclick = async () => {
    if (!curTool || !toolState) { setStatus("لم تُفتح أداة بعد", "warn"); return; }
    const answered = Object.keys(toolState.answers).length, total = flattenTool(curTool).length;
    $("toolStatus").textContent = "جارٍ الحفظ…";
    try {
      const id = newEntryId();
      await CTX.store.writeJson(toolResponsePath(curTool.key, id), {
        toolKey: curTool.key, toolName: curTool.nameAr, type: curTool.type,
        scaleType: curTool.scaleType, scaleMax: scaleMax(curTool),
        responseId: id, savedAt: new Date().toISOString(),
        respondentLabel: toolState.respondent || null,
        conductedBy: CTX.me.fullName, conductedByRole: CTX.me.role, school: CTX.bundle.school.nameAr,
        answers: toolState.answers, evidenceCounts: toolState.evidence, notes: toolState.notes || {},
      });
      const bk = await backupEntry(CTX.store, { kind: "تقويم", sourcePath: toolResponsePath(curTool.key, id),
        data: { toolKey: curTool.key, responseId: id, answers: toolState.answers },
        person: CTX.me.fullName, roleAr: CTX.roleAr(CTX.me.role) });
      CTX.afterSave && CTX.afterSave();
      $("toolStatus").textContent = "✅ حُفظت (" + answered + " من " + total + " فقرة)" +
        (bk.ok ? " · ونُسخت للمستودع" : "");
    } catch (e) { $("toolStatus").textContent = "❌ تعذّر الحفظ: " + e.message; }
  };
}
