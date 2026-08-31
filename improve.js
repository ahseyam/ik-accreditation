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

  const owner = prog?.roles?.[0] || recs[0]?.primaryRoles?.[0] || "PRINCIPAL";
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

  const start = prog?.startWeek || 3;
  const span = prog?.durationWeeks || 8;
  const steps = (prog?.steps || []).filter(Boolean);

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
    push("تفعيل السجلات المرتبطة بالمؤشر وتوثيق شواهدها",
      start + 2, span,
      "تعبئة السجلات بانتظام حسب دورية كل سجل ورفع الشواهد داخل منظومة الاعتماد الخارجي.",
      recs.map((r) => "سجل " + r.number).join(" · "),
      recs.length + " سجلًا مكتمل التعبئة بشواهده: " + recRef,
      "هذه السجلات هي ما يفتحه الزائر لهذا المؤشر");
  }

  push("قياس الأثر بأدوات التقويم الذاتي",
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
    "تقرير الأثر معتمَد بتوقيع مدير المدرسة + جاهزية المؤشر لزيارة التقويم القادمة",
    "يُرفق بملف الاعتماد");

  return rows;
}

/** كل إجراءات المدرسة: للمؤشرات دون المستوى، مرتّبة من الأدنى درجةً */
export function buildImprovementPlan(ctx) {
  const weak = (ctx.indicatorScores || []).filter((x) => x.isWeak);
  const groups = weak.map((ind) => ({ indicator: ind, procedures: buildProcedures(ind, ctx) }));
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
      rows.push({ code: g.indicator.code, name: p.name, owner: p.owner, weeks });
    }
  }
  return rows;
}
