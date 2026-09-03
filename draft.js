/* ── حارس المسوّدات: ما لم يُحفظ لا يضيع ──
   ⚠️ لا حفظ تلقائي في المنظومة: من كتب ساعةً ثم أغلق التبويب فقد كل شيء،
   ولا شيء ينبّهه. وفي وضع الحقيبة أخطر: الإدخالات في ذاكرة الصفحة، فإغلاق
   المتصفّح على الجوّال يمحوها.
   العلاج طبقتان: مسوّدة في تخزين الجهاز تُكتب أثناء الكتابة وتُستعاد عند
   العودة، وتحذير صريح قبل المغادرة. ولا تحلّ المسوّدة محلّ الحفظ — بل
   تمنع الضياع بين ضغطتين. */

const KEY = "ik-draft";
const MAX_AGE = 1000 * 60 * 60 * 24 * 14;   // أسبوعان ثم تُنسى

const all = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
};
const put = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* ممتلئ */ } };

export const draftId = (school, role, recordNumber, entryId) =>
  [school, role, recordNumber, entryId].join("|");

/** يُكتب أثناء الكتابة — مؤجَّلًا كي لا يُثقل الإدخال */
let timer = null, dirty = false;
export function saveDraft(id, data, meta = {}) {
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const o = all();
    o[id] = { data, meta, at: Date.now() };
    // تنظيف ما تجاوز أسبوعين كي لا يتضخّم التخزين
    for (const [k, v] of Object.entries(o)) if (Date.now() - (v.at || 0) > MAX_AGE) delete o[k];
    put(o);
  }, 900);
}

export function loadDraft(id) {
  const d = all()[id];
  return d && Date.now() - (d.at || 0) <= MAX_AGE ? d : null;
}

export function clearDraft(id) {
  const o = all();
  if (o[id]) { delete o[id]; put(o); }
  dirty = false;
  clearTimeout(timer);
}

export const markSaved = () => { dirty = false; clearTimeout(timer); };
export const isDirty = () => dirty;

/** كل المسوّدات المعلّقة — لتُعرَض للمستخدم بدل أن تبقى مخبوءة */
export function pendingDrafts() {
  return Object.entries(all())
    .filter(([, v]) => Date.now() - (v.at || 0) <= MAX_AGE)
    .map(([id, v]) => ({ id, at: v.at, ...(v.meta || {}) }))
    .sort((a, b) => b.at - a.at);
}

/* ⚠️ لا يمنع المتصفّح الإغلاق، لكنه يسأل — وهذا كل ما تسمح به المتصفّحات.
   ولا يُسأل إلا إن كان هناك تغيير فعليّ غير محفوظ. */
export function guardUnload() {
  window.addEventListener("beforeunload", (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
    return "";
  });
}
