/* مستودع المدرسة — نسخة احتياطية تلقائية بعد كل حفظ.

   الفكرة: شخص واحد في المدرسة (المدير افتراضًا) هو **أمين المستودع**، وتتجمّع
   عنده نسخة من كل ما يُدخِله التنفيذيون. فلو حُذف مجلد تنفيذي أو استقال قبل
   التسليم، تبقى النسخة كاملة.

   ⚠️ ما يُنسَخ تلقائيًا: **الإدخالات (JSON)** — صغيرة وسريعة. أما ملفات الشواهد
   الثنائية فتُنسَخ بأمر صريح «نسخة كاملة» كي لا يتضاعف حجم المجلد بلا داعٍ.  */

export const VAULT = "مستودع";
export const SETTINGS = "إدارة/الإعدادات.json";

export async function loadSettings(store) {
  try { if (await store.exists(SETTINGS)) return await store.readJson(SETTINGS); } catch {}
  return {};
}
export async function saveSettings(store, next) {
  const cur = await loadSettings(store);
  const merged = { ...cur, ...next, updatedAt: new Date().toISOString() };
  await store.writeJson(SETTINGS, merged);
  return merged;
}

/** أمين المستودع: المحدَّد في الإعدادات، وإلا مدير المدرسة */
export function vaultKeeper(settings, roster) {
  const byId = new Map(roster.map((p) => [p.id, p]));
  return byId.get(settings?.vaultKeeperId) ||
         roster.find((p) => p.role === "PRINCIPAL") || roster[0] || null;
}

const stamp = () => new Date().toISOString();

/** ينسخ ملفًا محفوظًا إلى المستودع ويحدّث فهرسه */
export async function backupEntry(store, { kind, sourcePath, data, person, roleAr }) {
  const file = sourcePath.split("/").pop();
  const dest = VAULT + "/" + kind + "/" + (roleAr || "عام") + "/" + file;
  try {
    await store.writeJson(dest, { ...data, _backup: { at: stamp(), from: sourcePath, person } });
    await bumpIndex(store, kind, dest);
    return { ok: true, dest };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function bumpIndex(store, kind, dest) {
  const path = VAULT + "/_الفهرس.json";
  let idx = { counts: {}, lastBackupAt: null, items: [] };
  try { if (await store.exists(path)) idx = await store.readJson(path); } catch {}
  idx.counts = idx.counts || {};
  idx.counts[kind] = (idx.counts[kind] || 0) + 1;
  idx.lastBackupAt = stamp();
  idx.items = (idx.items || []).filter((x) => x.dest !== dest);
  idx.items.push({ kind, dest, at: idx.lastBackupAt });
  if (idx.items.length > 4000) idx.items = idx.items.slice(-4000);
  await store.writeJson(path, idx);
}

export async function vaultIndex(store) {
  try {
    const path = VAULT + "/_الفهرس.json";
    if (await store.exists(path)) return await store.readJson(path);
  } catch {}
  return { counts: {}, lastBackupAt: null, items: [] };
}

/** نسخة كاملة تشمل الشواهد الثنائية — بأمر صريح من أمين المستودع */
export async function fullBackup(store, onProgress) {
  let files = 0, bytes = 0, errors = 0;
  const copyDir = async (rel, destRoot) => {
    let entries = [];
    try { entries = await store.list(rel); } catch { return; }
    for (const e of entries) {
      const src = rel + "/" + e.name;
      if (e.kind === "directory") { await copyDir(src, destRoot); continue; }
      try {
        if (e.name.endsWith(".json")) {
          await store.writeJson(destRoot + "/" + src, await store.readJson(src));
        } else if (store.readBinary) {
          const buf = await store.readBinary(src);
          await store.writeBinary(destRoot + "/" + src, buf);
          bytes += buf.byteLength ?? 0;
        } else { continue; }
        files++;
        onProgress?.(files, src);
      } catch { errors++; }
    }
  };
  await copyDir("مخرجات", VAULT + "/نسخة كاملة");
  await copyDir("تقويم ذاتي", VAULT + "/نسخة كاملة");
  await copyDir("إدارة", VAULT + "/نسخة كاملة");
  const idx = await vaultIndex(store);
  idx.fullBackupAt = stamp(); idx.fullBackupFiles = files;
  await store.writeJson(VAULT + "/_الفهرس.json", idx);
  return { files, bytes, errors };
}
