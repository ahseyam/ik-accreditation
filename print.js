import { interpolate, interpScope, arabizeText, stripDecor, headingLevel, isSerialCol, isNoiseCol } from "./record.js?v=cca7ee86";
/* طبقة الطباعة — كليشة ابن خلدون تتكرّر على كل ورقة.
   التقنية مقيسة سلفًا في محرّر الخطط القائم بذاته، ولا تُعاد من الصفر:
     ① @page margin:0  ⇒ الورقة 297mm بالضبط
     ② خلفية على html بـrepeat-y وbackground-size: 100% 297mm
        (لا 100% 100% — تلك تمدّ الصورة على المستند كله فتُظهر كل ورقة شريحة)
     ③ الهامشان العلوي والسفلي = thead/tfoot لجدول ملفّ، وهما يتكرّران بالمواصفة
        (لا position:fixed — تظهر على الورقة الأولى وحدها)                       */

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const isBlank = (v) => v == null || v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0);

function valueNode(field, value) {
  if (typeof value === "string" && value.startsWith("data:image")) {
    const img = el("img", "p-sig");
    img.src = value;
    return img;
  }
  if (Array.isArray(value) && value.length && typeof value[0] === "object" && value[0].name) {
    const ul = el("ul", "p-files");
    for (const f of value) ul.append(el("li", null, "📎 " + f.name));
    return ul;
  }
  if (typeof value === "boolean") return el("span", null, value ? "نعم" : "لا");
  if (Array.isArray(value)) return el("span", null, value.join("، "));
  return el("span", null, String(value));
}

/** جدول من صفوف RECURRING_LOG */
function printTable(field, rows) {
  /* ⚠️ عمودان كانا يتضاعفان في الورق دون الشاشة:
     ① «م» — يضيفه محرّك الطباعة، وهو أصلًا في القالب، فيخرج مرّتين.
     ② «🏷️ ETEC» — أُخفي من الشاشة بطلب المستشار وبقي يُطبع.
     والعلاج مُميِّزان **مستوردان من محرّك السجلات نفسه** لا منسوخان هنا،
     وإلّا انحرف الورق عن الشاشة كلّما تغيّر أحدهما. */
  const cols = (field.columns ?? []).filter((c) => !isSerialCol(c) && !isNoiseCol(c));
  const filled = rows.filter((r) => cols.some((c) => !isBlank(r[c.key])));
  if (filled.length === 0) return null;
  const t = el("table", "p-table");
  const htr = el("tr");
  htr.append(el("th", "p-num", "م"));
  for (const c of cols) htr.append(el("th", null, arabizeText(interpolate(c.label ?? c.key, interpScope(0)))));
  const thead = el("thead"); thead.append(htr);
  const tbody = el("tbody");
  filled.forEach((r, i) => {
    const tr = el("tr");
    tr.append(el("td", "p-num", String(i + 1)));
    for (const c of cols) {
      const td = el("td");
      const v = r[c.key];
      if (isBlank(v)) td.textContent = "";
      else td.append(valueNode(c, v));
      tr.append(td);
    }
    tbody.append(tr);
  });
  t.append(thead, tbody);
  return t;
}

function walkFields(fields, state, out) {
  for (const f of fields ?? []) {
    if (f.type === "SECTION_HEADER") {
      /* ⚠️ المطبوع كان يأخذ العنوان خامًا فتظهر زخرفة «═══» والمتغيّرات
         غير المستبدَلة على الورق. يمرّ الآن بنفس معالجة الشاشة. */
      const t = arabizeText(stripDecor(interpolate(f.label ?? "", interpScope(0))));
      out.append(el(headingLevel(f.label) === 1 ? "h3" : "h4",
                    "p-sec p-lvl" + headingLevel(f.label), t));
      continue;
    }
    if (f.type === "INFO_BOX" || f.type === "INFO_BLOCK" || f.type === "JOB_DESCRIPTION_DISPLAY") continue;
    const k = f.key ?? f.id;
    const v = state[k];
    if (f.type === "RECURRING_LOG") {
      const t = printTable(f, Array.isArray(v) ? v : []);
      if (t) { out.append(el("div", "p-flabel", f.label ?? "")); out.append(t); }
      continue;
    }
    if (f.type === "REPEATING_SECTION") {
      const items = Array.isArray(v) ? v : [];
      items.forEach((item, i) => {
        const any = (f.fields ?? []).some((sf) => !isBlank(item[sf.key ?? sf.id]));
        if (!any) return;
        out.append(el("h4", "p-sub", interpolate(f.itemLabel ?? "", interpScope(i, item)) || "عنصر " + (i + 1)));
        walkFields(f.fields, item, out);
      });
      continue;
    }
    if (isBlank(v)) continue;
    const row = el("div", "p-row");
    row.append(el("span", "p-k", arabizeText(interpolate(f.label ?? k, interpScope(0))) + ":"));
    row.append(valueNode(f, v));
    out.append(row);
  }
}

/** يبني مستند الطباعة كاملًا ويعيده */
export function buildPrintDoc(template, state, ctx) {
  const doc = el("div", "p-doc");

  const title = el("div", "p-title");
  title.append(el("h1", null, "سجل " + template.number + " · " + template.nameAr));
  title.append(el("div", "p-meta",
    ctx.school.nameAr + " · العام " + ctx.school.academicYear.greg +
    " · " + (ctx.person.fullName || "") + " (" + ctx.roleAr + ")" +
    " · " + (ctx.entryId || "")));
  doc.append(title);

  const ff = template.formFields ?? {};
  if (ff.primaryData) {
    const grid = el("div", "p-primary");
    for (const [k, def] of Object.entries(ff.primaryData)) {
      const v = state["__" + k];
      if (isBlank(v)) continue;
      const cell = el("div", "p-pcell");
      cell.append(el("span", "p-k", (def.label ?? k) + ":"), el("b", null, String(v)));
      grid.append(cell);
    }
    if (grid.childElementCount) doc.append(grid);
  }
  walkFields(ff.fields, state, doc);

  if (template.etecIndicators?.length) {
    doc.append(el("div", "p-etec", "مؤشرات ETEC المرتبطة: " + template.etecIndicators.join("، ")));
  }
  return doc;
}

/** يركّب الإطار (ترويسة/تذييل متكرّران) بلا طباعة — يُستدعى من الحارس أيضًا */
export async function preparePrint(template, state, ctx) {
  const [sheet, header, footer, geom] = await Promise.all([
    ctx.store.fileUrl("كليشة/ورقة.jpg"),
    ctx.store.fileUrl("كليشة/ترويسة.png"),
    ctx.store.fileUrl("كليشة/تذييل.png"),
    ctx.store.readJson("كليشة/قياسات.json"),
  ]);

  document.getElementById("printRoot")?.remove();
  document.getElementById("printStyle")?.remove();

  // الإطار: جدول ملفّ — thead وtfoot يتكرّران على كل ورقة بمواصفة CSS
  const root = el("div", "print-root");
  root.id = "printRoot";
  const frame = el("table", "p-frame");
  const thead = el("thead");
  const trh = el("tr"); const tdh = el("td", "p-lh-head"); trh.append(tdh); thead.append(trh);
  const tfoot = el("tfoot");
  const trf = el("tr"); const tdf = el("td", "p-lh-foot"); trf.append(tdf); tfoot.append(trf);
  const tbody = el("tbody");
  const trb = el("tr"); const tdb = el("td", "p-body");
  // ctx.docNode يسمح بطباعة أي مستند (الخطة التحسينية مثلًا) بنفس الكليشة
  tdb.append(ctx.docNode ?? buildPrintDoc(template, state, ctx));
  trb.append(tdb); tbody.append(trb);
  frame.append(thead, tbody, tfoot);
  root.append(frame);
  document.body.append(root);

  const style = document.createElement("style");
  style.id = "printStyle";
  style.textContent = printCss({ sheet, header, footer, geom });
  document.head.append(style);

  /* ⚠️ **تحميل مسبق إلزامي**: الصور الثلاث مذكورة داخل «@media print» وحدها،
     فلا يجلبها المتصفّح قبل الطباعة — فتخرج الورقة بيضاء. قِسناه: أربع أوراق
     بيضاء تمامًا رغم صحّة الأنماط المحسوبة. الانتظار هنا هو العلاج لا التأخير. */
  /* ⚠️ والخطّ مثل الصور تمامًا: «Al Jazeera Arabic» لا يُستعمل على الشاشة، فلا
     يُحمِّله المتصفّح إلا عند أول رسم — وقد يفوت الطباعة فيسقط المطبوع إلى خطّ
     النظام. قِسناه على الموقع المنشور: document.fonts.check = false. */
  if (document.fonts?.load) {
    await Promise.all([
      document.fonts.load("400 14px 'Al Jazeera Arabic'"),
      document.fonts.load("700 14px 'Al Jazeera Arabic'"),
    ]).catch(() => {});
  }
  await Promise.all([sheet, header, footer].map((src) => new Promise((res) => {
    const img = new Image();
    img.onload = img.onerror = () => res(src);
    img.src = src;
  })));
  await new Promise((r) => setTimeout(r, 120));
  return { sheet, header, footer, geom };
}

/** يجهّز المطبوع ثم يفتح حوار الطباعة */
export async function printRecord(template, state, ctx) {
  const info = await preparePrint(template, state, ctx);
  window.print();
  return info;
}

/* ⚠️ محرّك واحد للطباعة والتصدير. لو بُني للتصدير محرّكٌ ثانٍ لانحرف عن هذا
   بصمتٍ، وكل درسٍ في هذه الأنماط دُفع ثمنُه مرّة: الخلفية على html وbody معًا،
   والتحميل المسبق للصور والخطّ، والجداول ثابتة التخطيط كي لا تفيض على الكليشة.
   فالتصدير يستدعي `printCss` نفسها بـ`standalone` فتُرفع عنها لفّة @media
   وحدها — لا سطر نمطٍ يُنسخ. */
export function printCss(o, { standalone = false } = {}) {
  const headH = o.geom.headerCm + "cm";
  const footH = o.geom.footerCm + "cm";
  return [
    standalone ? "" : ".print-root{display:none}",
    standalone ? "@page{size:A4 portrait;margin:0}" : "@media print{",
    "  @page{size:A4 portrait;margin:0}",
    /* ⚠️ يجب أن يطابق هذا المُحدِّد بنية الصفحة الحالية. بعد إعادة البناء صار
       المتن داخل «.app > main > .wrap» فلم يعد «body>.wrap» يطابق شيئًا،
       فطُبعت الواجهة كلها **فوق الكليشة**. قِيس: تطابق الترويسة 44% بدل 84%. */
    "  .app,.status{display:none!important}",
    /* ⚠️ الخلفية على «html وbody» معًا لا على الجذر وحده. قِسناه: بالجذر وحده
       تظهر الكليشة في لقطة وسيط الطباعة لكن **تخرج الأوراق بيضاء تمامًا** من
       page.pdf — خلفية الجذر تُنقَل إلى القُماشة ولا تُرسَم في المطبوع. وبإضافة
       body صار أقصى فارق لوني عن الكليشة الأصلية على الحافّة = 1 على كل ورقة.
       والتبليط كل 297mm يطابق حافّة كل ورقة لأن «@page margin:0» يجعلها 297mm. */
    '  html,body{background-image:url("' + o.sheet + '")!important;',
    "       background-repeat:repeat-y!important;background-position:top center!important;",
    "       background-size:100% " + o.geom.pageHmm + "mm!important;",
    "       background-color:transparent!important;margin:0;",
    "       -webkit-print-color-adjust:exact;print-color-adjust:exact}",
    "  .print-root{display:block}",
    "  table.p-frame{width:100%;border-collapse:collapse;background:none}",
    "  table.p-frame>thead{display:table-header-group}",
    "  table.p-frame>tfoot{display:table-footer-group}",
    // الهامشان يصيران ترويسة الجدول وتذييله — يتكرّران بالمواصفة
    "  td.p-lh-head{height:" + headH + ";padding:0;border:0;",
    '       background:url("' + o.header + '") no-repeat top center/100% ' + headH + "}",
    "  td.p-lh-foot{height:" + footH + ";padding:0;border:0;",
    '       background:url("' + o.footer + '") no-repeat bottom center/100% ' + footH + "}",
    "  td.p-body{padding:0 14mm;vertical-align:top;background:transparent!important}",
    "  .p-doc{font-family:'Al Jazeera Arabic','Segoe UI',Tahoma,sans-serif;font-size:11.5pt;",
    // ⚠️ صندوق الحرف العربي ≈1.68× حجم الخط — 1.25 يُتلِف التباعد
    "       line-height:1.7;color:#16232e}",
    "  .p-title h1{font-size:15pt;margin:0 0 4px;color:#1e5b4f}",
    "  .p-meta{font-size:9.5pt;color:#5b7185;margin-bottom:10px}",
    "  .p-primary{display:flex;flex-wrap:wrap;gap:4px 22px;font-size:10pt;",
    "       border:1px solid #cfe3dd;border-radius:6px;padding:8px 12px;margin-bottom:12px}",
    "  .p-k{color:#5b7185;margin-inline-end:5px}",
    "  .p-doc .sec .sec-mark{display:none}",
    "  .p-doc .sec.lvl1,h3.p-sec,.p-doc h3.p-sec{font-size:12pt;color:#155e4e;font-weight:700;",
    "       margin:12pt 0 6pt;border-bottom:1pt solid #cfe3dd;padding-bottom:3pt;border-inline-start:0}",
    "  .p-doc .sec.lvl2,.p-doc h4.p-lvl2{font-size:11pt;color:#1d7a63;font-weight:700;margin:9pt 0 5pt;",
    "       border-inline-start:2pt solid #cfe3dd;padding-inline-start:6pt;border-bottom:0}",
    "  .p-doc .sec.lvl3{font-size:10pt;color:#a97c1f;font-weight:700;margin:7pt 0 4pt}",
    "  h3.p-sec{font-size:12pt;color:#1e5b4f;margin:14px 0 7px;",
    "       border-bottom:1.5pt solid #cfe3dd;padding-bottom:3px;break-after:avoid}",
    "  h4.p-sub{font-size:11pt;margin:10px 0 5px}",
    "  .p-flabel{font-weight:700;font-size:10.5pt;margin:9px 0 4px}",
    "  .p-row{margin:0 0 5px;font-size:10.5pt}",
    "  table.p-table{width:100%;border-collapse:collapse;font-size:9.5pt;margin-bottom:10px}",
    "  table.p-table th,table.p-table td{border:0.75pt solid #b9c6d1;padding:4px 6px;text-align:right}",
    "  table.p-table th{background:#eef4f2}",
    "  table.p-table td.p-num,table.p-table th.p-num{width:22px;text-align:center}",
    "  table.p-table tr{break-inside:avoid}",
    "  img.p-sig{max-height:22mm;display:block}",
    "  ul.p-files{margin:2px 0;padding-inline-start:18px;font-size:10pt}",
    // أنماط عامة لأي شاشة تُلتقط للطباعة
    "  .p-doc .card,.p-doc .tile,.p-doc .kpi .box,.p-doc .prog,.p-doc .item-card,.p-doc .tool-row{",
    "       border:0.75pt solid #c6d5d1;border-radius:4pt;padding:7pt 9pt;margin-bottom:7pt;",
    "       box-shadow:none;background:transparent;break-inside:avoid}",
    "  .p-doc .card::before,.p-doc .tile::before,.p-doc .kpi .box::before,",
    "  .p-doc .prog::before,.p-doc .tool-row::before,.p-doc .tile::after{display:none}",
    "  .p-doc .kpi{display:flex;flex-wrap:wrap;gap:6pt}",
    "  .p-doc .kpi .box{min-width:96pt}",
    "  .p-doc .tile .n,.p-doc .kpi .box .v{font-size:15pt;font-weight:700;color:#155e4e}",
    /* ⚠️ الجداول العريضة تفيض خارج متن الورقة فتغطّي الكليشة بالأبيض.
       قِسناه: 4 أوراق من 13 فشلت في حارس الكليشة. table-layout ثابت + كسر
       الكلمة يبقيان الجدول داخل المتن. */
    "  .p-doc table{width:100%;max-width:100%;border-collapse:collapse;font-size:8.5pt;",
    "       margin-bottom:7pt;table-layout:fixed;word-break:break-word;overflow-wrap:anywhere}",
    "  .p-doc{overflow:hidden}",
    /* ⚠️ قاعدة كاسحة: أي خلفية بيضاء موروثة من أنماط الشاشة تطمس الكليشة.
       تُصفَّر كلها ثم تُعاد الألوان المقصودة وحدها (ترويسة الجدول). */
    "  .print-root *{background-color:transparent!important;max-width:100%!important;",
    "       box-shadow:none!important}",
    "  .p-doc .kpi{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:5pt}",
    "  .p-doc th{background-color:#eef4f2!important}",
    "  .p-doc th,.p-doc td{border:0.75pt solid #b9c6d1;padding:3pt 5pt;text-align:right}",
    "  .p-doc th{background:#eef4f2}",
    "  .p-doc .scroll{overflow:visible;border:0;max-height:none}",
    "  .p-doc .bar-m{display:none}",
    "  .p-val{border-bottom:0.5pt dotted #9fb3ae;padding:0 3pt;min-width:36pt;display:inline-block}",
    "  .p-doc h1{font-size:15pt}.p-doc h2{font-size:12pt;color:#155e4e;margin:9pt 0 5pt}",
    "  .p-etec{margin-top:14px;font-size:9.5pt;color:#5b7185;",
    "       border-top:0.75pt solid #cfe3dd;padding-top:6px}",
    standalone ? "" : "}",
  ].filter(Boolean).join("\n");
}

/** يطبع مستندًا حرًّا بنفس كليشة السجلات */
export async function printDocument(docNode, ctx) {
  await preparePrint(null, {}, { ...ctx, docNode });
  window.print();
}

/** يحوّل شاشة تفاعلية إلى مستند طباعة: القيم بدل الحقول، وبلا أزرار */
export function snapshotForPrint(section, title, subtitle) {
  const doc = el("div", "p-doc");
  const head = el("div", "p-title");
  head.append(el("h1", null, title));
  if (subtitle) head.append(el("div", "p-meta", subtitle));
  doc.append(head);

  const body = section.cloneNode(true);
  body.querySelectorAll("button, .pager, .toolbar, .sticky-save, script").forEach((n) => n.remove());
  // الحقول تصير نصًّا — وإلا طُبعت فارغة
  body.querySelectorAll("input, select, textarea").forEach((n) => {
    const span = document.createElement("span");
    if (n.type === "checkbox" || n.type === "radio") span.textContent = n.checked ? "☑" : "☐";
    else if (n.tagName === "SELECT") span.textContent = n.options[n.selectedIndex]?.text ?? "";
    else span.textContent = n.value ?? "";
    span.className = "p-val";
    n.replaceWith(span);
  });
  body.querySelectorAll("canvas").forEach((c) => {
    const img = document.createElement("img");
    img.className = "p-sig";
    try { img.src = c.toDataURL("image/png"); } catch { /* فارغ */ }
    c.replaceWith(img);
  });
  body.querySelectorAll(".hidden").forEach((n) => n.remove());
  doc.append(body);
  return doc;
}
