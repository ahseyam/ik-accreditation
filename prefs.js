/* ── تفضيلات المستخدم: السِّمة وحجم الخط ──
   حالة صغيرة مستقلّة تمامًا: لا تعرف المدرسة ولا المستخدم ولا المجلد.
   أُخرجت من index.html أوّلًا لأنها الأقلّ ارتباطًا — التفكيك يبدأ من
   الأطراف لا من القلب. */
import { $ } from "./ui-state.js?v=4dd3cd8b";

const KEY = "ik-prefs";
export const PREF = { theme: "auto", scale: 100 };

export const THEME_AR = { auto: "حسب النظام", light: "نهاري", dark: "ليلي" };
export const nextTheme = (t) => ({ auto: "light", light: "dark", dark: "auto" })[t] || "auto";

export function applyPrefs() {
  const dark = PREF.theme === "dark" ||
    (PREF.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document.documentElement.style.fontSize = (PREF.scale / 100 * 16).toFixed(1) + "px";
  const b = $("themeBtn");
  if (b) {
    b.textContent = dark ? "☀️" : "🌙";
    b.title = dark ? "الوضع النهاري" : "الوضع الليلي";
  }
  return dark;
}

export function loadPrefs() {
  try { Object.assign(PREF, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* أوّل مرّة */ }
  applyPrefs();
}

export function savePrefs() {
  try { localStorage.setItem(KEY, JSON.stringify(PREF)); } catch { /* وضع خاص */ }
  applyPrefs();
}

/** حدود مقصودة: أقلّ من 80% لا يُقرأ، وأكثر من 140% يكسر الجداول */
export const zoomIn = () => { PREF.scale = Math.min(140, PREF.scale + 10); savePrefs(); };
export const zoomOut = () => { PREF.scale = Math.max(80, PREF.scale - 10); savePrefs(); };
export const toggleTheme = () => {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  PREF.theme = dark ? "light" : "dark";
  savePrefs();
};
export const cycleTheme = () => { PREF.theme = nextTheme(PREF.theme); savePrefs(); };

/** يربط زرّ السِّمة ويستجيب لتغيّر سِمة النظام */
export function initPrefs() {
  loadPrefs();
  const b = $("themeBtn");
  if (b) b.onclick = toggleTheme;
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyPrefs);
}
