/* **حارِسُ طَزاجةِ الصَفحة** — يَضمَنُ أَنَّ ما يَراهُ المُستَخدِمُ هوَ المَنشور.
 *
 * ⚠️ الدَرسُ مَقيسٌ ثَلاثَ مَرّات: بَصمةُ `?v=` تُبطِلُ ذاكِرةَ **الأُصولِ**
 *    (js/css) لِأَنَّ رابِطَها يَتَغَيَّر، أَمّا **صَفحةُ HTML نَفسُها** فَرابِطُها
 *    ثابِتٌ — وGitHub Pages يُرسِلُها بِـmax-age=600. فَيُصلِحُ المُطَوِّرُ ويَنشُرُ
 *    ويَقولُ «تَمَّ»، والمُستَخدِمُ يَرى القَديمَ ويَقولُ «ما زالَ كَما هو».
 *    وأَسوَأُ حالاتِها: أَنماطٌ داخِلَ الصَفحةِ (أَلوانُ اللَوحة) تَتَجَمَّدُ
 *    كامِلةً مَهما خُتِمَت الوَحَدات.
 * ⚠️ و`location.reload()` لا يَكفي: قَد يُقَدِّمُهُ المُتَصَفِّحُ مِنَ الذاكِرةِ
 *    نَفسِها. الانتِقالُ إلى **رابِطٍ مُختَلِف** (`?ik=<بصمة>`) يَتَجاوَزُها يَقينًا.
 * ⚠️ ومَرّةً واحِدةً لِكُلِّ بَصمة: تَحديثٌ بِلا حارِسٍ يَصيرُ حَلقةً لا تَنتَهي
 *    إن تَعَذَّرَ التَحديثُ لِأَيِّ سَبَب.
 */
(function () {
  var meta = document.querySelector('meta[name="ik-v"]');
  if (!meta || !location.protocol.startsWith("http")) return;   // بِلا خادِمٍ لا مَعنى
  var mine = meta.content;
  fetch("نسخة.json", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j || !j.v || j.v === mine) return;
      var key = "ik.fresh." + j.v;
      try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch (e) { return; }
      var u = new URL(location.href);
      u.searchParams.set("ik", j.v);
      location.replace(u.toString());
    })
    .catch(function () {});
})();
