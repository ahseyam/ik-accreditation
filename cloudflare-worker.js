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

    return json({ ok: true, service: "استقبال استبانات مساحة الاعتماد" });
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}
