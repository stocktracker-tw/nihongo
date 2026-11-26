// 收集 App 裡所有會念出來的日文（給 Azure 語音產生器用）
// 必須和 app.js / lesson.js 實際傳給 speak() 的字串完全一致。
function collectSpeechTexts() {
  const out = new Set();
  const add = t => { t = String(t).trim(); if (t) out.add(t); };
  // 五十音（平假名＋片假名，清音・濁音・拗音）
  for (const group of Object.values(KANA_ROWS)) for (const row of group) for (const c of row) if (c) { add(c[0]); add(toKatakana(c[0])); }
  // 單字庫
  VOCAB.forEach(v => add(v.reading));
  // 文法例句（念假名版）與填空完成句
  GRAMMAR.forEach(g => {
    g.ex.forEach(e => add(e[1]));
    const [sent, ans] = g.cloze;
    add(sent.replace(/（.*?）/, '').replace('＿', ans));
  });
  // 造句題：整句與每個詞塊
  SENTENCES.forEach(([tokens]) => { add(tokens.join('')); tokens.forEach(add); });
  // 課程：單字、句子、詞塊
  COURSE.forEach(u => {
    if (u.words) Object.keys(u.words).forEach(add);
    (u.sentences || []).forEach(s => { add(s[0]); s[1].split(' ').forEach(add); });
  });
  return [...out];
}
// 檔名：FNV-1a 32 位元雜湊（app.js 的 speechHash 用同一套算法）
function speechHash(s) {
  let h = 0x811c9dc5;
  for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
