/* جاهزية الزيارة — رقم واحد يفهمه المدير، ومعه الأدلّة التي بُني منها.

   ⚠️ لا صندوق أسود: كل بُعد يُعرض بمصدره وعدده، فيستطيع المدير أن يقول
   للزائر «هذه الجاهزية ولهذا السبب». والحساب كله من المجلد لا من خادم.   */

/* ⚠️ الأوزان **اجتهاد مهني** لا نظام منشور من هيئة تقويم التعليم. لكل وزن
   أساسٌ مُعلَن أدناه، ويُعرض للمستخدم كي يدافع عن الرقم لا كي يتلقّاه.
   وقياسُ حسّاسيتها (scripts/audit-readiness-weights.mjs) على أربعة أنظمة
   أوزان معقولة وستّة ملفّات حالة: **حكم الجاهزية لا يتبدّل في أيٍّ منها**،
   وأقصى فارق 8.4 نقطة (في حالة «سجلات ممتلئة بلا شواهد»). فالاجتهاد في
   الوزن لا يقلب القرار الذي يُبنى عليه. */
/* ⚠️ **«47» كان مكتوبًا في النصّ** فظهر لرياض الأطفال وإطارُها 44 مؤشرًا —
   وشاشةٌ تقول للروضة إنها تُقاس بمؤشرات مرحلةٍ أخرى تُفسد الملفّ من أساسه.
   فالأساس يُحسب من حزمة المدرسة نفسها: كم مؤشرًا في إطارها، وكم منها تُثبته
   سجلاتها وأدواتها فعلًا. */
export const DIMENSIONS = [
  { key: "records",  label: "تعبئة السجلات",       weight: 30 },
  { key: "evidence", label: "الشواهد المرفوعة",     weight: 25,
    basis: "السجل المُعبَّأ بلا شاهد دعوى؛ الشاهد هو ما يحوّله إلى دليل." },
  { key: "tools",    label: "أدوات التقويم الذاتي", weight: 20 },
  { key: "improve",  label: "الخطة التحسينية",      weight: 15,
    basis: "تخصّ المؤشرات دون المستوى وحدها، فنطاقها أضيق." },
  { key: "exec",     label: "الخطط التنفيذية",      weight: 10,
    basis: "جاهزية داخلية لا يطّلع عليها الزائر مباشرة." },
];

/** الأساس المحسوب من الحزمة — لا نصٌّ ثابت */
export function dimensionBasis({ records = [], tools = [], indicators = [] }) {
  const total = indicators.length;
  const covered = (list) => {
    const s = new Set();
    for (const x of list) for (const c of (x || [])) if (c) s.add(String(c));
    return [...s].filter((c) => indicators.includes(c)).length;
  };
  const byRec = covered(records.map((r) => r.etecIndicators));
  const byTool = covered(tools.map((t) => (t.domains || []).map((d) => d.key)));
  const share = (n) => (total ? " (" + Math.round((n / total) * 100) + "%)" : "");
  return {
    records: total
      ? "السجلات تُثبت " + byRec + " من " + total + " مؤشّرًا" + share(byRec) + "، وهي أوّل ما يفتحه الزائر."
      : "السجلات أوّل ما يفتحه الزائر.",
    tools: total
      ? "الأدوات " + tools.length + " تغطّي " + byTool + " من " + total + " مؤشّرًا" + share(byTool) +
        "، وهي مصدر التقويم الذاتي."
      : "أدوات التقويم الذاتي مصدر التقويم.",
  };
}

const pct = (a, b) => (b > 0 ? Math.min(100, (a / b) * 100) : 0);

/** يعدّ الشواهد المرفوعة عبر مجلدات التنفيذيين */
export async function countEvidence(store) {
  let files = 0, folders = 0;
  let people = [];
  try { people = await store.list("مخرجات"); } catch { return { files, folders }; }
  for (const p of people) {
    if (p.kind !== "directory") continue;
    let recs = [];
    try { recs = await store.list("مخرجات/" + p.name + "/شواهد"); } catch { continue; }
    for (const r of recs) {
      if (r.kind !== "directory") continue;
      folders++;
      try {
        const entries = await store.list("مخرجات/" + p.name + "/شواهد/" + r.name);
        for (const e of entries) {
          if (e.kind === "directory") {
            const inner = await store.list("مخرجات/" + p.name + "/شواهد/" + r.name + "/" + e.name);
            files += inner.filter((x) => x.kind !== "directory").length;
          } else files++;
        }
      } catch { /* فارغ */ }
    }
  }
  return { files, folders };
}

/** كم تنفيذيًا حفظ خطته التنفيذية */
export async function countExecPlans(store) {
  let saved = 0, total = 0;
  let people = [];
  try { people = await store.list("مخرجات"); } catch { return { saved, total }; }
  for (const p of people) {
    if (p.kind !== "directory") continue;
    total++;
    try {
      const files = await store.list("مخرجات/" + p.name);
      if (files.some((f) => f.name === "خطتي التنفيذية.json")) saved++;
    } catch { /* لا شيء */ }
  }
  return { saved, total };
}

/**
 * يحسب الجاهزية. كل بُعد يعيد { pct, done, total, note }.
 * لا يُخترع رقم: ما لا يُقاس يُعلَن صفرًا مع سبب.
 */
export function computeReadiness({ records, recordCounts, toolSummaries, improvement,
                                   evidence, execPlans, rosterSize }) {
  const core = (records || []).filter((r) => r.isCoreRecord);
  const filledCore = core.filter((r) => (recordCounts?.[r.number] ?? 0) > 0).length;

  // الشاهد المتوقَّع: ملف واحد على الأقل لكل سجل أساسي مُعبَّأ
  const expectedEvidence = Math.max(filledCore, 1);
  const toolsWith = (toolSummaries || []).filter((t) => t.responses > 0).length;

  const allInd = improvement?.indicatorScores || [];
  const weak = allInd.filter((x) => x.isWeak);
  const weakCovered = weak.filter((ind) =>
    (records || []).some((r) => (r.etecIndicators || []).includes(ind.code) &&
      (recordCounts?.[r.number] ?? 0) > 0)).length;

  const dims = {
    records: { done: filledCore, total: core.length, pct: pct(filledCore, core.length),
               note: filledCore + " من " + core.length + " سجلًا أساسيًا فيه إدخال واحد فأكثر" },
    evidence: { done: evidence?.files ?? 0, total: expectedEvidence,
                pct: pct(evidence?.files ?? 0, expectedEvidence),
                note: (evidence?.files ?? 0) + " ملف شاهد مرفوع في " + (evidence?.folders ?? 0) + " سجلًا" },
    tools: { done: toolsWith, total: (toolSummaries || []).length,
             pct: pct(toolsWith, (toolSummaries || []).length),
             note: toolsWith + " أداة من " + (toolSummaries || []).length + " فيها استجابة" },
    /* ⚠️ مدرسة بلا مؤشرات دون المستوى كانت تُعطى **صفرًا** في هذا البُعد —
       فتُعاقَب لأنها جيّدة. لا مطلوبَ يعني مستوفًى بالكامل. (كشفه اختبار وحدة.) */
    /* ⚠️ صفر مؤشرات ضعيفة له معنيان يجب التمييز بينهما:
       ① المدرسة ممتازة (قائمة المؤشرات موجودة وليس فيها ضعيف) ⇒ 100% استحقاقًا.
       ② بيانات التحسين مفقودة أصلًا ⇒ 0% مع إعلان السبب، لا منحة مجانية.
       كشف الفرقَ اختبارُ وحدة بعد أن كان يُعطي 0% للحالتين ثم 100% لهما. */
    improve: allInd.length === 0
      ? { done: 0, total: 0, pct: 0, note: "لا بيانات مؤشرات في هذه الحزمة — البُعد غير مقيس" }
      : weak.length === 0
        ? { done: 0, total: 0, pct: 100, note: "لا مؤشرات دون المستوى — لا مطلوب في هذا البُعد" }
        : { done: weakCovered, total: weak.length, pct: pct(weakCovered, weak.length),
            note: weakCovered + " من " + weak.length + " مؤشرًا دون المستوى له سجل مُفعَّل" },
    /* ⚠️ المقام **عدد التنفيذيين في الروستر** لا عدد المجلدات الموجودة:
       المجلد لا يُنشأ إلا لمن اتصل، فالقسمة على الموجود تعطي 100% كذبًا
       حين يتصل واحد فقط. قِيس: 1/1 = 100% والصواب 1/11 = 9%. */
    exec: { done: execPlans?.saved ?? 0, total: rosterSize || 1,
            pct: pct(execPlans?.saved ?? 0, rosterSize || 1),
            note: (execPlans?.saved ?? 0) + " من " + (rosterSize || 0) +
                  " تنفيذيًا حفظ خطته التنفيذية" },
  };

  let score = 0;
  for (const d of DIMENSIONS) score += (dims[d.key].pct * d.weight) / 100;
  return { score, dims };
}

export function readinessLabel(score) {
  if (score >= 85) return { t: "جاهزة للزيارة", c: "ok" };
  if (score >= 65) return { t: "جاهزية متقدّمة — تبقّى استكمال", c: "warn" };
  if (score >= 40) return { t: "جاهزية جزئية", c: "warn" };
  return { t: "البداية — التعبئة لم تنطلق بعد", c: "danger" };
}

/** حالة كل مؤشر: الخارجي · الذاتي · سجلاته · شواهده */
export function indicatorStatus({ improvement, records, recordCounts, selfByCode, verifyTool }) {
  const verifyCodes = new Set((verifyTool?.domains || []).map((d) => d.key));
  return (improvement?.indicatorScores || []).map((x) => {
    const recs = (records || []).filter((r) => (r.etecIndicators || []).includes(x.code));
    const filled = recs.filter((r) => (recordCounts?.[r.number] ?? 0) > 0).length;
    const self = selfByCode?.get(x.code) || null;
    return {
      code: x.code, textAr: x.textAr, isWeak: x.isWeak, external: x.externalScore,
      self: self ? self.pct : null, records: recs.length, filled,
      hasVerify: verifyCodes.has(x.code),
    };
  }).sort((a, b) => (a.external ?? 999) - (b.external ?? 999));
}
