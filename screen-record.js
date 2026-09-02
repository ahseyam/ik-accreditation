/* ── شاشة السجل ──
   أُخرجت من index.html **بحالتها معها**: القالب الجاري وإدخاله ومعرّفه
   وأسبوعه ملكُ هذه الشاشة. لا تُقرأ من الخارج إلا بالسؤال.
   ctx = { store, bundle, me, myRecords, mySignature, roleAr, afterSave, goList } */
import { STAGE_AR, entryDir, entryPath, evidenceDir, freqAr, newEntryId, roleAr } from "./app.js?v=61dde03b";
import { currentWeek, fillContext, semesterLabel } from "./autofill.js?v=61dde03b";
import { committeeMeetings, meetingScope, meetingTitle, nextMeeting } from "./meetings.js?v=61dde03b";
import { printRecord } from "./print.js?v=61dde03b";
import { UNSUPPORTED, buildGuide, buildLabelCanon, renderRecordForm, setFillContext } from "./record.js?v=61dde03b";
import { $, esc, markNav, only } from "./ui-state.js?v=61dde03b";
import { backupEntry } from "./vault.js?v=61dde03b";

let recState = null, recTemplate = null, recEntryId = null, recIndex = -1, fillWeek = null;
let CTX = null;

/* إدخالات السجل المحفوظة — جزء من الشاشة لا من الملفّ العامّ */
async function listSaved(number) {
  try {
    const items = await CTX.store.list(entryDir(CTX.me, number));
    return items.filter((f) => f.kind !== "directory" && f.name.endsWith(".json"))
                .map((f) => f.name.replace(/\.json$/, ""));
  } catch { return []; }
}

export const currentRecord = () => ({ template: recTemplate, state: recState, entryId: recEntryId });

export async function openRecord(number, entryId, ctx) {
  CTX = ctx || CTX;
  const { store, bundle, me, myRecords, roleAr } = CTX;
  fillWeek = currentWeek(bundle.support?.weeks);
  recIndex = myRecords.findIndex((r) => r.number === number);
  recTemplate = myRecords[recIndex];
  if (!recTemplate) return;
  recEntryId = entryId || newEntryId();
  recState = {};
  if (entryId) {
    try { recState = (await store.readJson(entryPath(me, number, entryId))).data || {}; } catch {}
  }
  only("screenRecord"); markNav("records");
  $("recTitle").textContent = recTemplate.seq + ". " + recTemplate.nameAr;
  $("recMeta").textContent =
    "التعبئة: " + freqAr(recTemplate.fillFrequency) +
    (recTemplate.etecIndicators.length ? " · مؤشرات ETEC: " + recTemplate.etecIndicators.join("، ") : "") +
    " · الإدخال: " + recEntryId +
    (fillWeek ? " · " + semesterLabel(fillWeek) + " الأسبوع " + fillWeek.weekNumber : "");
  $("recPos").textContent = recTemplate.seq + " من " + myRecords.length;
  $("recPrev").disabled = recIndex <= 0;
  $("recNext").disabled = recIndex >= myRecords.length - 1;
  $("recStatus").textContent = "";

  const saved = await listSaved(number);
  $("recSaved").innerHTML = saved.length
    ? '<div class="note sm">إدخالات محفوظة: ' +
      saved.map((id) => '<a href="#" data-id="' + esc(id) + '">' + esc(id) + "</a>").join(" · ") + "</div>"
    : "";
  $("recSaved").querySelectorAll("a").forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); openRecord(number, a.dataset.id); };
  });

  // سياق التعبئة التلقائية + لوحة «كيف يعمل هذا السجل»
  const fill = fillContext(bundle, me, roleAr, STAGE_AR[bundle.school.stage]);
  fill.mySignature = CTX.mySignature;
  setFillContext(fill);
  // توحيد صيغ المسمّيات المكرّرة — يُبنى من الحزمة مرّة واحدة
  buildLabelCanon(bundle.records.records || bundle.records);
  $("recGuide").innerHTML = "";
  $("recGuide").append(buildGuide(recTemplate, { roleArFn: roleAr,
    verifyTool: bundle.tools.tools.find((t) => t.key === "EVIDENCE_VERIFICATION") }));

  const before = UNSUPPORTED.length;
  // سياق اللجان: مفتاح اللجنة من القالب، وجدول اجتماعاتها بالثلاثاءات
  const cKey = recTemplate.formFields?.committeeKey ||
    (recTemplate.formFields?.fields || []).map((f) => f.autoLoad?.whereKey).find(Boolean) || null;
  const committee = (bundle.support?.committees || []).find((c) => c.key === cKey);
  const meetings = committee ? committeeMeetings(bundle.support.weeks, committee.meetingFrequency) : [];
  const meeting = meetings.length ? nextMeeting(meetings) : null;
  if (committee && meeting) {
    $("recMeta").textContent += " · " + meetingTitle(meeting, committee.nameAr);
    $("recGuide").insertAdjacentHTML("beforeend",
      '<div class="note sm meeting-scope"><b>نطاق هذا الاجتماع:</b> ' + esc(meetingScope(meeting)) + "</div>");
  }
  renderRecordForm($("recForm"), recTemplate, recState, {
    store, support: bundle.support, school: bundle.school, person: me,
    roleAr: roleAr(me.role), roleArFn: roleAr, savedEntries: {},
    committeeKey: cKey, committee, meetings, meeting,
    evidenceDir: evidenceDir(me, number, recEntryId),
  });
  if (UNSUPPORTED.length > before)
    $("recStatus").textContent = "⚠️ " + (UNSUPPORTED.length - before) + " حقلًا بلا معالج";
  window.scrollTo(0, 0);
}

/** يربط أزرار الشاشة مرّة واحدة عند الإقلاع */
export function bindRecordScreen(ctx) {
  CTX = ctx;
  
  $("recPrev").onclick = () => recIndex > 0 && openRecord(CTX.myRecords[recIndex - 1].number);
  $("recNext").onclick = () => recIndex < CTX.myRecords.length - 1 && openRecord(CTX.myRecords[recIndex + 1].number);
  $("recSave").onclick = async () => {
    $("recStatus").textContent = "جارٍ الحفظ…";
    try {
      await CTX.store.writeJson(entryPath(CTX.me, recTemplate.number, recEntryId), {
        recordNumber: recTemplate.number, displaySeq: recTemplate.seq, recordName: recTemplate.nameAr,
        entryId: recEntryId, savedAt: new Date().toISOString(),
        person: CTX.me.fullName, role: CTX.me.role, roleAr: roleAr(CTX.me.role),
        school: CTX.bundle.school.nameAr, academicYear: CTX.bundle.school.academicYear.greg,
        etecIndicators: recTemplate.etecIndicators, data: recState,
      });
      const bk = await backupEntry(CTX.store, { kind: "سجلات", sourcePath: entryPath(CTX.me, recTemplate.number, recEntryId),
        data: { recordNumber: recTemplate.number, recordName: recTemplate.nameAr, entryId: recEntryId, data: recState },
        person: CTX.me.fullName, roleAr: roleAr(CTX.me.role) });
      CTX.afterSave && CTX.afterSave();
      $("recStatus").textContent = "✅ حُفظ في مجلدك — " + new Date().toLocaleTimeString("ar-SA") +
        (bk.ok ? " · ونُسخ للمستودع" : " · ⚠️ تعذّر النسخ للمستودع");
    } catch (e) { $("recStatus").textContent = "❌ تعذّر الحفظ: " + e.message; }
  };
  $("recPrint").onclick = async () => {
    $("recStatus").textContent = "جارٍ تجهيز المطبوع…";
    try {
      await printRecord(recTemplate, recState, {
        store: CTX.store, school: CTX.bundle.school, person: CTX.me, roleAr: roleAr(CTX.me.role), entryId: recEntryId });
      $("recStatus").textContent = "";
    } catch (e) { $("recStatus").textContent = "❌ تعذّرت الطباعة: " + e.message; }
  };
  
}
