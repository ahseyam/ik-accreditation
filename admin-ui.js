/* واجهة لوحة إدارة المنصّة — العرض والتفاعل. المنطق في admin.js. */
import { $, esc, findSchools, readSchool, approve, markShared, unmarkShared, EDIT_ROLES } from "./admin.js?v=6371dcbc";
import { FolderStore } from "./storage.js?v=6371dcbc";

const K_ROOT = "ik.admin.onedriveUrl";
let rows = [], tab = "schools", sortKey = "school", sortDir = 1, sel = null;
const ME = "مدير الجودة والتخطيط";

if (!FolderStore.supported()) {
  $("intro").innerHTML = '<div class="err"><b>هذه اللوحة تحتاج قراءة المجلدات.</b><br>' +
    "افتحها على حاسب ويندوز أو ماك بمتصفّح Google Chrome أو Microsoft Edge.</div>";
  $("pick").disabled = true;
}

$("pick").onclick = async () => {
  try {
    /* ⚠️ readwrite لا read: الاعتماد يُكتب في مجلد المدرسة نفسه. ولو فُتح
       للقراءة لظهرت الأزرار وأخفقت عند أوّل ضغطة. */
    const root = await window.showDirectoryPicker({ id: "ik-admin", mode: "readwrite" });
    await scan(root);
  } catch (e) { if (e?.name !== "AbortError") $("status").textContent = "❌ " + e.message; }
};
$("rescan").onclick = () => $("pick").click();
$("print").onclick = () => window.print();

async function scan(root) {
  $("prog").classList.remove("hidden");
  $("status").textContent = "يبحث عن المدارس…";
  const found = await findSchools(root, (t) => { $("status").textContent = "وجد: " + t; });
  if (!found.length) {
    $("prog").classList.add("hidden");
    $("intro").innerHTML = '<div class="err"><b>لم أجد مدارس في هذا المجلد.</b><br>' +
      "اختر مجلد <b>مساحة الاعتماد ١٤٤٨</b> نفسه — الذي يحوي المجمعات الأربعة.</div>";
    return;
  }
  rows = [];
  for (const [i, f] of found.entries()) {
    $("status").textContent = "يقرأ " + (i + 1) + " من " + found.length + " — " + f.trail.join(" / ");
    $("prog").firstElementChild.style.width = (((i + 1) / found.length) * 100).toFixed(0) + "%";
    try { rows.push(await readSchool(f.handle, f.trail)); }
    catch (e) { rows.push({ school: f.trail.join(" / "), error: e.message, people: [], pending: [], needShare: [] }); }
  }
  $("prog").classList.add("hidden");
  $("status").textContent = "اكتمل: " + rows.filter((r) => !r.error).length + " مدرسة";
  $("rescan").classList.remove("hidden"); $("print").classList.remove("hidden");
  $("intro").innerHTML = ""; $("main").classList.remove("hidden");
  fillFilters(); render();
}

function fillFilters() {
  const uniq = (k) => [...new Set(rows.map((r) => r[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar"));
  const fill = (id, vals) => {
    const s = $(id), keep = s.firstElementChild.outerHTML;
    s.innerHTML = keep + vals.map((v) => '<option>' + esc(v) + "</option>").join("");
  };
  fill("fComplex", uniq("complex")); fill("fTrack", uniq("track")); fill("fStage", uniq("stageGender"));
  for (const id of ["q", "fComplex", "fTrack", "fStage", "fState"]) $(id).oninput = render;
}

const filtered = () => {
  const q = ($("q").value || "").trim();
  const c = $("fComplex").value, t = $("fTrack").value, s = $("fStage").value, st = $("fState").value;
  return rows.filter((r) => {
    if (r.error) return false;
    if (c && r.complex !== c) return false;
    if (t && r.track !== t) return false;
    if (s && r.stageGender !== s) return false;
    if (st === "active" && !r.active) return false;
    if (st === "idle" && r.active) return false;
    if (st === "missing" && !r.missing) return false;
    if (q && !r.school.includes(q) && !r.people.some((p) => (p.fullName || "").includes(q))) return false;
    return true;
  });
};

function render() {
  const ok = rows.filter((r) => !r.error);
  const pend = ok.reduce((a, r) => a + r.pending.length, 0);
  const share = ok.reduce((a, r) => a + r.needShare.length, 0);
  const miss = ok.reduce((a, r) => a + r.missing, 0);
  const act = ok.filter((r) => r.active).length;

  $("kpis").innerHTML = [
    ["المدارس", ok.length, ""],
    ["بدأت العمل", act + " من " + ok.length, act ? "ok" : "warn"],
    ["بانتظار اعتمادك", pend, pend ? "bad" : "ok"],
    ["بانتظار المشاركة", share, share ? "warn" : "ok"],
    ["أسماء ناقصة", miss, miss ? "warn" : "ok"],
    ["إدخالات محفوظة", ok.reduce((a, r) => a + r.entries, 0), ""],
  ].map(([l, v, c]) => '<div class="kpi-b ' + c + '"><div class="v">' + esc(String(v)) +
      '</div><div class="l">' + esc(l) + "</div></div>").join("");

  $("tabs").innerHTML = [
    ["schools", "المدارس", ok.length, false],
    ["pending", "بانتظار اعتمادك", pend, pend > 0],
    ["share", "الصلاحيات والمشاركة", share, share > 0],
  ].map(([k, l, n, alert]) =>
    '<button class="tab' + (tab === k ? " on" : "") + (alert ? " alert" : "") + '" data-t="' + k + '">' +
    esc(l) + '<span class="n">' + n + "</span></button>").join("");
  $("tabs").querySelectorAll(".tab").forEach((b) => {
    b.onclick = () => { tab = b.dataset.t; render(); };
  });
  $("filters").classList.toggle("hidden", tab !== "schools");

  if (tab === "schools") renderSchools();
  else if (tab === "pending") renderPending();
  else renderShare();
}

const COLS = [
  { k: "school", l: "المدرسة", r: true },
  { k: "complex", l: "المجمع", sm: true },
  { k: "track", l: "المسار", sm: true },
  { k: "stageGender", l: "المرحلة", sm: true },
  { k: "state", l: "الحالة" },
  { k: "missing", l: "أسماء ناقصة" },
  { k: "pendingN", l: "بانتظار اعتمادك" },
  { k: "shareN", l: "بانتظار المشاركة" },
  { k: "entries", l: "إدخالات", sm: true },
  { k: "evidence", l: "شواهد", sm: true },
  { k: "last", l: "آخر نشاط", sm: true },
];

function renderSchools() {
  const list = filtered().map((r) => ({ ...r, pendingN: r.pending.length, shareN: r.needShare.length }));
  list.sort((a, b) => {
    const x = a[sortKey], y = b[sortKey];
    return (typeof x === "string" ? String(x).localeCompare(String(y), "ar") : (x || 0) - (y || 0)) * sortDir;
  });
  if (!list.length) { $("body").innerHTML = '<div class="empty">لا مدرسة تطابق التصفية.</div>'; return; }
  $("body").innerHTML =
    '<table class="adm-t"><thead><tr>' +
    COLS.map((c) => '<th data-k="' + c.k + '"' + (c.sm ? ' class="hide-sm"' : "") + ">" + esc(c.l) +
      (sortKey === c.k ? (sortDir > 0 ? " ↑" : " ↓") : "") + "</th>").join("") +
    "</tr></thead><tbody>" +
    list.map((r, i) =>
      '<tr data-i="' + i + '">' +
      '<td class="r"><b>' + esc(r.school) + "</b></td>" +
      '<td class="hide-sm">' + esc(r.complex) + "</td>" +
      '<td class="hide-sm">' + esc(r.track) + "</td>" +
      '<td class="hide-sm">' + esc(r.stageGender) + "</td>" +
      "<td>" + (r.active ? '<span class="pill p-ok">تعمل</span>'
                         : '<span class="pill p-gray">لم تبدأ</span>') + "</td>" +
      "<td>" + num(r.missing, "warn") + "</td>" +
      "<td>" + num(r.pendingN, "bad") + "</td>" +
      "<td>" + num(r.shareN, "warn") + "</td>" +
      '<td class="hide-sm">' + r.entries + "</td>" +
      '<td class="hide-sm">' + r.evidence + "</td>" +
      '<td class="hide-sm">' + esc(r.last || "—") + "</td></tr>").join("") +
    "</tbody></table>";
  $("body").querySelectorAll("th").forEach((th) => {
    th.onclick = () => {
      if (sortKey === th.dataset.k) sortDir *= -1; else { sortKey = th.dataset.k; sortDir = 1; }
      render();
    };
  });
  $("body").querySelectorAll("tbody tr").forEach((tr) => {
    tr.onclick = () => openSide(list[+tr.dataset.i]);
  });
}
const num = (n, cls) => n ? '<span class="pill p-' + cls + '">' + n + "</span>" : '<span class="muted">—</span>';

/* ── بانتظار اعتمادك: ما أدخلته المدارس ولم تعتمده بعد ── */
function renderPending() {
  const items = [];
  for (const r of rows) for (const p of (r.pending || [])) items.push({ r, p });
  if (!items.length) {
    $("body").innerHTML = '<div class="empty">✅ لا شيء ينتظر اعتمادك.<br>' +
      '<span class="muted">حين تُدخل مدرسةٌ بيانات منسوبيها تظهر هنا.</span></div>';
    return;
  }
  $("body").innerHTML =
    '<div class="howto"><b>ما معنى الاعتماد؟</b> أنك راجعتَ الاسم والبريد والرقم الوظيفي ' +
    "ووافقت عليها. يُكتب الاعتماد في مجلد المدرسة نفسه. " +
    "<b>ولا يمنح صلاحية OneDrive</b> — المنح خطوةٌ عند مايكروسوفت تجدها في تبويب " +
    "«الصلاحيات والمشاركة» جاهزةً بالبريد والمجلد.</div>" +
    '<table class="adm-t"><thead><tr><th>المدرسة</th><th>الوظيفة</th><th>الاسم</th>' +
    '<th class="hide-sm">البريد</th><th class="hide-sm">الرقم الوظيفي</th><th>أدخلتها</th><th>الإجراء</th>' +
    "</tr></thead><tbody>" +
    items.map((x, i) =>
      '<tr><td class="r">' + esc(x.r.school) + "</td>" +
      "<td>" + esc(x.p.roleAr) + "</td>" +
      '<td class="r"><b>' + esc(x.p.fullName) + "</b></td>" +
      '<td class="hide-sm"><span class="mail">' + esc(x.p.email || "—") + "</span></td>" +
      '<td class="hide-sm">' + esc(x.p.employeeNo || "—") + "</td>" +
      "<td>" + esc(String(x.p.submittedAt).slice(0, 10)) + "</td>" +
      '<td><button class="b-main b-xs" data-ap="' + i + '">اعتماد</button></td></tr>').join("") +
    "</tbody></table>";
  $("body").querySelectorAll("[data-ap]").forEach((b) => {
    b.onclick = async (e) => {
      e.stopPropagation();
      const x = items[+b.dataset.ap];
      b.disabled = true; b.textContent = "…";
      try {
        await approve(x.r, x.p.id, ME);
        x.r.pending = x.r.people.filter((p) => p.submittedAt && !p.approvedAt);
        x.r.needShare = x.r.people.filter((p) => EDIT_ROLES.includes(p.role) && p.approvedAt && !p.sharedAt && p.email);
        render();
      } catch (err) { b.disabled = false; b.textContent = "❌ " + err.message; }
    };
  });
}

/* ── الصلاحيات: أمر المشاركة جاهزًا، وتتبّع ما شُورك ── */
function renderShare() {
  const items = [];
  for (const r of rows) for (const p of (r.needShare || [])) items.push({ r, p });
  const done = rows.flatMap((r) => (r.people || [])
    .filter((p) => p.sharedAt && EDIT_ROLES.includes(p.role)).map((p) => ({ r, p })));

  const base = localStorage.getItem(K_ROOT) || "";
  const head =
    '<div class="howto"><b>لماذا هذه الخطوة يدوية؟</b> منح صلاحية على مجلد OneDrive ' +
    "عمليةٌ عند مايكروسوفت، تحتاج تسجيل تطبيق في Azure وهو محجوب في نطاق معارف. " +
    "فلا يستطيع أي موقعٍ منحها نيابةً عنك — ومن يدّعي ذلك يكذب.<br>" +
    "<b>وهذه هي الحماية الحقيقية:</b> من لا تمنحه صلاحية التحرير لا يستطيع الحفظ مهما فعل.<br><br>" +
    "<b>لكل صفّ:</b> افتح مجلد المدرسة في OneDrive ← <b>مشاركة</b> ← ⚙️ ← " +
    "<b>«أشخاص محددون»</b> مع <b>«السماح بالتحرير»</b> ← الصق البريد ← إرسال. ثم اضغط «تمّت المشاركة».<br>" +
    '<span class="muted">⚠️ لا تختر «أي شخص لديه الرابط» — يجعل الرابط مفتاحًا لمن وصله.</span>' +
    '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
    '<input class="f-in" id="odUrl" placeholder="ألصق رابط مجلدك في OneDrive (اختياري)" ' +
    'style="flex:1 1 300px" value="' + esc(base) + '">' +
    '<button class="b-ghost b-xs" id="odSave">حفظ الرابط</button></div></div>';

  if (!items.length && !done.length) {
    $("body").innerHTML = head + '<div class="empty">لا أحد ينتظر صلاحية.<br>' +
      '<span class="muted">تظهر هنا بعد اعتماد الوكيل التعليمي أو منسق الجودة.</span></div>';
    bindOd(); return;
  }
  $("body").innerHTML = head +
    (items.length ? '<table class="adm-t"><thead><tr><th>المدرسة</th><th>مسار المجلد</th>' +
      "<th>الوظيفة</th><th>الاسم</th><th>البريد</th><th>الإجراء</th></tr></thead><tbody>" +
      items.map((x, i) =>
        '<tr><td class="r">' + esc(x.r.school) + "</td>" +
        '<td class="r"><span class="mail">' + esc(x.r.trail.join(" / ")) + "</span></td>" +
        "<td>" + esc(x.p.roleAr) + "</td>" +
        '<td class="r">' + esc(x.p.fullName) + "</td>" +
        '<td><span class="mail">' + esc(x.p.email) + "</span></td>" +
        '<td><div class="acts">' +
        '<button class="b-ghost b-xs" data-copy="' + i + '">نسخ البريد</button>' +
        '<button class="b-main b-xs" data-done="' + i + '">تمّت المشاركة</button>' +
        "</div></td></tr>").join("") + "</tbody></table>"
      : '<div class="empty">✅ كل من يحتاج صلاحية مُنحها.</div>') +
    (done.length ? '<h2 style="font-size:16px;margin:22px 0 10px">مُنحت الصلاحية (' + done.length + ")</h2>" +
      '<table class="adm-t"><thead><tr><th>المدرسة</th><th>الوظيفة</th><th>الاسم</th>' +
      "<th>البريد</th><th>بتاريخ</th><th></th></tr></thead><tbody>" +
      done.map((x, i) =>
        '<tr><td class="r">' + esc(x.r.school) + "</td><td>" + esc(x.p.roleAr) + "</td>" +
        '<td class="r">' + esc(x.p.fullName) + "</td>" +
        '<td><span class="mail">' + esc(x.p.email || "—") + "</span></td>" +
        "<td>" + esc(String(x.p.sharedAt).slice(0, 10)) + "</td>" +
        '<td><button class="b-ghost b-xs" data-undo="' + i + '">تراجع</button></td></tr>').join("") +
      "</tbody></table>" : "");

  bindOd();
  $("body").querySelectorAll("[data-copy]").forEach((b) => {
    b.onclick = async () => {
      const x = items[+b.dataset.copy];
      try { await navigator.clipboard.writeText(x.p.email); b.textContent = "✅ نُسخ"; }
      catch { b.textContent = x.p.email; }
      setTimeout(() => (b.textContent = "نسخ البريد"), 2200);
    };
  });
  $("body").querySelectorAll("[data-done]").forEach((b) => {
    b.onclick = async () => {
      const x = items[+b.dataset.done];
      b.disabled = true;
      await markShared(x.r, x.p.id, ME);
      x.r.needShare = x.r.people.filter((p) => EDIT_ROLES.includes(p.role) && p.approvedAt && !p.sharedAt && p.email);
      render();
    };
  });
  $("body").querySelectorAll("[data-undo]").forEach((b) => {
    b.onclick = async () => {
      const x = done[+b.dataset.undo];
      b.disabled = true;
      await unmarkShared(x.r, x.p.id);
      x.r.needShare = x.r.people.filter((p) => EDIT_ROLES.includes(p.role) && p.approvedAt && !p.sharedAt && p.email);
      render();
    };
  });
}
function bindOd() {
  const s = $("odSave");
  if (s) s.onclick = () => {
    localStorage.setItem(K_ROOT, ($("odUrl").value || "").trim());
    s.textContent = "✅ حُفظ"; setTimeout(() => (s.textContent = "حفظ الرابط"), 1800);
  };
}

/* ── لوحة المدرسة الجانبية ── */
function openSide(r) {
  sel = r;
  const st = (p) => p.placeholder ? '<span class="pill p-gray">بلا اسم</span>'
    : p.sharedAt ? '<span class="pill p-ok">مشارَك</span>'
    : p.approvedAt ? '<span class="pill p-warn">بانتظار المشاركة</span>'
    : p.submittedAt ? '<span class="pill p-bad">بانتظار اعتمادك</span>'
    : '<span class="pill p-gray">من الحزمة</span>';
  $("side").innerHTML =
    '<button class="close" id="sClose" aria-label="إغلاق">✕</button>' +
    "<h2>" + esc(r.school) + "</h2>" +
    '<div class="muted" style="margin-bottom:14px">' + esc(r.trail.join(" / ")) + "</div>" +
    '<div class="kpis" style="grid-template-columns:repeat(3,1fr)">' +
    [["إدخالات", r.entries], ["شواهد", r.evidence], ["أسماء ناقصة", r.missing]]
      .map(([l, v]) => '<div class="kpi-b"><div class="v">' + v + '</div><div class="l">' + l + "</div></div>").join("") +
    "</div>" +
    '<div class="muted" style="margin:10px 0 16px">آخر نشاط: <b>' + esc(r.last || "لم تبدأ بعد") + "</b></div>" +
    (r.pending.length ? '<button class="b-main" id="sApproveAll" style="margin-bottom:14px">' +
      "اعتماد الـ" + r.pending.length + " المنتظِرة كلّها</button>" : "") +
    "<h2 style=\"font-size:15px;margin:6px 0 4px\">المنسوبون (" + r.people.length + ")</h2>" +
    r.people.map((p) =>
      '<div class="prow"><div class="who"><b>' + esc(p.fullName) + "</b>" +
      "<span>" + esc(p.roleAr) + (p.email ? " · " + esc(p.email) : "") + "</span></div>" +
      "<div>" + st(p) + "</div></div>").join("");
  $("side").classList.remove("hidden"); $("scrim").classList.remove("hidden");
  $("sClose").onclick = closeSide;
  const aa = $("sApproveAll");
  if (aa) aa.onclick = async () => {
    aa.disabled = true; aa.textContent = "جارٍ الاعتماد…";
    for (const p of [...r.pending]) await approve(r, p.id, ME);
    r.pending = r.people.filter((p) => p.submittedAt && !p.approvedAt);
    r.needShare = r.people.filter((p) => EDIT_ROLES.includes(p.role) && p.approvedAt && !p.sharedAt && p.email);
    openSide(r); render();
  };
}
function closeSide() { $("side").classList.add("hidden"); $("scrim").classList.add("hidden"); sel = null; }
$("scrim").onclick = closeSide;
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sel) closeSide(); });
