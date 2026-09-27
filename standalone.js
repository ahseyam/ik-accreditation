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
import { esc } from "./ui-state.js?v=581262ee";

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

/**
 * ملفّات الكليشة حسب اتجاه الورقة.
 *
 * ⚠️ **الطولية على ورقة عرضية تُمَطّ**: الخطة التشغيلية تُطبع عرضية، وكانت
 *    ورقة الكليشة الطولية تُمدّ على 29.7سم فيخرج سطر الخطة خارج شريطه الملوّن.
 *    فصارت لكل حزمة ورقتان وشريطان، ويُختار بالاتجاه.
 * ⚠️ **وارتدادٌ للحزم القديمة**: حزمةٌ بُنيت قبل هذا لا تحمل الملفات العرضية،
 *    فتعمل بالطولية كما كانت بدل أن تخرج بيضاء.
 */
export async function brandFiles(store, orientation = "portrait") {
  const land = orientation === "landscape";
  const pick = async (l, p) => {
    if (!land) return p;
    try { return (await store.exists(l)) ? l : p; } catch { return p; }
  };
  return {
    sheet: await pick("كليشة/ورقة-عرضية.jpg", "كليشة/ورقة.jpg"),
    header: await pick("كليشة/ترويسة-عرضية.png", "كليشة/ترويسة.png"),
    footer: await pick("كليشة/تذييل-عرضية.png", "كليشة/تذييل.png"),
  };
}

/** قياسات الاتجاه المطلوب — الحقول العرضية إن وُجدت، وإلّا الطولية */
export function geomFor(geom, orientation = "portrait") {
  return orientation === "landscape" && geom?.landscape ? { ...geom, ...geom.landscape } : geom;
}

/** كل ما يلزم ملفًّا قائمًا بذاته: الكليشة الثلاث والقياسات والخطّان */
export async function standaloneAssets(store, orientation = "portrait") {
  const f = await brandFiles(store, orientation);
  const [sheet, header, footer, geomRaw, reg, bold] = await Promise.all([
    asset(store, f.sheet, "image/jpeg"),
    asset(store, f.header, "image/png"),
    asset(store, f.footer, "image/png"),
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
  const geom = geomFor(geomRaw, orientation);
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
    /* ⚠️ ورقة الكليشة عنصرٌ ثابت يتكرّر مع كل صفحة عند الطباعة — لا خلفيةً
       مبلّطة، وإلّا انزلقت عن موضعها في المستندات الطويلة (قِيس: من الورقة
       138 في خطة تشغيلية عرضية). وهي مخفيّة على الشاشة بـ@media screen. */
    "</style></head><body><div class=\"p-sheet\"></div>" + body + "</body></html>";
}
