/* **ما قامَ بِهِ كُلُّ مَنسوبٍ** — يُقرَأُ مِنَ المُجَلَّدِ نَفسِه.
 *
 * ⚠️ المَصدَرُ مِلَفّاتُ `مخرجات/<رقم> - <الوظيفة>/` لا سِجِلٌّ يُكتَبُ بِاليَد:
 *    سِجِلُّ نَشاطٍ مُنفَصِلٌ يَتَقادَمُ صامِتًا كُلَّما كَتَبَ أَحَدٌ بِلا مُرورٍ بِه،
 *    والمُجَلَّدُ لا يَكذِب.
 * ⚠️ ويُبَوَّبُ بِـ**أَوَّلِ مَقطَعٍ** بَعدَ «مخرجات» لِأَنَّهُ مُجَلَّدُ الشَخص؛
 *    والمُطابَقةُ بِالاسمِ تُخطِئُ عِندَ التَشابُهِ وتَنكَسِرُ عِندَ النَقلِ والاستِقالة.
 */
export async function staffActivity(store, maxDepth = 5) {
  const byFolder = {};
  const bump = (folder, k) => {
    const b = (byFolder[folder] ||= { entries: 0, evidence: 0, latest: null, records: new Set() });
    b[k]++;
    return b;
  };
  const walk = async (rel, depth = 0) => {
    if (depth > maxDepth) return;
    let list = [];
    try { list = await store.list(rel); } catch { return; }
    for (const e of list) {
      const p = rel + "/" + e.name;
      if (e.kind === "directory") { await walk(p, depth + 1); continue; }
      const parts = p.split("/");
      const folder = parts[1];
      if (!folder) continue;
      const num = (p.match(/\/(?:سجلات|شواهد)\/(\d+)(?:\/|$)/) || [])[1];
      if (/\/شواهد\//.test(p)) bump(folder, "evidence");
      else if (/\/سجلات\/.*\.json$/.test(p)) {
        const b = bump(folder, "entries");
        if (num) b.records.add(num);
        const m = e.name.match(/^(\d{4}-\d{2}-\d{2})/);
        if (m && (!b.latest || m[1] > b.latest)) b.latest = m[1];
      }
    }
  };
  await walk("مخرجات");
  for (const b of Object.values(byFolder)) b.records = b.records.size;
  return byFolder;
}

/** يَربِطُ كُلَّ مَنسوبٍ بِأَرقامِه — والمِفتاحُ اسمُ المُجَلَّدِ لا الاسمُ الشَخصي */
export function joinStaff(roster, byFolder, folderOf) {
  return roster.map((p) => {
    const f = (folderOf(p) || "").replace(/^مخرجات\//, "");
    const a = byFolder[f] || { entries: 0, evidence: 0, latest: null, records: 0 };
    return { person: p, folder: f, ...a };
  });
}
