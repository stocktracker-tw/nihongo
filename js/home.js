'use strict';
// =====================================================================
// 介面（仿「識日」）：首頁任務卡＋功能格、詞典、發現、我的（學習數據）
// 本檔只宣告函式，由 app.js 載入後使用。
// =====================================================================

// 每天新學／複習了幾個單字（給「我的」的學習趨勢圖用）
function logWord(isNew) {
  const t = today();
  state.wlog = state.wlog || {};
  const d = state.wlog[t] || (state.wlog[t] = { n: 0, r: 0 });
  if (isNew) d.n++; else d.r++;
}
// 目前路由還是不是剛進來時那一頁（非同步載入後檢查用）
const sameView = h => location.hash === h;
const feat = (href, icon, label, badge) =>
  `<a class="feat" href="${href}"><span class="feat-ic">${ico(icon)}</span><span class="feat-lb">${label}</span>${badge ? `<span class="feat-badge">${badge}</span>` : ''}</a>`;

function hardWords(words) {
  const m = state.mastered || {};
  return words.filter(w => !m[w.i] && state.srs[w.i] && (state.srs[w.i].lapses > 0 || state.srs[w.i].ease < 2.35));
}

// =====================================================================
// 首頁
// =====================================================================
async function viewHome() {
  const h = location.hash;
  const b = curBook();
  view.innerHTML = homeTop() + `<div class="card plan"><p class="muted" style="margin:0">載入中…</p></div>`;
  let words;
  try { words = await loadBook(b.lv); } catch (e) { return loadFailed(); }
  if (!sameView(h)) return;
  const m = state.mastered || {};
  const learned = words.filter(w => state.srs[w.i] || m[w.i]).length;
  const plan = planFor(words);
  const td = wordToday();
  const done = !plan.due.length && !plan.fresh.length;
  const todayN = (td.ids || []).length;
  const hard = hardWords(words).length;
  view.innerHTML = homeTop() + `
    <div class="card plan" style="--c:${b.c}">
      <div class="plan-head">
        <span class="plan-book">${b.name}</span>
        <div class="grow">
          <div class="plan-title">${b.name} ${b.desc}單字</div>
          <div class="plan-count"><b>${learned}</b> / ${words.length}</div>
        </div>
        <button class="linkbtn plan-switch" id="switch">切換</button>
      </div>
      <div class="bar plan-bar"><i style="width:${learned / words.length * 100}%"></i></div>
      <div id="picker" hidden></div>
      <div class="plan-row">
        <div class="pnum"><b>${plan.due.length}</b><span>等待複習</span></div>
        <div class="pnum"><b>${td.new}<small>/${dailyNew()}</small></b><span>今日學習</span></div>
        ${done ? `<a class="btn big plan-go" href="#/wordstudy?extra=10">再背 10 個</a>`
               : `<a class="btn primary big plan-go" href="#/wordstudy">${plan.fresh.length ? '開始背詞' : '開始複習'}</a>`}
      </div>
      ${done ? `<div class="small muted plan-note">今天的任務完成了，想多背再按一次就好。</div>` : ''}
    </div>
    <div class="quick">
      <a class="qpill" href="#/listen?src=${todayN ? 'today' : 'learning'}">${ico('headphones')}<span>隨身聽</span>${ico('chev', 'chev')}</a>
      <a class="qpill" href="#/grammar">${ico('list')}<span>背文法</span>${ico('chev', 'chev')}</a>
    </div>
    <h3 class="sec">常用功能</h3>
    <div class="feats">
      ${feat('#/book?f=today', 'calendar', '今日學習', todayN || '')}
      ${feat('#/book?f=hard', 'heart', '我的生詞', hard || '')}
      ${feat('#/me', 'chart', '數據統計')}
    </div>
    <h3 class="sec">其他功能</h3>
    <div class="feats">
      ${feat(`#/book?lv=${b.lv}&f=l`, 'layers', '在學詞單')}
      ${feat(`#/book?lv=${b.lv}&f=learned`, 'clock', '已背記錄')}
      ${feat(`#/book?lv=${b.lv}&f=m`, 'check', '已掌握')}
      ${feat('#/kana', 'kana', '五十音')}
      ${feat('#/challenge', 'pen', '綜合練習')}
      ${feat('#/course', 'route', '入門課程')}
    </div>`;
  bindHomeTop();
  $('#switch').onclick = () => {
    const p = $('#picker');
    p.hidden = !p.hidden;
    if (!p.hidden) p.innerHTML = pickerHTML();
    bindPicker(p, viewHome);
  };
}
function homeTop() {
  return `<div class="home-top">
    <button class="searchpill" id="goDict">${ico('search')}<span>查單字：漢字、假名、羅馬拼音、中文</span></button>
    <a class="icon-btn" href="#/listen" aria-label="隨身聽">${ico('headphones')}</a>
  </div>`;
}
function bindHomeTop() {
  $('#goDict').onclick = () => { location.hash = '#/dict?focus=1'; };
  keyHandler = e => { if (e.key === '/') { e.preventDefault(); location.hash = '#/dict?focus=1'; } };
}
function pickerHTML() {
  return `<div class="picker">
    <div class="small muted">學習的單字書</div>
    <div class="row">${BOOKS.map(x => `<button class="chip ${x.lv === curBook().lv ? 'on' : ''}" data-lv="${x.lv}">${x.name} ${x.desc}</button>`).join('')}</div>
    <div class="small muted" style="margin-top:8px">每日新詞</div>
    <div class="row">${DAILY_CHOICES.map(n => `<button class="chip ${n === dailyNew() ? 'on' : ''}" data-n="${n}">${n} 個</button>`).join('')}</div>
  </div>`;
}
function bindPicker(root, redraw) {
  $$('[data-lv]', root).forEach(c => c.onclick = () => { state.book = c.dataset.lv; save(); redraw(); });
  $$('[data-n]', root).forEach(c => c.onclick = () => { state.dailyNew = +c.dataset.n; save(); redraw(); });
}

// =====================================================================
// 詞典：查單字＋各級單字書
// =====================================================================
function viewDict(q) {
  view.innerHTML = `
    <h1>詞典</h1>
    <div class="searchbox">${ico('search')}<input id="dict" placeholder="漢字、假名、羅馬拼音或中文" autocomplete="off" enterkeyhint="search"></div>
    <div id="dictOut" class="card" style="margin-top:10px;padding:6px 16px;display:none"></div>
    <h3 class="sec">單字書</h3>
    <div class="booklist">${BOOKS.map(x => `
      <a class="card bookrow ${x.lv === curBook().lv ? 'cur' : ''}" href="#/book?lv=${x.lv}" data-lv="${x.lv}" style="--c:${x.c}">
        <span class="plan-book">${x.name}</span>
        <span class="grow"><b>${x.name} ${x.desc}單字</b><span class="small muted"> · ${BOOK_SIZE[x.lv]} 字</span>
          <span class="bar"><i style="width:${bookProgress(x.lv)}%"></i></span></span>
        <span class="due small" ${bookDue(x.lv) ? '' : 'hidden'}>待複習 ${bookDue(x.lv)}</span>
        ${ico('chev', 'chev')}</a>`).join('')}</div>
    <p class="small muted" style="margin-top:22px">單字表來源：<a href="https://github.com/jamsinclair/open-anki-jlpt-decks" target="_blank" rel="noopener">open-anki-jlpt-decks</a>（MIT），原始資料 <a href="http://www.tanos.co.uk/jlpt/" target="_blank" rel="noopener">tanos.co.uk</a>（Jonathan Waller，CC BY）。中文釋義與例句為本 App 編寫。</p>`;
  const input = $('#dict');
  let timer = 0;
  input.oninput = e => { clearTimeout(timer); timer = setTimeout(() => dictSearch(e.target.value.trim()), 180); };
  if (q.get('focus')) setTimeout(() => input.focus(), 60);
}

// =====================================================================
// 發現：其他學習內容
// =====================================================================
function viewDiscover() {
  const kanaDone = Object.values(state.kana || {}).filter(k => k && k.c > 0).length;
  view.innerHTML = `
    <h1>發現</h1>
    <h3 class="sec">入門</h3>
    <div class="feats">
      ${feat('#/kana', 'kana', '五十音表')}
      ${feat('#/kanaquiz', 'pen', '假名測驗')}
      ${feat('#/course', 'route', '入門課程')}
    </div>
    <h3 class="sec">單字與聽力</h3>
    <div class="feats">
      ${feat('#/listen', 'headphones', '隨身聽')}
      ${feat('#/challenge', 'check', '綜合練習')}
      ${feat('#/study', 'cards', '課程複習', dueIds().length || '')}
    </div>
    <h3 class="sec">文法</h3>
    <div class="feats">
      ${feat('#/grammar', 'list', '文法 25 條')}
      ${feat('#/dict?focus=1', 'search', '查單字')}
      ${feat('#/me', 'chart', '學習數據')}
    </div>
    <p class="small muted" style="margin-top:22px">${kanaDone ? `五十音已練過 ${kanaDone} 個。` : ''}這裡沒有連續天數、沒有愛心、不鎖內容，想學就學。</p>`;
}

// =====================================================================
// 我的：學習數據＋設定
// =====================================================================
function viewMe(q) {
  const span = +q.get('d') === 30 ? 30 : 7;
  const days = Array.from({ length: span }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (span - 1 - i)); return dateStr(d); });
  const wl = state.wlog || {};
  const rows = days.map(d => {
    const n = (wl[d] && wl[d].n) || 0;
    const total = state.history[d] || 0;
    return { d, n, r: Math.max(0, total - n) };
  });
  const max = Math.max(4, ...rows.map(x => x.n + x.r));
  const jIds = Object.keys(state.srs).filter(id => id[0] === 'j');
  const mastered = Object.keys(state.mastered || {}).length;
  const learnedWords = new Set([...jIds, ...Object.keys(state.mastered || {})]).size;
  const reviewsTotal = Object.values(state.history).reduce((a, b) => a + b, 0);
  const newTotal = Object.values(wl).reduce((a, b) => a + (b.n || 0), 0);
  const due = wordDueCount() + dueIds().length;
  const kanaN = Object.values(state.kana || {}).filter(k => k && k.c > 0).length;
  const label = d => span === 7 ? '日一二三四五六'[new Date(d).getDay()] : (+d.slice(8)) % 5 === 0 || d === days[span - 1] ? String(+d.slice(8)) : '';
  view.innerHTML = `
    <div class="card me-head">
      <img class="me-avatar" src="img/kuro.webp" alt="">
      <div class="grow"><div class="plan-title">學習了 ${totalDays()} 天</div>
        <div class="small muted">本週 ${weekDays().filter(d => d.active).length} 天 · 休息不會歸零</div></div>
    </div>
    <div class="card">
      <div class="row between"><h3 class="sec" style="margin:0">${ico('chart')} 學習趨勢</h3>
        <div class="seg"><a class="${span === 7 ? 'on' : ''}" href="#/me?d=7">7 天</a><a class="${span === 30 ? 'on' : ''}" href="#/me?d=30">30 天</a></div></div>
      <div class="legend small muted"><span><i class="dot n"></i>新學</span><span><i class="dot r"></i>複習</span></div>
      <div class="chart ${span === 30 ? 'dense' : ''}">${rows.map(x => `
        <div class="col" title="${x.d}：新學 ${x.n}、複習 ${x.r}">
          <div class="stack"><i class="r" style="height:${x.r / max * 100}%"></i><i class="n" style="height:${x.n / max * 100}%"></i></div>
          <span class="x">${label(x.d)}</span></div>`).join('')}</div>
    </div>
    <div class="card">
      <h3 class="sec" style="margin-top:0">${ico('star')} 累計統計</h3>
      <div class="tiles">
        <div class="tile2"><span class="lbl">${ico('book')}學過單字</span><b>${learnedWords}</b></div>
        <div class="tile2"><span class="lbl">${ico('check')}已掌握</span><b>${mastered}</b></div>
        <div class="tile2"><span class="lbl">${ico('layers')}累計新學</span><b>${newTotal}</b></div>
        <div class="tile2"><span class="lbl">${ico('cards')}待複習</span><b>${due}</b></div>
        <div class="tile2 wide"><span class="lbl">${ico('clock')}累計學習次數</span><b>${reviewsTotal}<small> 次</small></b></div>
        <div class="tile2 wide"><span class="lbl">${ico('kana')}五十音練過</span><b>${kanaN}<small> 個</small></b></div>
      </div>
    </div>
    <div class="card" id="setCard">
      <h3 class="sec" style="margin-top:0">${ico('cog')} 學習設定</h3>
      ${pickerHTML()}
    </div>
    <p class="small muted" style="margin-top:18px">資料只存在這台裝置的瀏覽器裡，不需要帳號。</p>`;
  bindPicker($('#setCard'), () => viewMe(q));
}
