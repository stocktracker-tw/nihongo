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
const bookCache = {};   // lv → Promise
const bookData = {};    // lv → 已載入的單字陣列
function loadBook(lv) {
  if (!bookCache[lv]) {
    bookCache[lv] = fetch(`data/jlpt/${lv}.json`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(ws => (bookData[lv] = ws))
      .catch(e => { delete bookCache[lv]; throw e; });   // 失敗（離線）時下次可重試
  }
  return bookCache[lv];
}
const stillOn = route => location.hash.replace(/^#\//, '').split('?')[0] === route;
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

// ===== 動詞變化（依資料裡的動詞種類自動產生）=====
const GODAN = { う: 'わいうえお', く: 'かきくけこ', ぐ: 'がぎぐげご', す: 'さしすせそ', つ: 'たちつてと', ぬ: 'なにぬねの', ぶ: 'ばびぶべぼ', む: 'まみむめも', る: 'らりるれろ' };
const GODAN_TE = { う: 'って', つ: 'って', る: 'って', む: 'んで', ぶ: 'んで', ぬ: 'んで', く: 'いて', ぐ: 'いで', す: 'して' };
const HONOR = ['いらっしゃる', 'おっしゃる', 'くださる', 'なさる', 'ござる'];
function conjugate(w) {
  const t = w.v; if (!t) return null;
  let base = (w.w.includes('～') ? (w.r || w.w) : w.w).replace(/[～\s]/g, '');
  const kana = (w.r || w.w).replace(/[～\s]/g, '');
  if (/[、,・]/.test(base)) return null;
  const F = (a, b, c, d, e, f, g, h) => [['辞書形', a], ['ます形', b], ['て形', c], ['た形', d], ['ない形', e], ['可能形', f], ['意向形', g], ['條件形', h]];
  if (t === 'k') return F('来る（くる）', '来ます（きます）', '来て（きて）', '来た（きた）', '来ない（こない）', '来られる（こられる）', '来よう（こよう）', '来れば（くれば）');
  if (t === 's' || t === 'n') {
    const st = t === 'n' ? base : base.replace(/(する|為る)$/, '');
    const pot = t === 's' && st.length === 1 && /[\u4e00-\u9fff]/.test(st) ? st + 'せる' : st + 'できる';
    return F(st + 'する', st + 'します', st + 'して', st + 'した', st + 'しない', pot, st + 'しよう', st + 'すれば');
  }
  const st = base.slice(0, -1), last = base.slice(-1);
  if (t === '1') return F(base, st + 'ます', st + 'て', st + 'た', st + 'ない', st + 'られる', st + 'よう', st + 'れば');
  const r = GODAN[last]; if (!r) return null;
  let te = st + GODAN_TE[last];
  if (kana === 'いく' || base === '行く') te = st + 'って';
  const ta = te.replace(/て$/, 'た').replace(/で$/, 'だ');
  const masu = st + (HONOR.includes(kana) ? 'い' : r[1]) + 'ます';
  const nai = kana === 'ある' ? 'ない' : st + r[0] + 'ない';
  return F(base, masu, te, ta, nai, st + r[3] + 'る', st + r[4] + 'う', st + r[3] + 'ば');
}
function conjHTML(w, open = false) {
  const c = conjugate(w); if (!c) return '';
  return `<details class="conj" ${open ? 'open' : ''}><summary>動詞變化</summary><div class="conj-grid">${c.map(([k, v]) => `<span class="k">${k}</span><span class="v jp">${esc(v)}</span>`).join('')}</div></details>`;
}
// 例句裡把這個字標出來
function exHTML(w) {
  if (!w.e) return '';
  let ja = esc(w.e[0]);
  const key = w.w.replace(/[～\s]/g, '');
  const stem = w.v && w.v !== 'n' ? key.slice(0, -1) : key;
  for (const k of [key, stem, (w.r || '').replace(/[～\s]/g, '')]) {
    if (k && k.length >= 1 && ja.includes(esc(k))) { ja = ja.replace(esc(k), `<mark>${esc(k)}</mark>`); break; }
  }
  return `<div class="ex"><div class="row between" style="flex-wrap:nowrap"><div><div class="ja jp">${ja}</div><div class="zh">${esc(w.e[1])}</div></div>${audioBtn(w.e[0])}</div></div>`;
}

function bookProgress(lv) {
  const words = bookData[lv];
  if (!words) {
    loadBook(lv).then(() => {
      const el = $(`.book[data-lv="${lv}"] .bar i`); if (el) el.style.width = bookProgress(lv) + '%';
      const d = $(`.book[data-lv="${lv}"] .due`); const n = bookDue(lv); if (d && n) { d.textContent = `待複習 ${n}`; d.hidden = false; }
    }).catch(() => {});
    return 0;
  }
  const m = state.mastered || {};
  return words.filter(w => state.srs[w.i] || m[w.i]).length / words.length * 100;
}
function bookDue(lv) {
  const words = bookData[lv]; if (!words) return 0;
  const now = Date.now(), m = state.mastered || {};
  return words.filter(w => !m[w.i] && state.srs[w.i] && state.srs[w.i].due <= now).length;
}
let dictIndex = null;
async function dictSearch(q) {
  const out = $('#dictOut'); if (!out) return;
  if (!q) { out.style.display = 'none'; return; }
  if (!dictIndex) {
    try {
      const books = await Promise.all(BOOKS.map(b => loadBook(b.lv).then(ws => ws.map(w => ({ ...w, lv: b.name, _k: toHiragana((w.r || w.w).replace(/[～〜\s]/g, '')), _w: toHiragana(w.w) })))));
      dictIndex = books.flat();
    } catch (e) { out.style.display = ''; out.innerHTML = '<p class="muted">單字資料載入失敗，請確認網路連線。</p>'; return; }
  }
  if ($('#dict') && $('#dict').value.trim() !== q) return;   // 使用者已經改了查詢
  const kana = toHiragana(romajiToKana(q.toLowerCase(), true));
  const exact = [], prefix = [], other = [];
  for (const w of dictIndex) {
    if (w.w === q || w._k === kana) exact.push(w);
    else if (w._k.startsWith(kana) || w._w.startsWith(kana) || w.w.includes(q)) prefix.push(w);
    else if (w.m.includes(q)) other.push(w);
    if (exact.length + prefix.length >= 40) break;
  }
  const hit = [...exact, ...prefix, ...other].slice(0, 40);
  out.style.display = '';
  out.innerHTML = hit.length ? `<table class="vocab-table"><tbody>${hit.map(wordRow).join('')}</tbody></table>` : '<p class="muted">找不到符合的單字</p>';
}
function loadFailed() {
  view.innerHTML = `<div class="session"><div class="card result">${mascot(100)}<h1>單字資料載入失敗</h1>
    <p class="muted">可能是沒有網路。連上網路後再試一次，載入過的書之後離線也能用。</p>
    <button class="btn primary" onclick="route()">再試一次</button></div></div>`;
}
function wordRow(w, selectable = false, checked = false) {
  const st = wordState(w.i);
  const lead = selectable ? `<td class="pick"><input type="checkbox" ${checked ? 'checked' : ''} tabindex="-1"></td>` : '';
  return `<tr ${selectable ? `data-id="${w.i}" class="${checked ? 'sel' : ''}"` : `data-say="${esc(w.s)}"`} style="cursor:pointer">${lead}<td class="w">${esc(w.w)}</td><td class="jp muted">${esc(w.r)}</td>
    <td>${esc(w.m)}${w.n ? `<div class="small muted">${esc(w.n)}</div>` : ''}${w.e ? `<div class="small muted jp ex-line">${esc(w.e[0])}</div>` : ''}</td><td>${w.lv ? `<span class="lvl">${w.lv}</span> ` : ''}<span class="lvl ${st.cls}">${st.name}</span></td></tr>`;
}

// ===== 瀏覽整本（可批次標記）=====
async function viewBook(q) {
  const b = BOOKS.find(x => x.lv === q.get('lv')) || curBook();
  const filter = q.get('f') || 'all';
  view.innerHTML = `<p class="muted">載入中…</p>`;
  let words;
  try { words = await loadBook(b.lv); } catch (e) { return loadFailed(); }
  if (!stillOn('book')) return;
  const todayIds = new Set(wordToday().ids || []);
  const hardSet = new Set(hardWords(words).map(w => w.i));
  const match = w => {
    if (filter === 'today') return todayIds.has(w.i);
    if (filter === 'hard') return hardSet.has(w.i);
    const k = wordState(w.i).k;
    if (filter === 'learned') return k !== 'n';
    return filter === 'all' || k === filter || (filter === 'l' && k === 'r');
  };
  const special = { today: '今日學習', hard: '我的生詞', learned: '已背記錄' }[filter];
  let list = words.filter(match);
  let shown = 100, selecting = false;
  const sel = new Set();
  const tabs = [['all', '全部'], ['n', '未學'], ['l', '學習中'], ['m', '已掌握']];
  view.innerHTML = `
    <a href="#/${special ? 'home' : 'dict'}" class="muted backlink">‹ ${special ? '首頁' : '詞典'}</a>
    <h1 style="margin-top:8px">${special ? `${special} · ${b.name}` : `${b.name} ${b.desc}單字`}</h1><p class="sub" id="cnt"></p>
    <div class="row between" style="margin-bottom:12px">
      <div class="row">${special ? `<span class="small muted">${{ today: '今天背過的字', hard: '答錯過、比較難記的字', learned: '背過或標為已掌握的字' }[filter]}</span>` : tabs.map(([k, l]) => `<a class="chip ${k === filter ? 'on' : ''}" href="#/book?lv=${b.lv}&f=${k}">${l}</a>`).join('')}</div>
      <button class="chip" id="selBtn">選取</button>
    </div>
    <div class="selbar" id="selbar" hidden>
      <span id="selN">已選 0</span>
      <button class="chip" data-act="all">全選這頁</button>
      <button class="chip" data-act="none">取消</button>
      <button class="chip" data-act="master">標為已掌握</button>
      <button class="chip" data-act="unmaster">取消已掌握</button>
      <button class="chip" data-act="reset">重新學</button>
    </div>
    <div class="card" style="padding:6px 16px;overflow-x:auto"><table class="vocab-table"><tbody id="bt"></tbody></table></div>
    <div style="text-align:center;margin-top:14px"><button class="btn" id="more">再載入 100 個</button></div>`;
  const draw = () => {
    $('#cnt').textContent = `${list.length} 字 · ${selecting ? '點一列選取' : '點一列聽發音'}`;
    $('#bt').innerHTML = list.slice(0, shown).map(w => wordRow(w, selecting, sel.has(w.i))).join('') || '<tr><td class="muted">這裡還沒有單字</td></tr>';
    $('#more').style.display = shown < list.length ? '' : 'none';
    $('#selbar').hidden = !selecting;
    $('#selN').textContent = `已選 ${sel.size}`;
    $('#selBtn').textContent = selecting ? '完成' : '選取';
    $('#selBtn').classList.toggle('on', selecting);
  };
  $('#more').onclick = () => { shown += 100; draw(); };
  $('#selBtn').onclick = () => { selecting = !selecting; sel.clear(); draw(); };
  $('#bt').onclick = e => {
    if (!selecting) return;
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    const id = tr.dataset.id;
    sel.has(id) ? sel.delete(id) : sel.add(id);
    tr.classList.toggle('sel', sel.has(id));
    tr.querySelector('input').checked = sel.has(id);
    $('#selN').textContent = `已選 ${sel.size}`;
  };
  $('#selbar').onclick = e => {
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    if (act === 'all') { list.slice(0, shown).forEach(w => sel.add(w.i)); return draw(); }
    if (act === 'none') { sel.clear(); return draw(); }
    if (!sel.size) return toast('先點選要處理的單字');
    if (act === 'reset' && !confirm(`把 ${sel.size} 個字的學習進度清除、重新開始學？`)) return;
    state.mastered = state.mastered || {};
    sel.forEach(id => {
      if (act === 'master') state.mastered[id] = 1;
      if (act === 'unmaster') delete state.mastered[id];
      if (act === 'reset') { delete state.mastered[id]; delete state.srs[id]; }
    });
    save();
    toast({ master: `${sel.size} 個字標為已掌握`, unmaster: `${sel.size} 個字取消已掌握`, reset: `${sel.size} 個字已重新開始` }[act]);
    sel.clear();
    list = words.filter(match);
    draw();
  };
  draw();
}

// ===== 背單字 =====
async function viewWordStudy(q) {
  const b = curBook();
  view.innerHTML = `<p class="muted">載入中…</p>`;
  let words;
  try { words = await loadBook(b.lv); } catch (e) { return loadFailed(); }
  if (!stillOn('wordstudy')) return;
  const extra = +q.get('extra') || 0;
  const plan = planFor(words, extra);
  if (!plan.due.length && !plan.fresh.length) { location.hash = '#/home'; return; }
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
    logWord(item.isNew);
    td.ids = td.ids || [];
    if (!td.ids.includes(item.w.i)) td.ids.push(item.w.i);
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
    const stage = sessionShell(finished / total, null, '#/home');
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
          ${exHTML(w)}
          ${conjHTML(w)}
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
      const st = sessionShell(1, null, '#/home');
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
          <a class="btn" href="#/home">回首頁</a>
          <a class="btn" href="#/listen?src=today">${ico('speaker')} 隨身聽複習</a>
          <a class="btn primary" href="#/wordstudy?extra=10">再背 10 個</a>
        </div>
      </div></div>`;
  };
  step();
}

// =====================================================================
// 隨身聽：自動連續播放 單字 → 例句，可以收起手機用聽的
// =====================================================================
let player = null;
function stopPlayer() { if (player) { player.stop(); player = null; } }
async function viewListen(q) {
  const b = curBook();
  view.innerHTML = `<p class="muted">載入中…</p>`;
  let words;
  try { words = await loadBook(b.lv); } catch (e) { return loadFailed(); }
  if (!stillOn('listen')) return;
  const src = q.get('src') || 'learning';
  const m = state.mastered || {};
  const ids = new Set((wordToday().ids) || []);
  const pools = {
    today: words.filter(w => ids.has(w.i)),
    learning: words.filter(w => state.srs[w.i] && !m[w.i]),
    book: words,
  };
  const names = { today: '今天背過', learning: '學習中', book: '整本書' };
  const list = pools[src];
  view.innerHTML = `
    <a href="#/home" class="muted backlink">‹ 首頁</a>
    <h1 style="margin-top:8px">隨身聽</h1>
    <p class="sub">${b.name} · 自動播放單字和例句，可以收起手機用聽的。</p>
    <div class="row" style="margin-bottom:14px">${Object.keys(names).map(k => `<a class="chip ${k === src ? 'on' : ''}" href="#/listen?src=${k}">${names[k]}（${pools[k].length}）</a>`).join('')}</div>
    ${list.length ? `
    <div class="card prompt-card player">
      <div class="small muted" id="pPos"></div>
      <div class="prompt-word" id="pWord"></div>
      <div class="prompt-reading" id="pRead"></div>
      <div class="prompt-meaning" id="pMean" style="margin-top:6px"></div>
      <div id="pEx" class="ex" hidden><div class="ja jp" id="pExJa"></div><div class="zh" id="pExZh"></div></div>
    </div>
    <div class="row" style="justify-content:center;margin-top:16px;gap:14px">
      <button class="icon-btn big-ctl" id="pPrev" aria-label="上一個">⏮</button>
      <button class="icon-btn big-ctl play" id="pPlay" aria-label="播放">▶</button>
      <button class="icon-btn big-ctl" id="pNext" aria-label="下一個">⏭</button>
    </div>
    <div class="row" style="justify-content:center;margin-top:14px">
      <button class="chip" id="pEx1">播例句</button>
      <button class="chip" id="pRep">每個念 1 次</button>
      <button class="chip" id="pShuf">隨機順序</button>
    </div>` : `<div class="card"><p class="muted" style="margin:0">這裡還沒有單字。${src === 'today' ? '先去背今天的單字吧。' : ''}</p></div>`}`;
  if (!list.length) return;

  const opts = { ex: true, rep: 1, shuffle: false };
  let order = list.slice(), idx = 0, playing = false, token = 0, audio = null;
  const show = () => {
    const w = order[idx];
    $('#pPos').textContent = `${idx + 1} / ${order.length}`;
    $('#pWord').textContent = w.w;
    $('#pRead').textContent = w.r || '';
    $('#pMean').textContent = w.m;
    $('#pEx').hidden = !(w.e && opts.ex);
    if (w.e) { $('#pExJa').textContent = w.e[0]; $('#pExZh').textContent = w.e[1]; }
    if ('mediaSession' in navigator && window.MediaMetadata) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: w.w, artist: w.m, album: `Nihongo 隨身聽 · ${b.name}`, artwork: [{ src: 'img/icon-512.png', sizes: '512x512', type: 'image/png' }] });
    }
  };
  // 播一段文字：有 Azure 音檔就用音檔，沒有就用裝置語音
  const say = (text, my) => new Promise(res => {
    if (my !== token) return res();
    const h = speechHash(text);
    if (audioIndex && !audioIndex.has(h)) {
      if (!canSpeakDevice()) return res();   // 沒有日語語音就跳過，不用中文語音念
      const u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP'; u.rate = S().rate; u.voice = jaVoice;
      u.onend = u.onerror = () => res(); speechSynthesis.speak(u); return;
    }
    audio = new Audio(`audio/${h}.mp3`);
    audio.onended = audio.onerror = () => res();
    audio.play().catch(() => res());
  });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const run = async () => {
    const my = ++token;
    while (playing && my === token) {
      const w = order[idx];
      show();
      for (let k = 0; k < opts.rep && my === token; k++) { await say(w.s, my); await wait(500); }
      if (opts.ex && w.e && my === token) { await wait(250); await say(w.e[0], my); }
      await wait(900);
      if (my !== token || !playing) break;
      idx = (idx + 1) % order.length;
    }
  };
  const setPlaying = on => {
    playing = on;
    $('#pPlay').textContent = on ? '❚❚' : '▶';
    $('#pPlay').setAttribute('aria-label', on ? '暫停' : '播放');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = on ? 'playing' : 'paused';
    if (on) run(); else { token++; if (audio) audio.pause(); if ('speechSynthesis' in window) speechSynthesis.cancel(); }
  };
  const jump = d => { idx = (idx + d + order.length) % order.length; show(); if (playing) { token++; if (audio) audio.pause(); run(); } };
  $('#pPlay').onclick = () => setPlaying(!playing);
  $('#pPrev').onclick = () => jump(-1);
  $('#pNext').onclick = () => jump(1);
  const syncChips = () => {
    $('#pEx1').classList.toggle('on', opts.ex);
    $('#pRep').textContent = `每個念 ${opts.rep} 次`; $('#pRep').classList.toggle('on', opts.rep > 1);
    $('#pShuf').classList.toggle('on', opts.shuffle);
  };
  $('#pEx1').onclick = () => { opts.ex = !opts.ex; syncChips(); show(); };
  $('#pRep').onclick = () => { opts.rep = opts.rep % 3 + 1; syncChips(); };
  $('#pShuf').onclick = () => { opts.shuffle = !opts.shuffle; const cur = order[idx]; order = opts.shuffle ? shuffle(list) : list.slice(); idx = Math.max(0, order.indexOf(cur)); syncChips(); show(); };
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', () => setPlaying(true));
      ms.setActionHandler('pause', () => setPlaying(false));
      ms.setActionHandler('nexttrack', () => jump(1));
      ms.setActionHandler('previoustrack', () => jump(-1));
    } catch (e) { /* 部分瀏覽器不支援 */ }
  }
  keyHandler = e => {
    if (e.key === ' ') { e.preventDefault(); setPlaying(!playing); }
    if (e.key === 'ArrowRight') jump(1);
    if (e.key === 'ArrowLeft') jump(-1);
  };
  player = { stop: () => setPlaying(false) };
  syncChips(); show();
}
