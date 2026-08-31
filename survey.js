/* ترميز استجابات الاستبانة — نصّ قصير يُرسَل بالواتساب أو يُرفع للنقطة السحابية.
   الإجابات أرقام 1..5 لكل فقرة، فتُضغط في سلسلة أرقام واحدة ثم تُغلَّف. */

export const SEP = "-";

/* ⚠️ الرمز **لا يحمل اسم المدرسة**: الاسم فيه مسافات وشرطات فيكسر الاستخراج
   من رسالة واتساب. قِيس: صفر رمز مستخرَج من رسالة صحيحة. والمدرسة معروفة
   أصلًا من الرقم الذي استقبل الرسالة. الصيغة: IK1-<الأداة>-<الأرقام> */
export function encodeAnswers(toolKey, _schoolIgnored, answers, count) {
  let digits = "";
  for (let n = 1; n <= count; n++) digits += String(answers[n] ?? 0);
  return ["IK1", toolKey, digits].join(SEP);
}

export function decodeAnswers(code) {
  const parts = String(code || "").trim().split(SEP);
  if (parts.length < 3 || parts[0] !== "IK1") return null;
  const toolKey = parts[1], digits = parts[2];
  if (!/^\d+$/.test(digits)) return null;
  const answers = {};
  [...digits].forEach((d, i) => { const v = Number(d); if (v >= 1 && v <= 5) answers[i + 1] = v; });
  return { toolKey, answers, answered: Object.keys(answers).length, total: digits.length };
}

/** يستخرج كل الرموز من نصّ ملصوق (رسائل واتساب مجمّعة) */
export function extractCodes(text) {
  const out = [];
  for (const m of String(text || "").matchAll(/IK1-[A-Z_]+-\d+/g)) {
    const d = decodeAnswers(m[0]);
    if (d && d.answered) out.push({ code: m[0], ...d });
  }
  return out;
}

/** رابط الاستبانة العام */
export function surveyLink(base, { tool, school, wa, api }) {
  const u = new URL(base);
  u.searchParams.set("t", tool);
  if (school) u.searchParams.set("s", school);
  if (wa) u.searchParams.set("wa", wa);
  if (api) u.searchParams.set("api", api);
  return u.toString();
}
