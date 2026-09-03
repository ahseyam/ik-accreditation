/* ── شاشة الاتصال: المجلد أوّلًا، ثم الحقيبة، ثم مايكروسوفت ──
   أُخرجت من index.html. لا تقرأ حالة مشتركة ولا تكتبها — كل ما تصنعه محوّل
   تُسلّمه إلى `onStore`، فمن يملك الحالة هو من يضعه فيها. */
import { $, esc } from "./ui-state.js?v=461ca160";
import { FolderStore } from "./storage.js?v=461ca160";
import { GraphStore, setGraphConfig, setGraphRoot } from "./graph.js?v=461ca160";
import { readPackFile, PackStore } from "./bridge.js?v=461ca160";

export function renderConnect(state, onStore) {
  const start = onStore;
  const box = $("connectBody");
  if (state === "unsupported") {
    /* ⚠️ الآيفون والآيباد لا يملكان واجهة المجلدات بقرار آبل، **ومعظم
       التنفيذيين يعملون من الآيفون**. فالمنع يعطّل المنظومة لأكثر مستخدميها.
       الطريق الوحيد الذي يعمل هناك: Microsoft Graph — اتصال شبكي عادي
       بحساب الشركة نفسه، بلا كلمة سرّ تمرّ بنا. */
    const ready = GraphStore.configured();
    // العنوان الأصلي يتحدّث عن اختيار مجلد — لا مجلد هنا، فيُبدَّل معه
    $("connectH1").textContent = ready ? "الاتصال بمساحة مدرستك" : "ضبط الاتصال — مرّة واحدة";
    $("connectSub").textContent = ready
      ? "الحفظ في المجلد لا يعمل على الجوّالات وأجهزة آبل — وهذا قيد من آبل لا منّا."
      : "الجوّالات وأجهزة آبل لا تحفظ في المجلد — وهذا قيد من آبل لا منّا.";
    box.innerHTML =
      '<div class="blockcard">' +
        '<div class="blockicon">' + (ready ? "☁️" : "⚙️") + "</div>" +
        "<h2>" + (ready ? "خياران للعمل من هذا الجهاز" : "هذا الجهاز يحتاج حاسبًا") + "</h2>" +
        "<p><b>الأسهل والأضمن: افتح الرابط على حاسب</b> (ويندوز أو ماك) بكروم أو " +
        "إيدج — يحفظ في مجلدك مباشرةً، بلا تسجيل دخول وبلا إنترنت، " +
        "<b>وبلا حاجة إلى OneDrive</b>: أي مجلد على القرص يكفي.</p>" +
        "<p>وإن لم يتوفّر حاسب، فهذا الجهاز يعمل بالاتصال بحساب " +
        "<b>مايكروسوفت 365</b> الخاص بك — نفس البريد الذي تدخل به. " +
        "<b>لا تمرّ كلمة السرّ بنا</b>: تسجيل الدخول في صفحة مايكروسوفت نفسها.</p>" +
        (ready
          ? '<button class="b-main" id="gIn">🔐 تسجيل الدخول بحساب الشركة</button>'
          : '<div class="note" style="margin-bottom:14px">لم يُفعَّل الدخول لهذه المدرسة بعد — ' +
            "أبلغ مستشار الاعتماد. وحتى ذلك الحين استعمل <b>حاسبًا</b> بكروم أو إيدج.</div>" +
            '<details class="setup-adv"><summary>للمستشار — الضبط لمرّة واحدة</summary>' +
            '<div class="blockdo"><b>خمس دقائق، مرّة واحدة:</b><ol>' +
            "<li><b>بحسابك أنت — لا عبر تقنية المعلومات:</b> سجّل تطبيقًا في " +
            "<b>Azure — App registrations</b> بنوع «حسابات في أي مؤسسة»، وأضف " +
            "<b>SPA redirect URI</b> بعنوان هذه الصفحة. التسجيل مجاني ولا يمسّ " +
            "أنظمة الشركة.</li>" +
            "<li>انسخ <b>Application (client) ID</b> والصقه هنا:</li></ol>" +
            '<input class="f-in" id="gCid" placeholder="00000000-0000-0000-0000-000000000000" ' +
            'style="margin-top:10px" inputmode="latin"><button class="b-main" id="gSave" ' +
            'style="margin-top:10px">حفظ وتفعيل</button>' +
            '<div class="f-help" style="margin-top:9px">للتعميم على الجميع: ضع المعرّف في ' +
            "<b>graph-config.json</b> داخل القشرة بدل تخزينه في هذا الجهاز.</div></div></details>") +
        '<div class="f-help" id="gMsg" style="margin-top:12px"></div>' +
        '<div class="or-sep">أو بلا أي حساب</div>' +
        '<button class="b-ghost" id="packBtn">📦 فتح حقيبة عمل وصلتني</button>' +
        '<input type="file" id="packFile" accept=".json,application/json" hidden>' +
        '<div class="f-help" style="margin-top:8px">يجهّزها لك مستودع المدرسة ويرسلها بالواتساب.</div>' +

      "</div>";
    const say = (t, cls) => { $("gMsg").innerHTML = cls ? '<div class="' + cls + '">' + esc(t) + "</div>" : esc(t); };
    const sv = $("gSave");
    if (sv) sv.onclick = () => {
      const id = ($("gCid").value || "").trim();
      if (!/^[0-9a-fA-F-]{30,40}$/.test(id)) return say("المعرّف غير صالح — انسخه كما هو من Azure.", "err");
      setGraphConfig({ clientId: id });
      renderConnect("unsupported", onStore);
    };
    const pb = $("packBtn"), pf = $("packFile");
    if (pb) pb.onclick = () => pf.click();
    if (pf) pf.onchange = async () => {
      const f = pf.files?.[0]; if (!f) return;
      try {
        const { obj, chk } = await readPackFile(f);
        if (chk.kind !== "work") throw new Error("هذا ملف إدخالات لا حقيبة عمل.");
        await start(new PackStore(obj));
      } catch (e) { say(e.message, "err"); }
      pf.value = "";
    };
    const gi = $("gIn");
    if (gi) gi.onclick = async () => {
      say("جارٍ فتح صفحة مايكروسوفت…");
      try {
        await GraphStore.signIn();
        const list = await GraphStore.candidates();
        const folders = list.filter((x) => /اعتماد|Accred/i.test(x.name)).concat(list);
        if (!folders.length) return say("لم أجد مجلدات في حسابك — اطلب من المدير مشاركة مجلد «الاعتماد الخارجي».", "err");
        $("gMsg").innerHTML = "<div style='margin-top:8px'>اختر مجلد مدرستك:</div>" +
          '<div class="folder-pick">' + folders.slice(0, 25).map((f, i) =>
            '<button data-i="' + i + '">📁 ' + esc(f.name) +
            '<span class="muted"> · ' + esc(f.from) + "</span></button>").join("") + "</div>";
        $("gMsg").querySelectorAll("button").forEach((b) => {
          b.onclick = async () => {
            const f = folders[+b.dataset.i];
            setGraphRoot({ driveId: f.driveId, itemId: f.itemId, name: f.name });
            try { await start(new GraphStore(f)); }
            catch (e) { say("تعذّر فتح المجلد: " + e.message, "err"); }
          };
        });
      } catch (e) { say(e.message, "err"); }
    };
    return;
  }
  box.innerHTML =
    '<button class="b-main" id="pickBtn">اختر مجلد الاعتماد الخارجي</button>' +
    '<div class="note" style="margin-top:18px">لم يشارك المدير المجلد معك بعد؟ اطلب منه ' +
    'مشاركة مجلد «الاعتماد الخارجي» من OneDrive، ثم أضِفه باختصار إلى ملفاتك ليُزامَن على جهازك.</div>' +
    '<div id="connectErr" style="margin-top:14px"></div>';
  $("pickBtn").onclick = async () => {
    try { await start(await FolderStore.pick()); }
    catch (e) {
      if (e && e.name === "AbortError") return;
      $("connectErr").innerHTML = '<div class="err">' + esc(e.message) + "</div>";
    }
  };
}
