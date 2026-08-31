/* أدوات دورة التقويم الذاتي العشر — توحيد أربع بنى مختلفة خلف واجهة واحدة:
     ① items[]                    (3 استبانات + 4 مقابلات)
     ② paragraphs[] + observations (الملاحظة الصفية)
     ③ sections[].paragraphs[]     (ملاحظة البيئة المدرسية)
     ④ domains[].items[]           (تحليل الوثائق — 50 فقرة)
   ⚠️ أدوات الملاحظة وتحليل الوثائق **لا تُختار درجتها يدويًا**: تُشتقّ من عدد
   الشواهد المتوافرة مقابل عتبات الفقرة (thresholds) وفق البطاقة المعتمدة.      */

/* ⚠️ العتبات تُقرأ من **مسمّيات المقياس المعتمدة** لكل أداة، ولا تُفترض موحّدة.
   قِسناه: بعتبات [2,4,5] صُنِّفت 3 شواهد في تحليل الوثائق «شاهدان» — وهو خطأ،
   لأن مقياسها: «شاهد واحد فأقل · شاهدان · 3-4 شواهد · 5 شواهد فأكثر» ⇒ [1,2,4].
   أما الملاحظة الصفية فمقياسها «≤2 · 3-4 · 5 · 6+» ⇒ [2,4,5].                   */
export const DEFAULT_THRESHOLDS = [2, 4, 5];
export const TOOL_THRESHOLDS = {
  DOCUMENT_ANALYSIS: [1, 2, 4],
  CLASSROOM_OBSERVATION: [2, 4, 5],
};

export function scaleMax(tool) {
  if (tool.scaleType === "LIKERT_5") return 5;
  if (tool.scaleType === "VERIFY_3") return 3;   // متحقق · جزئيًا · غير متحقق
  return 4;
}

/** عتبات الأداة حين لا تُعلِن الفقرة عتباتها الخاصة */
export function toolThresholds(tool) {
  return TOOL_THRESHOLDS[tool?.key] ?? DEFAULT_THRESHOLDS;
}

/** مستوى الشواهد ⇐ 1..4 حسب عتبات الفقرة ثم عتبات الأداة */
export function levelFromEvidence(count, thresholds, tool) {
  const t = Array.isArray(thresholds) && thresholds.length === 3
    ? thresholds : toolThresholds(tool);
  if (count <= t[0]) return 1;
  if (count <= t[1]) return 2;
  if (count <= t[2]) return 3;
  return 4;
}

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/** يسطّح أي أداة إلى فقرات موحّدة */
export function flattenTool(tool) {
  /* ⚠️ أرقام الفقرات **تتكرّر عبر المجالات** (1..8 ثم 1..5 …). فاسم مجموعة
     الاختيار «q1» يتصادم بين المؤشرات ويُلغي بعضها بعضًا، وتُكتب الإجابات
     فوق بعضها. قِيس: 8 إجابات محفوظة من 53. الحلّ: معرّف فريد لكل فقرة. */
  const mk = (it, group, gkey) => ({
    uid: gkey ? gkey + "#" + it.n : String(it.n),
    n: it.n,
    text: it.rephrased ?? it.r ?? it.text ?? "",
    etec: asArray(it.etec),
    observations: it.observations ?? null,
    thresholds: it.thresholds ?? null,
    records: it.records ?? null,
    group: group ?? null,
  });
  if (Array.isArray(tool.items)) return tool.items.map((it) => mk(it));
  if (Array.isArray(tool.paragraphs)) return tool.paragraphs.map((it) => mk(it));
  if (Array.isArray(tool.sections)) {
    return tool.sections.flatMap((s, si) =>
      (s.paragraphs ?? s.items ?? []).map((it) => mk(it, s.name ?? s.nameAr, "s" + si)));
  }
  if (Array.isArray(tool.domains)) {
    return tool.domains.flatMap((d) =>
      (d.items ?? []).map((it) => ({ ...mk(it, d.nameAr ?? d.key, d.key),
                                     indicatorAr: d.indicatorAr ?? null })));
  }
  return [];
}

export const isEvidenceBased = (tool) =>
  tool.type === "OBSERVATION" || tool.type === "DOC_ANALYSIS" || tool.type === "DOCUMENT_ANALYSIS";

/** أداة التحقق: كل مجال مؤشر مستقل، ونصّ المؤشر يُعرض فوق دلالاته */
export const isVerification = (tool) => tool.type === "VERIFICATION";

/** مجلد نتائج الأداة — على مستوى المدرسة لا الشخص، ليراه المدير والمستشار */
export const toolDir = (key) => "تقويم ذاتي/" + key;
export const toolResponsePath = (key, id) => toolDir(key) + "/" + id + ".json";

/** يحسب متوسّط الأداة ونِسَبها من ردود محفوظة */
export function summarize(tool, responses) {
  const max = scaleMax(tool);
  const items = flattenTool(tool);
  const perItem = items.map((it) => {
    // يُقرأ بالمعرّف الفريد، ويسقط للرقم للتوافق مع استجابات قديمة
    const vals = responses.map((r) => r.answers?.[it.uid] ?? r.answers?.[it.n])
                          .filter((v) => typeof v === "number");
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return { uid: it.uid, n: it.n, text: it.text, etec: it.etec, count: vals.length, mean,
             pct: mean == null ? null : ((mean - 1) / (max - 1)) * 100 };
  });
  const scored = perItem.filter((x) => x.pct != null);
  return {
    key: tool.key, nameAr: tool.nameAr, type: tool.type,
    responses: responses.length, items: items.length,
    answered: scored.length,
    overallPct: scored.length ? scored.reduce((a, b) => a + b.pct, 0) / scored.length : null,
    perItem,
  };
}

/** تجميع كل الأدوات على مؤشرات ETEC — هذا ما يقرؤه زائر الاعتماد */
export function rollupByIndicator(summaries) {
  const map = new Map();
  for (const s of summaries) {
    for (const it of s.perItem) {
      if (it.pct == null) continue;
      for (const code of it.etec) {
        const cur = map.get(code) ?? { code, sum: 0, n: 0, tools: new Set() };
        cur.sum += it.pct; cur.n += 1; cur.tools.add(s.nameAr);
        map.set(code, cur);
      }
    }
  }
  return [...map.values()]
    .map((c) => ({ code: c.code, pct: c.sum / c.n, samples: c.n, tools: [...c.tools] }))
    .sort((a, b) => a.code.localeCompare(b.code, "ar"));
}

/** عدد إدخالات السجلات المرتبطة بفقرة تحليل الوثائق — شاهد فعلي لا تقدير */
export function evidenceFromRecords(item, savedCounts) {
  if (!item.records || !savedCounts) return null;
  return item.records.reduce((a, num) => a + (savedCounts[num] ?? 0), 0);
}
