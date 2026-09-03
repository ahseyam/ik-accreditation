/* ── تصدير نسخة للطباعة ──
 *
 * الإدخالات تُحفظ JSON — تُقرأ بالموقع ولا تُطبع من OneDrive. وهذا الأمر يُخرج
 * منها **صفحات HTML قائمة بذاتها بالكليشة**، تُفتح من المجلد بأي متصفّح
 * وتُطبع بـ Ctrl+P بلا الموقع وبلا إنترنت.
 *
 * ⚠️ **قائمةٌ بذاتها بالمعنى الحرفي**: الكليشة والخطّ يُدرَجان داخل الملف
 * (data:) لا بروابط. فملفٌ يشير إلى «كليشة/ورقة.jpg» يعمل ما دام في موضعه
 * تحت المجلد، ويخرج أبيضَ إن نُقل أو أُرسل بالبريد — وهو أوّل ما سيفعله
 * المستخدم بالملف.
 *
 * ⚠️ **يدويٌّ بقرارٍ لا بنقص**: يُشغَّل بزرٍّ لا بعد كل حفظ. فالتصدير يعيد
 * كتابة عشرات الملفات، وجعلُه تلقائيًّا يُشغل مزامنة OneDrive بلا انقطاع.
 *
 * ⚠️ **حدٌّ يجب أن يُقال للمستخدم**: OneDrive على الويب **لا يعرض HTML** بل
 * ينزّله. فالطباعة تكون من المجلد المُزامَن على الحاسب. مكتوبٌ في الفهرس نفسه.
 */
import { buildPrintDoc, printCss } from "./print.js?v=a7aa9546";
import { roleAr } from "./app.js?v=a7aa9546";
import { esc } from "./ui-state.js?v=a7aa9546";

export const OUT_DIR = "للطباعة";

const b64 = (buf) => {
  const b = new Uint8Array(buf); let s = "";
  // ⚠️ String.fromCharCode(...b) يتجاوز حدّ الوسائط على الملفات الكبيرة فيرمي
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return btoa(s);
};

async function asset(store, rel, mime) {
  const buf = await store.readBinary(rel);
  return "data:" + mime + ";base64," + b64(buf);
}
async function shellAsset(url, mime) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url);
  return "data:" + mime + ";base64," + b64(await r.arrayBuffer());
}

/** يمشي «مخرجات/<الدور>/سجلات/<الرقم>/*.json» ويجمعها بالرقم */
async function collectEntries(store) {
  const byRecord = new Map();
  let roles = [];
  try { roles = await store.list("مخرجات"); } catch { return byRecord; }
  for (const r of roles) {
    if (r.kind !== "directory") continue;
    let nums = [];
    try { nums = await store.list("مخرجات/" + r.name + "/سجلات"); } catch { continue; }
    for (const n of nums) {
      if (n.kind !== "directory") continue;
      let files = [];
      try { files = await store.list("مخرجات/" + r.name + "/سجلات/" + n.name); } catch { continue; }
      for (const f of files) {
        if (f.kind === "directory" || !f.name.endsWith(".json")) continue;
        try {
          const e = await store.readJson("مخرجات/" + r.name + "/سجلات/" + n.name + "/" + f.name);
          const key = String(e.recordNumber ?? n.name);
          if (!byRecord.has(key)) byRecord.set(key, []);
          byRecord.get(key).push(e);
        } catch { /* ملف تالف لا يُسقط التصدير */ }
      }
    }
  }
  for (const list of byRecord.values()) list.sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt)));
  return byRecord;
}

function page(inner, first, geom) {
  return '<table class="p-frame"' + (first ? "" : ' style="break-before:page"') + ">" +
    '<thead><tr><td class="p-lh-head"></td></tr></thead>' +
    '<tbody><tr><td class="p-body">' + inner + "</td></tr></tbody>" +
    '<tfoot><tr><td class="p-lh-foot"></td></tr></tfoot></table>';
}

function wrap(title, css, body, fonts) {
  return "<!doctype html>\n<html dir=\"rtl\" lang=\"ar\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>" + esc(title) + "</title><style>" + fonts + "\n" + css +
    "\nbody{margin:0;background:#fff}" +
    "\n.print-root{display:block}" +
    "\n@media screen{body{background:#e9eeee;padding:10px 0}" +
    "table.p-frame{width:210mm;margin:0 auto 14px;background:#fff;box-shadow:0 2px 12px #0002}}" +
    "</style></head><body>" + body + "</body></html>";
}

/**
 * يكتب `للطباعة/` داخل مجلد المدرسة.
 * @returns {{files:number, entries:number, records:number, skipped:number}}
 */
export async function exportPrintable(store, bundle, me, onProgress) {
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
  const fonts = [reg && '@font-face{font-family:"Al Jazeera Arabic";font-weight:400;font-display:block;src:url("' + reg + '") format("woff2")}',
                 bold && '@font-face{font-family:"Al Jazeera Arabic";font-weight:700;font-display:block;src:url("' + bold + '") format("woff2")}']
                 .filter(Boolean).join("\n");
  const css = printCss({ sheet, header, footer, geom }, { standalone: true });

  const byRecord = await collectEntries(store);
  const tmplByNum = new Map((bundle.records?.records ?? bundle.records ?? []).map((t) => [String(t.number), t]));
  const school = bundle.school;

  let files = 0, entries = 0, skipped = 0;
  const index = [];
  for (const [num, list] of [...byRecord.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const t = tmplByNum.get(num);
    if (!t) { skipped += list.length; continue; }
    const pages = list.map((e, i) => {
      const ctx = { school, person: { fullName: e.person }, roleAr: e.roleAr || roleAr(e.role),
                    entryId: e.entryId, store };
      return page(buildPrintDoc(t, e.data ?? {}, ctx).outerHTML, i === 0, geom);
    });
    const name = num + " - " + String(t.nameAr).replace(/[\\/:*?"<>|]/g, "-");
    await store.writeText(OUT_DIR + "/" + name + ".html",
      wrap("سجل " + num + " · " + t.nameAr, css, pages.join("\n"), fonts));
    index.push({ num, name, nameAr: t.nameAr, n: list.length,
                 last: list[list.length - 1]?.savedAt || "" });
    files++; entries += list.length;
    onProgress?.(files, t.nameAr);
  }

  await store.writeText(OUT_DIR + "/الفهرس.html", indexHtml(school, index, entries, me, fonts));
  return { files: files + 1, entries, records: files, skipped };
}

function indexHtml(school, index, entries, me, fonts) {
  const when = new Date().toLocaleString("ar-SA");
  return "<!doctype html>\n<html dir=\"rtl\" lang=\"ar\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">" +
    "<title>نسخة للطباعة — " + esc(school.nameAr) + "</title><style>" + fonts +
    "body{font:15px/1.85 'Al Jazeera Arabic','SF Arabic',system-ui;margin:0;background:#f2f6f5;color:#122a25}" +
    ".w{max-width:900px;margin:0 auto;padding:26px 18px 60px}" +
    "h1{font-size:22px;margin:0 0 4px;color:#155e4e}.sub{color:#43616a;margin-bottom:20px;font-size:13.5px}" +
    ".note{background:#fff8e6;border:1px solid #e8d5a3;border-radius:11px;padding:14px 17px;margin-bottom:20px;font-size:13.5px}" +
    "table{border-collapse:collapse;width:100%;background:#fff;border-radius:11px;overflow:hidden;font-size:13.5px}" +
    "th,td{border-bottom:1px solid #e2eae9;padding:10px 12px;text-align:right}" +
    "th{background:#e9f3f0;color:#0d443a;font-weight:700}" +
    "td.c{text-align:center;width:58px}a{color:#1d7a63;font-weight:700;text-decoration:none}" +
    "a:hover{text-decoration:underline}" +
    "@media(max-width:520px){td.d{display:none}th.d{display:none}}" +
    "</style></head><body><div class=w>" +
    "<h1>نسخة للطباعة</h1><div class=sub>" + esc(school.nameAr) + " · العام " +
    esc(school.academicYear.greg) + " · صُدِّرت " + esc(when) +
    (me ? " · بمعرفة " + esc(me.fullName || "") : "") + "</div>" +
    "<div class=note><b>كيف تطبع:</b> افتح الملف من <b>مجلد المدرسة المُزامَن على حاسبك</b> " +
    "ثم <b>Ctrl+P</b> (أو ⌘P) واختر A4 وفعّل «طباعة الخلفيات» لتظهر الكليشة.<br>" +
    "<b>تنبيه:</b> OneDrive على الويب <b>لا يعرض</b> ملفات HTML بل ينزّلها — فالطباعة من المجلد المُزامَن. " +
    "وكل ملف يحمل كليشته وخطّه بداخله، فيعمل بلا إنترنت وأينما نُقل.</div>" +
    "<table><thead><tr><th class=c>السجل</th><th>الاسم</th><th class=c>إدخالات</th>" +
    "<th class='d'>آخر حفظ</th></tr></thead><tbody>" +
    index.map((r) =>
      "<tr><td class=c>" + esc(r.num) + "</td>" +
      "<td><a href=\"" + esc(encodeURIComponent(r.name)) + ".html\">" + esc(r.nameAr) + "</a></td>" +
      "<td class=c>" + r.n + "</td>" +
      "<td class='d'>" + esc(String(r.last).slice(0, 10)) + "</td></tr>").join("") +
    "</tbody></table>" +
    "<div class=sub style='margin-top:18px'>" + index.length + " سجلًّا · " + entries + " إدخالًا</div>" +
    "</div></body></html>";
}
