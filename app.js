import { FolderStore, HttpStore, safeName } from "./storage.js";

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

/** مجلد التنفيذي داخل الحزمة — ثابت عبر الجلسات */
export function personFolder(person) {
  return "مخرجات/" + safeName((person.orderNum ?? 0) + " - " + (person.fullName || roleAr(person.role)));
}

/** السجلات التي يملكها الشخص: مسؤول أول، أو مشارك بالإدخال */
export function recordsFor(records, role) {
  const owned = records.filter((r) => (r.primaryRoles || []).includes(role));
  const shared = records.filter(
    (r) => !(r.primaryRoles || []).includes(role) && (r.dataEntryRoles || []).includes(role)
  );
  return { owned, shared };
}

/** ملف الخطة التنفيذية المطابق لدور الشخص من أسماء ملفات الحزمة المرجعية */
export function planFileFor(referencePlans, role) {
  const needle = roleAr(role);
  return referencePlans.find((f) => f.includes(needle)) || null;
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
  const [manifest, school, roster, records, tools, results, support, improvement] = await Promise.all([
    store.readJson("manifest.json"),
    store.readJson("بيانات/school.json"),
    store.readJson("بيانات/roster.json"),
    store.readJson("بيانات/records.json"),
    store.readJson("بيانات/tools.json"),
    store.readJson("بيانات/results.json"),
    store.readJson("بيانات/support.json"),
    store.readJson("بيانات/تحسين.json"),
  ]);
  return { manifest, school, roster, records, tools, results, support, improvement };
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
