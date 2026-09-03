/* الحالة المشتركة وأدوات العرض — أساس تفكيك index.html إلى وحدات.
   ⚠️ الشيفرة كانت 1102 سطرًا مضمَّنة في صفحة واحدة، والترقيع الأعمى فيها
   ولّد أعطالًا فعلية. الحالة هنا **كائن واحد قابل للتغيير** تشترك فيه الوحدات
   بدل مغلّفات (closures) لا تُرى من خارج الملف. */

export const S = {
  store: null, bundle: null, me: null,
  roster: [], rosterOv: null, mySignature: null,
  settings: {}, keeper: null,
  myRecords: [], myTools: [],
  activeScreen: "screenGate",
};

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const show = (id, on) => $(id).classList.toggle("hidden", !on);

export const SCREENS = ["screenGate", "screenConnect", "screenWho", "screenDash", "screenGuide", "screenRecords",
  "screenRecord", "screenTools", "screenTool", "screenImp", "screenPlans",
  "screenVault", "screenExec", "screenReady"];

export const SCREEN_TITLE = {
  screenGuide: "كيف تعمل على الموقع", screenDash: "لوحة المستخدم", screenRecords: "سجلاتي", screenRecord: "سجل",
  screenTools: "أدوات دورة التقويم الذاتي", screenTool: "أداة تقويم",
  screenImp: "الخطة التحسينية", screenPlans: "الخطط المرجعية",
  screenWho: "منسوبو المدرسة", screenVault: "مستودع المدرسة",
  screenExec: "خطتي التنفيذية", screenReady: "جاهزية الزيارة",
};

/** يُظهر شاشة واحدة ويخفي البقية، ويضبط أزرار الهيدر تبعًا لها */
export function only(id) {
  for (const s of SCREENS) show(s, s === id);
  S.activeScreen = id;
  /* خُطّاف يلتقطه index.html ليحفظ الجلسة — ui-state لا تعرف المدرسة ولا الدور */
  if (typeof S.onScreen === "function") { try { S.onScreen(id); } catch { /* لا يُعطّل التنقّل */ } }
  const ready = !!(S.store && S.bundle && S.me);
  show("printPage", ready && !!SCREEN_TITLE[id]);
  show("homeBtn", ready && id !== "screenDash");
  /* «خروج» يظهر متى وُجد مستخدم — بما في ذلك شاشة اللوحة نفسها، فهي أوّل
     موضعٍ يريد المستخدم الخروج منه. ويختفي في «من أنت» لأنه لا جلسة بعد. */
  show("logoutBtn", !!(S.store && S.bundle && S.me) && id !== "screenWho");
  show("navToggle", ready);
}

export function markNav(id) {
  $("navMenu").querySelectorAll("a").forEach((a) => a.classList.toggle("on", a.dataset.nav === id));
}

/** شريط الحالة السفلي */
export function setStatus(text) {
  $("statusText").textContent = text;
  show("status", true);
}
