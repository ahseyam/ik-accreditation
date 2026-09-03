/* ── ضغط الشواهد عند الرفع ──
   الهاتف يُخرج صورة 3–5 ميجابايت بأبعاد 4000px، والشاهد لا يحتاج أكثر من
   عرضٍ يُقرأ فيه الختم والتوقيع. الضغط هنا يخفض التخزين إلى السُّدس تقريبًا
   بلا فقدٍ يُلاحَظ عند القراءة أو الطباعة.

   ⚠️ قواعد لا تُخالَف:
   ① لا يُمَسّ ملف PDF ولا مستند — الضغط للصور وحدها.
   ② إن كبُر الناتج عن الأصل يُترك الأصل (يحدث في صور الشاشة البسيطة).
   ③ PNG ذو شفافية يبقى PNG — تحويله JPEG يُسوِّد الخلفية.
   ④ الأصل لا يُحذف من جهاز المستخدم — نحن ننسخ فقط. */

const MAX_EDGE = 2200;      // يكفي لقراءة ختم وتوقيع في مستند A4 مصوَّر
const QUALITY = 0.82;
const SKIP_UNDER = 250 * 1024;

export const isImage = (f) => /^image\/(jpeg|png|webp|heic|heif)$/i.test(f?.type || "");

const hasAlpha = async (bmp) => {
  const c = document.createElement("canvas");
  const w = Math.min(bmp.width, 64), h = Math.min(bmp.height, 64);
  c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bmp, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
};

/**
 * يعيد { blob, name, before, after, note } — و`blob` هو الأصل إن لم يُجدِ الضغط.
 */
export async function shrinkImage(file) {
  const out = { blob: file, name: file.name, before: file.size, after: file.size, note: "" };
  if (!isImage(file)) { out.note = "ملف غير صورة — لم يُضغط"; return out; }
  if (file.size < SKIP_UNDER) { out.note = "صغيرة أصلًا"; return out; }
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch { out.note = "تعذّرت قراءتها — رُفعت كما هي"; return out; }

  // ⚠️ تُقرأ الأبعاد قبل الإغلاق — بعده تعود أصفارًا فيظهر «0×0» في البيان
  const ow = bmp.width, oh = bmp.height;
  const scale = Math.min(1, MAX_EDGE / Math.max(ow, oh));
  const w = Math.round(ow * scale), h = Math.round(oh * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext("2d");
  g.imageSmoothingQuality = "high";

  const alpha = /png/i.test(file.type) && await hasAlpha(bmp);
  if (!alpha) { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); }
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();

  const type = alpha ? "image/png" : "image/jpeg";
  const blob = await new Promise((res) => canvas.toBlob(res, type, QUALITY));
  if (!blob || blob.size >= file.size) { out.note = "الضغط لم يُجدِ — رُفع الأصل"; return out; }

  out.blob = blob;
  out.after = blob.size;
  out.name = alpha ? file.name.replace(/\.[^.]+$/, "") + ".png"
                   : file.name.replace(/\.[^.]+$/, "") + ".jpg";
  out.note = ow + "×" + oh + " ⇐ " + w + "×" + h;
  return out;
}

export const kb = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + "MB" : Math.round(n / 1024) + "KB";
