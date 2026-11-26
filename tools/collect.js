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
// 念法提示：App 播放時用假名找檔案，但送給 Azure 時改用漢字寫法，
// 讓它知道是哪個詞（例如 あめ→雨 而不是 飴、はな→花 而不是 鼻），音調才會對。
// 讀音有歧義的漢字（數字、今日、人、年、何…）維持假名。
const KANJI_AMBIG = new Set(['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万', '人', '年', '月', '週', '家', '何', '今',
  '今日', '明日', '昨日', '上手', '日本', '日本人', '何時', '私', '入る', '良い', '父', '母', '兄', '姉', '手', '目', '男', '女']);
// 單字漢字只有這些（單獨念時讀音穩定）才用漢字
const KANJI_SINGLE_OK = new Set(['雨', '花', '朝', '昼', '夜', '川', '空', '山', '海', '水', '肉', '魚', '卵', '本', '車', '傘', '机', '服', '靴',
  '店', '駅', '国', '町', '道', '犬', '猫', '耳', '足', '頭', '体', '口', '弟', '妹', '鞄']);
const usableKanji = w => /[一-鿿]/.test(w) && !KANJI_AMBIG.has(w) && ([...w].length > 1 || KANJI_SINGLE_OK.has(w));
function collectSpeechHints() {
  const hints = {};
  const put = (kana, kanji) => { kana = kana.trim(); if (!(kana in hints) && usableKanji(kanji)) hints[kana] = kanji; };
  VOCAB.forEach(v => { if (v.word !== v.reading) put(v.reading, v.word); });
  COURSE.forEach(u => u.words && Object.entries(u.words).forEach(([k, w]) => put(k, w[0])));
  GRAMMAR.forEach(g => g.ex.forEach(([ja, kana]) => { hints[kana.trim()] = ja; })); // 例句一律用漢字版，避免整句假名斷錯詞
  return hints;
}

// 檔名：FNV-1a 32 位元雜湊（app.js 的 speechHash 用同一套算法）
function speechHash(s) {
  let h = 0x811c9dc5;
  for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
