/* ── نشر الاستبانة للجمهور: مساران معًا والمدرسة تختار ──
   أُخرجت من index.html. الإعدادات تُمرَّر ويُعاد الجديد عبر `onSettings`
   بدل الكتابة في متغيّر عامّ بعيد. */
import { $, esc } from "./ui-state.js?v=be6160b6";
import { surveyLink, extractCodes } from "./survey.js?v=be6160b6";
import { newEntryId } from "./app.js?v=be6160b6";
import { saveSettings } from "./vault.js?v=be6160b6";
import { toolResponsePath, scaleMax } from "./tools.js?v=be6160b6";

export const SURVEY_BASE = () =>
  location.origin + location.pathname.replace(/[^/]*$/, "") + "استبانة.html";

export function renderPublish({ tool, store, school, settings, onSettings }) {
  const curTool = tool;
  const box = $("publishBox");
  if (curTool.type !== "SURVEY") { box.classList.add("hidden"); return; }
  box.classList.remove("hidden");
  const wa = settings.waNumber || "", api = settings.surveyApi || "";
  const link = surveyLink(SURVEY_BASE(), { tool: curTool.key, school: school.nameAr, wa, api });
  box.innerHTML =
    "<h2>نشر الاستبانة للجمهور</h2>" +
    '<div class="muted" style="margin-bottom:14px">أرسل الرابط لأولياء الأمور أو الطلاب أو المعلمين. ' +
    "الاستجابة <b>لا تحمل اسمًا</b>. ⚠️ وإن اعتمدت مسار الواتساب فسيظهر لك " +
    "<b>رقم جوّال المرسِل</b> — أعلِمهم بذلك، والمسار السحابي وحده مجهول تمامًا.</div>" +
    '<div class="grid c2">' +
      '<div class="field"><div class="f-label">رقم واتساب المدرسة (يستقبل الردود)</div>' +
      '<input class="f-in" id="waNum" placeholder="9665XXXXXXXX" value="' + esc(wa) + '">' +
      '<div class="f-help">يفتح لولي الأمر رسالة جاهزة يرسلها بنقرة — بلا خادم إطلاقًا.</div></div>' +
      '<div class="field"><div class="f-label">نقطة الاستقبال السحابية (اختيارية)</div>' +
      '<input class="f-in" id="apiUrl" placeholder="https://…workers.dev/collect" value="' + esc(api) + '">' +
      '<div class="f-help">إن ضُبطت وصلت الاستجابة مباشرة كما في المنصة، وإلا سقط للواتساب.</div></div>' +
    "</div>" +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px">' +
      '<button class="b-main" id="saveChan">حفظ القنوات</button>' +
      '<button class="b-ghost" id="copyLink">📋 نسخ رابط الاستبانة</button>' +
      '<a class="b-ghost" style="padding:10px 18px;border-radius:9px;border:1px solid var(--line-2);text-decoration:none" href="' +
        esc(link) + '" target="_blank">فتح الاستبانة</a>' +
      '<span class="muted" id="chanStat"></span></div>' +
    '<div class="note sm" style="word-break:break-all">' + esc(link) + "</div>" +
    '<h3 style="margin-top:20px">استقبال الردود الواردة بالواتساب</h3>' +
    '<div class="muted" style="margin-bottom:9px">الصق الرسائل هنا كما وصلتك — ولو مجتمعة — ' +
    "ويستخرج النظام كل رمز ويحفظه استجابةً.</div>" +
    '<textarea class="f-in" id="waPaste" rows="4" placeholder="الصق رسائل الواتساب هنا…"></textarea>' +
    '<div style="display:flex;gap:10px;align-items:center;margin-top:11px">' +
      '<button class="b-main" id="waImport">استخراج وحفظ</button>' +
      '<span class="muted" id="waStat"></span></div>';

  $("saveChan").onclick = async () => {
    const next = await saveSettings(store, { waNumber: $("waNum").value.trim(),
                                            surveyApi: $("apiUrl").value.trim() });
    // ⚠️ لا تُكتب الإعدادات في متغيّر عامّ بعيد — تُعاد لصاحبها ثم يُعاد الرسم
    if (onSettings) onSettings(next);
    renderPublish({ tool, store, school, settings: next, onSettings });
    $("chanStat").textContent = "✅ حُفظت القنوات";
  };
  $("copyLink").onclick = async () => {
    try { await navigator.clipboard.writeText(link); $("chanStat").textContent = "📋 نُسخ الرابط"; }
    catch { $("chanStat").textContent = "انسخه من الصندوق أدناه"; }
  };
  $("waImport").onclick = async () => {
    const codes = extractCodes($("waPaste").value);
    if (!codes.length) { $("waStat").textContent = "لم يُعثر على أي رمز صالح"; return; }
    $("waStat").textContent = "جارٍ الحفظ…";
    let ok = 0;
    for (const c of codes) {
      if (c.toolKey !== curTool.key) continue;
      try {
        const id = newEntryId() + "-" + Math.random().toString(36).slice(2, 6);
        await store.writeJson(toolResponsePath(curTool.key, id), {
          toolKey: curTool.key, toolName: curTool.nameAr, type: curTool.type,
          scaleType: curTool.scaleType, scaleMax: scaleMax(curTool),
          responseId: id, savedAt: new Date().toISOString(),
          respondentLabel: "وارد بالواتساب", channel: "whatsapp",
          school: school.nameAr, answers: c.answers, evidenceCounts: {},
        });
        ok++;
      } catch { /* يُتجاوز */ }
    }
    $("waStat").textContent = "✅ حُفظت " + ok + " استجابة من " + codes.length + " رمزًا";
    $("waPaste").value = "";
  };
}
