'use strict';
// =====================================================================
// Nihongo — 綜合 Anki（間隔重複）、WaniKani（輸入作答、等級）、
// Duolingo（連續天數、XP、愛心挑戰、拼字塊造句）、Bunpro（文法填空）、
// Tofugu（五十音口訣）與手寫練習的單檔靜態 App。
// =====================================================================

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $('#view');
const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dateStr(new Date());
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.random() * a.length | 0];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ===== 狀態 =====
const KEY = 'nihongo-dojo-v1'; // 沿用舊 key，保留既有進度
// 沒有設定頁：全部用固定值（深色無印良品、振假名、自動發音、正常語速、每日小目標 50 XP）
const SETTINGS = Object.freeze({ goal: 50, newPerDay: 10, furigana: true, autoplay: true, rate: 0.9 });
let state = load();
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) { const st = { ...blank(), ...s }; delete st.settings; return st; }
  } catch (e) { /* ignore */ }
  return blank();
}
function blank() {
  return { srs: {}, kana: {}, lessons: {}, xp: 0, xpDay: {}, history: {}, newDay: { date: '', count: 0 } };
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); renderMini(); }
const S = () => SETTINGS;

// 不做連續天數（streak）：只記錄「累積學習天數」與「本週學了幾天」，休息不會歸零。
function addXP(n, reviewed = 1) {
  const t = today();
  state.xp += n;
  state.xpDay[t] = (state.xpDay[t] || 0) + n;
  state.history[t] = (state.history[t] || 0) + (+reviewed);
  save();
}
function totalDays() { return Object.keys(state.history).filter(d => state.history[d] > 0).length; }
function weekDays() {
  const now = new Date(); const dow = (now.getDay() + 6) % 7; // 週一為第一天
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - dow + i);
    return { label: '一二三四五六日'[i], active: (state.history[dateStr(d)] || 0) > 0, today: i === dow };
  });
}

// ===== 間隔重複（SM-2 變體，Anki 四鍵）=====
// grade: 0 重來 / 1 困難 / 2 良好 / 3 簡單
function nextSRS(prev, grade) {
  const s = { ease: 2.5, ivl: 0, reps: 0, lapses: 0, due: 0, ...(prev || {}) };
  if (grade === 0) {
    s.reps = 0; s.lapses++; s.ivl = 0; s.ease = Math.max(1.3, s.ease - 0.2);
    s.due = Date.now() + 10 * 60000;
    return s;
  }
  if (s.reps === 0) s.ivl = [0, 1, 1, 4][grade];
  else if (s.reps === 1) s.ivl = [0, 2, 3, 7][grade];
  else s.ivl = Math.round(s.ivl * [0, 1.2, s.ease, s.ease * 1.3][grade]);
  s.ivl = Math.max(1, s.ivl);
  s.ease = Math.max(1.3, s.ease + [0, -0.15, 0, 0.15][grade]);
  s.reps++;
  s.due = Date.now() + s.ivl * DAY;
  return s;
}
function schedule(id, grade) {
  if (!state.srs[id] && id.startsWith('v')) {
    if (state.newDay.date !== today()) state.newDay = { date: today(), count: 0 };
    state.newDay.count++;
  }
  state.srs[id] = nextSRS(state.srs[id], grade);
  save();
}
function ivlLabel(prev, grade) {
  const n = nextSRS(prev, grade);
  if (grade === 0) return '10 分';
  return n.ivl >= 30 ? Math.round(n.ivl / 30) + ' 月' : n.ivl + ' 天';
}
// WaniKani 式等級
function level(id) {
  const s = state.srs[id];
  if (!s) return { cls: '', name: '未學' };
  if (s.ivl < 4) return { cls: 'l1', name: '學徒' };
  if (s.ivl < 14) return { cls: 'l2', name: '熟練' };
  if (s.ivl < 60) return { cls: 'l3', name: '精通' };
  return { cls: 'l4', name: '燒錄' };
}
function dueIds() {
  const now = Date.now();
  return Object.keys(state.srs).filter(id => state.srs[id].due <= now && ITEMS[id]);
}

const ITEMS = {};
VOCAB.forEach(v => ITEMS[v.id] = { ...v, kind: 'v' });
GRAMMAR.forEach(g => ITEMS[g.id] = { ...g, kind: 'g' });
registerCourseItems();

// ===== 羅馬拼音 → 假名（WaniKani 式即時轉換）=====
const ROMA = {};
for (const group of Object.values(KANA_ROWS)) for (const row of group) for (const c of row) if (c && !ROMA[c[1]]) ROMA[c[1]] = c[0];
Object.assign(ROMA, {
  si: 'し', ti: 'ち', tu: 'つ', hu: 'ふ', zi: 'じ', di: 'ぢ', du: 'づ', o: 'お', wo: 'を', nn: 'ん', "n'": 'ん', '-': 'ー',
  sya: 'しゃ', syu: 'しゅ', syo: 'しょ', tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ', cya: 'ちゃ', cyu: 'ちゅ', cyo: 'ちょ',
  jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ', zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
  she: 'しぇ', je: 'じぇ', che: 'ちぇ', fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ', ti: 'ち',
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ', la: 'ぁ', li: 'ぃ', lu: 'ぅ', le: 'ぇ', lo: 'ぉ',
  xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', lya: 'ゃ', lyu: 'ゅ', lyo: 'ょ', xtu: 'っ', ltu: 'っ',
});
ROMA.o = 'お';
function romajiToKana(input, final = false) {
  const str = input.toLowerCase();
  let out = '', i = 0;
  while (i < str.length) {
    const c = str[i];
    if (!/[a-z'\-]/.test(c)) { out += c; i++; continue; }
    const nx = str[i + 1];
    if (c === 'n' && nx === 'n') {
      if (i + 2 >= str.length && !final) { out += 'nn'; i += 2; continue; }
      if (/[aiueoy]/.test(str[i + 2] || '')) { out += 'ん'; i += 1; continue; }
      out += 'ん'; i += 2; continue;
    }
    if (c === nx && /[bcdfghjkmpqrstvwxz]/.test(c)) { out += 'っ'; i++; continue; }
    if (c === 'n' && nx && !/[aiueoyn']/.test(nx)) { out += 'ん'; i++; continue; }
    let m = false;
    for (let L = 3; L >= 1; L--) {
      const sub = str.substr(i, L);
      if (sub.length === L && ROMA[sub] && sub !== 'n') { out += ROMA[sub]; i += L; m = true; break; }
    }
    if (!m) {
      out += c === 'n' && final ? 'ん' : c;
      i++;
    }
  }
  return out;
}
function bindIME(input) {
  input.addEventListener('input', e => {
    if (e.isComposing) return;
    const v = romajiToKana(input.value);
    if (v !== input.value) input.value = v;
  });
}
const normKana = s => toHiragana(romajiToKana(s.trim(), true)).replace(/[\s。、.,!?！？]/g, '');

// ===== 語音 =====
// 主要：Azure Neural TTS（Nanami HD，大姊姊聲線）預先產生的 mp3，放在 audio/<雜湊>.mp3。
// 清單外的文字或檔案載入失敗時，才退回裝置內建的語音合成。
// 產生方式見 tools/gen_audio.py；網頁不含任何 Azure 金鑰。
function speechHash(s) { // FNV-1a 32 位元，和 tools/gen_audio.py 相同
  let h = 0x811c9dc5;
  for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
let audioIndex = null;      // Set<雜湊>，載入前為 null
fetch('audio/index.json').then(r => r.ok ? r.json() : []).then(list => { audioIndex = new Set(list); }).catch(() => { audioIndex = new Set(); });
let curAudio = null;
let jaVoice = null;
function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang));
  jaVoice = vs.find(v => /Google|Nanami|Kyoko|Otoya|Natural/i.test(v.name)) || vs[0] || null;
}
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function stopSpeech() {
  if (curAudio) { curAudio.pause(); curAudio = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
function speakDevice(text) {
  if (!('speechSynthesis' in window)) { toast('此瀏覽器不支援語音'); return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP'; u.rate = S().rate;
  if (jaVoice) u.voice = jaVoice;
  speechSynthesis.speak(u);
}
function speak(text) {
  text = String(text).trim();
  if (!text) return;
  stopSpeech();
  const h = speechHash(text);
  if (audioIndex && !audioIndex.has(h)) return speakDevice(text);
  const a = new Audio(`audio/${h}.mp3`);
  curAudio = a;
  let fell = false;
  const fallback = () => { if (fell || curAudio !== a) return; fell = true; curAudio = null; speakDevice(text); };
  a.onerror = fallback;
  a.play().catch(err => { if (err && err.name !== 'AbortError') fallback(); });
}

// ===== 共用 UI =====
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}
let keyHandler = null;
document.addEventListener('keydown', e => {
  if (!keyHandler) return;
  const typing = e.target.tagName === 'INPUT' && e.target.type === 'text';
  if (typing && e.key !== 'Enter') return;
  keyHandler(e);
});
function ruby(word, reading, force) {
  if (word === reading || (!S().furigana && !force)) return esc(word);
  return `<ruby>${esc(word)}<rt>${esc(reading)}</rt></ruby>`;
}

// ===== 線條圖示（取代 emoji，和分頁列一致）=====
const ICONS = {
  speaker: '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  book: '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  star: '<path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.5l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
  cards: '<rect x="3.5" y="6.5" width="13" height="14" rx="2.5"/><path d="M7.5 3.5h10.5A2.5 2.5 0 0 1 20.5 6v11"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
};
const ico = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const listenBtn = text => `<button class="listen" data-say="${esc(text)}" aria-label="再聽一次">${ico('speaker')}<span>再聽一次</span></button>`;
const audioBtn = text => `<button class="icon-btn" data-say="${esc(text)}" title="播放發音" aria-label="播放發音">${ico('speaker')}</button>`;
view.addEventListener('click', e => {
  const b = e.target.closest('[data-say]');
  if (b) { e.stopPropagation(); speak(b.dataset.say); }
});

function applyTheme() { document.documentElement.dataset.theme = 'dark'; }

function renderMini() {
  const el = $('#miniStats');
  if (el) el.innerHTML = `<span title="累積學習天數">${ico('calendar')}${totalDays()}</span><span title="總 XP">${ico('star')}${state.xp}</span><span title="待複習">${ico('cards')}${dueIds().length}</span>`;
}

// ===== 路由 =====
const routes = { home: viewPath, lesson: viewLesson, guide: viewGuide, kana: viewKana, vocab: viewVocab, grammar: viewGrammar, challenge: viewChallenge, study: viewStudy, kanaquiz: viewKanaQuiz };
function route() {
  keyHandler = null;
  gentleRetry = false;
  document.body.classList.remove('in-session');
  stopSpeech();
  const [name, q] = location.hash.replace(/^#\//, '').split('?');
  const r = routes[name] ? name : 'home';
  $$('#nav a').forEach(a => a.toggleAttribute('aria-current', a.dataset.r === tabRoute(r)));
  view.innerHTML = '';
  view.className = 'fade-in';
  routes[r](new URLSearchParams(q || ''));
  if (window.__tabSync) window.__tabSync(true);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// =====================================================================
// 首頁
// =====================================================================
function kanaMastery(c) {
  const k = state.kana[c];
  if (!k) return 0;
  if (k.c >= 3 && k.c >= k.w * 3) return 2;
  return k.c > 0 ? 1 : 0;
}
function kanaList(type = 'hira', groups = ['basic', 'dakuten', 'yoon']) {
  const out = [];
  groups.forEach(g => KANA_ROWS[g].forEach(row => row.forEach(c => c && out.push([type === 'kata' ? toKatakana(c[0]) : c[0], c[1]]))));
  return out;
}


// =====================================================================
// 五十音
// =====================================================================
function viewKana(q) {
  const type = q.get('t') === 'kata' ? 'kata' : 'hira';
  const conv = k => type === 'kata' ? toKatakana(k) : k;
  const section = (title, g) => `
    <h2>${title}</h2>
    <div class="kana-grid ${g === 'yoon' ? 'cols-3' : ''}">
      ${KANA_ROWS[g].map(row => row.map(c => c
        ? `<button class="kana-cell" data-k="${conv(c[0])}" data-r="${c[1]}" data-h="${c[0]}" data-m="${kanaMastery(conv(c[0]))}"><span class="k">${conv(c[0])}</span><span class="r">${c[1]}</span></button>`
        : '<span class="kana-cell empty"></span>').join('')).join('')}
    </div>`;
  view.innerHTML = `
    <div class="row between"><div><h1>五十音</h1><p class="sub">點擊假名查看口訣、聽發音、練習手寫。底線顏色＝熟練度。</p></div>
      <a class="btn primary" href="#/kanaquiz?t=${type}">開始測驗</a></div>
    <div class="row" style="margin-bottom:8px">
      <a class="chip ${type === 'hira' ? 'on' : ''}" href="#/kana">ひらがな 平假名</a>
      <a class="chip ${type === 'kata' ? 'on' : ''}" href="#/kana?t=kata">カタカナ 片假名</a>
    </div>
    <div id="kanaDetail"></div>
    ${section('清音', 'basic')}${section('濁音・半濁音', 'dakuten')}${section('拗音', 'yoon')}`;
  $$('.kana-cell[data-k]').forEach(b => b.onclick = () => { speak(b.dataset.k); showKanaDetail(b.dataset.k, b.dataset.r, b.dataset.h, type); });
}
function showKanaDetail(k, r, h, type) {
  const st = state.kana[k] || { c: 0, w: 0 };
  const mn = type === 'hira' ? KANA_MNEMONIC[k] : (KANA_MNEMONIC[h] ? `對應平假名「${h}」` : '');
  const box = $('#kanaDetail');
  box.innerHTML = `
    <div class="card detail fade-in" style="margin:16px 0">
      <div style="text-align:center">
        <div class="big-kana">${k}</div>
        <div style="font-size:22px;font-weight:700">${r}</div>
        ${mn ? `<p class="hint">${ico('bulb')}${esc(mn)}</p>` : ''}
        <p class="small muted">測驗紀錄：答對 ${st.c} · 答錯 ${st.w}</p>
        <div class="row" style="justify-content:center">${audioBtn(k)}<button class="btn" id="closeDetail">關閉</button></div>
      </div>
      <div>
        <div class="canvas-wrap"><div class="guide">${k.length === 1 ? k : ''}</div><canvas id="pad"></canvas></div>
        <div class="row" style="justify-content:center;margin-top:10px">
          <button class="btn" id="clearPad">清除</button>
          <button class="btn" id="toggleGuide">隱藏範本</button>
        </div>
      </div>
    </div>`;
  $('#closeDetail').onclick = () => box.innerHTML = '';
  const cv = $('#pad'); const ctx = setupPad(cv);
  $('#clearPad').onclick = () => ctx.clearRect(0, 0, cv.width, cv.height);
  $('#toggleGuide').onclick = e => { const g = $('.guide', box); const hide = g.style.opacity !== '0'; g.style.opacity = hide ? '0' : ''; e.target.textContent = hide ? '顯示範本' : '隱藏範本'; };
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function setupPad(cv) {
  const dpr = window.devicePixelRatio || 1;
  const rect = cv.getBoundingClientRect();
  cv.width = rect.width * dpr; cv.height = rect.height * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(6, rect.width / 28);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink');
  let drawing = false;
  const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.onpointerdown = e => { drawing = true; cv.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); };
  cv.onpointermove = e => { if (!drawing) return; ctx.lineTo(...pos(e)); ctx.stroke(); };
  cv.onpointerup = cv.onpointercancel = () => drawing = false;
  return { clearRect: () => ctx.clearRect(0, 0, cv.width, cv.height) };
}

// 五十音測驗設定 + 進行
function viewKanaQuiz(q) {
  const type = q.get('t') || 'hira';
  if (!q.get('go')) {
    view.innerHTML = `
      <h1>五十音測驗</h1><p class="sub">選擇範圍。題型會混合：看字打拼音、看拼音選字、聽音選字。打錯的字會更常出現。</p>
      <div class="card">
        <div class="field"><b>文字</b><div class="row">
          ${[['hira', '平假名'], ['kata', '片假名'], ['both', '混合']].map(([v, l]) => `<button class="chip ${v === type ? 'on' : ''}" data-t="${v}">${l}</button>`).join('')}</div></div>
        <div class="field"><b>範圍</b><div class="row">
          ${[['basic', '清音'], ['dakuten', '濁音'], ['yoon', '拗音']].map(([v, l], i) => `<button class="chip ${i === 0 ? 'on' : ''}" data-g="${v}">${l}</button>`).join('')}</div></div>
        <div class="field"><b>題數</b><select id="qn"><option>10</option><option selected>20</option><option>40</option></select></div>
        <button class="btn primary big block" id="go" style="margin-top:10px">開始</button>
      </div>`;
    $$('[data-t]').forEach(b => b.onclick = () => { $$('[data-t]').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
    $$('[data-g]').forEach(b => b.onclick = () => b.classList.toggle('on'));
    $('#go').onclick = () => {
      const t = $('[data-t].on').dataset.t;
      const g = $$('[data-g].on').map(b => b.dataset.g);
      if (!g.length) return toast('請至少選一個範圍');
      location.hash = `#/kanaquiz?go=1&t=${t}&g=${g.join(',')}&n=${$('#qn').value}`;
    };
    return;
  }
  const groups = (q.get('g') || 'basic').split(',');
  let pool = type === 'both' ? [...kanaList('hira', groups), ...kanaList('kata', groups)] : kanaList(type, groups);
  const n = +q.get('n') || 20;
  // 依錯誤率加權抽題
  const weighted = pool.flatMap(p => { const s = state.kana[p[0]] || { c: 0, w: 0 }; return Array(1 + s.w * 2 + (s.c < 2 ? 1 : 0)).fill(p); });
  const qs = []; for (let i = 0; i < n; i++) { let p; do { p = pick(weighted); } while (qs.length && qs[qs.length - 1] === p && pool.length > 1); qs.push(p); }
  let idx = 0, correct = 0;
  const step = () => {
    if (idx >= qs.length) {
      return showResult({ title: '五十音測驗完成', correct, total: qs.length, xp: correct * 2, again: location.hash, back: '#/kana' + (type === 'kata' ? '?t=kata' : '') });
    }
    const [k, r] = qs[idx];
    const stage = sessionShell(idx / qs.length, null, '#/kana');
    const record = ok => { const s = state.kana[k] || { c: 0, w: 0 }; ok ? s.c++ : s.w++; state.kana[k] = s; if (ok) { correct++; addXP(2); } else save(); };
    const next = () => { idx++; step(); };
    const mode = pick(['type', 'type', 'choice', 'listen']);
    const distract = () => shuffle(pool.filter(p => p[0] !== k && p[1] !== r)).slice(0, 3);
    const detail = `${k} = ${r}`;
    if (mode === 'type') {
      askType(stage, { label: '輸入羅馬拼音', prompt: `<div class="prompt-word">${k}</div>`, ime: false, placeholder: 'romaji',
        check: v => v.trim().toLowerCase() === r || (r === 'wo' && v.trim().toLowerCase() === 'o') || romajiToKana(v.trim().toLowerCase(), true) === toHiragana(k), detail, say: k }, record, next);
    } else if (mode === 'choice') {
      const opts = shuffle([[k, r], ...distract()]);
      askChoice(stage, { label: '選出對應的假名', prompt: `<div class="prompt-word" style="font-family:var(--ui)">${r}</div>`, options: opts.map(o => o[0]), answer: opts.findIndex(o => o[0] === k), jp: true, detail, say: k }, record, next);
    } else {
      const opts = shuffle([[k, r], ...distract()]);
      askChoice(stage, { label: '聽音選字', prompt: `${listenBtn(k)}`, options: opts.map(o => o[0]), answer: opts.findIndex(o => o[0] === k), jp: true, detail, autoSay: k }, record, next);
    }
  };
  step();
}

// =====================================================================
// 練習介面元件
// =====================================================================
function sessionShell(progress, hearts, exitHref) {
  document.body.classList.add('in-session');
  view.innerHTML = `
    <div class="session">
      <div class="session-top">
        <a class="icon-btn" href="${exitHref}" title="離開" aria-label="離開">${ico('x')}</a>
        <div class="bar"><i style="width:${Math.round(progress * 100)}%"></i></div>
      </div>
      <div id="stage" class="fade-in"></div>
    </div>`;
  return $('#stage');
}
let gentleRetry = false;
function feedback(stage, ok, detail, say, onContinue, extraHTML = '') {
  const f = document.createElement('div');
  f.className = 'feedback ' + (ok ? 'ok' : 'no');
  const head = ok ? pick(['✓ 正確！', '✓ 很好！', '✓ 答對了']) : '差一點點，正確答案是：';
  const note = !ok && gentleRetry ? '<div class="detail-txt">沒關係，這題等一下會再出現一次。</div>' : '';
  f.innerHTML = `<div>${head}${detail ? `<div class="detail-txt jp">${detail}</div>` : ''}${note}</div>
    <div class="row">${say ? audioBtn(say) : ''}<button class="btn ${ok ? 'primary' : ''}" id="cont">繼續<span class="kbd">Enter</span></button></div>`;
  stage.appendChild(f);
  if (extraHTML) f.insertAdjacentHTML('afterend', extraHTML);
  if (say && S().autoplay) speak(say);
  const go = () => { keyHandler = null; onContinue(); };
  $('#cont', f).onclick = go;
  $('#cont', f).focus({ preventScroll: true });
  keyHandler = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
}
function askChoice(stage, q, onResult, onContinue) {
  stage.innerHTML = `
    <div class="card prompt-card"><div class="prompt-label">${q.label}</div>${q.prompt}</div>
    <div class="choices ${q.cls || ''}">${q.options.map((o, i) => `<button class="choice ${q.jp ? 'jp' : ''}" data-i="${i}">${typeof o === 'object' ? o.html : esc(o)}<span class="kbd">${i + 1}</span></button>`).join('')}</div>`;
  if (q.autoSay) setTimeout(() => speak(q.autoSay), 150);
  let done = false;
  const choose = i => {
    if (done) return; done = true;
    const ok = i === q.answer;
    $$('.choice', stage).forEach((b, j) => { b.disabled = true; if (j === q.answer) b.classList.add('correct'); else if (j === i) b.classList.add('wrong'); });
    onResult(ok);
    feedback(stage, ok, q.detail, q.say || q.autoSay, onContinue);
  };
  $$('.choice', stage).forEach(b => b.onclick = () => choose(+b.dataset.i));
  keyHandler = e => { const n = +e.key; if (n >= 1 && n <= q.options.length) choose(n - 1); };
}
function askType(stage, q, onResult, onContinue) {
  stage.innerHTML = `
    <div class="card prompt-card"><div class="prompt-label">${q.label}</div>${q.prompt}</div>
    <input class="answer-input" type="text" id="ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${q.placeholder || '輸入羅馬拼音會自動轉成假名'}">
    <button class="btn primary block" id="check" style="margin-top:10px">檢查<span class="kbd">Enter</span></button>`;
  const inp = $('#ans', stage);
  if (q.ime) bindIME(inp);
  setTimeout(() => inp.focus(), 50);
  let done = false;
  const check = () => {
    if (done) return;
    if (!inp.value.trim()) { inp.classList.add('wrong'); setTimeout(() => inp.classList.remove('wrong'), 300); return; }
    done = true;
    if (q.ime) inp.value = romajiToKana(inp.value, true);
    const ok = q.check(inp.value);
    inp.classList.add(ok ? 'correct' : 'wrong'); inp.readOnly = true;
    $('#check', stage).remove();
    onResult(ok);
    feedback(stage, ok, q.detail, q.say, onContinue);
  };
  $('#check', stage).onclick = check;
  keyHandler = e => { if (e.key === 'Enter') { e.preventDefault(); check(); } };
}
function askTiles(stage, q, onResult, onContinue) {
  const tiles = shuffle(q.tiles.map((t, i) => ({ t, i })));
  if (q.autoSay) setTimeout(() => speak(q.autoSay), 150);
  let answer = [];
  stage.innerHTML = `
    <div class="card prompt-card"><div class="prompt-label">${q.label}</div>${q.prompt || `<div class="prompt-meaning">${esc(q.zh)}</div>`}</div>
    <div class="tiles answer" id="ansT"></div>
    <div class="tiles" id="bank">${tiles.map((x, j) => `<button class="tile ${q.zhTiles ? 'zh' : ''}" data-j="${j}">${esc(x.t)}</button>`).join('')}</div>
    <button class="btn primary block" id="check">檢查<span class="kbd">Enter</span></button>`;
  const ansEl = $('#ansT', stage);
  const draw = () => {
    ansEl.innerHTML = answer.map((j, p) => `<button class="tile ${q.zhTiles ? 'zh' : ''}" data-p="${p}">${esc(tiles[j].t)}</button>`).join('');
    $$('#bank .tile', stage).forEach(b => b.classList.toggle('used', answer.includes(+b.dataset.j)));
    $$('.tile', ansEl).forEach(b => b.onclick = () => { if (!done) { answer.splice(+b.dataset.p, 1); draw(); } });
  };
  $$('#bank .tile', stage).forEach(b => b.onclick = () => { if (!done && !answer.includes(+b.dataset.j)) { answer.push(+b.dataset.j); if (!q.zhTiles) speak(tiles[+b.dataset.j].t); draw(); } });
  let done = false;
  const check = () => {
    if (done || !answer.length) return;
    done = true;
    const ok = answer.map(j => tiles[j].t).join('') === q.correct.join('');
    $('#check', stage).remove();
    onResult(ok);
    feedback(stage, ok, q.detail ?? esc(q.correct.join('')), q.say ?? q.correct.join(''), onContinue);
  };
  $('#check', stage).onclick = check;
  keyHandler = e => { if (e.key === 'Enter') { e.preventDefault(); check(); } };
}
function showResult({ title, correct, total, xp, again, back }) {
  keyHandler = null;
  const acc = total ? Math.round(correct / total * 100) : 0;
  view.innerHTML = `
    <div class="session"><div class="card result fade-in">
      ${mascot(110, 'happy')}
      <h1>${title}</h1>
      <div class="grid grid-4" style="margin:24px 0">
        <div class="stat"><span class="big">${acc}%</span><span class="lbl">正確率</span></div>
        <div class="stat"><span class="big">+${xp}</span><span class="lbl">XP</span></div>
        <div class="stat"><span class="big">${totalDays()}</span><span class="lbl">累積學習天數</span></div>
      </div>
      <div class="row" style="justify-content:center">
        ${again ? `<button class="btn" id="again">再來一次</button>` : ''}
        <a class="btn primary" href="${back || '#/home'}">完成</a>
      </div>
    </div></div>`;
  if (again) $('#again').onclick = () => { location.hash === again ? route() : location.hash = again; };
  keyHandler = e => { if (e.key === 'Enter') location.hash = back || '#/home'; };
}

// =====================================================================
// 每日學習（SRS）：新卡先上課，再測驗；複習卡隨機題型
// =====================================================================
function distractVocab(v, field, n = 3) {
  const same = shuffle(VOCAB.filter(x => x.id !== v.id && x.cat === v.cat && x[field] !== v[field]));
  const other = shuffle(VOCAB.filter(x => x.id !== v.id && x.cat !== v.cat && x[field] !== v[field]));
  const out = [];
  for (const x of [...same, ...other]) { if (!out.some(o => o[field] === x[field])) out.push(x); if (out.length >= n) break; }
  return out;
}
function viewStudy(q) {
  // 預設只複習到期的項目；從單字庫學新字要主動選（?new=1）
  const due = shuffle(dueIds()).slice(0, 50);
  const newLimit = q.get('new') ? S().newPerDay : 0;
  const fresh = VOCAB.filter(v => !state.srs[v.id]).slice(0, newLimit).map(v => v.id);
  if (!due.length && !fresh.length) {
    view.innerHTML = `<div class="session"><div class="card result">${mascot(110)}<h1>現在沒有要複習的東西</h1><p class="muted">學過的單字會在快忘記的時候回來找你。<br>去學一課新的，或者單純休息也很好。</p><a class="btn primary" href="#/home">回課程</a></div></div>`;
    return;
  }
  // 新卡分散插入複習中
  const queue = due.map(id => ({ id, isNew: false, stage: 'q' }));
  fresh.forEach((id, i) => queue.splice(Math.min(queue.length, i * 3), 0, { id, isNew: true, stage: 'lesson' }));
  const total = queue.length;
  const graded = new Set();
  let correct = 0, xp = 0;

  const step = () => {
    if (!queue.length) return showResult({ title: '今日學習完成！', correct, total, xp, back: '#/home' });
    const cur = queue[0];
    const item = ITEMS[cur.id];
    const stage = sessionShell(graded.size / total, null, '#/home');
    const next = () => { queue.shift(); step(); };
    const result = (ok, grade) => {
      if (!graded.has(cur.id)) {
        graded.add(cur.id);
        schedule(cur.id, grade ?? (ok ? 2 : 0));
        if (ok) { correct++; xp += 10; addXP(10); } else addXP(1);
      }
      if (!ok) queue.push({ id: cur.id, isNew: false, stage: 'q', retry: true });
    };
    if (cur.stage === 'lesson') return item.kind === 'v' ? lessonVocab(stage, item, () => { cur.stage = 'q'; step(); }) : lessonGrammar(stage, item, () => { cur.stage = 'q'; step(); });
    if (item.kind === 'g') return askCloze(stage, item, result, next);
    askVocab(stage, item, cur.isNew || cur.retry, result, next);
  };
  step();
}
function lessonVocab(stage, v, onDone) {
  stage.innerHTML = `
    <div class="card prompt-card">
      <span class="tag new">新單字 · ${esc(v.cat)}</span>
      <div class="prompt-word" style="margin-top:14px">${ruby(v.word, v.reading, true)}</div>
      ${v.word !== v.reading ? `<div class="prompt-reading">${esc(v.reading)}</div>` : ''}
      <div class="prompt-meaning" style="margin-top:8px">${esc(v.meaning)}</div>
      <div style="margin-top:16px">${audioBtn(v.reading)}</div>
    </div>
    <button class="btn primary big block" id="ok" style="margin-top:16px">記住了，測驗我<span class="kbd">Enter</span></button>`;
  if (S().autoplay) speak(v.reading);
  $('#ok').onclick = onDone;
  keyHandler = e => { if (e.key === 'Enter') onDone(); };
}
function vocabDetail(v) { return `${v.word !== v.reading ? esc(v.word) + '（' + esc(v.reading) + '）' : esc(v.word)}　${esc(v.meaning)}`; }
function askVocab(stage, v, easy, result, next) {
  const types = easy ? ['meaning'] : ['meaning', 'listen', 'recall', 'recall', 'flip'];
  const t = pick(types);
  const lvl = level(v.id);
  const tag = `<span class="lvl ${lvl.cls}">${lvl.name}</span>`;
  if (t === 'meaning') {
    const opts = shuffle([v, ...distractVocab(v, 'meaning')]);
    askChoice(stage, { label: `${tag} 選出意思`, prompt: `<div class="prompt-word">${ruby(v.word, v.reading)}</div>`, options: opts.map(o => o.meaning), answer: opts.indexOf(v), detail: vocabDetail(v), say: v.reading }, ok => result(ok), next);
  } else if (t === 'listen') {
    const opts = shuffle([v, ...distractVocab(v, 'word')]);
    askChoice(stage, { label: `${tag} 聽力：選出聽到的單字`, prompt: `${listenBtn(v.reading)}`, options: opts.map(o => o.word), answer: opts.indexOf(v), jp: true, detail: vocabDetail(v), autoSay: v.reading }, ok => result(ok), next);
  } else if (t === 'recall') {
    askType(stage, { label: `${tag} 用日文怎麼說？（輸入讀音）`, prompt: `<div class="prompt-meaning" style="font-size:30px">${esc(v.meaning)}</div><div class="small muted" style="margin-top:6px">${esc(v.cat)}</div>`, ime: true,
      check: val => normKana(val) === normKana(v.reading) || val.trim() === v.word, detail: vocabDetail(v), say: v.reading }, ok => result(ok), next);
  } else {
    // Anki 翻卡 + 自評
    stage.innerHTML = `
      <div class="card prompt-card"><div class="prompt-label">${tag} 回想意思與讀音</div>
        <div class="prompt-word">${esc(v.word)}</div><div id="back" style="display:none">
          <div class="prompt-reading">${esc(v.reading)}</div><div class="prompt-meaning">${esc(v.meaning)}</div><div style="margin-top:10px">${audioBtn(v.reading)}</div></div></div>
      <button class="btn primary big block" id="flip" style="margin-top:16px">顯示答案<span class="kbd">Space</span></button>
      <div class="grades" id="grades" style="display:none">
        ${['重來', '困難', '良好', '簡單'].map((l, g) => `<button class="btn ${['g-again', 'g-hard', 'g-good', 'g-easy'][g]}" data-g="${g}">${l}<small>${ivlLabel(state.srs[v.id], g)}</small></button>`).join('')}
      </div>`;
    let flipped = false;
    const flip = () => { if (flipped) return; flipped = true; $('#back').style.display = ''; $('#flip').remove(); $('#grades').style.display = ''; if (S().autoplay) speak(v.reading); };
    const grade = g => { if (!flipped) return; result(g > 0, g); next(); };
    $('#flip').onclick = flip;
    $$('#grades .btn').forEach(b => b.onclick = () => grade(+b.dataset.g));
    keyHandler = e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flipped ? grade(2) : flip(); } else if (flipped && +e.key >= 1 && +e.key <= 4) grade(+e.key - 1); };
  }
}
function lessonGrammar(stage, g, onDone) {
  stage.innerHTML = `<div class="card"><span class="tag new">新文法</span>${grammarBody(g)}</div>
    <button class="btn primary big block" id="ok" style="margin-top:16px">了解，測驗我<span class="kbd">Enter</span></button>`;
  $('#ok').onclick = onDone;
  keyHandler = e => { if (e.key === 'Enter') onDone(); };
}
function askCloze(stage, g, result, next) {
  const [sent, ans, opts] = g.cloze;
  const o = shuffle(opts);
  askChoice(stage, { label: `文法填空 · ${esc(g.title)}`, prompt: `<div class="prompt-word" style="font-size:clamp(24px,5vw,34px)">${esc(sent).replace('＿', '<span style="color:var(--accent)">＿＿</span>')}</div>`,
    options: o, answer: o.indexOf(ans), jp: true, detail: esc(sent.replace('＿', ans)), say: sent.replace(/（.*?）/, '').replace('＿', ans) }, ok => result(ok), next);
}

// =====================================================================
// 單字列表
// =====================================================================
function viewVocab() {
  const cats = [...new Set(VOCAB.map(v => v.cat))];
  let cat = '全部', query = '';
  view.innerHTML = `
    <div class="row between"><div><h1>N5 單字</h1><p class="sub">${VOCAB.length} 個單字 · 點擊任一列可聽發音。課程以外想多學，可以從這裡一次學 ${S().newPerDay} 個。</p></div><a class="btn primary" href="#/study?new=1">學 ${S().newPerDay} 個新單字</a></div>
    <input class="answer-input" id="search" placeholder="搜尋：漢字、假名、中文或羅馬拼音" style="font-size:16px;text-align:left;margin:0 0 12px">
    <div class="row" id="cats">${['全部', ...cats].map(c => `<button class="chip ${c === '全部' ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div>
    <div class="card" style="margin-top:14px;padding:6px 16px;overflow-x:auto"><table class="vocab-table"><thead><tr><th>單字</th><th>讀音</th><th>中文</th><th>等級</th></tr></thead><tbody id="vt"></tbody></table></div>`;
  const draw = () => {
    const qk = query ? toHiragana(romajiToKana(query, true)) : '';
    const list = VOCAB.filter(v => (cat === '全部' || v.cat === cat) && (!query || v.word.includes(query) || v.meaning.includes(query) || toHiragana(v.reading).includes(qk)));
    $('#vt').innerHTML = list.map(v => { const l = level(v.id); return `<tr data-say="${esc(v.reading)}" style="cursor:pointer"><td class="w">${esc(v.word)}</td><td class="jp muted">${esc(v.reading)}</td><td>${esc(v.meaning)}</td><td><span class="lvl ${l.cls}">${l.name}</span></td></tr>`; }).join('') || '<tr><td colspan="4" class="muted">找不到符合的單字</td></tr>';
  };
  $('#search').oninput = e => { query = e.target.value.trim(); draw(); };
  $$('#cats .chip').forEach(b => b.onclick = () => { cat = b.dataset.c; $$('#cats .chip').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
}

// =====================================================================
// 文法
// =====================================================================
function grammarBody(g) {
  return `<h2 class="jp" style="margin-top:10px">${esc(g.title)}</h2>
    <div class="struct">${esc(g.struct)}</div>
    <p>${esc(g.expl)}</p>
    ${g.ex.map(([ja, kana, zh]) => `<div class="example row between"><div><div class="ja">${esc(ja)}</div><div class="kana">${esc(kana)}</div><div>${esc(zh)}</div></div>${audioBtn(kana)}</div>`).join('')}`;
}
function viewGrammar(q) {
  const id = q.get('id');
  if (id && ITEMS[id]) {
    const g = ITEMS[id];
    const learned = !!state.srs[id];
    const i = GRAMMAR.findIndex(x => x.id === id);
    view.innerHTML = `
      <a href="#/grammar" class="muted" style="text-decoration:none">← 文法列表</a>
      <div class="card" style="margin-top:12px">${grammarBody(g)}</div>
      <div class="row" style="margin-top:16px">
        ${learned ? `<span class="lvl ${level(id).cls}">已加入複習 · ${level(id).name}</span>` : `<button class="btn primary" id="learn">✓ 學會了，加入每日複習</button>`}
        <button class="btn" id="try">試做一題</button>
        ${GRAMMAR[i + 1] ? `<a class="btn" href="#/grammar?id=${GRAMMAR[i + 1].id}">下一個 →</a>` : ''}
      </div>
      <div id="tryBox" style="margin-top:16px"></div>`;
    if (!learned) $('#learn').onclick = () => { schedule(id, 2); addXP(5); toast('已加入每日複習 +5 XP'); viewGrammar(q); };
    $('#try').onclick = () => { const box = $('#tryBox'); askCloze(box, g, ok => ok && addXP(2), () => { box.innerHTML = ''; keyHandler = null; }); };
    return;
  }
  view.innerHTML = `<h1>N5 文法</h1><p class="sub">閱讀說明與例句後按「學會了」，它就會出現在每日複習的填空題中。</p>
    <div class="grid">${GRAMMAR.map((g, i) => { const l = level(g.id); return `
      <a class="card grammar-item" href="#/grammar?id=${g.id}" style="text-decoration:none;color:inherit;padding:14px 18px">
        <span class="muted small" style="width:24px">${i + 1}</span>
        <span style="flex:1"><span class="gt">${esc(g.title)}</span><br><span class="small muted">${esc(g.expl.split('，')[0].split('。')[0])}</span></span>
        <span class="lvl ${l.cls}">${l.name}</span></a>`; }).join('')}</div>`;
}

// =====================================================================
// 自由練習：混合題型，沒有愛心、沒有懲罰，答錯只是再練一次
// =====================================================================
function viewChallenge() {
  const learned = Object.keys(state.srs).map(id => ITEMS[id]).filter(x => x && x.kind === 'v');
  const pool = learned.length >= 8 ? learned : VOCAB.slice(0, 60);
  const gPool = GRAMMAR.filter(g => state.srs[g.id]);
  const builders = [
    () => { const v = pick(pool); const o = shuffle([v, ...distractVocab(v, 'meaning')]); return (st, r, n) => askChoice(st, { label: '選出意思', prompt: `<div class="prompt-word">${ruby(v.word, v.reading)}</div>`, options: o.map(x => x.meaning), answer: o.indexOf(v), detail: vocabDetail(v), say: v.reading }, r, n); },
    () => { const v = pick(pool); const o = shuffle([v, ...distractVocab(v, 'word')]); return (st, r, n) => askChoice(st, { label: '聽力', prompt: `${listenBtn(v.reading)}`, options: o.map(x => x.word), answer: o.indexOf(v), jp: true, detail: vocabDetail(v), autoSay: v.reading }, r, n); },
    () => { const v = pick(pool); return (st, r, n) => askType(st, { label: '翻譯成日文', prompt: `<div class="prompt-meaning" style="font-size:30px">${esc(v.meaning)}</div>`, ime: true, check: x => normKana(x) === normKana(v.reading) || x.trim() === v.word, detail: vocabDetail(v), say: v.reading }, r, n); },
    () => { const [tokens, zh] = pick(SENTENCES); const extra = pick(SENTENCES.filter(s => s[1] !== zh))[0]; const d = extra.find(t => !tokens.includes(t)); return (st, r, n) => askTiles(st, { label: '排出正確的句子', zh, tiles: d ? [...tokens, d] : tokens, correct: tokens }, r, n); },
    () => { const g = pick(gPool.length ? gPool : GRAMMAR.slice(0, 8)); return (st, r, n) => askCloze(st, g, r, n); },
  ];
  const qs = Array.from({ length: 10 }, (_, i) => builders[i % builders.length]()).sort(() => Math.random() - .5);
  let idx = 0, correct = 0, xp = 0, combo = 0;
  const step = () => {
    if (idx >= qs.length) return showResult({ title: '練習完成！', correct, total: qs.length, xp, again: '#/challenge', back: '#/home' });
    const stage = sessionShell(idx / qs.length, null, '#/home');
    if (combo >= 3) stage.insertAdjacentHTML('beforebegin', `<div class="tag" style="margin-bottom:10px">連續答對 ${combo} 題</div>`);
    qs[idx](stage, ok => {
      if (ok) { combo++; const g = 5 + Math.min(combo, 5); correct++; xp += g; addXP(g); }
      else { combo = 0; addXP(1); xp += 1; }
    }, () => { idx++; step(); });
  };
  step();
}

// ===== 分頁列：可拖曳的玻璃膠囊（互動同 Stock Tracker）=====
// 按住整條列 → 膠囊變透鏡、可左右拖，最靠近的分頁亮起；放開時膠囊滑到該分頁並切換。
const TAB_ALIAS = { study: 'home', lesson: 'home', guide: 'home', kanaquiz: 'kana' };
function tabRoute(r) { return TAB_ALIAS[r] || r; }
function setupTabbar() {
  const bar = $('#nav'); if (!bar) return;
  const tabs = $$('a.tab', bar);
  const cap = document.createElement('span'); cap.className = 'tabcap'; bar.prepend(cap);
  const curIdx = () => {
    const r = location.hash.replace(/^#\//, '').split('?')[0];
    return Math.max(0, tabs.findIndex(t => t.dataset.r === tabRoute(routes[r] ? r : 'home')));
  };
  let rest = null, over = 0, dragging = false, settling = false, timer = 0;
  const measure = () => {
    if (bar.classList.contains('press') || !bar.offsetWidth) return;
    const br = bar.getBoundingClientRect();
    rest = tabs.map(t => { const r = t.getBoundingClientRect(); return { w: r.width, h: r.height, t: r.top - br.top, l: r.left - br.left }; });
  };
  const setCap = (w, h, t, l) => Object.assign(cap.style, { width: w + 'px', height: h + 'px', top: t + 'px', left: l + 'px' });
  const place = (i, anim) => {
    if (!rest) measure();
    const g = rest && rest[i]; if (!g) return;
    cap.classList.toggle('drag', !anim);
    const w = g.w + 16; setCap(w, g.h + 8, g.t - 4, g.l + g.w / 2 - w / 2);
  };
  const lens = () => { const g = rest[0]; return { w: g.w + 38, h: g.h + 29, t: g.t - 13 }; };
  const nearest = x => { let best = 0, bd = 1e9; tabs.forEach((t, k) => { const r = t.getBoundingClientRect(), d = Math.abs(x - (r.left + r.width / 2)); if (d < bd) { bd = d; best = k; } }); return best; };
  const hl = i => tabs.forEach((t, k) => t.classList.toggle('hl', k === i));
  const grow = i => {
    const br = bar.getBoundingClientRect(), r = tabs[i].getBoundingClientRect(), z = lens();
    const L = r.left + r.width / 2 - br.left - z.w / 2; setCap(z.w, z.h, z.t, L); return L;
  };
  const follow = x => {
    const br = bar.getBoundingClientRect(), z = lens();
    const r1 = tabs[0].getBoundingClientRect(), rN = tabs[tabs.length - 1].getBoundingClientRect();
    const cx = Math.max(r1.left + r1.width / 2 - br.left, Math.min(rN.left + rN.width / 2 - br.left, x - br.left));
    cap.classList.add('drag'); setCap(z.w, z.h, z.t, cx - z.w / 2);
    const o = nearest(x); if (o !== over) { over = o; hl(o); }
  };
  const down = e => {
    if (e.button) return;
    if (!rest) measure();
    if (!rest) return;
    dragging = true; over = nearest(e.clientX);
    cap.classList.add('grab'); cap.classList.remove('drag'); bar.classList.add('press');
    grow(over); hl(over);
    try { bar.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    const t = over; hl(t); cap.classList.remove('drag');
    const before = cap.offsetLeft, L = grow(t);
    settling = true; clearTimeout(timer);
    timer = setTimeout(() => { settling = false; cap.classList.remove('grab'); bar.classList.remove('press'); place(t, true); }, Math.abs(L - before) > 2 ? 175 : 100);
    const href = tabs[t].getAttribute('href');
    if (location.hash !== href) setTimeout(() => { location.hash = href; }, 60);
  };
  bar.addEventListener('pointerdown', down);
  bar.addEventListener('pointermove', e => { if (!dragging) return; follow(e.clientX); if (e.cancelable) e.preventDefault(); });
  bar.addEventListener('pointerup', up);
  bar.addEventListener('pointercancel', up);
  // 導覽由放開手指決定；鍵盤（Enter）觸發的 click 照常切換
  tabs.forEach(t => t.addEventListener('click', e => { e.preventDefault(); if (e.detail === 0) location.hash = t.getAttribute('href'); }));
  addEventListener('resize', () => { rest = null; measure(); place(curIdx(), false); hl(curIdx()); });
  window.__tabSync = anim => {
    if (settling) return;
    if (!rest || !rest[0].w) { rest = null; measure(); }
    const i = curIdx(); place(i, anim !== false); hl(i);
  };
  requestAnimationFrame(() => { measure(); place(curIdx(), false); hl(curIdx()); });
}

// ===== 啟動 =====
applyTheme();
renderMini();
setupTabbar();
route();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
