'use strict';
// =====================================================================
// 單字書（學習模式仿「識日」）
//  ・N5～N1 單字書，選一本當作目前在背的書
//  ・每日任務：先複習到期的字，再學新字（艾賓浩斯式間隔，沿用 SM-2）
//  ・每張卡先自己回想：認識／模糊／不認識 → 看答案（認識的要再確認記對了沒）
//  ・洗腦循環：沒答對的字在這一輪會一直回來，直到你說「認識」
//  ・已掌握：已經會的字直接標記，以後不再出現
//  ・收尾：連連看＋聽寫，鞏固今天這一輪的字
// 本檔只宣告函式，由 app.js 載入後使用。
// =====================================================================

const BOOKS = [
  { lv: 'n5', name: 'N5', desc: '入門', c: '#6f8f60' },
  { lv: 'n4', name: 'N4', desc: '初級', c: '#9a8562' },
  { lv: 'n3', name: 'N3', desc: '中級', c: '#5f7480' },
  { lv: 'n2', name: 'N2', desc: '中高級', c: '#94705a' },
  { lv: 'n1', name: 'N1', desc: '高級', c: '#8f1a2c' },
];
const BOOK_SIZE = { n5: 717, n4: 667, n3: 2139, n2: 1806, n1: 2698 };
const DAILY_CHOICES = [5, 10, 20, 30];
const REVIEW_CAP = 150;
const bookCache = {};
function loadBook(lv) {
  if (!bookCache[lv]) bookCache[lv] = fetch(`data/jlpt/${lv}.json`).then(r => r.json());
  return bookCache[lv];
}
function wordState(id) {
  if (state.mastered && state.mastered[id]) return { k: 'm', name: '已掌握', cls: 'l4' };
  const s = state.srs[id];
  if (!s) return { k: 'n', name: '未學', cls: '' };
  if (s.ivl >= 21) return { k: 'r', name: '熟記', cls: 'l3' };
  return { k: 'l', name: '學習中', cls: 'l1' };
}
function wordToday() {
  const t = today();
  if (!state.wdone || state.wdone.date !== t) state.wdone = { date: t, new: 0, rev: 0 };
  return state.wdone;
}
function curBook() { return BOOKS.find(b => b.lv === state.book) || BOOKS[0]; }
function dailyNew() { return DAILY_CHOICES.includes(state.dailyNew) ? state.dailyNew : 10; }
function planFor(words, extra) {
  const now = Date.now(), m = state.mastered || {};
  const due = words.filter(w => !m[w.i] && state.srs[w.i] && state.srs[w.i].due <= now).slice(0, REVIEW_CAP);
  const left = extra ? extra : Math.max(0, dailyNew() - wordToday().new);
  const fresh = words.filter(w => !m[w.i] && !state.srs[w.i]).slice(0, left);
  return { due, fresh };
}
const wordHint = w => `${esc(w.w)}${w.r ? '（' + esc(w.r) + '）' : ''}　${esc(w.m)}`;

// ===== 單字書首頁 =====
async function viewBooks() {
  const b = curBook();
  view.innerHTML = `<h1>單字書</h1><p class="sub">載入中…</p>`;
  const words = await loadBook(b.lv);
  if (location.hash.split('?')[0] !== '#/vocab') return;
  const m = state.mastered || {};
  const learned = words.filter(w => state.srs[w.i] || m[w.i]).length;
  const mastered = words.filter(w => m[w.i]).length;
  const plan = planFor(words);
  const td = wordToday();
  const done = !plan.due.length && !plan.fresh.length;
  view.innerHTML = `
    <h1>單字書</h1>
    <p class="sub">JLPT N5～N1 共 8,027 字。每天先複習、再背新字，沒記住的字這一輪會一直回來（洗腦循環）。</p>
    <div class="card book-hero" style="--c:${b.c}">
      <div class="row between">
        <div><div class="book-tag">${b.name}</div><div class="unit-title" style="text-shadow:none">${b.name} ${b.desc}單字</div>
          <div class="muted small">${words.length} 字 · 學過 ${learned} · 已掌握 ${mastered}</div></div>
        <div class="ring-num"><b>${Math.round(learned / words.length * 100)}</b><small>%</small></div>
      </div>
      <div class="bar" style="margin:12px 0 16px"><i style="width:${learned / words.length * 100}%"></i></div>
      <div class="task">
        <div><span class="lbl">今日新學</span><b>${td.new}</b><small> / ${dailyNew()}</small></div>
        <div><span class="lbl">待複習</span><b>${plan.due.length}</b></div>
        <div><span class="lbl">今日已複習</span><b>${td.rev}</b></div>
      </div>
      <div class="row" style="margin-top:16px">
        ${done ? `<span class="tag" style="padding:8px 14px">今日任務完成 🎉</span><a class="btn" href="#/wordstudy?extra=10">再背 10 個</a>`
               : `<a class="btn primary big" href="#/wordstudy">開始背單字</a>`}
        <a class="btn" href="#/book?lv=${b.lv}">${ico('book')} 瀏覽單字</a>
      </div>
      <div class="row small muted" style="margin-top:14px">每日新詞
        ${DAILY_CHOICES.map(n => `<button class="chip ${n === dailyNew() ? 'on' : ''}" data-n="${n}">${n}</button>`).join('')}</div>
    </div>
    <h2>換一本</h2>
    <div class="grid books">${BOOKS.map(x => `
      <button class="card book ${x.lv === b.lv ? 'cur' : ''}" data-lv="${x.lv}" style="--c:${x.c}">
        <span class="book-tag">${x.name}</span><span class="muted small">${x.desc} · ${BOOK_SIZE[x.lv]} 字</span>
        <span class="bar"><i style="width:${bookProgress(x.lv)}%"></i></span></button>`).join('')}</div>
    <h2>查單字</h2>
    <input class="answer-input" id="dict" placeholder="輸入漢字、假名、羅馬拼音或中文" style="font-size:16px;text-align:left;margin:0">
    <div id="dictOut" class="card" style="margin-top:10px;padding:6px 16px;display:none"></div>
    <p class="small muted" style="margin-top:28px">單字表來源：<a href="https://github.com/jamsinclair/open-anki-jlpt-decks" target="_blank" rel="noopener">open-anki-jlpt-decks</a>（MIT），原始資料 <a href="http://www.tanos.co.uk/jlpt/" target="_blank" rel="noopener">tanos.co.uk</a>（Jonathan Waller，CC BY）。中文釋義為本 App 翻譯。</p>`;
  $$('[data-n]').forEach(c => c.onclick = () => { state.dailyNew = +c.dataset.n; save(); viewBooks(); });
  $$('.book[data-lv]').forEach(c => c.onclick = () => { state.book = c.dataset.lv; save(); viewBooks(); });
  let timer = 0;
  $('#dict').oninput = e => { clearTimeout(timer); timer = setTimeout(() => dictSearch(e.target.value.trim()), 180); };
}
function bookProgress(lv) {
  const words = bookCache[lv] && bookCache[lv].done;
  if (!words) { loadBook(lv).then(w => { bookCache[lv].done = w; const el = $(`.book[data-lv="${lv}"] .bar i`); if (el) el.style.width = bookProgress(lv) + '%'; }); return 0; }
  const m = state.mastered || {};
  return words.filter(w => state.srs[w.i] || m[w.i]).length / words.length * 100;
}
async function dictSearch(q) {
  const out = $('#dictOut'); if (!out) return;
  if (!q) { out.style.display = 'none'; return; }
  const all = (await Promise.all(BOOKS.map(b => loadBook(b.lv).then(ws => ws.map(w => ({ ...w, lv: b.name })))))).flat();
  const kana = toHiragana(romajiToKana(q.toLowerCase(), true));
  const hit = all.filter(w => w.w.includes(q) || (w.r && toHiragana(w.r).startsWith(kana)) || toHiragana(w.w).startsWith(kana) || w.m.includes(q)).slice(0, 40);
  out.style.display = '';
  out.innerHTML = hit.length ? `<table class="vocab-table"><tbody>${hit.map(wordRow).join('')}</tbody></table>` : '<p class="muted">找不到符合的單字</p>';
}
function wordRow(w) {
  const st = wordState(w.i);
  return `<tr data-say="${esc(w.s)}" style="cursor:pointer"><td class="w">${esc(w.w)}</td><td class="jp muted">${esc(w.r)}</td>
    <td>${esc(w.m)}${w.n ? `<div class="small muted">${esc(w.n)}</div>` : ''}</td><td>${w.lv ? `<span class="lvl">${w.lv}</span> ` : ''}<span class="lvl ${st.cls}">${st.name}</span></td></tr>`;
}

// ===== 瀏覽整本 =====
async function viewBook(q) {
  const b = BOOKS.find(x => x.lv === q.get('lv')) || curBook();
  const filter = q.get('f') || 'all';
  view.innerHTML = `<p class="muted">載入中…</p>`;
  const words = await loadBook(b.lv);
  const list = words.filter(w => filter === 'all' || wordState(w.i).k === filter || (filter === 'l' && wordState(w.i).k === 'r'));
  let shown = 100;
  const tabs = [['all', '全部'], ['n', '未學'], ['l', '學習中'], ['m', '已掌握']];
  view.innerHTML = `
    <a href="#/vocab" class="muted" style="text-decoration:none">← 單字書</a>
    <h1 style="margin-top:8px">${b.name} ${b.desc}單字</h1><p class="sub">${list.length} 字 · 點一列聽發音</p>
    <div class="row" style="margin-bottom:12px">${tabs.map(([k, l]) => `<a class="chip ${k === filter ? 'on' : ''}" href="#/book?lv=${b.lv}&f=${k}">${l}</a>`).join('')}</div>
    <div class="card" style="padding:6px 16px;overflow-x:auto"><table class="vocab-table"><tbody id="bt"></tbody></table></div>
    <div style="text-align:center;margin-top:14px"><button class="btn" id="more">再載入 100 個</button></div>`;
  const draw = () => {
    $('#bt').innerHTML = list.slice(0, shown).map(wordRow).join('') || '<tr><td class="muted">這裡還沒有單字</td></tr>';
    $('#more').style.display = shown < list.length ? '' : 'none';
  };
  $('#more').onclick = () => { shown += 100; draw(); };
  draw();
}

// ===== 背單字 =====
async function viewWordStudy(q) {
  const b = curBook();
  view.innerHTML = `<p class="muted">載入中…</p>`;
  const words = await loadBook(b.lv);
  const extra = +q.get('extra') || 0;
  const plan = planFor(words, extra);
  if (!plan.due.length && !plan.fresh.length) { location.hash = '#/vocab'; return; }
  const queue = [...shuffle(plan.due).map(w => ({ w, isNew: false })), ...plan.fresh.map(w => ({ w, isNew: true }))];
  const total = queue.length;
  const graded = new Map();   // id → 第一次的結果
  const seen = [];            // 這一輪出現過的字（收尾用）
  let loops = 0, finished = 0, nNew = 0, nRev = 0;

  const grade = (item, g) => {
    if (graded.has(item.w.i)) return;
    graded.set(item.w.i, g);
    const td = wordToday();
    if (item.isNew) { td.new++; nNew++; } else { td.rev++; nRev++; }
    state.srs[item.w.i] = nextSRS(state.srs[item.w.i], g);
    if (!seen.includes(item.w)) seen.push(item.w);
    addXP(g >= 2 ? 2 : 1);
  };
  const again = item => { loops++; queue.splice(Math.min(queue.length, 4), 0, { ...item, retry: true }); };
  const masterIt = item => {
    state.mastered = state.mastered || {};
    state.mastered[item.w.i] = 1;
    if (!graded.has(item.w.i)) { graded.set(item.w.i, 3); const td = wordToday(); if (item.isNew) { td.new++; nNew++; } else { td.rev++; nRev++; } }
    for (let k = queue.length - 1; k > 0; k--) if (queue[k].w.i === item.w.i) queue.splice(k, 1);
    save(); toast('已掌握，之後不再出現');
  };

  const step = () => {
    if (!queue.length) return wrapUp();
    const item = queue[0];
    const w = item.w;
    const stage = sessionShell(finished / total, null, '#/vocab');
    const next = done => { keyHandler = null; queue.shift(); if (done) finished++; step(); };
    const tag = item.retry ? '<span class="tag">再看一次</span>' : item.isNew ? '<span class="tag new">新詞</span>' : '<span class="tag">複習</span>';
    stage.innerHTML = `
      <div class="card prompt-card word-card-big">
        <div class="row between" style="position:absolute;top:14px;left:16px;right:16px">${tag}<span class="small muted">${b.name} · 還有 ${queue.length} 張</span></div>
        <div class="prompt-word" style="margin-top:18px">${esc(w.w)}</div>
        <div id="ans" class="ans" hidden>
          ${w.r ? `<div class="prompt-reading">${esc(w.r)}</div>` : ''}
          <div class="prompt-meaning" style="margin-top:6px">${esc(w.m)}</div>
          ${w.n ? `<div class="small muted" style="margin-top:4px">${esc(w.n)}</div>` : ''}
        </div>
        <div style="margin-top:12px">${audioBtn(w.s)}</div>
      </div>
      <div class="judge" id="judge">
        <button class="btn j-yes" data-a="yes">認識<span class="kbd">1</span></button>
        <button class="btn j-maybe" data-a="maybe">模糊<span class="kbd">2</span></button>
        <button class="btn j-no" data-a="no">不認識<span class="kbd">3</span></button>
      </div>
      <div class="judge" id="after" hidden></div>
      <div style="text-align:center;margin-top:12px"><button class="linkbtn" id="master">${ico('star')} 已掌握，以後不用再背</button></div>`;
    if (S().autoplay) speak(w.s);
    const reveal = a => {
      $('#ans').hidden = false; $('#judge').hidden = true;
      const after = $('#after'); after.hidden = false;
      if (a === 'yes') {
        after.innerHTML = `<button class="btn j-no" data-b="wrong">記錯了<span class="kbd">2</span></button><button class="btn primary" data-b="right">記對了<span class="kbd">1</span></button>`;
      } else {
        after.innerHTML = `<button class="btn primary" data-b="next" style="grid-column:1/-1">記住了，下一個<span class="kbd">Enter</span></button>`;
      }
      if (S().autoplay) speak(w.s);
      const finish = b2 => {
        if (b2 === 'right') { grade(item, item.isNew && !item.retry ? 3 : 2); next(true); return; }
        if (a === 'maybe') grade(item, 1); else grade(item, 0);
        again(item); next(false);
      };
      $$('#after [data-b]').forEach(x => x.onclick = () => finish(x.dataset.b));
      keyHandler = e => {
        if (a === 'yes') { if (e.key === '1' || e.key === 'Enter') finish('right'); if (e.key === '2') finish('wrong'); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); finish('next'); }
      };
    };
    $$('#judge [data-a]').forEach(x => x.onclick = () => reveal(x.dataset.a));
    $('#master').onclick = () => { masterIt(item); next(true); };
    keyHandler = e => { const k = { 1: 'yes', 2: 'maybe', 3: 'no' }[e.key]; if (k) reveal(k); };
  };

  // 收尾：連連看 → 聽寫
  const wrapUp = () => {
    save();
    const pool = seen.filter(w => !(state.mastered || {})[w.i]);
    const games = [];
    for (let k = 0; k < Math.min(pool.length, 10); k += 5) {
      const set = pool.slice(k, k + 5);
      if (set.length >= 3) games.push(st => new Promise(res => askMatch(st, set.map(w => [w.w, w.m, w.s]), () => {}, res)));
    }
    const missed = pool.filter(w => graded.get(w.i) < 2);
    shuffle([...missed, ...pool.filter(w => !missed.includes(w))]).slice(0, Math.min(5, pool.length)).forEach(w => {
      const ans = w.r || w.w;
      games.push(st => new Promise(res => askType(st, { label: '聽寫：聽到什麼就打什麼', prompt: listenBtn(w.s), ime: true,
        check: v => normKana(v) === normKana(ans) || v.trim() === w.w, detail: wordHint(w), say: w.s }, () => {}, res)));
    });
    let gi = 0;
    const play = () => {
      if (gi >= games.length) return result();
      const st = sessionShell(1, null, '#/vocab');
      st.insertAdjacentHTML('beforebegin', `<div class="tag" style="margin-bottom:10px">鞏固 ${gi + 1} / ${games.length}</div>`);
      games[gi](st).then(() => { gi++; play(); });
    };
    if (games.length) play(); else result();
  };
  const result = () => {
    keyHandler = null;
    const right = [...graded.values()].filter(g => g >= 2).length;
    view.innerHTML = `
      <div class="session"><div class="card result fade-in">
        ${mascot(110, 'happy')}
        <h1>這一輪背完了！</h1>
        <p class="muted">${loops ? `洗腦循環 ${loops} 次，沒記住的字都多看了幾遍。` : '全部一次就記住，太強了。'}</p>
        <div class="grid grid-4" style="margin:24px auto">
          <div class="stat"><span class="big">${nNew}</span><span class="lbl">新學</span></div>
          <div class="stat"><span class="big">${nRev}</span><span class="lbl">複習</span></div>
          <div class="stat"><span class="big">${graded.size ? Math.round(right / graded.size * 100) : 0}%</span><span class="lbl">第一次就記住</span></div>
        </div>
        <div class="row" style="justify-content:center">
          <a class="btn" href="#/vocab">回單字書</a>
          <a class="btn primary" href="#/wordstudy?extra=10">再背 10 個</a>
        </div>
      </div></div>`;
  };
  step();
}
