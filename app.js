/* ==========================================================
   Écoute — тренування французької через відео з YouTube.
   Один файл без фреймворків і без бекенду.

   Зміст:
     1. Налаштування (теми, інтервали повторення)
     2. Утиліти
     3. Сховище (localStorage)
     4. Бібліотека відео (videos.json + додані вручну)
     5. Навігація між екранами
     6. Екран «Бібліотека»
     7. Екран «Заняття» (плеєр, вправи)
     8. Екран «Словник» і «Картки»
     9. Екран «Прогрес» (статистика, тема, експорт/імпорт)
    10. Екран «Додати відео»
    11. Запуск
   ========================================================== */
'use strict';

/* ---------- 1. Налаштування ---------- */

// Теми відео. Ключ (money, business…) використовується у videos.json у полі "topic".
const TOPICS = {
  money:      { label: 'Гроші та інвестиції', icon: '💰' },
  business:   { label: 'Бізнес',              icon: '💼' },
  science:    { label: 'Наука',               icon: '🔬' },
  tech:       { label: 'Технології',          icon: '💻' },
  history:    { label: 'Історія',             icon: '🏛️' },
  psychology: { label: 'Психологія',          icon: '🧠' },
  sport:      { label: 'Спорт',               icon: '⚽' },
  food:       { label: 'Їжа і Франція зсередини', icon: '🥖' },
  travel:     { label: 'Подорожі',            icon: '🧳' },
  other:      { label: 'Інше',                icon: '📺' },
};

const LEVELS = ['B1', 'B2', 'C1'];
const STORE_KEY = 'ecoute-v1';
// Через скільки днів показати картку знову (індекс = «коробка» 1…5, система Лейтнера)
const SRS_DAYS = [0, 1, 2, 4, 8, 16];
const SNIPPET_SEC = 8; // довжина фрагмента для shadowing

/* ---------- 2. Утиліти ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const app = $('#app');

// Екранування тексту для безпечної вставки в HTML
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Дата у форматі РРРР-ММ-ДД за місцевим часом
function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function addDays(str, n) {
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  return todayStr(date);
}
// 569 → "9:29"
function fmtDur(sec) {
  if (!sec) return '';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const plural = (n, one, few, many) => {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
};
const thumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// Озвучення французького слова вбудованим синтезатором мовлення браузера (безкоштовно)
function say(text) {
  if (!('speechSynthesis' in window)) { toast('Браузер не вміє озвучувати текст'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  const voice = speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('fr'));
  if (voice) u.voice = voice;
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

/* ---------- 3. Сховище ---------- */

// Структура всіх даних користувача (зберігається в localStorage)
function defaultState() {
  return {
    version: 1,
    customVideos: [],  // відео, додані через форму «Додати»
    words: [],         // словник: {id, fr, uk, src, srcTitle, added, box, due}
    lessons: {},       // прогрес по відео: {seconds, watched, done, summary, understood, quiz}
    days: {},          // активність по днях: {"2026-10-20": {sec, done, cards}}
    settings: { theme: 'auto', rate: 1 },
    daily: null,       // «відео на сьогодні»: {date, id}
    ui: { topic: 'all', level: 'all', dur: 'all', status: 'all', q: '' },
  };
}

function normalizeState(s) {
  const d = defaultState();
  if (!s || typeof s !== 'object') return d;
  return {
    ...d, ...s,
    settings: { ...d.settings, ...(s.settings || {}) },
    ui: { ...d.ui, ...(s.ui || {}) },
    customVideos: Array.isArray(s.customVideos) ? s.customVideos : [],
    words: Array.isArray(s.words) ? s.words : [],
    lessons: s.lessons && typeof s.lessons === 'object' ? s.lessons : {},
    days: s.days && typeof s.days === 'object' ? s.days : {},
  };
}

function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STORE_KEY))); }
  catch { return defaultState(); }
}

let state = loadState();
let saveTimer = null;

// Збереження з невеликою затримкою, щоб не писати на кожен символ
function save(immediately = false) {
  clearTimeout(saveTimer);
  const write = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch { toast('Не вдалося зберегти дані (пам\'ять браузера заповнена?)'); }
  };
  if (immediately) write(); else saveTimer = setTimeout(write, 400);
}
window.addEventListener('pagehide', () => save(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });

const lessonOf = (id) => (state.lessons[id] ||= { seconds: 0, quiz: {} });
const dayOf = (date = todayStr()) => (state.days[date] ||= { sec: 0, done: 0, cards: 0 });

/* ---------- 4. Бібліотека відео ---------- */

let BASE_VIDEOS = [];   // з файлу videos.json
let videosError = '';

async function loadVideos() {
  try {
    const res = await fetch('videos.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.videos;
    BASE_VIDEOS = (list || []).filter((v) => v && typeof v.id === 'string' && v.id.length === 11 && v.title)
      .map((v) => ({ ...v, topic: TOPICS[v.topic] ? v.topic : 'other' }));
    videosError = '';
  } catch (e) {
    videosError = 'Не вдалося завантажити videos.json. Відкрийте застосунок через локальний сервер або GitHub Pages (див. README).';
  }
}

function allVideos() {
  const ids = new Set(BASE_VIDEOS.map((v) => v.id));
  return [...BASE_VIDEOS, ...state.customVideos.filter((v) => !ids.has(v.id))];
}
const getVideo = (id) => allVideos().find((v) => v.id === id);
const isWatched = (id) => { const L = state.lessons[id]; return !!(L && (L.watched || L.done)); };

// Витягує ID з будь-якого посилання YouTube (watch, youtu.be, shorts, embed, live)
function parseYouTubeId(input) {
  const s = String(input || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s.startsWith('http') ? s : 'https://' + s);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1, 12);
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (u.searchParams.get('v')) return u.searchParams.get('v').slice(0, 11);
      const m = u.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch { /* не посилання */ }
  return null;
}

/* ---------- 5. Навігація між екранами ---------- */
// Адреси: #/  #/v/ID  #/words  #/review  #/progress  #/add

function render() {
  cleanupLesson();
  const [, page, arg] = location.hash.replace(/^#/, '').split('/');
  let tab = 'library';
  if (page === 'v' && arg) { viewLesson(arg); tab = ''; }
  else if (page === 'words') { viewWords(); tab = 'words'; }
  else if (page === 'review') { session = null; viewReview(); tab = 'words'; }
  else if (page === 'progress') { viewProgress(); tab = 'progress'; }
  else if (page === 'add') { viewAdd(); tab = 'add'; }
  else viewLibrary();
  $$('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);

// Усі кнопки на екранах мають атрибут data-act="назва дії". Тут — одна спільна обробка.
const actions = {};
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) { e.preventDefault(); actions[el.dataset.act](el, e); }
});
const inputs = {};
app.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el && inputs[el.dataset.input]) inputs[el.dataset.input](el, e);
});

/* ---------- 6. Екран «Бібліотека» ---------- */

const DUR_FILTERS = {
  all:   { label: 'Будь-яка', test: () => true },
  short: { label: 'до 6 хв', test: (s) => s > 0 && s <= 360 },
  mid:   { label: '6–10 хв', test: (s) => s > 360 && s <= 600 },
  long:  { label: '10+ хв',  test: (s) => s > 600 },
};
const STATUS_FILTERS = { all: 'Усі', new: 'Нові', done: 'Переглянуті' };

function matchesFilters(v, ui) {
  if (ui.topic !== 'all' && v.topic !== ui.topic) return false;
  if (ui.level !== 'all' && v.level !== ui.level) return false;
  if (!DUR_FILTERS[ui.dur].test(v.duration || 0)) return false;
  if (ui.status === 'new' && isWatched(v.id)) return false;
  if (ui.status === 'done' && !isWatched(v.id)) return false;
  const q = ui.q.trim().toLowerCase();
  if (q && !(`${v.title} ${v.channel || ''}`.toLowerCase().includes(q))) return false;
  return true;
}

// Випадкове відео на сьогодні: однакове весь день, поки не натиснеш «Інше»
function pickRandom(exclude) {
  const vids = allVideos();
  let pool = vids.filter((v) => !isWatched(v.id) && v.id !== exclude);
  if (!pool.length) pool = vids.filter((v) => v.id !== exclude);
  if (!pool.length) pool = vids;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;
}
function dailyVideo() {
  const t = todayStr();
  if (!state.daily || state.daily.date !== t || !getVideo(state.daily.id)) {
    const id = pickRandom(state.daily && state.daily.id);
    if (!id) return null;
    state.daily = { date: t, id };
    save();
  }
  return getVideo(state.daily.id);
}

function metaTags(v) {
  const t = TOPICS[v.topic] || TOPICS.other;
  const L = state.lessons[v.id];
  return `
    <span class="tag">${t.icon} ${esc(t.label)}</span>
    ${v.level ? `<span class="tag lvl">${esc(v.level)}</span>` : ''}
    ${L && L.done && L.understood != null ? `<span class="tag good">зрозумів ${L.understood}%</span>` : ''}`;
}

function videoCard(v) {
  return `
    <a class="vitem" href="#/v/${esc(v.id)}">
      <div class="thumb">
        <img src="${thumb(v.id)}" alt="" loading="lazy" width="320" height="180">
        ${v.duration ? `<span class="dur">${fmtDur(v.duration)}</span>` : ''}
        ${isWatched(v.id) ? '<span class="done" aria-label="переглянуто">✓</span>' : ''}
      </div>
      <div class="grow">
        <div class="vtitle">${esc(v.title)}</div>
        <div class="small muted">${esc(v.channel || '')}</div>
        <div class="meta">${metaTags(v)}</div>
      </div>
    </a>`;
}

function segHtml(group, options, current) {
  return `<div class="seg" role="group">${Object.entries(options).map(([k, label]) =>
    `<button type="button" data-act="filter" data-group="${group}" data-val="${k}" class="${current === k ? 'on' : ''}">${esc(label)}</button>`).join('')}</div>`;
}

function viewLibrary() {
  document.title = 'Écoute — французька на слух';
  if (videosError) {
    app.innerHTML = `<div class="card"><h2>Ой</h2><p class="muted" style="margin-top:8px">${esc(videosError)}</p></div>`;
    return;
  }
  const ui = state.ui;
  const vids = allVideos();
  const daily = dailyVideo();
  const counts = {};
  vids.forEach((v) => { counts[v.topic] = (counts[v.topic] || 0) + 1; });
  const levels = { all: 'Усі рівні' };
  LEVELS.filter((l) => vids.some((v) => v.level === l)).forEach((l) => { levels[l] = l; });

  app.innerHTML = `
    ${daily ? `
    <section class="card hero">
      <div class="small muted">🎲 Відео на сьогодні</div>
      <a class="today" href="#/v/${esc(daily.id)}">
        <img src="${thumb(daily.id)}" alt="">
        <div class="grow">
          <div class="vtitle">${esc(daily.title)}</div>
          <div class="small muted">${esc((TOPICS[daily.topic] || TOPICS.other).label)}${daily.level ? ' · ' + esc(daily.level) : ''}${daily.duration ? ' · ' + fmtDur(daily.duration) : ''}</div>
        </div>
      </a>
      <div class="row">
        <a class="btn grow" href="#/v/${esc(daily.id)}">▶ Почати заняття</a>
        <button class="btn ghost" type="button" data-act="reroll">🎲 Інше</button>
      </div>
    </section>` : ''}

    <section class="filters">
      <input class="input" type="search" placeholder="Пошук за назвою або каналом" data-input="search" value="${esc(ui.q)}" aria-label="Пошук">
      <div class="chips" style="margin-top:10px">
        <button type="button" class="chip ${ui.topic === 'all' ? 'on' : ''}" data-act="filter" data-group="topic" data-val="all">Усі теми · ${vids.length}</button>
        ${Object.entries(TOPICS).filter(([k]) => counts[k]).map(([k, t]) =>
          `<button type="button" class="chip ${ui.topic === k ? 'on' : ''}" data-act="filter" data-group="topic" data-val="${k}">${t.icon} ${esc(t.label)} · ${counts[k]}</button>`).join('')}
      </div>
      <div class="filter-row">
        ${segHtml('level', levels, ui.level)}
        ${segHtml('dur', Object.fromEntries(Object.entries(DUR_FILTERS).map(([k, f]) => [k, f.label])), ui.dur)}
        ${segHtml('status', STATUS_FILTERS, ui.status)}
      </div>
    </section>

    <p class="small muted" id="found" style="margin-top:14px"></p>
    <div class="vlist" id="vlist"></div>`;
  renderVideoList();
}

// Перемальовує лише список (щоб пошук не губив фокус)
function renderVideoList() {
  const list = allVideos().filter((v) => matchesFilters(v, state.ui));
  $('#found').textContent = `Знайдено: ${list.length}`;
  $('#vlist').innerHTML = list.length ? list.map(videoCard).join('')
    : '<div class="card center muted">Нічого не знайдено. Спробуй змінити фільтри.</div>';
}

actions.filter = (el) => {
  state.ui[el.dataset.group] = el.dataset.val;
  save();
  const y = window.scrollY;
  viewLibrary();
  window.scrollTo(0, y);
};
inputs.search = (el) => { state.ui.q = el.value; save(); renderVideoList(); };
actions.reroll = () => {
  state.daily = { date: todayStr(), id: pickRandom(state.daily && state.daily.id) };
  save();
  viewLibrary();
};

/* ---------- 7. Екран «Заняття» ---------- */

let current = null;      // {v, L} — відкрите відео і його прогрес
let player = null;       // YouTube-плеєр
let tickTimer = null;    // лічильник хвилин слухання
let snippetTimer = null; // таймер фрагмента для shadowing
let ticks = 0;

const STARTERS = ['Dans cette vidéo, on parle de…', 'L\'idée principale, c\'est que…', 'J\'ai appris que…', 'Ce qui m\'a surpris, c\'est que…', 'Je pense que…'];

function hasWord(fr) {
  const f = fr.trim().toLowerCase();
  return state.words.some((w) => w.fr.trim().toLowerCase() === f);
}

function viewLesson(id) {
  const v = getVideo(id);
  if (!v) {
    app.innerHTML = `<a class="back" href="#/">← Бібліотека</a>
      <div class="card"><h2>Відео не знайдено</h2><p class="muted" style="margin-top:8px">Можливо, його видалили з бібліотеки.</p></div>`;
    return;
  }
  const L = lessonOf(id);
  L.openedAt = Date.now();
  save();
  current = { v, L };
  document.title = v.title + ' — Écoute';
  const rate = state.settings.rate || 1;
  const kws = v.keywords || [];
  const qs = v.questions || [];
  const myWords = state.words.filter((w) => w.src === id);

  const subsTip = v.subs === 'burned'
    ? '💬 Субтитри вже вшиті в кадр (французькі + англійські). Спробуй читати лише французькі.'
    : `💬 Увімкни <b>французькі субтитри</b>: кнопка <b>CC</b> у плеєрі (або ⚙ → Субтитри → Français). Застосунок намагається ввімкнути їх сам.${v.subs === 'auto' ? ' Тут лише автоматичні субтитри — можливі помилки.' : ''}`;

  app.innerHTML = `
    <a class="back" href="#/">← Бібліотека</a>
    <h1>${esc(v.title)}</h1>
    <div class="small muted" style="margin-top:4px">${esc(v.channel || '')}${v.duration ? ' · ' + fmtDur(v.duration) : ''}</div>
    <div class="meta">${metaTags(v)}${L.done ? '<span class="tag good">✓ заняття пройдено</span>' : ''}</div>

    <!-- 1. Перед переглядом -->
    <section class="section card">
      <div class="section-title"><span class="step">1</span><h2>Перед переглядом</h2></div>
      ${v.about ? `<p>${esc(v.about)}</p>` : `<p>Прочитай назву відео і спробуй вгадати <b>5 французьких слів</b>, які в ньому прозвучать. Після перегляду перевір себе.</p>`}
      ${kws.length ? `
        <h3 style="margin-top:14px">Ключові слова</h3>
        <div class="kw" style="margin-top:4px">
          ${kws.map((k, i) => `
            <div class="kw-row">
              <div class="grow"><div class="kw-fr">${esc(k.fr)}</div><div class="kw-uk">${esc(k.uk)}</div></div>
              <button class="mini" type="button" data-act="say" data-text="${esc(k.fr)}" aria-label="Вимова">🔊</button>
              <button class="mini ${hasWord(k.fr) ? 'added' : ''}" type="button" data-act="addkw" data-i="${i}" aria-label="Додати в словник">${hasWord(k.fr) ? '✓' : '＋'}</button>
            </div>`).join('')}
        </div>
        <button class="btn sm" type="button" data-act="addallkw" style="margin-top:10px">＋ Усі слова в словник</button>` : ''}
    </section>

    <!-- 2. Перегляд -->
    <section class="section card">
      <div class="section-title"><span class="step">2</span><h2>Перегляд</h2></div>
      <div class="player-wrap"><div id="yt"><div class="ph">Завантаження плеєра…</div></div></div>
      <div class="controls">
        <button class="btn" type="button" data-act="back5">⟲ 5 сек</button>
        <div class="seg" role="group" aria-label="Швидкість">
          ${[0.75, 1, 1.25].map((r) => `<button type="button" data-act="rate" data-rate="${r}" class="${r === rate ? 'on' : ''}">${r}×</button>`).join('')}
        </div>
        <span class="small muted grow" style="text-align:right">Слухав: <b id="listened">${Math.floor((L.seconds || 0) / 60)} хв</b></span>
      </div>
      <div class="tip">${subsTip}</div>
      <p class="small" style="margin-top:10px"><a href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener">Відкрити на YouTube ↗</a></p>
    </section>

    <!-- 3. Після перегляду -->
    <section class="section card">
      <div class="section-title"><span class="step">3</span><h2>Нові слова</h2></div>
      <p class="muted small">Запиши 3 нові слова чи вирази з відео — вони потраплять у твій словник.</p>
      <div class="words3" style="margin-top:10px">
        ${[0, 1, 2].map((i) => `
          <div class="word-pair">
            <input class="input" data-w="fr${i}" placeholder="слово французькою" autocapitalize="off" autocomplete="off" lang="fr">
            <input class="input" data-w="uk${i}" placeholder="переклад" autocomplete="off">
          </div>`).join('')}
      </div>
      <button class="btn primary block" type="button" data-act="savewords" style="margin-top:10px">Зберегти в словник</button>
      <div id="mywords" class="small muted" style="margin-top:10px">${myWordsHtml(myWords)}</div>
    </section>

    <section class="section card">
      <div class="section-title"><span class="step">4</span><h2>Переказ головної думки</h2></div>
      <p class="muted small">2–4 речення, бажано французькою. Можна почати з фрази:</p>
      <div class="starters">${STARTERS.map((s) => `<button type="button" data-act="starter" data-text="${esc(s)}">${esc(s)}</button>`).join('')}</div>
      <textarea class="input" id="summary" data-input="summary" lang="fr" placeholder="Dans cette vidéo, on parle de…">${esc(L.summary || '')}</textarea>
      <div class="small muted" id="summarySaved" style="margin-top:6px">${L.summary ? 'Збережено' : ''}</div>
    </section>

    <section class="section card">
      <div class="section-title"><span class="step">5</span><h2>Shadowing — повтори вголос</h2></div>
      <p class="muted small">1) Програй останні ${SNIPPET_SEC} секунд. 2) Запиши, як ти повторюєш фразу. 3) Послухай себе і порівняй з оригіналом.</p>
      <div class="row" style="margin-top:10px">
        <button class="btn" type="button" data-act="replay">🔁 Останні ${SNIPPET_SEC} сек</button>
        <button class="btn rec" type="button" data-act="rec" id="recBtn">🎙 Записати себе</button>
      </div>
      <audio id="recAudio" controls class="hidden" style="width:100%;margin-top:12px"></audio>
      <p class="small muted" id="recNote" style="margin-top:8px">Запис зберігається лише до закриття сторінки.</p>
    </section>

    ${qs.length ? `
    <section class="section card">
      <div class="section-title"><span class="step">6</span><h2>Питання на розуміння</h2></div>
      <div id="quiz">${quizHtml(v, L)}</div>
    </section>` : ''}

    <section class="section card">
      <div class="section-title"><span class="step">${qs.length ? 7 : 6}</span><h2>Наскільки зрозумів?</h2></div>
      <div class="row"><span class="pct" id="pctVal">${L.understood ?? 50}%</span><span class="muted small">без субтитрів чи з ними — оцінюй чесно</span></div>
      <input type="range" min="0" max="100" step="5" value="${L.understood ?? 50}" data-input="understood" aria-label="Відсоток розуміння">
    </section>

    <button class="btn good big block" type="button" data-act="finish" style="margin-top:20px">✓ ${L.done ? 'Оновити заняття' : 'Завершити заняття'}</button>
    ${v.custom ? `<button class="btn danger block" type="button" data-act="delvideo" style="margin-top:10px">Видалити це відео з бібліотеки</button>` : ''}
  `;

  if (L.understood == null) L.understood = 50;
  createPlayer(v);
}

function myWordsHtml(list) {
  return list.length ? 'У словнику з цього відео: ' + list.map((w) => `<b>${esc(w.fr)}</b>`).join(', ') : '';
}

function quizHtml(v, L) {
  const qs = v.questions || [];
  const answered = Object.keys(L.quiz || {}).length;
  const right = qs.filter((q, i) => L.quiz && L.quiz[i] === q.answer).length;
  return qs.map((q, qi) => {
    const chosen = L.quiz ? L.quiz[qi] : undefined;
    const done = chosen !== undefined;
    return `
      <div class="quiz-q">
        <p>${qi + 1}. ${esc(q.q)}</p>
        ${q.options.map((o, oi) => {
          let cls = '';
          if (done && oi === q.answer) cls = 'right';
          else if (done && oi === chosen) cls = 'wrong';
          return `<button type="button" class="opt ${cls}" data-act="answer" data-q="${qi}" data-o="${oi}" ${done ? 'disabled' : ''}>${esc(o)}</button>`;
        }).join('')}
      </div>`;
  }).join('') + (answered ? `
      <div class="row" style="margin-top:16px">
        <b class="grow">Правильно: ${right} з ${qs.length}</b>
        <button class="btn sm" type="button" data-act="quizreset">Ще раз</button>
      </div>` : '');
}

/* --- YouTube-плеєр (офіційний IFrame API, безкоштовно) --- */

let ytApi = null;
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (!ytApi) {
    ytApi = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { ytApi = null; reject(new Error('offline')); };
      document.head.appendChild(s);
    });
  }
  return ytApi;
}

function playerMessage(html) {
  const box = $('.player-wrap');
  if (box) box.innerHTML = `<div class="ph"><div>${html}</div></div>`;
}

function createPlayer(v) {
  if (location.protocol === 'file:') {
    playerMessage('YouTube не працює, якщо відкрити файл напряму.<br>Запусти локальний сервер або відкрий з GitHub Pages (див. README).');
    return;
  }
  loadYouTubeApi().then(() => {
    if (!current || current.v.id !== v.id || !$('#yt')) return; // користувач уже пішов з екрана
    let captionsTried = false;
    player = new YT.Player('yt', {
      videoId: v.id,
      playerVars: {
        playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3,
        cc_load_policy: 1, cc_lang_pref: 'fr', hl: 'fr', // просимо французькі субтитри
      },
      events: {
        onReady: () => {
          try { player.setPlaybackRate(state.settings.rate || 1); } catch { /* ignore */ }
          // Для доданих вручну відео дізнаємося тривалість із плеєра
          const d = Math.round(player.getDuration ? player.getDuration() : 0);
          if (v.custom && d && !v.duration) {
            const cv = state.customVideos.find((x) => x.id === v.id);
            if (cv) { cv.duration = d; v.duration = d; save(); }
          }
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING && !captionsTried) {
            captionsTried = true;
            try { player.loadModule('captions'); player.setOption('captions', 'track', { languageCode: 'fr' }); } catch { /* ignore */ }
          }
          if (e.data === YT.PlayerState.ENDED && current) { current.L.watched = true; save(); }
        },
        onError: (e) => {
          const msg = { 2: 'Неправильний ID відео.', 5: 'Помилка плеєра.', 100: 'Відео видалене або приватне.', 101: 'YouTube не дозволив відтворити відео тут.', 150: 'YouTube не дозволив відтворити відео тут.', 152: 'YouTube не дозволив відтворити відео тут.', 153: 'Плеєр не отримав адресу сайту. Відкрий застосунок через http(s).' }[e.data] || 'Не вдалося відтворити відео.';
          const hint = [101, 150, 152].includes(e.data) ? '<br><span style="font-size:.85em">Або автор заборонив вбудовування, або YouTube тимчасово перевіряє вашу мережу «на робота». Спробуй пізніше чи через мобільний інтернет.</span>' : '';
          playerMessage(`${esc(msg)}${hint}<br><a href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener">Відкрити на YouTube ↗</a>`);
        },
      },
    });
    // Щосекунди: якщо відео грає — додаємо секунду до часу слухання
    tickTimer = setInterval(() => {
      if (!player || !player.getPlayerState || !current) return;
      if (player.getPlayerState() !== 1) return;
      const { L, v: cv } = current;
      L.seconds = (L.seconds || 0) + 1;
      dayOf().sec += 1;
      if (!L.watched && cv.duration && L.seconds >= cv.duration * 0.8) L.watched = true;
      const el = $('#listened');
      if (el) el.textContent = `${Math.floor(L.seconds / 60)} хв`;
      if (++ticks % 10 === 0) save();
    }, 1000);
  }).catch(() => playerMessage('Немає з\'єднання з YouTube. Перевір інтернет.'));
}

function cleanupLesson() {
  clearInterval(tickTimer); tickTimer = null;
  clearTimeout(snippetTimer); snippetTimer = null;
  stopRecording(true);
  if (player && player.destroy) { try { player.destroy(); } catch { /* ignore */ } }
  player = null;
  if (current) save(true);
  current = null;
}

const playerOk = () => player && player.getCurrentTime;

actions.back5 = () => {
  if (!playerOk()) return;
  player.seekTo(Math.max(0, player.getCurrentTime() - 5), true);
};
actions.rate = (el) => {
  const r = Number(el.dataset.rate);
  state.settings.rate = r; save();
  $$('[data-act="rate"]').forEach((b) => b.classList.toggle('on', Number(b.dataset.rate) === r));
  if (playerOk()) player.setPlaybackRate(r);
};
actions.replay = () => {
  if (!playerOk()) return;
  const start = Math.max(0, player.getCurrentTime() - SNIPPET_SEC);
  player.seekTo(start, true);
  player.playVideo();
  clearTimeout(snippetTimer);
  snippetTimer = setTimeout(() => { if (playerOk()) player.pauseVideo(); }, (SNIPPET_SEC / (state.settings.rate || 1)) * 1000 + 300);
};

/* --- Слова з відео --- */

function addWord(fr, uk, src) {
  fr = String(fr || '').trim(); uk = String(uk || '').trim();
  if (!fr) return false;
  if (hasWord(fr)) return false;
  const v = src && getVideo(src);
  state.words.unshift({ id: uid(), fr, uk, src: src || null, srcTitle: v ? v.title : '', added: Date.now(), box: 1, due: todayStr() });
  return true;
}

actions.say = (el) => say(el.dataset.text);
actions.addkw = (el) => {
  const k = current.v.keywords[Number(el.dataset.i)];
  if (addWord(k.fr, k.uk, current.v.id)) { save(); toast(`«${k.fr}» додано в словник`); }
  else toast('Це слово вже є в словнику');
  el.classList.add('added'); el.textContent = '✓';
  $('#mywords').innerHTML = myWordsHtml(state.words.filter((w) => w.src === current.v.id));
};
actions.addallkw = () => {
  let n = 0;
  current.v.keywords.forEach((k) => { if (addWord(k.fr, k.uk, current.v.id)) n++; });
  save();
  $$('[data-act="addkw"]').forEach((b) => { b.classList.add('added'); b.textContent = '✓'; });
  $('#mywords').innerHTML = myWordsHtml(state.words.filter((w) => w.src === current.v.id));
  toast(n ? `Додано ${n} ${plural(n, 'слово', 'слова', 'слів')}` : 'Усі слова вже в словнику');
};
actions.savewords = () => {
  let n = 0;
  [0, 1, 2].forEach((i) => {
    const fr = $(`[data-w="fr${i}"]`), uk = $(`[data-w="uk${i}"]`);
    if (fr.value.trim() && addWord(fr.value, uk.value, current.v.id)) { n++; fr.value = ''; uk.value = ''; }
  });
  if (!n) { toast('Впиши хоча б одне нове слово'); return; }
  save();
  $('#mywords').innerHTML = myWordsHtml(state.words.filter((w) => w.src === current.v.id));
  toast(`Збережено ${n} ${plural(n, 'слово', 'слова', 'слів')} ✓`);
};

/* --- Переказ і оцінка --- */

actions.starter = (el) => {
  const ta = $('#summary');
  const text = el.dataset.text.replace('…', ' ');
  ta.value = ta.value.trim() ? ta.value.trimEnd() + ' ' + text : text;
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  inputs.summary(ta);
};
inputs.summary = (el) => {
  current.L.summary = el.value;
  save();
  $('#summarySaved').textContent = 'Збережено';
};
inputs.understood = (el) => {
  current.L.understood = Number(el.value);
  $('#pctVal').textContent = el.value + '%';
  save();
};

actions.answer = (el) => {
  const { v, L } = current;
  L.quiz = L.quiz || {};
  L.quiz[Number(el.dataset.q)] = Number(el.dataset.o);
  save();
  $('#quiz').innerHTML = quizHtml(v, L);
};
actions.quizreset = () => {
  current.L.quiz = {};
  save();
  $('#quiz').innerHTML = quizHtml(current.v, current.L);
};

actions.finish = () => {
  const { L } = current;
  const first = !L.done;
  L.done = true;
  L.watched = true;
  if (first || L.doneAt == null || todayStr(new Date(L.doneAt)) !== todayStr()) dayOf().done += 1;
  L.doneAt = Date.now();
  save(true);
  const s = streak();
  toast(`Заняття зараховано! 🔥 Серія: ${s} ${plural(s, 'день', 'дні', 'днів')}`);
  location.hash = '#/';
};

actions.delvideo = () => {
  if (!confirm('Видалити це відео з бібліотеки? Твої слова в словнику залишаться.')) return;
  state.customVideos = state.customVideos.filter((x) => x.id !== current.v.id);
  delete state.lessons[current.v.id];
  save(true);
  location.hash = '#/add';
};

/* --- Запис голосу (MediaRecorder, працює лише через https або localhost) --- */

let recorder = null, recStream = null, recChunks = [], recUrl = null, recLimit = null;

function stopRecording(silent) {
  clearTimeout(recLimit);
  if (recorder && recorder.state === 'recording') {
    if (silent) recorder.onstop = null;
    recorder.stop();
  }
  if (recStream) { recStream.getTracks().forEach((t) => t.stop()); recStream = null; }
  if (silent && recUrl) { URL.revokeObjectURL(recUrl); recUrl = null; }
}

actions.rec = async (btn) => {
  if (recorder && recorder.state === 'recording') { stopRecording(false); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
    toast('Цей браузер не підтримує запис голосу'); return;
  }
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    toast('Немає доступу до мікрофона. Дозволь його в налаштуваннях браузера.'); return;
  }
  if (playerOk()) player.pauseVideo();
  const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
  recChunks = [];
  recorder = new MediaRecorder(recStream, type ? { mimeType: type } : undefined);
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(recChunks, { type: recorder.mimeType || type || 'audio/webm' });
    if (recUrl) URL.revokeObjectURL(recUrl);
    recUrl = URL.createObjectURL(blob);
    const audio = $('#recAudio');
    if (audio) { audio.src = recUrl; audio.classList.remove('hidden'); audio.play().catch(() => {}); }
    const b = $('#recBtn');
    if (b) { b.classList.remove('on'); b.textContent = '🎙 Записати ще раз'; }
  };
  recorder.start();
  btn.classList.add('on');
  btn.textContent = '⏹ Зупинити запис';
  recLimit = setTimeout(() => stopRecording(false), 60000); // не довше хвилини
};

/* ---------- 8. Словник і картки ---------- */

const dueWords = () => state.words.filter((w) => !w.due || w.due <= todayStr());

function wordRow(w) {
  const src = w.src && getVideo(w.src);
  return `
    <div class="wrow">
      <div class="grow">
        <div><b lang="fr">${esc(w.fr)}</b> — ${esc(w.uk || '…')}</div>
        ${src ? `<a class="wsrc" href="#/v/${esc(w.src)}">🎬 ${esc(src.title)}</a>` : (w.srcTitle ? `<span class="wsrc">🎬 ${esc(w.srcTitle)}</span>` : '')}
      </div>
      <span class="tag" title="Рівень запам'ятовування">${w.box || 1}/5</span>
      <button class="mini" type="button" data-act="say" data-text="${esc(w.fr)}" aria-label="Вимова">🔊</button>
      <button class="mini" type="button" data-act="delword" data-id="${esc(w.id)}" aria-label="Видалити">🗑</button>
    </div>`;
}

function viewWords() {
  document.title = 'Словник — Écoute';
  const n = state.words.length;
  const due = dueWords().length;
  app.innerHTML = `
    <h1>Словник</h1>
    <p class="muted" style="margin-top:4px">${n} ${plural(n, 'слово', 'слова', 'слів')} · на повторення сьогодні: ${due}</p>
    <a class="btn primary big block" href="#/review" style="margin-top:14px">🃏 Повторити картки${due ? ` (${due})` : ''}</a>

    <section class="card section">
      <h2>Додати слово</h2>
      <div class="word-pair" style="margin-top:10px">
        <input class="input" id="newFr" placeholder="французькою" lang="fr" autocapitalize="off" autocomplete="off">
        <input class="input" id="newUk" placeholder="переклад" autocomplete="off">
      </div>
      <button class="btn block" type="button" data-act="addword" style="margin-top:10px">＋ Додати</button>
    </section>

    ${n ? `
    <section class="section">
      <input class="input" type="search" placeholder="Пошук у словнику" data-input="wsearch" aria-label="Пошук у словнику">
      <div class="card wlist" id="wlist" style="margin-top:10px">${state.words.map(wordRow).join('')}</div>
    </section>` : `<div class="card section center muted">Словник порожній. Додавай слова під час занять — кнопкою ＋ біля ключових слів або в розділі «Нові слова».</div>`}
  `;
}

app.addEventListener('keydown', (e) => {
  // Картку можна перевернути клавішею Enter або пробілом
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Enter' && (e.target.id === 'newFr' || e.target.id === 'newUk')) actions.addword();
  if (e.key === 'Enter' && e.target.id === 'addUrl') actions.addvideo();
});

actions.addword = () => {
  const fr = $('#newFr'), uk = $('#newUk');
  if (!fr.value.trim()) { toast('Впиши слово'); fr.focus(); return; }
  if (!addWord(fr.value, uk.value, null)) { toast('Це слово вже є в словнику'); return; }
  save();
  viewWords();
  toast('Додано ✓');
  $('#newFr').focus();
};
actions.delword = (el) => {
  const w = state.words.find((x) => x.id === el.dataset.id);
  if (!w || !confirm(`Видалити «${w.fr}» зі словника?`)) return;
  state.words = state.words.filter((x) => x.id !== w.id);
  save();
  el.closest('.wrow').remove();
};
inputs.wsearch = (el) => {
  const q = el.value.trim().toLowerCase();
  $('#wlist').innerHTML = state.words.filter((w) => !q || `${w.fr} ${w.uk}`.toLowerCase().includes(q)).map(wordRow).join('')
    || '<p class="muted center">Нічого не знайдено</p>';
};

/* --- Режим карток (інтервальне повторення) --- */

let session = null; // {queue: [id], total, known, flipped, practice}

function startSession(practice) {
  const list = practice ? state.words : dueWords();
  session = { queue: shuffle(list).map((w) => w.id), total: list.length, done: 0, known: 0, flipped: false, practice, retried: {} };
}

function viewReview() {
  document.title = 'Картки — Écoute';
  if (!state.words.length) {
    app.innerHTML = `<a class="back" href="#/words">← Словник</a>
      <div class="card center"><h2>Поки немає карток</h2><p class="muted" style="margin-top:8px">Додай слова під час занять — і тут з'являться картки.</p>
      <a class="btn primary" href="#/" style="margin-top:14px">До відео</a></div>`;
    return;
  }
  if (!session) startSession(false);
  const dir = state.settings.cardDir || 'fr';
  const id = session.queue[0];
  const w = state.words.find((x) => x.id === id);

  if (!w) { // черга закінчилась
    const wasEmpty = session.total === 0;
    app.innerHTML = `<a class="back" href="#/words">← Словник</a>
      <div class="card center stack">
        <div style="font-size:2.5rem">${wasEmpty ? '🎉' : '✅'}</div>
        <h2>${wasEmpty ? 'На сьогодні все повторено' : 'Готово!'}</h2>
        ${wasEmpty ? '<p class="muted">Нові картки з\'являться завтра. Можна повторити все й зараз.</p>'
          : `<p class="muted">Повторено: ${session.done}. Пам'ятаєш з першого разу: ${session.known}.</p>`}
        <button class="btn primary block" type="button" data-act="practiceall">🔁 Повторити всі слова (${state.words.length})</button>
        <a class="btn block" href="#/">До відео</a>
      </div>`;
    session = null;
    return;
  }

  const front = dir === 'fr' ? w.fr : (w.uk || '…');
  const back = dir === 'fr' ? (w.uk || '…') : w.fr;
  const src = w.src && getVideo(w.src);
  const progress = session.total ? Math.round((session.done / session.total) * 100) : 0;

  app.innerHTML = `
    <div class="row"><a class="back grow" href="#/words">← Словник</a>
      <div class="seg" role="group" aria-label="Напрям">
        <button type="button" data-act="carddir" data-dir="fr" class="${dir === 'fr' ? 'on' : ''}">FR → UK</button>
        <button type="button" data-act="carddir" data-dir="uk" class="${dir === 'uk' ? 'on' : ''}">UK → FR</button>
      </div>
    </div>
    <div class="row small muted" style="margin:10px 0 6px"><span class="grow">${session.practice ? 'Вільне повторення' : 'Повторення на сьогодні'}</span><span>${session.done} / ${session.total}</span></div>
    <div class="bar"><i style="width:${progress}%"></i></div>

    <div class="card flash section" data-act="flip" role="button" tabindex="0" aria-label="Перевернути картку">
      <div class="front" ${dir === 'fr' ? 'lang="fr"' : ''}>${esc(front)}</div>
      ${session.flipped ? `
        <div class="backside" ${dir === 'uk' ? 'lang="fr"' : ''}>${esc(back)}</div>
        ${src ? `<div class="small muted">🎬 ${esc(src.title)}</div>` : ''}`
        : '<div class="small muted">Торкнись, щоб побачити переклад</div>'}
    </div>
    <div class="row" style="justify-content:center;margin-top:10px">
      <button class="btn sm" type="button" data-act="say" data-text="${esc(w.fr)}">🔊 Вимова</button>
    </div>
    ${session.flipped ? `
      <div class="grade" style="margin-top:14px">
        <button class="btn big" type="button" data-act="grade" data-ok="0">✗ Не пам'ятаю</button>
        <button class="btn good big" type="button" data-act="grade" data-ok="1">✓ Пам'ятаю</button>
      </div>` : `<button class="btn primary big block" type="button" data-act="flip" style="margin-top:14px">Показати відповідь</button>`}
  `;
}

actions.flip = () => { session.flipped = !session.flipped; viewReview(); };
actions.carddir = (el) => { state.settings.cardDir = el.dataset.dir; save(); session.flipped = false; viewReview(); };
actions.practiceall = () => { startSession(true); viewReview(); };
actions.grade = (el) => {
  const ok = el.dataset.ok === '1';
  const id = session.queue.shift();
  const w = state.words.find((x) => x.id === id);
  if (w) {
    if (ok) {
      w.box = Math.min(5, (w.box || 1) + 1);
      w.due = addDays(todayStr(), SRS_DAYS[w.box]);
      if (!session.retried[id]) session.known++;
      session.done++;
    } else {
      w.box = 1;
      w.due = todayStr();
      if (!session.retried[id]) { session.retried[id] = true; session.queue.push(id); } // покажемо ще раз у кінці
      else session.done++;
    }
    dayOf().cards += 1;
  }
  session.flipped = false;
  save();
  viewReview();
};

/* ---------- 9. Екран «Прогрес» ---------- */

const isActiveDay = (d) => { const x = state.days[d]; return !!(x && (x.sec >= 60 || x.done > 0 || x.cards > 0)); };

// Серія днів поспіль (якщо сьогодні ще не займався — рахуємо до вчора)
function streak() {
  let d = todayStr();
  if (!isActiveDay(d)) d = addDays(d, -1);
  let n = 0;
  while (isActiveDay(d)) { n++; d = addDays(d, -1); }
  return n;
}
function bestStreak() {
  const days = Object.keys(state.days).filter(isActiveDay).sort();
  let best = 0, run = 0, prev = null;
  days.forEach((d) => { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; });
  return best;
}

function viewProgress() {
  document.title = 'Прогрес — Écoute';
  const vids = allVideos();
  const watched = vids.filter((v) => isWatched(v.id)).length;
  const totalMin = Math.floor(Object.values(state.days).reduce((s, d) => s + (d.sec || 0), 0) / 60);
  const s = streak();
  const theme = state.settings.theme;

  // Графік: хвилини за останні 14 днів
  const days = Array.from({ length: 14 }, (_, i) => addDays(todayStr(), i - 13));
  const secs = days.map((d) => (state.days[d] && state.days[d].sec) || 0);
  const mins = secs.map((x) => Math.floor(x / 60));
  const max = Math.max(10, ...mins);
  const wd = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

  const recent = Object.entries(state.lessons)
    .filter(([id, L]) => getVideo(id) && (L.done || L.watched || L.seconds > 0))
    .sort((a, b) => (b[1].doneAt || b[1].openedAt || 0) - (a[1].doneAt || a[1].openedAt || 0))
    .slice(0, 8);

  app.innerHTML = `
    <h1>Прогрес</h1>
    <div class="stats section">
      <div class="card stat"><div class="num">🔥 ${s}</div><div class="lab">${plural(s, 'день', 'дні', 'днів')} поспіль · рекорд ${bestStreak()}</div></div>
      <div class="card stat"><div class="num">${totalMin}</div><div class="lab">хвилин слухання</div></div>
      <div class="card stat"><div class="num">${watched}<span class="muted" style="font-size:1rem"> / ${vids.length}</span></div><div class="lab">відео переглянуто</div></div>
      <div class="card stat"><div class="num">${state.words.length}</div><div class="lab">слів у словнику</div></div>
    </div>

    <section class="card section">
      <h2>Хвилини за 2 тижні</h2>
      <div class="chart" aria-label="Хвилини слухання по днях">
        ${days.map((d, i) => {
          const [y, m, dd] = d.split('-').map(Number);
          return `<div class="col" title="${d}: ${mins[i]} хв"><i class="${secs[i] ? '' : 'zero'}" style="height:${Math.max(secs[i] ? 4 : 2, (mins[i] / max) * 100)}%"></i><span>${wd[new Date(y, m - 1, dd).getDay()]}</span></div>`;
        }).join('')}
      </div>
    </section>

    ${recent.length ? `
    <section class="card section">
      <h2>Останні заняття</h2>
      <div class="wlist" style="margin-top:6px">
        ${recent.map(([id, L]) => {
          const v = getVideo(id);
          const qs = v.questions || [];
          const right = qs.filter((q, i) => L.quiz && L.quiz[i] === q.answer).length;
          return `<a class="wrow" href="#/v/${esc(id)}" style="color:inherit">
            <div class="grow"><div class="vtitle" style="-webkit-line-clamp:2">${esc(v.title)}</div>
            <div class="small muted">${L.done ? '✓ пройдено' : 'в процесі'} · ${Math.floor((L.seconds || 0) / 60)} хв${L.understood != null && L.done ? ` · зрозумів ${L.understood}%` : ''}${qs.length && L.quiz && Object.keys(L.quiz).length ? ` · тест ${right}/${qs.length}` : ''}</div></div>
          </a>`;
        }).join('')}
      </div>
    </section>` : ''}

    <section class="card section">
      <h2>Тема оформлення</h2>
      <div class="seg" role="group" style="margin-top:10px">
        ${[['auto', 'Авто'], ['light', 'Світла'], ['dark', 'Темна']].map(([k, l]) => `<button type="button" data-act="settheme" data-theme="${k}" class="${theme === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
    </section>

    <section class="card section">
      <h2>Мої дані</h2>
      <p class="muted small" style="margin-top:6px">Прогрес зберігається лише в цьому браузері. Зроби експорт, щоб мати резервну копію або перенести дані на інший пристрій.</p>
      <div class="row" style="margin-top:12px">
        <button class="btn primary grow" type="button" data-act="export">⬇ Експорт у файл</button>
        <button class="btn grow" type="button" data-act="import">⬆ Імпорт з файлу</button>
      </div>
      <input type="file" id="importFile" accept="application/json,.json" class="hidden">
      <button class="btn danger block" type="button" data-act="reset" style="margin-top:10px">Скинути весь прогрес</button>
    </section>
  `;
  $('#importFile').addEventListener('change', importData);
}

actions.settheme = (el) => { state.settings.theme = el.dataset.theme; save(); applyTheme(); viewProgress(); };

actions.export = () => {
  const data = { app: 'ecoute', version: 1, exportedAt: new Date().toISOString(), state };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ecoute-progres-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Файл збережено');
};
actions.import = () => $('#importFile').click();

async function importData(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || data.app !== 'ecoute' || !data.state) throw new Error('format');
    if (!confirm('Імпортувати дані з файлу? Поточний прогрес у цьому браузері буде замінено.')) return;
    state = normalizeState(data.state);
    save(true);
    applyTheme();
    toast('Дані імпортовано ✓');
    viewProgress();
  } catch {
    toast('Це не схоже на файл експорту Écoute');
  } finally {
    e.target.value = '';
  }
}

actions.reset = () => {
  if (!confirm('Точно скинути весь прогрес, словник і додані відео?')) return;
  if (!confirm('Це не можна скасувати. Можливо, спершу зробити експорт? Натисни OK, щоб усе одно скинути.')) return;
  state = defaultState();
  save(true);
  applyTheme();
  toast('Прогрес скинуто');
  viewProgress();
};

/* --- Тема --- */

const THEME_ICONS = { auto: '◐', light: '☀', dark: '☾' };
const THEME_COLORS = { light: '#f6f6f3', dark: '#111317' };
function applyTheme() {
  const t = state.settings.theme || 'auto';
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  $$('meta[name="theme-color"]').forEach((m) => {
    m.content = t === 'auto' ? (m.media.includes('dark') ? THEME_COLORS.dark : THEME_COLORS.light) : THEME_COLORS[t];
  });
  const btn = $('#themeBtn');
  btn.textContent = THEME_ICONS[t];
  btn.setAttribute('aria-label', `Тема: ${{ auto: 'автоматична', light: 'світла', dark: 'темна' }[t]}. Натисни, щоб змінити`);
}
$('#themeBtn').addEventListener('click', () => {
  const order = ['auto', 'light', 'dark'];
  state.settings.theme = order[(order.indexOf(state.settings.theme) + 1) % 3];
  save();
  applyTheme();
  toast({ auto: 'Тема: як у системі', light: 'Світла тема', dark: 'Темна тема' }[state.settings.theme]);
  if (location.hash.startsWith('#/progress')) viewProgress();
});

/* ---------- 10. Екран «Додати відео» ---------- */

function viewAdd() {
  document.title = 'Додати відео — Écoute';
  const mine = state.customVideos;
  app.innerHTML = `
    <h1>Додати відео</h1>
    <p class="muted" style="margin-top:4px">Встав посилання з YouTube — відео з'явиться в бібліотеці з універсальними вправами (слова, переказ, shadowing, оцінка).</p>

    <section class="card section">
      <div class="field">
        <label class="lbl" for="addUrl">Посилання на відео</label>
        <input class="input" id="addUrl" type="url" inputmode="url" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off">
      </div>
      <div class="field">
        <label class="lbl" for="addTopic">Тема</label>
        <select class="input" id="addTopic">
          ${Object.entries(TOPICS).map(([k, t]) => `<option value="${k}">${t.icon} ${esc(t.label)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <span class="lbl">Рівень</span>
        <div class="seg" role="group" id="addLevel">
          ${['B1', 'B2', 'C1'].map((l, i) => `<button type="button" data-act="addlevel" data-level="${l}" class="${i === 0 ? 'on' : ''}">${l}</button>`).join('')}
        </div>
      </div>
      <button class="btn primary big block" type="button" data-act="addvideo" id="addBtn" style="margin-top:16px">＋ Додати в бібліотеку</button>
      <p class="small muted" id="addStatus" style="margin-top:10px"></p>
    </section>

    <section class="card section">
      <h2>Мої додані відео · ${mine.length}</h2>
      ${mine.length ? `
        <div class="wlist" style="margin-top:6px">
          ${mine.map((v) => `
            <div class="wrow">
              <div class="grow"><a href="#/v/${esc(v.id)}" style="color:inherit"><b>${esc(v.title)}</b></a>
              <div class="small muted">${(TOPICS[v.topic] || TOPICS.other).icon} ${esc((TOPICS[v.topic] || TOPICS.other).label)} · ${esc(v.level || '')}${v.duration ? ' · ' + fmtDur(v.duration) : ''}</div></div>
              <button class="mini" type="button" data-act="delcustom" data-id="${esc(v.id)}" aria-label="Видалити">🗑</button>
            </div>`).join('')}
        </div>
        <button class="btn block" type="button" data-act="copyjson" style="margin-top:12px">📋 Скопіювати як JSON для videos.json</button>
        <p class="small muted" style="margin-top:8px">Додані тут відео живуть у цьому браузері (і потрапляють в експорт). Щоб вони були на всіх пристроях — встав скопійований JSON у файл videos.json на GitHub.</p>
        <textarea class="input hidden" id="jsonOut" readonly style="margin-top:10px;font-family:monospace;font-size:.8rem"></textarea>`
      : '<p class="muted small" style="margin-top:6px">Тут з\'являться відео, які ти додаси.</p>'}
    </section>
  `;
}

actions.addlevel = (el) => $$('#addLevel button').forEach((b) => b.classList.toggle('on', b === el));

actions.addvideo = async () => {
  const urlEl = $('#addUrl');
  const status = $('#addStatus');
  const id = parseYouTubeId(urlEl.value);
  if (!id) { status.textContent = 'Не бачу ID відео в посиланні. Приклад: https://www.youtube.com/watch?v=vMIed3rlZtg'; urlEl.focus(); return; }
  if (getVideo(id)) { status.innerHTML = `Це відео вже є в бібліотеці. <a href="#/v/${esc(id)}">Відкрити →</a>`; return; }

  const btn = $('#addBtn');
  btn.disabled = true;
  status.textContent = 'Перевіряю відео…';
  let title = '', channel = '';
  try {
    // oEmbed від YouTube: безкоштовно, без ключа. Повертає назву й канал.
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`);
    if (res.status === 401 || res.status === 403) {
      status.textContent = 'Автор заборонив показ цього відео на інших сайтах — у застосунку воно не відтвориться.';
      btn.disabled = false; return;
    }
    if (!res.ok) { status.textContent = 'Відео не знайдено. Перевір посилання.'; btn.disabled = false; return; }
    const o = await res.json();
    title = o.title; channel = o.author_name;
  } catch {
    title = 'Відео ' + id; // немає інтернету — додамо без назви
  }
  const level = ($('#addLevel button.on') || {}).dataset?.level || 'B1';
  state.customVideos.push({ id, title, channel, topic: $('#addTopic').value, level, duration: 0, custom: true, addedAt: Date.now() });
  save(true);
  btn.disabled = false;
  toast('Відео додано ✓');
  location.hash = `#/v/${id}`;
};

actions.delcustom = (el) => {
  const v = state.customVideos.find((x) => x.id === el.dataset.id);
  if (!v || !confirm(`Видалити «${v.title}» з бібліотеки?`)) return;
  state.customVideos = state.customVideos.filter((x) => x.id !== v.id);
  save();
  viewAdd();
};

actions.copyjson = async () => {
  const json = state.customVideos.map(({ id, title, channel, topic, level, duration }) =>
    JSON.stringify({ id, title, channel, topic, level, duration, subs: 'auto' }, null, 2)).join(',\n');
  try {
    await navigator.clipboard.writeText(json);
    toast('Скопійовано! Встав у videos.json після останнього відео (через кому).');
  } catch {
    const ta = $('#jsonOut');
    ta.value = json;
    ta.classList.remove('hidden');
    ta.select();
    toast('Скопіюй текст з поля нижче');
  }
};

/* ---------- 11. Запуск ---------- */

applyTheme();
loadVideos().then(render);

// Службовий воркер: дозволяє встановити застосунок і відкривати його без інтернету
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
