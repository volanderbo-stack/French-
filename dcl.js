/* ==========================================================
   Écoute — розділ «Підготовка до DCL FLE (A1–B1)».
   Підключається ПІСЛЯ app.js і використовує його утиліти:
   $, $$, esc, app, state, save, toast, actions, inputs, todayStr,
   dayOf, shuffle, plural, getVideo, allVideos, videoCard, addWord, hasWord.

   Дані:
     dcl/index.json           — список файлів сценаріїв
     dcl/scenarios/*.json     — сценарії (шаблон: _template.json)
     dcl/phrases.json         — фрази для дзвінків і листів
     dcl/grammar.json         — картки граматики

   Адреси екранів:
     #/dcl                 головна DCL
     #/dcl/about           що таке DCL
     #/dcl/today           тренування на сьогодні
     #/dcl/s/ID/крок       сценарій (mission, lecture, ecoute, oral, ecrit, videos)
     #/dcl/exam            вибір пробного іспиту, #/dcl/exam/run — сам іспит
     #/dcl/phrases         фрази
     #/dcl/grammar[/ID]    граматика
     #/dcl/stats           статистика DCL
   ========================================================== */
'use strict';

/* ---------- Налаштування ---------- */

const DCL_TOPICS = {
  travail:        { label: 'Робота і стажування', icon: '💼' },
  logement:       { label: 'Житло',               icon: '🏠' },
  commerce:       { label: 'Магазин і клієнти',   icon: '🛍️' },
  transport:      { label: 'Транспорт',           icon: '🚆' },
  sante:          { label: 'Здоров\'я',           icon: '🩺' },
  administration: { label: 'Адміністрація',       icon: '🏛️' },
  evenement:      { label: 'Організація заходу',  icon: '🎉' },
  societe:        { label: 'Суспільство і культура', icon: '🌍' },
};
const DCL_LEVELS = ['A1', 'A2', 'B1'];
const SKILLS = {
  lecture: { label: 'Читання',   icon: '📄' },
  ecoute:  { label: 'Слухання',  icon: '🎧' },
  oral:    { label: 'Говоріння', icon: '🗣️' },
  ecrit:   { label: 'Письмо',    icon: '✍️' },
};
const STEPS = [['mission', 'Місія'], ['lecture', 'Читання'], ['ecoute', 'Слухання'], ['oral', 'Розмова'], ['ecrit', 'Письмо'], ['videos', 'Відео']];
// Тривалість фаз пробного іспиту, хвилини.
// FLE (A2–B1): фази 1–2 — 1 год 30, фази 3–4 — до 20 хв, фаза 5 — 40 хв (разом 2 год 30).
// FP (A1): увесь іспит 1 год 30; розподіл по фазах орієнтовний.
const EXAM_TIMES = { FP: { p12: 50, p34: 15, p5: 25 }, FLE: { p12: 90, p34: 20, p5: 40 } };
const SKILL_TIPS = {
  lecture: 'Читайте документи вибірково: спершу питання, потім шукайте в тексті цифри, дати, імена.',
  ecoute: 'Слухайте аудіо кілька разів: спочатку загальний зміст, потім деталі. Тренуйте вухо на відео з бібліотеки.',
  oral: 'Тренуйте розмовні фрази: привітання, уточнення, «Je comprends, mais…». Записуйте себе й порівнюйте зі зразком.',
  ecrit: 'Пишіть за планом: звертання → мета → 2–3 абзаци з фактами → завершальна формула. Рахуйте слова.',
};

/* ---------- Дані ---------- */

let DCL = null;
let dclLoading = null;

function loadDcl() {
  if (DCL) return Promise.resolve(DCL);
  if (!dclLoading) {
    const get = async (url) => {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.json();
    };
    dclLoading = (async () => {
      const idx = await get('dcl/index.json');
      const scen = await Promise.all((idx.scenarios || []).map((f) =>
        get('dcl/scenarios/' + f).catch((e) => { console.warn('Сценарій не завантажено:', e.message); return null; })));
      const [phrases, grammar] = await Promise.all([get('dcl/phrases.json'), get('dcl/grammar.json')]);
      DCL = {
        scenarios: scen.filter((s) => s && s.id && DCL_LEVELS.includes(s.level))
          .sort((a, b) => DCL_LEVELS.indexOf(a.level) - DCL_LEVELS.indexOf(b.level)),
        phrases, grammar,
      };
      return DCL;
    })().catch((e) => { dclLoading = null; throw e; });
  }
  return dclLoading;
}
const getScen = (id) => DCL && DCL.scenarios.find((s) => s.id === id);

/* ---------- Прогрес DCL у state ---------- */

function dclState() {
  const d = (state.dcl ||= {});
  d.target ||= 'A2';
  d.rate ||= 0.9;
  d.scen ||= {};
  d.exams ||= [];
  d.grammar ||= {};
  d.filter ||= 'target';
  return d;
}
const scenState = (id) => (dclState().scen[id] ||= { parts: {}, answers: {}, oral: {}, writing: '', wchecks: [] });

// Зберегти результат частини сценарію (найкращий) і зарахувати активність дня
function markPart(scenId, part, score) {
  const S = scenState(scenId);
  S.parts[part] = Math.max(S.parts[part] ?? 0, Math.round(score));
  S.updatedAt = Date.now();
  const day = dayOf();
  day.dcl = (day.dcl || 0) + 1;
  const t = dclState().today;
  if (t && t.date === todayStr() && t.scen === scenId && t.part === part) t.partDone = true;
  checkTodayDone();
  save();
}

// Середній результат по кожному вміння (тренування + пробні іспити)
function skillAverages() {
  const d = dclState();
  const out = {};
  Object.keys(SKILLS).forEach((k) => {
    const vals = [];
    Object.values(d.scen).forEach((s) => { if (s.parts && s.parts[k] != null) vals.push(s.parts[k]); });
    d.exams.forEach((e) => { if (e.parts && e.parts[k] != null) vals.push(e.parts[k]); });
    out[k] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    out[k + 'N'] = vals.length;
  });
  return out;
}

/* ---------- Озвучення (Web Speech API, безкоштовно, працює офлайн з системними голосами) ---------- */

let ttsToken = 0;
const hasTTS = 'speechSynthesis' in window;
if (hasTTS) { speechSynthesis.getVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', () => {}); }

function frVoices() {
  return hasTTS ? speechSynthesis.getVoices().filter((v) => /^fr([-_]|$)/i.test(v.lang)) : [];
}
function pickVoice(gender) {
  const vs = frVoices();
  if (!vs.length) return null;
  const pool = vs.filter((v) => /fr[-_]FR/i.test(v.lang)).length ? vs.filter((v) => /fr[-_]FR/i.test(v.lang)) : vs;
  const fem = /amélie|amelie|audrey|aurélie|aurelie|marie|julie|denise|hortense|virginie|céline|celine|léa|lea|chantal|sylvie|elsa|eloise|vivienne|google français|female|femme/i;
  const mal = /thomas|paul|henri|nicolas|claude|daniel|mathieu|jacques|antoine|remy|rémy|gerard|guillaume|male|homme/i;
  if (gender === 'm') return pool.find((v) => mal.test(v.name)) || pool[1] || pool[0];
  return pool.find((v) => fem.test(v.name)) || pool[0];
}
// Читає текст французькою. Довгий текст ділимо на речення (у Chrome довгі фрази обриваються).
function speak(text, { voice = 'f', rate, onend } = {}) {
  if (!hasTTS) { toast('Браузер не вміє озвучувати текст'); if (onend) onend(); return; }
  speechSynthesis.cancel();
  const token = ++ttsToken;
  const v = pickVoice(voice);
  if (!v) toast('Немає французького голосу. Додайте французьку мову озвучування в налаштуваннях телефона/системи.');
  const same = v && voice === 'm' && v === pickVoice('f');
  const parts = String(text).match(/[^.!?…]+[.!?…]*["»)]?\s*/g) || [String(text)];
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p.trim());
    u.lang = 'fr-FR';
    if (v) u.voice = v;
    u.rate = rate || dclState().rate || 0.9;
    if (same) u.pitch = 0.75; // той самий голос, але нижчий — «чоловічий»
    if (i === parts.length - 1) u.onend = () => { if (token === ttsToken && onend) onend(); };
    speechSynthesis.speak(u);
  });
}
function stopSpeak() { ttsToken++; if (hasTTS) speechSynthesis.cancel(); }

/* ---------- Запис голосу ---------- */

const dRecs = {};            // ключ → адреса запису (blob:)
let dRec = null, dRecStream = null, dRecChunks = [], dRecLimit = null;

function dRecStop(silent) {
  clearTimeout(dRecLimit);
  if (dRec && dRec.state === 'recording') { if (silent) dRec.onstop = null; dRec.stop(); }
  if (dRecStream) { dRecStream.getTracks().forEach((t) => t.stop()); dRecStream = null; }
}
const isRecording = () => !!(dRec && dRec.state === 'recording');

// Почати/зупинити запис; onDone(url) викликається, коли запис готовий
async function dRecToggle(btn, onDone) {
  if (isRecording()) { dRecStop(false); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
    toast('Цей браузер не підтримує запис голосу'); return;
  }
  try { dRecStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { toast('Немає доступу до мікрофона. Дозвольте його в налаштуваннях браузера.'); return; }
  stopSpeak();
  const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
  dRecChunks = [];
  dRec = new MediaRecorder(dRecStream, type ? { mimeType: type } : undefined);
  dRec.ondataavailable = (e) => { if (e.data && e.data.size) dRecChunks.push(e.data); };
  dRec.onstop = () => {
    const url = URL.createObjectURL(new Blob(dRecChunks, { type: dRec.mimeType || type || 'audio/webm' }));
    if (dRecStream) { dRecStream.getTracks().forEach((t) => t.stop()); dRecStream = null; }
    onDone(url);
  };
  try { dRec.start(); }
  catch {
    if (dRecStream) { dRecStream.getTracks().forEach((t) => t.stop()); dRecStream = null; }
    dRec = null;
    toast('Не вдалося почати запис. Перевірте мікрофон і спробуйте ще раз.');
    return;
  }
  btn.classList.add('on');
  btn.textContent = '⏹ Зупинити запис';
  dRecLimit = setTimeout(() => dRecStop(false), 120000);
}

/* ---------- Перевірка відповідей ---------- */

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFC').replace(/[’`ʼ]/g, "'").replace(/€|\beuros?\b/g, '')
  .replace(/-/g, ' ').replace(/[.;:!?]+$/g, '').replace(/\s+/g, ' ').trim();
const deacc = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
function isRight(q, val) {
  if (val == null || val === '') return false;
  if (q.options) return Number(val) === q.answer;
  const a = norm(val);
  return (q.accept || []).some((x) => norm(x) === a || deacc(norm(x)) === deacc(a));
}
const wordCount = (t) => (String(t || '').trim().match(/\S+/g) || []).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

function writingAutoChecks(w, text) {
  const n = wordCount(text);
  const res = [{ label: `Обсяг: ${n} ${plural(n, 'слово', 'слова', 'слів')} (потрібно ${w.minWords}–${w.maxWords})`, ok: n >= w.minWords && n <= Math.round(w.maxWords * 1.25) }];
  if (['email', 'lettre'].includes(w.format)) {
    res.push({ label: 'Є звертання (Bonjour, Madame, Monsieur…)', ok: /^\s*(objet\s*:.*\n\s*)?(bonjour|bonsoir|madame|monsieur|cher|chère|salut|mesdames|à toutes|à tous)/im.test(text) });
    res.push({ label: 'Є завершальна формула (Cordialement, Bien à vous…)', ok: /(cordialement|bien à vous|salutations|à bientôt|bonne journée|bonne soirée|amicalement|merci d'avance|je vous prie|à lundi|à samedi|bises)/i.test(text) });
  }
  return res;
}
function writingScore(w, text, checks) {
  const auto = writingAutoChecks(w, text);
  const total = auto.length + (w.checklist || []).length;
  const got = auto.filter((a) => a.ok).length + (checks || []).filter(Boolean).length;
  return total ? Math.round((got / total) * 100) : 0;
}

/* ---------- Спільні шматки інтерфейсу ---------- */

const lvlTag = (l) => `<span class="tag lvl">${esc(l)}${l === 'A1' ? ' · FP' : ''}</span>`;
const topicTag = (t) => { const x = DCL_TOPICS[t] || DCL_TOPICS.societe; return `<span class="tag">${x.icon} ${esc(x.label)}</span>`; };

function docHtml(d) {
  return `<div class="doc doc-${esc(d.type || 'note')}">
    <div class="doc-title">${docIcon(d.type)} ${esc(d.title || '')}</div>
    <div class="doc-text" lang="fr">${esc(d.text)}</div>
  </div>`;
}
function docIcon(t) {
  return { email: '✉️', annonce: '📌', affiche: '🪧', horaires: '🕒', menu: '🍽️', sms: '💬', note: '📝', fiche: '📋' }[t] || '📄';
}

function vocabHtml(list) {
  return `<div class="kw">${(list || []).map((k) => `
    <div class="kw-row">
      <div class="grow"><div class="kw-fr" lang="fr">${esc(k.fr)}</div><div class="kw-uk">${esc(k.uk)}</div></div>
      <button class="mini" type="button" data-act="dsay" data-text="${esc(k.fr)}" aria-label="Вимова">🔊</button>
      <button class="mini ${hasWord(k.fr) ? 'added' : ''}" type="button" data-act="daddword" data-fr="${esc(k.fr)}" data-uk="${esc(k.uk)}" aria-label="У словник">${hasWord(k.fr) ? '✓' : '＋'}</button>
    </div>`).join('')}</div>`;
}

let playingKey = null; // яке аудіо зараз звучить
function audioHtml(scen, showText) {
  const rate = dclState().rate;
  return `
    <div class="row small muted" style="margin-bottom:8px">Швидкість:
      <div class="seg" role="group">${[0.8, 0.9, 1].map((r) => `<button type="button" data-act="drate" data-rate="${r}" class="${r === rate ? 'on' : ''}">${r === 1 ? '1×' : r + '×'}</button>`).join('')}</div>
    </div>
    ${(scen.audio || []).map((a, i) => `
      <div class="doc doc-audio">
        <div class="doc-title">🎧 ${esc(a.title || 'Audio ' + (i + 1))}</div>
        <button class="btn primary" type="button" data-act="dplay" data-i="${i}" data-id="${esc(scen.id)}">${playingKey === scen.id + ':' + i ? '⏹ Стоп' : '▶ Слухати'}</button>
        ${showText ? `<details style="margin-top:10px"><summary class="small muted">Показати текст (після кількох прослуховувань)</summary><div class="doc-text" lang="fr" style="margin-top:8px">${esc(a.text)}</div></details>` : ''}
      </div>`).join('')}
    ${hasTTS ? '' : '<p class="tip">Цей браузер не підтримує озвучення. Спробуйте Chrome, Edge або Safari.</p>'}`;
}

actions.dsay = (el) => speak(el.dataset.text, { voice: el.dataset.voice || 'f' });
actions.daddword = (el) => {
  if (addWord(el.dataset.fr, el.dataset.uk, null)) { save(); toast(`«${el.dataset.fr}» додано в словник`); }
  else toast('Це вже є в словнику');
  el.classList.add('added'); el.textContent = '✓';
};
actions.drate = (el) => {
  dclState().rate = Number(el.dataset.rate); save();
  $$('[data-act="drate"]').forEach((b) => b.classList.toggle('on', b === el));
};
actions.dplay = (el) => {
  const scen = getScen(el.dataset.id);
  const key = scen.id + ':' + el.dataset.i;
  const reset = () => { playingKey = null; $$('[data-act="dplay"]').forEach((b) => { b.textContent = '▶ Слухати'; }); };
  if (playingKey === key) { stopSpeak(); reset(); return; }
  reset();
  playingKey = key;
  el.textContent = '⏹ Стоп';
  const a = scen.audio[Number(el.dataset.i)];
  speak(a.text, { voice: a.voice || 'f', onend: reset });
};

/* ---------- Головна сторінка DCL ---------- */

function scenProgressHtml(s) {
  const S = dclState().scen[s.id];
  return Object.entries(SKILLS).map(([k, x]) => {
    const v = S && S.parts && S.parts[k];
    return `<span class="tag ${v != null ? 'good' : ''}" title="${x.label}">${x.icon}${v != null ? ' ' + v + '%' : ''}</span>`;
  }).join('');
}

function viewDclHub() {
  document.title = 'DCL — Écoute';
  const d = dclState();
  const lvlFilter = d.filter === 'target' ? d.target : d.filter;
  const list = DCL.scenarios.filter((s) => lvlFilter === 'all' || s.level === lvlFilter);
  app.innerHTML = `
    <h1>Підготовка до DCL</h1>
    <p class="muted" style="margin-top:4px">Diplôme de Compétence en Langue — іспит Міністерства освіти Франції. Один сценарій із реального життя: читаєте, слухаєте, телефонуєте, пишете.</p>

    <div class="row" style="margin-top:14px">
      <span class="small muted">Мій цільовий рівень:</span>
      <div class="seg" role="group">${DCL_LEVELS.map((l) => `<button type="button" data-act="dtarget" data-l="${l}" class="${d.target === l ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    ${d.target === 'A1' ? '<p class="small muted" style="margin-top:6px">A1 — це DCL FP (français professionnel de 1er niveau, 1 год 30). DCL FLE починається з A2.</p>' : ''}

    ${dclTodayCardHtml(true)}

    <div class="tiles section">
      <a class="card tile" href="#/dcl/about"><span>❓</span><b>Що таке DCL</b><small>етапи, час, оцінювання</small></a>
      <a class="card tile" href="#/dcl/exam"><span>⏱️</span><b>Пробний іспит</b><small>з таймером, без підказок</small></a>
      <a class="card tile" href="#/dcl/phrases"><span>💬</span><b>Фрази</b><small>для дзвінків і листів</small></a>
      <a class="card tile" href="#/dcl/grammar"><span>📐</span><b>Граматика</b><small>5 карток з вправами</small></a>
      <a class="card tile" href="#/dcl/stats"><span>📊</span><b>Мій прогрес DCL</b><small>слабкі місця, іспити</small></a>
    </div>

    <section class="section">
      <div class="row"><h2 class="grow">Сценарії</h2>
        <div class="seg" role="group">${[['target', 'Мій'], ['all', 'Усі'], ...DCL_LEVELS.map((l) => [l, l])].map(([k, l]) => `<button type="button" data-act="dfilter" data-f="${k}" class="${d.filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>
      <div class="vlist">
        ${list.map((s) => {
          const S = d.scen[s.id];
          return `<a class="card scen" href="#/dcl/s/${esc(s.id)}/mission">
            <div class="row"><b class="grow">${esc(s.title)}</b>${S && S.done ? '<span class="tag good">✓ пройдено</span>' : ''}</div>
            <div class="small muted">${esc(s.titleUk || '')}</div>
            <div class="meta">${lvlTag(s.level)}${topicTag(s.topic)}</div>
            <div class="meta">${scenProgressHtml(s)}</div>
          </a>`;
        }).join('') || '<p class="muted">Немає сценаріїв цього рівня.</p>'}
      </div>
    </section>`;
}
actions.dtarget = (el) => { dclState().target = el.dataset.l; dclState().today = null; save(); viewDclHub(); };
actions.dfilter = (el) => { dclState().filter = el.dataset.f; save(); viewDclHub(); };

/* ---------- Що таке DCL ---------- */

function viewDclAbout() {
  document.title = 'Що таке DCL — Écoute';
  app.innerHTML = `
    <a class="back" href="#/dcl">← DCL</a>
    <h1>Що таке DCL FLE</h1>
    <section class="card section stack">
      <p><b>DCL</b> (Diplôme de Compétence en Langue) — національний професійний диплом Міністерства освіти Франції для дорослих. Перевіряє, чи вмієте ви <b>користуватися мовою, щоб виконати завдання</b> в ситуації, близькій до реальної роботи чи життя.</p>
      <ul class="list">
        <li><b>DCL FLE</b> (français langue étrangère) — 2 год 30 хв, рівні <b>A2 – B1 – B2 – C1</b>.</li>
        <li><b>DCL FP</b> (français professionnel de 1er niveau) — 1 год 30 хв, рівні <b>A1 – A2</b>.</li>
        <li>Рівень <b>не обирають заздалегідь</b>: усі кандидати складають той самий іспит, а журі визначає рівень за результатом.</li>
        <li>Диплом безстроковий. Результат — загальний рівень і детальний профіль за кожною складовою мови.</li>
      </ul>
    </section>

    <section class="card section stack">
      <h2>Один сценарій — одна місія</h2>
      <p>Ви граєте роль (наприклад, асистентки в компанії) і отримуєте <b>нелінгвістичну місію</b>: обрати одне з кількох рішень, сказати, чи цікава пропозиція, організувати подію. Усі етапи пов'язані: інформація з документів і аудіо потрібна для розмови, а з розмови — для письма.</p>
    </section>

    <section class="card section">
      <h2>Етапи іспиту (DCL FLE)</h2>
      <div class="phases">
        <div class="phase"><b>Фаза 1 · Читання</b><span>Знайомство із ситуацією і документами. Заповнюєте «grille de lecture» — таблицю ключових фактів.</span></div>
        <div class="phase"><b>Фаза 2 · Слухання</b><span>Аудіо/відео загалом до 6 хв. Слухати можна скільки завгодно разів, зупиняти, перемотувати.</span></div>
        <div class="phase time">Фази 1–2 разом: <b>1 год 30 хв</b> (≈50 хв читання, потім слухання, 10–15 хв на підготовку до розмови)</div>
        <div class="phase"><b>Фаза 3 · Ви пропонуєте</b><span>Ви самі телефонуєте співрозмовнику (телефоном або по відеозв'язку), представляєтеся і пояснюєте своє рішення.</span></div>
        <div class="phase"><b>Фаза 4 · Обговорення</b><span>Співрозмовник повідомляє нову інформацію, яка може суперечити вашій пропозиції. Ставте запитання, наводьте контраргументи.</span></div>
        <div class="phase time">Фази 3–4: <b>до 20 хв</b></div>
        <div class="phase"><b>Фаза 5 · Письмо</b><span>Лист, e-mail, звіт чи записка з урахуванням усього, що ви дізналися, зокрема в розмові.</span></div>
        <div class="phase time">Фаза 5: <b>40 хв</b></div>
      </div>
      <p class="small muted" style="margin-top:10px">У DCL FP (A1–A2) ті самі етапи, але простіші завдання і загалом 1 год 30 хв.</p>
    </section>

    <section class="card section stack">
      <h2>Як оцінюють</h2>
      <p>Оцінювання <b>позитивне</b>: журі дивиться, що вам вдалося, за критеріями прагматичними (чи виконано завдання, чи доречна мова для ситуації), соціолінгвістичними і власне мовними (граматика, лексика, вимова). Екзаменатор заповнює таблицю критеріїв для усної та письмової частин. Результати — орієнтовно через місяць.</p>
    </section>

    <section class="card section">
      <h2>DCL чи DELF?</h2>
      <div class="cmp">
        <div></div><b>DCL</b><b>DELF</b>
        <span>Рівень</span><span>один іспит для всіх, рівень визначається результатом</span><span>окремий іспит для кожного рівня, обираєте заздалегідь</span>
        <span>Формат</span><span>одна пов'язана місія: читання → слухання → дзвінок → письмо</span><span>чотири окремі частини, кожна оцінюється окремо</span>
        <span>Теми</span><span>робота і практичні ситуації</span><span>загальні теми повсякденного життя</span>
        <span>Хто видає</span><span>Міністерство освіти Франції</span><span>France Éducation international</span>
        <span>Ризик</span><span>немає «провалу»: отримуєте той рівень, який показали</span><span>якщо не набрали прохідного бала — диплома немає</span>
      </div>
    </section>

    <section class="card section stack">
      <h2>Як тренуватися тут</h2>
      <ul class="list">
        <li><b>Сценарії</b> — кожен проходите по частинах із підказками й зразками відповідей.</li>
        <li><b>Пробний іспит</b> — той самий формат із таймером і без підказок, потім оцінка за частинами і приблизний рівень.</li>
        <li><b>Фрази</b> і <b>граматика</b> — короткі щоденні тренажери.</li>
      </ul>
      <p class="small muted">Дати сесій, вартість і умови перевіряйте на офіційному сайті перед реєстрацією.</p>
      <p class="small"><a href="https://www.education.gouv.fr/le-diplome-de-competence-en-langue-dcl-candidats-l-examen-11624" target="_blank" rel="noopener">education.gouv.fr — DCL для кандидатів ↗</a><br>
      <a href="https://cache.media.education.gouv.fr/file/Formation_tout_au_long_de_la_vie/59/9/CD-MO-conseils-reussir-DCL-hors-LSf-fP-A-100119_1060599.pdf" target="_blank" rel="noopener">Офіційні поради «Nos conseils pour réussir le DCL» (PDF) ↗</a></p>
    </section>`;
}

/* ---------- Тренування на сьогодні ---------- */

function todayPlan() {
  const d = dclState();
  const t = todayStr();
  if (d.today && d.today.date === t && getScen(d.today.scen)) return d.today;
  let pool = DCL.scenarios.filter((s) => s.level === d.target);
  if (!pool.length) pool = DCL.scenarios;
  const dayNum = Math.floor(Date.now() / 864e5);
  const skills = Object.keys(SKILLS);
  const avg = skillAverages();
  let skill = skills[dayNum % skills.length];
  if (skills.every((k) => avg[k] != null)) skill = skills.slice().sort((a, b) => avg[a] - avg[b])[0]; // найслабше вміння
  const val = (s) => { const S = d.scen[s.id]; return S && S.parts && S.parts[skill] != null ? S.parts[skill] : -1; };
  const scen = pool.slice().sort((a, b) => val(a) - val(b))[0];
  const lvls = DCL_LEVELS.slice(0, DCL_LEVELS.indexOf(d.target) + 1);
  const ph = DCL.phrases.phrases.filter((p) => lvls.includes(p.level));
  const start = ph.length ? (dayNum * 8) % ph.length : 0;
  const picks = Array.from({ length: Math.min(8, ph.length) }, (_, i) => ph[(start + i) % ph.length].id);
  d.today = { date: t, scen: scen.id, part: skill, phrases: picks, partDone: false, phrasesDone: false, counted: false };
  save();
  return d.today;
}
function checkTodayDone() {
  const t = dclState().today;
  if (t && t.date === todayStr() && t.partDone && t.phrasesDone && !t.counted) {
    t.counted = true;
    save();
    setTimeout(() => toast('🎯 Тренування DCL на сьогодні виконано!'), 300);
  }
}

// Картка «Тренування DCL на сьогодні» (головна бібліотеки і головна DCL)
function dclTodayCardHtml(inHub) {
  const t = state.dcl && state.dcl.today;
  const done = t && t.date === todayStr() && t.counted;
  const scen = DCL && t && t.date === todayStr() ? getScen(t.scen) : null;
  return `
    <a class="card today-dcl ${inHub ? 'section' : ''}" href="#/dcl/today">
      <span class="big-ico">${done ? '✅' : '🎯'}</span>
      <div class="grow">
        <b>Тренування DCL на сьогодні</b>
        <div class="small muted">${done ? 'Виконано — чудово! Можна взяти ще сценарій.' : scen ? `${SKILLS[t.part].icon} ${SKILLS[t.part].label}: ${esc(scen.title)} + 8 фраз` : '15–20 хв: одна частина сценарію + фрази'}</div>
      </div>
      <span aria-hidden="true">→</span>
    </a>`;
}
window.dclHomeCard = () => dclTodayCardHtml(false);

function viewDclToday() {
  document.title = 'DCL сьогодні — Écoute';
  const p = todayPlan();
  const scen = getScen(p.scen);
  app.innerHTML = `
    <a class="back" href="#/dcl">← DCL</a>
    <h1>Тренування на сьогодні</h1>
    <p class="muted" style="margin-top:4px">≈ 15–20 хвилин · рівень ${esc(dclState().target)}</p>

    <section class="card section">
      <div class="section-title"><span class="step">${p.partDone ? '✓' : '1'}</span><h2>${SKILLS[p.part].icon} ${SKILLS[p.part].label} · 10–12 хв</h2></div>
      <p><b>${esc(scen.title)}</b> <span class="muted">— ${esc(scen.titleUk || '')}</span></p>
      <div class="meta">${lvlTag(scen.level)}${topicTag(scen.topic)}</div>
      <p class="small muted" style="margin-top:8px">${p.part === 'lecture' || p.part === 'ecoute' ? 'Спершу коротко прочитайте місію, потім виконайте частину і дайте відповіді на питання.' : 'Прочитайте місію і документи (швидко), потім виконайте частину.'}</p>
      <div class="row" style="margin-top:10px">
        <a class="btn ${p.partDone ? '' : 'primary'} grow" href="#/dcl/s/${esc(scen.id)}/${p.part}">${p.partDone ? 'Повторити' : 'Почати'} →</a>
        <a class="btn" href="#/dcl/s/${esc(scen.id)}/mission">Місія</a>
      </div>
    </section>

    <section class="card section">
      <div class="section-title"><span class="step">${p.phrasesDone ? '✓' : '2'}</span><h2>💬 8 фраз · 5 хв</h2></div>
      <p class="small muted">Бачите переклад — згадайте фразу французькою, переверніть картку і промовте її вголос.</p>
      <div id="drill" style="margin-top:10px"></div>
    </section>

    ${p.counted ? '<div class="card section center"><b>✅ На сьогодні все!</b><p class="small muted">Серія днів враховує і тренування DCL.</p></div>' : ''}`;
  startDrill(p.phrases, 'today');
}

/* --- Тренажер фраз (картки) --- */

let drill = null;
function startDrill(ids, from) { drill = { ids, i: 0, flipped: false, from }; renderDrill(); }
function renderDrill() {
  const box = $('#drill');
  if (!box || !drill) return;
  const all = DCL.phrases.phrases;
  if (drill.i >= drill.ids.length) {
    box.innerHTML = `<div class="center stack"><b>Готово! ${drill.ids.length} ${plural(drill.ids.length, 'фраза', 'фрази', 'фраз')}.</b>
      <button class="btn" type="button" data-act="ddrillagain">🔁 Ще раз</button></div>`;
    if (drill.from === 'today') {
      const t = dclState().today;
      if (t && !t.phrasesDone) {
        t.phrasesDone = true;
        const day = dayOf(); day.dcl = (day.dcl || 0) + 1;
        save();
        checkTodayDone();
      }
    }
    return;
  }
  const ph = all.find((p) => p.id === drill.ids[drill.i]);
  box.innerHTML = `
    <div class="row small muted"><span class="grow">${DCL.phrases.categories[ph.cat] || ''} · ${ph.channel === 'tel' ? '📞 телефон' : ph.channel === 'ecrit' ? '✉️ лист' : '📞✉️'}</span><span>${drill.i + 1} / ${drill.ids.length}</span></div>
    <div class="flash small-flash" data-act="dflip" role="button" tabindex="0">
      <div class="backside" style="color:var(--text)">${esc(ph.uk)}</div>
      ${drill.flipped ? `<div class="front" lang="fr">${esc(ph.fr)}</div>` : '<div class="small muted">Згадайте французькою і торкніться</div>'}
    </div>
    <div class="row" style="margin-top:10px">
      ${drill.flipped ? `<button class="btn" type="button" data-act="dsay" data-text="${esc(ph.fr)}">🔊 Ще раз</button>` : ''}
      <button class="btn primary grow" type="button" data-act="${drill.flipped ? 'ddrillnext' : 'dflip'}">${drill.flipped ? 'Далі →' : 'Показати'}</button>
    </div>`;
}
actions.dflip = () => {
  if (!drill) return;
  drill.flipped = true;
  renderDrill();
  const ph = DCL.phrases.phrases.find((p) => p.id === drill.ids[drill.i]);
  speak(ph.fr);
};
actions.ddrillnext = () => { drill.i++; drill.flipped = false; renderDrill(); };
actions.ddrillagain = () => { drill.i = 0; drill.flipped = false; drill.ids = shuffle(drill.ids); renderDrill(); };

/* ---------- Сценарій у режимі тренування ---------- */

const oralIdx = {}; // на якій репліці користувач у кожному сценарії

function stepDone(s, step) {
  const S = dclState().scen[s.id];
  if (!S) return false;
  if (SKILLS[step]) return S.parts[step] != null;
  if (step === 'videos') return !!S.done;
  return false;
}

function viewScenario(id, step) {
  const s = getScen(id);
  if (!s) {
    app.innerHTML = '<a class="back" href="#/dcl">← DCL</a><div class="card"><h2>Сценарій не знайдено</h2><p class="muted">Перевірте назву файлу в dcl/index.json.</p></div>';
    return;
  }
  if (!STEPS.some(([k]) => k === step)) step = 'mission';
  document.title = s.title + ' — DCL';
  const S = scenState(s.id);
  const nextStep = (cur) => { const i = STEPS.findIndex(([k]) => k === cur); return STEPS[i + 1]; };
  const nx = nextStep(step);
  const nextBtn = nx ? `<a class="btn primary big block" href="#/dcl/s/${esc(s.id)}/${nx[0]}" style="margin-top:16px">Далі: ${nx[1]} →</a>` : '';

  let body = '';
  if (step === 'mission') {
    body = `
      <section class="card section stack">
        <p><b>Хто ви:</b> <span lang="fr">${esc(s.role)}</span></p>
        <p><b>Співрозмовник:</b> <span lang="fr">${esc(s.interlocutor || '')}</span></p>
        <div class="mission" lang="fr">${esc(s.mission)}</div>
        <details><summary class="small muted">Переклад завдання</summary><p style="margin-top:8px">${esc(s.missionUk || '')}</p></details>
        <button class="btn sm" type="button" data-act="dsay" data-text="${esc(s.mission)}">🔊 Прослухати місію</button>
      </section>
      ${(s.vocab || []).length ? `<section class="card section"><h2>Корисні слова</h2>${vocabHtml(s.vocab)}</section>` : ''}
      <p class="tip">💡 На іспиті спершу з'ясуйте: хто я, яка моя місія, з ким я говоритиму і кому писатиму.</p>`;
  } else if (step === 'lecture' || step === 'ecoute') {
    body = `
      <details class="card section"><summary><b>Місія</b> <span class="small muted">(нагадування)</span></summary><p lang="fr" style="margin-top:8px">${esc(s.mission)}</p></details>
      <section class="section stack">${step === 'lecture' ? (s.documents || []).map(docHtml).join('') : audioHtml(s, true)}</section>
      <section class="card section">
        <h2>Питання</h2>
        <div id="qbox">${practiceQuestionsHtml(s, step)}</div>
      </section>`;
  } else if (step === 'oral') {
    body = `<section class="card section stack">
        <p>${esc(s.oral.intro || '')}</p>
        <p class="small"><b>Співрозмовник:</b> <span lang="fr">${esc(s.interlocutor || '')}</span></p>
      </section>
      <div id="oralbox">${practiceOralHtml(s)}</div>`;
  } else if (step === 'ecrit') {
    body = practiceWritingHtml(s);
  } else if (step === 'videos') {
    body = relatedVideosHtml(s);
  }

  app.innerHTML = `
    <a class="back" href="#/dcl">← DCL</a>
    <h1>${esc(s.title)}</h1>
    <div class="small muted">${esc(s.titleUk || '')}</div>
    <div class="meta">${lvlTag(s.level)}${topicTag(s.topic)}${S.done ? '<span class="tag good">✓ пройдено</span>' : ''}</div>
    <nav class="chips steps" style="margin-top:12px">
      ${STEPS.map(([k, l]) => `<a class="chip ${k === step ? 'on' : ''}" href="#/dcl/s/${esc(s.id)}/${k}">${stepDone(s, k) ? '✓ ' : ''}${l}</a>`).join('')}
    </nav>
    ${body}
    ${step !== 'oral' && step !== 'videos' ? nextBtn : ''}`;
  if (step === 'ecrit') updateWordCounter(s);
}

/* --- Питання (тренування: одразу показуємо правильну відповідь) --- */

function partQuestions(s, part) { return (s.questions || []).map((q, i) => ({ q, i })).filter((x) => (x.q.part || 'lecture') === part); }

function practiceQuestionsHtml(s, part) {
  const S = scenState(s.id);
  const qs = partQuestions(s, part);
  if (!qs.length) return '<p class="muted">Для цієї частини немає питань.</p>';
  const answered = qs.filter(({ i }) => S.answers[i] !== undefined);
  const right = answered.filter(({ q, i }) => isRight(q, S.answers[i])).length;
  return qs.map(({ q, i }, n) => {
    const a = S.answers[i];
    const done = a !== undefined;
    if (q.options) {
      return `<div class="quiz-q"><p>${n + 1}. ${esc(q.q)}</p>
        ${q.options.map((o, oi) => {
          let cls = '';
          if (done && oi === q.answer) cls = 'right'; else if (done && oi === Number(a)) cls = 'wrong';
          return `<button type="button" class="opt ${cls}" data-act="dans" data-id="${esc(s.id)}" data-q="${i}" data-o="${oi}" data-part="${part}" ${done ? 'disabled' : ''}>${esc(o)}</button>`;
        }).join('')}</div>`;
    }
    const ok = done && isRight(q, a);
    return `<div class="quiz-q"><p>${n + 1}. ${esc(q.q)}</p>
      <div class="row"><input class="input grow" data-qin="${i}" lang="fr" autocomplete="off" value="${esc(done ? a : '')}" ${done ? 'disabled' : ''}>
      ${done ? '' : `<button class="btn" type="button" data-act="dansin" data-id="${esc(s.id)}" data-q="${i}" data-part="${part}">OK</button>`}</div>
      ${done ? `<p class="small ${ok ? 'ok-text' : 'bad-text'}" style="margin-top:6px">${ok ? '✓ Правильно' : '✗ Правильна відповідь: ' + esc(q.accept[0])}</p>` : ''}</div>`;
  }).join('') + (answered.length ? `
    <div class="row" style="margin-top:16px"><b class="grow">Правильно: ${right} з ${qs.length}</b>
      ${answered.length === qs.length ? `<button class="btn sm" type="button" data-act="dqreset" data-id="${esc(s.id)}" data-part="${part}">Ще раз</button>` : ''}</div>` : '');
}

function afterPracticeAnswer(s, part) {
  const S = scenState(s.id);
  const qs = partQuestions(s, part);
  if (qs.every(({ i }) => S.answers[i] !== undefined)) {
    const right = qs.filter(({ q, i }) => isRight(q, S.answers[i])).length;
    markPart(s.id, part, (right / qs.length) * 100);
  } else save();
  $('#qbox').innerHTML = practiceQuestionsHtml(s, part);
}
actions.dans = (el) => {
  const s = getScen(el.dataset.id);
  scenState(s.id).answers[el.dataset.q] = Number(el.dataset.o);
  afterPracticeAnswer(s, el.dataset.part);
};
actions.dansin = (el) => {
  const s = getScen(el.dataset.id);
  const v = $(`[data-qin="${el.dataset.q}"]`).value.trim();
  if (!v) { toast('Впишіть відповідь'); return; }
  scenState(s.id).answers[el.dataset.q] = v;
  afterPracticeAnswer(s, el.dataset.part);
};
actions.dqreset = (el) => {
  const s = getScen(el.dataset.id);
  const S = scenState(s.id);
  partQuestions(s, el.dataset.part).forEach(({ i }) => { delete S.answers[i]; });
  save();
  $('#qbox').innerHTML = practiceQuestionsHtml(s, el.dataset.part);
};

/* --- Розмова (тренування) --- */

function practiceOralHtml(s) {
  const S = scenState(s.id);
  const turns = s.oral.turns || [];
  const cur = Math.min(oralIdx[s.id] || 0, turns.length);
  let html = '';
  turns.slice(0, cur).forEach((t, i) => {
    const checks = S.oral[i] || [];
    html += `<div class="turn done-turn"><span class="small muted">Репліка ${i + 1}</span>
      <div lang="fr">🗨️ ${esc(t.examiner)}</div><div lang="fr" class="small">✅ ${esc(t.model)}</div>
      <div class="small muted">Самоперевірка: ${checks.filter(Boolean).length} / ${(t.check || []).length}</div></div>`;
  });
  if (cur < turns.length) {
    const t = turns[cur];
    const key = `p:${s.id}:${cur}`;
    const rec = dRecs[key];
    const shown = rec || (S.oralShown && S.oralShown[cur]);
    const checks = S.oral[cur] || [];
    html += `<section class="card section turn-now">
      <div class="row"><span class="tag lvl">Репліка ${cur + 1} / ${turns.length}</span></div>
      <button class="btn primary block" type="button" data-act="dsayturn" data-id="${esc(s.id)}" style="margin-top:10px">🔊 Послухати співрозмовника</button>
      <details style="margin-top:8px"><summary class="small muted">Текст репліки</summary><p lang="fr" style="margin-top:6px">${esc(t.examiner)}</p></details>
      <p class="tip">💡 ${esc(t.task || '')}</p>
      <div class="row" style="margin-top:10px">
        <button class="btn rec" type="button" data-act="drec" data-key="${key}" data-id="${esc(s.id)}">${rec ? '🎙 Записати ще раз' : '🎙 Відповісти голосом'}</button>
        ${shown ? '' : `<button class="btn" type="button" data-act="dshowmodel" data-id="${esc(s.id)}">Показати зразок</button>`}
      </div>
      ${rec ? `<audio controls src="${rec}" style="width:100%;margin-top:10px"></audio>` : ''}
      ${shown ? `
        <div class="model"><div class="small muted">Приклад хорошої відповіді:</div><p lang="fr">${esc(t.model)}</p>
          <button class="btn sm" type="button" data-act="dsay" data-text="${esc(t.model)}">🔊 Послухати зразок</button></div>
        <div class="checks"><div class="small muted">Порівняйте себе зі зразком — що вийшло?</div>
          ${(t.check || []).map((c, ci) => `<label class="check"><input type="checkbox" data-act="doralcheck" data-id="${esc(s.id)}" data-t="${cur}" data-c="${ci}" ${checks[ci] ? 'checked' : ''}> ${esc(c)}</label>`).join('')}
        </div>
        <button class="btn good block" type="button" data-act="dnextturn" data-id="${esc(s.id)}" style="margin-top:12px">${cur + 1 < turns.length ? 'Наступна репліка →' : 'Завершити розмову ✓'}</button>` : ''}
    </section>`;
  } else {
    const total = turns.reduce((n, t) => n + (t.check || []).length, 0);
    const got = turns.reduce((n, t, i) => n + (S.oral[i] || []).filter(Boolean).length, 0);
    html += `<section class="card section center stack">
      <b>Розмову завершено: ${got} з ${total} пунктів (${total ? Math.round(got / total * 100) : 0}%)</b>
      <div class="row" style="justify-content:center">
        <button class="btn" type="button" data-act="doralrestart" data-id="${esc(s.id)}">🔁 Пройти ще раз</button>
        <a class="btn primary" href="#/dcl/s/${esc(s.id)}/ecrit">Далі: Письмо →</a>
      </div></section>`;
  }
  return html;
}
const rerenderOral = (s) => { const b = $('#oralbox'); if (b) b.innerHTML = practiceOralHtml(s); };
actions.dsayturn = (el) => {
  const s = getScen(el.dataset.id);
  const t = s.oral.turns[Math.min(oralIdx[s.id] || 0, s.oral.turns.length - 1)];
  speak(t.examiner, { voice: t.voice || (s.audio && s.audio[0] && s.audio[0].voice) || 'f' });
};
actions.drec = (el) => {
  const s = getScen(el.dataset.id);
  dRecToggle(el, (url) => {
    if (dRecs[el.dataset.key]) URL.revokeObjectURL(dRecs[el.dataset.key]);
    dRecs[el.dataset.key] = url;
    rerenderOral(s);
  });
};
actions.dshowmodel = (el) => {
  const s = getScen(el.dataset.id);
  const S = scenState(s.id);
  (S.oralShown ||= {})[oralIdx[s.id] || 0] = true;
  rerenderOral(s);
};
actions.doralcheck = (el) => {
  const S = scenState(el.dataset.id);
  const arr = (S.oral[el.dataset.t] ||= []);
  arr[Number(el.dataset.c)] = el.checked;
  save();
};
actions.dnextturn = (el) => {
  const s = getScen(el.dataset.id);
  const S = scenState(s.id);
  const turns = s.oral.turns;
  oralIdx[s.id] = (oralIdx[s.id] || 0) + 1;
  if (oralIdx[s.id] >= turns.length) {
    const total = turns.reduce((n, t) => n + (t.check || []).length, 0);
    const got = turns.reduce((n, t, i) => n + (S.oral[i] || []).filter(Boolean).length, 0);
    markPart(s.id, 'oral', total ? (got / total) * 100 : 0);
    S.oralShown = {};
  } else {
    save();
    const t = turns[oralIdx[s.id]];
    speak(t.examiner, { voice: t.voice || 'f' }); // наступну репліку озвучуємо одразу
  }
  rerenderOral(s);
};
actions.doralrestart = (el) => {
  const s = getScen(el.dataset.id);
  oralIdx[s.id] = 0;
  scenState(s.id).oral = {};
  scenState(s.id).oralShown = {};
  save();
  rerenderOral(s);
};

/* --- Письмо (тренування) --- */

function practiceWritingHtml(s) {
  const w = s.writing;
  const S = scenState(s.id);
  return `
    <section class="card section stack">
      <h2>Завдання</h2>
      <p lang="fr" class="mission">${esc(w.task)}</p>
      <details><summary class="small muted">Переклад завдання</summary><p style="margin-top:6px">${esc(w.taskUk || '')}</p></details>
      <p class="small muted">Формат: <b>${esc({ email: 'e-mail', lettre: 'лист', sms: 'SMS', note: 'записка', article: 'стаття' }[w.format] || w.format)}</b> · ${w.minWords}–${w.maxWords} слів</p>
    </section>
    <section class="card section">
      <textarea class="input write" id="dwrite" data-input="dwrite" data-id="${esc(s.id)}" lang="fr" spellcheck="false" placeholder="Écrivez ici…">${esc(S.writing || '')}</textarea>
      <div class="row small" style="margin-top:6px"><span id="wc" class="wc grow"></span><span class="muted">зберігається автоматично</span></div>
      <button class="btn primary block" type="button" data-act="dwcheckshow" data-id="${esc(s.id)}" style="margin-top:10px">Перевірити і показати зразок</button>
    </section>
    <div id="wfeedback">${S.wshown ? writingFeedbackHtml(s, S.writing, S.wchecks, 'dwcheck') : ''}</div>`;
}
function writingFeedbackHtml(s, text, checks, act) {
  const w = s.writing;
  const auto = writingAutoChecks(w, text);
  const score = writingScore(w, text, checks);
  return `
    <section class="card section stack">
      <h2>Автоперевірка</h2>
      ${auto.map((a) => `<div class="${a.ok ? 'ok-text' : 'bad-text'}">${a.ok ? '✓' : '✗'} ${esc(a.label)}</div>`).join('')}
    </section>
    <section class="card section stack">
      <h2>Зразкова відповідь</h2>
      <div class="doc-text model-text" lang="fr">${esc(w.model)}</div>
      <button class="btn sm" type="button" data-act="dsay" data-text="${esc(w.model)}">🔊 Прослухати</button>
    </section>
    <section class="card section">
      <h2>Чекліст самоперевірки</h2>
      <p class="small muted">Порівняйте свій текст зі зразком і позначте, що є у вас.</p>
      <div class="checks">${(w.checklist || []).map((c, ci) => `<label class="check"><input type="checkbox" data-act="${act}" data-id="${esc(s.id)}" data-c="${ci}" ${checks && checks[ci] ? 'checked' : ''}> ${esc(c)}</label>`).join('')}</div>
      <p style="margin-top:12px"><b>Оцінка письма: <span id="wscore">${score}</span>%</b></p>
    </section>`;
}
function updateWordCounter(s, text) {
  const el = $('#wc');
  if (!el) return;
  const n = wordCount(text ?? ($('#dwrite') || {}).value);
  const w = s.writing;
  el.textContent = `${n} ${plural(n, 'слово', 'слова', 'слів')} · потрібно ${w.minWords}–${w.maxWords}`;
  el.className = 'wc grow ' + (n < w.minWords ? 'bad-text' : n > w.maxWords * 1.25 ? 'bad-text' : 'ok-text');
}
inputs.dwrite = (el) => {
  const s = getScen(el.dataset.id);
  scenState(s.id).writing = el.value;
  updateWordCounter(s, el.value);
  save();
};
actions.dwcheckshow = (el) => {
  const s = getScen(el.dataset.id);
  const S = scenState(s.id);
  if (wordCount(S.writing) < 5) { toast('Спершу напишіть текст'); return; }
  S.wshown = true;
  $('#wfeedback').innerHTML = writingFeedbackHtml(s, S.writing, S.wchecks, 'dwcheck');
  markPart(s.id, 'ecrit', writingScore(s.writing, S.writing, S.wchecks));
  $('#wfeedback').scrollIntoView({ behavior: 'smooth', block: 'start' });
};
actions.dwcheck = (el) => {
  const s = getScen(el.dataset.id);
  const S = scenState(s.id);
  S.wchecks[Number(el.dataset.c)] = el.checked;
  const score = writingScore(s.writing, S.writing, S.wchecks);
  S.parts.ecrit = score; // оцінка письма змінюється разом із чеклістом
  $('#wscore').textContent = score;
  save();
};

/* --- Відео на ту саму тему --- */

function relatedFor(s, n = 2) {
  const out = [];
  (s.relatedVideos || []).forEach((id) => { const v = getVideo(id); if (v && !out.includes(v)) out.push(v); });
  if (out.length < n) {
    const rank = (v) => (v.dclTopic === s.topic ? 0 : 2) + (v.dcl === s.level ? 0 : 1);
    allVideos().filter((v) => !out.includes(v) && v.dcl).sort((a, b) => rank(a) - rank(b)).slice(0, n - out.length).forEach((v) => out.push(v));
  }
  return out.slice(0, Math.max(n, (s.relatedVideos || []).length));
}
function relatedVideosHtml(s) {
  const S = scenState(s.id);
  const vids = relatedFor(s);
  return `
    <section class="card section stack">
      <h2>Підсумок сценарію</h2>
      <div class="meta">${Object.entries(SKILLS).map(([k, x]) => `<span class="tag ${S.parts[k] != null ? 'good' : ''}">${x.icon} ${x.label}: ${S.parts[k] != null ? S.parts[k] + '%' : '—'}</span>`).join('')}</div>
      <button class="btn good big block" type="button" data-act="dscendone" data-id="${esc(s.id)}">${S.done ? '✓ Сценарій пройдено' : '✓ Позначити сценарій пройденим'}</button>
    </section>
    <section class="section">
      <h2>Відео на ту саму тему</h2>
      <p class="small muted" style="margin:4px 0 10px">Закріпіть лексику на слух — ${esc((DCL_TOPICS[s.topic] || DCL_TOPICS.societe).label.toLowerCase())}.</p>
      <div class="vlist">${vids.map(videoCard).join('') || '<p class="muted">Немає відео з цією темою.</p>'}</div>
    </section>`;
}
actions.dscendone = (el) => {
  const S = scenState(el.dataset.id);
  if (!S.done) { const day = dayOf(); day.dcl = (day.dcl || 0) + 1; }
  S.done = true;
  S.doneAt = Date.now();
  save();
  toast('Сценарій зараховано ✓');
  viewScenario(el.dataset.id, 'videos');
};

/* ---------- Фрази ---------- */

function viewDclPhrases() {
  document.title = 'Фрази DCL — Écoute';
  const d = dclState();
  const lvl = d.phLevel || 'all';
  const ch = d.phChannel || 'all';
  const list = DCL.phrases.phrases.filter((p) => (lvl === 'all' || p.level === lvl) && (ch === 'all' || p.channel === ch || p.channel === 'both'));
  const cats = DCL.phrases.categories;
  app.innerHTML = `
    <a class="back" href="#/dcl">← DCL</a>
    <h1>Фрази для дзвінків і листів</h1>
    <div class="filter-row filters">
      <div class="seg" role="group">${[['all', 'Усі'], ...DCL_LEVELS.map((l) => [l, l])].map(([k, l]) => `<button type="button" data-act="dphf" data-k="phLevel" data-v="${k}" class="${lvl === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="seg" role="group">${[['all', 'Усе'], ['tel', '📞 Телефон'], ['ecrit', '✉️ Лист']].map(([k, l]) => `<button type="button" data-act="dphf" data-k="phChannel" data-v="${k}" class="${ch === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    <button class="btn primary big block" type="button" data-act="dphdrill" style="margin-top:14px">🃏 Тренувати ці фрази (${list.length})</button>
    <div id="drill" class="card section ${drill && drill.from === 'phrases' ? '' : 'hidden'}"></div>
    ${Object.entries(cats).map(([k, label]) => {
      const items = list.filter((p) => p.cat === k);
      if (!items.length) return '';
      return `<section class="card section"><h2>${esc(label)}</h2><div class="wlist">
        ${items.map((p) => `<div class="wrow">
          <div class="grow"><div lang="fr"><b>${esc(p.fr)}</b></div><div class="small muted">${esc(p.uk)}</div></div>
          <span class="tag">${p.level}</span>
          <button class="mini" type="button" data-act="dsay" data-text="${esc(p.fr)}" aria-label="Вимова">🔊</button>
          <button class="mini ${hasWord(p.fr) ? 'added' : ''}" type="button" data-act="daddword" data-fr="${esc(p.fr)}" data-uk="${esc(p.uk)}" aria-label="У словник">${hasWord(p.fr) ? '✓' : '＋'}</button>
        </div>`).join('')}</div></section>`;
    }).join('')}`;
  if (drill && drill.from === 'phrases') renderDrill();
}
actions.dphf = (el) => { dclState()[el.dataset.k] = el.dataset.v; save(); drill = null; viewDclPhrases(); };
actions.dphdrill = () => {
  const d = dclState();
  const lvl = d.phLevel || 'all';
  const ch = d.phChannel || 'all';
  const ids = DCL.phrases.phrases.filter((p) => (lvl === 'all' || p.level === lvl) && (ch === 'all' || p.channel === ch || p.channel === 'both')).map((p) => p.id);
  startDrill(shuffle(ids), 'phrases');
  $('#drill').classList.remove('hidden');
  $('#drill').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

/* ---------- Граматика ---------- */

const gAns = {}; // відповіді у вправах: {topicId: {i: value}}

function viewGrammarList() {
  document.title = 'Граматика — Écoute';
  const res = dclState().grammar;
  app.innerHTML = `
    <a class="back" href="#/dcl">← DCL</a>
    <h1>Граматика A1–B1</h1>
    <p class="muted" style="margin-top:4px">Коротке правило, приклади з ситуацій DCL і 7 вправ на кожну тему.</p>
    <div class="vlist">${DCL.grammar.topics.map((t) => `
      <a class="card scen" href="#/dcl/grammar/${esc(t.id)}">
        <div class="row"><b class="grow" lang="fr">${esc(t.title)}</b>${lvlTag(t.level)}</div>
        <div class="small muted">${esc(t.titleUk)}</div>
        ${res[t.id] ? `<div class="meta"><span class="tag good">найкраще: ${res[t.id].best}%</span></div>` : ''}
      </a>`).join('')}</div>`;
}

function viewGrammarTopic(id) {
  const t = DCL.grammar.topics.find((x) => x.id === id);
  if (!t) { viewGrammarList(); return; }
  document.title = t.title + ' — Écoute';
  app.innerHTML = `
    <a class="back" href="#/dcl/grammar">← Граматика</a>
    <h1 lang="fr">${esc(t.title)}</h1>
    <div class="small muted">${esc(t.titleUk)}</div>
    <div class="meta">${lvlTag(t.level)}</div>
    <section class="card section stack">${t.rule.map((p) => `<p>${esc(p)}</p>`).join('')}</section>
    ${(t.table || []).length ? `<section class="card section"><h2>Форми</h2><div class="gtable">${t.table.map(([a, b]) => `<b lang="fr">${esc(a)}</b><span lang="fr">${esc(b)}</span>`).join('')}</div></section>` : ''}
    <section class="card section"><h2>Приклади</h2><div class="kw">${(t.examples || []).map((e) => `
      <div class="kw-row"><div class="grow"><div class="kw-fr" lang="fr">${esc(e.fr)}</div><div class="kw-uk">${esc(e.uk)}</div></div>
      <button class="mini" type="button" data-act="dsay" data-text="${esc(e.fr)}" aria-label="Вимова">🔊</button></div>`).join('')}</div></section>
    <section class="card section"><h2>Вправи</h2><div id="gbox">${grammarExHtml(t)}</div></section>`;
}
function grammarExHtml(t) {
  const A = (gAns[t.id] ||= {});
  const ex = t.exercises;
  const answered = ex.filter((_, i) => A[i] !== undefined).length;
  const right = ex.filter((q, i) => A[i] !== undefined && isRight(q, A[i])).length;
  return ex.map((q, i) => {
    const a = A[i];
    const done = a !== undefined;
    const ok = done && isRight(q, a);
    const qText = esc(q.q).replace(/___/g, '<span class="blank">___</span>');
    const body = q.options
      ? q.options.map((o, oi) => {
        let cls = '';
        if (done && oi === q.answer) cls = 'right'; else if (done && oi === Number(a)) cls = 'wrong';
        return `<button type="button" class="opt ${cls}" data-act="gans" data-t="${esc(t.id)}" data-q="${i}" data-o="${oi}" ${done ? 'disabled' : ''} lang="fr">${esc(o)}</button>`;
      }).join('')
      : `<div class="row"><input class="input grow" data-gin="${i}" lang="fr" autocomplete="off" autocapitalize="off" value="${esc(done ? a : '')}" ${done ? 'disabled' : ''}>
         ${done ? '' : `<button class="btn" type="button" data-act="gansin" data-t="${esc(t.id)}" data-q="${i}">OK</button>`}</div>`;
    const fb = done ? `<p class="small ${ok ? 'ok-text' : 'bad-text'}" style="margin-top:6px">${ok ? '✓ Правильно' : '✗ Правильно: ' + esc(q.options ? q.options[q.answer] : q.accept[0])}${q.explain ? ' — ' + esc(q.explain) : ''}</p>` : '';
    return `<div class="quiz-q"><p lang="fr">${i + 1}. ${qText}</p>${body}${fb}</div>`;
  }).join('') + (answered === ex.length ? `
    <div class="row" style="margin-top:16px"><b class="grow">Результат: ${right} з ${ex.length}</b>
      <button class="btn sm" type="button" data-act="greset" data-t="${esc(t.id)}">Ще раз</button></div>` : '');
}
function afterGrammar(t) {
  const A = gAns[t.id];
  if (t.exercises.every((_, i) => A[i] !== undefined)) {
    const pct = Math.round(t.exercises.filter((q, i) => isRight(q, A[i])).length / t.exercises.length * 100);
    const r = (dclState().grammar[t.id] ||= { best: 0 });
    r.best = Math.max(r.best, pct); r.last = pct; r.at = Date.now();
    const day = dayOf(); day.dcl = (day.dcl || 0) + 1;
    save();
  }
  $('#gbox').innerHTML = grammarExHtml(t);
}
actions.gans = (el) => {
  const t = DCL.grammar.topics.find((x) => x.id === el.dataset.t);
  (gAns[t.id] ||= {})[el.dataset.q] = Number(el.dataset.o);
  afterGrammar(t);
};
actions.gansin = (el) => {
  const t = DCL.grammar.topics.find((x) => x.id === el.dataset.t);
  const v = $(`[data-gin="${el.dataset.q}"]`).value.trim();
  if (!v) { toast('Впишіть відповідь'); return; }
  (gAns[t.id] ||= {})[el.dataset.q] = v;
  afterGrammar(t);
};
actions.greset = (el) => {
  const t = DCL.grammar.topics.find((x) => x.id === el.dataset.t);
  gAns[t.id] = {};
  $('#gbox').innerHTML = grammarExHtml(t);
};

/* ---------- Пробний іспит ---------- */

let examRun = null;   // поточний іспит (лише в пам'яті — не оновлюйте сторінку під час іспиту)
let examTimer = null;
let examPick = null;

function viewExamStart() {
  document.title = 'Пробний іспит — DCL';
  const d = dclState();
  if (examRun && examRun.phase !== 'result') { location.hash = '#/dcl/exam/run'; return; }
  const usedInExam = new Set(d.exams.map((e) => e.scen));
  if (!examPick || !getScen(examPick)) {
    const pool = DCL.scenarios.filter((s) => s.level === d.target);
    examPick = (pool.find((s) => !usedInExam.has(s.id) && !(d.scen[s.id] && d.scen[s.id].done)) || pool.find((s) => !usedInExam.has(s.id)) || pool[0] || DCL.scenarios[0]).id;
  }
  const mode = d.examMode || 'full';
  const s = getScen(examPick);
  const kind = s.level === 'A1' ? 'FP' : 'FLE';
  const k = mode === 'short' ? 0.5 : 1;
  const T = EXAM_TIMES[kind];
  app.innerHTML = `
    <a class="back" href="#/dcl">← DCL</a>
    <h1>Пробний іспит</h1>
    <p class="muted" style="margin-top:4px">Як на справжньому DCL: таймер, без перекладу, без підказок і без правильних відповідей до кінця. Після іспиту — самоперевірка розмови й письма та приблизний рівень.</p>

    <section class="card section stack">
      <h2>1. Сценарій</h2>
      <p class="small muted">Краще обрати сценарій, який ви ще не проходили в тренуванні.</p>
      <div class="pick">${DCL.scenarios.map((x) => `
        <button type="button" class="opt ${x.id === examPick ? 'right' : ''}" data-act="dexpick" data-id="${esc(x.id)}">
          <b>${esc(x.level)}</b> · ${esc(x.title)}${d.scen[x.id] && d.scen[x.id].done ? ' <span class="small muted">(пройдено)</span>' : ''}${usedInExam.has(x.id) ? ' <span class="small muted">(був на іспиті)</span>' : ''}
        </button>`).join('')}</div>
    </section>

    <section class="card section stack">
      <h2>2. Режим</h2>
      <div class="seg" role="group">
        <button type="button" data-act="dexmode" data-m="full" class="${mode === 'full' ? 'on' : ''}">Повний час</button>
        <button type="button" data-act="dexmode" data-m="short" class="${mode === 'short' ? 'on' : ''}">Скорочений (½)</button>
      </div>
      <div class="phases">
        <div class="phase"><b>Фази 1–2 · читання і слухання</b><span>${Math.round(T.p12 * k)} хв</span></div>
        <div class="phase"><b>Фази 3–4 · телефонна розмова</b><span>${Math.round(T.p34 * k)} хв</span></div>
        <div class="phase"><b>Фаза 5 · письмо</b><span>${Math.round(T.p5 * k)} хв</span></div>
      </div>
      <p class="small muted">${kind === 'FP' ? 'Рівень A1 — формат DCL FP (1 год 30 разом); розподіл часу по фазах орієнтовний.' : 'Формат DCL FLE: 2 год 30 разом.'} Фазу можна завершити раніше. Потрібні навушники і мікрофон.</p>
    </section>
    <button class="btn primary big block" type="button" data-act="dexstart" style="margin-top:16px">▶ Почати іспит</button>`;
}
actions.dexpick = (el) => { examPick = el.dataset.id; viewExamStart(); };
actions.dexmode = (el) => { dclState().examMode = el.dataset.m; save(); viewExamStart(); };
actions.dexstart = () => {
  const s = getScen(examPick);
  const mode = dclState().examMode || 'full';
  examRun = {
    scen: s.id, mode, kind: s.level === 'A1' ? 'FP' : 'FLE', phase: 'p12', startedAt: Date.now(),
    answers: {}, recs: {}, turn: 0, spoken: -1, writing: '', oral: {}, wchecks: [],
  };
  startPhase('p12');
  location.hash = '#/dcl/exam/run';
};

function phaseMinutes(phase) { return EXAM_TIMES[examRun.kind][phase] * (examRun.mode === 'short' ? 0.5 : 1); }
function startPhase(phase) {
  examRun.phase = phase;
  examRun.ends = ['p12', 'p34', 'p5'].includes(phase) ? Date.now() + phaseMinutes(phase) * 60000 : null;
  stopSpeak();
  dRecStop(false);
}
function ensureExamTimer() {
  if (examTimer) return;
  examTimer = setInterval(() => {
    if (!examRun || !examRun.ends) return;
    const left = Math.max(0, examRun.ends - Date.now());
    const el = $('#extimer');
    if (el) {
      const m = Math.floor(left / 60000), sec = Math.floor((left % 60000) / 1000);
      el.textContent = `${m}:${String(sec).padStart(2, '0')}`;
      el.parentElement.classList.toggle('late', left < 5 * 60000);
    }
    if (left <= 0) {
      const next = { p12: 'p34', p34: 'p5', p5: 'review' }[examRun.phase];
      toast('⏰ Час цієї фази вийшов');
      startPhase(next);
      if (location.hash.startsWith('#/dcl/exam/run')) viewExamRun();
    }
  }, 1000);
}

function examHeader(label) {
  return `<div class="exbar"><span class="grow"><b>${label}</b></span>${examRun.ends ? `<span class="timer">⏱ <span id="extimer">…</span></span>` : ''}</div>`;
}

function viewExamRun() {
  if (!examRun) { location.hash = '#/dcl/exam'; return; }
  const s = getScen(examRun.scen);
  document.title = 'Іспит — DCL';
  ensureExamTimer();
  const R = examRun;
  let html = '';
  if (R.phase === 'p12') {
    html = examHeader('Фази 1–2 · Читання і слухання') + `
      <section class="card section stack">
        <p lang="fr"><b>Situation :</b> ${esc(s.role)}</p>
        <div class="mission" lang="fr">${esc(s.mission)}</div>
        <p lang="fr" class="small"><b>Votre interlocuteur :</b> ${esc(s.interlocutor || '')}</p>
      </section>
      <h2 class="section">📄 Documents</h2>
      <div class="stack" style="margin-top:10px">${(s.documents || []).map(docHtml).join('')}</div>
      <h2 class="section">🎧 Enregistrements</h2>
      <div style="margin-top:10px">${audioHtml(s, false)}</div>
      <section class="card section"><h2>Questions</h2>${examQuestionsHtml(s)}</section>
      <button class="btn primary big block" type="button" data-act="dexnext" style="margin-top:16px">Завершити фази 1–2 → Розмова</button>`;
  } else if (R.phase === 'p34') {
    const turns = s.oral.turns;
    const i = R.turn;
    if (i < turns.length) {
      const rec = R.recs[i];
      html = examHeader(`Фази 3–4 · Розмова · репліка ${i + 1}/${turns.length}`) + `
        <section class="card section stack">
          <p lang="fr"><b>Vous appelez :</b> ${esc(s.interlocutor || '')}</p>
          <p class="small muted">Слухайте співрозмовника, натисніть запис і відповідайте. Попросити повторити — нормально (як на справжньому іспиті).</p>
          <div class="row">
            <button class="btn" type="button" data-act="dexrepeat">🔁 Повторити репліку</button>
            <button class="btn rec" type="button" data-act="dexrec">${rec ? '🎙 Перезаписати' : '🎙 Відповісти'}</button>
          </div>
          ${rec ? `<audio controls src="${rec}" style="width:100%"></audio>` : ''}
          <button class="btn primary block" type="button" data-act="dexturn">${i + 1 < turns.length ? 'Наступна репліка →' : 'Завершити розмову → Письмо'}</button>
        </section>`;
      if (R.spoken !== i) { R.spoken = i; setTimeout(() => speak(turns[i].examiner, { voice: turns[i].voice || 'f' }), 300); }
    }
  } else if (R.phase === 'p5') {
    const w = s.writing;
    html = examHeader('Фаза 5 · Письмо') + `
      <section class="card section stack">
        <p lang="fr" class="mission">${esc(w.task)}</p>
        <p class="small muted">${w.minWords}–${w.maxWords} слів</p>
      </section>
      <section class="card section">
        <textarea class="input write" id="dwrite" data-input="dexwrite" lang="fr" spellcheck="false" placeholder="Écrivez ici…">${esc(R.writing)}</textarea>
        <div class="row small" style="margin-top:6px"><span id="wc" class="wc grow"></span></div>
      </section>
      <button class="btn primary big block" type="button" data-act="dexnext" style="margin-top:16px">Здати роботу</button>`;
  } else if (R.phase === 'review') {
    html = examReviewHtml(s);
  } else if (R.phase === 'result') {
    html = examResultHtml(s);
  }
  app.innerHTML = html;
  if (R.phase === 'p5') updateWordCounter(s, R.writing);
}

function examQuestionsHtml(s) {
  return (s.questions || []).map((q, i) => {
    const a = examRun.answers[i];
    return `<div class="quiz-q"><p lang="fr">${i + 1}. ${esc(q.q)}</p>
      ${q.options
        ? q.options.map((o, oi) => `<button type="button" class="opt ${a !== undefined && Number(a) === oi ? 'sel' : ''}" data-act="dexans" data-q="${i}" data-o="${oi}" lang="fr">${esc(o)}</button>`).join('')
        : `<input class="input" data-input="dexin" data-q="${i}" lang="fr" autocomplete="off" value="${esc(a || '')}">`}
    </div>`;
  }).join('');
}
actions.dexans = (el) => {
  examRun.answers[el.dataset.q] = Number(el.dataset.o);
  $$(`[data-act="dexans"][data-q="${el.dataset.q}"]`).forEach((b) => b.classList.toggle('sel', b === el));
};
inputs.dexin = (el) => { examRun.answers[el.dataset.q] = el.value; };
inputs.dexwrite = (el) => { examRun.writing = el.value; updateWordCounter(getScen(examRun.scen), el.value); };
actions.dexrepeat = () => {
  const s = getScen(examRun.scen);
  const t = s.oral.turns[examRun.turn];
  speak(t.examiner, { voice: t.voice || 'f' });
};
actions.dexrec = (el) => {
  const i = examRun.turn;
  dRecToggle(el, (url) => {
    if (!examRun) { URL.revokeObjectURL(url); return; }
    if (examRun.recs[i]) URL.revokeObjectURL(examRun.recs[i]);
    examRun.recs[i] = url;
    viewExamRun();
  });
};
actions.dexturn = () => {
  if (isRecording()) { toast('Спершу зупиніть запис'); return; }
  const s = getScen(examRun.scen);
  examRun.turn++;
  if (examRun.turn >= s.oral.turns.length) startPhase('p5');
  viewExamRun();
  window.scrollTo(0, 0);
};
actions.dexnext = () => {
  const ph = examRun.phase;
  if (ph === 'p12') {
    const s = getScen(examRun.scen);
    const left = (s.questions || []).filter((_, i) => examRun.answers[i] === undefined || examRun.answers[i] === '').length;
    if (!confirm(left ? `Без відповіді: ${left}. Перейти до розмови? Повернутися буде не можна.` : 'Перейти до розмови? Повернутися до документів буде не можна.')) return;
    startPhase('p34');
  } else if (ph === 'p5') {
    if (!confirm('Здати роботу і перейти до перевірки?')) return;
    startPhase('review');
  }
  viewExamRun();
  window.scrollTo(0, 0);
};

function examAutoScores(s) {
  const res = {};
  ['lecture', 'ecoute'].forEach((part) => {
    const qs = partQuestions(s, part);
    res[part] = qs.length ? Math.round(qs.filter(({ q, i }) => isRight(q, examRun.answers[i])).length / qs.length * 100) : null;
  });
  return res;
}
function examReviewHtml(s) {
  const R = examRun;
  const auto = examAutoScores(s);
  const turns = s.oral.turns;
  return `
    <h1>Перевірка</h1>
    <p class="muted" style="margin-top:4px">Читання і слухання перевірено автоматично. Розмову і письмо оцініть самі: послухайте свої записи, порівняйте зі зразками і чесно позначте пункти.</p>
    <section class="card section">
      <h2>📄 Читання: ${auto.lecture ?? '—'}% · 🎧 Слухання: ${auto.ecoute ?? '—'}%</h2>
      <details style="margin-top:8px"><summary class="small muted">Мої відповіді</summary>
        ${(s.questions || []).map((q, i) => {
          const a = R.answers[i];
          const ok = isRight(q, a);
          const mine = a === undefined || a === '' ? '—' : q.options ? q.options[Number(a)] : a;
          return `<div class="small" style="margin-top:8px"><span lang="fr">${i + 1}. ${esc(q.q)}</span><br>
            <span class="${ok ? 'ok-text' : 'bad-text'}">${ok ? '✓' : '✗'} ${esc(mine)}</span>${ok ? '' : ` · <span class="ok-text">${esc(q.options ? q.options[q.answer] : q.accept[0])}</span>`}</div>`;
        }).join('')}
      </details>
    </section>

    <section class="section"><h2>🗣️ Розмова — самоперевірка</h2>
      ${turns.map((t, i) => `
        <div class="card section">
          <div class="small muted">Репліка ${i + 1}</div>
          <p lang="fr">🗨️ ${esc(t.examiner)}</p>
          ${R.recs[i] ? `<audio controls src="${R.recs[i]}" style="width:100%"></audio>` : '<p class="bad-text small">Немає запису — пункти цієї репліки не зараховуються.</p>'}
          <div class="model"><div class="small muted">Зразок:</div><p lang="fr">${esc(t.model)}</p></div>
          <div class="checks">${(t.check || []).map((c, ci) => `<label class="check"><input type="checkbox" data-act="dexocheck" data-t="${i}" data-c="${ci}" ${R.recs[i] ? '' : 'disabled'} ${(R.oral[i] || [])[ci] ? 'checked' : ''}> ${esc(c)}</label>`).join('')}</div>
        </div>`).join('')}
    </section>

    <section class="section"><h2>✍️ Письмо — самоперевірка</h2>
      <div class="card section"><div class="small muted">Мій текст:</div><div class="doc-text" lang="fr">${esc(R.writing || '—')}</div></div>
      ${writingFeedbackHtml(s, R.writing, R.wchecks, 'dexwcheck')}
    </section>
    <button class="btn good big block" type="button" data-act="dexfinish" style="margin-top:16px">📊 Отримати результат</button>`;
}
actions.dexocheck = (el) => {
  (examRun.oral[el.dataset.t] ||= [])[Number(el.dataset.c)] = el.checked;
};
actions.dexwcheck = (el) => {
  examRun.wchecks[Number(el.dataset.c)] = el.checked;
  const sc = $('#wscore');
  if (sc) sc.textContent = writingScore(getScen(examRun.scen).writing, examRun.writing, examRun.wchecks);
};

// Приблизний рівень за відсотком і рівнем сценарію
function estimateLevel(level, pct) {
  const i = DCL_LEVELS.indexOf(level);
  if (pct >= 75) return { lvl: level, note: pct >= 90 && i < DCL_LEVELS.length - 1 ? `Упевнено! Пробуйте сценарії ${DCL_LEVELS[i + 1]}.` : 'Рівень сценарію досягнуто.' };
  if (pct >= 50) return i > 0 ? { lvl: DCL_LEVELS[i - 1], note: `Майже ${level}: ще трохи практики.` } : { lvl: 'A1 (частково)', note: 'Базові завдання виконано частково.' };
  if (pct >= 25 && i > 1) return { lvl: DCL_LEVELS[i - 2], note: `До ${level} ще далеко — тренуйтеся на сценаріях ${DCL_LEVELS[i - 1]}.` };
  return { lvl: 'нижче A1', note: 'Почніть зі сценаріїв A1 у режимі тренування.' };
}
actions.dexfinish = () => {
  const s = getScen(examRun.scen);
  const R = examRun;
  const auto = examAutoScores(s);
  const turns = s.oral.turns;
  const oTotal = turns.reduce((n, t) => n + (t.check || []).length, 0);
  const oGot = turns.reduce((n, t, i) => n + (R.recs[i] ? (R.oral[i] || []).filter(Boolean).length : 0), 0);
  const parts = {
    lecture: auto.lecture ?? 0,
    ecoute: auto.ecoute ?? 0,
    oral: oTotal ? Math.round(oGot / oTotal * 100) : 0,
    ecrit: wordCount(R.writing) >= 5 ? writingScore(s.writing, R.writing, R.wchecks) : 0,
  };
  const total = Math.round((parts.lecture + parts.ecoute + parts.oral + parts.ecrit) / 4);
  const est = estimateLevel(s.level, total);
  R.result = { parts, total, est };
  dclState().exams.unshift({
    date: new Date().toISOString(), scen: s.id, title: s.title, scenLevel: s.level, mode: R.mode,
    parts, total, level: est.lvl, minutes: Math.round((Date.now() - R.startedAt) / 60000),
  });
  const day = dayOf(); day.dcl = (day.dcl || 0) + 1;
  save(true);
  startPhase('result');
  viewExamRun();
  window.scrollTo(0, 0);
};

function barsHtml(parts) {
  const weakest = Object.keys(SKILLS).filter((k) => parts[k] != null).sort((a, b) => parts[a] - parts[b])[0];
  return `<div class="bars">${Object.entries(SKILLS).map(([k, x]) => `
    <div class="barrow ${k === weakest ? 'weak' : ''}"><span>${x.icon} ${x.label}</span>
      <div class="bar"><i style="width:${parts[k] ?? 0}%"></i></div><b>${parts[k] != null ? parts[k] + '%' : '—'}</b></div>`).join('')}</div>`;
}
function examResultHtml(s) {
  const r = examRun.result;
  const weakest = Object.keys(SKILLS).sort((a, b) => r.parts[a] - r.parts[b])[0];
  return `
    <h1>Результат іспиту</h1>
    <p class="muted" style="margin-top:4px">${esc(s.title)} · сценарій рівня ${esc(s.level)}</p>
    <section class="card section center stack">
      <div class="small muted">Приблизний рівень</div>
      <div class="pct" style="font-size:2.6rem">${esc(r.est.lvl)}</div>
      <div><b>${r.total}%</b> загалом</div>
      <p class="small muted">${esc(r.est.note)}</p>
    </section>
    <section class="card section"><h2>За частинами</h2>${barsHtml(r.parts)}</section>
    <p class="tip">🎯 Найслабше: <b>${SKILLS[weakest].label}</b>. ${esc(SKILL_TIPS[weakest])}</p>
    <p class="small muted" style="margin-top:10px">Оцінка орієнтовна: справжнє журі DCL оцінює за детальною сіткою критеріїв.</p>
    <div class="row" style="margin-top:16px">
      <a class="btn primary grow" href="#/dcl/stats">📊 Мій прогрес</a>
      <button class="btn grow" type="button" data-act="dexagain">Ще один іспит</button>
    </div>`;
}
actions.dexagain = () => { discardExam(); examPick = null; location.hash = '#/dcl/exam'; };

function discardExam() {
  if (examRun) Object.values(examRun.recs).forEach((u) => URL.revokeObjectURL(u));
  examRun = null;
  clearInterval(examTimer); examTimer = null;
}

/* ---------- Статистика DCL ---------- */

function viewDclStats() {
  document.title = 'Прогрес DCL — Écoute';
  const d = dclState();
  const avg = skillAverages();
  const known = Object.keys(SKILLS).filter((k) => avg[k] != null);
  const weakest = known.slice().sort((a, b) => avg[a] - avg[b])[0];
  const byLevel = DCL_LEVELS.map((l) => {
    const list = DCL.scenarios.filter((s) => s.level === l);
    return { l, total: list.length, done: list.filter((s) => d.scen[s.id] && d.scen[s.id].done).length };
  });
  app.innerHTML = `
    <a class="back" href="#/dcl">← DCL</a>
    <h1>Мій прогрес DCL</h1>
    <div class="stats section">
      ${byLevel.map((x) => `<div class="card stat"><div class="num">${x.done}<span class="muted" style="font-size:1rem"> / ${x.total}</span></div><div class="lab">сценаріїв ${x.l} пройдено</div></div>`).join('')}
      <div class="card stat"><div class="num">${d.exams.length}</div><div class="lab">пробних іспитів</div></div>
    </div>

    <section class="card section">
      <h2>Вміння</h2>
      <p class="small muted">Середнє з тренувань і пробних іспитів.</p>
      ${known.length ? barsHtml(Object.fromEntries(Object.keys(SKILLS).map((k) => [k, avg[k]]))) : '<p class="muted" style="margin-top:8px">Поки немає даних — пройдіть частину будь-якого сценарію.</p>'}
      ${weakest ? `<p class="tip">🎯 Слабке місце: <b>${SKILLS[weakest].label}</b> (${avg[weakest]}%). ${esc(SKILL_TIPS[weakest])}</p>` : ''}
    </section>

    <section class="card section">
      <h2>Пробні іспити</h2>
      ${d.exams.length ? `<div class="wlist">${d.exams.slice(0, 12).map((e) => `
        <div class="wrow"><div class="grow">
          <b>${esc(e.level)}</b> · ${e.total}% <span class="small muted">· ${new Date(e.date).toLocaleDateString('uk-UA')} · ${e.mode === 'short' ? 'скорочений' : 'повний'}</span>
          <div class="small muted">${esc(e.title)} (${esc(e.scenLevel)})</div>
          <div class="small">📄 ${e.parts.lecture}% · 🎧 ${e.parts.ecoute}% · 🗣️ ${e.parts.oral}% · ✍️ ${e.parts.ecrit}%</div>
        </div></div>`).join('')}</div>` : '<p class="muted" style="margin-top:8px">Ще не було. <a href="#/dcl/exam">Спробувати →</a></p>'}
    </section>

    <section class="card section">
      <h2>Граматика</h2>
      <div class="wlist">${DCL.grammar.topics.map((t) => `<a class="wrow" href="#/dcl/grammar/${esc(t.id)}" style="color:inherit"><span class="grow" lang="fr">${esc(t.title)}</span>${d.grammar[t.id] ? `<span class="tag good">${d.grammar[t.id].best}%</span>` : '<span class="tag">—</span>'}</a>`).join('')}</div>
    </section>`;
}

// Картка для загальної сторінки «Прогрес»
window.dclProgressCard = () => {
  const d = state.dcl;
  if (!d) return `<a class="card section today-dcl" href="#/dcl"><span class="big-ico">🎓</span><div class="grow"><b>Підготовка до DCL</b><div class="small muted">Сценарії, пробний іспит, фрази, граматика</div></div><span>→</span></a>`;
  const done = Object.values(d.scen || {}).filter((s) => s.done).length;
  return `<a class="card section today-dcl" href="#/dcl/stats"><span class="big-ico">🎓</span><div class="grow"><b>Прогрес DCL</b>
    <div class="small muted">Сценаріїв пройдено: ${done} · пробних іспитів: ${(d.exams || []).length}</div></div><span>→</span></a>`;
};

/* ---------- Маршрутизація розділу ---------- */

// Викликається з render() в app.js
async function viewDcl(a, b, c) {
  dclState();
  if (!DCL) {
    const hash = location.hash;
    app.innerHTML = '<p class="muted center pad">Завантаження DCL…</p>';
    try { await loadDcl(); }
    catch (e) {
      app.innerHTML = `<div class="card"><h2>Не вдалося завантажити дані DCL</h2><p class="muted" style="margin-top:8px">${esc(e.message || e)}</p><p class="small muted">Перевірте файли в папці dcl/ (наприклад, кому чи лапки в JSON).</p></div>`;
      return;
    }
    if (location.hash !== hash) return;
  }
  if (a === 'about') viewDclAbout();
  else if (a === 'today') viewDclToday();
  else if (a === 's') viewScenario(b, c || 'mission');
  else if (a === 'exam') (b === 'run' ? viewExamRun() : viewExamStart());
  else if (a === 'phrases') viewDclPhrases();
  else if (a === 'grammar') (b ? viewGrammarTopic(b) : viewGrammarList());
  else if (a === 'stats') viewDclStats();
  else viewDclHub();
}

// Перед зміною екрана: не губимо іспит випадково
function dclBeforeLeave() {
  if (examRun && ['p12', 'p34', 'p5', 'review'].includes(examRun.phase) && !location.hash.startsWith('#/dcl/exam/run')) {
    if (!confirm('Вийти з пробного іспиту? Результат не збережеться.')) {
      location.hash = '#/dcl/exam/run';
      return false;
    }
    discardExam();
  }
  return true;
}
// Прибирання при зміні екрана
function dclCleanup() {
  stopSpeak();
  playingKey = null;
  dRecStop(true);
  if (!location.hash.startsWith('#/dcl/exam/run')) { clearInterval(examTimer); examTimer = null; }
  if (!location.hash.startsWith('#/dcl/s/')) {
    Object.keys(dRecs).forEach((k) => { URL.revokeObjectURL(dRecs[k]); delete dRecs[k]; });
  }
  if (!location.hash.startsWith('#/dcl/today') && !location.hash.startsWith('#/dcl/phrases')) drill = null;
}
window.addEventListener('beforeunload', (e) => {
  if (examRun && ['p12', 'p34', 'p5', 'review'].includes(examRun.phase)) { e.preventDefault(); e.returnValue = ''; }
});

// Підвантажуємо дані DCL у фоні, щоб картка «на сьогодні» на головній знала план
loadDcl().catch(() => {});
