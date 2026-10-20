/* ==========================================================
   Écoute — розділ «Підготовка до DCL».
   Два офіційні іспити Міністерства освіти Франції:
     • DCL FP  (français professionnel de 1er niveau) — 1 год 30, рівні A1 · A2.1 · A2
     • DCL FLE (français langue étrangère)            — 2 год 30, рівні A2 · B1.1 · B1.2 · B2 · C1
   Кожен сценарій = один повний іспит (фази 1–5, таймер як на справжньому).

   Підключається ПІСЛЯ app.js і використовує його утиліти:
   $, $$, esc, app, state, save, toast, actions, inputs, todayStr,
   dayOf, shuffle, plural, getVideo, allVideos, videoCard, addWord, hasWord.

   Дані: dcl/index.json, dcl/scenarios/*.json (шаблон: _template.json),
         dcl/phrases.json, dcl/grammar.json

   Адреси екранів:
     #/dcl                головна DCL      #/dcl/about       що таке DCL
     #/dcl/today          на сьогодні      #/dcl/x/ID        старт іспиту
     #/dcl/exam/run       іспит            #/dcl/s/ID/крок   тренування по частинах
     #/dcl/phrases        фрази            #/dcl/grammar[/ID] граматика
     #/dcl/stats          прогрес DCL
   ========================================================== */
'use strict';

/* ---------- 1. Офіційні параметри іспитів ---------- */

// Джерело: референціали DCL (France Compétences, Міністерство освіти Франції, 2021)
const EXAMS = {
  FP: {
    key: 'FP', name: 'DCL FP', full: 'Français professionnel de premier niveau', range: 'A1 – A2',
    levels: ['A1', 'A2.1', 'A2'], tags: ['A1', 'A2'], below: '<A1',
    total: 90, times: { p12: 60, p34: 10, p5: 20 }, prep: 10,
  },
  FLE: {
    key: 'FLE', name: 'DCL FLE', full: 'Français langue étrangère', range: 'A2 – C1',
    levels: ['A2', 'B1.1', 'B1.2', 'B2', 'C1'], tags: ['A2', 'B1', 'B2', 'C1'], below: '<A2',
    total: 150, times: { p12: 90, p34: 20, p5: 40 }, prep: 20,
  },
};
// Спільна шкала рівнів (для графіка і порівнянь)
const SCALE = ['<A1', 'A1', 'A2.1', 'A2', 'B1.1', 'B1.2', 'B2', 'C1'];
const ord = (l) => (l === '<A2' ? 2 : Math.max(0, SCALE.indexOf(l)));
const lvlName = (l) => ({ '<A1': 'нижче A1', '<A2': 'нижче A2', 'B1.1': 'B1.1 (B1)', 'B1.2': 'B1.2 (B1)' }[l] || l || '—');
const GOALS = ['A2', 'B1.2', 'B2', 'C1'];

// Пороги: яку частку завдань кожного рівня треба виконати, щоб отримати рівень.
// Рівні йдуть по черзі: не можна отримати B2, не отримавши B1.2.
const RULES = {
  FLE: [['A2', { A2: 0.5 }], ['B1.1', { A2: 0.7, B1: 0.4 }], ['B1.2', { B1: 0.7 }], ['B2', { B1: 0.7, B2: 0.6 }], ['C1', { B2: 0.75, C1: 0.6 }]],
  FP: [['A1', { A1: 0.5 }], ['A2.1', { A1: 0.7, A2: 0.4 }], ['A2', { A2: 0.7 }]],
};

// Сітка критеріїв для усної та письмової частин (скорочений переклад офіційних описів рівнів)
const GRID_FLE_LING = [
  { id: 'syntaxe', group: 'Мовні критерії', name: 'Синтаксис', d: {
    A2: 'Прості структури, часто завчені фрази; правильні конектори et, mais, parce que.',
    'B1.1': 'Прості структури часто правильні; спроби складніших; d\'abord, ensuite, enfin.',
    'B1.2': 'Окремі помилки в простих структурах, деякі вдалі складні речення.',
    B2: 'Різноманітні, переважно складні речення; багатші логічні конектори.',
    C1: 'Багатство і різноманіття, багато типово французьких структур.' } },
  { id: 'verbe', name: 'Дієслівні форми', d: {
    A2: 'Правильний présent; поодинокі вдалі інші часи.',
    'B1.1': 'Présent і futur здебільшого правильні; з\'являються passé composé та imparfait.',
    'B1.2': 'Вдалі чергування passé composé / imparfait / plus-que-parfait; futur і conditionnel; можливий subjonctif після il faut que.',
    B2: 'Минулі часи переважно правильні, узгодження часів; безособові звороти, пасив, різні способи.',
    C1: 'Нюансоване вживання часів і способів (передування, одночасність); узгодження часів дотримано.' } },
  { id: 'lexique', name: 'Лексика', d: {
    A2: 'Елементарна фактична лексика, слова з документів, неточності.',
    'B1.1': 'Обмежена лексика, повтори, багато слів із документів.',
    'B1.2': 'Переважно доречна лексика, іноді з документів; перифрази замість невідомих слів.',
    B2: 'Власна лексика, є ідіоматичні звороти.',
    C1: 'Різноманітна, точна і доречна лексика; ідіоматичні звороти.' } },
];
const GRID = {
  FLE: {
    oral: [
      { id: 'info', group: 'Прагматичні критерії', name: 'Обробка інформації (точність, організація)', d: {
        A2: 'Просте перелічення фактів; мінімальне розуміння, мала інформативна цінність.',
        'B1.1': 'Виокремлено головне з документів і записів; початок організації інформації.',
        'B1.2': 'Відібрану інформацію пов\'язано між собою; виклад ще потребує уточнень.',
        B2: 'Повний, чіткий, структурований виклад з ієрархією важливої інформації.',
        C1: 'Враховано й неявні дані; аргументація нюансована і послідовна.' } },
      { id: 'parole', name: 'Виступ і обмін (представлення, запитання, реакція на нове)', d: {
        A2: 'Представлення уривчасте, запитань майже немає; обмін тримається на співрозмовнику.',
        'B1.1': 'Мінімально представлено себе, місію і висновки; запитань мало, обмін залежить від співрозмовника.',
        'B1.2': 'Представлення відповідає сценарію; є запитання, зокрема щодо нової інформації; часом потрібні підказки.',
        B2: 'Природне, спонтанне представлення; легко ставите запитання і справляєтеся з несподіваним; берете ініціативу.',
        C1: 'Аргументоване представлення; влучні запитання, що розширюють дискусію; вільно ведете обмін і контраргументуєте.' } },
      { id: 'comm', name: 'Якість комунікації (формулювання, регістр, культурні норми)', d: {
        A2: 'Формулювання не завжди доречні для телефонної розмови; норми частково враховано.',
        'B1.1': 'Спроби доречного регістру; мінімально враховано культурні правила.',
        'B1.2': 'Враховано правила звертання, регістр і формат.',
        B2: 'Дотримано культурних і професійних норм ситуації.',
        C1: 'Систематично доречний регістр; враховано ієрархію і професійні норми.' } },
      ...GRID_FLE_LING,
      { id: 'phono', name: 'Вимова, інтонація, плавність', d: {
        A2: 'Інтонація розрізняє ствердження і питання; мовлення повільне, з багатьма паузами.',
        'B1.1': 'Доречна базова інтонація; темп повільний, вагання в довгих фразах.',
        'B1.2': 'Ритмічні групи нерегулярні; окремі збої в довгих висловлюваннях.',
        B2: 'Однорідний, плавний ритм, паузи лише на роздуми; інтонація передає нюанси.',
        C1: 'Ритм і плавність під контролем; повністю зрозуміло, навіть з акцентом.' } },
    ],
    ecrit: [
      { id: 'info', group: 'Прагматичні критерії', name: 'Обробка інформації (точність, організація)', d: {
        A2: 'Просте перелічення фактів, мала інформативна цінність.',
        'B1.1': 'Виокремлено головне; початок організації.',
        'B1.2': 'Відібрану інформацію пов\'язано між собою.',
        B2: 'Повний, чіткий, структурований текст з ієрархією інформації.',
        C1: 'Враховано неявні дані; нюансована, послідовна аргументація.' } },
      { id: 'mission', name: 'Виконання місії (рекомендація і її обґрунтування)', d: {
        A2: 'Інформацію передано, але рекомендації майже немає.',
        'B1.1': 'Корисну інформацію відібрано, вибір названо.',
        'B1.2': 'Інформацію відібрано й організовано, щоб обґрунтувати вибір.',
        B2: 'Самостійна обробка всієї інформації та її ієрархія; переконлива рекомендація.',
        C1: 'Складна інформація в сильній, нюансованій аргументації (переваги, ризики, альтернативи).' } },
      { id: 'comm', name: 'Формат і регістр (звертання, формули, структура)', d: {
        A2: 'Формат і формули ввічливості частково доречні.',
        'B1.1': 'Спроби доречного регістру, базові формули.',
        'B1.2': 'Правильні звертання, регістр і формат.',
        B2: 'Професійні норми листа, чітка структура абзацами.',
        C1: 'Бездоганний регістр з урахуванням ієрархії; доречні офіційні формули.' } },
      ...GRID_FLE_LING,
      { id: 'graphie', name: 'Орфографія і пунктуація', d: {
        A2: 'Мало помилок у найчастіших словах; речення з великої літери і крапкою.',
        'B1.1': 'É/è здебільшого правильні; коми між частинами речення.',
        'B1.2': 'Частково розрізнено a/à, ou/où, ce/se, c\'est/ses; двокрапка, лапки.',
        B2: 'Мало помилок у цьому; крапка з комою; узгодження переважно правильне.',
        C1: 'Добре володіння всіма правилами орфографії і пунктуації.' } },
    ],
  },
  FP: {
    oral: [
      { id: 'info', group: 'Прагматичні критерії', name: 'Обробка інформації', d: {
        A1: 'Кілька доречних фактів, дуже просто; початок розуміння місії.',
        'A2.1': 'Кілька основних фактів, просто; місію частково враховано.',
        A2: 'Перелік фактів, зрозумілий; місію загалом виконано.' } },
      { id: 'parole', name: 'Виступ і обмін', d: {
        A1: 'Дуже короткі «питання – відповідь»; обмін тримається на співрозмовнику.',
        'A2.1': 'Обмін уривчастий, залежить від запитань; часто просите повторити.',
        A2: 'Ролі зрозумілі; інформацію подано частково; запитань мало.' } },
      { id: 'comm', name: 'Ввічливість і регістр', d: {
        A1: 'Найпростіші привітання і формули ввічливості.',
        'A2.1': 'Початок структури розмови, базові коди ввічливості.',
        A2: 'Формулювання не завжди доречні, але культурні правила враховано.' } },
      { id: 'syntaxe', group: 'Мовні критерії', name: 'Синтаксис', d: {
        A1: 'Завчені фрази, прості структури під обмеженим контролем.',
        'A2.1': 'Прості структури переважно правильні; з\'являються прості конектори.',
        A2: 'Прості структури; et, mais, parce que; прості вказівки часу і місця.' } },
      { id: 'verbe', name: 'Дієслівні форми', d: {
        A1: 'Кілька правильних форм у présent.',
        'A2.1': 'Поширені дієслова в présent; з\'являються інші часи.',
        A2: 'Багато дієслів у présent правильно; окремі вдалі інші часи.' } },
      { id: 'lexique', name: 'Лексика', d: {
        A1: 'Дуже поширені слова і завчені вирази.',
        'A2.1': 'Елементарна лексика, слова з документів, багато неточностей.',
        A2: 'Елементарна лексика для щоденних ситуацій, окремі неточності.' } },
      { id: 'phono', name: 'Вимова', d: {
        A1: 'Зрозуміло лише обмежений набір слів; паузи між словами.',
        'A2.1': 'Поширені слова звучать по-французьки; часті паузи і вагання.',
        A2: 'Інтонація розрізняє ствердження і питання; повільно, з ваганнями.' } },
    ],
    ecrit: [
      { id: 'info', group: 'Прагматичні критерії', name: 'Обробка інформації', d: {
        A1: 'Кілька доречних фактів, дуже просто.',
        'A2.1': 'Основні факти передано просто.',
        A2: 'Перелік фактів, зрозумілий, з простою організацією.' } },
      { id: 'comm', name: 'Формат і ввічливість', d: {
        A1: 'Схематично (список); найпростіші привітання.',
        'A2.1': 'Початок структури відповідно до формату; базові коди.',
        A2: 'Формат і формули ввічливості загалом доречні.' } },
      { id: 'syntaxe', group: 'Мовні критерії', name: 'Синтаксис', d: {
        A1: 'Завчені фрази, прості структури.',
        'A2.1': 'Прості структури переважно правильні.',
        A2: 'Прості структури; et, mais, parce que.' } },
      { id: 'verbe', name: 'Дієслівні форми', d: {
        A1: 'Кілька правильних форм у présent.',
        'A2.1': 'Поширені дієслова в présent.',
        A2: 'Багато дієслів у présent правильно; окремі інші часи.' } },
      { id: 'lexique', name: 'Лексика', d: {
        A1: 'Дуже поширені слова.',
        'A2.1': 'Елементарна лексика, слова з документів.',
        A2: 'Елементарна лексика для щоденних ситуацій.' } },
      { id: 'graphie', name: 'Орфографія', d: {
        A1: 'Правильні лише окремі слова, часто переписані з документів.',
        'A2.1': 'Слова часто записано «на слух»; з\'являються рід і число.',
        A2: 'Мало помилок у поширених словах; великі літери, крапки, знак питання.' } },
    ],
  },
};

const DCL_TOPICS = {
  travail:        { label: 'Робота і стажування', icon: '💼' },
  logement:       { label: 'Житло',               icon: '🏠' },
  commerce:       { label: 'Клієнти і підприємство', icon: '🛍️' },
  transport:      { label: 'Транспорт',           icon: '🚆' },
  sante:          { label: 'Здоров\'я',           icon: '🩺' },
  administration: { label: 'Адміністрація',       icon: '🏛️' },
  evenement:      { label: 'Організація заходу',  icon: '🎉' },
  societe:        { label: 'Суспільство і культура', icon: '🌍' },
};
const SKILLS = {
  lecture: { label: 'Читання',   icon: '📄' },
  ecoute:  { label: 'Слухання',  icon: '🎧' },
  oral:    { label: 'Розмова',   icon: '🗣️' },
  ecrit:   { label: 'Письмо',    icon: '✍️' },
};
const STEPS = [['mission', 'Місія'], ['lecture', 'Читання'], ['ecoute', 'Слухання'], ['oral', 'Розмова'], ['ecrit', 'Письмо'], ['videos', 'Відео']];
const SKILL_TIPS = {
  lecture: 'Читайте вибірково: спершу питання, потім шукайте факти. Для B2–C1 тренуйте зіставлення документів і неявну інформацію (відгуки, примітки, статті).',
  ecoute: 'Слухайте кілька разів: спершу суть, потім деталі й позиції мовців. Для B2–C1 дивіться аналітику і дебати з бібліотеки (мітки DCL B2 / C1).',
  oral: 'B2 — це ініціатива і реакція на несподіване: ставте уточнювальні запитання, визнавайте аргумент і контраргументуйте (Je comprends, mais…), пропонуйте компроміс.',
  ecrit: 'B2 — структура абзацами й ієрархія інформації; C1 — переваги, ризики й альтернативи з багатими конекторами. Порівнюйте свій текст зі зразками B2 і C1.',
};

/* ---------- 2. Дані ---------- */

let DCL = null;
let dclLoading = null;

function normScenario(s) {
  // Сумісність зі старим форматом: model → models, рядки в check/checklist → об'єкти
  const ex = EXAMS[s.exam] ? s.exam : (s.level === 'B1' || s.level === 'B2' ? 'FLE' : 'FP');
  s.exam = ex;
  const tags = EXAMS[ex].tags;
  (s.questions || []).forEach((q) => { q.part ||= 'lecture'; q.lvl ||= tags[0]; });
  ((s.oral && s.oral.turns) || []).forEach((t, i) => {
    if (!t.models && t.model) t.models = { [tags[tags.length - 1]]: t.model };
    t.models ||= {};
    t.phase ||= i < 2 ? 3 : 4;
    t.check = (t.check || []).map((c) => (typeof c === 'string' ? { lvl: tags[0], t: c } : c));
  });
  const w = (s.writing ||= {});
  if (!w.models && w.model) w.models = { [tags[tags.length - 1]]: w.model };
  w.models ||= {};
  w.checklist = (w.checklist || []).map((c) => (typeof c === 'string' ? { lvl: tags[0], t: c } : c));
  return s;
}

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
      DCL = { scenarios: scen.filter((s) => s && s.id).map(normScenario), phrases, grammar };
      return DCL;
    })().catch((e) => { dclLoading = null; throw e; });
  }
  return dclLoading;
}
const getScen = (id) => DCL && DCL.scenarios.find((s) => s.id === id);
const scenariosOf = (ex) => DCL.scenarios.filter((s) => s.exam === ex);

/* ---------- 3. Прогрес у state ---------- */

function dclState() {
  const d = (state.dcl ||= {});
  if (!GOALS.includes(d.goal)) d.goal = 'B2';
  d.rate ||= 0.9;
  d.scen ||= {};
  d.exams ||= [];
  // старі іспити (до поділу FP / FLE) мали рівні A1 / A2 / B1 без підрівнів
  d.exams = d.exams.filter((e) => e && e.date).map((e) => {
    const fix = (l) => (SCALE.includes(l) || l === '<A2' ? l : l === 'B1' ? 'B1.1' : null);
    if (!e.exam) e.exam = ['A1', 'A2'].includes(e.level) && !e.levels ? 'FP' : 'FLE';
    e.level = fix(e.level) || EXAMS[e.exam].below;
    if (e.levels) Object.keys(e.levels).forEach((k) => { e.levels[k] = fix(e.levels[k]); });
    return e;
  });
  d.grammar ||= {};
  return d;
}
const scenState = (id) => {
  const S = (dclState().scen[id] ||= {});
  S.levels ||= {}; S.answers ||= {}; S.oral ||= {}; S.oralGrid ||= {}; S.wchecks ||= []; S.wgrid ||= {};
  if (S.writing == null) S.writing = '';
  return S;
};
const goalExam = () => (dclState().goal === 'A2' ? 'FP' : 'FLE');
function countActivity() { const day = dayOf(); day.dcl = (day.dcl || 0) + 1; }

/* ---------- 4. Оцінювання ---------- */

// Рівень за часткою виконаних завдань кожного рівня (тегу)
function levelFromItems(ex, items) {
  const frac = {};
  EXAMS[ex].tags.forEach((t) => {
    const its = items.filter((i) => i.lvl === t);
    frac[t] = its.length ? its.filter((i) => i.ok).length / its.length : 0;
  });
  let got = EXAMS[ex].below;
  for (const [lvl, req] of RULES[ex]) {
    if (Object.entries(req).every(([t, min]) => (frac[t] ?? 0) >= min)) got = lvl; else break;
  }
  return { level: got, frac };
}
// Рівень за сіткою критеріїв: медіана обраних рівнів (null, якщо заповнено не все)
function levelFromGrid(ex, part, sel) {
  const crit = GRID[ex][part];
  const vals = crit.map((c) => sel && sel[c.id]).filter(Boolean).map(ord).sort((a, b) => a - b);
  if (vals.length < crit.length) return null;
  return SCALE[vals[Math.floor((vals.length - 1) / 2)]];
}
const minLevel = (a, b) => (a == null ? b : b == null ? a : (ord(a) <= ord(b) ? a : b));

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

// Автоперевірки письма — рахуються як завдання (звертання/формула — найнижчий рівень, обсяг — другий)
function writingAuto(s, text) {
  const w = s.writing;
  const tags = EXAMS[s.exam].tags;
  const n = wordCount(text);
  const res = [{ lvl: tags[1] || tags[0], t: `Обсяг: ${n} ${plural(n, 'слово', 'слова', 'слів')} (потрібно ${w.minWords}–${w.maxWords})`, ok: n >= w.minWords && n <= Math.round(w.maxWords * 1.3) }];
  if (['email', 'lettre'].includes(w.format)) {
    res.push({ lvl: tags[0], t: 'Є звертання (Bonjour, Madame, Monsieur…)',
      ok: /(^|\n)\s*(bonjour|bonsoir|madame|monsieur|cher|chère|salut|mesdames|à toutes|à tous)/i.test(text) });
    res.push({ lvl: tags[0], t: 'Є завершальна формула (Cordialement, Bien à vous…)',
      ok: /(cordialement|bien à vous|salutations|à bientôt|bonne journée|bonne soirée|amicalement|merci d'avance|je vous prie|veuillez agréer|à lundi|à samedi|bises)/i.test(text) });
  }
  return res;
}

function compScore(s, part, answers) {
  const items = (s.questions || []).map((q, i) => ({ q, i })).filter((x) => x.q.part === part)
    .map(({ q, i }) => ({ lvl: q.lvl, ok: isRight(q, answers[i]), q, i }));
  const { level, frac } = levelFromItems(s.exam, items);
  return { level, frac, items, pct: items.length ? Math.round(items.filter((x) => x.ok).length / items.length * 100) : 0 };
}
function oralScore(s, checks, grid, recorded) {
  const items = [];
  s.oral.turns.forEach((t, ti) => t.check.forEach((c, ci) => items.push({ lvl: c.lvl, t: c.t, ok: !!(recorded(ti) && checks[ti] && checks[ti][ci]) })));
  const task = levelFromItems(s.exam, items);
  const g = levelFromGrid(s.exam, 'oral', grid);
  return { task: task.level, grid: g, level: minLevel(task.level, g), items, frac: task.frac, sel: grid,
    pct: items.length ? Math.round(items.filter((x) => x.ok).length / items.length * 100) : 0 };
}
function writingScore(s, text, checks, grid) {
  const empty = wordCount(text) < 5;
  const items = [...writingAuto(s, text).map((a) => ({ ...a, ok: a.ok && !empty })),
    ...s.writing.checklist.map((c, ci) => ({ lvl: c.lvl, t: c.t, ok: !empty && !!(checks && checks[ci]) }))];
  const task = levelFromItems(s.exam, items);
  const g = empty ? EXAMS[s.exam].below : levelFromGrid(s.exam, 'ecrit', grid);
  return { task: task.level, grid: g, level: minLevel(task.level, g), items, frac: task.frac, sel: grid,
    pct: items.length ? Math.round(items.filter((x) => x.ok).length / items.length * 100) : 0 };
}
// Загальний рівень: рівень, якого досягли щонайменше 3 з 4 частин (друге найменше значення)
function globalLevel(ex, levels) {
  const o = Object.values(levels).map(ord).sort((a, b) => a - b);
  const g = SCALE[o[1] ?? o[0] ?? 0];
  return ord(g) < ord(EXAMS[ex].levels[0]) ? EXAMS[ex].below : g;
}

/* ---------- 5. Озвучення (Web Speech API) і запис голосу ---------- */

let ttsToken = 0;
const hasTTS = 'speechSynthesis' in window;
if (hasTTS) speechSynthesis.getVoices();

function frVoices() { return hasTTS ? speechSynthesis.getVoices().filter((v) => /^fr([-_]|$)/i.test(v.lang)) : []; }
function pickVoice(gender) {
  const vs = frVoices();
  if (!vs.length) return null;
  const fr = vs.filter((v) => /fr[-_]FR/i.test(v.lang));
  const pool = fr.length ? fr : vs;
  const fem = /amélie|amelie|audrey|aurélie|aurelie|marie|julie|denise|hortense|virginie|céline|celine|léa|lea|chantal|sylvie|elsa|eloise|vivienne|google français|female|femme/i;
  const mal = /thomas|paul|henri|nicolas|claude|daniel|mathieu|jacques|antoine|remy|rémy|gerard|guillaume|male|homme/i;
  if (gender === 'm') return pool.find((v) => mal.test(v.name)) || pool[1] || pool[0];
  return pool.find((v) => fem.test(v.name)) || pool[0];
}
// Читає текст або діалог [{voice, text}] французькими голосами
function speak(content, { voice = 'f', rate, onend } = {}) {
  if (!hasTTS) { toast('Браузер не вміє озвучувати текст'); if (onend) onend(); return; }
  speechSynthesis.cancel();
  const token = ++ttsToken;
  const lines = Array.isArray(content) ? content : [{ voice, text: content }];
  if (!frVoices().length) toast('Немає французького голосу. Додайте французьку мову озвучування в налаштуваннях системи.');
  const r = rate || dclState().rate || 0.9;
  const all = [];
  lines.forEach((ln) => {
    const v = pickVoice(ln.voice || 'f');
    const same = v && ln.voice === 'm' && v === pickVoice('f');
    (String(ln.text).match(/[^.!?…]+[.!?…]*["»)]?\s*/g) || [String(ln.text)]).forEach((p) => {
      const u = new SpeechSynthesisUtterance(p.trim());
      u.lang = 'fr-FR'; if (v) u.voice = v; u.rate = r;
      if (same) u.pitch = 0.75; // той самий голос, але нижчий — «чоловічий»
      all.push(u);
    });
  });
  if (all.length) all[all.length - 1].onend = () => { if (token === ttsToken && onend) onend(); };
  all.forEach((u) => speechSynthesis.speak(u));
}
function stopSpeak() { ttsToken++; if (hasTTS) speechSynthesis.cancel(); }
const audioContent = (a) => (a.dialog ? a.dialog.map((d) => ({ voice: d.voice, text: d.text })) : a.text);

const dRecs = {};
let dRec = null, dRecStream = null, dRecChunks = [], dRecLimit = null;
function dRecStop(silent) {
  clearTimeout(dRecLimit);
  if (dRec && dRec.state === 'recording') { if (silent) dRec.onstop = null; dRec.stop(); }
  if (dRecStream) { dRecStream.getTracks().forEach((t) => t.stop()); dRecStream = null; }
}
const isRecording = () => !!(dRec && dRec.state === 'recording');
async function dRecToggle(btn, onDone) {
  if (isRecording()) { dRecStop(false); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { toast('Цей браузер не підтримує запис голосу'); return; }
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
    dRec = null; toast('Не вдалося почати запис. Перевірте мікрофон.'); return;
  }
  btn.classList.add('on');
  btn.textContent = '⏹ Зупинити запис';
  dRecLimit = setTimeout(() => dRecStop(false), 180000);
}

/* ---------- 6. Спільні шматки інтерфейсу ---------- */

const lvlTag = (l, cls = 'lvl') => `<span class="tag ${cls}">${esc(lvlName(l))}</span>`;
const examTag = (ex) => `<span class="tag lvl">${esc(EXAMS[ex].name)} · ${esc(EXAMS[ex].range)}</span>`;
const topicTag = (t) => { const x = DCL_TOPICS[t] || DCL_TOPICS.societe; return `<span class="tag">${x.icon} ${esc(x.label)}</span>`; };
const docIcon = (t) => ({ email: '✉️', annonce: '📌', affiche: '🪧', horaires: '🕒', menu: '🍽️', sms: '💬', note: '📝', fiche: '📋' }[t] || '📄');
const docHtml = (d) => `<div class="doc doc-${esc(d.type || 'note')}"><div class="doc-title">${docIcon(d.type)} ${esc(d.title || '')}</div><div class="doc-text" lang="fr">${esc(d.text)}</div></div>`;

function vocabHtml(list) {
  return `<div class="kw">${(list || []).map((k) => `
    <div class="kw-row">
      <div class="grow"><div class="kw-fr" lang="fr">${esc(k.fr)}</div><div class="kw-uk">${esc(k.uk)}</div></div>
      <button class="mini" type="button" data-act="dsay" data-text="${esc(k.fr)}" aria-label="Вимова">🔊</button>
      <button class="mini ${hasWord(k.fr) ? 'added' : ''}" type="button" data-act="daddword" data-fr="${esc(k.fr)}" data-uk="${esc(k.uk)}" aria-label="У словник">${hasWord(k.fr) ? '✓' : '＋'}</button>
    </div>`).join('')}</div>`;
}

let playingKey = null;
function audioHtml(s, showText) {
  const rate = dclState().rate;
  return `
    <div class="row small muted" style="margin-bottom:8px">Швидкість:
      <div class="seg" role="group">${[0.8, 0.9, 1].map((r) => `<button type="button" data-act="drate" data-rate="${r}" class="${r === rate ? 'on' : ''}">${r === 1 ? '1×' : r + '×'}</button>`).join('')}</div>
    </div>
    ${(s.audio || []).map((a, i) => `
      <div class="doc doc-audio">
        <div class="doc-title">🎧 ${esc(a.title || 'Audio ' + (i + 1))}${a.dialog ? ` <span class="small muted">· діалог, ${new Set(a.dialog.map((d) => d.who)).size} мовці</span>` : ''}</div>
        <button class="btn primary" type="button" data-act="dplay" data-i="${i}" data-id="${esc(s.id)}">${playingKey === s.id + ':' + i ? '⏹ Стоп' : '▶ Слухати'}</button>
        ${showText ? `<details style="margin-top:10px"><summary class="small muted">Показати текст (після кількох прослуховувань)</summary>
          <div class="doc-text" lang="fr" style="margin-top:8px">${a.dialog ? a.dialog.map((d) => `${esc(d.who || '')} : ${esc(d.text)}`).join('\n') : esc(a.text)}</div></details>` : ''}
      </div>`).join('')}
    ${hasTTS ? '' : '<p class="tip">Цей браузер не підтримує озвучення. Спробуйте Chrome, Edge або Safari.</p>'}`;
}
function modelsHtml(models) {
  const keys = Object.keys(models || {});
  if (!keys.length) return '';
  const goal = dclState().goal;
  return `<div class="models">${keys.map((k) => `
    <details class="model" ${keys.length === 1 || k === goal || (goal === 'B1.2' && k === 'B1') ? 'open' : ''}>
      <summary><b>Зразок ${esc(k)}</b></summary>
      <p lang="fr" class="doc-text" style="margin-top:6px">${esc(models[k])}</p>
      <button class="btn sm" type="button" data-act="dsay" data-text="${esc(models[k])}">🔊 Прослухати</button>
    </details>`).join('')}</div>`;
}
function checklistHtml(items, act, sel, ctx, disabled) {
  return `<div class="checks">${items.map((c, ci) => `
    <label class="check"><input type="checkbox" data-act="${act}" ${ctx} data-c="${ci}" ${sel && sel[ci] ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
      ${lvlTag(c.lvl, 'lvl sm-tag')} <span>${esc(c.t)}</span></label>`).join('')}</div>`;
}
function gridHtml(ex, part, sel, act, ctx) {
  return `<div class="grid-crit">${GRID[ex][part].map((c) => `
    ${c.group ? `<h3 class="grid-group">${esc(c.group)}</h3>` : ''}
    <fieldset class="crit"><legend>${esc(c.name)}</legend>
      ${EXAMS[ex].levels.map((l) => `
        <label class="descr ${sel && sel[c.id] === l ? 'on' : ''}"><input type="radio" name="g-${part}-${c.id}" data-act="${act}" ${ctx} data-crit="${c.id}" data-l="${l}" ${sel && sel[c.id] === l ? 'checked' : ''}>
          <b>${esc(l)}</b> <span>${esc(c.d[l])}</span></label>`).join('')}
    </fieldset>`).join('')}</div>`;
}
function productionResultHtml(sc) {
  if (!sc.grid) return '<p class="tip">Оберіть рівень для кожного критерію сітки — тоді з\'явиться оцінка.</p>';
  return `<div class="card result-mini"><div>Рівень: <b class="pct" style="font-size:1.4rem">${esc(lvlName(sc.level))}</b></div>
    <div class="small muted">за завданнями: ${esc(lvlName(sc.task))} · за сіткою критеріїв: ${esc(lvlName(sc.grid))} (рахується нижчий)</div></div>`;
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
  const s = getScen(el.dataset.id);
  const key = s.id + ':' + el.dataset.i;
  const reset = () => { playingKey = null; $$('[data-act="dplay"]').forEach((b) => { b.textContent = '▶ Слухати'; }); };
  if (playingKey === key) { stopSpeak(); reset(); return; }
  reset();
  playingKey = key;
  el.textContent = '⏹ Стоп';
  const a = s.audio[Number(el.dataset.i)];
  speak(audioContent(a), { voice: a.voice || 'f', onend: reset });
};

/* ---------- 7. Головна DCL ---------- */

const bestExam = (scenId) => dclState().exams.filter((e) => e.scen === scenId).sort((a, b) => ord(b.level) - ord(a.level))[0];
function scenCard(s) {
  const S = dclState().scen[s.id];
  const best = bestExam(s.id);
  return `<div class="card scen">
    <div class="row"><b class="grow">${esc(s.title)}</b>${best ? lvlTag(best.level, 'good') : ''}</div>
    <div class="small muted">${esc(s.titleUk || '')}</div>
    <div class="meta">${topicTag(s.topic)}${S && S.done ? '<span class="tag good">✓ тренування</span>' : ''}</div>
    <div class="row" style="margin-top:10px">
      <a class="btn primary grow" href="#/dcl/x/${esc(s.id)}">⏱ Іспит</a>
      <a class="btn grow" href="#/dcl/s/${esc(s.id)}/mission">Тренування</a>
    </div>
  </div>`;
}
function examBlock(ex) {
  const E = EXAMS[ex];
  const t = E.times;
  return `
    <section class="card exam-block section">
      <div class="row"><h2 class="grow">${E.name}</h2><span class="tag lvl">${E.range}</span></div>
      <p class="small muted" style="margin-top:2px" lang="fr">${E.full}</p>
      <p class="small" style="margin-top:8px">${E.total === 150 ? '2 год 30' : '1 год 30'} · рівні за результатом: <b>${E.levels.map(lvlName).join(' · ')}</b></p>
      <div class="phasebar"><span style="flex:${t.p12}">Фази 1–2 · ${t.p12} хв</span><span style="flex:${t.p34 + 8}">3–4 · ${t.p34}</span><span style="flex:${t.p5}">5 · ${t.p5}</span></div>
      <div class="vlist">${scenariosOf(ex).map(scenCard).join('') || '<p class="muted">Поки немає сценаріїв.</p>'}</div>
    </section>`;
}
function viewDclHub() {
  document.title = 'DCL — Écoute';
  const d = dclState();
  app.innerHTML = `
    <h1>Підготовка до DCL</h1>
    <p class="muted" style="margin-top:4px">Diplôme de Compétence en Langue — іспит Міністерства освіти Франції. Рівні не складають окремо: один сценарій для всіх, рівень визначається результатом.</p>
    <div class="row" style="margin-top:14px">
      <span class="small muted">Моя мета:</span>
      <div class="seg" role="group">${GOALS.map((g) => `<button type="button" data-act="dgoal" data-g="${g}" class="${d.goal === g ? 'on' : ''}">${g}</button>`).join('')}</div>
    </div>
    ${dclTodayCardHtml(true)}
    <div class="tiles section">
      <a class="card tile" href="#/dcl/about"><span>❓</span><b>Що таке DCL</b><small>етапи, час, критерії</small></a>
      <a class="card tile" href="#/dcl/stats"><span>📈</span><b>Мій прогрес</b><small>графік рівнів, слабкі місця</small></a>
      <a class="card tile" href="#/dcl/phrases"><span>💬</span><b>Фрази</b><small>дзвінки, листи, переговори</small></a>
      <a class="card tile" href="#/dcl/grammar"><span>📐</span><b>Граматика</b><small>A1 – C1, з вправами</small></a>
    </div>
    ${examBlock('FLE')}
    ${examBlock('FP')}`;
}
actions.dgoal = (el) => { dclState().goal = el.dataset.g; dclState().today = null; save(); viewDclHub(); };

/* ---------- 8. Що таке DCL ---------- */

function viewDclAbout() {
  document.title = 'Що таке DCL — Écoute';
  const phaseRows = (E) => `
    <div class="phase"><b>Фаза 1 · Читання</b><span>Ситуація, місія і документи; «grille de lecture» — таблиця ключових фактів.</span></div>
    <div class="phase"><b>Фаза 2 · Слухання</b><span>Аудіо або відео; можна слухати скільки завгодно разів і робити нотатки.</span></div>
    <div class="phase time">Фази 1–2: <b>${E.times.p12 === 90 ? '1 год 30' : '1 год'}</b>, з них ${E.prep} хв — підготовка до розмови</div>
    <div class="phase"><b>Фаза 3 · Ви представляєте</b><span>Ви самі телефонуєте співрозмовнику (телефон або відеозв'язок) і ${E.key === 'FLE' ? 'пропонуєте та обґрунтовуєте рішення' : 'передаєте зібрану інформацію'}.</span></div>
    <div class="phase"><b>Фаза 4 · Обговорення</b><span>${E.key === 'FLE' ? 'Співрозмовник подає нову інформацію, що може суперечити вашій пропозиції: запитання, контраргументи, переговори.' : 'Відповідаєте на запитання співрозмовника, уточнюєте.'}</span></div>
    <div class="phase time">Фази 3–4: <b>${E.key === 'FLE' ? 'до 20 хв' : '10 хв'}</b></div>
    <div class="phase"><b>Фаза 5 · Письмо</b><span>${E.key === 'FLE' ? 'Лист, звіт або записка з рекомендацією — з урахуванням усього, зокрема розмови.' : 'Коротке повідомлення з інформацією, зібраною у фазах 1–4.'}</span></div>
    <div class="phase time">Фаза 5: <b>${E.times.p5} хв</b></div>`;
  app.innerHTML = `
    <a class="back" href="#/dcl">← DCL</a>
    <h1>Що таке DCL</h1>
    <section class="card section stack">
      <p><b>DCL</b> — національний професійний диплом Міністерства освіти Франції для дорослих. Він перевіряє, чи вмієте ви <b>використовувати мову, щоб виконати місію</b> в ситуації, близькій до роботи: зібрати інформацію з документів і записів, зателефонувати, обґрунтувати рекомендацію, написати текст.</p>
      <p>З французької є два іспити. <b>Рівень не обирають заздалегідь</b>: усі на сесії складають той самий сценарій, а журі присуджує рівень за результатом. Диплом безстроковий; у результатах — загальний рівень і профіль за кожною складовою мови.</p>
    </section>
    <div class="two-col">
      <section class="card section"><h2>DCL FP</h2><p class="small muted" lang="fr">Français professionnel de premier niveau</p>
        <p style="margin-top:8px">1 год 30 · рівні <b>A1 · A2.1 · A2</b></p><div class="phases">${phaseRows(EXAMS.FP)}</div></section>
      <section class="card section"><h2>DCL FLE</h2><p class="small muted" lang="fr">Français langue étrangère</p>
        <p style="margin-top:8px">2 год 30 · рівні <b>A2 · B1.1 · B1.2 · B2 · C1</b></p><div class="phases">${phaseRows(EXAMS.FLE)}</div></section>
    </div>
    <section class="card section stack">
      <h2>Як оцінюють</h2>
      <p>Оцінювання <b>позитивне й критеріальне</b>: для кожного критерію є опис того, що вміє кандидат кожного рівня. Екзаменатор заповнює сітку для усної та письмової частин.</p>
      <ul class="list">
        <li><b>Прагматичні критерії:</b> обробка інформації (точність, організація), виступ і обмін (представлення, запитання, реакція на несподіване), якість комунікації (регістр, культурні норми), виконання місії.</li>
        <li><b>Мовні критерії:</b> синтаксис, дієслівні форми, лексика, іменна група, вимова (усно), орфографія і пунктуація (письмово).</li>
        <li>Зважування: для кандидатів зі скромнішим рівнем більше важить <b>виконання місії</b>, для сильніших — <b>мовна точність</b>.</li>
      </ul>
      <p class="small muted">У застосунку читання і слухання перевіряються автоматично (кожне питання має рівень). Розмову і письмо ви оцінюєте самі — за чеклістом завдань з рівнями й за сіткою критеріїв, порівнюючи себе зі зразками B1, B2 і C1. Загальний рівень — той, якого досягли щонайменше 3 з 4 частин. Це наближення: справжнє журі зважує сітки за власною методикою.</p>
    </section>
    <section class="card section">
      <h2>Описи рівнів (Міністерство освіти)</h2>
      <div class="lvl-desc">
        <p><b>A1</b> — знаходить кілька простих фактів; відповідає на прості запитання за постійної допомоги співрозмовника.</p>
        <p><b>A2.1</b> — знаходить основну просту інформацію; простий обмін про передбачувані факти, з багатьма паузами.</p>
        <p><b>A2</b> — знаходить основну інформацію, перевіряє й доповнює її в простій розмові; просто пов'язує факти.</p>
        <p><b>B1.1</b> — відбирає корисну для місії інформацію; виклад має початок організації.</p>
        <p><b>B1.2</b> — обробляє доречну інформацію, відбирає й організовує її, щоб обґрунтувати вибір.</p>
        <p><b>B2</b> — ініціатива й самостійність в обробці та ієрархізації інформації; активно бере участь в обміні, несподіване не збиває; правильна і різноманітна мова.</p>
        <p><b>C1</b> — опрацьовує інформацію в усій складності для сильної аргументації; ефективно веде обмін, справляється з несподіваним і контраргументами; вільна, нюансована мова.</p>
      </div>
    </section>
    <section class="card section">
      <h2>DCL чи DELF?</h2>
      <div class="cmp">
        <div></div><b>DCL</b><b>DELF</b>
        <span>Рівень</span><span>один іспит для всіх, рівень — за результатом</span><span>окремий іспит на кожен рівень, обираєте заздалегідь</span>
        <span>Формат</span><span>одна пов'язана місія: читання → слухання → дзвінок → письмо</span><span>чотири незалежні частини</span>
        <span>Теми</span><span>професійні й практичні ситуації</span><span>загальні теми</span>
        <span>Хто видає</span><span>Міністерство освіти Франції</span><span>France Éducation international</span>
        <span>Ризик</span><span>немає «провалу»: отримуєте рівень, який показали</span><span>без прохідного бала диплома немає</span>
      </div>
    </section>
    <p class="small muted section">Дати сесій і вартість перевіряйте перед реєстрацією:
      <a href="https://www.education.gouv.fr/le-diplome-de-competence-en-langue-dcl-candidats-l-examen-11624" target="_blank" rel="noopener">education.gouv.fr — DCL ↗</a></p>`;
}

/* ---------- 9. Тренування на сьогодні ---------- */

// Найкращий рівень кожної частини: останній іспит + тренування (для іспиту, що відповідає меті)
function latestPartLevels() {
  const d = dclState();
  const ex = goalExam();
  const out = {};
  const last = d.exams.find((e) => e.exam === ex);
  if (last && last.levels) Object.assign(out, last.levels);
  Object.entries(d.scen).forEach(([id, S]) => {
    const s = getScen(id);
    if (!s || s.exam !== ex) return;
    Object.entries(S.levels || {}).forEach(([k, v]) => { if (out[k] == null || ord(v) > ord(out[k])) out[k] = v; });
  });
  return out;
}
function todayPlan() {
  const d = dclState();
  const t = todayStr();
  if (d.today && d.today.date === t && getScen(d.today.scen)) return d.today;
  const ex = goalExam();
  const pool = scenariosOf(ex).length ? scenariosOf(ex) : DCL.scenarios;
  const dayNum = Math.floor(Date.now() / 864e5);
  const skills = Object.keys(SKILLS);
  const lv = latestPartLevels();
  // найслабша частина, яка ще не досягла мети
  const below = skills.filter((k) => lv[k] == null || ord(lv[k]) < ord(d.goal));
  let part = skills[dayNum % 4];
  if (below.length) part = below.sort((a, b) => (lv[a] == null ? -1 : ord(lv[a])) - (lv[b] == null ? -1 : ord(lv[b])))[0];
  const val = (s) => { const S = d.scen[s.id]; return S && S.levels && S.levels[part] ? ord(S.levels[part]) : -1; };
  const scen = pool.slice().sort((a, b) => val(a) - val(b))[0];
  const want = ex === 'FP' ? ['A1', 'A2'] : ['B1', 'B2', 'C1'];
  const ph = DCL.phrases.phrases.filter((p) => want.includes(p.level));
  const start = ph.length ? (dayNum * 8) % ph.length : 0;
  const picks = Array.from({ length: Math.min(8, ph.length) }, (_, i) => ph[(start + i) % ph.length].id);
  d.today = { date: t, scen: scen.id, part, phrases: picks, partDone: false, phrasesDone: false, counted: false };
  save();
  return d.today;
}
function checkTodayDone() {
  const t = dclState().today;
  if (t && t.date === todayStr() && t.partDone && t.phrasesDone && !t.counted) {
    t.counted = true; save();
    setTimeout(() => toast('🎯 Тренування DCL на сьогодні виконано!'), 300);
  }
}
function markPracticeLevel(scenId, part, level) {
  const S = scenState(scenId);
  if (!S.levels[part] || ord(level) > ord(S.levels[part])) S.levels[part] = level;
  S.updatedAt = Date.now();
  countActivity();
  const t = dclState().today;
  if (t && t.date === todayStr() && t.scen === scenId && t.part === part) t.partDone = true;
  checkTodayDone();
  save();
}

function dclTodayCardHtml(inHub) {
  const t = state.dcl && state.dcl.today;
  const fresh = t && t.date === todayStr();
  const done = fresh && t.counted;
  const scen = DCL && fresh ? getScen(t.scen) : null;
  const goal = (state.dcl && state.dcl.goal) || 'B2';
  return `
    <a class="card today-dcl ${inHub ? 'section' : ''}" href="#/dcl/today">
      <span class="big-ico">${done ? '✅' : '🎯'}</span>
      <div class="grow"><b>Тренування DCL на сьогодні</b>
        <div class="small muted">${done ? 'Виконано — чудово!' : scen ? `${SKILLS[t.part].icon} ${SKILLS[t.part].label} (мета ${esc(goal)}) · ${esc(scen.title)} + 8 фраз` : `15–20 хв: найслабша частина (мета ${esc(goal)}) + фрази`}</div>
      </div><span aria-hidden="true">→</span>
    </a>`;
}
window.dclHomeCard = () => dclTodayCardHtml(false);

function viewDclToday() {
  document.title = 'DCL сьогодні — Écoute';
  const p = todayPlan();
  const s = getScen(p.scen);
  const lv = latestPartLevels();
  const goal = dclState().goal;
  app.innerHTML = `
    <a class="back" href="#/dcl">← DCL</a>
    <h1>Тренування на сьогодні</h1>
    <p class="muted" style="margin-top:4px">≈ 15–20 хв · мета ${esc(goal)} · обрано частину, яка найбільше відстає від мети</p>
    <div class="meta">${Object.entries(SKILLS).map(([k, x]) => `<span class="tag ${lv[k] && ord(lv[k]) >= ord(goal) ? 'good' : ''}">${x.icon} ${x.label}: ${esc(lvlName(lv[k]))}</span>`).join('')}</div>
    <section class="card section">
      <div class="section-title"><span class="step">${p.partDone ? '✓' : '1'}</span><h2>${SKILLS[p.part].icon} ${SKILLS[p.part].label} · 10–12 хв</h2></div>
      <p><b>${esc(s.title)}</b> <span class="muted">— ${esc(s.titleUk || '')}</span></p>
      <div class="meta">${examTag(s.exam)}${topicTag(s.topic)}</div>
      <p class="small muted" style="margin-top:8px">Спершу коротко прочитайте місію${p.part === 'oral' || p.part === 'ecrit' ? ' і документи' : ''}, потім виконайте частину. Наприкінці застосунок оцінить її рівень.</p>
      <div class="row" style="margin-top:10px">
        <a class="btn ${p.partDone ? '' : 'primary'} grow" href="#/dcl/s/${esc(s.id)}/${p.part}">${p.partDone ? 'Повторити' : 'Почати'} →</a>
        <a class="btn" href="#/dcl/s/${esc(s.id)}/mission">Місія</a>
      </div>
    </section>
    <section class="card section">
      <div class="section-title"><span class="step">${p.phrasesDone ? '✓' : '2'}</span><h2>💬 8 фраз · 5 хв</h2></div>
      <p class="small muted">Бачите переклад — згадайте фразу французькою, переверніть картку і промовте її вголос.</p>
      <div id="drill" style="margin-top:10px"></div>
    </section>
    ${p.counted ? '<div class="card section center"><b>✅ На сьогодні все!</b></div>' : ''}`;
  startDrill(p.phrases, 'today');
}

/* --- Тренажер фраз --- */

let drill = null;
function startDrill(ids, from) { drill = { ids, i: 0, flipped: false, from }; renderDrill(); }
function renderDrill() {
  const box = $('#drill');
  if (!box || !drill) return;
  if (drill.i >= drill.ids.length) {
    box.innerHTML = `<div class="center stack"><b>Готово! ${drill.ids.length} ${plural(drill.ids.length, 'фраза', 'фрази', 'фраз')}.</b>
      <button class="btn" type="button" data-act="ddrillagain">🔁 Ще раз</button></div>`;
    if (drill.from === 'today') {
      const t = dclState().today;
      if (t && !t.phrasesDone) { t.phrasesDone = true; countActivity(); save(); checkTodayDone(); }
    }
    return;
  }
  const ph = DCL.phrases.phrases.find((p) => p.id === drill.ids[drill.i]);
  box.innerHTML = `
    <div class="row small muted"><span class="grow">${DCL.phrases.categories[ph.cat] || ''} · ${ph.channel === 'tel' ? '📞 телефон' : ph.channel === 'ecrit' ? '✉️ лист' : '📞✉️'} · ${ph.level}</span><span>${drill.i + 1} / ${drill.ids.length}</span></div>
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
  drill.flipped = true; renderDrill();
  speak(DCL.phrases.phrases.find((p) => p.id === drill.ids[drill.i]).fr);
};
actions.ddrillnext = () => { drill.i++; drill.flipped = false; renderDrill(); };
actions.ddrillagain = () => { drill.i = 0; drill.flipped = false; drill.ids = shuffle(drill.ids); renderDrill(); };

/* ---------- 10. Тренування по частинах (з підказками) ---------- */

const oralIdx = {};
const partQuestions = (s, part) => (s.questions || []).map((q, i) => ({ q, i })).filter((x) => x.q.part === part);
function stepDone(s, step) {
  const S = dclState().scen[s.id];
  if (!S) return false;
  if (SKILLS[step]) return !!(S.levels && S.levels[step]);
  return step === 'videos' ? !!S.done : false;
}

function viewScenario(id, step) {
  const s = getScen(id);
  if (!s) { app.innerHTML = '<a class="back" href="#/dcl">← DCL</a><div class="card"><h2>Сценарій не знайдено</h2><p class="muted">Перевірте назву файлу в dcl/index.json.</p></div>'; return; }
  if (!STEPS.some(([k]) => k === step)) step = 'mission';
  document.title = s.title + ' — DCL';
  const S = scenState(s.id);
  const i = STEPS.findIndex(([k]) => k === step);
  const nx = STEPS[i + 1];
  const nextBtn = nx && !['oral', 'ecrit', 'videos'].includes(step) ? `<a class="btn primary big block" href="#/dcl/s/${esc(s.id)}/${nx[0]}" style="margin-top:16px">Далі: ${nx[1]} →</a>` : '';
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
      <p class="tip">💡 Спершу з'ясуйте: хто я, яка моя місія, з ким я говоритиму і кому писатиму.</p>`;
  } else if (step === 'lecture' || step === 'ecoute') {
    body = `
      <details class="card section"><summary><b>Місія</b> <span class="small muted">(нагадування)</span></summary><p lang="fr" style="margin-top:8px">${esc(s.mission)}</p></details>
      <section class="section stack">${step === 'lecture' ? (s.documents || []).map(docHtml).join('') : audioHtml(s, true)}</section>
      <section class="card section"><h2>Питання</h2><p class="small muted">Кожне питання має рівень — від простого факту до висновку з кількох джерел.</p><div id="qbox">${practiceQuestionsHtml(s, step)}</div></section>`;
  } else if (step === 'oral') {
    body = `<section class="card section stack"><p>${esc(s.oral.intro || '')}</p><p class="small"><b>Співрозмовник:</b> <span lang="fr">${esc(s.interlocutor || '')}</span></p></section>
      <div id="oralbox">${practiceOralHtml(s)}</div>`;
  } else if (step === 'ecrit') {
    body = practiceWritingHtml(s);
  } else {
    body = relatedVideosHtml(s);
  }
  app.innerHTML = `
    <a class="back" href="#/dcl">← DCL</a>
    <h1>${esc(s.title)}</h1>
    <div class="small muted">${esc(s.titleUk || '')} · тренування з підказками</div>
    <div class="meta">${examTag(s.exam)}${topicTag(s.topic)}</div>
    <nav class="chips steps">${STEPS.map(([k, l]) => `<a class="chip ${k === step ? 'on' : ''}" href="#/dcl/s/${esc(s.id)}/${k}">${stepDone(s, k) ? '✓ ' : ''}${l}${S.levels[k] ? ' · ' + esc(S.levels[k]) : ''}</a>`).join('')}</nav>
    ${body}${nextBtn}`;
  if (step === 'ecrit') updateWordCounter(s);
}

function practiceQuestionsHtml(s, part) {
  const S = scenState(s.id);
  const qs = partQuestions(s, part);
  if (!qs.length) return '<p class="muted">Для цієї частини немає питань.</p>';
  const html = qs.map(({ q, i }, n) => {
    const a = S.answers[i];
    const done = a !== undefined;
    const head = `<p>${n + 1}. ${lvlTag(q.lvl, 'lvl sm-tag')} <span lang="fr">${esc(q.q)}</span></p>`;
    if (q.options) {
      return `<div class="quiz-q">${head}${q.options.map((o, oi) => {
        let cls = ''; if (done && oi === q.answer) cls = 'right'; else if (done && oi === Number(a)) cls = 'wrong';
        return `<button type="button" class="opt ${cls}" data-act="dans" data-id="${esc(s.id)}" data-q="${i}" data-o="${oi}" data-part="${part}" ${done ? 'disabled' : ''} lang="fr">${esc(o)}</button>`;
      }).join('')}</div>`;
    }
    const ok = done && isRight(q, a);
    return `<div class="quiz-q">${head}
      <div class="row"><input class="input grow" data-qin="${i}" lang="fr" autocomplete="off" value="${esc(done ? a : '')}" ${done ? 'disabled' : ''}>
      ${done ? '' : `<button class="btn" type="button" data-act="dansin" data-id="${esc(s.id)}" data-q="${i}" data-part="${part}">OK</button>`}</div>
      ${done ? `<p class="small ${ok ? 'ok-text' : 'bad-text'}" style="margin-top:6px">${ok ? '✓ Правильно' : '✗ Правильно: ' + esc(q.accept[0])}</p>` : ''}</div>`;
  }).join('');
  if (!qs.every(({ i }) => S.answers[i] !== undefined)) return html;
  const sc = compScore(s, part, S.answers);
  return html + `<div class="card result-mini" style="margin-top:16px"><div class="row"><span class="grow">Рівень частини: <b class="pct" style="font-size:1.4rem">${esc(lvlName(sc.level))}</b></span>
      <button class="btn sm" type="button" data-act="dqreset" data-id="${esc(s.id)}" data-part="${part}">Ще раз</button></div>
      <div class="small muted">Виконано за рівнями: ${EXAMS[s.exam].tags.map((t) => `${t} — ${Math.round((sc.frac[t] || 0) * 100)} %`).join(' · ')}</div></div>`;
}
function afterPracticeAnswer(s, part) {
  const S = scenState(s.id);
  if (partQuestions(s, part).every(({ i }) => S.answers[i] !== undefined)) markPracticeLevel(s.id, part, compScore(s, part, S.answers).level);
  else save();
  $('#qbox').innerHTML = practiceQuestionsHtml(s, part);
}
actions.dans = (el) => { const s = getScen(el.dataset.id); scenState(s.id).answers[el.dataset.q] = Number(el.dataset.o); afterPracticeAnswer(s, el.dataset.part); };
actions.dansin = (el) => {
  const s = getScen(el.dataset.id);
  const v = $(`[data-qin="${el.dataset.q}"]`).value.trim();
  if (!v) { toast('Впишіть відповідь'); return; }
  scenState(s.id).answers[el.dataset.q] = v;
  afterPracticeAnswer(s, el.dataset.part);
};
actions.dqreset = (el) => {
  const s = getScen(el.dataset.id); const S = scenState(s.id);
  partQuestions(s, el.dataset.part).forEach(({ i }) => { delete S.answers[i]; });
  save(); $('#qbox').innerHTML = practiceQuestionsHtml(s, el.dataset.part);
};

/* --- Розмова (тренування) --- */

function practiceOralHtml(s) {
  const S = scenState(s.id);
  const turns = s.oral.turns;
  const cur = Math.min(oralIdx[s.id] || 0, turns.length);
  let html = turns.slice(0, cur).map((t, i) => `<div class="turn done-turn"><span class="small muted">Репліка ${i + 1} · фаза ${t.phase}</span><div lang="fr">🗨️ ${esc(t.examiner)}</div></div>`).join('');
  if (cur < turns.length) {
    const t = turns[cur];
    const key = `p:${s.id}:${cur}`;
    const rec = dRecs[key];
    const shown = rec || (S.oralShown && S.oralShown[cur]);
    html += `<section class="card section turn-now">
      <div class="row"><span class="tag lvl">Репліка ${cur + 1} / ${turns.length}</span><span class="tag">Фаза ${t.phase} · ${t.phase === 3 ? 'ви представляєте' : 'обговорення'}</span></div>
      <button class="btn primary block" type="button" data-act="dsayturn" data-id="${esc(s.id)}" style="margin-top:10px">🔊 Послухати співрозмовника</button>
      <details style="margin-top:8px"><summary class="small muted">Текст репліки</summary><p lang="fr" style="margin-top:6px">${esc(t.examiner)}</p></details>
      <p class="tip">💡 ${esc(t.task || '')}</p>
      <div class="row" style="margin-top:10px">
        <button class="btn rec" type="button" data-act="drec" data-key="${key}" data-id="${esc(s.id)}">${rec ? '🎙 Записати ще раз' : '🎙 Відповісти голосом'}</button>
        ${shown ? '' : `<button class="btn" type="button" data-act="dshowmodel" data-id="${esc(s.id)}">Показати зразки</button>`}
      </div>
      ${rec ? `<audio controls src="${rec}" style="width:100%;margin-top:10px"></audio>` : ''}
      ${shown ? `${modelsHtml(t.models)}
        <div class="small muted" style="margin-top:12px">Що вам вдалося? (рівень біля кожного пункту)</div>
        ${checklistHtml(t.check, 'doralcheck', S.oral[cur], `data-id="${esc(s.id)}" data-t="${cur}"`)}
        <button class="btn good block" type="button" data-act="dnextturn" data-id="${esc(s.id)}" style="margin-top:12px">${cur + 1 < turns.length ? 'Наступна репліка →' : 'Завершити розмову → оцінка'}</button>` : ''}
    </section>`;
  } else {
    const sc = oralScore(s, S.oral, S.oralGrid, () => true);
    html += `<section class="card section stack">
      <h2>Оцінка розмови за сіткою критеріїв</h2>
      <p class="small muted">Пригадайте свої відповіді (і записи) та оберіть для кожного критерію опис, який вам найбільше відповідає.</p>
      ${gridHtml(s.exam, 'oral', S.oralGrid, 'dpgrid', `data-id="${esc(s.id)}" data-part="oral"`)}
      <div id="oralres">${productionResultHtml(sc)}</div>
      <div class="row"><button class="btn" type="button" data-act="doralrestart" data-id="${esc(s.id)}">🔁 Пройти ще раз</button>
        <a class="btn primary grow" href="#/dcl/s/${esc(s.id)}/ecrit">Далі: Письмо →</a></div>
    </section>`;
  }
  return html;
}
const rerenderOral = (s) => { const b = $('#oralbox'); if (b) b.innerHTML = practiceOralHtml(s); };
actions.dsayturn = (el) => {
  const s = getScen(el.dataset.id);
  const t = s.oral.turns[Math.min(oralIdx[s.id] || 0, s.oral.turns.length - 1)];
  speak(t.examiner, { voice: t.voice || 'f' });
};
actions.drec = (el) => {
  const s = getScen(el.dataset.id);
  dRecToggle(el, (url) => { if (dRecs[el.dataset.key]) URL.revokeObjectURL(dRecs[el.dataset.key]); dRecs[el.dataset.key] = url; rerenderOral(s); });
};
actions.dshowmodel = (el) => { const s = getScen(el.dataset.id); (scenState(s.id).oralShown ||= {})[oralIdx[s.id] || 0] = true; rerenderOral(s); };
actions.doralcheck = (el) => { const S = scenState(el.dataset.id); (S.oral[el.dataset.t] ||= [])[Number(el.dataset.c)] = el.checked; save(); };
actions.dnextturn = (el) => {
  const s = getScen(el.dataset.id);
  oralIdx[s.id] = (oralIdx[s.id] || 0) + 1;
  if (oralIdx[s.id] < s.oral.turns.length) { const t = s.oral.turns[oralIdx[s.id]]; speak(t.examiner, { voice: t.voice || 'f' }); }
  save(); rerenderOral(s);
};
actions.dpgrid = (el) => {
  const s = getScen(el.dataset.id);
  const S = scenState(s.id);
  const oral = el.dataset.part === 'oral';
  (oral ? S.oralGrid : S.wgrid)[el.dataset.crit] = el.dataset.l;
  $$(`input[name="${el.name}"]`).forEach((r) => r.closest('.descr').classList.toggle('on', r.checked));
  const sc = oral ? oralScore(s, S.oral, S.oralGrid, () => true) : writingScore(s, S.writing, S.wchecks, S.wgrid);
  const box = $(oral ? '#oralres' : '#wres');
  if (box) box.innerHTML = productionResultHtml(sc);
  if (sc.grid) markPracticeLevel(s.id, el.dataset.part, sc.level); else save();
};
actions.doralrestart = (el) => {
  const s = getScen(el.dataset.id);
  oralIdx[s.id] = 0;
  Object.assign(scenState(s.id), { oral: {}, oralShown: {}, oralGrid: {} });
  Object.keys(dRecs).filter((k) => k.startsWith(`p:${s.id}:`)).forEach((k) => { URL.revokeObjectURL(dRecs[k]); delete dRecs[k]; });
  save(); rerenderOral(s);
};

/* --- Письмо (тренування) --- */

const FORMATS = { email: 'e-mail', lettre: 'лист', sms: 'SMS', note: 'записка', article: 'стаття' };
function practiceWritingHtml(s) {
  const w = s.writing;
  const S = scenState(s.id);
  return `
    <section class="card section stack">
      <h2>Завдання</h2>
      <p lang="fr" class="mission">${esc(w.task)}</p>
      <details><summary class="small muted">Переклад завдання</summary><p style="margin-top:6px">${esc(w.taskUk || '')}</p></details>
      <p class="small muted">Формат: <b>${esc(FORMATS[w.format] || w.format)}</b> · ${w.minWords}–${w.maxWords} слів · на іспиті ${EXAMS[s.exam].times.p5} хв</p>
    </section>
    <section class="card section">
      <textarea class="input write" id="dwrite" data-input="dwrite" data-id="${esc(s.id)}" lang="fr" spellcheck="false" placeholder="Écrivez ici…">${esc(S.writing || '')}</textarea>
      <div class="row small" style="margin-top:6px"><span id="wc" class="wc grow"></span><span class="muted">зберігається автоматично</span></div>
      <button class="btn primary block" type="button" data-act="dwcheckshow" data-id="${esc(s.id)}" style="margin-top:10px">Перевірити і порівняти зі зразками</button>
    </section>
    <div id="wfeedback">${S.wshown ? writingReviewHtml(s, S.writing, S.wchecks, S.wgrid, 'dwcheck', 'dpgrid', `data-id="${esc(s.id)}"`) : ''}</div>`;
}
function writingReviewHtml(s, text, checks, grid, checkAct, gridAct, ctx) {
  const auto = writingAuto(s, text);
  return `
    <section class="card section stack"><h2>Автоперевірка</h2>
      ${auto.map((a) => `<div class="${a.ok ? 'ok-text' : 'bad-text'}">${a.ok ? '✓' : '✗'} ${esc(a.t)}</div>`).join('')}</section>
    <section class="card section"><h2>Зразки відповідей</h2>${modelsHtml(s.writing.models)}</section>
    <section class="card section"><h2>Чекліст завдання</h2><p class="small muted">Позначте, що є у вашому тексті.</p>
      ${checklistHtml(s.writing.checklist, checkAct, checks, ctx)}</section>
    <section class="card section"><h2>Сітка критеріїв</h2><p class="small muted">Оберіть опис, що найкраще відповідає вашому тексту.</p>
      ${gridHtml(s.exam, 'ecrit', grid, gridAct, `${ctx} data-part="ecrit"`)}
      <div id="wres" style="margin-top:12px">${productionResultHtml(writingScore(s, text, checks, grid))}</div></section>`;
}
function updateWordCounter(s, text) {
  const el = $('#wc'); if (!el) return;
  const n = wordCount(text ?? ($('#dwrite') || {}).value);
  const w = s.writing;
  el.textContent = `${n} ${plural(n, 'слово', 'слова', 'слів')} · потрібно ${w.minWords}–${w.maxWords}`;
  el.className = 'wc grow ' + (n < w.minWords || n > w.maxWords * 1.3 ? 'bad-text' : 'ok-text');
}
inputs.dwrite = (el) => { const s = getScen(el.dataset.id); scenState(s.id).writing = el.value; updateWordCounter(s, el.value); save(); };
actions.dwcheckshow = (el) => {
  const s = getScen(el.dataset.id); const S = scenState(s.id);
  if (wordCount(S.writing) < 5) { toast('Спершу напишіть текст'); return; }
  S.wshown = true; save();
  $('#wfeedback').innerHTML = writingReviewHtml(s, S.writing, S.wchecks, S.wgrid, 'dwcheck', 'dpgrid', `data-id="${esc(s.id)}"`);
  $('#wfeedback').scrollIntoView({ behavior: 'smooth', block: 'start' });
};
actions.dwcheck = (el) => {
  const s = getScen(el.dataset.id); const S = scenState(s.id);
  S.wchecks[Number(el.dataset.c)] = el.checked;
  const sc = writingScore(s, S.writing, S.wchecks, S.wgrid);
  $('#wres').innerHTML = productionResultHtml(sc);
  if (sc.grid) markPracticeLevel(s.id, 'ecrit', sc.level); else save();
};

/* --- Відео на ту саму тему --- */

function relatedFor(s, n = 2) {
  const out = [];
  (s.relatedVideos || []).forEach((id) => { const v = getVideo(id); if (v && !out.includes(v)) out.push(v); });
  if (out.length < n) {
    const target = s.exam === 'FP' ? 'A2' : dclState().goal;
    const rank = (v) => (v.dclTopic === s.topic ? 0 : 3) + Math.abs(ord(v.dcl) - ord(target));
    allVideos().filter((v) => !out.includes(v) && v.dcl).sort((a, b) => rank(a) - rank(b)).slice(0, n - out.length).forEach((v) => out.push(v));
  }
  return out;
}
function relatedVideosHtml(s) {
  const S = scenState(s.id);
  return `
    <section class="card section stack"><h2>Підсумок тренування</h2>
      <div class="meta">${Object.entries(SKILLS).map(([k, x]) => `<span class="tag ${S.levels[k] ? 'good' : ''}">${x.icon} ${x.label}: ${esc(lvlName(S.levels[k]))}</span>`).join('')}</div>
      <button class="btn good big block" type="button" data-act="dscendone" data-id="${esc(s.id)}">${S.done ? '✓ Тренування зараховано' : '✓ Позначити тренування завершеним'}</button>
      <a class="btn primary block" href="#/dcl/x/${esc(s.id)}">⏱ Тепер — як на іспиті</a></section>
    <section class="section"><h2>Відео на ту саму тему</h2>
      <p class="small muted" style="margin:4px 0 10px">${esc((DCL_TOPICS[s.topic] || DCL_TOPICS.societe).label)} — закріпіть лексику на слух.</p>
      <div class="vlist">${relatedFor(s).map(videoCard).join('') || '<p class="muted">Немає відео з цією темою.</p>'}</div></section>`;
}
actions.dscendone = (el) => {
  const S = scenState(el.dataset.id);
  if (!S.done) countActivity();
  S.done = true; S.doneAt = Date.now(); save();
  toast('Тренування зараховано ✓');
  viewScenario(el.dataset.id, 'videos');
};

/* ---------- 11. Пробний іспит ---------- */

let examRun = null;   // поточний іспит (лише в пам'яті — не оновлюйте сторінку під час іспиту)
let examTimer = null;
const examActive = () => !!(examRun && ['p12', 'p34', 'p5', 'review'].includes(examRun.phase));

function viewExamStart(id) {
  const s = getScen(id);
  if (!s) { location.hash = '#/dcl'; return; }
  if (examActive()) { location.hash = '#/dcl/exam/run'; return; }
  document.title = 'Іспит — ' + s.title;
  const E = EXAMS[s.exam];
  const mode = dclState().examMode || 'full';
  const k = mode === 'short' ? 0.5 : 1;
  app.innerHTML = `
    <a class="back" href="#/dcl">← DCL</a>
    <h1>${esc(E.name)} · пробний іспит</h1>
    <p class="muted" style="margin-top:4px">${esc(s.title)} — ${esc(s.titleUk || '')}</p>
    <div class="meta">${examTag(s.exam)}${topicTag(s.topic)}</div>
    <section class="card section stack">
      <h2>Як на справжньому ${E.name}</h2>
      <div class="phases">
        <div class="phase"><b>Фази 1–2 · читання і слухання</b><span>${Math.round(E.times.p12 * k)} хв (з них ${Math.round(E.prep * k)} хв — підготовка до розмови: нотатки)</span></div>
        <div class="phase"><b>Фази 3–4 · телефонна розмова</b><span>${Math.round(E.times.p34 * k)} хв · ви телефонуєте, співрозмовник відповідає голосом</span></div>
        <div class="phase"><b>Фаза 5 · письмо</b><span>${Math.round(E.times.p5 * k)} хв · ${s.writing.minWords}–${s.writing.maxWords} слів</span></div>
      </div>
      <ul class="list small">
        <li>Без перекладу, підказок і правильних відповідей до кінця.</li>
        <li>Нотатки з фаз 1–2 залишаються з вами в розмові й письмі.</li>
        <li>Повернутися до попередньої фази не можна; завершити фазу раніше — можна.</li>
        <li>Потрібні навушники і мікрофон. Не оновлюйте сторінку під час іспиту.</li>
      </ul>
      <div class="seg" role="group">
        <button type="button" data-act="dexmode" data-m="full" data-id="${esc(s.id)}" class="${mode === 'full' ? 'on' : ''}">Повний час (${E.total} хв)</button>
        <button type="button" data-act="dexmode" data-m="short" data-id="${esc(s.id)}" class="${mode === 'short' ? 'on' : ''}">Скорочений (½)</button>
      </div>
    </section>
    <button class="btn primary big block" type="button" data-act="dexstart" data-id="${esc(s.id)}" style="margin-top:16px">▶ Почати іспит</button>`;
}
actions.dexmode = (el) => { dclState().examMode = el.dataset.m; save(); viewExamStart(el.dataset.id); };
actions.dexstart = (el) => {
  const s = getScen(el.dataset.id);
  examRun = { scen: s.id, exam: s.exam, mode: dclState().examMode || 'full', phase: 'p12', startedAt: Date.now(),
    answers: {}, notes: '', recs: {}, turn: 0, spoken: -1, writing: '', oral: {}, oralGrid: {}, wchecks: [], wgrid: {} };
  startPhase('p12');
  location.hash = '#/dcl/exam/run';
};
const phaseMinutes = (ph) => EXAMS[examRun.exam].times[ph] * (examRun.mode === 'short' ? 0.5 : 1);
function startPhase(ph) {
  examRun.phase = ph;
  examRun.ends = ['p12', 'p34', 'p5'].includes(ph) ? Date.now() + phaseMinutes(ph) * 60000 : null;
  stopSpeak(); dRecStop(false);
}
function ensureExamTimer() {
  if (examTimer) return;
  examTimer = setInterval(() => {
    if (!examRun || !examRun.ends) return;
    const left = Math.max(0, examRun.ends - Date.now());
    const el = $('#extimer');
    if (el) {
      el.textContent = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
      el.closest('.exbar').classList.toggle('late', left < 5 * 60000);
      const prep = $('#prepnote');
      if (prep && examRun.phase === 'p12') prep.classList.toggle('hidden', left > EXAMS[examRun.exam].prep * (examRun.mode === 'short' ? 0.5 : 1) * 60000);
    }
    if (left <= 0) {
      toast('⏰ Час цієї фази вийшов');
      startPhase({ p12: 'p34', p34: 'p5', p5: 'review' }[examRun.phase]);
      if (location.hash.startsWith('#/dcl/exam/run')) { viewExamRun(); window.scrollTo(0, 0); }
    }
  }, 1000);
}
const examHeader = (label) => `<div class="exbar"><span class="grow"><b>${label}</b></span>${examRun.ends ? '<span class="timer">⏱ <span id="extimer">…</span></span>' : ''}</div>`;
const notesHtml = (open) => `<details class="card section notes" ${open ? 'open' : ''}><summary><b>📝 Мої нотатки</b></summary>
  <textarea class="input" data-input="dexnotes" lang="fr" placeholder="Ключові факти, цифри, аргументи…" style="margin-top:8px;min-height:140px">${esc(examRun.notes)}</textarea></details>`;

function viewExamRun() {
  if (!examRun) { location.hash = '#/dcl'; return; }
  const s = getScen(examRun.scen);
  const E = EXAMS[s.exam];
  document.title = 'Іспит — DCL';
  ensureExamTimer();
  const R = examRun;
  let html = '';
  if (R.phase === 'p12') {
    html = examHeader(`${E.name} · Фази 1–2 · Читання і слухання`) + `
      <p class="tip hidden" id="prepnote">⏳ Залишилося ${Math.round(E.prep * (R.mode === 'short' ? 0.5 : 1))} хв або менше — час готуватися до розмови: запишіть у нотатки свою пропозицію і аргументи.</p>
      <section class="card section stack">
        <p lang="fr"><b>Situation :</b> ${esc(s.role)}</p>
        <div class="mission" lang="fr">${esc(s.mission)}</div>
        <p lang="fr" class="small"><b>Votre interlocuteur :</b> ${esc(s.interlocutor || '')}</p>
      </section>
      <h2 class="section">📄 Documents</h2><div class="stack" style="margin-top:10px">${(s.documents || []).map(docHtml).join('')}</div>
      <h2 class="section">🎧 Enregistrements</h2><div style="margin-top:10px">${audioHtml(s, false)}</div>
      <section class="card section"><h2>Grille de lecture et d'écoute</h2>${examQuestionsHtml(s)}</section>
      ${notesHtml(true)}
      <button class="btn primary big block" type="button" data-act="dexnext" style="margin-top:16px">Завершити фази 1–2 → Розмова</button>`;
  } else if (R.phase === 'p34') {
    const turns = s.oral.turns;
    const i = R.turn;
    const rec = R.recs[i];
    html = examHeader(`Фази 3–4 · Розмова · репліка ${i + 1}/${turns.length}`) + `
      <section class="card section stack">
        <p lang="fr"><b>Vous appelez :</b> ${esc(s.interlocutor || '')}</p>
        <p class="small muted">Слухайте співрозмовника, натисніть запис і відповідайте. Попросити повторити — нормально (як на іспиті).</p>
        <div class="row">
          <button class="btn" type="button" data-act="dexrepeat">🔁 Повторити репліку</button>
          <button class="btn rec" type="button" data-act="dexrec">${rec ? '🎙 Перезаписати' : '🎙 Відповісти'}</button>
        </div>
        ${rec ? `<audio controls src="${rec}" style="width:100%"></audio>` : ''}
        <button class="btn primary block" type="button" data-act="dexturn">${i + 1 < turns.length ? 'Наступна репліка →' : 'Завершити розмову → Письмо'}</button>
      </section>
      ${notesHtml(false)}`;
    if (R.spoken !== i) { R.spoken = i; setTimeout(() => speak(turns[i].examiner, { voice: turns[i].voice || 'f' }), 300); }
  } else if (R.phase === 'p5') {
    html = examHeader('Фаза 5 · Письмо') + `
      <section class="card section stack"><p lang="fr" class="mission">${esc(s.writing.task)}</p><p class="small muted">${s.writing.minWords}–${s.writing.maxWords} слів</p></section>
      <section class="card section">
        <textarea class="input write" id="dwrite" data-input="dexwrite" lang="fr" spellcheck="false" placeholder="Écrivez ici…">${esc(R.writing)}</textarea>
        <div class="row small" style="margin-top:6px"><span id="wc" class="wc grow"></span></div>
      </section>
      ${notesHtml(false)}
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
      ${q.options ? q.options.map((o, oi) => `<button type="button" class="opt ${a !== undefined && Number(a) === oi ? 'sel' : ''}" data-act="dexans" data-q="${i}" data-o="${oi}" lang="fr">${esc(o)}</button>`).join('')
        : `<input class="input" data-input="dexin" data-q="${i}" lang="fr" autocomplete="off" value="${esc(a || '')}">`}
    </div>`;
  }).join('');
}
actions.dexans = (el) => { examRun.answers[el.dataset.q] = Number(el.dataset.o); $$(`[data-act="dexans"][data-q="${el.dataset.q}"]`).forEach((b) => b.classList.toggle('sel', b === el)); };
inputs.dexin = (el) => { examRun.answers[el.dataset.q] = el.value; };
inputs.dexnotes = (el) => { examRun.notes = el.value; };
inputs.dexwrite = (el) => { examRun.writing = el.value; updateWordCounter(getScen(examRun.scen), el.value); };
actions.dexrepeat = () => { const t = getScen(examRun.scen).oral.turns[examRun.turn]; speak(t.examiner, { voice: t.voice || 'f' }); };
actions.dexrec = (el) => {
  const i = examRun.turn;
  dRecToggle(el, (url) => {
    if (!examRun) { URL.revokeObjectURL(url); return; }
    if (examRun.recs[i]) URL.revokeObjectURL(examRun.recs[i]);
    examRun.recs[i] = url; viewExamRun();
  });
};
actions.dexturn = () => {
  if (isRecording()) { toast('Спершу зупиніть запис'); return; }
  examRun.turn++;
  if (examRun.turn >= getScen(examRun.scen).oral.turns.length) startPhase('p5');
  viewExamRun(); window.scrollTo(0, 0);
};
actions.dexnext = () => {
  const s = getScen(examRun.scen);
  if (examRun.phase === 'p12') {
    const left = (s.questions || []).filter((_, i) => examRun.answers[i] === undefined || examRun.answers[i] === '').length;
    if (!confirm(left ? `Без відповіді: ${left}. Перейти до розмови? Повернутися буде не можна.` : 'Перейти до розмови? Повернутися до документів буде не можна.')) return;
    startPhase('p34');
  } else if (examRun.phase === 'p5') {
    if (!confirm('Здати роботу і перейти до оцінювання?')) return;
    startPhase('review');
  }
  viewExamRun(); window.scrollTo(0, 0);
};

function examReviewHtml(s) {
  const R = examRun;
  const lec = compScore(s, 'lecture', R.answers);
  const eco = compScore(s, 'ecoute', R.answers);
  return `
    <h1>Оцінювання</h1>
    <p class="muted" style="margin-top:4px">Читання і слухання перевірено автоматично. Розмову і письмо оцініть самі, чесно, як екзаменатор: послухайте записи, порівняйте зі зразками, позначте виконані завдання й оберіть рівень за кожним критерієм.</p>
    <section class="card section">
      <h2>📄 Читання: ${esc(lvlName(lec.level))} · 🎧 Слухання: ${esc(lvlName(eco.level))}</h2>
      <details style="margin-top:8px"><summary class="small muted">Мої відповіді</summary>
        ${(s.questions || []).map((q, i) => {
          const a = R.answers[i]; const ok = isRight(q, a);
          const mine = a === undefined || a === '' ? '—' : q.options ? q.options[Number(a)] : a;
          return `<div class="small" style="margin-top:8px">${lvlTag(q.lvl, 'lvl sm-tag')} <span lang="fr">${esc(q.q)}</span><br>
            <span class="${ok ? 'ok-text' : 'bad-text'}">${ok ? '✓' : '✗'} ${esc(mine)}</span>${ok ? '' : ` · <span class="ok-text">${esc(q.options ? q.options[q.answer] : q.accept[0])}</span>`}</div>`;
        }).join('')}</details>
    </section>
    <section class="section"><h2>🗣️ Розмова — завдання</h2>
      ${s.oral.turns.map((t, i) => `<div class="card section">
        <div class="small muted">Репліка ${i + 1} · фаза ${t.phase}</div><p lang="fr">🗨️ ${esc(t.examiner)}</p>
        ${R.recs[i] ? `<audio controls src="${R.recs[i]}" style="width:100%"></audio>` : '<p class="bad-text small">Немає запису — пункти цієї репліки не зараховуються.</p>'}
        ${modelsHtml(t.models)}
        ${checklistHtml(t.check, 'dexocheck', R.oral[i], `data-t="${i}"`, !R.recs[i])}
      </div>`).join('')}
      <div class="card section"><h2>🗣️ Розмова — сітка критеріїв</h2>${gridHtml(s.exam, 'oral', R.oralGrid, 'dexgrid', 'data-part="oral"')}</div>
    </section>
    <section class="section"><h2>✍️ Письмо</h2>
      <div class="card section"><div class="small muted">Мій текст:</div><div class="doc-text" lang="fr">${esc(R.writing || '—')}</div></div>
      ${writingReviewHtml(s, R.writing, R.wchecks, R.wgrid, 'dexwcheck', 'dexgrid', '')}
    </section>
    <p class="tip">Щоб отримати результат, оберіть рівень для кожного критерію обох сіток.</p>
    <button class="btn good big block" type="button" data-act="dexfinish" style="margin-top:12px">📊 Отримати результат</button>`;
}
const refreshExamWriting = () => {
  const s = getScen(examRun.scen);
  const box = $('#wres'); if (box) box.innerHTML = productionResultHtml(writingScore(s, examRun.writing, examRun.wchecks, examRun.wgrid));
};
actions.dexocheck = (el) => { (examRun.oral[el.dataset.t] ||= [])[Number(el.dataset.c)] = el.checked; };
actions.dexwcheck = (el) => { examRun.wchecks[Number(el.dataset.c)] = el.checked; refreshExamWriting(); };
actions.dexgrid = (el) => {
  (el.dataset.part === 'oral' ? examRun.oralGrid : examRun.wgrid)[el.dataset.crit] = el.dataset.l;
  $$(`input[name="${el.name}"]`).forEach((r) => r.closest('.descr').classList.toggle('on', r.checked));
  if (el.dataset.part === 'ecrit') refreshExamWriting();
};
actions.dexfinish = () => {
  const s = getScen(examRun.scen);
  const R = examRun;
  const lec = compScore(s, 'lecture', R.answers);
  const eco = compScore(s, 'ecoute', R.answers);
  const oral = oralScore(s, R.oral, R.oralGrid, (ti) => !!R.recs[ti]);
  const ecrit = writingScore(s, R.writing, R.wchecks, R.wgrid);
  if (!oral.grid || !ecrit.grid) {
    toast('Оберіть рівень для кожного критерію обох сіток');
    const first = $$('.crit').find((f) => !f.querySelector('input:checked'));
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const levels = { lecture: lec.level, ecoute: eco.level, oral: oral.level, ecrit: ecrit.level };
  const level = globalLevel(s.exam, levels);
  R.result = { levels, level, detail: { lecture: lec, ecoute: eco, oral, ecrit } };
  dclState().exams.unshift({
    date: new Date().toISOString(), scen: s.id, title: s.title, exam: s.exam, mode: R.mode, levels, level,
    pct: { lecture: lec.pct, ecoute: eco.pct, oral: oral.pct, ecrit: ecrit.pct },
    minutes: Math.round((Date.now() - R.startedAt) / 60000),
  });
  countActivity(); save(true);
  startPhase('result');
  viewExamRun(); window.scrollTo(0, 0);
};

// Розбір: що саме не дотягує до мети в кожній частині
function gapHtml(s, part, det, goal) {
  const ex = s.exam;
  if (ord(det.level) >= ord(goal)) return `<p class="ok-text">✓ Мету ${esc(goal)} досягнуто.</p>`;
  const tagOrd = (t) => ord(t === 'B1' ? 'B1.2' : t);
  const out = [];
  if (part === 'lecture' || part === 'ecoute') {
    const rule = RULES[ex].find(([l]) => l === goal);
    if (rule) out.push(`Для ${esc(goal)} потрібно: ${Object.entries(rule[1]).map(([t, m]) => `${t} ≥ ${Math.round(m * 100)} % (у вас ${Math.round((det.frac[t] || 0) * 100)} %)`).join(', ')}.`);
    const wrong = det.items.filter((x) => !x.ok && tagOrd(x.lvl) <= ord(goal));
    if (wrong.length) out.push('Помилки, що заважають: <ul class="list">' + wrong.map((x) => `<li>${lvlTag(x.lvl, 'lvl sm-tag')} <span lang="fr">${esc(x.q.q)}</span> → <span class="ok-text" lang="fr">${esc(x.q.options ? x.q.options[x.q.answer] : x.q.accept[0])}</span></li>`).join('') + '</ul>');
  } else {
    if (ord(det.task) < ord(goal)) {
      const missed = det.items.filter((x) => !x.ok && tagOrd(x.lvl) <= ord(goal));
      if (missed.length) out.push(`За завданнями — ${esc(lvlName(det.task))}. Не виконано: <ul class="list">` + missed.map((x) => `<li>${lvlTag(x.lvl, 'lvl sm-tag')} ${esc(x.t)}</li>`).join('') + '</ul>');
    }
    const weak = GRID[ex][part].filter((c) => det.sel && det.sel[c.id] && ord(det.sel[c.id]) < ord(goal));
    if (weak.length) out.push('Критерії нижче мети — на що орієнтуватися: <ul class="list">' + weak.map((c) => `<li><b>${esc(c.name)}</b> (у вас ${esc(lvlName(det.sel[c.id]))}). <i>${esc(goal)}:</i> ${esc(c.d[goal] || '')}</li>`).join('') + '</ul>');
  }
  out.push(`<span class="muted">${esc(SKILL_TIPS[part])}</span>`);
  return out.map((x) => `<div style="margin-top:6px">${x}</div>`).join('');
}
function levelBars(levels, ex, goal) {
  const lv = EXAMS[ex].levels;
  return `<div class="bars">${Object.entries(SKILLS).map(([k, x]) => {
    const l = levels[k];
    const w = l ? Math.max(4, ((lv.indexOf(l) + 1) / lv.length) * 100) : 0;
    return `<div class="barrow ${l && ord(l) >= ord(goal) ? '' : 'weak'}"><span>${x.icon} ${x.label}</span><div class="bar"><i style="width:${w}%"></i></div><b>${esc(lvlName(l))}</b></div>`;
  }).join('')}</div>`;
}
function examResultHtml(s) {
  const r = examRun.result;
  const goal = s.exam === 'FP' ? 'A2' : dclState().goal;
  return `
    <h1>Результат · ${esc(EXAMS[s.exam].name)}</h1>
    <p class="muted" style="margin-top:4px">${esc(s.title)}</p>
    <section class="card section center stack">
      <div class="small muted">Приблизний рівень за цим іспитом</div>
      <div class="pct" style="font-size:2.8rem">${esc(lvlName(r.level))}</div>
      <div class="small muted">Мета: ${esc(goal)} · ${ord(r.level) >= ord(goal) ? '<span class="ok-text">досягнуто ✓</span>' : '<span class="bad-text">ще не досягнуто</span>'}</div>
      <p class="small muted">Загальний рівень — той, якого досягли щонайменше 3 з 4 частин. Оцінка орієнтовна.</p>
    </section>
    <section class="card section"><h2>Рівень за частинами</h2>${levelBars(r.levels, s.exam, goal)}</section>
    <section class="section"><h2>Розбір: що не дотягує до ${esc(goal)}</h2>
      ${Object.entries(SKILLS).map(([k, x]) => `<div class="card section"><h3>${x.icon} ${x.label} — ${esc(lvlName(r.levels[k]))}</h3>${gapHtml(s, k, r.detail[k], goal)}</div>`).join('')}
    </section>
    <div class="row" style="margin-top:16px">
      <a class="btn primary grow" href="#/dcl/stats">📈 Графік прогресу</a>
      <button class="btn grow" type="button" data-act="dexdone">До DCL</button>
    </div>`;
}
actions.dexdone = () => { discardExam(); location.hash = '#/dcl'; };
function discardExam() {
  if (examRun) Object.values(examRun.recs).forEach((u) => URL.revokeObjectURL(u));
  examRun = null;
  clearInterval(examTimer); examTimer = null;
}

/* ---------- 12. Фрази ---------- */

function phraseFilter() {
  const d = dclState(); const lvl = d.phLevel || 'all'; const ch = d.phChannel || 'all';
  return DCL.phrases.phrases.filter((p) => (lvl === 'all' || p.level === lvl) && (ch === 'all' || p.channel === ch || p.channel === 'both'));
}
function viewDclPhrases() {
  document.title = 'Фрази DCL — Écoute';
  const d = dclState();
  const lvl = d.phLevel || 'all';
  const ch = d.phChannel || 'all';
  const list = phraseFilter();
  app.innerHTML = `
    <a class="back" href="#/dcl">← DCL</a>
    <h1>Фрази для дзвінків, листів і переговорів</h1>
    <div class="filter-row filters">
      <div class="seg" role="group">${[['all', 'Усі'], ...['A1', 'A2', 'B1', 'B2', 'C1'].map((l) => [l, l])].map(([k, l]) => `<button type="button" data-act="dphf" data-k="phLevel" data-v="${k}" class="${lvl === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="seg" role="group">${[['all', 'Усе'], ['tel', '📞 Телефон'], ['ecrit', '✉️ Лист']].map(([k, l]) => `<button type="button" data-act="dphf" data-k="phChannel" data-v="${k}" class="${ch === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    </div>
    <button class="btn primary big block" type="button" data-act="dphdrill" style="margin-top:14px">🃏 Тренувати ці фрази (${list.length})</button>
    <div id="drill" class="card section ${drill && drill.from === 'phrases' ? '' : 'hidden'}"></div>
    ${Object.entries(DCL.phrases.categories).map(([k, label]) => {
      const items = list.filter((p) => p.cat === k);
      if (!items.length) return '';
      return `<section class="card section"><h2>${esc(label)}</h2><div class="wlist">${items.map((p) => `<div class="wrow">
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
  startDrill(shuffle(phraseFilter().map((p) => p.id)), 'phrases');
  $('#drill').classList.remove('hidden');
  $('#drill').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

/* ---------- 13. Граматика ---------- */

const gAns = {};
function viewGrammarList() {
  document.title = 'Граматика — Écoute';
  const res = dclState().grammar;
  const order = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const topics = DCL.grammar.topics.slice().sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
  app.innerHTML = `
    <a class="back" href="#/dcl">← DCL</a>
    <h1>Граматика A1 – C1</h1>
    <p class="muted" style="margin-top:4px">Коротке правило, приклади з ситуацій DCL і 7 вправ на кожну тему. Теми B2 — те, чого журі очікує на рівні «opérationnalité efficace».</p>
    <div class="vlist">${topics.map((t) => `<a class="card scen" href="#/dcl/grammar/${esc(t.id)}">
      <div class="row"><b class="grow" lang="fr">${esc(t.title)}</b>${lvlTag(t.level)}</div>
      <div class="small muted">${esc(t.titleUk)}</div>
      ${res[t.id] ? `<div class="meta"><span class="tag good">найкраще: ${res[t.id].best}%</span></div>` : ''}</a>`).join('')}</div>`;
}
function viewGrammarTopic(id) {
  const t = DCL.grammar.topics.find((x) => x.id === id);
  if (!t) { viewGrammarList(); return; }
  document.title = t.title + ' — Écoute';
  app.innerHTML = `
    <a class="back" href="#/dcl/grammar">← Граматика</a>
    <h1 lang="fr">${esc(t.title)}</h1><div class="small muted">${esc(t.titleUk)}</div><div class="meta">${lvlTag(t.level)}</div>
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
    const a = A[i]; const done = a !== undefined; const ok = done && isRight(q, a);
    const qText = esc(q.q).replace(/___/g, '<span class="blank">___</span>');
    const body = q.options
      ? q.options.map((o, oi) => {
        let cls = ''; if (done && oi === q.answer) cls = 'right'; else if (done && oi === Number(a)) cls = 'wrong';
        return `<button type="button" class="opt ${cls}" data-act="gans" data-t="${esc(t.id)}" data-q="${i}" data-o="${oi}" ${done ? 'disabled' : ''} lang="fr">${esc(o)}</button>`;
      }).join('')
      : `<div class="row"><input class="input grow" data-gin="${i}" lang="fr" autocomplete="off" autocapitalize="off" value="${esc(done ? a : '')}" ${done ? 'disabled' : ''}>
         ${done ? '' : `<button class="btn" type="button" data-act="gansin" data-t="${esc(t.id)}" data-q="${i}">OK</button>`}</div>`;
    const fb = done ? `<p class="small ${ok ? 'ok-text' : 'bad-text'}" style="margin-top:6px">${ok ? '✓ Правильно' : '✗ Правильно: ' + esc(q.options ? q.options[q.answer] : q.accept[0])}${q.explain ? ' — ' + esc(q.explain) : ''}</p>` : '';
    return `<div class="quiz-q"><p lang="fr">${i + 1}. ${qText}</p>${body}${fb}</div>`;
  }).join('') + (answered === ex.length ? `<div class="row" style="margin-top:16px"><b class="grow">Результат: ${right} з ${ex.length}</b>
      <button class="btn sm" type="button" data-act="greset" data-t="${esc(t.id)}">Ще раз</button></div>` : '');
}
function afterGrammar(t) {
  const A = gAns[t.id];
  if (t.exercises.every((_, i) => A[i] !== undefined)) {
    const pct = Math.round(t.exercises.filter((q, i) => isRight(q, A[i])).length / t.exercises.length * 100);
    const r = (dclState().grammar[t.id] ||= { best: 0 });
    r.best = Math.max(r.best, pct); r.last = pct; r.at = Date.now();
    countActivity(); save();
  }
  $('#gbox').innerHTML = grammarExHtml(t);
}
actions.gans = (el) => { const t = DCL.grammar.topics.find((x) => x.id === el.dataset.t); (gAns[t.id] ||= {})[el.dataset.q] = Number(el.dataset.o); afterGrammar(t); };
actions.gansin = (el) => {
  const t = DCL.grammar.topics.find((x) => x.id === el.dataset.t);
  const v = $(`[data-gin="${el.dataset.q}"]`).value.trim();
  if (!v) { toast('Впишіть відповідь'); return; }
  (gAns[t.id] ||= {})[el.dataset.q] = v; afterGrammar(t);
};
actions.greset = (el) => { const t = DCL.grammar.topics.find((x) => x.id === el.dataset.t); gAns[t.id] = {}; $('#gbox').innerHTML = grammarExHtml(t); };

/* ---------- 14. Прогрес DCL і графік рівнів ---------- */

function levelChart(exams, goal) {
  const pts = exams.slice().reverse().slice(-12);
  if (!pts.length) return '<p class="muted" style="margin-top:8px">Ще немає пробних іспитів. Після першого тут з\'явиться графік рівнів.</p>';
  const W = 640, H = 240, L = 48, R = 16, T = 18, B = 32;
  const ys = SCALE.slice(1); // A1 … C1
  const y = (l) => T + (H - T - B) * (1 - (Math.max(1, ord(l)) - 1) / (ys.length - 1));
  const x = (i) => L + (pts.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (pts.length - 1));
  const gy = y(goal);
  const line = pts.map((e, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(e.level).toFixed(1)}`).join(' ');
  return `<svg class="lvlchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Рівні за пробними іспитами">
    ${ys.map((l) => `<line x1="${L}" x2="${W - R}" y1="${y(l)}" y2="${y(l)}" class="gridline"/><text x="${L - 8}" y="${y(l) + 4}" text-anchor="end" class="axis">${l}</text>`).join('')}
    <line x1="${L}" x2="${W - R}" y1="${gy}" y2="${gy}" class="goalline"/>
    <text x="${W - R}" y="${gy - 6}" text-anchor="end" class="goaltext">мета ${esc(goal)}</text>
    ${pts.length > 1 ? `<path d="${line}" class="lvlline"/>` : ''}
    ${pts.map((e, i) => `<circle cx="${x(i)}" cy="${y(e.level)}" r="6" class="dot ${ord(e.level) >= ord(goal) ? 'ok' : ''}"><title>${new Date(e.date).toLocaleDateString('uk-UA')} · ${e.exam === 'FP' ? 'DCL FP' : 'DCL FLE'} · ${esc(e.title)}: ${lvlName(e.level)}</title></circle>
      <text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="axis">${new Date(e.date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}</text>`).join('')}
  </svg>`;
}
function viewDclStats() {
  document.title = 'Прогрес DCL — Écoute';
  const d = dclState();
  const goal = d.goal;
  const lv = latestPartLevels();
  const below = Object.keys(SKILLS).filter((k) => lv[k] && ord(lv[k]) < ord(goal)).sort((a, b) => ord(lv[a]) - ord(lv[b]));
  const done = (ex) => scenariosOf(ex).filter((s) => d.scen[s.id] && d.scen[s.id].done).length;
  app.innerHTML = `
    <a class="back" href="#/dcl">← DCL</a>
    <h1>Мій прогрес DCL</h1>
    <div class="stats section">
      <div class="card stat"><div class="num">${d.exams.length}</div><div class="lab">пробних іспитів</div></div>
      <div class="card stat"><div class="num">${d.exams[0] ? esc(d.exams[0].level) : '—'}</div><div class="lab">останній результат</div></div>
      <div class="card stat"><div class="num">${done('FLE')}<span class="muted" style="font-size:1rem"> / ${scenariosOf('FLE').length}</span></div><div class="lab">тренувань DCL FLE</div></div>
      <div class="card stat"><div class="num">${done('FP')}<span class="muted" style="font-size:1rem"> / ${scenariosOf('FP').length}</span></div><div class="lab">тренувань DCL FP</div></div>
    </div>
    <section class="card section"><h2>Рівень за пробними іспитами</h2>${levelChart(d.exams, goal)}</section>
    <section class="card section"><h2>Частини: найкращий рівень (${goalExam() === 'FP' ? 'DCL FP' : 'DCL FLE'})</h2>
      ${Object.keys(lv).length ? levelBars(lv, goalExam(), goal) : '<p class="muted" style="margin-top:8px">Поки немає даних.</p>'}
      ${below.length ? `<p class="tip">🎯 Слабке місце: <b>${SKILLS[below[0]].label}</b> (${esc(lvlName(lv[below[0]]))} → мета ${esc(goal)}). ${esc(SKILL_TIPS[below[0]])}</p>` : (Object.keys(lv).length === 4 ? `<p class="tip">✅ Усі частини на рівні мети ${esc(goal)} або вище.</p>` : '')}
    </section>
    <section class="card section"><h2>Історія іспитів</h2>
      ${d.exams.length ? `<div class="wlist">${d.exams.slice(0, 15).map((e) => `<div class="wrow"><div class="grow">
          <b>${esc(lvlName(e.level))}</b> <span class="small muted">· ${new Date(e.date).toLocaleDateString('uk-UA')} · ${e.exam === 'FP' ? 'DCL FP' : 'DCL FLE'} · ${e.mode === 'short' ? 'скорочений' : 'повний'}</span>
          <div class="small muted">${esc(e.title)}</div>
          <div class="small">${Object.entries(SKILLS).map(([k, x]) => `${x.icon} ${esc(lvlName(e.levels ? e.levels[k] : null))}`).join(' · ')}</div>
        </div></div>`).join('')}</div>` : '<p class="muted" style="margin-top:8px">Ще не було.</p>'}
    </section>
    <section class="card section"><h2>Граматика</h2>
      <div class="wlist">${DCL.grammar.topics.map((t) => `<a class="wrow" href="#/dcl/grammar/${esc(t.id)}" style="color:inherit"><span class="grow" lang="fr">${esc(t.title)}</span><span class="tag">${t.level}</span>${d.grammar[t.id] ? `<span class="tag good">${d.grammar[t.id].best}%</span>` : '<span class="tag">—</span>'}</a>`).join('')}</div>
    </section>`;
}
window.dclProgressCard = () => {
  const d = state.dcl;
  const last = d && d.exams && d.exams[0];
  return `<a class="card section today-dcl" href="#/dcl/stats"><span class="big-ico">🎓</span><div class="grow"><b>Прогрес DCL</b>
    <div class="small muted">${last ? `Останній пробний іспит: ${esc(lvlName(last.level))} · мета ${esc(d.goal || 'B2')}` : 'Сценарії-іспити DCL FP і DCL FLE, фрази, граматика'}</div></div><span>→</span></a>`;
};

/* ---------- 15. Маршрутизація розділу ---------- */

// Викликається з render() в app.js
async function viewDcl(a, b, c) {
  dclState();
  if (!DCL) {
    const hash = location.hash;
    app.innerHTML = '<p class="muted center pad">Завантаження DCL…</p>';
    try { await loadDcl(); }
    catch (e) {
      app.innerHTML = `<div class="card"><h2>Не вдалося завантажити дані DCL</h2><p class="muted" style="margin-top:8px">${esc(e.message || e)}</p><p class="small muted">Перевірте файли в папці dcl/ (кома чи лапки в JSON).</p></div>`;
      return;
    }
    if (location.hash !== hash) return;
  }
  if (a === 'about') viewDclAbout();
  else if (a === 'today') viewDclToday();
  else if (a === 's') viewScenario(b, c || 'mission');
  else if (a === 'x') viewExamStart(b);
  else if (a === 'exam' && b === 'run') viewExamRun();
  else if (a === 'phrases') viewDclPhrases();
  else if (a === 'grammar') (b ? viewGrammarTopic(b) : viewGrammarList());
  else if (a === 'stats') viewDclStats();
  else viewDclHub();
}
// Перед зміною екрана: не губимо іспит випадково
function dclBeforeLeave() {
  if (examActive() && !location.hash.startsWith('#/dcl/exam/run')) {
    if (!confirm('Вийти з пробного іспиту? Результат не збережеться.')) { location.hash = '#/dcl/exam/run'; return false; }
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
  if (!location.hash.startsWith('#/dcl/s/')) Object.keys(dRecs).forEach((k) => { URL.revokeObjectURL(dRecs[k]); delete dRecs[k]; });
  if (!location.hash.startsWith('#/dcl/today') && !location.hash.startsWith('#/dcl/phrases')) drill = null;
}
window.addEventListener('beforeunload', (e) => { if (examActive()) { e.preventDefault(); e.returnValue = ''; } });

// Підвантажуємо дані DCL у фоні, щоб картка «на сьогодні» на головній знала план
loadDcl().catch(() => {});
