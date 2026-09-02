/* ── تحرير الروستر: استكمال الوظائف الشاغرة وتغيير شاغلها ──
   أُخرجت من index.html. لا تلمس حالة عامّة: كل ما تحتاجه يصلها في `ctx`
   ويُعاد إليها ما تغيّر — فلا تُفاجئ أحدًا بتعديل في مكان بعيد.
   ctx = { store, roster, rosterOv, roleAr, esc, setStatus, saveRosterEdit, onSaved } */

/* ── استكمال بيانات المنسوبين عند أوّل استلام ──
   الحزم تُسلَّم بأسماء نائبة «[المراقب/ة]» لأن الشركة لم تزوّدنا بها. بدل
   انتظارها، تُكملها المدرسة نفسها في نموذج واحد عند أوّل فتح — وهي أعلم
   بمنسوبيها وأسرع في تحديثهم عند أي تغيير. */
const isPlaceholder = (p) => /^\s*\[.*\]\s*$/.test(String(p?.fullName || ""));

export function setupMissing(ctx) {
  const { store, roster, roleAr, esc, setStatus, saveRosterEdit, onSaved } = ctx;
  const missing = (roster || []).filter(isPlaceholder);
  if (!missing.length) return;
  const box = document.createElement("div");
  box.className = "modal";
  box.innerHTML =
    '<div class="modal-card wide"><h2>استكمال بيانات المنسوبين</h2>' +
    '<div class="note sm">' + missing.length + " وظيفة بلا اسم. أكملها الآن فيستطيع أصحابها الدخول. " +
    "الملفات مرتبطة <b>بالوظيفة</b> لا بالاسم، فتنتقل تلقائيًا عند أي تغيير لاحق.</div>" +
    '<div class="setup-rows">' + missing.map((p, i) =>
      '<div class="setup-row" data-i="' + i + '">' +
        '<div class="sr-role">' + esc(roleAr(p.role)) + "</div>" +
        '<input class="f-in sr-name" placeholder="الاسم الرباعي" autocomplete="off">' +
        '<input class="f-in sr-mail" type="email" placeholder="البريد على نطاق الشركة" autocomplete="off">' +
        '<input class="f-in sr-no" placeholder="الرقم الوظيفي" autocomplete="off" inputmode="numeric">' +
      "</div>").join("") + "</div>" +
    '<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">' +
    '<button class="b-main" id="suSave">حفظ ما عبّأت</button>' +
    '<button class="b-ghost" id="suClose">لاحقًا</button>' +
    '<span class="muted" id="suStat"></span></div></div>';
  document.body.append(box);
  box.querySelector("#suClose").onclick = () => box.remove();
  box.onclick = (e) => { if (e.target === box) box.remove(); };
  box.querySelector("#suSave").onclick = async () => {
    const rows = [...box.querySelectorAll(".setup-row")];
    const todo = rows.map((r) => ({ p: missing[+r.dataset.i],
      fullName: r.querySelector(".sr-name").value.trim(),
      email: r.querySelector(".sr-mail").value.trim(),
      employeeNo: r.querySelector(".sr-no").value.trim() }))
      .filter((x) => x.fullName);
    if (!todo.length) { box.querySelector("#suStat").textContent = "لم تُدخِل أي اسم"; return; }
    box.querySelector("#suStat").textContent = "جارٍ الحفظ…";
    let done = 0;
    for (const x of todo) {
      try { ctx.rosterOv = await saveRosterEdit(store, x.p,
        { fullName: x.fullName, email: x.email, employeeNo: x.employeeNo }); done++; }
      catch (e) { box.querySelector("#suStat").textContent = "تعذّر: " + e.message; return; }
    }
    box.remove();
    setStatus("حُفظ " + done + " اسمًا في مجلد المدرسة", "ok");
    await onSaved(ctx.rosterOv);
  };
}

export function editPerson(person, ctx) {
  const { store, rosterOv, roleAr, esc, setStatus, saveRosterEdit, onSaved } = ctx;
  const box = document.createElement("div");
  box.className = "modal";
  box.innerHTML =
    '<div class="modal-card"><h2>تغيير شاغل وظيفة «' + esc(roleAr(person.role)) + '»</h2>' +
    '<div class="note sm">الملفات والسجلات مرتبطة <b>بالوظيفة</b> لا بالاسم، ' +
    'فتنتقل كاملةً إلى الشاغل الجديد فور الحفظ. ولا يُخلى طرف السابق قبل ذلك.</div>' +
    '<div class="field"><div class="f-label">الاسم الحالي</div>' +
    '<input class="f-in" id="edName" value="' + esc(person.fullName || "") + '"></div>' +
    '<div class="field"><div class="f-label">بريد العمل بالشركة</div>' +
    '<input class="f-in" id="edMail" type="email" placeholder="البريد الرسمي على نطاق الشركة" value="' +
    esc(person.email || "") + '"></div>' +
    '<div class="field"><div class="f-label">الرقم الوظيفي</div>' +
    '<input class="f-in" id="edNo" value="' + esc(person.employeeNo || "") + '"></div>' +
    '<div id="edHist"></div>' +
    '<div style="display:flex;gap:10px;margin-top:16px">' +
    '<button class="b-main" id="edSave">حفظ ونقل الملفات</button>' +
    '<button class="b-ghost" id="edCancel">إلغاء</button>' +
    '<span class="muted" id="edStat"></span></div></div>';
  document.body.append(box);
  const hist = ((ctx.rosterOv || rosterOv || {}).history || []).filter((h) => h.role === person.role);
  if (hist.length) box.querySelector("#edHist").innerHTML =
    '<div class="muted" style="margin-top:10px">سجل التغيير: ' +
    hist.map((h) => esc(h.from || "—") + " ← " + esc(h.to)).join(" · ") + "</div>";
  box.querySelector("#edCancel").onclick = () => box.remove();
  box.onclick = (e) => { if (e.target === box) box.remove(); };
  box.querySelector("#edSave").onclick = async () => {
    const next = { fullName: box.querySelector("#edName").value.trim(),
                   email: box.querySelector("#edMail").value.trim(),
                   employeeNo: box.querySelector("#edNo").value.trim() };
    if (!next.fullName) { box.querySelector("#edStat").textContent = "الاسم مطلوب"; return; }
    box.querySelector("#edStat").textContent = "جارٍ الحفظ…";
    try {
      ctx.rosterOv = await saveRosterEdit(store, person, next);
      box.remove(); await onSaved(ctx.rosterOv);
    } catch (e) { box.querySelector("#edStat").textContent = "❌ " + e.message; }
  };
}

