/* محرّك عرض السجلات — يقرأ formFields من الحزمة ويبني نموذج إدخال عاملًا.
   قاعدة صارمة: كل نوع حقل له معالج مُسجَّل هنا. ما لا معالج له يظهر كتحذير
   مرئي ويُحصى في UNSUPPORTED كي لا نَدَّعي تغطية لا نملكها.                 */

export const UNSUPPORTED = [];

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function nowISO() { return new Date().toISOString().slice(0, 16); }

/** القيم التلقائية المعلنة في الـDSL */
function autoValue(field, ctx) {
  switch (field.autoFill) {
    case "NOW": case "NOW_ON_RETURN": return nowISO();
    case "TODAY": return todayISO();
    case "TODAY_HIJRI": return todayISO();
    default: return field.default ?? "";
  }
}

function labelFor(field) {
  const wrap = el("div", "f-label");
  wrap.append(el("span", null, field.label || field.key || ""));
  if (field.required) wrap.append(el("span", "req", " *"));
  return wrap;
}

function help(field) {
  return field.helpText ? el("div", "f-help", field.helpText) : null;
}

/** غلاف موحّد لكل حقل */
function box(field, control) {
  const b = el("div", "field");
  b.append(labelFor(field));
  if (control) b.append(control);
  const h = help(field);
  if (h) b.append(h);
  return b;
}

function bindValue(input, field, state, key) {
  const k = key ?? field.key ?? field.id;
  const initial = state[k] !== undefined ? state[k] : autoValue(field, null);
  if (input.type === "checkbox") input.checked = Boolean(initial);
  else input.value = initial ?? "";
  if (field.readOnly) input.readOnly = true;
  input.addEventListener("input", () => {
    state[k] = input.type === "checkbox" ? input.checked : input.value;
  });
  input.addEventListener("change", () => {
    state[k] = input.type === "checkbox" ? input.checked : input.value;
  });
  return input;
}

function textInput(type, field, state, key) {
  const i = el("input", "f-in");
  i.type = type;
  if (field.placeholder) i.placeholder = field.placeholder;
  if (field.min != null) i.min = field.min;
  if (field.max != null) i.max = field.max;
  return bindValue(i, field, state, key);
}

/* ⚠️ الخيارات تأتي بشكلين في المصدر: نصوص، و**كائنات بمفتاحَي `v` و`l`**
   (261 من 367 قائمة أي 71%). كنت أقرأ `value`/`label` فقط فخرجت القوائم
   **فارغة** في أغلب السجلات. يُقرأ الشكلان معًا الآن، ويحرسه
   scripts/check-select-options.mjs. */
export function optionOf(o) {
  if (o == null) return null;
  if (typeof o === "string" || typeof o === "number") return { v: String(o), l: String(o) };
  const v = o.v ?? o.value ?? o.key ?? o.code ?? o.l ?? o.label;
  const l = o.l ?? o.label ?? o.text ?? o.nameAr ?? o.name ?? v;
  return v == null && l == null ? null : { v: String(v ?? l), l: String(l ?? v) };
}

function selectInput(field, state, key, options) {
  const s = el("select", "f-in");
  s.append(new Option("— اختر —", ""));
  for (const raw of options ?? field.options ?? []) {
    const o = optionOf(raw);
    if (o) s.append(new Option(o.l, o.v));
  }
  return bindValue(s, field, state, key);
}

/** توقيع بالرسم — يعمل بلا خادم، يُخزَّن data URL */
function signaturePad(field, state, key) {
  const k = key ?? field.key ?? field.id;
  const wrap = el("div", "sig");
  const canvas = el("canvas", "sig-pad");
  canvas.width = 420; canvas.height = 120;
  const ctx2d = canvas.getContext("2d");
  ctx2d.lineWidth = 2; ctx2d.lineCap = "round"; ctx2d.strokeStyle = "#16232e";
  if (state[k]) { const img = new Image(); img.onload = () => ctx2d.drawImage(img, 0, 0); img.src = state[k]; }
  let drawing = false;
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return [p.clientX - r.left, p.clientY - r.top];
  };
  const down = (e) => { drawing = true; ctx2d.beginPath(); ctx2d.moveTo(...pos(e)); e.preventDefault(); };
  const move = (e) => { if (!drawing) return; ctx2d.lineTo(...pos(e)); ctx2d.stroke(); e.preventDefault(); };
  const up = () => { if (!drawing) return; drawing = false; state[k] = canvas.toDataURL("image/png"); };
  canvas.addEventListener("mousedown", down); canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
  canvas.addEventListener("touchstart", down); canvas.addEventListener("touchmove", move);
  canvas.addEventListener("touchend", up);
  const clear = el("button", "btn-ghost sm", "مسح");
  clear.type = "button";
  clear.onclick = () => { ctx2d.clearRect(0, 0, canvas.width, canvas.height); state[k] = ""; };
  wrap.append(canvas, clear);
  return wrap;
}

/** رفع الشواهد — تُكتب في مجلد الشخص داخل المجلد المزامَن */
function filesInput(field, state, ctx, key, multiple) {
  const k = key ?? field.key ?? field.id;
  const wrap = el("div", "files");
  const list = el("div", "files-list");
  const render = () => {
    list.innerHTML = "";
    for (const f of state[k] ?? []) {
      const row = el("div", "file-row");
      row.append(el("span", null, "📎 " + f.name));
      const rm = el("button", "btn-ghost sm", "حذف");
      rm.type = "button";
      rm.onclick = () => { state[k] = (state[k] ?? []).filter((x) => x !== f); render(); };
      row.append(rm);
      list.append(row);
    }
  };
  const input = el("input", "f-in");
  input.type = "file";
  input.multiple = Boolean(multiple);
  if (field.accept) input.accept = field.accept;
  input.onchange = async () => {
    const dir = ctx.evidenceDir + "/" + (field.key || "شواهد");
    for (const file of Array.from(input.files ?? [])) {
      const path = dir + "/" + file.name;
      try {
        await ctx.store.writeBinary(path, await file.arrayBuffer());
        state[k] = (state[k] ?? []).concat([{ name: file.name, path, size: file.size, type: file.type }]);
      } catch (e) {
        state[k] = (state[k] ?? []).concat([{ name: file.name, path: null, error: e.message }]);
      }
    }
    input.value = "";
    render();
  };
  wrap.append(input, list);
  render();
  return wrap;
}

/** جدول متكرر — عمود واحد لكل تعريف، وصفوف تُضاف وتُحذف */
function recurringTable(field, state, ctx) {
  const k = field.key ?? field.id;
  const cols = field.columns ?? [];
  if (!state[k]) {
    const n = field.initialRows ?? field.defaultRows ?? 3;
    state[k] = Array.from({ length: n }, () => ({}));
  }
  const wrap = el("div", "table-wrap");
  const table = el("table", "rec-table");
  const thead = el("thead");
  const htr = el("tr");
  htr.append(el("th", "num", "#"));
  for (const c of cols) htr.append(el("th", null, c.label ?? c.key ?? ""));
  htr.append(el("th", "num", ""));
  thead.append(htr);
  const tbody = el("tbody");
  table.append(thead, tbody);

  const drawRows = () => {
    tbody.innerHTML = "";
    state[k].forEach((row, i) => {
      const tr = el("tr");
      tr.append(el("td", "num", String(i + 1)));
      for (const c of cols) {
        const td = el("td");
        td.append(columnControl(c, row, ctx, field));
        tr.append(td);
      }
      const td = el("td", "num");
      const rm = el("button", "btn-ghost sm", "✕");
      rm.type = "button";
      rm.title = "حذف الصف";
      rm.onclick = () => { state[k].splice(i, 1); drawRows(); };
      td.append(rm);
      tr.append(td);
      tbody.append(tr);
    });
  };
  drawRows();
  wrap.append(table);
  if (field.allowAddRows !== false) {
    const add = el("button", "btn-ghost sm", "+ صف جديد");
    add.type = "button";
    add.onclick = () => { state[k].push({}); drawRows(); };
    wrap.append(add);
  }
  return wrap;
}

/** عناصر التحكم داخل خلايا الجدول — نفس الأنواع لكن بلا عنوان */
function columnControl(col, row, ctx, parent) {
  const f = { ...col, key: col.key };
  switch (col.type) {
    case "TEXTAREA": {
      const t = el("textarea", "f-in sm");
      t.rows = 2;
      return bindValue(t, f, row, col.key);
    }
    case "SELECT": return selectInput(f, row, col.key);
    case "MULTI_SELECT": return selectInput(f, row, col.key);
    case "DATE": return textInput("date", f, row, col.key);
    case "TIME": return textInput("time", f, row, col.key);
    case "NUMBER": return textInput("number", f, row, col.key);
    case "PHONE": return textInput("tel", f, row, col.key);
    case "EMAIL": return textInput("email", f, row, col.key);
    case "BOOLEAN": return textInput("checkbox", f, row, col.key);
    case "TEACHER_PICKER":
      return selectInput(f, row, col.key, (ctx.support?.teachers ?? []).map((t) => t.fullName));
    case "LOOKUP":
      return selectInput(f, row, col.key, lookupOptions(col, ctx));
    case "USER_SIGNATURE": case "REMOTE_SIGNATURE": case "SIGNATURE":
      return signaturePad(f, row, col.key);
    case "FILE": return filesInput(f, row, ctx, col.key, false);
    case "FILES": return filesInput(f, row, ctx, col.key, true);
    default: return textInput("text", f, row, col.key);
  }
}

/** خيارات الـLOOKUP: من البيانات المساندة أولًا، ثم من الإدخالات المحفوظة */
function lookupOptions(field, ctx) {
  const src = field.lookupSource ?? {};
  const from = String(src.field ?? "");
  if (/teacher|fullName|معلم/i.test(from)) return (ctx.support?.teachers ?? []).map((t) => t.fullName);
  if (/staff|منسوب/i.test(from)) return (ctx.support?.staff ?? []).map((s) => s.fullName);
  if (/action|program|برنامج/i.test(from)) return (ctx.support?.actions ?? []).map((a) => a.name);
  const pool = ctx.savedEntries?.[src.recordNumber] ?? [];
  return pool.map((e) => e.data?.[from]).filter(Boolean);
}

/** جدول مربوط تلقائيًا — عرض فقط، من البرامج أو الإدخالات المحفوظة */
function autoLinkedTable(field, ctx) {
  const cfg = field.autoLoad ?? {};
  const cols = field.columns ?? [];
  let rows = [];
  if (String(cfg.source ?? "").startsWith("PlanAction")) {
    rows = (ctx.support?.actions ?? [])
      .filter((a) => !cfg.templateNumber || a.recordTemplateNumber === cfg.templateNumber)
      .slice(0, 200);
  } else if (String(cfg.source ?? "").startsWith("RecordEntry@")) {
    const n = Number(String(cfg.source).split("@")[1]);
    rows = (ctx.savedEntries?.[n] ?? []).flatMap((e) => e.data?.[cfg.field] ?? []);
  }
  const wrap = el("div", "table-wrap");
  if (rows.length === 0) {
    wrap.append(el("div", "warn sm", "لا بيانات مرتبطة بعد — تظهر تلقائيًا حين تُعبَّأ في مصدرها."));
    return wrap;
  }
  const table = el("table", "rec-table ro");
  const htr = el("tr");
  for (const c of cols) htr.append(el("th", null, c.label ?? c.key));
  const thead = el("thead"); thead.append(htr);
  const tbody = el("tbody");
  for (const r of rows) {
    const tr = el("tr");
    for (const c of cols) tr.append(el("td", null, String(r[c.key] ?? "—")));
    tbody.append(tr);
  }
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

/** قسم مكرر — مجموعة حقول تتكرر كعناصر */
function repeatingSection(field, state, ctx) {
  const k = field.key ?? field.id;
  if (!state[k]) {
    const n = field.initialItems ?? field.defaultItems ?? 1;
    state[k] = Array.from({ length: n }, () => ({}));
  }
  const wrap = el("div", "repeat");
  const draw = () => {
    wrap.innerHTML = "";
    state[k].forEach((item, i) => {
      const card = el("div", "repeat-item");
      const head = el("div", "repeat-head");
      head.append(el("b", null, (field.itemLabel ?? "عنصر") + " " + (i + 1)));
      const rm = el("button", "btn-ghost sm", "حذف");
      rm.type = "button";
      rm.onclick = () => { state[k].splice(i, 1); draw(); };
      head.append(rm);
      card.append(head);
      for (const sub of field.fields ?? []) card.append(renderField(sub, item, ctx));
      wrap.append(card);
    });
    const add = el("button", "btn-ghost sm", "+ إضافة " + (field.itemLabel ?? "عنصر"));
    add.type = "button";
    add.onclick = () => { state[k].push({}); draw(); };
    wrap.append(add);
  };
  draw();
  return wrap;
}

/** قائمة المناوبات — أيام الأسبوع بأسماء */
function dutyRoster(field, state, ctx) {
  const k = field.key ?? field.id;
  if (!state[k]) state[k] = AR_DAYS.map((d) => ({ day: d, name: "" }));
  const wrap = el("div", "table-wrap");
  const table = el("table", "rec-table");
  const tbody = el("tbody");
  state[k].forEach((row) => {
    const tr = el("tr");
    tr.append(el("td", "num", row.day));
    const td = el("td");
    td.append(selectInput({ key: "name" }, row, "name", (ctx.support?.staff ?? []).map((s) => s.fullName)));
    tr.append(td);
    tbody.append(tr);
  });
  table.append(tbody);
  wrap.append(table);
  return wrap;
}

/* ── سجلّ المعالجات: مفتاح النوع ⇐ دالة ── */
export const HANDLERS = {
  SECTION_HEADER: (f) => { const h = el("h3", "sec", f.label ?? ""); return h; },
  INFO_BOX: (f) => el("div", "note sm", f.content ?? f.label ?? ""),
  INFO_BLOCK: (f) => el("div", "note sm", f.content ?? f.label ?? ""),
  COLOR_LEGEND: (f) => {
    const w = el("div", "legend");
    for (const it of f.items ?? f.options ?? []) {
      const chip = el("span", "chip", typeof it === "string" ? it : (it.label ?? ""));
      if (it && it.color) chip.style.background = it.color;
      w.append(chip);
    }
    return w;
  },
  JOB_DESCRIPTION_DISPLAY: (f) => el("div", "note sm", f.content ?? "الوصف الوظيفي — يُعرض من الدليل التنظيمي."),

  TEXT: (f, s) => box(f, textInput("text", f, s)),
  EMAIL: (f, s) => box(f, textInput("email", f, s)),
  PHONE: (f, s) => box(f, textInput("tel", f, s)),
  NUMBER: (f, s) => box(f, textInput("number", f, s)),
  SUM_THRESHOLD: (f, s) => box(f, textInput("number", f, s)),
  DATE: (f, s) => box(f, textInput("date", f, s)),
  DATE_DEADLINE: (f, s) => box(f, textInput("date", f, s)),
  TIME: (f, s) => box(f, textInput("time", f, s)),
  DATETIME: (f, s) => box(f, textInput("datetime-local", f, s)),
  CHECKBOX: (f, s) => box(f, textInput("checkbox", f, s)),
  BOOLEAN: (f, s) => box(f, textInput("checkbox", f, s)),
  STUDENT_NAME: (f, s) => box(f, textInput("text", f, s)),
  TEXTAREA: (f, s) => {
    const t = el("textarea", "f-in");
    t.rows = f.rows ?? 3;
    return box(f, bindValue(t, f, s));
  },
  SELECT: (f, s) => box(f, selectInput(f, s)),
  RADIO: (f, s) => box(f, selectInput(f, s)),
  MULTI_SELECT: (f, s) => {
    const w = el("div", "multi");
    const k = f.key ?? f.id;
    if (!s[k]) s[k] = [];
    for (const raw of f.options ?? []) {
      const o = optionOf(raw);
      if (!o) continue;
      const lab = el("label", "chk");
      const cb = el("input"); cb.type = "checkbox"; cb.checked = s[k].includes(o.v);
      cb.onchange = () => { s[k] = cb.checked ? s[k].concat([o.v]) : s[k].filter((x) => x !== o.v); };
      lab.append(cb, el("span", null, o.l));
      w.append(lab);
    }
    return box(f, w);
  },
  TEACHER_PICKER: (f, s, ctx) =>
    box(f, selectInput(f, s, null, (ctx.support?.teachers ?? []).map((t) => t.fullName))),
  LOOKUP: (f, s, ctx) => box(f, selectInput(f, s, null, lookupOptions(f, ctx))),
  SIGNATURE: (f, s) => box(f, signaturePad(f, s)),
  USER_SIGNATURE: (f, s) => box(f, signaturePad(f, s)),
  REMOTE_SIGNATURE: (f, s) => {
    const b = box(f, signaturePad(f, s));
    b.append(el("div", "warn sm", "التوقيع عن بُعد برابط غير متاح بلا خادم — يُوقَّع هنا مباشرة بحضور صاحبه."));
    return b;
  },
  FILE: (f, s, ctx) => box(f, filesInput(f, s, ctx, null, false)),
  FILES: (f, s, ctx) => box(f, filesInput(f, s, ctx, null, true)),
  RECURRING_LOG: (f, s, ctx) => box(f, recurringTable(f, s, ctx)),
  REPEATING_SECTION: (f, s, ctx) => box(f, repeatingSection(f, s, ctx)),
  AUTO_LINKED_TABLE: (f, s, ctx) => box(f, autoLinkedTable(f, ctx)),
  DUTY_ROSTER_LIST: (f, s, ctx) => box(f, dutyRoster(f, s, ctx)),
};

export function renderField(field, state, ctx) {
  if (!field || typeof field !== "object") return el("div");
  if (field.showWhen && !evalShowWhen(field.showWhen, state)) return el("div", "hidden");
  const h = HANDLERS[field.type];
  if (!h) {
    UNSUPPORTED.push({ type: field.type ?? "(بلا نوع)", key: field.key ?? field.id ?? "?" });
    const w = el("div", "err sm", "نوع حقل غير مدعوم: " + (field.type ?? "بلا نوع"));
    return w;
  }
  return h(field, state, ctx);
}

function evalShowWhen(rule, state) {
  if (typeof rule !== "object") return true;
  const [k, v] = Object.entries(rule)[0] ?? [];
  if (!k) return true;
  return Array.isArray(v) ? v.includes(state[k]) : state[k] === v;
}

/** يبني النموذج كاملًا لقالب سجل */
export function renderRecordForm(container, template, state, ctx) {
  container.innerHTML = "";
  const ff = template.formFields ?? {};
  if (ff.primaryData) {
    const head = el("div", "primary");
    for (const [k, def] of Object.entries(ff.primaryData)) {
      const v = resolvePrimary(def, ctx);
      const cell = el("div", "primary-cell");
      cell.append(el("span", "k", def.label ?? k), el("b", null, v ?? "—"));
      head.append(cell);
      state["__" + k] = v;
    }
    container.append(head);
  }
  for (const f of ff.fields ?? []) container.append(renderField(f, state, ctx));
  return container;
}

function resolvePrimary(def, ctx) {
  switch (def.from) {
    case "school.nameAr": return ctx.school?.nameAr;
    case "plan.academicYear.label": return ctx.school?.academicYear?.greg;
    case "context.currentSemester": return ctx.semester ?? "الفصل الأول";
    case "currentUser.fullName": return ctx.person?.fullName;
    case "currentUser.role": return ctx.roleAr;
    default: return def.value ?? (def.from?.includes("Date") ? todayISO() : "");
  }
}
