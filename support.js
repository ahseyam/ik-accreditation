/* ── طلب الدعم ──
   المتصفّح لا يستطيع التحكّم في جهاز آخر — حدٌّ أمنيّ لا نقصٌ فينا. لكن
   معظم طلبات الدعم لا تحتاج رؤية الشاشة بل معرفة **الحالة**. هذا الزرّ
   يجمعها في بطاقة يرسلها المستخدم بالواتساب، فيعرف المستشار في سطرين ما
   كان سيراه في خمس دقائق مشاهدة.
   ⚠️ لا يُرسَل أي محتوى سجل — أرقام وحالات فقط. */

const WA = "966550907874";          // مدير الجودة والتخطيط
const LOG_KEY = "ik-lasterr";

/** يُسجَّل آخر خطأ ظهر للمستخدم — أثمن سطر في البطاقة */
export function trackErrors() {
  const put = (m) => {
    try { localStorage.setItem(LOG_KEY, JSON.stringify({ m: String(m).slice(0, 180), at: Date.now() })); }
    catch { /* ممتلئ */ }
  };
  window.addEventListener("error", (e) => put(e.message));
  window.addEventListener("unhandledrejection", (e) => put(e.reason?.message || e.reason));
}
const lastError = () => {
  try {
    const e = JSON.parse(localStorage.getItem(LOG_KEY) || "null");
    if (!e) return null;
    const mins = Math.round((Date.now() - e.at) / 60000);
    return e.m + (mins < 120 ? " (قبل " + mins + " دقيقة)" : "");
  } catch { return null; }
};

const browser = () => {
  const u = navigator.userAgent;
  if (/Edg\//.test(u)) return "Edge";
  if (/CriOS/.test(u)) return "Chrome على iOS";
  if (/Chrome\//.test(u)) return "Chrome";
  if (/Safari\//.test(u)) return "Safari";
  return "متصفّح آخر";
};
const device = () => {
  const u = navigator.userAgent;
  if (/iPad/.test(u)) return "آيباد";
  if (/iPhone/.test(u)) return "آيفون";
  if (/Android/.test(u)) return "أندرويد";
  if (/Macintosh/.test(u)) return "ماك";
  if (/Windows/.test(u)) return "ويندوز";
  return "جهاز غير معروف";
};
const WAY_AR = { folder: "المجلد المباشر", graph: "حساب مايكروسوفت",
                 pack: "حقيبة عمل", http: "وضع تطوير", readonly: "قراءة فقط" };

/** بطاقة الحالة — أرقام وحالات لا محتوى */
export function supportCard(ctx) {
  const { store, bundle, me, roleAr, counts, drafts, version } = ctx;
  const L = [];
  L.push("🆘 طلب دعم — منظومة الاعتماد الخارجي");
  L.push("المدرسة: " + (bundle?.school?.nameAr || "لم تُفتح بعد"));
  L.push("المستخدم: " + (me?.fullName || "—") + " · " + (me ? roleAr(me.role) : "—"));
  L.push("طريقة العمل: " + (WAY_AR[store?.kind] || "غير متصل"));
  L.push("المجلد المتصل: " + (store?.label ? store.label() : "—"));
  L.push("الجهاز: " + device() + " · " + browser() + " · شاشة " +
         window.innerWidth + "×" + window.innerHeight);
  L.push("الحفظ في المجلد: " + (typeof window.showDirectoryPicker === "function" ? "متاح" : "غير متاح على هذا الجهاز"));
  if (counts) L.push("سجلات فيها إدخالات: " + counts.records + " · شواهد: " + counts.evidence);
  if (drafts?.length) L.push("⚠️ مسوّدات لم تُحفظ: " + drafts.length +
    " (" + drafts.slice(0, 2).map((d) => d.record || d.id).join("، ") + ")");
  if (store?.kind === "pack" && ctx.pending != null)
    L.push("⚠️ إدخالات لم تُرسَل من الحقيبة: " + ctx.pending);
  const e = lastError();
  if (e) L.push("آخر خطأ: " + e);
  L.push("النسخة: " + (version || "—"));
  L.push("الوقت: " + new Date().toLocaleString("ar-SA"));
  L.push("");
  L.push("المشكلة التي أواجهها: ");
  return L.join("\n");
}

export const waLink = (text) =>
  "https://wa.me/" + WA + "?text=" + encodeURIComponent(text);

/** نافذة الدعم: يراجع المستخدم ما سيُرسَل قبل إرساله — لا يُرسَل شيء خفيةً */
export function openSupport(ctx) {
  const card = supportCard(ctx);
  const box = document.createElement("div");
  box.className = "modal";
  box.innerHTML =
    '<div class="modal-card"><h2>طلب دعم</h2>' +
    '<div class="note sm">تُرسَل <b>حالة الجهاز والمنظومة فقط</b> — لا يُرسَل أي محتوى ' +
    "من سجلاتك. راجعها ثم اكتب مشكلتك في آخر الرسالة.</div>" +
    '<textarea class="f-in" id="supTxt" rows="12" style="margin-top:12px;font-size:13px"></textarea>' +
    '<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">' +
    '<button class="b-main" id="supWa">📱 إرسال بالواتساب</button>' +
    '<button class="b-ghost" id="supCopy">📋 نسخ النصّ</button>' +
    '<button class="b-ghost" id="supClose">إغلاق</button>' +
    '<span class="muted" id="supStat"></span></div></div>';
  document.body.append(box);
  box.querySelector("#supTxt").value = card;
  box.querySelector("#supClose").onclick = () => box.remove();
  box.onclick = (ev) => { if (ev.target === box) box.remove(); };
  box.querySelector("#supWa").onclick = () => {
    window.open(waLink(box.querySelector("#supTxt").value), "_blank", "noopener");
  };
  box.querySelector("#supCopy").onclick = async () => {
    try { await navigator.clipboard.writeText(box.querySelector("#supTxt").value);
          box.querySelector("#supStat").textContent = "✅ نُسخ"; }
    catch { box.querySelector("#supStat").textContent = "حدّد النصّ وانسخه يدويًّا"; }
  };
}
