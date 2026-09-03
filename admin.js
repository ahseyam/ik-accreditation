/* ── لوحة إدارة المنصّة — لمدير الجودة والتخطيط وحده ──
 *
 * ⚠️ **ما تفعله هذه اللوحة وما لا تفعله.** تقرأ الأربعين مجلدًا من مجلدك
 * الجذر، وتكتب فيها اعتمادك لبيانات المنسوبين. أمّا **منح صلاحية OneDrive
 * فلا تفعله ولا تستطيعه**: منح الصلاحية عمليةٌ عند مايكروسوفت تحتاج تسجيل
 * تطبيق في Azure، وهو محجوبٌ في هذا النطاق. فالاعتماد هنا يُنتج **أمر
 * المشاركة جاهزًا** — المجلد والبريد وزرّ نسخ — ويتتبّع ما شاركتَ وما لم
 * تشاركه بعد. ولا يُسمّى في أي موضع «ربطًا تلقائيًّا»، فالاسم الكاذب أسوأ
 * من الخطوة اليدوية.
 *
 * ⚠️ **البنية متداخلة**: مجمع/مسار/مرحلة — جنس. والماسح القديم كان يقرأ
 * الأبناء المباشرين فيرى أربعة مجمّعات ويظنّها أربع مدارس. فالمشي هنا
 * تعاودي حتى يُعثر على `manifest.json`.
 */
import { FolderStore } from "./storage.js?v=461ca160";
import { roleAr, ROLE_RANK, loadRosterOverride, ROSTER_OVERRIDE } from "./app.js?v=461ca160";

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const PERMS = "إدارة/الصلاحيات.json";
/** من يحتاج صلاحية تحرير على مجلد المدرسة — وهما اثنان لا أكثر */
export const EDIT_ROLES = ["EDUCATIONAL_VP", "QUALITY_COORDINATOR"];

const isPlaceholder = (p) => /^\s*\[.*\]\s*$/.test(String(p?.fullName || ""));

/** مشيٌ تعاودي حتى `manifest.json` — البنية أربع طبقات لا واحدة.
 *
 * ⚠️ **يُبلّغ بما رأى.** أوّل نسخةٍ كانت تعود بقائمة فارغة فتقول «لم أجد
 * مدارس» ولا تقول ما الذي وجدته — فلا يُشخَّص العطل لا من المستخدم ولا منّي.
 * الآن يجمع أثر المشي: كم مجلدًا فتح، وما أسماء أوّل ما رأى، وأين تعذّرت
 * القراءة. والرسالة تعرضها.
 *
 * ⚠️ ومجلدٌ واحدٌ لا يُقرأ لا يُسقط المسح كلّه: كل فرعٍ في try مستقلّ. */
export async function findSchools(root, onStep, depth = 0, trail = [], trace = null) {
  const T = trace || { dirs: 0, top: [], errors: [], deepest: 0, maxDepth: 6 };
  const out = [];
  if (depth > T.maxDepth) return out;
  T.dirs++; if (depth > T.deepest) T.deepest = depth;
  let hasManifest = false;
  const subs = [];
  try {
    for await (const [name, h] of root.entries()) {
      if (name === "manifest.json") hasManifest = true;
      else if (h.kind === "directory" && !name.startsWith(".")) subs.push({ name, h });
    }
  } catch (e) {
    T.errors.push((trail.join("/") || root.name || "الجذر") + ": " + (e.message || e.name));
    return out;
  }
  if (depth === 0) T.top = subs.map((s) => s.name).slice(0, 12);
  if (hasManifest) { onStep?.(trail.join(" / ")); return [{ handle: root, trail: [...trail] }]; }
  subs.sort((a, b) => a.name.localeCompare(b.name, "ar"));
  for (const s of subs) out.push(...await findSchools(s.h, onStep, depth + 1, [...trail, s.name], T));
  if (depth === 0) out.trace = T;
  return out;
}

/** آخر نشاط فعلي في المجلد — أحدث ملفٍ كتبته المدرسة، لا تاريخ التوليد */
async function lastActivity(store) {
  let latest = null, entries = 0, evidence = 0;
  const walk = async (rel, depth = 0) => {
    if (depth > 5) return;
    let list = [];
    try { list = await store.list(rel); } catch { return; }
    for (const e of list) {
      const p = rel + "/" + e.name;
      if (e.kind === "directory") { await walk(p, depth + 1); continue; }
      if (/\/شواهد\//.test(p)) evidence++;
      else if (/\/سجلات\/.*\.json$/.test(p)) {
        entries++;
        const m = e.name.match(/^(\d{4}-\d{2}-\d{2})/);
        if (m && (!latest || m[1] > latest)) latest = m[1];
      }
    }
  };
  await walk("مخرجات");
  return { latest, entries, evidence };
}

/** حالة مدرسة واحدة — تُقرأ من مجلدها لا من ذاكرتنا */
export async function readSchool(handle, trail) {
  const store = new FolderStore(handle);
  const [manifest, school, roster] = await Promise.all([
    store.readJson("manifest.json"),
    store.readJson("بيانات/school.json"),
    store.readJson("بيانات/roster.json"),
  ]);
  const ov = await loadRosterOverride(store);
  let perms = { shared: {} };
  try { if (await store.exists(PERMS)) perms = await store.readJson(PERMS); } catch { /* أوّل مرّة */ }

  const people = roster.people.map((p) => {
    const o = ov?.people?.[p.id] || null;
    const fullName = o?.fullName ?? p.fullName;
    return {
      id: p.id, role: p.role, roleAr: roleAr(p.role), orderNum: p.orderNum,
      fullName, email: o?.email ?? p.email ?? null, employeeNo: o?.employeeNo ?? null,
      placeholder: isPlaceholder({ fullName }),
      submittedAt: o?.updatedAt ?? null,          // أدخلتها المدرسة
      approvedAt: o?.approvedAt ?? null,          // اعتمدتَها أنت
      sharedAt: perms?.shared?.[p.id]?.at ?? null, // ومُنحت الصلاحية
    };
  }).sort((a, b) => (ROLE_RANK[a.role] ?? 90) - (ROLE_RANK[b.role] ?? 90) || a.orderNum - b.orderNum);

  const act = await lastActivity(store);
  const pending = people.filter((p) => p.submittedAt && !p.approvedAt);
  const needShare = people.filter((p) => EDIT_ROLES.includes(p.role) && p.approvedAt && !p.sharedAt && p.email);

  return {
    handle, store, trail,
    school: school.nameAr,
    complex: trail[0] ?? "—", track: trail[1] ?? manifest.track ?? "—",
    stageGender: trail[2] ?? "—",
    stage: school.stage, people,
    missing: people.filter((p) => p.placeholder).length,
    pending, needShare,
    entries: act.entries, evidence: act.evidence, last: act.latest,
    active: act.entries > 0,
  };
}

/** يعتمد شخصًا: يُكتب الاعتماد في مجلد المدرسة نفسه — لا في جهازي */
export async function approve(row, personId, by) {
  const now = new Date().toISOString();
  await row.store.mutateJson(ROSTER_OVERRIDE, (ov) => {
    ov.people = ov.people || {};
    const cur = ov.people[personId];
    if (!cur) return ov;                       // لا يُعتمد ما لم تُدخله المدرسة
    ov.people[personId] = { ...cur, approvedAt: now, approvedBy: by };
    ov.history = ov.history || [];
    ov.history.push({ at: now, note: "اعتمد مدير الجودة والتخطيط بيانات هذه الوظيفة", by });
    return ov;
  }, { people: {}, history: [] });
  const p = row.people.find((x) => x.id === personId);
  if (p) p.approvedAt = now;
}

/** يُسجّل أنك منحتَ الصلاحية فعلًا في OneDrive — تسجيلٌ لا منح */
export async function markShared(row, personId, by) {
  const now = new Date().toISOString();
  await row.store.mutateJson(PERMS, (d) => {
    d.shared = d.shared || {};
    d.shared[personId] = { at: now, by };
    return d;
  }, { shared: {} });
  const p = row.people.find((x) => x.id === personId);
  if (p) p.sharedAt = now;
}

export async function unmarkShared(row, personId) {
  await row.store.mutateJson(PERMS, (d) => {
    if (d.shared) delete d.shared[personId];
    return d;
  }, { shared: {} });
  const p = row.people.find((x) => x.id === personId);
  if (p) p.sharedAt = null;
}
