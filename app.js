import { FolderStore, HttpStore, safeName } from "./storage.js?v=d2f280f4";

export const ROLE_AR = {
  PRINCIPAL: "مدير المدرسة", EDUCATIONAL_VP: "وكيل الشؤون التعليمية",
  SCHOOL_AFFAIRS_VP: "وكيل الشؤون المدرسية", STUDENT_AFFAIRS_VP: "وكيل شؤون الطلاب",
  ACTIVITIES_LEADER: "رائد النشاط", STUDENT_COUNSELOR: "الموجه الطلابي",
  HEALTH_COUNSELOR: "الموجه الصحي", SAFETY_COORDINATOR: "منسق الأمن والسلامة",
  GIFTED_COORDINATOR: "منسق الموهوبين", MONITOR: "المراقب",
  ADMIN_ASSISTANT: "المساعد الإداري", DATA_ENTRY: "مُدخل البيانات",
  RECEPTIONIST: "موظف الاستقبال", RESOURCES_LIBRARIAN: "أمين مصادر التعلم",
  LAB_TECHNICIAN: "محضّر المختبر", SUBJECT_SUPERVISOR: "مشرف المادة",
  EXCELLENCE_COMMITTEE: "لجنة التميّز", SUPER_ADMIN: "المستشار",
};
export const FREQ_AR = {
  DAILY: "يومي", WEEKLY: "أسبوعي", MONTHLY: "شهري", PER_SEMESTER: "كل فصل",
  YEARLY: "سنوي", ANNUAL: "سنوي", PER_EVENT: "عند كل حدث",
  AS_NEEDED: "عند الحاجة", CONTINUOUS: "مستمر",
};
export const STAGE_AR = { KG: "رياض الأطفال", PRIMARY: "الابتدائية", MIDDLE: "المتوسطة", HIGH: "الثانوية" };

export const roleAr = (r) => ROLE_AR[r] || r || "—";
export const freqAr = (f) => FREQ_AR[f] || "—";

/** الترتيب الهرمي للأدوار — من أعلى المدرسة إلى أدناها */
export const ROLE_RANK = {
  PRINCIPAL: 1, EDUCATIONAL_VP: 2, SCHOOL_AFFAIRS_VP: 3, STUDENT_AFFAIRS_VP: 4,
  STUDENT_COUNSELOR: 5, ACTIVITIES_LEADER: 6, HEALTH_COUNSELOR: 7,
  GIFTED_COORDINATOR: 8, SAFETY_COORDINATOR: 9, SUBJECT_SUPERVISOR: 10,
  MONITOR: 11, ADMIN_ASSISTANT: 12, DATA_ENTRY: 13,
  RESOURCES_LIBRARIAN: 14, LAB_TECHNICIAN: 15, RECEPTIONIST: 16,
};
export const roleRank = (r) => ROLE_RANK[r] ?? 90;

/** يرتّب المنسوبين هرميًا، وعند تساوي الرتبة بالترتيب الأصلي */
export function sortHierarchy(people) {
  return [...people].sort((a, b) =>
    roleRank(a.role) - roleRank(b.role) || (a.orderNum ?? 0) - (b.orderNum ?? 0));
}

/* ⚠️ **مجلد المنسوب يُسمّى بالوظيفة لا بالاسم**. كان بالاسم، فلو استقال موظف
   أو نُقل وتغيّر الاسم لتغيّر المسار و**يُتِمَت ملفاته**. وبتسميته بالوظيفة
   ينتقل الملف كاملًا للموظف الجديد في نفس الوظيفة تلقائيًا — وهو عين ما يطلبه
   المستشار في حالات الاستقالة والنقل. والاسم يبقى داخل كل ملف لا في المسار. */
export function personFolder(person) {
  return "مخرجات/" + safeName((person.orderNum ?? 0) + " - " + roleAr(person.role));
}

/** السجلات التي يملكها الشخص: مسؤول أول، أو مشارك بالإدخال */
export function recordsFor(records, role) {
  const owned = records.filter((r) => (r.primaryRoles || []).includes(role));
  const shared = records.filter(
    (r) => !(r.primaryRoles || []).includes(role) && (r.dataEntryRoles || []).includes(role)
  );
  return { owned, shared };
}

/* ⚠️ أسماء ملفات الخطط تحمل **لام الجرّ ملتصقة**: «للموجه الطلابي» لا «الموجه
   الطلابي» · «للوكيل التعليمي» لا «وكيل الشؤون التعليمية». فالمطابقة باسم الدور
   المعروض تسقط صامتةً. الصواب: **جذر خالٍ من السوابق** لكل دور، ويحرسه
   scripts/check-plan-role-match.mjs على كل حزمة.                                */
export const PLAN_MATCH = {
  PRINCIPAL: ["مدير المدرسة"],
  EDUCATIONAL_VP: ["وكيل التعليمي", "الوكيل التعليمي", "وكيل الشؤون التعليمية"],
  SCHOOL_AFFAIRS_VP: ["وكيل الشؤون المدرسية"],
  STUDENT_AFFAIRS_VP: ["وكيل شؤون الطلاب"],
  STUDENT_COUNSELOR: ["موجه الطلابي", "الموجه الطلابي"],
  HEALTH_COUNSELOR: ["موجه الصحي", "الموجه الصحي"],
  ACTIVITIES_LEADER: ["رائد النشاط"],
  SAFETY_COORDINATOR: ["منسق الأمن والسلامة"],
  GIFTED_COORDINATOR: ["منسق الموهوبين"],
};

/** أدوار لا خطة تنفيذية لها بالتصميم — لا تُعدّ نقصًا */
export const ROLES_WITHOUT_PLAN = new Set([
  "MONITOR", "ADMIN_ASSISTANT", "DATA_ENTRY", "RECEPTIONIST",
  "RESOURCES_LIBRARIAN", "LAB_TECHNICIAN", "SUBJECT_SUPERVISOR",
]);

/** يزيل التشكيل والتطويل ويوحّد الألف والياء — قبل أي مقارنة نصّية عربية */
export function normalizeAr(text) {
  return String(text ?? "")
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/\s+/g, " ").trim();
}

/** ملف الخطة التنفيذية المطابق لدور الشخص من أسماء ملفات الحزمة المرجعية */
export function planFileFor(referencePlans, role) {
  const tokens = (PLAN_MATCH[role] ?? [roleAr(role)]).map(normalizeAr);
  for (const f of referencePlans) {
    const n = normalizeAr(f);
    if (tokens.some((t) => n.includes(t))) return f;
  }
  return null;
}

export function operationalPlanFile(referencePlans) {
  return referencePlans.find((f) => f.startsWith("الخطة التشغيلية")) || null;
}

/** يفتح المصدر: مجلد OneDrive في الإنتاج، أو HTTP في التطوير (?data=...) */
export async function openSource({ dataUrl } = {}) {
  if (dataUrl) return new HttpStore(dataUrl);
  const restored = await FolderStore.restore();
  return restored;
}

export async function loadBundle(store) {
  const [manifest, school, roster, records, tools, results, support, improvement, exec] = await Promise.all([
    store.readJson("manifest.json"),
    store.readJson("بيانات/school.json"),
    store.readJson("بيانات/roster.json"),
    store.readJson("بيانات/records.json"),
    store.readJson("بيانات/tools.json"),
    store.readJson("بيانات/results.json"),
    store.readJson("بيانات/support.json"),
    store.readJson("بيانات/تحسين.json"),
    store.readJson("بيانات/تنفيذية.json"),
  ]);
  return { manifest, school, roster, records, tools, results, support, improvement, exec };
}

/** إثبات مسار الكتابة: يُسجّل اتصال الشخص في مجلده */
export async function stampConnection(store, person) {
  const path = personFolder(person) + "/_الاتصال.json";
  let prior = null;
  if (await store.exists(path)) { try { prior = await store.readJson(path); } catch { /* تالف */ } }
  const entry = {
    person: person.fullName, role: person.role, roleAr: roleAr(person.role),
    lastConnectedAt: new Date().toISOString(),
    connections: (prior?.connections ?? 0) + 1,
    firstConnectedAt: prior?.firstConnectedAt ?? new Date().toISOString(),
  };
  await store.writeJson(path, entry);
  return entry;
}

/** مسار إدخالات سجل داخل مجلد الشخص */
export function entryPath(person, recordNumber, entryId) {
  return personFolder(person) + "/سجلات/" + recordNumber + "/" + entryId + ".json";
}
export function entryDir(person, recordNumber) {
  return personFolder(person) + "/سجلات/" + recordNumber;
}
export function evidenceDir(person, recordNumber, entryId) {
  return personFolder(person) + "/شواهد/" + recordNumber + "/" + entryId;
}
export function newEntryId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
         "_" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}

/** يعدّ إدخالات كل سجل عبر مجلدات جميع التنفيذيين — شواهد فعلية لتحليل الوثائق */
export async function countSavedRecords(store) {
  const counts = {};
  let people = [];
  try { people = await store.list("مخرجات"); } catch { return counts; }
  for (const p of people) {
    if (p.kind !== "directory") continue;
    let recs = [];
    try { recs = await store.list("مخرجات/" + p.name + "/سجلات"); } catch { continue; }
    for (const r of recs) {
      if (r.kind !== "directory") continue;
      try {
        const files = await store.list("مخرجات/" + p.name + "/سجلات/" + r.name);
        const n = files.filter((f) => f.name.endsWith(".json")).length;
        counts[Number(r.name)] = (counts[Number(r.name)] ?? 0) + n;
      } catch { /* مجلد فارغ */ }
    }
  }
  return counts;
}

/** يقرأ كل ردود أداة */
export async function loadToolResponses(store, key) {
  const out = [];
  let files = [];
  try { files = await store.list("تقويم ذاتي/" + key); } catch { return out; }
  for (const f of files) {
    if (f.kind === "directory" || !f.name.endsWith(".json")) continue;
    try { out.push(await store.readJson("تقويم ذاتي/" + key + "/" + f.name)); } catch { /* تالف */ }
  }
  return out;
}

/* ── طبقة تعديل المنسوبين: تُكتب في المجلد ولا تمسّ ما ولّدته جدارة ── */
export const ROSTER_OVERRIDE = "إدارة/الروستر.json";

export async function loadRosterOverride(store) {
  try {
    if (await store.exists(ROSTER_OVERRIDE)) return await store.readJson(ROSTER_OVERRIDE);
  } catch { /* أول مرة */ }
  return { people: {}, history: [] };
}

/** يدمج التعديلات على الروستر المولَّد — المصدر يبقى كما هو */
export function applyRosterOverride(people, ov) {
  return people.map((p) => {
    const o = ov?.people?.[p.id];
    return o ? { ...p, fullName: o.fullName ?? p.fullName, email: o.email ?? p.email,
                 employeeNo: o.employeeNo ?? p.employeeNo ?? null } : p;
  });
}

/** يسجّل تغيير شاغل الوظيفة ويحفظه — الملفات تبقى مكانها لأن المجلد بالوظيفة */
/* الروستر يعدّله المدير وقد يعدّله غيره — يُدمج على الأحدث لا على ما في الذاكرة */
export async function saveRosterEdit(store, person, next) {
  const now = new Date().toISOString();
  const prev = { fullName: person.fullName, email: person.email, employeeNo: person.employeeNo ?? null };
  const changed = prev.fullName !== next.fullName;
  return store.mutateJson(ROSTER_OVERRIDE, (ov) => {
    ov.people = ov.people || {};
    ov.history = ov.history || [];
    ov.people[person.id] = { ...next, updatedAt: now };
    if (changed) {
      ov.history.push({ at: now, role: person.role, folder: personFolder(person),
                        from: prev.fullName, to: next.fullName,
                        note: "انتقلت ملفات الوظيفة إلى الشاغل الجديد — المجلد لم يتغيّر" });
    }
    return ov;
  }, { people: {}, history: [] });
}

/* ── التوقيع المحفوظ: يُرسم مرّة ويُستدعى في كل موضع توقيع ──
   المسار بالوظيفة كالمجلدات، فينتقل مع الوظيفة لا مع الشخص — ويُستبدَل
   توقيع الشاغل الجديد عند تغييره. */
export const signaturePath = (person) =>
  "إدارة/تواقيع/" + safeName((person.orderNum ?? 0) + " - " + roleAr(person.role)) + ".json";

export async function loadSignature(store, person) {
  const path = signaturePath(person);
  try { if (await store.exists(path)) return await store.readJson(path); } catch {}
  return null;
}

export async function saveSignature(store, person, dataUrl) {
  const rec = { dataUrl, person: person.fullName, role: person.role,
                roleAr: roleAr(person.role), savedAt: new Date().toISOString() };
  await store.writeJson(signaturePath(person), rec);
  return rec;
}

/** خطتي التنفيذية المحرَّرة — تُحفظ في مجلد الوظيفة فتنتقل مع شاغلها */
export const execPlanPath = (person) => personFolder(person) + "/خطتي التنفيذية.json";
