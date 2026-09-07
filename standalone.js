/* ── لبِنات الملفّ القائم بذاته ──
 *
 * الكليشة والخطّ يُدرَجان داخل الملف بـ`data:` لا بروابط، فيعمل الملف من أي
 * موضع وبلا إنترنت. استُخلصت هذه اللبِنات من `export-print.js` كي يستعملها
 * **مصدرٌ واحد** كلٌّ من: تصدير السجلات للطباعة، وتنزيل خطط المدرسة.
 *
 * ⚠️ التكرار هنا خطرٌ صامت: لو نُسخت هذه الدوال في موضعين لانحرف أحدهما عن
 * الآخر بلا أن يظهر — ملفٌّ يُطبع صحيحًا وآخر يخرج بخطّ النظام. وهذا الدرس
 * مكتوبٌ في `print.js` نفسه: «محرّك واحد للطباعة والتصدير».
 *
 * ⚠️ ولا تستورد هذه الوحدة من `print.js` ولا من `export-print.js` — كلاهما
 * يستورد منها، فالاستيراد المتبادل يُنشئ حلقةً تُفرغ أحد الطرفين وقت التحميل.
 */
import { esc } from "./ui-state.js?v=0e5e4e87";

/** يحوّل مخزنًا ثنائيًّا إلى base64 على دفعات */
export const b64 = (buf) => {
  const b = new Uint8Array(buf); let s = "";
  // ⚠️ String.fromCharCode(...b) يتجاوز حدّ الوسائط على الملفات الكبيرة فيرمي
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return btoa(s);
};

/** ملفّ من مجلد المدرسة إلى `data:` */
export async function asset(store, rel, mime) {
  const buf = await store.readBinary(rel);
  return "data:" + mime + ";base64," + b64(buf);
}

/** ملفّ من القشرة المنشورة إلى `data:` */
export async function shellAsset(url, mime) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url);
  return "data:" + mime + ";base64," + b64(await r.arrayBuffer());
}

/** كل ما يلزم ملفًّا قائمًا بذاته: الكليشة الثلاث والقياسات والخطّان */
export async function standaloneAssets(store) {
  const [sheet, header, footer, geom, reg, bold] = await Promise.all([
    asset(store, "كليشة/ورقة.jpg", "image/jpeg"),
    asset(store, "كليشة/ترويسة.png", "image/png"),
    asset(store, "كليشة/تذييل.png", "image/png"),
    store.readJson("كليشة/قياسات.json"),
    shellAsset("AlJazeera-Regular.v2.woff2", "font/woff2").catch(() => null),
    shellAsset("AlJazeera-Bold.v2.woff2", "font/woff2").catch(() => null),
  ]);
  /* ⚠️ اسم عائلة الخطّ يجب أن يطابق ما تستعمله أنماط الطباعة حرفًا بحرف،
     وإلّا سقط المطبوع إلى خطّ النظام بلا أي رسالة. */
  const fonts = [
    reg && '@font-face{font-family:"Al Jazeera Arabic";font-weight:400;font-display:block;src:url("' + reg + '") format("woff2")}',
    bold && '@font-face{font-family:"Al Jazeera Arabic";font-weight:700;font-display:block;src:url("' + bold + '") format("woff2")}',
  ].filter(Boolean).join("\n");
  return { sheet, header, footer, geom, fonts };
}

/** ورقةٌ واحدة بإطار الكليشة المتكرّر */
export function page(inner, first, geom) {
  return '<table class="p-frame"' + (first ? "" : ' style="break-before:page"') + ">" +
    '<thead><tr><td class="p-lh-head"></td></tr></thead>' +
    '<tbody><tr><td class="p-body">' + inner + "</td></tr></tbody>" +
    '<tfoot><tr><td class="p-lh-foot"></td></tr></tfoot></table>';
}

/** مستندٌ كامل قائم بذاته */
export function wrap(title, css, body, fonts, { widthMm = 210 } = {}) {
  return "<!doctype html>\n<html dir=\"rtl\" lang=\"ar\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + esc(title) + "</title><style>" + fonts + "\n" + css +
    "\nbody{margin:0;background:#fff}" +
    "\n.print-root{display:block}" +
    "\n@media screen{body{background:#e9eeee;padding:10px 0}" +
    "table.p-frame{width:" + widthMm + "mm;margin:0 auto 14px;background:#fff;box-shadow:0 2px 12px #0002}}" +
    "</style></head><body>" + body + "</body></html>";
}
