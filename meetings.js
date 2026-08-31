/* جدولة اجتماعات اللجان وبنود جداول أعمالها.

   ⚠️ لماذا هنا لا في المنصة؟ هذا المشروع **منفصل عن جدارة**، فلا ضامن لأي
   ارتباط حيّ بين المصادر. فكل ما كان «يُجلَب آليًا» يُبنى هنا من بيانات الحزمة
   نفسها، ويبقى **قابلًا للتحرير** — فلا يرى المستخدم جدولًا فارغًا بحجّة أنه
   سيمتلئ من مصدره.

   القاعدة المعتمدة (قرار المستشار): **كل اللجان تجتمع يوم الثلاثاء**، وكل
   اجتماع يدرس الأسابيع الفاصلة بينه وبين الاجتماع السابق، ويخطّط للأسابيع
   اللاحقة حتى الاجتماع التالي.                                              */

export const MEETING_DAY = 2;            // الثلاثاء (0=الأحد)
const FREQ_WEEKS = { WEEKLY: 1, BIWEEKLY: 2, MONTHLY: 4, PER_SEMESTER: 19, YEARLY: 38 };

/** تاريخ الثلاثاء في أسبوع دراسي — أسبوعه يبدأ الأحد */
export function tuesdayOf(week) {
  if (!week?.startDate) return null;
  const d = new Date(week.startDate);
  d.setDate(d.getDate() + MEETING_DAY);
  return d;
}

export const fmtDate = (d) =>
  d ? new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d) : "";

/** جدول اجتماعات لجنة عبر أسابيع العام */
export function committeeMeetings(weeks, frequency = "MONTHLY") {
  const step = FREQ_WEEKS[frequency] || 4;
  const list = (weeks || []).filter((w) => !w.isExamWeek);
  const out = [];
  for (let i = 1; i < list.length; i += step) {          // يُتجنّب الأسبوع الأول
    const w = list[i];
    const prev = out[out.length - 1];
    out.push({
      n: out.length + 1,
      week: w, date: tuesdayOf(w),
      semester: w.semester, weekNumber: w.weekNumber,
      coversFrom: prev ? prev.weekNumber : 1,
      coversTo: w.weekNumber,
      nextTo: list[Math.min(i + step, list.length - 1)]?.weekNumber ?? w.weekNumber,
    });
  }
  return out;
}

/** الاجتماع القادم أو الجاري بالنسبة لتاريخ اليوم */
export function nextMeeting(meetings, now = new Date()) {
  return meetings.find((m) => m.date && m.date >= now) || meetings[meetings.length - 1] || null;
}

export function meetingTitle(m, committeeName) {
  if (!m) return committeeName || "محضر اجتماع";
  return "محضر اجتماع " + (committeeName || "اللجنة") + " رقم " + m.n +
         " — الفصل " + (m.semester === 1 ? "الأول" : "الثاني") + " · الأسبوع " + m.weekNumber +
         " · الثلاثاء " + fmtDate(m.date);
}

export function meetingScope(m) {
  if (!m) return "";
  return "يدرس هذا الاجتماع الأسابيع " + m.coversFrom + "–" + m.coversTo +
         "، ويخطّط للأسابيع " + (m.coversTo + 1) + "–" + m.nextTo + ".";
}

/* ── بنود جدول الأعمال ──
   البند الثابت أولًا (متابعة ما لم يُنفَّذ)، ثم المهام الرسمية للجنة موزَّعة
   على الاجتماعات بالتناوب فلا تتكرّر ولا تُهمَل. */
export const STANDING_ITEM =
  "متابعة ما لم يُنفَّذ من توصيات الاجتماع السابق وأسباب عدم التنفيذ";

export function agendaForMeeting(committee, meeting, meetingsCount, perMeeting = 4) {
  const tasks = (committee?.officialTasks || []).map((t) =>
    typeof t === "string" ? t : (t.textAr || t.text || ""));
  const items = [];
  if (meeting && meeting.n > 1) items.push({ n: 1, text: STANDING_ITEM, standing: true });
  if (tasks.length) {
    const idx = meeting ? (meeting.n - 1) : 0;
    for (let k = 0; k < perMeeting; k++) {
      const t = tasks[(idx * perMeeting + k) % tasks.length];
      if (t && !items.some((x) => x.text === t)) items.push({ n: items.length + 1, text: t });
    }
  }
  items.push({ n: items.length + 1, text: "ما يستجدّ من أعمال", standing: true });
  return items;
}
