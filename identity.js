/* ── هوية القشرة ──
 *
 * الشعاران والعنوان وفهرس المدارس كانت **مكتوبة في القشرة نفسها**، فكلّ من
 * يفتحها يرى اسم شركةٍ وشعارَين لا يخصّانه — ومنهم منسوبو مدارس قادة الأمة،
 * وهي لا تتبع أيًّا منهما. رصده المستشار على الشاشة (٢٢ سبتمبر ٢٠٢٦).
 *
 * فصارت الهوية **بيانات لا شيفرة**: ملفُّ `هوية.json` بجوار `index.html`،
 * والصفحة تحمل مرابط `data-brand` فارغةً تُملأ منه:
 *   { group, orgFull, title, logo, logoAlt, secondLogo, secondLogoAlt,
 *     building, favicon, schoolsFile }
 *
 * ⚠️ **لا اسمَ جهةٍ في هذا الملف ولا في الصفحة**: لو بقي اسمٌ افتراضيًّا هنا
 *    لسافر مع كلّ نسخةٍ تُبنى لجهةٍ أخرى. وحارسُ `build-qadat-shell.py` يفحص
 *    المخرَج سطرًا سطرًا ويُسقط البناء إن وجد اسمًا — وقد أسقطه فعلًا قبل هذا
 *    التعديل، فالكاشف مُجرَّبٌ على عيبٍ معلوم.
 * ⚠️ ولا يُنسَخ مجلد القشرة يدويًّا لكل جهة: النسخة تُبنى بسكربت من هذا المصدر،
 *    وإلّا صار لكل جهة شيفرةٌ تتخلّف عن الأخرى عند أوّل إصلاح.
 */

/** لا هوية بلا ملف — قيمٌ محايدة تُبقي الصفحة قائمةً لا أكثر */
const FALLBACK = {
  group: "", orgFull: "", title: "الاعتماد الخارجي",
  logo: "", logoAlt: "", secondLogo: null, secondLogoAlt: "",
  building: "", favicon: "", schoolsFile: "مدارس.json",
  crumbTail: "السجلات والشواهد للتقويم الخارجي",
};

export let IDENT = { ...FALLBACK };

/** يقرأ `هوية.json` ويركّبه على الصفحة. يُنادى أوّلَ شيء في الإقلاع. */
export async function loadIdentity() {
  try {
    const r = await fetch("هوية.json", { cache: "no-store" });
    if (r.ok) IDENT = { ...FALLBACK, ...(await r.json()) };
    else console.warn("[هوية] تعذّر تحميل هوية.json — القشرة بلا اسم جهة");
  } catch { console.warn("[هوية] لا ملف هوية بجوار الصفحة"); }
  apply();
  return IDENT;
}

function apply() {
  document.title = IDENT.title;

  for (const el of document.querySelectorAll("[data-brand]")) {
    const k = el.dataset.brand;
    if (k === "favicon") { el.href = IDENT.favicon; continue; }
    if (k === "logo") { el.src = IDENT.logo; el.alt = IDENT.logoAlt; continue; }
    if (k === "building") { el.src = IDENT.building || IDENT.logo; el.alt = IDENT.logoAlt; continue; }
    if (k === "logo2") {
      /* الشعار الثاني يُحذف لا يُخفى: الفاصل يبقى معلّقًا لو أُخفي وحده */
      if (!IDENT.secondLogo) { el.previousElementSibling?.classList.contains("divider") && el.previousElementSibling.remove(); el.remove(); }
      else { el.src = IDENT.secondLogo; el.alt = IDENT.secondLogoAlt ?? ""; }
      continue;
    }
    if (k === "group-title") { el.title = IDENT.group; continue; }
    if (k === "crumb") { el.textContent = (IDENT.logoAlt ? IDENT.logoAlt + " · " : "") + IDENT.crumbTail; continue; }
    el.textContent = IDENT[k] ?? "";
  }
}
