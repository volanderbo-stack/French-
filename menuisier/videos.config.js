/* =====================================================================
   СПИСОК ВІДЕО ДЛЯ РОЗДІЛУ «САМОПРЕЗЕНТАЦІЯ»
   ---------------------------------------------------------------------
   Кожне відео — один блок { ... } у масиві нижче. Блоки розділяються комою.

   type:
     'scene'   — анімований персонаж, який говорить через озвучку браузера
     'mp4'     — ваш відеофайл. src: 'videos/stolyar.mp4' (покладіть файл
                 у папку videos поруч з index.html) або повне посилання https://…
     'youtube' — відео з YouTube. src: 'https://www.youtube.com/watch?v=XXXXXXXXXXX'
                 (працює, коли сайт відкрито через http/https, а не подвійним кліком)

   Щоб ЗАМІНИТИ анімацію на відео з HeyGen / Synthesia / D-ID:
     поміняйте type: 'scene' на type: 'mp4' (або 'youtube') і додайте src.
     Текст (script) і тест (quiz) залишаться — субтитри показуватимуться
     синхронно, якщо в кожної фрази вказано t — секунду, з якої вона звучить.

   script: фрази по черзі. fr — французькою, uk — переклад, t — секунда (лише для mp4/youtube)
   quiz:   q — питання, options — варіанти, answer — номер правильного (рахуємо з 0)

   Для 'scene' ще є:
     background: 'atelier' | 'chantier' | 'cuisine' | 'rue' | 'maison' | 'jardin'
     voice: { gender: 'm' | 'f', pitch: 0.5…1.5, rate: 0.7…1.2 }
     character: зовнішність (див. приклади нижче)
       hair: 'short' | 'long' | 'bun' | 'ponytail' | 'bald' | 'curly'
       beard: 'none' | 'stubble' | 'full' | 'mustache'
       hat: 'none' | 'chef' | 'hardhat' | 'cap' | 'beret'
       outfit: 'shirt' | 'tshirt' | 'hoodie' | 'vest' | 'chef' | 'cardigan'
   ===================================================================== */

window.VIDEO_CONFIG = [
  {
    id: 'menuisier',
    type: 'scene',
    title: 'Олександр, столяр',
    role: 'menuisier',
    background: 'atelier',
    voice: { gender: 'm', pitch: 0.8, rate: 0.95 },
    character: {
      skin: '#f0c5a0', hair: 'short', hairColor: '#5a3a22', eyes: '#4a6b8a',
      beard: 'stubble', outfit: 'shirt', color: '#3c6e9e', apron: '#8a5a2b', pencil: true,
    },
    script: [
      { fr: "Bonjour ! Je m'appelle Oleksandr.", uk: 'Добрий день! Мене звати Олександр.' },
      { fr: "J'ai 41 ans. Je suis ukrainien, je viens de Lviv.", uk: 'Мені 41 рік. Я українець, я зі Львова.' },
      { fr: "Maintenant, j'habite à Lyon, en France, depuis deux ans.", uk: 'Зараз я живу в Ліоні, у Франції, вже два роки.' },
      { fr: 'Je suis menuisier depuis vingt ans.', uk: 'Я столяр уже двадцять років.' },
      { fr: 'Je fabrique des meubles, des portes et des escaliers en bois.', uk: "Я виготовляю меблі, двері та дерев'яні сходи." },
      { fr: 'Je travaille dans un petit atelier, près de la gare.', uk: 'Я працюю в невеликій майстерні біля вокзалу.' },
      { fr: "Je suis marié. Ma femme s'appelle Olena.", uk: 'Я одружений. Мою дружину звати Олена.' },
      { fr: 'Nous avons deux enfants : un fils et une fille.', uk: 'У нас двоє дітей: син і донька.' },
      { fr: 'Mon fils Maksym a 12 ans, il va au collège.', uk: 'Моєму синові Максиму 12 років, він ходить до колежу (середня школа).' },
      { fr: "Ma fille Sofia a 7 ans, elle est à l'école primaire.", uk: 'Моїй доньці Софії 7 років, вона в початковій школі.' },
      { fr: 'Nous habitons dans un appartement de trois pièces, avec un balcon.', uk: 'Ми живемо у трикімнатній квартирі з балконом.' },
      { fr: "Le week-end, j'aime la pêche et le vélo.", uk: 'На вихідних я люблю рибалку і велосипед.' },
      { fr: 'Le soir, je fabrique des jouets en bois pour mes enfants.', uk: "Увечері я роблю дерев'яні іграшки для своїх дітей." },
      { fr: 'Merci et à bientôt !', uk: 'Дякую і до зустрічі!' },
    ],
    quiz: [
      { q: 'Скільки років Олександру?', options: ['38', '41', '45'], answer: 1 },
      { q: 'У якому місті він живе зараз?', options: ['У Львові', 'У Парижі', 'У Ліоні'], answer: 2 },
      { q: 'Скільки років він працює столяром?', options: ['2 роки', '10 років', '20 років'], answer: 2 },
      { q: 'Де навчається його донька Софія?', options: ['У початковій школі', 'У колежі', 'В університеті'], answer: 0 },
      { q: 'Що він робить увечері?', options: ['Дивиться футбол', "Робить дерев'яні іграшки", 'Готує вечерю'], answer: 1 },
    ],
  },

  {
    id: 'macon',
    type: 'scene',
    title: 'Педру, будівельник',
    role: 'maçon',
    background: 'chantier',
    voice: { gender: 'm', pitch: 0.95, rate: 1.05 },
    character: {
      skin: '#d49a72', hair: 'short', hairColor: '#2a1d15', eyes: '#5a3a1a',
      beard: 'mustache', hat: 'hardhat', hatColor: '#f2c230', outfit: 'vest', color: '#f28c28',
    },
    script: [
      { fr: "Salut ! Moi, c'est Pedro.", uk: 'Привіт! Я — Педру.' },
      { fr: "J'ai 47 ans et je suis portugais.", uk: 'Мені 47 років, і я португалець.' },
      { fr: "Je suis né à Porto, mais j'habite à Bordeaux depuis vingt ans.", uk: 'Я народився в Порту, але живу в Бордо вже двадцять років.' },
      { fr: 'Je suis maçon. Je travaille sur les chantiers.', uk: 'Я муляр. Я працюю на будівельних майданчиках.' },
      { fr: 'Je construis des maisons et des murs en brique.', uk: 'Я будую будинки і цегляні стіни.' },
      { fr: 'Je commence le travail à 7 heures du matin.', uk: 'Я починаю роботу о 7-й ранку.' },
      { fr: "Je suis divorcé, et j'ai trois enfants.", uk: 'Я розлучений, і в мене троє дітей.' },
      { fr: 'Mon fils aîné a 22 ans, il est électricien.', uk: 'Моєму старшому синові 22 роки, він електрик.' },
      { fr: 'Mes deux filles vont au lycée.', uk: 'Мої дві доньки ходять до ліцею (старша школа).' },
      { fr: "J'habite dans une petite maison avec un jardin.", uk: 'Я живу в маленькому будинку з садом.' },
      { fr: "Dans le jardin, il y a des tomates et un barbecue !", uk: 'У саду є помідори і барбекю!' },
      { fr: "J'adore le football. Le dimanche, je regarde les matchs avec mes amis.", uk: 'Я обожнюю футбол. У неділю я дивлюся матчі з друзями.' },
      { fr: 'Allez, au travail ! Bonne journée !', uk: 'Ну все, до роботи! Гарного дня!' },
    ],
    quiz: [
      { q: 'Хто Педру за національністю?', options: ['Іспанець', 'Португалець', 'Француз'], answer: 1 },
      { q: 'Де він живе?', options: ['У Бордо', 'У Порту', 'У Ліоні'], answer: 0 },
      { q: 'Ким він працює?', options: ['Електриком', 'Столяром', 'Муляром'], answer: 2 },
      { q: 'Скільки в нього дітей?', options: ['Одна дитина', 'Двоє', 'Троє'], answer: 2 },
      { q: 'О котрій він починає роботу?', options: ['О 6:00', 'О 7:00', 'О 8:00'], answer: 1 },
    ],
  },

  {
    id: 'cuisiniere',
    type: 'scene',
    title: 'Софі, кухарка',
    role: 'cuisinière',
    background: 'cuisine',
    voice: { gender: 'f', pitch: 1.15, rate: 1.05 },
    character: {
      skin: '#f3cfb3', hair: 'bun', hairColor: '#b8652a', eyes: '#3f7a4a',
      hat: 'chef', outfit: 'chef', color: '#ffffff', scarf: '#d63b3b', earrings: true, female: true,
    },
    script: [
      { fr: "Bonjour à tous ! Je m'appelle Sophie.", uk: 'Привіт усім! Мене звати Софі.' },
      { fr: "J'ai 31 ans. Je suis française, de Nantes.", uk: 'Мені 31 рік. Я француженка, з Нанта.' },
      { fr: "J'habite au centre-ville, dans un appartement de deux pièces.", uk: 'Я живу в центрі міста, у двокімнатній квартирі.' },
      { fr: 'Je suis cuisinière dans un restaurant.', uk: 'Я кухарка в ресторані.' },
      { fr: "Je travaille le soir et le week-end. C'est fatigant, mais j'aime ça !", uk: 'Я працюю ввечері та на вихідних. Це втомлює, але мені подобається!' },
      { fr: 'Je prépare surtout le poisson et les desserts.', uk: 'Я готую переважно рибу і десерти.' },
      { fr: "Je ne suis pas mariée, mais j'ai un compagnon. Il s'appelle Karim.", uk: 'Я не заміжня, але в мене є партнер. Його звати Карім.' },
      { fr: 'Nous avons un fils, Léo. Il a 4 ans.', uk: 'У нас є син, Лео. Йому 4 роки.' },
      { fr: "Léo va à l'école maternelle, à côté de la maison.", uk: 'Лео ходить до дитсадка (école maternelle) поруч із домом.' },
      { fr: 'Notre appartement est petit, mais il est très lumineux.', uk: 'Наша квартира маленька, але дуже світла.' },
      { fr: 'Pendant mon temps libre, je fais du yoga et je lis des romans.', uk: 'У вільний час я займаюся йогою і читаю романи.' },
      { fr: "Le lundi, c'est mon jour de repos : je vais au marché avec Léo.", uk: 'Понеділок — мій вихідний: я ходжу на ринок з Лео.' },
      { fr: 'Au revoir et bon appétit !', uk: 'До побачення і смачного!' },
    ],
    quiz: [
      { q: 'Ким працює Софі?', options: ['Офіціанткою', 'Кухаркою', 'Вчителькою'], answer: 1 },
      { q: 'Скільки років її синові Лео?', options: ['4 роки', '7 років', '14 років'], answer: 0 },
      { q: 'Куди ходить Лео?', options: ['До початкової школи', 'До дитсадка (école maternelle)', 'До колежу'], answer: 1 },
      { q: 'Який день у Софі вихідний?', options: ['Неділя', 'Субота', 'Понеділок'], answer: 2 },
    ],
  },

  {
    id: 'etudiante',
    type: 'scene',
    title: 'Ірина, студентка',
    role: 'étudiante',
    background: 'rue',
    voice: { gender: 'f', pitch: 1.3, rate: 1.08 },
    character: {
      skin: '#f5d3b8', hair: 'long', hairColor: '#e0b25c', eyes: '#3d6fb0',
      glasses: true, outfit: 'hoodie', color: '#7a5cc4', female: true, backpack: true,
    },
    script: [
      { fr: "Coucou ! Je m'appelle Iryna.", uk: 'Привіт! Мене звати Ірина.' },
      { fr: "J'ai 20 ans. Je suis ukrainienne, de Kharkiv.", uk: 'Мені 20 років. Я українка, з Харкова.' },
      { fr: "Je suis étudiante à l'université de Grenoble.", uk: 'Я студентка університету в Греноблі.' },
      { fr: "J'étudie l'architecture. C'est ma deuxième année.", uk: 'Я вивчаю архітектуру. Це мій другий рік.' },
      { fr: "J'habite dans une résidence universitaire, dans une petite chambre.", uk: 'Я живу в студентському гуртожитку, в маленькій кімнаті.' },
      { fr: 'Le week-end, je travaille dans une boulangerie.', uk: 'На вихідних я працюю в пекарні.' },
      { fr: "Je suis célibataire, je n'ai pas d'enfants.", uk: 'Я неодружена, дітей у мене немає.' },
      { fr: 'Mes parents habitent en Ukraine. Mon père est menuisier !', uk: 'Мої батьки живуть в Україні. Мій тато — столяр!' },
      { fr: "J'ai un petit frère, Danylo. Il a 14 ans, il va au collège.", uk: 'У мене є молодший брат Данило. Йому 14 років, він ходить до колежу.' },
      { fr: "J'aime la montagne : en hiver, je fais du ski.", uk: 'Я люблю гори: взимку я катаюся на лижах.' },
      { fr: "J'aime aussi dessiner et prendre des photos.", uk: 'Ще я люблю малювати і фотографувати.' },
      { fr: 'Le soir, je sors avec mes amis ou je regarde des séries.', uk: 'Увечері я гуляю з друзями або дивлюся серіали.' },
      { fr: 'À plus tard !', uk: 'До зустрічі!' },
    ],
    quiz: [
      { q: 'Що вивчає Ірина?', options: ['Медицину', 'Архітектуру', 'Право'], answer: 1 },
      { q: 'Де вона живе?', options: ['У гуртожитку', 'У квартирі з батьками', 'У будинку з садом'], answer: 0 },
      { q: 'Де вона працює на вихідних?', options: ['У ресторані', 'У магазині', 'У пекарні'], answer: 2 },
      { q: 'Ким працює її тато?', options: ['Столяром', 'Кухарем', 'Муляром'], answer: 0 },
    ],
  },

  {
    id: 'maman',
    type: 'scene',
    title: 'Оксана, мама двох дітей',
    role: 'maman',
    background: 'maison',
    voice: { gender: 'f', pitch: 1.05, rate: 0.95 },
    character: {
      skin: '#f1c9a8', hair: 'ponytail', hairColor: '#6b3e26', eyes: '#6a4a2a',
      outfit: 'tshirt', color: '#2e9a7a', earrings: true, female: true,
      kids: [
        { skin: '#f4d0b0', hair: 'long', hairColor: '#8a5a34', color: '#e46a9a', female: true },
        { skin: '#f4d0b0', hair: 'short', hairColor: '#d9b46a', color: '#3c7fd9' },
      ],
    },
    script: [
      { fr: "Bonjour ! Je m'appelle Oksana, et voici mes enfants.", uk: 'Добрий день! Мене звати Оксана, а це мої діти.' },
      { fr: "J'ai 36 ans. Je suis ukrainienne, je viens de Dnipro.", uk: 'Мені 36 років. Я українка, я з Дніпра.' },
      { fr: 'Nous habitons à Toulouse depuis trois ans.', uk: 'Ми живемо в Тулузі вже три роки.' },
      { fr: "Mon mari s'appelle Andriy. Il est charpentier.", uk: 'Мого чоловіка звати Андрій. Він тесля.' },
      { fr: "Moi, je suis aide-soignante dans un hôpital.", uk: 'А я — молодша медсестра в лікарні.' },
      { fr: "J'ai deux enfants : Marta et Taras.", uk: 'У мене двоє дітей: Марта і Тарас.' },
      { fr: "Marta a 9 ans. Elle est en CM1, à l'école primaire.", uk: 'Марті 9 років. Вона в 4-му класі (CM1) початкової школи.' },
      { fr: "Taras a 5 ans. Il va à l'école maternelle.", uk: 'Тарасові 5 років. Він ходить до дитсадка (école maternelle).' },
      { fr: 'Les enfants parlent déjà très bien français !', uk: 'Діти вже дуже добре розмовляють французькою!' },
      { fr: 'Nous louons une maison avec trois chambres et un petit jardin.', uk: 'Ми орендуємо будинок із трьома спальнями та маленьким садом.' },
      { fr: "Le mercredi après-midi, Marta fait de la danse et Taras du judo.", uk: 'У середу після обіду Марта займається танцями, а Тарас — дзюдо.' },
      { fr: 'Le dimanche, nous faisons des balades au bord de la Garonne.', uk: 'У неділю ми гуляємо берегом Гаронни.' },
      { fr: "Et moi, j'adore cuisiner : mon plat préféré, c'est le bortsch !", uk: 'А я обожнюю готувати: моя улюблена страва — борщ!' },
    ],
    quiz: [
      { q: 'Ким працює чоловік Оксани?', options: ['Теслею', 'Кухарем', 'Електриком'], answer: 0 },
      { q: 'Де працює Оксана?', options: ['У школі', 'У лікарні', 'У магазині'], answer: 1 },
      { q: 'Скільки років Марті?', options: ['5 років', '9 років', '12 років'], answer: 1 },
      { q: 'Коли діти ходять на танці та дзюдо?', options: ['У середу після обіду', 'У неділю', 'У понеділок зранку'], answer: 0 },
      { q: 'Яка її улюблена страва?', options: ['Піца', 'Вареники', 'Борщ'], answer: 2 },
    ],
  },

  {
    id: 'retraite',
    type: 'scene',
    title: 'Бернар, пенсіонер',
    role: 'retraité',
    background: 'jardin',
    voice: { gender: 'm', pitch: 0.7, rate: 0.85 },
    character: {
      skin: '#eebd9c', hair: 'bald', hairColor: '#d4d4d4', eyes: '#5b6b7a',
      beard: 'mustache', glasses: true, hat: 'beret', hatColor: '#26303d', outfit: 'cardigan', color: '#7b6a4f', old: true,
    },
    script: [
      { fr: "Bonjour, je m'appelle Bernard.", uk: 'Добрий день, мене звати Бернар.' },
      { fr: "J'ai 68 ans, je suis français.", uk: 'Мені 68 років, я француз.' },
      { fr: "J'habite dans un petit village près d'Annecy, à la montagne.", uk: 'Я живу в маленькому селі біля Аннесі, в горах.' },
      { fr: "Avant, j'étais ébéniste. J'ai travaillé quarante ans dans mon atelier.", uk: 'Раніше я був червонодеревником. Я працював сорок років у своїй майстерні.' },
      { fr: 'Maintenant, je suis à la retraite.', uk: 'Тепер я на пенсії.' },
      { fr: 'Je suis marié avec Monique depuis 45 ans.', uk: 'Я одружений з Монік уже 45 років.' },
      { fr: 'Nous avons deux enfants et quatre petits-enfants.', uk: 'У нас двоє дітей і четверо онуків.' },
      { fr: 'Ma petite-fille Chloé est étudiante à Lyon.', uk: 'Моя онука Хлоя — студентка в Ліоні.' },
      { fr: "Les plus petits vont à l'école du village.", uk: 'Молодші ходять до сільської школи.' },
      { fr: "Notre maison est vieille, en pierre et en bois. J'ai fait tous les meubles moi-même.", uk: 'Наш будинок старий, з каменю і дерева. Усі меблі я зробив сам.' },
      { fr: "J'aime le jardinage et les promenades en forêt.", uk: 'Я люблю порпатися в саду і гуляти лісом.' },
      { fr: 'Le jeudi, je joue aux cartes avec mes voisins.', uk: 'По четвергах я граю в карти із сусідами.' },
      { fr: 'Bonne journée et bon courage !', uk: 'Гарного дня і успіхів!' },
    ],
    quiz: [
      { q: 'Ким раніше працював Бернар?', options: ['Червонодеревником (ébéniste)', 'Муляром', 'Кухарем'], answer: 0 },
      { q: 'Де він живе?', options: ['У Ліоні', 'У селі біля Аннесі', 'У Парижі'], answer: 1 },
      { q: 'Скільки в нього онуків?', options: ['Двоє', 'Четверо', 'Шестеро'], answer: 1 },
      { q: 'Що він робить по четвергах?', options: ['Ходить на рибалку', 'Грає в карти', 'Ходить на ринок'], answer: 1 },
    ],
  },

  /* ---------- ПРИКЛАДИ: як додати справжнє відео ----------
     Приберіть позначки коментаря /* і * / навколо блоку, впишіть своє посилання.

  {
    id: 'heygen-menuisier',
    type: 'mp4',
    title: 'Мій AI-аватар (HeyGen)',
    src: 'videos/menuisier.mp4',
    script: [
      { t: 0,   fr: "Bonjour ! Je m'appelle Oleksandr.", uk: 'Добрий день! Мене звати Олександр.' },
      { t: 2.5, fr: "J'ai 41 ans.", uk: 'Мені 41 рік.' },
    ],
    quiz: [
      { q: 'Скільки йому років?', options: ['31', '41'], answer: 1 },
    ],
  },

  {
    id: 'youtube-exemple',
    type: 'youtube',
    title: 'Приклад з YouTube',
    src: 'https://www.youtube.com/watch?v=XXXXXXXXXXX',
    script: [],
    quiz: [],
  },
  */
];
