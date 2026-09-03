/* ── حقائب العمل واستلام الإدخالات ──
   أُخرجت من index.html. تستورد ما تحتاجه من الوحدات مباشرةً، ولا يصلها من
   الحالة العامّة إلا المحوّل والحزمة والروستر — وتُبلّغ باستيرادها عبر
   `onImported` بدل أن تنادي دوال الشاشة من جوفها. */
import { $, esc, setStatus } from "./ui-state.js?v=4f2d8248";
import { sortHierarchy, recordsFor, roleAr, countSavedRecords } from "./app.js?v=4f2d8248";
import { scopeTools } from "./scope.js?v=4f2d8248";
import { canSeeImprovement } from "./scope.js?v=4f2d8248";
import { buildWorkPack, workPackName, deliver, readPackFile, importEntries,
         relay, setRelay, syncFromCloud } from "./bridge.js?v=4f2d8248";

export function vaultBridge({ store, bundle, roster, onImported }) {
  const list = sortHierarchy(roster || []);
  $("packMake").innerHTML =
    '<div class="pack-grid">' + list.map((p, i) =>
      '<button class="pk" data-i="' + i + '"><b>' + esc(p.fullName || "—") + "</b>" +
      '<span class="muted">' + esc(roleAr(p.role)) + "</span></button>").join("") + "</div>" +
    '<div class="f-help" id="pkMsg" style="margin-top:10px"></div>';
  $("packMake").querySelectorAll("button.pk").forEach((b) => {
    b.onclick = async () => {
      const person = list[+b.dataset.i];
      // ⚠️ recordsFor يعيد { owned, shared } لا مصفوفة — والحقيبة تحمل الاثنين
      const { owned, shared } = recordsFor(bundle.records.records, person.role);
      const recs = owned.concat(shared);
      const pack = buildWorkPack(bundle, person, recs);
      // أدواته وحدها بنطاق وظيفته — نفس ما يراه لو دخل من حاسب
      pack.أدوات = scopeTools(bundle.tools.tools, person.role, bundle.support)
        .filter((x) => x.visible).map((x) => x.tool);
      pack.تحسين = canSeeImprovement(person.role) ? bundle.improvement : { indicatorScores: [] };
      pack.نتائج = bundle.results || {};
      const how = await deliver(workPackName(bundle.school, person), pack);
      $("pkMsg").textContent = how === "cancelled" ? "" :
        (how === "share" ? "شارك الحقيبة مع " : "نزلت حقيبة ") + (person.fullName || "") +
        " · " + recs.length + " سجلًا";
    };
  });

  const r0 = relay();
  if ($("relayUrl")) { $("relayUrl").value = r0?.url || ""; $("relayKey").value = r0?.key || ""; }
  const rs = $("relaySave");
  if (rs) rs.onclick = () => {
    const url = $("relayUrl").value.trim(), key = $("relayKey").value.trim();
    if (!url) { setRelay(null); setStatus("أُلغيت نقطة الاستقبال", "warn"); return; }
    setRelay({ url, key });
    setStatus("حُفظت نقطة الاستقبال", "ok");
  };

  const show = (res) => {
    $("impMsg").innerHTML =
      '<div class="' + (res.done.length ? "ok" : "warn") + ' sm">كُتب ' + res.done.length +
      " إدخالًا" + (res.failed.length ? " · تعذّر " + res.failed.length : "") + "</div>" +
      (res.done.length ? '<ul class="imp-list">' + res.done.slice(0, 12).map((p) =>
        "<li>" + esc(p) + "</li>").join("") + "</ul>" : "") +
      (res.failed.length ? '<ul class="imp-list bad">' + res.failed.slice(0, 8).map((f) =>
        "<li>" + esc(f.path) + " — " + esc(f.why) + "</li>").join("") + "</ul>" : "");
    countSavedRecords(store).then(() => onImported && onImported());
  };

  const fb = $("impFileBtn"), fi = $("impFile");
  if (fb) fb.onclick = () => fi.click();
  if (fi) fi.onchange = async () => {
    const files = [...(fi.files || [])];
    const all = { done: [], failed: [] };
    for (const f of files) {
      try {
        const { obj, chk } = await readPackFile(f);
        if (chk.kind !== "entries") throw new Error("ليس ملف إدخالات");
        const res = await importEntries(store, obj);
        all.done.push(...res.done); all.failed.push(...res.failed);
      } catch (e) { all.failed.push({ path: f.name, why: e.message }); }
    }
    show(all); fi.value = "";
  };

  const cp = $("cloudPull");
  if (cp) cp.onclick = async () => {
    if (!relay()?.url) { $("impMsg").innerHTML = '<div class="warn sm">اضبط نقطة الاستقبال أولًا.</div>'; return; }
    cp.disabled = true; $("impMsg").textContent = "جارٍ السحب…";
    try {
      const res = await syncFromCloud(store, bundle.school?.nameAr || "");
      show(res);
      if (!res.packs) $("impMsg").innerHTML = '<div class="note sm">لا إدخالات جديدة.</div>';
    } catch (e) { $("impMsg").innerHTML = '<div class="err">' + esc(e.message) + "</div>"; }
    cp.disabled = false;
  };
}
