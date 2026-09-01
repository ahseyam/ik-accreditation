/* التعبئة التلقائية — كل ما يمكن اشتقاقه لا يُطلَب من المستخدم.
   المصادر: بيانات المدرسة · الروستر · المعلمون والكادر · اللجان · الأسابيع
   الدراسية الـ38 · البرامج. والقاعدة: **لا نملأ إلا ما نعرفه يقينًا**، وما
   يُملأ تلقائيًا يُوسَم كي يعرف المستخدم أنه مشتقّ لا مكتوب.                */

/** الأسبوع الدراسي الحالي من تواريخ الأسابيع المُصدَّرة */
export function currentWeek(weeks, now = new Date()) {
  const t = now.getTime();
  for (const w of weeks || []) {
    const a = new Date(w.startDate).getTime();
    const b = new Date(w.endDate).getTime() + 86400000;
    if (t >= a && t < b) return w;
  }
  // خارج الأسابيع: أقرب أسبوع قادم، وإلا الأخير
  const next = (weeks || []).find((w) => new Date(w.startDate).getTime() > t);
  return next || (weeks || [])[weeks?.length - 1] || null;
}

export const semesterLabel = (w) => (w ? (w.semester === 1 ? "الفصل الأول" : "الفصل الثاني") : "");

const norm = (s) => String(s ?? "").replace(/[ً-ْـ]/g, "").replace(/\s+/g, " ").trim();
const has = (hay, ...needles) => needles.some((n) => norm(hay).includes(n));

/**
 * يُعيد القيمة المشتقّة لحقل، أو undefined إن لم تُعرَف.
 * المطابقة على المفتاح الإنجليزي أو العنوان العربي معًا.
 */
/* ⚠️ قواعد هوية الشخص (وظيفته، رقمه، بريده) تخصّ **الحقل المفرد** لا خلايا
   الجدول: عمود «المَنصب في اللجنة» مفتاحه `position` فكان يطابق /position/i
   ويُنسخ فيه «مدير المدرسة» — وظيفة من يفتح السجل — في كل صف من صفوف اللجنة.
   داخل الجداول تُعطَّل هذه القواعد، ويُبذَر العمود من عضوية اللجنة نفسها. */
const PERSON_SCOPED = /jobTitle|position|roleName|employeeNo|empNumber|email|preparedBy|recordedBy|writerName|ownerName/i;

export function derive(field, ctx, opts = {}) {
  if (opts.inTable && PERSON_SCOPED.test(String(field.key ?? field.id ?? ""))) return undefined;
  const k = String(field.key ?? field.id ?? "");
  const l = String(field.label ?? "");
  const S = ctx.school, W = ctx.week;
  const pick = (...v) => v.find((x) => x != null && x !== "");

  if (/schoolName/i.test(k) || has(l, "اسم المدرسة")) return S?.nameAr;
  if (/ministry|moeNumber|schoolNumber/i.test(k) || has(l, "الرقم الوزاري", "رقم المدرسة"))
    return S?.ministryNumber;
  if (/academicYear|schoolYear/i.test(k) || has(l, "العام الدراسي")) return S?.academicYear?.greg;
  if (/semester/i.test(k) || has(l, "الفصل الدراسي")) return semesterLabel(W);
  if (/weekNumber|weekNo/i.test(k) || has(l, "رقم الاسبوع", "الاسبوع الدراسي")) return W?.weekNumber;
  if (/city|region/i.test(k) || has(l, "المدينة", "المنطقة")) return S?.city;
  if (/stage|level/i.test(k) || has(l, "المرحلة الدراسية")) return ctx.stageAr;
  if (/studentCount|studentsCount/i.test(k) || has(l, "عدد الطلاب", "عدد المتعلمين"))
    return S?.studentCount || undefined;
  if (/classCount|classesCount/i.test(k) || has(l, "عدد الفصول")) return S?.classCount || undefined;
  if (/principal/i.test(k) || has(l, "مدير المدرسة", "اسم المدير"))
    return ctx.byRole?.PRINCIPAL?.fullName;
  if (/preparedBy|recordedBy|writerName|ownerName/i.test(k) ||
      has(l, "اسم المدون", "اسم المعد", "اسم المسجل", "اسم المسؤول"))
    return ctx.person?.fullName;
  if (/jobTitle|position|roleName/i.test(k) || has(l, "الوظيفة", "المسمى الوظيفي"))
    return ctx.roleAr;
  if (/employeeNo|empNumber/i.test(k) || has(l, "الرقم الوظيفي")) return ctx.person?.employeeNo;
  if (/email/i.test(k) || has(l, "البريد")) return ctx.person?.email;
  /* ⚠️ لا يُملأ كل حقل تاريخ بتاريخ اليوم: «تاريخ الجلسة القادمة» و«تاريخ
     الانتهاء» و«تاريخ الميلاد» ليست اليوم. يُملأ تاريخ التدوين وحده. */
  if (field.type === "DATE") {
    const forbidden = has(l, "القادم", "القادمة", "الانتهاء", "النهاية", "الميلاد",
                             "المتوقع", "التسليم", "الاستحقاق", "بداية", "نهاية", "من", "الى");
    const isEntryDate = /entryDate|recordDate|reportDate|todayDate/i.test(k) ||
      has(l, "تاريخ التدوين", "تاريخ الادخال", "تاريخ التقرير", "تاريخ الرصد", "التاريخ (تلقائي)");
    if (!forbidden && (isEntryDate || norm(l) === "التاريخ"))
      return pick(field.default, new Date().toISOString().slice(0, 10));
  }
  return undefined;
}

/** صفوف جاهزة لجداول يعرف النظام محتواها — أكبر موفّر للوقت */
/** منصب العضو في اللجنة كما في بيانات التشكيل — لا كوظيفته الإدارية */
export const COMMITTEE_POSITION_AR = {
  CHAIR: "رئيس اللجنة",
  VICE_CHAIR: "نائب رئيس اللجنة",
  DEPUTY: "نائب رئيس اللجنة",
  SECRETARY: "مُقَرِّر اللجنة",
  RAPPORTEUR: "مُقَرِّر اللجنة",
  COORDINATOR: "مُنسِّق اللجنة",
  MEMBER: "عُضو",
};
export const committeePositionAr = (v) =>
  COMMITTEE_POSITION_AR[String(v ?? "").toUpperCase()] ?? (v ? String(v) : "عُضو");

export function seedRows(field, ctx) {
  const cols = field.columns || [];
  const colKey = (re) => cols.find((c) => re.test(String(c.key ?? "")) || re.test(String(c.label ?? "")));
  const teacherCol = colKey(/teacher|معلم/i);
  const memberCol = colKey(/member|عضو|الاسم/i);
  const roleCol = colKey(/role|الوظيفة|الصفة/i);

  if (teacherCol && (ctx.teachers || []).length) {
    return ctx.teachers.map((t) => {
      const row = { [teacherCol.key]: t.fullName };
      const spec = colKey(/subject|تخصص|مادة/i);
      if (spec) row[spec.key] = t.specialization || "";
      return row;
    });
  }
  if (memberCol && roleCol && (ctx.committeeMembers || []).length) {
    return ctx.committeeMembers.map((m) => ({
      [memberCol.key]: m.fullName || "", [roleCol.key]: ctx.roleArFn(m.role),
    }));
  }
  return null;
}

/** يبني سياق التعبئة مرّة واحدة لكل سجل */
export function fillContext(bundle, me, roleArFn, stageAr) {
  const byRole = {};
  for (const p of bundle.roster.people) if (!byRole[p.role]) byRole[p.role] = p;
  const exc = (bundle.support?.committees || []).find((c) => c.key === "EXCELLENCE");
  return {
    school: bundle.school, person: me, roleAr: roleArFn(me.role), roleArFn, stageAr,
    byRole, week: currentWeek(bundle.support?.weeks),
    teachers: bundle.support?.teachers || [],
    staff: bundle.support?.staff || [],
    committeeMembers: exc?.members || [],
  };
}
