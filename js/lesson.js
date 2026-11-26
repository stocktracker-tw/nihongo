'use strict';
// =====================================================================
// Duolingo 式課程：學習路徑、單元指南、課程練習
// 不情勒原則：沒有愛心、沒有連續天數歸零、沒有鎖課、不催促。
// 本檔只宣告函式，由 app.js 在載入後呼叫。
// =====================================================================

const COURSE_WORDS = [];
const UNIT_COLORS = ['#9a8562', '#6f8f60', '#8f1a2c', '#a8865a', '#5f7480', '#94705a', '#737f5c', '#a07f50', '#5a6a76', '#80708a', '#a5664c'];

function cw(u, k) { const [w, zh, e] = u.words[k]; return { key: k, word: w, reading: k, zh, emoji: e, id: courseItemId(k) }; }
function courseItemId(k) {
  const v = VOCAB.find(x => toHiragana(x.reading) === toHiragana(k));
  return v ? v.id : 'c_' + k;
}
function registerCourseItems() {
  COURSE.forEach(u => u.words && Object.keys(u.words).forEach(k => {
    const w = cw(u, k);
    COURSE_WORDS.push(w);
    if (!ITEMS[w.id]) ITEMS[w.id] = { id: w.id, word: w.word, reading: k, meaning: w.zh, cat: u.title, kind: 'v' };
  }));
}
function unitKana(u, rows) {
  return rows.flatMap(r => KANA_ROWS.basic[r].filter(Boolean).map(([k, ro]) => [u.kana === 'kata' ? toKatakana(k) : k, ro, k]));
}
const lkey = (ui, li) => COURSE[ui].id + '-' + li;
const nLessons = u => u.lessons.length + 1; // 最後一個是單元複習
const isDone = (ui, li) => ((state.lessons || {})[lkey(ui, li)] || 0) > 0;
const lessonHref = ([ui, li]) => `#/lesson?u=${ui}&l=${li}`;
function nextNode() {
  for (let ui = 0; ui < COURSE.length; ui++) for (let li = 0; li < nLessons(COURSE[ui]); li++) if (!isDone(ui, li)) return [ui, li];
  return null;
}
function wordDetail(w) { return `${w.word !== w.reading ? esc(w.word) + '（' + esc(w.reading) + '）' : esc(w.word)}　${esc(w.zh)}`; }

// ===== 吉祥物：クロ（長得兇，但不會兇你）=====
function mascot(size = 96, mood = 'calm') {
  return `<img class="mascot ${mood === 'happy' ? 'hop' : ''}" src="img/kuro.webp" width="${size}" height="${size}" alt="吉祥物クロ">`;
}
function greeting() {
  const days = Object.keys(state.history).filter(d => state.history[d] > 0).sort();
  const last = days[days.length - 1];
  const xpToday = state.xpDay[today()] || 0;
  if (!last) return '我是クロ。長得兇，但不會兇你。從五十音開始，一次一小課就好，大約 3 分鐘。';
  if (last === today()) {
    if (S().goal && xpToday >= S().goal) return '今天的小目標達成了 🎉 接下來想學就學，想休息就休息。';
    return `今天已經累積 ${xpToday} XP 了，做得很好。`;
  }
  const gap = Math.round((new Date(today()) - new Date(last)) / DAY);
  if (gap >= 4) return '歡迎回來！先從一小課或幾個複習開始吧，不用急。';
  return pick(['今天想學一點點嗎？', '每天一點點，比一次很多更好記。', '答錯沒關係，答錯的題目會再練一次。', '累了就休息，進度都會幫你留著。']);
}

// =====================================================================
// 學習路徑（首頁）
// =====================================================================
function viewPath() {
  const nx = nextNode();
  const due = dueIds().length;
  const xpToday = state.xpDay[today()] || 0;
  const goal = S().goal;
  const started = Object.keys(state.lessons || {}).length > 0;
  view.innerHTML = `
    <div class="card path-head">
      <div class="mascot-row">${mascot(84)}<div class="bubble">${greeting()}</div></div>
      <div class="head-stats">
        <div class="stat"><div class="week">${weekDays().map(d => `<span class="wd ${d.active ? 'on' : ''} ${d.today ? 'today' : ''}" title="${d.active ? '有學習' : ''}">${d.label}</span>`).join('')}</div><span class="lbl">本週學習日</span></div>
        <div class="stat"><span class="num">${totalDays()}</span><span class="lbl">學習天數</span></div>
        <div class="stat"><span class="num">${state.xp}</span><span class="lbl">總 XP</span></div>
        ${goal ? `<div class="stat"><span class="num">${xpToday}<small class="muted" style="font-size:14px"> / ${goal}</small></span><span class="lbl">今日小目標</span><div class="bar"><i style="width:${Math.min(100, xpToday / goal * 100)}%"></i></div></div>` : ''}
      </div>
      <div class="row">
        ${nx ? `<a class="btn primary big" href="${lessonHref(nx)}">${started ? '繼續學習' : '開始第一課'}</a>` : '<span class="tag">全部課程完成了 🎉</span>'}
        ${due ? `<a class="btn" href="#/study">複習 ${due} 個</a>` : ''}
        <a class="btn" href="#/challenge">自由練習</a>
      </div>
    </div>
    ${COURSE.map((u, ui) => unitSection(u, ui, nx)).join('')}
    <p class="small muted" style="text-align:center;margin-top:40px">這裡沒有連續天數、沒有愛心、不鎖課，也不會推播催你。<br>想學就學，想休息就休息，進度都會留著。</p>`;

  $$('.node').forEach(b => b.onclick = () => {
    const wrap = b.parentElement;
    const open = wrap.nextElementSibling && wrap.nextElementSibling.classList.contains('pop');
    $$('.pop').forEach(p => p.remove());
    if (!open) wrap.insertAdjacentHTML('afterend', popHTML(+b.dataset.u, +b.dataset.l, nx));
  });
  setTimeout(() => {
    const cur = $('.node.current');
    if (cur && cur.getBoundingClientRect().top > innerHeight - 80) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 50);
}
function unitSection(u, ui, nx) {
  const color = UNIT_COLORS[ui % UNIT_COLORS.length];
  const n = nLessons(u);
  let doneCount = 0;
  const nodes = Array.from({ length: n }, (_, li) => {
    const review = li === u.lessons.length;
    const d = isDone(ui, li); if (d) doneCount++;
    const cur = nx && nx[0] === ui && nx[1] === li;
    const offset = Math.round(Math.sin(li * 1.25) * 72);
    const icon = d ? '✓' : review ? '★' : u.kana ? unitKana(u, u.lessons[li])[0][0] : u.words[u.lessons[li][0]][2];
    return `<div class="node-wrap" style="transform:translateX(${offset}px)">
      ${cur ? '<div class="node-label">從這裡開始</div>' : ''}
      <button class="node ${d ? 'done' : ''} ${cur ? 'current' : ''} ${review ? 'review' : ''}" data-u="${ui}" data-l="${li}" title="${review ? '單元複習' : '第 ' + (li + 1) + ' 課'}">${icon}</button></div>`;
  }).join('');
  return `<section class="unit" style="--c:${color}">
    <div class="unit-banner" data-no="${String(ui + 1).padStart(2, '0')}">
      <div><div class="unit-no">第 ${ui + 1} 單元 · ${doneCount}/${n}</div><div class="unit-title">${esc(u.title)}</div><div class="unit-desc">${esc(u.desc)}</div></div>
      <a class="btn guide-btn" href="#/guide?u=${ui}">${ico('book')}指南</a>
    </div>
    <div class="nodes">${nodes}</div></section>`;
}
function popHTML(ui, li, nx) {
  const u = COURSE[ui];
  const review = li === u.lessons.length;
  const d = isDone(ui, li);
  const ahead = nx && (ui > nx[0] || (ui === nx[0] && li > nx[1]));
  const items = review ? '本單元全部內容' : u.kana ? unitKana(u, u.lessons[li]).map(x => x[0]).join(' ') : u.lessons[li].map(k => u.words[k][0]).join('・');
  return `<div class="pop fade-in">
    <b>${review ? '單元複習' : '第 ' + (li + 1) + ' 課'}</b>
    <div class="jp" style="margin:4px 0 10px">${esc(items)}</div>
    ${ahead ? '<div class="small muted" style="margin-bottom:10px">建議先完成前面的課，不過想先看看也完全可以。</div>' : ''}
    <a class="btn primary block" href="${lessonHref([ui, li])}">${d ? '再練一次 · +5 XP' : '開始 · +10 XP'}</a></div>`;
}

// =====================================================================
// 單元指南（Duolingo Guidebook）
// =====================================================================
function viewGuide(q) {
  const ui = +q.get('u'); const u = COURSE[ui];
  if (!u) { location.hash = '#/home'; return; }
  const first = Array.from({ length: nLessons(u) }, (_, li) => li).find(li => !isDone(ui, li)) ?? 0;
  const color = UNIT_COLORS[ui % UNIT_COLORS.length];
  let body = '';
  if (u.kana) {
    const ks = unitKana(u, u.lessons.flat());
    body = `<h2>這個單元的假名</h2><div class="kana-grid">${ks.map(([k, r, h]) => `<button class="kana-cell" data-say="${k}"><span class="k">${k}</span><span class="r">${r}</span></button>`).join('')}</div>`;
  } else {
    body = `<h2>單字</h2><div class="grid grid-4">${Object.keys(u.words).map(k => { const w = cw(u, k); return `
      <button class="card word-card" data-say="${esc(k)}"><span class="pic">${w.emoji}</span><span class="jp" style="font-size:20px">${ruby(w.word, w.reading, true)}</span><span class="muted">${esc(w.zh)}</span></button>`; }).join('')}</div>
      <h2>重點句子</h2><div class="card">${u.sentences.map(s => `<div class="example row between"><div><div class="ja">${esc(s[0])}</div><div>${esc(s[2])}</div></div>${audioBtn(s[0])}</div>`).join('')}</div>`;
  }
  view.innerHTML = `
    <a href="#/home" class="muted" style="text-decoration:none">← 回課程</a>
    <div class="unit-banner" style="--c:${color};margin-top:12px"><div><div class="unit-no">第 ${ui + 1} 單元指南</div><div class="unit-title">${esc(u.title)}</div><div class="unit-desc">${esc(u.desc)}</div></div></div>
    <h2>小提示</h2>
    <div class="grid grid-2">${u.tips.map(t => `<div class="card"><b>${esc(t.h)}</b><p style="margin:6px 0 0">${esc(t.p)}</p></div>`).join('')}</div>
    ${body}
    <div style="margin-top:24px"><a class="btn primary big" href="${lessonHref([ui, first])}">開始這個單元</a></div>`;
}

// =====================================================================
// 課程進行
// =====================================================================
function viewLesson(q) {
  const ui = +q.get('u'), li = +q.get('l'); const u = COURSE[ui];
  if (!u || !(li >= 0 && li < nLessons(u))) { location.hash = '#/home'; return; }
  const replay = isDone(ui, li);
  const built = u.kana ? buildKanaLesson(u, li, replay) : buildWordLesson(u, ui, li, replay);
  const queue = built.exs.map(f => ({ f, first: true }));
  let finished = 0, total = queue.length, correct = 0, answered = 0;
  const t0 = Date.now();
  gentleRetry = true;
  const step = () => {
    if (!queue.length) {
      gentleRetry = false;
      return finishLesson(ui, li, replay, { correct, answered, secs: Math.round((Date.now() - t0) / 1000), words: built.words, kana: built.kana });
    }
    const cur = queue[0];
    const stage = sessionShell(finished / total, null, '#/home');
    const next = () => { keyHandler = null; queue.shift(); finished++; step(); };
    if (cur.f.teach) return cur.f(stage, next);
    cur.f(stage, ok => {
      if (cur.first) { answered++; if (ok) correct++; }
      if (!ok) { queue.push({ f: cur.f, first: false }); total++; }
    }, next);
  };
  step();
}
function finishLesson(ui, li, replay, r) {
  const u = COURSE[ui];
  const review = li === u.lessons.length;
  const acc = r.answered ? r.correct / r.answered : 1;
  const xp = (replay ? 5 : 10) + Math.round(acc * 5);
  const before = state.xpDay[today()] || 0;
  state.lessons[lkey(ui, li)] = (state.lessons[lkey(ui, li)] || 0) + 1;
  (r.words || []).forEach(w => { if (!state.srs[w.id]) schedule(w.id, 2); });
  addXP(xp, r.answered);
  const goalHit = S().goal && before < S().goal && before + xp >= S().goal;
  const nx = nextNode();
  const mm = Math.floor(r.secs / 60), ss = String(r.secs % 60).padStart(2, '0');
  const title = review ? '單元完成！' : replay ? '練習完成！' : '這一課完成了！';
  const msg = goalHit ? '今天的小目標達成了 🎉 接下來隨你，想繼續或休息都很好。'
    : acc === 1 ? '全部一次答對，太厲害了。'
    : acc >= 0.8 ? '很穩！答錯的部分剛剛也練過一次了。'
    : '今天也有往前一點。學過的東西會在複習時再見面。';
  keyHandler = null;
  view.innerHTML = `
    <div class="session"><div class="card result fade-in">
      ${mascot(120, 'happy')}
      <h1>${title}</h1>
      <p class="muted">${msg}</p>
      <div class="grid grid-4" style="margin:24px 0">
        <div class="stat"><span class="big">+${xp}</span><span class="lbl">XP</span></div>
        <div class="stat"><span class="big">${Math.round(acc * 100)}%</span><span class="lbl">一次答對</span></div>
        <div class="stat"><span class="big">${mm}:${ss}</span><span class="lbl">用時</span></div>
      </div>
      ${r.words && r.words.length ? `<div class="row" style="justify-content:center;margin-bottom:20px">${r.words.map(w => `<button class="chip jp" data-say="${esc(w.reading)}">${w.emoji} ${esc(w.word)}</button>`).join('')}</div>` : ''}
      ${r.kana && r.kana.length ? `<div class="row" style="justify-content:center;margin-bottom:20px">${r.kana.map(([k]) => `<button class="chip jp" data-say="${k}">${k}</button>`).join('')}</div>` : ''}
      <div class="row" style="justify-content:center">
        <a class="btn" href="#/home">回課程</a>
        ${nx ? `<a class="btn primary" href="${lessonHref(nx)}">下一課 →</a>` : ''}
      </div>
    </div></div>`;
  keyHandler = e => { if (e.key === 'Enter') location.hash = nx ? lessonHref(nx) : '#/home'; };
}

// ===== 題目產生：單字課 =====
function otherWords(w, pool, n) {
  const out = [];
  for (const x of [...shuffle(pool.filter(p => p.cat === w.cat)), ...shuffle(pool)]) {
    if (x.reading === w.reading || x.zh === w.zh || out.some(o => o.reading === x.reading || o.zh === x.zh)) continue;
    out.push(x); if (out.length >= n) break;
  }
  return out;
}
function distractTokens(answer, sentences, field, n = 2) {
  const toks = [...new Set(sentences.flatMap(s => s[field].split(' ')))].filter(t => !answer.includes(t));
  return shuffle(toks).slice(0, n);
}
function exTeachWord(w) {
  const f = (stage, next) => {
    stage.innerHTML = `
      <div class="card prompt-card"><span class="tag new">新單字</span>
        <div class="teach-emoji">${w.emoji}</div>
        <div class="prompt-word">${ruby(w.word, w.reading, true)}</div>
        <div class="prompt-meaning">${esc(w.zh)}</div>
        <div style="margin-top:12px">${audioBtn(w.reading)}</div></div>
      <button class="btn primary big block" id="ok" style="margin-top:16px">記住了<span class="kbd">Enter</span></button>`;
    if (S().autoplay) speak(w.reading);
    $('#ok').onclick = next;
    keyHandler = e => { if (e.key === 'Enter') { e.preventDefault(); next(); } };
  };
  f.teach = true;
  return f;
}
function exPicture(w, pool) {
  const opts = shuffle([w, ...otherWords(w, pool, 3)]);
  return (st, r, n) => askChoice(st, { label: '哪一個是', prompt: `<div class="prompt-word">${ruby(w.word, w.reading)}</div>`,
    options: opts.map(o => ({ html: `<span class="pic">${o.emoji}</span><span>${esc(o.zh)}</span>` })), cls: 'pics', answer: opts.indexOf(w), detail: wordDetail(w), autoSay: w.reading }, r, n);
}
function exMeaning(w, pool) {
  const opts = shuffle([w, ...otherWords(w, pool, 3)]);
  return (st, r, n) => askChoice(st, { label: '選出意思', prompt: `<div class="prompt-word">${ruby(w.word, w.reading)}</div>`, options: opts.map(o => o.zh), answer: opts.indexOf(w), detail: wordDetail(w), say: w.reading }, r, n);
}
function exListen(w, pool) {
  const opts = shuffle([w, ...otherWords(w, pool, 3)]);
  return (st, r, n) => askChoice(st, { label: '聽聽看，選出聽到的字', prompt: `${listenBtn(w.reading)}`, options: opts.map(o => o.word), jp: true, answer: opts.indexOf(w), detail: wordDetail(w), autoSay: w.reading }, r, n);
}
function exTypeWord(w) {
  return (st, r, n) => askType(st, { label: '用日文寫出來', prompt: `<div class="teach-emoji">${w.emoji}</div><div class="prompt-meaning">${esc(w.zh)}</div>`, ime: true,
    check: v => normKana(v) === normKana(w.reading) || v.trim() === w.word, detail: wordDetail(w), say: w.reading }, r, n);
}
function exMatch(pairs) {
  return (st, r, n) => askMatch(st, pairs, r, n);
}
function exJp2Zh(s, pool) {
  const ans = s[3].split(' ');
  return (st, r, n) => askTiles(st, { label: '翻譯成中文', prompt: `<div class="prompt-word sent">${esc(s[0])}</div><div style="margin-top:8px">${audioBtn(s[0])}</div>`,
    tiles: [...ans, ...distractTokens(ans, pool, 3)], correct: ans, zhTiles: true, detail: esc(s[2]), say: s[0], autoSay: s[0] }, r, n);
}
function exZh2Jp(s, pool) {
  const ans = s[1].split(' ');
  return (st, r, n) => askTiles(st, { label: '翻譯成日文', prompt: `<div class="prompt-meaning">${esc(s[2])}</div>`,
    tiles: [...ans, ...distractTokens(ans, pool, 1)], correct: ans, detail: esc(s[0]), say: s[0] }, r, n);
}
function exListenTiles(s, pool) {
  const ans = s[1].split(' ');
  return (st, r, n) => askTiles(st, { label: '聽寫：排出聽到的句子', prompt: `${listenBtn(s[0])}`,
    tiles: [...ans, ...distractTokens(ans, pool, 1)], correct: ans, detail: `${esc(s[0])}<br>${esc(s[2])}`, say: s[0], autoSay: s[0] }, r, n);
}
function buildWordLesson(u, ui, li, replay) {
  const all = Object.keys(u.words).map(k => ({ ...cw(u, k), cat: u.id }));
  const review = li === u.lessons.length;
  const newW = review ? [] : u.lessons[li].map(k => all.find(w => w.key === k));
  const oldW = review ? all : u.lessons.slice(0, li).flat().map(k => all.find(w => w.key === k));
  const pool = [...all, ...COURSE_WORDS];
  const tokPool = COURSE.slice(0, ui + 1).flatMap(x => x.sentences || []);
  const sents = review ? shuffle(u.sentences).slice(0, 5)
    : [...u.sentences.filter(s => s[4] === li), ...shuffle(u.sentences.filter(s => s[4] < li)).slice(0, 1)];
  const head = [], rest = [];
  newW.forEach(w => { if (!replay) head.push(exTeachWord(w)); head.push(exPicture(w, pool)); });
  const matchSet = shuffle([...newW, ...oldW]).slice(0, 5);
  if (matchSet.length >= 3) rest.push(exMatch(matchSet.map(w => [w.word, w.zh, w.reading])));
  shuffle(sents).forEach((s, i) => rest.push([exZh2Jp, exJp2Zh, exListenTiles][i % 3](s, tokPool)));
  newW.forEach((w, i) => rest.push(i % 2 ? exListen(w, pool) : exMeaning(w, pool)));
  if (newW.length) rest.push(exTypeWord(pick(newW)));
  shuffle(oldW).slice(0, review ? 6 : 2).forEach((w, i) => rest.push([exMeaning, exListen, exTypeWord][i % 3](w, pool)));
  return { exs: [...head, ...shuffle(rest).slice(0, review ? 14 : 10)], words: review ? [] : newW };
}

// ===== 題目產生：假名課 =====
function trackKana(k, r) {
  return ok => { const s = state.kana[k] || { c: 0, w: 0 }; ok ? s.c++ : s.w++; state.kana[k] = s; r(ok); };
}
function exTeachKana(item, u) {
  const [k, ro, h] = item;
  const f = (stage, next) => {
    const mn = u.kana === 'hira' ? KANA_MNEMONIC[k] : `對應平假名「${h}」`;
    stage.innerHTML = `
      <div class="card prompt-card"><span class="tag new">新假名</span>
        <div class="big-kana" style="margin-top:10px">${k}</div>
        <div style="font-size:24px;font-weight:700">${ro}</div>
        ${mn ? `<p class="hint">${ico('bulb')}${esc(mn)}</p>` : ''}
        <div>${audioBtn(k)}</div></div>
      <button class="btn primary big block" id="ok" style="margin-top:16px">記住了<span class="kbd">Enter</span></button>`;
    if (S().autoplay) speak(k);
    $('#ok').onclick = next;
    keyHandler = e => { if (e.key === 'Enter') { e.preventDefault(); next(); } };
  };
  f.teach = true;
  return f;
}
function kanaOthers(item, pool, n = 3) {
  return shuffle(pool.filter(p => p[0] !== item[0] && p[1] !== item[1])).filter((p, i, a) => a.findIndex(x => x[0] === p[0]) === i).slice(0, n);
}
function exKanaPick(item, pool) {
  const opts = shuffle([item, ...kanaOthers(item, pool)]);
  return (st, r, n) => askChoice(st, { label: '哪一個是', prompt: `<div class="prompt-word" style="font-family:var(--ui)">${item[1]}</div>`, options: opts.map(o => o[0]), jp: true, answer: opts.indexOf(item), detail: `${item[0]} = ${item[1]}`, say: item[0] }, trackKana(item[0], r), n);
}
function exKanaRomaji(item, pool) {
  const opts = shuffle([item, ...kanaOthers(item, pool)]);
  return (st, r, n) => askChoice(st, { label: '怎麼念？', prompt: `<div class="prompt-word">${item[0]}</div>`, options: opts.map(o => o[1]), answer: opts.indexOf(item), detail: `${item[0]} = ${item[1]}`, say: item[0] }, trackKana(item[0], r), n);
}
function exKanaListen(item, pool) {
  const opts = shuffle([item, ...kanaOthers(item, pool)]);
  return (st, r, n) => askChoice(st, { label: '聽聽看，選出聽到的假名', prompt: `${listenBtn(item[0])}`, options: opts.map(o => o[0]), jp: true, answer: opts.indexOf(item), detail: `${item[0]} = ${item[1]}`, autoSay: item[0] }, trackKana(item[0], r), n);
}
function exKanaType(item) {
  const [k, ro] = item;
  return (st, r, n) => askType(st, { label: '輸入羅馬拼音', prompt: `<div class="prompt-word">${k}</div>`, ime: false, placeholder: 'romaji',
    check: v => { v = v.trim().toLowerCase(); return v === ro || (ro === 'wo' && v === 'o') || romajiToKana(v, true) === toHiragana(k); }, detail: `${k} = ${ro}`, say: k }, trackKana(k, r), n);
}
function buildKanaLesson(u, li, replay) {
  const review = li === u.lessons.length;
  const set = unitKana(u, review ? u.lessons.flat() : u.lessons[li]);
  const prev = review ? [] : unitKana(u, u.lessons.slice(0, li).flat());
  const pool = unitKana(u, u.lessons.flat());
  const head = [], rest = [];
  if (!review) set.forEach((item, i) => {
    if (!replay) head.push(exTeachKana(item, u));
    if (set.length <= 5 || i % 2 === 0) head.push(exKanaPick(item, pool));
  });
  rest.push(exMatch(shuffle(set).slice(0, 5).map(([k, ro]) => [k, ro, k])));
  if (set.length > 5 || prev.length) rest.push(exMatch(shuffle([...set, ...prev]).slice(0, 5).map(([k, ro]) => [k, ro, k])));
  const qs = shuffle(set);
  const kinds = [exKanaListen, exKanaType, exKanaRomaji];
  for (let i = 0; i < (review ? 12 : 6); i++) rest.push(kinds[i % 3](qs[i % qs.length], pool));
  shuffle(prev).slice(0, 2).forEach(item => rest.push(exKanaType(item)));
  return { exs: [...head, ...shuffle(rest)], kana: review ? [] : set };
}

// ===== 配對題 =====
function askMatch(stage, pairs, onResult, onContinue) {
  const L = shuffle(pairs.map((p, i) => ({ t: p[0], i, say: p[2] })));
  const R = shuffle(pairs.map((p, i) => ({ t: p[1], i })));
  stage.innerHTML = `
    <div class="card prompt-card" style="padding:18px"><div class="prompt-label">配對</div><div class="muted">點日文，再點對應的意思</div></div>
    <div class="match">
      <div class="col">${L.map(x => `<button class="choice jp" data-side="L" data-i="${x.i}" data-s="${esc(x.say)}">${esc(x.t)}</button>`).join('')}</div>
      <div class="col">${R.map(x => `<button class="choice" data-side="R" data-i="${x.i}">${esc(x.t)}</button>`).join('')}</div>
    </div>`;
  let sel = null, matched = 0, mistakes = 0;
  $$('.match .choice', stage).forEach(b => b.onclick = () => {
    if (b.disabled) return;
    if (b.dataset.side === 'L') speak(b.dataset.s);
    if (!sel || sel.dataset.side === b.dataset.side) { if (sel) sel.classList.remove('sel'); sel = b; b.classList.add('sel'); return; }
    if (sel.dataset.i === b.dataset.i) {
      [sel, b].forEach(x => { x.classList.remove('sel'); x.classList.add('correct'); x.disabled = true; });
      sel = null;
      if (++matched === pairs.length) {
        onResult(true);
        feedback(stage, true, mistakes ? `全部配對完成（中間試錯 ${mistakes} 次，很正常）` : '全部配對完成', null, onContinue);
      }
    } else {
      mistakes++;
      const a = sel, c = b; sel = null;
      [a, c].forEach(x => { x.classList.remove('sel'); x.classList.add('wrong'); });
      setTimeout(() => [a, c].forEach(x => x.classList.remove('wrong')), 450);
    }
  });
  keyHandler = null;
}
