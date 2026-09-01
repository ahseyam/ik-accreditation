/* بناء إجراءات الخطة التحسينية — بالأعمدة الاثني عشر المعتمدة في جدارة:
   الاسم · الفصل · الأسبوع · أسلوب التنفيذ · الفئة المستهدفة · العدد · المتطلبات ·
   المسؤول الرئيسي · المساند · الدعم الخارجي · مؤشر التحقق · الملاحظات.

   ⚠️ الإجراءات **ليست إنشاءً**: كل إجراء يستند إلى شيء يفتحه الزائر فعلًا —
   السجلات التي تحمل رمز المؤشر، وفقرات أدوات التقويم التي تقيسه، وبرنامج
   البنك المركزي إن وُجد. فالمتطلبات ومؤشر التحقق **إشارة إلى شاهد قائم**.   */

export const PROC_COLUMNS = [
  { k: "name", l: "الإجراء" }, { k: "semester", l: "الفصل" }, { k: "weeks", l: "الأسبوع" },
  { k: "method", l: "أسلوب التنفيذ" }, { k: "target", l: "الفئة المستهدفة" },
  { k: "count", l: "العدد" }, { k: "requirements", l: "المتطلبات" },
  { k: "owner", l: "المسؤول الرئيسي" }, { k: "support", l: "المساند" },
  { k: "external", l: "الدعم الخارجي" }, { k: "evidence", l: "مؤشر التحقق" },
  { k: "notes", l: "الملاحظات" },
];

/* ⚠️ رمز المؤشر وحده لا يُفهِم القارئ شيئًا. تُشتقّ **تسمية قصيرة** من نصّ
   المؤشر نفسه بنزع صدر الجملة («تشجع المدرسة» · «يحقق المتعلمون») وذيلها،
   فتبقى الفكرة: «4-1-4-1 · الرخصة المهنية». مشتقّة لا مؤلَّفة. */
const LEAD = /^(?:تشجع|تنمي|تفعل|توفر|تلبي|تقوّم|تقوم|تعزز|تدعم|تحلل|تبني|تضع|تتيح|تنظم|تحقق|تراعي|تستخدم|تشرك|تعد|تتابع|يحقق|يظهر|يلتزم|يشارك|تمتلك|تعمل|تتوافر|تتوفر)\s+(?:المدرسة|المتعلمون|المتعلمين|في المدرسة)?\s*/;
const TAIL = /\s*(?:لدى المتعلمين|للمتعلمين|بمن فيهم ذوو الإعاقة(?: والموهوبون)?|وفقًا للاختبارات الوطنية|في المدرسة|ودعم تعلمهم|وتحقيق أهدافها)?\s*\.?$/;

export function shortLabel(textAr, max = 44) {
  let t = String(textAr ?? "").trim();
  if (!t) return "";
  t = t.replace(LEAD, "").replace(TAIL, "").trim();
  // مفعول به مضاف («منسوبيها») ثم شبه الجملة («للحصول على» · «في مجال»)
  t = t.replace(/^\S+(?:ها|هم|هن|يها|يهم)\s+/, "");
  t = t.replace(/^(?:للحصول على|في مجال|من خلال|على|في|من|إلى|ل)\s+/, "");
  t = t.replace(/^(?:أنشطة|نتائج متقدمة في)\s+/, "$&").replace(/[.،]$/, "").trim();
  if (t.length > max) {
    const cut = t.slice(0, max);
    t = cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 12)).trim() + "…";
  }
  return t || String(textAr).slice(0, max);
}

/** «4-1-4-1 · الرخصة المهنية» */
export const indicatorTag = (ind) => {
  const l = shortLabel(ind?.textAr);
  return (ind?.code ?? "—") + (l ? " · " + l : "");
};

export const WEEKS_PER_SEMESTER = 19;
export const TOTAL_WEEKS = 38;

/** الفئة المستهدفة والجهة الداعمة يُشتقّان من مجال المؤشر */
const DOMAIN_PROFILE = {
  "الإدارة المدرسية": { target: "قيادة المدرسة ومنسوبوها", external: "إدارة التخطيط والعمليات المدرسية بالشركة" },
  "التعليم والتعلم": { target: "المعلمون والمتعلمون", external: "إدارة الإشراف التربوي بالشركة" },
  "نواتج التعلم": { target: "المتعلمون", external: "قسم القياس والتقويم بالشركة" },
  "البيئة المدرسية": { target: "المدرسة ومرافقها وأولياء الأمور", external: "إدارة الخدمات والمرافق بالشركة" },
};
const profileOf = (d) => DOMAIN_PROFILE[d] || { target: "منسوبو المدرسة", external: "الإدارة العامة بالشركة" };

/** السجلات التي تحمل رمز المؤشر — هي وعاء الشواهد الذي يفتحه الزائر */
export function recordsForIndicator(records, code) {
  return (records || []).filter((r) => (r.etecIndicators || []).includes(code));
}

/** دلالات التحقّق الرسمية للمؤشر — من أداة التحقق المعتمدة */
export function verifyStatements(verifyTool, code) {
  const d = (verifyTool?.domains || []).find((x) => x.key === code);
  return (d?.items || []).map((i) => i.r || i.rephrased || "").filter(Boolean);
}

/** فقرات الأدوات العشر التي تقيس هذا المؤشر */
export function toolItemsForIndicator(tools, code) {
  const out = [];
  for (const t of tools || []) {
    const lists = [t.items, t.paragraphs,
      ...(t.sections || []).map((s) => s.paragraphs || s.items),
      ...(t.domains || []).map((d) => d.items)].filter(Array.isArray);
    for (const list of lists) {
      for (const it of list) {
        const e = Array.isArray(it.etec) ? it.etec : it.etec ? [it.etec] : [];
        if (e.includes(code)) out.push({ tool: t.nameAr, n: it.n, text: it.rephrased || it.r || "" });
      }
    }
  }
  return out;
}

const weeksLabel = (from, span) => {
  const a = ((from - 1) % WEEKS_PER_SEMESTER) + 1;
  const b = Math.min(WEEKS_PER_SEMESTER, a + span - 1);
  return a === b ? String(a) : a + "–" + b;
};
const semLabel = (w) => (w <= WEEKS_PER_SEMESTER ? "الأول" : "الثاني");
const rolesAr = (roles, roleAr) => (roles || []).map(roleAr).join("، ");

/**
 * يبني إجراءات مؤشر واحد. سلسلة ثابتة المنطق ومتغيّرة المحتوى:
 * تشخيص ← اعتماد برنامج ← تنفيذ (خطوات البنك) ← توثيق بالسجلات ← قياس بالأداة ← أثر.
 */
export function buildProcedures(ind, ctx) {
  const { records, tools, central, roleAr } = ctx;
  const prof = profileOf(ind.domainAr);
  const recs = recordsForIndicator(records, ind.code);
  const items = toolItemsForIndicator(tools, ind.code);
  const prog = (central || []).find((c) => c.code === ind.code);

  /* ⚠️ 30 إجراءً من 35 كانت ملكيتها «مدير المدرسة» لأن البرنامج المركزي
     يضع المدير أولًا في أدواره. المسؤول الطبيعي هو صاحب السجل الذي يُثبت
     المؤشّر؛ ويبقى المدير مالكًا حين لا سجل له. */
  /* أوّل سجل ليس أولى الناس بالمؤشّر: الأخذ به ركّز 61 إجراءً من 71 على
     الوكيل التعليمي. المالك هو الدور **الأكثر تكرارًا** في سجلات المؤشّر. */
  const tally = new Map();
  for (const r of recs) for (const role of (r.primaryRoles || []))
    tally.set(role, (tally.get(role) ?? 0) + 1);
  const recOwner = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0];
  const progOwner = (prog?.roles || []).find((r) => r !== "PRINCIPAL") || prog?.roles?.[0];
  const owner = recOwner || progOwner || "PRINCIPAL";
  const supporters = [...new Set([...(prog?.roles?.slice(1) || []),
    ...recs.flatMap((r) => r.primaryRoles || [])])].filter((r) => r !== owner).slice(0, 3);

  const recRef = recs.length
    ? recs.slice(0, 3).map((r) => "سجل " + r.number + " «" + r.nameAr + "»").join(" · ")
    : "لا سجل مرتبط — يُستحدث ملف شواهد للمؤشر";
  const toolRef = items.length
    ? items.slice(0, 2).map((i) => i.tool + " فقرة " + i.n).join(" · ")
    : "الملاحظة الصفية وتحليل الوثائق";
  const gap = ind.externalScore == null ? "" :
    "الدرجة " + ind.externalScore.toFixed(1) + " · الفجوة " + (100 - ind.externalScore).toFixed(1) + " نقطة";

  /* ⚠️ كل مؤشّر بلا برنامج مركزي كان يبدأ في الأسبوع 3، فتكدّست الإجراءات:
     قِيس 35 إجراءً في 5 أسابيع من 38، وذروة 8 إجراءات في أسبوع واحد — خطة
     لا تُنفَّذ. تُوزَّع البدايات على النصف الأول من السنة بترتيب أولوية
     المؤشّر (الأضعف أولًا)، ويبقى للبرنامج المركزي أسبوعه إن حدّده. */
  const rank = ctx.rank ?? 0, cohort = Math.max(1, ctx.cohort ?? 1);
  const spread = Math.max(2, Math.floor(20 / cohort));
  const start = prog?.startWeek || Math.min(24, 3 + rank * spread);
  const span = prog?.durationWeeks || 8;
  const steps = (prog?.steps || []).filter(Boolean);

  const verify = verifyStatements(ctx.verify, ind.code);
  const rows = [];
  const push = (name, week, weeksSpan, method, requirements, evidence, notes) => rows.push({
    name, week, semester: semLabel(week), weeks: weeksLabel(week, weeksSpan),
    weekFrom: week, weekSpan: weeksSpan, method,
    target: prof.target, count: "الجميع", requirements,
    owner: roleAr(owner), support: rolesAr(supporters, roleAr) || "—",
    external: prof.external, evidence, notes,
    indicatorCode: ind.code, domain: ind.domainAr,
  });

  push("تشخيص فجوة المؤشر «" + (ind.textAr || "").replace(/\.$/, "") + "»",
    start, 1,
    "ورشة تحليل داخلية للجنة التميّز: قراءة درجة التقويم الخارجي وتحديد أسباب القصور وأولوياته.",
    "تقرير التقويم الخارجي 2025 · " + recRef,
    "محضر ورشة التشخيص موثَّق في " + (recs[0] ? "سجل " + recs[0].number : "سجل لجنة التميّز") +
      " مع جدول الأسباب والأولويات",
    gap);

  /* ⚠️ حيث توجد دلالات تحقّق رسمية، تُصبح هي مرجع «مؤشر التحقق» بدل صياغتنا —
     فالجدول يتكلّم بلغة المُقيِّم لا بلغتنا. */
  if (verify.length) {
    push("استيفاء دلالات التحقق الرسمية للمؤشر (" + verify.length + " دلالة)",
      start + 1, Math.max(4, span - 2),
      "مراجعة كل دلالة على حدة: ما المُستوفى وما الناقص، وتكليف مسؤول وشاهد لكل ناقص.",
      verify.map((v, i) => (i + 1) + ") " + v).join(" · "),
      verify.length + " دلالة مستوفاة ومثبتة بشاهدها في " +
        (recs[0] ? "سجل " + recs[0].number : "ملف شواهد المؤشر"),
      "هذه الدلالات هي ما يفتحه الزائر لهذا المؤشر");
  }

  push(prog ? "اعتماد " + prog.name : "اعتماد برنامج تحسيني للمؤشر " + ind.code,
    start + 1, 1,
    prog?.start || "عرض البرنامج على اللجنة الإدارية واعتماده بمحضر رسمي وتوزيع المهام والجدولة.",
    "خطة البرنامج · نموذج المحضر · " + recRef,
    "محضر اعتماد البرنامج + جدول المهام الموزّع على المسؤولين",
    prog ? "من بنك البرامج المركزي" : "برنامج مُستحدَث لهذا المؤشر");

  steps.slice(0, 4).forEach((st, i) => {
    push(st, start + 2 + i * Math.max(1, Math.floor(span / 6)), Math.max(2, Math.floor(span / 4)),
      "تنفيذ ميداني بمتابعة أسبوعية من المسؤول المباشر ورصد الشواهد أولًا بأول.",
      recRef,
      "شواهد التنفيذ (صور · كشوف حضور · نماذج) مرفوعة في " +
        (recs[0] ? "سجل " + recs[0].number : "ملف شواهد المؤشر"),
      "خطوة " + (i + 1) + " من " + steps.length);
  });

  if (recs.length) {
    push("تفعيل سجلات المؤشر " + ind.code + " وتوثيق شواهدها",
      start + 2, span,
      "تعبئة السجلات بانتظام حسب دورية كل سجل ورفع الشواهد داخل منظومة الاعتماد الخارجي.",
      recs.map((r) => "سجل " + r.number).join(" · "),
      recs.length + " سجلًا مكتمل التعبئة بشواهده: " + recRef,
      "هذه السجلات هي ما يفتحه الزائر لهذا المؤشر");
  }

  push("قياس أثر التحسين في المؤشر " + ind.code + " بأدوات التقويم الذاتي",
    start + span, 2,
    "تطبيق فقرات الأدوات التي تقيس المؤشر ومقارنة النتيجة بدرجة التقويم الخارجي.",
    toolRef,
    "نسبة تحقّق المؤشر في التقويم الذاتي مقارنةً بـ" +
      (ind.externalScore == null ? "الدرجة السابقة" : ind.externalScore.toFixed(1)),
    items.length ? items.length + " فقرة تقيس هذا المؤشر" : "لا فقرة مباشرة — يُقاس بتحليل الوثائق");

  push(prog?.review ? "التقويم الختامي: " + prog.review : "تقرير أثر التحسين ورفعه للجنة التميّز",
    Math.min(TOTAL_WEEKS, start + span + 3), 1,
    "إعداد تقرير أثر مدعوم بالشواهد وعرضه على اللجنة الإدارية وتحديد ما يُستدام وما يُعدَّل.",
    "نتائج القياس · الشواهد المجمّعة · " + recRef,
    verify.length
      ? "استيفاء " + verify.length + " دلالة تحقّق رسمية بشواهدها + تقرير أثر معتمَد بتوقيع المدير"
      : "تقرير الأثر معتمَد بتوقيع مدير المدرسة + جاهزية المؤشر لزيارة التقويم القادمة",
    "يُرفق بملف الاعتماد");

  return rows;
}

/* ⚠️ برامج نافس المعتمدة (RemedialProgramBank) كانت في جدول منفصل، فبدت
   الخطة التحسينية جدولين لا جدولًا. تُحوَّل هنا إلى **إجراءات بالأعمدة نفسها**
   وتُدمَج تحت مؤشراتها، فيرى الزائر جدولًا واحدًا يغطّي كل المؤشرات ومنها
   التحصيل الدراسي. */
function proceduresFromApprovedProgram(pr, ind, ctx) {
  const { roleAr } = ctx;
  /* ⚠️ كل برنامج معتمَد كان يبدأ في الأسبوع 3 ويُقيَّم في 14 — أرقام ثابتة،
     فتجمّع 15 إجراءً في أسبوع واحد. تُوزَّع حسب ترتيب البرنامج. */
  const pRank = ctx.progRank ?? 0, pCount = Math.max(1, ctx.progCount ?? 1);
  const step = Math.max(1, Math.floor(16 / pCount));
  const startW = Math.min(20, 3 + pRank * step);
  const reviewW = Math.min(TOTAL_WEEKS - 1, startW + 11);
  const prof = profileOf(ind?.domainAr);
  const recs = recordsForIndicator(ctx.records, ind?.code);
  const recRef = recs.length
    ? recs.slice(0, 3).map((r) => "سجل " + r.number + " «" + r.nameAr + "»").join(" · ")
    : "ملف شواهد البرنامج العلاجي";
  /* ⚠️ الافتراض الثابت «EDUCATIONAL_VP» ركّز 61 إجراءً من 71 على شخص واحد.
     المالك يُشتقّ من سجلات المؤشّر بالأغلبية كما في الإجراءات المولَّدة،
     ولا يُلجأ إلى دور البرنامج إلا حين لا سجل. */
  const tallyP = new Map();
  for (const r of recs) for (const role of (r.primaryRoles || []))
    tallyP.set(role, (tallyP.get(role) ?? 0) + 1);
  const owner = [...tallyP].sort((a, b) => b[1] - a[1])[0]?.[0]
             || (pr.start?.roles || [])[0] || "EDUCATIONAL_VP";
  const support = [...new Set([...(pr.start?.roles || []).slice(1), ...(pr.review?.roles || [])])]
    .filter((r) => r !== owner).slice(0, 3);
  const mk = (name, week, span, method, evidence, notes) => ({
    name, week, semester: week <= WEEKS_PER_SEMESTER ? "الأول" : "الثاني",
    weeks: weeksLabel(week, span), weekFrom: week, weekSpan: span, method,
    target: prof.target, count: "الجميع",
    requirements: (pr.start?.requirements || pr.description || "") + " · " + recRef,
    owner: roleAr(owner), support: support.map(roleAr).join("، ") || "—",
    external: prof.external, evidence, notes,
    indicatorCode: ind?.code, domain: ind?.domainAr, source: "برنامج معتمَد",
  });
  const out = [];
  if (pr.start?.text)
    out.push(mk("🚀 بَدء تطبيق " + pr.name, startW, 8, pr.start.text,
      pr.start.achievement || "شواهد بدء التطبيق موثَّقة في " + recRef,
      "برنامج علاجي معتمَد" + (pr.priorityScore ? " · أولوية " + pr.priorityScore : "")));
  if (pr.review?.text)
    out.push(mk("📋 تقييم " + pr.name, reviewW, 3, pr.review.text,
      pr.review.achievement || "تقرير أثر البرنامج معتمَدًا بتوقيع مدير المدرسة",
      "المرحلة الختامية للبرنامج"));
  if (!out.length)
    out.push(mk(pr.name, startW, 10, pr.description || "برنامج علاجي معتمَد.",
      "شواهد التنفيذ في " + recRef, "بلا مراحل معلنة"));
  return out;
}

/** كل إجراءات المدرسة: المؤشرات دون المستوى + برامج نافس المعتمدة، جدول واحد */
export function buildImprovementPlan(ctx) {
  const scores = ctx.indicatorScores || [];
  const byId = new Map(scores.map((x) => [x.indicatorId, x]));
  const groups = [];

  // الأضعف أولًا، ولكلٍّ رتبته ليُوزَّع بدؤه على السنة
  const weak = scores.filter((x) => x.isWeak)
    .slice().sort((a, b) => (a.externalScore ?? 999) - (b.externalScore ?? 999));
  weak.forEach((ind, i) => {
    groups.push({ indicator: ind, tag: indicatorTag(ind),
                  procedures: buildProcedures(ind, { ...ctx, rank: i, cohort: weak.length }) });
  });
  // البرامج المعتمدة تُلحَق بمؤشراتها، أو تُفتح مجموعة جديدة إن كان مؤشرها غير ضعيف
  const approved = ctx.approved || [];
  approved.forEach((pr, pi) => {
    const ind = byId.get(pr.indicatorId) || null;
    const rows = proceduresFromApprovedProgram(pr, ind,
      { ...ctx, progRank: pi, progCount: approved.length });
    const g = groups.find((x) => x.indicator?.indicatorId === pr.indicatorId);
    if (g) g.procedures.push(...rows);
    else groups.push({ indicator: ind, tag: ind ? indicatorTag(ind) : "برنامج علاجي",
                       approvedOnly: true, procedures: rows });
  });
  groups.sort((a, b) => (a.indicator?.externalScore ?? 999) - (b.indicator?.externalScore ?? 999));
  return { groups, totalProcedures: groups.reduce((a, g) => a + g.procedures.length, 0) };
}

/** مرآة التحسين: الإجراءات × الأسابيع — لا تحمل إلا ما يخصّ التحسين */
export function buildImprovementMirror(groups) {
  const rows = [];
  for (const g of groups) {
    for (const p of g.procedures) {
      const weeks = new Set();
      for (let i = 0; i < p.weekSpan; i++) {
        const w = p.weekFrom + i;
        if (w >= 1 && w <= TOTAL_WEEKS) weeks.add(w);
      }
      rows.push({ code: g.indicator?.code ?? "—", tag: g.tag, name: p.name,
                  owner: p.owner, source: p.source || "", weeks });
    }
  }
  return rows;
}
