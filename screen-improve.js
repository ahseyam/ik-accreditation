/* ── شاشة الخطة التحسينية ──
   أُخرجت من index.html: تقرأ ولا تكتب حالة مشتركة، فيصلها ما تقرؤه صراحةً. */
import { $, esc, only, markNav } from "./ui-state.js?v=9bc00542";
import { buildImprovementPlan, buildImprovementMirror, PROC_COLUMNS, shortLabel,
         indicatorTag, TOTAL_WEEKS, WEEKS_PER_SEMESTER } from "./improve.js?v=9bc00542";
import { loadToolResponses } from "./app.js?v=9bc00542";
import { summarize, rollupByIndicator } from "./tools.js?v=9bc00542";

export async function openImprovement({ store, bundle, roleAr }) {
  only("screenImp"); markNav("imp");
  $("impMeta").textContent = "جارٍ حساب التقويم الذاتي…";
  const imp = bundle.improvement, ev = bundle.results.externalEvaluation, nf = bundle.results.nafis;
  const summaries = [];
  for (const t of bundle.tools.tools) summaries.push(summarize(t, await loadToolResponses(store, t.key)));
  const selfByCode = new Map(rollupByIndicator(summaries).map((r) => [r.code, r]));
  $("impMeta").textContent = imp.indicatorScores.length + " مؤشرًا · " + imp.weakCount +
    " دون المستوى · " + imp.programs.length + " برنامجًا معتمَدًا";

  $("impKpi").innerHTML = [
    ["الكلي — التقويم الخارجي", ev?.extOverallScore], ["القيادة", ev?.extAdminScore],
    ["التعليم والتعلّم", ev?.extTeachingScore], ["نواتج التعلّم", ev?.extOutcomesScore],
    ["البيئة المدرسية", ev?.extEnvironmentScore],
    ["نافِس " + (nf?.testYear ?? "") + " — الكلي", nf?.overallScore],
    ["نافِس — قراءة", nf?.readingScore], ["نافِس — رياضيات", nf?.mathScore], ["نافِس — علوم", nf?.scienceScore],
  ].map(([l, v]) => '<div class="box"><div class="v">' + (v == null ? "—" : Number(v).toFixed(1)) +
    '</div><div class="l">' + esc(l) + "</div></div>").join("");

  let qiyas = null;
  try { qiyas = nf?.qiyasDetailsJson ? JSON.parse(nf.qiyasDetailsJson) : null; } catch { qiyas = null; }
  $("impQiyas").innerHTML = !qiyas ? "" :
    '<div class="card"><h2>القدرات والتحصيلي — ' + esc(qiyas.year ?? "") + "</h2>" +
    '<div class="muted" style="margin-bottom:11px">' + esc(qiyas.source ?? "") + "</div>" +
    '<div class="scroll"><table><thead><tr><th>المسار</th><th>الاختبار</th><th>متوسط المدرسة</th>' +
    "<th>متوسط الإدارة</th><th>المئين على المملكة</th><th>الترتيب</th><th>الاتجاه</th></tr></thead><tbody>" +
    Object.entries(qiyas.tracks ?? {}).flatMap(([track, tests]) =>
      Object.entries(tests).map(([kind, v]) =>
        "<tr><td>" + esc(track) + "</td><td>" +
        (kind === "tahsili" ? "التحصيلي" : kind === "qudurat" ? "القدرات" : esc(kind)) + "</td>" +
        "<td><b>" + (v.score ?? "—") + "</b></td><td>" + (v.adminAvg ?? "—") + "</td>" +
        "<td>" + (v.kingdomPct == null ? "—" : v.kingdomPct + "%") + "</td>" +
        "<td>" + (Array.isArray(v.kingdomRank) ? v.kingdomRank[0] + " من " + v.kingdomRank[1] : "—") + "</td>" +
        "<td>" + (Array.isArray(v.trend) ? v.trend.map((t) => esc(t.y) + ": " + t.v).join(" · ") : "—") +
        "</td></tr>")).join("") + "</tbody></table></div></div>";

  $("impTable").innerHTML =
    "<table><thead><tr><th>المؤشر</th><th>النص</th><th>المجال</th>" +
    "<th>التقويم الخارجي</th><th>تقويمنا الذاتي</th><th>الفرق</th></tr></thead><tbody>" +
    imp.indicatorScores.map((x) => {
      const self = selfByCode.get(x.code);
      const d = self && x.externalScore != null ? self.pct - x.externalScore : null;
      return '<tr' + (x.isWeak ? ' class="weak"' : "") + '><td><b>' + esc(x.code ?? "—") +
        '</b><div class="muted">' + esc(shortLabel(x.textAr)) + "</div></td>" +
        "<td>" + esc((x.textAr ?? "").slice(0, 82)) + "</td><td>" + esc(x.domainAr ?? "—") + "</td>" +
        "<td><b>" + (x.externalScore == null ? "—" : x.externalScore.toFixed(2)) + "</b>" +
        (x.isWeak ? ' <span class="tag gold">دون المستوى</span>' : "") + "</td>" +
        "<td>" + (self ? self.pct.toFixed(0) + '% <span class="muted">(' + self.samples + " فقرة)</span>" : "—") + "</td>" +
        "<td>" + (d == null ? "—" : '<span class="' + (d >= 0 ? "delta-up" : "delta-dn") + '">' +
          (d >= 0 ? "▲ +" : "▼ ") + d.toFixed(0) + "</span>") + "</td></tr>";
    }).join("") + "</tbody></table>";

  /* إجراءات التحسين بالأعمدة الاثني عشر */
  const plan = buildImprovementPlan({
    indicatorScores: imp.indicatorScores, records: bundle.records.records,
    tools: bundle.tools.tools, central: imp.central || [],
    approved: imp.programs || [], roleAr,
    verify: bundle.tools.tools.find((t) => t.key === "EVIDENCE_VERIFICATION"),
  });
  $("procMeta").textContent = plan.groups.length + " مؤشرًا · " +
    plan.totalProcedures + " إجراءً · " + PROC_COLUMNS.length + " عمودًا · " +
    "يشمل البرامج العلاجية المعتمدة لنافس والتحصيل";
  $("impProcedures").innerHTML = plan.groups.map((g) =>
    '<div class="proc-group"><h4>' + esc(g.tag || "—") +
    (g.indicator?.externalScore != null
      ? '<span class="tag gold" style="margin-inline-start:9px">' + g.indicator.externalScore.toFixed(1) + "</span>"
      : '<span class="tag gray" style="margin-inline-start:9px">برنامج معتمَد</span>') +
    '</h4><div class="muted" style="margin:-4px 0 9px">' + esc(g.indicator?.textAr || "") + "</div>" +
    '<div class="scroll"><table class="proc"><thead><tr>' +
    PROC_COLUMNS.map((c) => "<th>" + esc(c.l) + "</th>").join("") + "</tr></thead><tbody>" +
    g.procedures.map((p) => "<tr>" + PROC_COLUMNS.map((c) =>
      "<td>" + esc(p[c.k] ?? "—") + "</td>").join("") + "</tr>").join("") +
    "</tbody></table></div></div>").join("");

  /* مرآة التحسين */
  const mirror = buildImprovementMirror(plan.groups);
  const head = ["<th>المؤشر</th><th>الإجراء</th><th>المسؤول</th><th>المصدر</th>"];
  for (let w = 1; w <= TOTAL_WEEKS; w++)
    head.push('<th class="wk' + (w === WEEKS_PER_SEMESTER + 1 ? " sem2" : "") + '">' + w + "</th>");
  $("impMirror").innerHTML = "<table class=\"mirror\"><thead><tr>" + head.join("") +
    "</tr></thead><tbody>" + mirror.map((r) => "<tr><td>" + esc(r.code) + "</td><td>" +
      esc(r.name.slice(0, 60)) + "</td><td>" + esc(r.owner) + "</td>" +
      Array.from({ length: TOTAL_WEEKS }, (_, i) => {
        const w = i + 1;
        return '<td class="wk' + (w === WEEKS_PER_SEMESTER + 1 ? " sem2" : "") +
          (r.weeks.has(w) ? " on" : "") + '"></td>';
      }).join("") + "</tr>").join("") + "</tbody></table>";

  const byId = new Map(imp.indicatorScores.map((x) => [x.indicatorId, x]));
  $("impPrograms").innerHTML = imp.programs.length === 0
    ? '<div class="warn">لا برامج معتمَدة بعد.</div>'
    : imp.programs.map((pr) => {
        const ind = byId.get(pr.indicatorId);
        const stage = (ttl, st) => !st?.text ? "" :
          '<div class="stage"><b>' + ttl + ":</b> " + esc(st.text) +
          (st.achievement ? '<br><span class="muted">مؤشر التحقق: ' + esc(st.achievement) + "</span>" : "") +
          (st.roles?.length ? '<br><span class="muted">المسؤولون: ' + esc(st.roles.map(roleAr).join("، ")) + "</span>" : "") + "</div>";
        return '<div class="prog"><h4>' + esc(pr.name) + "</h4>" +
          '<div class="muted">' + (ind ? "المؤشر " + esc(ind.code) + " · " + esc(ind.textAr ?? "") +
            " · الدرجة " + (ind.externalScore ?? "—") : "بلا مؤشر") + "</div>" +
          (pr.description ? '<div style="margin-top:9px;font-size:14px">' + esc(pr.description) + "</div>" : "") +
          stage("🚀 بَدء التطبيق", pr.start) + stage("📋 التقييم", pr.review) + "</div>";
      }).join("");
}
