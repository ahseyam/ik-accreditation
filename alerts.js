/* تنبيهات التنفيذي — ما المطلوب منه الآن، محسوبًا من التوقيت الزمني للخطة.

   القاعدة: لا تنبيه بلا سبب مقيس. كل تنبيه يذكر **لماذا استُحقّ** و**متى**،
   ويفتح الشاشة التي تُغلقه. والحساب كله من مجلد المدرسة بلا خادم.        */

import { currentWeek } from "./autofill.js?v=b226bdaf";
import { committeeMeetings, tuesdayOf, fmtDate } from "./meetings.js?v=b226bdaf";

export const LEVELS = { late: 0, today: 1, week: 2, soon: 3 };
const LEVEL_AR = { late: "متأخّر", today: "اليوم", week: "هذا الأسبوع", soon: "قادم" };
export const levelAr = (l) => LEVEL_AR[l] ?? l;

const DAY = 86400000;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** معرّف الإدخال «YYYY-MM-DD_HHMMSS» ⇐ تاريخ */
export function entryDate(id) {
  const m = String(id).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

/** آخر إدخال لكل سجل في مجلد هذا المستخدم */
export async function myEntryDates(store, person, personFolder) {
  const out = {};
  let recs = [];
  try { recs = await store.list(personFolder(person) + "/سجلات"); } catch { return out; }
  for (const r of recs) {
    if (r.kind !== "directory") continue;
    try {
      const files = await store.list(personFolder(person) + "/سجلات/" + r.name);
      const dates = files.filter((f) => f.name.endsWith(".json"))
        .map((f) => entryDate(f.name.replace(/\.json$/, ""))).filter(Boolean);
      if (dates.length) out[Number(r.name)] = new Date(Math.max(...dates.map((d) => +d)));
    } catch { /* فارغ */ }
  }
  return out;
}

/** كم يومًا تسمح به دورية السجل قبل أن يصير متأخّرًا */
const GRACE = { DAILY: 1, WEEKLY: 7, MONTHLY: 30, PER_SEMESTER: 120, YEARLY: 250, ANNUAL: 250 };
const TRACKED = Object.keys(GRACE);

/**
 * يبني قائمة التنبيهات. لا يعتمد على شبكة ولا خادم — كل شيء من المجلد.
 * @returns [{ id, level, title, why, when, go }]
 */
export function buildAlerts({ myRecords, entryDates, weeks, execTasks, execState,
                              myTools, toolSummaries, committees, role, now = new Date() }) {
  const A = [];
  const W = currentWeek(weeks, now);
  const today = startOfDay(now);

  // ① السجلات الدورية المستحقّة
  for (const r of myRecords || []) {
    if (!TRACKED.includes(r.fillFrequency)) continue;
    const last = entryDates?.[r.number];
    const grace = GRACE[r.fillFrequency];
    if (!last) {
      A.push({ id: "rec-" + r.number, level: r.fillFrequency === "DAILY" ? "today" : "week",
        title: "سجل " + r.seq + " · " + r.nameAr,
        why: "لم يُعبَّأ بعد — دوريته " + freqWord(r.fillFrequency),
        when: "", go: { screen: "record", number: r.number } });
      continue;
    }
    const days = Math.floor((today - startOfDay(last)) / DAY);
    if (days > grace) {
      A.push({ id: "rec-" + r.number, level: "late",
        title: "سجل " + r.seq + " · " + r.nameAr,
        why: "آخر إدخال قبل " + days + " يومًا، ودوريته " + freqWord(r.fillFrequency),
        when: fmtDate(last), go: { screen: "record", number: r.number } });
    } else if (days === grace) {
      A.push({ id: "rec-" + r.number, level: "today",
        title: "سجل " + r.seq + " · " + r.nameAr,
        why: "حان موعد التعبئة التالية اليوم", when: fmtDate(last),
        go: { screen: "record", number: r.number } });
    }
  }

  // ② مهام الأسبوع الحالي في الخطة التنفيذية
  if (W && execTasks?.length) {
    const mine = execTasks.filter((t) => t.semester === W.semester && t.week === W.weekNumber);
    const done = mine.filter((t) => execState?.done?.[W.semester + "-" + W.weekNumber + "-" + t.order]).length;
    if (mine.length && done < mine.length) {
      A.push({ id: "exec-week", level: "week",
        title: "مهام الأسبوع " + W.weekNumber + " في خطتك التنفيذية",
        why: (mine.length - done) + " مهمة من " + mine.length + " لم تُعلَّم منفَّذة",
        when: "الفصل " + (W.semester === 1 ? "الأول" : "الثاني"),
        go: { screen: "exec" } });
    }
  }

  // ③ اجتماع لجنة هذا الأسبوع
  for (const c of committees || []) {
    if (!(c.members || []).some((m) => m.role === role)) continue;
    const ms = committeeMeetings(weeks, c.meetingFrequency);
    const m = ms.find((x) => W && x.semester === W.semester && x.weekNumber === W.weekNumber);
    if (!m) continue;
    const d = startOfDay(m.date), diff = Math.round((d - today) / DAY);
    A.push({ id: "mtg-" + c.key,
      level: diff < 0 ? "late" : diff === 0 ? "today" : "week",
      title: "اجتماع " + c.nameAr,
      why: diff === 0 ? "ينعقد اليوم — الثلاثاء"
         : diff > 0 ? "بعد " + diff + " يومًا — الثلاثاء" : "كان قبل " + (-diff) + " يومًا",
      when: fmtDate(m.date), go: { screen: "records" } });
  }

  // ④ أدوات مسندة إليك بلا استجابة
  for (const t of myTools || []) {
    if (!t.mine) continue;
    const s = (toolSummaries || []).find((x) => x.key === t.tool.key);
    if (s && s.responses === 0) {
      A.push({ id: "tool-" + t.tool.key, level: "soon",
        title: t.tool.nameAr, why: "مسندة إليك ولم تُسجَّل فيها استجابة بعد",
        when: "", go: { screen: "tool", key: t.tool.key } });
    }
  }

  // ⑤ الخطة التنفيذية لم تُحفظ
  if (execTasks?.length && !execState?._saved) {
    A.push({ id: "exec-save", level: "soon", title: "خطتك التنفيذية",
      why: "لم تُحفظ نسخة منها في مجلدك بعد", when: "", go: { screen: "exec" } });
  }

  A.sort((a, b) => LEVELS[a.level] - LEVELS[b.level]);
  return A;
}

function freqWord(f) {
  return { DAILY: "يومية", WEEKLY: "أسبوعية", MONTHLY: "شهرية",
           PER_SEMESTER: "كل فصل", YEARLY: "سنوية", ANNUAL: "سنوية" }[f] || f;
}

export const urgentCount = (alerts) =>
  alerts.filter((a) => a.level === "late" || a.level === "today").length;
