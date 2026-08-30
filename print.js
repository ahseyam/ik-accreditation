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
  const cols = field.columns ?? [];
  const filled = rows.filter((r) => cols.some((c) => !isBlank(r[c.key])));
  if (filled.length === 0) return null;
  const t = el("table", "p-table");
  const htr = el("tr");
  htr.append(el("th", "p-num", "م"));
  for (const c of cols) htr.append(el("th", null, c.label ?? c.key));
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
    if (f.type === "SECTION_HEADER") { out.append(el("h3", "p-sec", f.label ?? "")); continue; }
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
        out.append(el("h4", "p-sub", (f.itemLabel ?? "عنصر") + " " + (i + 1)));
        walkFields(f.fields, item, out);
      });
      continue;
    }
    if (isBlank(v)) continue;
    const row = el("div", "p-row");
    row.append(el("span", "p-k", (f.label ?? k) + ":"));
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

function printCss(o) {
  const headH = o.geom.headerCm + "cm";
  const footH = o.geom.footerCm + "cm";
  return [
    ".print-root{display:none}",
    "@media print{",
    "  @page{size:A4 portrait;margin:0}",
    "  body>.wrap,body>.status{display:none!important}",
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
    "  .p-etec{margin-top:14px;font-size:9.5pt;color:#5b7185;",
    "       border-top:0.75pt solid #cfe3dd;padding-top:6px}",
    "}",
  ].join("\n");
}

/** يطبع مستندًا حرًّا بنفس كليشة السجلات */
export async function printDocument(docNode, ctx) {
  await preparePrint(null, {}, { ...ctx, docNode });
  window.print();
}
