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
  pending = { id, data, meta };
  clearTimeout(timer);
  timer = setTimeout(() => {
    const o = all();
    o[id] = { data, meta, at: Date.now() };
    // تنظيف ما تجاوز أسبوعين كي لا يتضخّم التخزين
    for (const [k, v] of Object.entries(o)) if (Date.now() - (v.at || 0) > MAX_AGE) delete o[k];
    put(o);
    pending = null;
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
  pending = null;
  clearTimeout(timer);
}

export const markSaved = () => { dirty = false; pending = null; clearTimeout(timer); };
/* ⚠️ المسوّدة المُستعادة **عملٌ غير محفوظ** بحكم تعريفها — فلولا هذا لغادر
   المستخدم بعد الاستعادة بلا سؤال، وظنّ أن ما يراه على الشاشة محفوظ. */
export const markDirty = () => { dirty = true; };
export const isDirty = () => dirty;

/** كل المسوّدات المعلّقة — لتُعرَض للمستخدم بدل أن تبقى مخبوءة */
export function pendingDrafts() {
  return Object.entries(all())
    .filter(([, v]) => Date.now() - (v.at || 0) <= MAX_AGE)
    .map(([id, v]) => ({ id, at: v.at, ...(v.meta || {}) }))
    .sort((a, b) => b.at - a.at);
}

/* ⚠️ لا يمنع المتصفّح الإغلاق، لكنه يسأل — وهذا كل ما تسمح به المتصفّحات.
   ولا يُسأل إلا إن كان هناك تغيير فعليّ غير محفوظ.
   ⚠️ وحده لا يكفي: **التنقّل داخل الموقع لا يمرّ بـbeforeunload إطلاقًا**،
   فالنقر على «سجلاتي» أو «الرئيسية» أو «خروج» كان يترك ما كُتب بلا سؤال ولا
   أثر في الشاشة. الحارس الحقيقي هو `guardLeave` أدناه. */
export function guardUnload() {
  window.addEventListener("beforeunload", (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
    return "";
  });
  /* ⚠️ الجوّال لا يُطلق beforeunload عند تبديل التطبيق ولا عند إغلاق التبويب —
     يُطلق `visibilitychange` وحده. فتُخزَّن المسوّدة فورًا حين تختفي الصفحة،
     بلا تأجيل، وإلّا ضاعت الثانية الأخيرة من الكتابة. */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushDraft();
  });
  window.addEventListener("pagehide", flushDraft);
}

/* يُفرِغ المؤجَّل حالًا — لا ينتظر الـ900 مللي */
let pending = null;
export function flushDraft() {
  if (!pending) return;
  clearTimeout(timer);
  const { id, data, meta } = pending;
  const o = all();
  o[id] = { data, meta, at: Date.now() };
  put(o);
  pending = null;
}

/* ── حارس المغادرة داخل الموقع ──
 * ⚠️ `confirm()` لا يكفي هنا: طلب المستخدم أن **يظهر زرُّ حفظ** لا سؤالٌ
 * بنعم/لا. فثلاثة خيارات صريحة: حفظٌ ثم متابعة، أو متابعةٌ بلا حفظ (والمسوّدة
 * تبقى محفوظة فلا شيء يضيع فعلًا)، أو بقاء. ولا يُسأل إن لم يكن هناك تغيير. */
let saver = null;
/** يُسجّل كيف يُحفظ ما في الشاشة الحالية — تضعه كل شاشة تُحرَّر */
export function setSaver(fn) { saver = fn; }

export function guardLeave(go, what = "ما أدخلتَه") {
  if (!dirty) { go(); return; }
  const box = document.createElement("div");
  box.className = "modal";
  box.innerHTML =
    '<div class="modal-card"><h2>لديك عملٌ لم يُحفظ</h2>' +
    '<div class="note sm">' + String(what) + " لم يُحفظ في مجلد مدرستك بعد. " +
    "<b>احفظه الآن</b> — أو غادر، فنسخةٌ مؤقّتة تبقى على هذا الجهاز وتُستعاد حين تعود.</div>" +
    '<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">' +
    '<button class="b-main" id="glSave">💾 حفظ ثم المتابعة</button>' +
    '<button class="b-ghost" id="glGo">المتابعة بلا حفظ</button>' +
    '<button class="b-ghost" id="glStay">البقاء هنا</button>' +
    '<span class="muted" id="glStat"></span></div></div>';
  document.body.append(box);
  const close = () => box.remove();
  box.querySelector("#glStay").onclick = close;
  box.onclick = (e) => { if (e.target === box) close(); };
  box.querySelector("#glGo").onclick = () => { flushDraft(); close(); go(); };
  box.querySelector("#glSave").onclick = async () => {
    const st = box.querySelector("#glStat");
    if (!saver) { st.textContent = "لا حفظ مباشر من هنا — استعمل زرّ الحفظ في الشاشة."; return; }
    st.textContent = "جارٍ الحفظ…";
    try { await saver(); close(); go(); }
    catch (e) { st.innerHTML = '<span class="err">تعذّر: ' + (e.message || e) + "</span>"; }
  };
}
