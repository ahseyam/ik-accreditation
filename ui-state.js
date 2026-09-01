/* الحالة المشتركة وأدوات العرض — أساس تفكيك index.html إلى وحدات.
   ⚠️ الشيفرة كانت 1102 سطرًا مضمَّنة في صفحة واحدة، والترقيع الأعمى فيها
   ولّد أعطالًا فعلية. الحالة هنا **كائن واحد قابل للتغيير** تشترك فيه الوحدات
   بدل مغلّفات (closures) لا تُرى من خارج الملف. */

export const S = {
  store: null, bundle: null, me: null,
  roster: [], rosterOv: null, mySignature: null,
  settings: {}, keeper: null,
  myRecords: [], myTools: [],
  activeScreen: "screenConnect",
};

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const show = (id, on) => $(id).classList.toggle("hidden", !on);

export const SCREENS = ["screenConnect", "screenWho", "screenDash", "screenRecords",
  "screenRecord", "screenTools", "screenTool", "screenImp", "screenPlans",
  "screenVault", "screenExec", "screenReady"];

export const SCREEN_TITLE = {
  screenDash: "لوحة المستخدم", screenRecords: "سجلاتي", screenRecord: "سجل",
  screenTools: "أدوات دورة التقويم الذاتي", screenTool: "أداة تقويم",
  screenImp: "الخطة التحسينية", screenPlans: "الخطط المرجعية",
  screenWho: "منسوبو المدرسة", screenVault: "مستودع المدرسة",
  screenExec: "خطتي التنفيذية", screenReady: "جاهزية الزيارة",
};

/** يُظهر شاشة واحدة ويخفي البقية، ويضبط أزرار الهيدر تبعًا لها */
export function only(id) {
  for (const s of SCREENS) show(s, s === id);
  S.activeScreen = id;
  const ready = !!(S.store && S.bundle && S.me);
  show("printPage", ready && !!SCREEN_TITLE[id]);
  show("homeBtn", ready && id !== "screenDash");
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
