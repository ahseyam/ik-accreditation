import { $ } from "./ui-state.js?v=d4f59295";
/* ── دليل الاستخدام: الطرق الثلاث ──
   المستخدم يختار طريقته مرّة، فيُذكَّر بها في كل جلسة ويعرف **أين** يجد
   ملفاته و**بأي اسم**. لا وعود عامة: كل طريقة بخطواتها وقيودها وثمنها. */

export const WAYS = [
  {
    key: "folder",
    icon: "💻",
    name: "المجلد المباشر",
    tag: "الأسهل والأضمن",
    who: "حاسب ويندوز أو ماك · متصفّح Chrome أو Edge",
    needs: "لا حساب · لا تسجيل دخول · لا إنترنت · ولا حاجة إلى OneDrive",
    steps: [
      "افتح الرابط على الحاسب بمتصفّح Chrome أو Edge.",
      "اضغط «اختر مجلد الاعتماد الخارجي».",
      "اختر مجلد المدرسة — أي مجلد على القرص يصلح: سطح المكتب أو المستندات أو مجلد OneDrive مزامَن.",
      "حين يسأل المتصفّح «Edit files?» اختر «Save changes» — وليس «View only».",
      "اختر اسمك من القائمة، فتظهر سجلاتك أنت وحدك.",
      "عبّئ واضغط «حفظ في مجلدي». يُكتب فورًا على القرص.",
    ],
    where: "داخل المجلد الذي اخترته",
    files: [
      ["سجلاتك", "مخرجات/<ترتيبك> - <وظيفتك>/سجلات/<رقم السجل>/<التاريخ>.json"],
      ["شواهدك", "مخرجات/<ترتيبك> - <وظيفتك>/شواهد/<رقم السجل>/<التاريخ>/"],
      ["توقيعك", "إدارة/تواقيع/<ترتيبك> - <وظيفتك>.json"],
      ["نسخة المستودع", "مستودع/سجلات/<وظيفتك>/<التاريخ>.json"],
    ],
    limits: [
      "لا يعمل على الجوّال ولا الآيباد — قيد من آبل لا منّا.",
      "بلا OneDrive تبقى ملفاتك على هذا الحاسب وحده: لا يراها المدير ولا المستشار، ولا نسخة احتياطية.",
    ],
  },
  {
    key: "graph",
    icon: "☁️",
    name: "حساب مايكروسوفت",
    tag: "⚠️ غير متاح لدينا",
    who: "أي جهاز — لو كان الحساب يسمح",
    needs: "صلاحية تسجيل تطبيق في Azure",
    steps: [
      "هذا الطريق مُعطَّل في شركة معارف: حساب الشركة لا يملك صلاحية تسجيل تطبيق في Azure.",
      "جُرِّب بتاريخ ٢ سبتمبر ٢٠٢٦م فكانت النتيجة: «تم تسجيل دخولك بنجاح إلا أنه لا يتوفر لديك الإذن للوصول إلى هذا المورد».",
      "فتحُه يحتاج مسؤولًا تقنيًّا — وقد استُبعد ذلك بقرارك.",
      "يبقى مذكورًا هنا لأنه يعمل فورًا لو تغيّرت الصلاحية يومًا.",
    ],
    where: "لا ينطبق — الطريق مغلق حاليًا",
    files: [["—", "—"]],
    limits: [
      "لا تنتظره: استعمل «المجلد المباشر» على الحاسب، و«حقيبة العمل» على الجوّال.",
    ],
  },
  {
    key: "pack",
    icon: "📦",
    name: "حقيبة العمل",
    tag: "بلا حساب ولا تسجيل",
    who: "جوّال أو آيباد · بلا أي حساب",
    needs: "لا حساب ولا تسجيل دخول — وحاسبٌ واحد في المدرسة يستقبل",
    steps: [
      "يجهّز لك مستودع المدرسة (على حاسبه) «حقيبة عمل» باسمك ويرسلها لك بالواتساب.",
      "احفظ الملف في جوّالك، ثم افتح الرابط واضغط «فتح حقيبة عمل» واختر الملف.",
      "تظهر سجلاتك كاملةً وتعمل عليها بلا إنترنت.",
      "حين تنتهي اضغط «إرسال ما عبّأت»:",
      "• إن كانت نقطة الاستقبال مُفعَّلة — يصل عملك مباشرةً بضغطة، بلا واتساب.",
      "• وإلّا يخرج ملف واحد تشاركه بالواتساب مع مستودع المدرسة.",
      "يستورده حاسب المستودع بضغطة، فتُكتب إدخالاتك في مواضعها تمامًا كما لو عبّأتها بنفسك.",
    ],
    where: "في مجلد المدرسة على حاسب المستودع — بعد أن يستورد ملفك",
    files: [
      ["ما ترسله أنت", "إدخالات — <اسمك> — <التاريخ>.json"],
      ["بعد الاستيراد", "مخرجات/<ترتيبك> - <وظيفتك>/سجلات/…"],
    ],
    limits: [
      "بلا نقطة استقبال: خطوة يدوية في كل مرّة — إرسال الملف واستيراده.",
      "⚠️ الشواهد (الصور والملفات) لا تُرسَل داخل الملف — أرسلها بالواتساب منفصلةً.",
      "ما لم تُرسله يبقى في متصفّح جوّالك فقط: لا تمسح بيانات المتصفّح قبل الإرسال.",
    ],
  },
];

const KEY = "ik-way";
export const chosenWay = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
};
export const chooseWay = (key) =>
  localStorage.setItem(KEY, JSON.stringify({ key, at: new Date().toISOString() }));
export const wayByKey = (k) => WAYS.find((w) => w.key === k) || null;

/** الطريقة التي يعمل بها فعلًا الآن — من نوع المحوّل لا من اختياره */
export const wayOfStore = (store) =>
  store?.kind === "folder" ? "folder"
  : store?.kind === "graph" ? "graph"
  : store?.kind === "pack" ? "pack" : null;


/* ── عرض الدليل ──
   خرجت من index.html: لا تعرف غير المحوّل، وكل ما تحتاجه من بياناتها هنا. */
export function renderGuide({ store, esc, setStatus, onChoose }) {
  const actual = wayOfStore(store), picked = chosenWay();
  const w = wayByKey(actual) || wayByKey(picked?.key);
  $("wayNow").innerHTML = !w ? "" :
    '<div class="way-now"><b>' + esc(w.icon + " أنت تعمل بطريقة: " + w.name) + "</b>" +
    "<div>ملفاتك تُحفظ <b>" + esc(w.where) + "</b>.</div>" +
    '<table class="way-files"><tbody>' + w.files.map(([k, v]) =>
      "<tr><td>" + esc(k) + '</td><td class="mono">' + esc(v) + "</td></tr>").join("") +
    "</tbody></table>" +
    (picked?.key && actual && picked.key !== actual
      ? '<div class="warn sm" style="margin-top:10px">اخترتَ «' + esc(wayByKey(picked.key)?.name) +
        "» لكنك تعمل الآن بـ«" + esc(w.name) + "».</div>" : "") + "</div>";

  $("wayList").innerHTML = WAYS.map((x) => {
    const on = picked?.key === x.key, live = actual === x.key;
    return '<details class="way' + (live ? " live" : "") + '"' + (on || live ? " open" : "") + ">" +
      "<summary><span class='way-ic'>" + x.icon + "</span><b>" + esc(x.name) + "</b>" +
      '<span class="tag ' + (live ? "gold" : "gray") + '">' + esc(live ? "طريقتك الحالية" : x.tag) + "</span>" +
      "</summary>" +
      '<div class="way-body">' +
        '<div class="way-meta"><b>الجهاز:</b> ' + esc(x.who) + "</div>" +
        '<div class="way-meta"><b>يحتاج:</b> ' + esc(x.needs) + "</div>" +
        "<ol class='way-steps'>" + x.steps.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ol>" +
        "<div class='way-where'><b>أين تجد ملفاتك:</b> " + esc(x.where) + "</div>" +
        '<table class="way-files"><tbody>' + x.files.map(([k, v]) =>
          "<tr><td>" + esc(k) + '</td><td class="mono">' + esc(v) + "</td></tr>").join("") + "</tbody></table>" +
        "<div class='way-lim'><b>ما يجب أن تعرفه:</b><ul>" +
          x.limits.map((t) => "<li>" + esc(t) + "</li>").join("") + "</ul></div>" +
        '<button class="' + (on ? "b-ghost" : "b-main") + '" data-way="' + esc(x.key) + '">' +
          (on ? "✅ هذه طريقتي المعتمدة" : "أوافق — هذه طريقتي") + "</button>" +
      "</div></details>";
  }).join("");
  $("wayList").querySelectorAll("button[data-way]").forEach((b) => {
    b.onclick = () => {
      const x = wayByKey(b.dataset.way);
      chooseWay(x.key);
      setStatus("اعتمدتَ «" + x.name + "» — ملفاتك " + x.where, "ok");
      renderGuide({ store, esc, setStatus, onChoose });
    };
  });
}
