/* نقطة استقبال استجابات الاستبانات — Cloudflare Worker مجاني.
 *
 * لماذا؟ صفحة ثابتة تستطيع أن تُرسِل رابطًا، ولا تستطيع أن تستقبل ردًّا من
 * ولي أمر لا حساب له. هذه أصغر جهة تسمع: بلا خادم يُدار وبلا تكلفة.
 *
 * الخطة المجانية: 100,000 طلب يوميًا — تكفي 41 مدرسة أضعافًا.
 *
 * ═══ التنصيب (خمس دقائق، مرّة واحدة) ═══
 * 1) أنشئ حسابًا مجانيًا على dash.cloudflare.com (بلا بطاقة).
 * 2) Workers & Pages ← Create ← Worker ← الصق هذا الملف ← Deploy.
 * 3) من تبويب Settings ← Variables ← KV Namespace Bindings:
 *    أنشئ KV باسم IK_SURVEYS واربطه بالمتغيّر SURVEYS.
 * 4) انسخ عنوان الـWorker (…workers.dev) وضع بعده /collect،
 *    والصقه في «نقطة الاستقبال السحابية» داخل شاشة نشر الاستبانة.
 * 5) لسحب الردود: افتح …workers.dev/export?school=<اسم المدرسة>
 *
 * ═══ ولإدخالات الجوّال (أضيف 2026-09-02) ═══
 * الآيفون لا يكتب في مجلد، ومسار مايكروسوفت مغلق (حساب الشركة لا يملك
 * صلاحية تسجيل تطبيق). فيرسل التنفيذي إدخالاته إلى هنا، ويسحبها حاسب
 * المستودع بضغطة فتُكتب في مواضعها.
 * 6) أنشئ KV ثانيًا باسم IK_ENTRIES واربطه بالمتغيّر ENTRIES.
 * 7) ضع كلمة مرور المدرسة في Variables باسم PULL_KEY — بها وحدها يُسحب.
 *    ⚠️ بلا PULL_KEY يرفض الـWorker السحب: لا تُترك السجلات مكشوفة.
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    /* استقبال إدخالات تنفيذي من جوّاله */
    if (url.pathname === "/submit" && request.method === "POST") {
      if (!env.ENTRIES) return json({ error: "لم يُربَط مخزن الإدخالات" }, 500);
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
      const list = Array.isArray(body?.إدخالات) ? body.إدخالات : null;
      if (!list || !body?.شخص) return json({ error: "ملف إدخالات ناقص" }, 400);
      // ⚠️ لا يُقبل مسار خارج «مخرجات» أو «تقويم ذاتي» — ولا صعود بالمجلدات
      const bad = list.filter((e) => !e?.path ||
        !/^(مخرجات|تقويم ذاتي)\//.test(e.path) || e.path.includes(".."));
      if (bad.length) return json({ error: bad.length + " مسارًا غير مقبول" }, 400);
      if (JSON.stringify(list).length > 4_000_000) return json({ error: "الحمولة كبيرة" }, 413);
      const key = String(body.مدرسة || "").slice(0, 120) + "|" +
                  String(body.شخص.role || "").slice(0, 40) + "|" + Date.now();
      await env.ENTRIES.put(key, JSON.stringify(body), { expirationTtl: 60 * 60 * 24 * 120 });
      return json({ ok: true, count: list.length });
    }

    /* سحب ما وصل — بمفتاح المدرسة وحده */
    if (url.pathname === "/pull" && request.method === "GET") {
      if (!env.ENTRIES) return json({ error: "لم يُربَط مخزن الإدخالات" }, 500);
      if (!env.PULL_KEY) return json({ error: "لم يُضبط مفتاح السحب" }, 500);
      if (url.searchParams.get("key") !== env.PULL_KEY) return json({ error: "مفتاح غير صحيح" }, 403);
      const school = url.searchParams.get("school") || "";
      const out = [];
      const listed = await env.ENTRIES.list({ prefix: school ? school + "|" : undefined, limit: 200 });
      for (const k of listed.keys) {
        const v = await env.ENTRIES.get(k.name);
        if (v) out.push({ key: k.name, pack: JSON.parse(v) });
      }
      return json({ count: out.length, items: out });
    }

    /* حذف ما استُورد فعلًا — كي لا يتكرّر */
    if (url.pathname === "/ack" && request.method === "POST") {
      if (!env.ENTRIES || !env.PULL_KEY) return json({ error: "غير مهيّأ" }, 500);
      let b2;
      try { b2 = await request.json(); } catch { return json({ error: "bad json" }, 400); }
      if (b2?.key !== env.PULL_KEY) return json({ error: "مفتاح غير صحيح" }, 403);
      for (const k of (b2.keys || []).slice(0, 200)) await env.ENTRIES.delete(String(k));
      return json({ ok: true });
    }

    if (url.pathname === "/collect" && request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
      if (!body?.tool || !body?.answers) return json({ error: "missing fields" }, 400);
      // لا يُخزَّن أي بيان يدلّ على المستجيب — لا IP ولا بصمة متصفّح
      const rec = {
        tool: String(body.tool).slice(0, 40),
        school: String(body.school || "").slice(0, 120),
        answers: body.answers,
        at: new Date().toISOString(),
      };
      const key = rec.school + "|" + rec.tool + "|" + Date.now() + "-" +
                  Math.random().toString(36).slice(2, 8);
      await env.SURVEYS.put(key, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 400 });
      return json({ ok: true });
    }

    if (url.pathname === "/export") {
      const school = url.searchParams.get("school") || "";
      const list = await env.SURVEYS.list({ prefix: school ? school + "|" : undefined, limit: 1000 });
      const out = [];
      for (const k of list.keys) {
        const v = await env.SURVEYS.get(k.name);
        if (v) out.push(JSON.parse(v));
      }
      return json({ count: out.length, responses: out });
    }

    return json({ ok: true, service: "استقبال استبانات الاعتماد الخارجي" });
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}
