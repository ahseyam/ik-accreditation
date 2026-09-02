/* ── بحث عام: السجلات والأدوات والمؤشرات ──
   دالة خالصة: تتلقّى ما تبحث فيه وما تفعله عند الاختيار، ولا تعرف حالة
   عامّة ولا تنادي شاشة. فتُختبر بلا متصفّح. */

export const SEARCH_MIN = 2;   // حرفان: أقلّ منهما يُطابق كل شيء فلا يفيد
export const SEARCH_MAX = 12;  // أكثر من ذلك لا يُقرأ في قائمة منسدلة

export function globalSearch(q, { records = [], tools = [], indicators = [], go = {} } = {}) {
  const t = String(q ?? "").trim();
  if (t.length < SEARCH_MIN) return [];
  const hits = [];
  for (const r of records) {
    if (String(r.nameAr || "").includes(t))
      hits.push({ kind: "سجل", label: r.seq + ". " + r.nameAr,
                  go: () => go.record && go.record(r.number) });
  }
  for (const x of tools) {
    const tool = x.tool || x;
    if (String(tool.nameAr || "").includes(t))
      hits.push({ kind: "أداة", label: tool.nameAr, go: () => go.tool && go.tool(tool.key) });
  }
  for (const i of indicators) {
    if (String(i.code || "").includes(t) || String(i.textAr || "").includes(t))
      hits.push({ kind: "مؤشر", label: i.code + " · " + String(i.textAr || "").slice(0, 56),
                  go: () => go.improvement && go.improvement() });
  }
  return hits.slice(0, SEARCH_MAX);
}
