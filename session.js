/* ── ذاكرة الجلسة ──
   ⚠️ كان تحديث الصفحة يعيد المستخدم إلى «من أنت؟»: يفقد وظيفته والشاشة
   التي كان فيها، فيعيد الاختيار في كل مرّة — وقد يغلق التبويب ظنًّا أن
   عمله ضاع. تُحفَظ الجلسة بالوظيفة لا بالاسم (فالملفات مرتبطة بالوظيفة)،
   ومقيَّدة بالمدرسة كي لا تتسرّب بين مجلدين. */

const KEY = "ik-session";
const MAX_AGE = 1000 * 60 * 60 * 12;      // نصف يوم ثم يُسأل من جديد

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
};

export function saveSession(school, role, screen, extra = {}) {
  if (!school || !role) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ school, role, screen, ...extra, at: Date.now() }));
  } catch { /* ممتلئ */ }
}

/** لا تُستعاد جلسة مدرسةٍ أخرى ولا جلسةٌ قديمة */
export function loadSession(school) {
  const s = read();
  if (!s || s.school !== school) return null;
  if (Date.now() - (s.at || 0) > MAX_AGE) return null;
  return s;
}

export function clearSession() {
  try { localStorage.removeItem(KEY); } catch { /* لا شيء */ }
}

/** الشاشات التي يصحّ الرجوع إليها — لا تُستعاد شاشة تحتاج سياقًا زال */
const RESUMABLE = new Set(["screenDash", "screenRecords", "screenTools",
                           "screenImp", "screenReady", "screenPlans",
                           "screenVault", "screenExec", "screenGuide"]);
export const canResume = (screen) => RESUMABLE.has(screen);
