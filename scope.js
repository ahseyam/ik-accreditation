/* تخصيص المحتوى بالوظيفة — لا يرى المستخدم إلا ما يخصّه.
   ⚠️ المصدر لا يحمل إسناد الأدوات للأدوار (كلها audience=EVALUATOR أي لجنة
   التميّز)، فالإسناد أدناه **قرار المستشار** مشتقّ من مجال كل أداة، ويقابله
   عضوية اللجنة الفعلية في الحزمة. المدير يرى كل شيء دائمًا.               */

export const TOOL_OWNER = {
  CLASSROOM_OBSERVATION: ["EDUCATIONAL_VP"],
  SCHOOL_ENVIRONMENT_OBSERVATION: ["SCHOOL_AFFAIRS_VP"],
  TEACHER_SURVEY: ["EDUCATIONAL_VP"],
  TEACHER_INTERVIEW: ["EDUCATIONAL_VP"],
  STUDENT_SURVEY: ["STUDENT_AFFAIRS_VP"],
  STUDENT_INTERVIEW: ["STUDENT_AFFAIRS_VP"],
  PARENT_SURVEY: ["STUDENT_COUNSELOR"],
  COUNSELOR_INTERVIEW: ["PRINCIPAL"],
  PRINCIPAL_INTERVIEW: ["EDUCATIONAL_VP"],
  DOCUMENT_ANALYSIS: ["PRINCIPAL", "EDUCATIONAL_VP"],
  // أداة التحقق من الشواهد: مسؤولية لجنة التميّز بقيادة المدير ووكيله
  EVIDENCE_VERIFICATION: ["PRINCIPAL", "EDUCATIONAL_VP"],
};

/** الأدوار التي ترى كل الأدوات.
 *
 * ⚠️ **منسق الجودة كان يُؤمَر بما لا يستطيع فتحه.** له 29 مهمّة نصُّها «تنسيق
 * تطبيق استبانة المتعلم» و«متابعة شواهد البرنامج» و«جرد شواهد المؤشرات الـ47»،
 * وكانت شاشة الأدوات تعرض له **صفرًا**، ولا خطة تحسينية، ولا جاهزية. أي أن
 * ثلثي مهامّه تشير إلى أبوابٍ مغلقة. وهو منسّق دورة التقويم الذاتي بحكم اسمه
 * ومهامّه، فيرى الأدوات كلها كما يراها المدير. */
export const OVERSEER_ROLES = new Set(["PRINCIPAL", "QUALITY_COORDINATOR"]);

/** أعضاء لجنة التميّز في هذه المدرسة — من بيانات الحزمة لا من فرض */
export function excellenceRoles(support) {
  const c = (support?.committees ?? []).find((x) => x.key === "EXCELLENCE");
  return new Set((c?.members ?? []).map((m) => m.role).filter(Boolean));
}

/** ماذا يرى صاحب هذا الدور من الأدوات؟ */
export function scopeTools(tools, role, support) {
  const committee = excellenceRoles(support);
  const overseer = OVERSEER_ROLES.has(role);
  return tools.map((t) => {
    const owners = TOOL_OWNER[t.key] ?? [];
    const mine = owners.includes(role);
    const inCommittee = committee.has(role);
    return {
      tool: t, mine,
      visible: overseer || mine || inCommittee,
      // الوسم يقول «مسندة إليك»، فلا يكرّره السبب
      reason: mine ? "أنت المسؤول عن إجرائها"
            : overseer ? "بصفتك مدير المدرسة"
            : inCommittee ? "بعضويتك في لجنة التميّز" : "",
    };
  });
}

/** ⚠️ الخطة التحسينية **لمدير المدرسة ووكلائه** حصرًا — قرار المستشار.
    ومنسق الجودة معهم: مهامّه تتبع برامج هذه الخطة بالاسم. */
export const IMPROVEMENT_ROLES = new Set([
  "PRINCIPAL", "EDUCATIONAL_VP", "SCHOOL_AFFAIRS_VP", "STUDENT_AFFAIRS_VP",
  "QUALITY_COORDINATOR",
]);
export function canSeeImprovement(role) {
  return IMPROVEMENT_ROLES.has(role);
}
