# Гайды и обучающая информация для Marvel: Crisis Protocol

Исследование: 23 октября 2026 года. Документ для развития MCP Companion и последующей работы ассистента.

## Назначение и пожелание пользователя

Цель — собрать знания, которые помогают понимать игру, осознанно выбирать ростер и отряд, принимать решения на столе и выигрывать партии. Роли персонажей — одно из направлений этой работы.

**Пожелание пользователя от 23 октября 2026 года:** источники, авторы, даты, версии правил, степень проверки и прочая информация о происхождении знания нужны во внутренней базе для ассистента. Пользовательскому интерфейсу не требуется показывать эти служебные сведения по умолчанию.

В интерфейсе нужно давать полезный результат: роль, объяснение применения, подходящий состав, доступный приём или совет. Практические условия самого совета — нужная энергия, карта, лидерство, дальность, тип жетона — остаются важной игровой информацией. Их следует показывать там, где они помогают принять решение.

Этот файл сохраняет результаты обзора, ограничения, идеи применения и полный реестр найденных материалов. Структура будущей базы ниже — предложение; она ещё не реализована.

## Статус исследования

Собраны 52 записи: статьи, справочники, подборки, описания выпусков и кандидаты для последующего изучения. Выделены 16 направлений информации.

Степень знакомства с материалами различается. Для каждого источника она указана в реестре: прочитанный текст, доступная статья, поисковая выдержка, описание выпуска, фрагмент транскрипта или недоступная страница. Нельзя интерпретировать число 52 как число полностью изученных гайдов.

- Полный просмотр или прослушивание перечисленных видео и подкастов не проводились.
- Часть статей проверена через содержательные поисковые выдержки. Доступность полного текста не равна его подробному разбору.
- Большой PDF базовых правил превысил лимит извлечения веб-инструмента. Полная книга в рамках этого обзора не прочитана.
- Недоступные сайты и сомнительный калькулятор выделены отдельно; они не входят в проверенную основу рекомендаций.
- Материалы относятся к разным версиям игры, от 2020 до 2026 года.
- На этапе обзора роли персонажам не назначались; код и рейтинги исследованием не менялись. Первичная реализация ролей от 23 октября описана ниже.

## Основные выводы

1. Есть готовые авторские классификации ролей с несколькими ролями на персонажа. Они пригодны как отправная точка, после сверки с текущими карточками.
2. Полезно различать роль, конкретную способность выполнять действие и оценку силы персонажа. Наличие толчка само по себе ещё не делает модель хорошим контроллером во всех ситуациях.
3. Роль зависит от лидерства, союзников, тактик, кризиса, доступной энергии и стороны карточки. Условные роли нужно отличать от самостоятельных.
4. Для состава важны покрытие задач и осуществимость общего плана. Нет требования, чтобы любой отряд содержал все роли.
5. Кризисы стоит описывать через геометрию, способы начисления очков, тип жетонов и повторные затраты ресурсов. Классификации «широкий/узкий» и «быстрый/медленный» недостаточно.
6. Найдены подборки конкретных приёмов: безопасные захваты, кражи жетонов, стартовые расстановки, расход энергии, использование состояний, выбор тактик и завершение игры при преимуществе по очкам.
7. Подробные отчёты о партиях могут содержать выставленные отряды, кризисы, выбранные тактики и объяснения решений. Это дополняет наш текущий архив, в котором обычно известен ростер из десяти моделей.
8. Опубликованные отчёты и видеопартии дают смещённую выборку. Их нельзя автоматически считать репрезентативной турнирной статистикой.
9. Авторские оценки и рейтинги из гайдов не являются официальными фактами или доказанными причинными эффектами.
10. Материалы, написанные до крупных обновлений, могут сохранять полезный ход мысли, одновременно содержать устаревшие инструкции и примеры.

## Карта полезной информации

| Направление | Что изучать и хранить | Возможное применение | Пример источника |
|---|---|---|---|
| Роли персонажей | Основные, дополнительные и условные роли; задачи на столе | Фильтры, сравнение кандидатов, покрытие задач отрядом | `sg-role-ac`, `sg-role-index` |
| Конкретные возможности | Тип эффекта, дальность, ограничения размера, стоимость, зависимость от броска | Поиск инструмента под задачу; объяснение роли | `sg-spenders`, текущие карточки |
| Планы лидерств и аффилиаций | Способ выигрывать, ключевые модели, альтернативные планы | Объяснение назначения ростера и выбора лидера | `sg-affiliations`, `sg-webs` |
| Сборка ростера и отряда | Варианты по Threat, легальность, роли, стоимость поддержки, компромиссы между планами | Дополнение существующего генератора вариантов отряда | `sg-dual` |
| Профили кризисов и сочетания | Геометрия, темп, типы жетонов, взаимодействия, повторные затраты | Объяснимый выбор кризисов и состава | `flg-crises26` |
| Расстановка и первый раунд | Доступ к целям, безопасные захваты, порядок действий, альтернативные линии | Библиотека стартовых приёмов со схемами | `firstclass-extract8`, `los-deployment` |
| Экономика энергии и действий | Расход и получение энергии, дополнительные действия, цена подготовки, упущенные возможности | Понимание доступности комбинаций и цены решений | `sg-spenders`, `flg-economy` |
| Активации, приоритет и темп | Ценность раннего и позднего действия, лишение активаций, реакция на противника | Ситуационные подсказки и учебные задачи | `xavier-priority` с проверкой текущих правил |
| Матчапы и контрплей | Защитные профили, дистанция, перемещения, ограничения и уязвимости | Профиль угроз соперника и подбор ответов | `los-weakness` |
| Состояния | Цель, момент применения, эффект на конкретный план, стоимость снятия | Практическое дополнение справочника состояний | `los-conditions` |
| Карты тактики | Условия включения, совместимость, подготовка, тайминги и альтернативная стоимость | Помощь в выборе карт под отряд и матчап | `los-tactics`, `sg-personal-tactics`, `sg-timing` |
| Вероятности и риск | Распределения, шанс нужного минимума, надёжность, запасной план | Сравнение игровых решений и атак | `touche-dice`, `danger-probability` |
| Доведение игры до победы | Достаточное безопасное начисление очков, отступление, оставшееся время | Объяснение, когда продолжать бой и когда сохранять преимущество | `los-closing` |
| Разборы сыгранных партий | Фактические отряды, кризисы, карты, ключевые решения и ошибки | Примеры применения, будущая аналитика и разбор после игры | `firstclass-batrep26`, `bovine-gt26` |
| Правила и справочник | FAQ, тайминги, форматы, ограничения и обновления карточек | Проверочная основа всех советов | `amg-rules`, `amg-faq`, `amg-formats` |
| Практические упражнения | Отработка стартов без соперника; выбор действия по позиции; сравнение с разбором | Короткие тренировки и обучение на примерах | `los-deployment`, `omnus-quarters26` как кандидат |

## Роли и возможности персонажей

### Что найдено у SG Protocol

Серия Battlefield Roles разделена на шесть частей по алфавиту. Автор рассматривает мобильность, живучесть, урон, рабочую дальность, контроль и поддержку. Баллы по этим направлениям — авторские оценки. Персонажу могут назначаться несколько ролей.

В исходной методике специально не учитывается изменение персонажа под лидерствами. Это ограничивает прямой перенос классификации в рекомендации для конкретного ростера. Основные части написаны весной 2025 года, до обновлений карточек августа 2026 года.

### Предлагаемая рабочая классификация

Это предложение для нашего приложения, а не официальный набор классов MCP и не дословное копирование одной авторской системы.

| Роль | Задача |
|---|---|
| Курьер Extract | Забрать жетон, сохранить его и приносить очки |
| Охотник за Extract | Догнать носителя, отнять жетон или заставить уронить |
| Держатель Secure | Удерживать точку под давлением |
| Специалист по переключению точек | Эффективно перемещаться между точками и менять их контроль |
| Боец ближней зоны / Brawler | Выигрывать затяжную драку в нужном месте |
| Ударник | Создавать угрозу быстрого большого урона ключевой цели |
| Стрелок / дальний урон | Создавать давление на дистанции |
| Контроллер | Перемещать противника, накладывать состояния, ограничивать его действия |
| Поддержка / Enabler | Давать энергию, перемещение, лечение и надёжность союзникам |
| Защитник | Сохранять ключевые модели и ограничивать удобный выбор целей противником |

Допустимы пересечения и более узкие подроли. Роль нужно хранить с указанием основной/дополнительной функции и контекста, в котором она работает.

Bodyguard, Taunt, Stealth, лечение, иммунитеты и конкретные способы перемещения удобнее хранить отдельными признаками. Glass Cannon описывает сочетание сильного урона и слабой живучести. Grunt Parent обозначает наличие отдельной игровой механики. Их не обязательно делать равноправными основными ролями.

### Профиль возможностей

Для каждого полезного инструмента фиксировать:

- Доступен ли он самостоятельно или нужен союзник, лидерство, тактика либо особая форма.
- Дальность, допустимые цели, предел размера, условия видимости и положения.
- Стоимость энергии и действий; доступность в первом раунде.
- Ограничение частоты и окно применения.
- Гарантирован ли эффект, требует ли конкретных символов или нанесения урона.
- Работает ли он при удержании нужного типа жетона.
- Чем противник может помешать.

Сначала нужен качественный профиль с объяснением. Универсальные числовые оценки по всем осям в этом исследовании не откалиброваны.

## Применение в MCP Companion

### Покрытие задач в вариантах отряда

Уже существующий перебор составов по Threat можно дополнить описанием задач: кто работает с Extract, кто держит Secure, кто даёт контроль и кто обеспечивает ресурсы. Учитывать выбранное лидерство, обязательных и исключённых персонажей, а не только наличие тегов во всём ростере.

Возможные объяснения: нет самостоятельного стартового захвата; контроль зависит от броска; несколько ключевых моделей одновременно требуют поддержки энергией; состав трудно перебрасывает силы между удалёнными точками. Это примеры будущих проверок, а не уже выявленные недостатки конкретных отрядов.

Количество ролей не равно качеству состава. Проверять нужно соответствие выбранному плану и кризисам. Советы должны объяснять компромиссы, не превращая любой пропущенный тег в ошибку.

### Профили кризисов

Хранить форму и расстояния между целями, способы начисления очков, типы жетонов, особенности перемещения носителей и повторные затраты на взаимодействия. Отдельно учитывать совмещение Secure и Extract и места, где образуются драки.

Материалы по ротации 2026 года показывают важность Source-жетонов: ресурсная и позиционная задача может повторяться каждый раунд. План, рассчитанный на однократный захват и длительное удержание в удалённом месте, требует отдельной проверки на таком кризисе.

Любые точные инструкции брать из действующей карточки кризиса и FAQ. Статьи с первыми впечатлениями до выхода набора не заменяют эту проверку.

### Условные стартовые приёмы и комбинации

Для приёма нужны исходная позиция или схема, состав, лидерство, карты, первоначальная энергия, последовательность действий, затраты, ожидаемый результат и возможные ответы соперника.

Различать самостоятельный безопасный захват и захват, который появляется через помощь. Геометрию проверять с учётом базы, инструмента движения, исходной расстановки, препятствий и типа цели. Не предполагать, что термин «быстро двигается» автоматически означает доступ к конкретному жетону.

Приём должен содержать запасной план при неудачном броске или ответе противника. Название «безопасный захват» описывает относительную безопасность в определённой позиции и не обещает неуязвимость.

### Энергия, атаки и состояния

В разборе Spender полезны четыре вопроса: оправдана ли цена, насколько надёжен дополнительный эффект, даёт ли он перемещение или другое совмещённое действие, какие возможности мы теряем после расхода энергии. Дополнительно учитывать энергию, которую получит соперник от нанесённого урона.

Для вероятностей полезны шанс получить нужный минимум, шанс полного провала, разброс и последовательность модификаций. Средний урон сам по себе не отвечает на вопрос о надёжности решения. Конкретные калькуляторы и примеры нужно независимо сверять с правилами и текущими карточками.

У состояний важна применимость к цели и её плану, момент появления и цена снятия. Не переносить старые списки «лучших состояний» в фиксированную универсальную иерархию.

### Матчапы и профиль угроз

Описывать способы обойти защиту, вывести модель из нужной зоны, ограничить её действия и ресурсы. Учитывать дистанцию, доступность контроля и защитные механики целиком. Один показатель защиты не определяет лучшую цель или лучшую атаку.

Полезный формат для пользователя: какая угроза есть у противника, за счёт чего она работает и какие инструменты нашего отряда могут ответить. Полную матрицу матчапов этот обзор не создаёт.

### Разборы партий и дальнейшая аналитика

В материалах First Class и Bovine Overlord встречаются реальные отряды, пары кризисов, выбранные тактики, ход мысли и ошибки автора. Они могут стать источником знаний о фактическом использовании персонажа, которое не видно из обычного турнирного ростера.

При извлечении различать:

- Ростер из десяти моделей и фактически выставленный отряд.
- Что прямо сообщил автор и что мы восстановили по косвенным данным.
- Дату публикации и дату самой игры.
- Описание решения до броска и оценку результата задним числом.
- Индивидуальную игру и командный турнир с ограничениями распределения персонажей.

Привязывать отчёт к игроку и событию Longshanks только при проверяемом соответствии. Не додумывать отсутствующие составы, карты или результаты. Не считать опубликованные отчёты случайной выборкой; статистику из них хранить с отдельным происхождением.

### Обучение решениям

Перспективны отработка первых действий без соперника и задания по позиции: выбрать активацию, оценить достаточное число очков, сравнить риск атаки и безопасного перемещения. Для задачи нужны состояние стола и ресурсов, доступная игроку информация, альтернативы и объяснение ответа.

Комментарий к записанной партии может стать материалом для такой задачи, но описание видео ещё не содержит полноценного разбора решений. Это направление следующего изучения, а не готовая коллекция упражнений.

## Источники, актуальность и внутренняя модель данных

### Разделение знаний

| Слой | Что хранить |
|---|---|
| Официальный факт | Правило или текст действующей карточки |
| Тактическое мнение | Утверждение автора гайда с условиями и аргументами |
| Выведенная возможность | Наша проверенная последовательность или классификация на основе правил |
| Наблюдаемое использование | Результат, отряд или решение из конкретной игры |

Хранить связи между слоями. Роль не должна превращаться в официальный факт только потому, что она есть в известном блоге; удачный результат не доказывает полезность каждого элемента состава.

### Предлагаемые внутренние поля

- Сущность и точная игровая версия: персонаж/форма/сторона карты, лидерство, тактика, кризис.
- Утверждение, роль или конкретный инструмент.
- Основная/дополнительная/условная роль.
- Контекст: лидерство, союзники, кризисы, матчап, ресурсы, положение на столе.
- Последовательность и стоимость действий; зависимость от случайного результата.
- URL, автор или издатель, тип источника, дата публикации и дата игры.
- Степень знакомства с материалом: полный текст, выдержка, описание, транскрипт и т. п.
- С какой версией правил сверено и когда выполнена проверка.
- Уверенность, противоречащие мнения, открытые вопросы и необходимость повторной проверки.

Это служебная информация для ассистента и будущей базы. По пожеланию пользователя она не должна загромождать продуктовый интерфейс.

### Актуальность

AMG публикует текущие правила, FAQ, форматы и обновления карточек на общей странице MCP Rules. На момент исследования там присутствуют обновления августа 2026 года. Перед переносом конкретного совета проверять действующие карточки и правила.

Дата в URL статьи может отражать первоначальную публикацию, хотя текст позднее дополнялся. Пометка «2026 update» сама по себе не подтверждает, что проверены все относящиеся к теме изменения. Не выводить правила приоритета, численность наборов карт или ограничения формата из старого гайда.

### Приоритеты дальнейшей работы

1. Подготовить и проверить многозначные роли и профили возможностей персонажей.
2. Показать покрытие задач в существующих вариантах отряда.
3. Подготовить профили кризисов и объяснения соответствия составу.
4. Собрать проверенные условные стартовые приёмы и комбинации.
5. Развить профиль угроз соперника и варианты контрплея.
6. Изучить подробные записи партий и подготовить задачи по решениям.

Это предложения по применению исследования. Реализация отдельных пунктов потребует отдельной задачи.

## Первичная реализация ролей — 23 октября 2026

В `data/character-roles.json` хранится начальная редакционная разметка 236 самостоятельных персонажей каталога. Использованы десять ролей из согласованной классификации, включая отдельного Ударника. Семь Grunt-записей не имеют самостоятельных ролей и не увеличивают покрытие отряда. Эта разметка — интерпретация задач на столе по текущему локальному набору карточек Jarvis, не рейтинг силы и не автоматическое преобразование тегов в роли.

`data/character-role-provenance.json` содержит служебные сведения: дату разметки, версию каталога, версии и контрольные суммы карточек, ссылки на первичные данные. Этот файл не импортируется в пользовательский интерфейс. Проверка покрытия и соответствия исходным карточкам включена в Node-тесты; после изменения карточки её роли нужно пересмотреть и обновить служебную запись.

В каталоге персонажей, списках коллекции, билдере и бою роли показываются набором иконок Font Awesome Free 7.3.1 (CSS и локальный webfont) без постоянных подписей. Пояснение открывается наведением, фокусом клавиатуры или касанием. Сводки ростера и отряда объединяют одинаковые роли; пояснение перечисляет число и имена предоставляющих их персонажей. Вариант отряда использует только собственных участников, а не весь исходный ростер. Готовый бой использует фактически выбранную сторону и её бойцов.

Условия хранятся у назначения роли. Например, Rhino требует `This is a Robbery` для роли охотника, Quicksilver — `Can I Borrow That?`, а защитная роль Groot относится к Rocket Raccoon. Когда состав и карты известны, отсутствующая предпосылка исключает вклад из сводки. У выбранного отряда с известным лидером учитывается и условие лидерства. При просмотре отдельного персонажа условная роль видна с пояснением; при неизвестном лидерстве в вариантах ростера такая роль показывает потенциальное покрытие с тем же условием. Это описание состава, а не система живых подсказок о доступности действия в текущий момент боя.

Библиотека Font Awesome Free закреплена в `assets/fontawesome/7.3.1/`, включая лицензию и файл происхождения `SOURCE.json`. В браузере не используются CDN и SVG/JS-подмена: иконки рисуются локальным шрифтом.

По последующему пожеланию пользователя от 23 октября 2026 года иконки ролей убраны из всего турнирного представления: списка персонажей, обзора выбранного персонажа и раскрытых турнирных ростеров. В самостоятельном каталоге, билдере и отрядах они остаются.

Личные коллекции, сохранённые ростеры, данные боёв и турнирный рейтинг не получают новых обязательных полей. Роли и источники не меняют подсчёт баллов. Фильтры по ролям, отдельные возможности персонажей и автоматические советы в эту задачу не входят.

## Реестр источников

Все 52 записи из исходного реестра включены ниже, чтобы этот файл был самодостаточным. Примечания `Use` и `Version risk` сохранены из рабочего реестра. Они предназначены для внутренней работы, не для отображения в приложении.

### 01. MCP Rules

- **ID:** `amg-rules`.
- **Источник:** [Atomic Mass Games](https://www.atomicmassgames.com/mcp-rules/).
- **Дата:** Не установлена; подборка или обновляемая страница.
- **Тип:** `official_reference`. **Проверка:** Страница прочитана; для подборки это проверка структуры и ссылок.
- **Темы:** rules, errata, formats, affiliations, card_versions.
- **Use:** Canonical entry point; explicitly lists August 2026 card updates.
- **Version risk:** `live_hub_verified_2026-10-23`.

### 02. FAQ and Errata August 2026

- **ID:** `amg-faq`.
- **Источник:** [Atomic Mass Games](https://cdn.svc.asmodee.net/production-amgcom/uploads/2026/08/OP_CrisisProtocol_FAQ_08_01_2026.pdf).
- **Дата:** 2026-08.
- **Тип:** `official_reference`. **Проверка:** PDF открыт, текст доступен; подробная проверка всех положений не заявляется.
- **Темы:** rules, timing, errata.
- **Use:** Version anchor for validating guide statements.
- **Version risk:** `newer_official_version_may_replace_it`.

### 03. Format Rules August 2026

- **ID:** `amg-formats`.
- **Источник:** [Atomic Mass Games](https://cdn.svc.asmodee.net/production-amgcom/uploads/2026/08/OP_CrisisProtocol_Formats_08_01_2026.pdf).
- **Дата:** 2026-08.
- **Тип:** `official_reference`. **Проверка:** PDF открыт, текст доступен; подробная проверка всех положений не заявляется.
- **Темы:** formats, legality, crises.
- **Use:** Validate legal content against the actual selected format.
- **Version risk:** `newer_official_version_may_replace_it`.

### 04. Core Rulebook November 2025

- **ID:** `amg-core`.
- **Источник:** [Atomic Mass Games](https://cdn.svc.asmodee.net/production-amgcom/uploads/2025/11/DOC40_RevisedCoreSet_Rulebook_11_2025.pdf).
- **Дата:** 2025-11.
- **Тип:** `official_reference`. **Проверка:** Только поисковый индекс: большой PDF превысил лимит извлечения.
- **Темы:** rules, priority, mission_building.
- **Use:** Large PDF exceeded web extraction limit; full rulebook not reviewed in this research.
- **Version risk:** `follow_current_link_from_amg_rules_hub`.

### 05. Battlefield Roles

- **ID:** `sg-role-index`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/p/battlefield-roles-for-every-mcp.html).
- **Дата:** Не установлена; подборка или обновляемая страница.
- **Тип:** `collection`. **Проверка:** Страница прочитана; для подборки это проверка структуры и ссылок.
- **Темы:** roles.
- **Use:** Six-part alphabetical series. Author classification, not official character classes.
- **Version risk:** `recheck_current_cards_and_rules`.

### 06. Battlefield roles A-C

- **ID:** `sg-role-ac`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2025/04/battlefield-roles-for-every-mcp.html?m=1).
- **Дата:** 2025-04-29.
- **Тип:** `analysis`. **Проверка:** Содержательная часть статьи просмотрена в веб-выдаче.
- **Темы:** roles, character_profiles.
- **Use:** Multi-role examples; six capability axes. Original approach excludes leadership modifiers.
- **Version risk:** `predates_august_2026_card_changes`.

### 07. Battlefield roles D-G

- **ID:** `sg-role-dg`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2025/05/battlefield-roles-for-every-mcp.html).
- **Дата:** 2025-05.
- **Тип:** `analysis`. **Проверка:** Статья доступна; использована содержательная поисковая выдержка.
- **Темы:** roles, character_profiles.
- **Use:** Multi-role examples; six capability axes. Original approach excludes leadership modifiers.
- **Version risk:** `predates_august_2026_card_changes`.

### 08. Battlefield roles H-L

- **ID:** `sg-role-hl`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2025/05/battlefield-roles-for-every-mcp_5.html?m=1).
- **Дата:** 2025-05.
- **Тип:** `analysis`. **Проверка:** Статья открыта и доступна; подробный разбор всего содержания не заявляется.
- **Темы:** roles, character_profiles.
- **Use:** Multi-role examples; six capability axes. Original approach excludes leadership modifiers.
- **Version risk:** `predates_august_2026_card_changes`.

### 09. Battlefield roles M-O

- **ID:** `sg-role-mo`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2025/05/battlefield-roles-for-every-mcp_6.html).
- **Дата:** 2025-05.
- **Тип:** `analysis`. **Проверка:** Содержательная часть статьи просмотрена в веб-выдаче.
- **Темы:** roles, character_profiles.
- **Use:** Multi-role examples; six capability axes. Original approach excludes leadership modifiers.
- **Version risk:** `predates_august_2026_card_changes`.

### 10. Battlefield roles P-S

- **ID:** `sg-role-ps`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2025/05/battlefield-roles-for-every-mcp_10.html?m=1).
- **Дата:** 2025-05.
- **Тип:** `analysis`. **Проверка:** Статья открыта и доступна; подробный разбор всего содержания не заявляется.
- **Темы:** roles, character_profiles.
- **Use:** Multi-role examples; six capability axes. Original approach excludes leadership modifiers.
- **Version risk:** `predates_august_2026_card_changes`.

### 11. Battlefield roles T-Z

- **ID:** `sg-role-tz`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2025/05/battlefield-roles-for-every-mcp_12.html?m=1).
- **Дата:** 2025-05.
- **Тип:** `analysis`. **Проверка:** Статья открыта и доступна; подробный разбор всего содержания не заявляется.
- **Темы:** roles, character_profiles.
- **Use:** Multi-role examples; six capability axes. Original approach excludes leadership modifiers.
- **Version risk:** `predates_august_2026_card_changes`.

### 12. Affiliation Overviews

- **ID:** `sg-affiliations`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/p/affiliation-overviews.html).
- **Дата:** Не установлена; подборка или обновляемая страница.
- **Тип:** `collection`. **Проверка:** Страница прочитана; для подборки это проверка структуры и ссылок.
- **Темы:** affiliation_plans, leaders, rosters, tactics, crises.
- **Use:** Broad affiliation guide index. Verify update dates within each article.
- **Version risk:** `recheck_current_cards_and_rules`.

### 13. Affiliation Overview Web Warriors

- **ID:** `sg-webs`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2024/12/affiliation-overview-web-warriors.html).
- **Дата:** 2024-12-01.
- **Тип:** `analysis`. **Проверка:** Содержательная часть статьи просмотрена в веб-выдаче.
- **Темы:** affiliation_plans, leaders, character_roles, tactics, crises.
- **Use:** Explains different plans within one affiliation; useful structure rather than current tier judgements.
- **Version risk:** `older_url_with_later_content_additions_update_date_not_verified`.

### 14. Affiliation Overview Cabal 2026 update

- **ID:** `sg-cabal`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2025/01/affiliation-overview-cabal-updated.html).
- **Дата:** Не установлена; подборка или обновляемая страница.
- **Тип:** `analysis`. **Проверка:** Только поисковая выдержка.
- **Темы:** affiliation_plans, leaders, rosters.
- **Use:** Current-update candidate; original URL date is not a reliable last-edit date.
- **Version risk:** `recheck_current_cards_and_rules`.

### 15. Rules and Beginners Help

- **ID:** `sg-beginner-index`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/p/rules-help-articles.html).
- **Дата:** Не установлена; подборка или обновляемая страница.
- **Тип:** `collection`. **Проверка:** Страница прочитана; для подборки это проверка структуры и ссылок.
- **Темы:** rules, beginner, resources.
- **Use:** Links to timing, probabilities, dual affiliation, grabs, steals and spender analysis.
- **Version risk:** `recheck_current_cards_and_rules`.

### 16. Every Safe grab in MCP

- **ID:** `sg-safe-grabs`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2025/08/every-safe-grab-in-mcp.html?m=1).
- **Дата:** 2025-08-27.
- **Тип:** `capability_catalog`. **Проверка:** Содержательная часть статьи просмотрена в веб-выдаче.
- **Темы:** openings, movement, extracts, synergies.
- **Use:** Distinguishes inherent grabs from leadership/card-enabled sequences. Base size and initial power matter.
- **Version risk:** `recheck_current_cards_and_rules`.

### 17. Every Objective Steal in MCP

- **ID:** `sg-steals`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2025/08/every-objective-steal-in-mcp.html?m=1).
- **Дата:** 2025-08.
- **Тип:** `capability_catalog`. **Проверка:** Статья открыта и доступна; подробный разбор всего содержания не заявляется.
- **Темы:** extracts, counters, synergies.
- **Use:** Candidate index of stealing/dropping objective mechanisms and their conditions.
- **Version risk:** `recheck_current_cards_and_rules`.

### 18. What makes a Spender a good Spender?

- **ID:** `sg-spenders`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2025/06/what-makes-spender-good-spender.html?m=1).
- **Дата:** 2025-06-26.
- **Тип:** `analysis`. **Проверка:** Содержательная часть статьи просмотрена в веб-выдаче.
- **Темы:** power, action_economy, attacks, decision_making.
- **Use:** Evaluate resource opportunity cost, automatic versus rolled effects and added movement.
- **Version risk:** `recheck_current_cards_and_rules`.

### 19. The Pros and Cons of dual affiliating

- **ID:** `sg-dual`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2025/05/the-pros-and-cons-of-dual-affiliating.html?m=1).
- **Дата:** 2025-05.
- **Тип:** `analysis`. **Проверка:** Статья открыта и доступна; подробный разбор всего содержания не заявляется.
- **Темы:** roster_building, leaders, affiliation_plans.
- **Use:** Framework for versatility versus diluted roster/card slots.
- **Version risk:** `recheck_current_cards_and_rules`.

### 20. Rules Help the attack timing chart

- **ID:** `sg-timing`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2025/04/rules-help-attack-timing-chart.html).
- **Дата:** 2025-04.
- **Тип:** `rules_explainer`. **Проверка:** Статья открыта и доступна; подробный разбор всего содержания не заявляется.
- **Темы:** rules, timing, reactions.
- **Use:** Teach timing windows with canonical rules as final authority.
- **Version risk:** `recheck_current_cards_and_rules`.

### 21. Don’t blame the dice! Understanding probabilities

- **ID:** `sg-probability`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2025/04/dont-blame-dice-understanding.html).
- **Дата:** 2025-04.
- **Тип:** `analysis`. **Проверка:** Статья открыта и доступна; подробный разбор всего содержания не заявляется.
- **Темы:** probabilities, risk, decision_making.
- **Use:** Candidate basic probability explainer.
- **Version risk:** `recheck_current_cards_and_rules`.

### 22. All unaffiliated character specific TTCs rated

- **ID:** `sg-personal-tactics`.
- **Источник:** [SG Protocol](https://sgprotocol.blogspot.com/2025/03/all-unaffiliated-character-specific.html).
- **Дата:** 2025-03.
- **Тип:** `analysis`. **Проверка:** Только поисковая выдержка.
- **Темы:** tactics, character_synergies.
- **Use:** Useful character-card relationship inventory; author grades need revalidation.
- **Version risk:** `recheck_current_cards_and_rules`.

### 23. Strategic Initiatives Extract Plays 8

- **ID:** `firstclass-extract8`.
- **Источник:** [MCP First Class](https://mcpfirstclass.blogspot.com/2026/05/strategic-initiatives-extract-plays-8.html).
- **Дата:** 2026-05-25.
- **Тип:** `illustrated_playbook`. **Проверка:** Содержательная часть статьи просмотрена в веб-выдаче.
- **Темы:** openings, geometry, crises, power, synergies.
- **Use:** Illustrated X-Men plays on the 2026 Source crisis rotation.
- **Version risk:** `pre_august_2026_cards_verify_each_line`.

### 24. Strategic Initiative Extract Plays 7

- **ID:** `firstclass-extract7`.
- **Источник:** [MCP First Class](https://mcpfirstclass.blogspot.com/2025/02/strategic-initiative-extract-plays-7.html).
- **Дата:** 2025-02-20.
- **Тип:** `illustrated_playbook`. **Проверка:** Содержательная развёрнутая выдержка в поиске; отдельная страница могла быть недоступна.
- **Темы:** openings, geometry, crises, synergies.
- **Use:** Diagrams and alternative lines for opposing/home extract access.
- **Version risk:** `recheck_current_cards_and_rules`.

### 25. Battle for Breath 2026 Battle Report

- **ID:** `firstclass-batrep26`.
- **Источник:** [MCP First Class](https://mcpfirstclass.blogspot.com/2026/06/battle-for-breath-2026-battle-report.html).
- **Дата:** 2026-06-16.
- **Тип:** `player_report`. **Проверка:** Содержательная часть статьи просмотрена в веб-выдаче.
- **Темы:** actual_squads, matchups, decisions, post_game_review.
- **Use:** Records chosen squads, crisis pairs and reasons including the author’s retrospective mistake.
- **Version risk:** `event_2026-06_before_august_update`.

### 26. WTC 2024 Battle Report

- **ID:** `firstclass-wtc24`.
- **Источник:** [MCP First Class](https://mcpfirstclass.blogspot.com/2024/10/wtc-2024-battle-report.html).
- **Дата:** 2024-10-24.
- **Тип:** `player_report`. **Проверка:** Содержательная развёрнутая выдержка в поиске; отдельная страница могла быть недоступна.
- **Темы:** team_pairings, actual_squads, matchups, roster_building.
- **Use:** Demonstrates team pairing constraints and roster tradeoffs; historical examples only.
- **Version risk:** `recheck_current_cards_and_rules`.

### 27. Quiet Council Meeting Horeath

- **ID:** `firstclass-interview`.
- **Источник:** [MCP First Class](https://mcpfirstclass.blogspot.com/2024/12/quiet-council-meeting-horeath.html).
- **Дата:** 2024-12-12.
- **Тип:** `player_interview`. **Проверка:** Содержательная развёрнутая выдержка в поиске; отдельная страница могла быть недоступна.
- **Темы:** leaders, synergies, character_roles.
- **Use:** Illustrates roles changing with leadership and pilot plan; author opinion, not labels to copy.
- **Version risk:** `recheck_current_cards_and_rules`.

### 28. Marvel Crisis Protocol Tactics

- **ID:** `los-index`.
- **Источник:** [Line of Sight](https://lineofsightwargaming.com/category/marvel-crisis-protocol/marvel-crisis-protocol-tactics/).
- **Дата:** Не установлена; подборка или обновляемая страница.
- **Тип:** `collection`. **Проверка:** Страница прочитана; для подборки это проверка структуры и ссылок.
- **Темы:** tactics, training_resources.
- **Use:** Index to older systematic tactics articles.
- **Version risk:** `recheck_current_cards_and_rules`.

### 29. Advanced Deployment

- **ID:** `los-deployment`.
- **Источник:** [Line of Sight](https://lineofsightwargaming.com/2022/11/16/doomed-prophecy-article-16-advanced-deployment/).
- **Дата:** 2022-11-16.
- **Тип:** `analysis`. **Проверка:** Содержательная часть статьи просмотрена в веб-выдаче.
- **Темы:** deployment, geometry, training.
- **Use:** Plan first-round objective access and reactive matchups; suggests solo deployment practice.
- **Version risk:** `historical_2022_rules_and_cards`.

### 30. Exploiting Weaknesses

- **ID:** `los-weakness`.
- **Источник:** [Line of Sight](https://lineofsightwargaming.com/2022/10/05/doomed-prophecy-article-10-exploiting-weaknesses/).
- **Дата:** 2022-10-05.
- **Тип:** `analysis`. **Проверка:** Содержательная часть статьи просмотрена в веб-выдаче.
- **Темы:** matchups, counters, damage.
- **Use:** Framework for matching tools to defensive profiles, beyond a simple lowest-defense rule.
- **Version risk:** `historical_2022_rules_and_cards`.

### 31. The Better Part of Valor

- **ID:** `los-closing`.
- **Источник:** [Line of Sight](https://lineofsightwargaming.com/2022/11/09/doomed-prophecy-article-15-the-better-part-of-valor/).
- **Дата:** 2022-11-09.
- **Тип:** `analysis`. **Проверка:** Содержательная часть статьи просмотрена в веб-выдаче.
- **Темы:** endgame, scoring, risk.
- **Use:** Converting an advantage into a win and choosing safety rather than maximizing surplus points.
- **Version risk:** `historical_2022_rules_and_cards`.

### 32. Pick a card any card

- **ID:** `los-tactics`.
- **Источник:** [Line of Sight](https://lineofsightwargaming.com/2022/10/26/doomed-prophecy-article-13-pick-a-card-any-card/).
- **Дата:** 2022-10-26.
- **Тип:** `analysis`. **Проверка:** Статья открыта и доступна; подробный разбор всего содержания не заявляется.
- **Темы:** tactics, roster_building, decision_making.
- **Use:** Framework for tactics-card selection and scenario versus damage utility.
- **Version risk:** `historical_2022_rules_and_cards`.

### 33. Mint Condition

- **ID:** `los-conditions`.
- **Источник:** [Line of Sight](https://lineofsightwargaming.com/2022/10/12/doomed-prophecy-article-11-mint-condition/).
- **Дата:** 2022-10-12.
- **Тип:** `analysis`. **Проверка:** Содержательная часть статьи просмотрена в веб-выдаче.
- **Темы:** conditions, counters, action_economy.
- **Use:** Conditions have different impact on different targets; examples need card/rule updates.
- **Version risk:** `historical_2022_rules_and_cards`.

### 34. An Exhaustive Guide to Marvel Dice Manipulation

- **ID:** `los-dice`.
- **Источник:** [Line of Sight](https://lineofsightwargaming.com/2022/10/21/an-exhaustive-guide-to-marvel-dice-manipulation-guest-article-by-john-elson/).
- **Дата:** 2022-10-21.
- **Тип:** `analysis`. **Проверка:** Статья открыта и доступна; подробный разбор всего содержания не заявляется.
- **Темы:** probabilities, rules, timing.
- **Use:** Detailed dice-modification reference; check all examples against current rules.
- **Version risk:** `historical_2022_rules_and_cards`.

### 35. Marvel Crisis Primer Action Economy

- **ID:** `flg-economy`.
- **Источник:** [Frontline Gaming](https://frontlinegaming.org/2020/10/30/fantasy-fisticuffs-marvel-crisis-primer-pt-3-action-economy/).
- **Дата:** 2020-10-30.
- **Тип:** `analysis`. **Проверка:** Содержательная развёрнутая выдержка в поиске; отдельная страница могла быть недоступна.
- **Темы:** action_economy, scoring, tempo.
- **Use:** Useful basic framework; all precise examples are historical.
- **Version risk:** `historical_2020_rules_and_cards`.

### 36. Breaking down the new season of Crises

- **ID:** `flg-crises26`.
- **Источник:** [Frontline Gaming](https://frontlinegaming.org/2026/05/18/breaking-down-the-new-season-of-crises-for-marvel-crisis-protocol/).
- **Дата:** 2026-05-18.
- **Тип:** `analysis`. **Проверка:** Содержательная часть статьи просмотрена в веб-выдаче.
- **Темы:** crises, scoring, openings, resources.
- **Use:** 2026 Source/arc examples show why crisis profile should include more than fast/slow and wide/narrow.
- **Version risk:** `first_impressions_before_release_and_august_update`.

### 37. Your guide to the Inhuman affiliation

- **ID:** `flg-inhumans`.
- **Источник:** [Frontline Gaming](https://frontlinegaming.org/2025/06/18/your-guide-to-the-inhuman-affiliation-in-marvel-crisis-protocol/).
- **Дата:** 2025-06-18.
- **Тип:** `analysis`. **Проверка:** Содержательная развёрнутая выдержка в поиске; отдельная страница могла быть недоступна.
- **Темы:** affiliation_plans, power, enablers, openings.
- **Use:** Illustrates support role opportunity cost and activation constraints.
- **Version risk:** `recheck_current_cards_and_rules`.

### 38. The math behind the punches decoding MCP dice

- **ID:** `touche-dice`.
- **Источник:** [Touche Critique](https://touchecritique.com/en/blog/mcp-us/marvel-crisis-protocol-dice-analysis/).
- **Дата:** 2025-12-05; revised 2026-06-04.
- **Тип:** `math_explainer`. **Проверка:** Содержательная часть статьи просмотрена в веб-выдаче.
- **Темы:** probabilities, reliability, damage.
- **Use:** Distribution and reliability matter beyond average damage.
- **Version risk:** `examples_pre_august_2026`.

### 39. Fury’s Finest

- **ID:** `fury-home`.
- **Источник:** [Fury’s Finest](https://www.furysfinest.com/).
- **Дата:** Не установлена; подборка или обновляемая страница.
- **Тип:** `podcast_hub`. **Проверка:** Страница прочитана; для подборки это проверка структуры и ссылок.
- **Темы:** characters, affiliations, synergies.
- **Use:** Author describes separate lore and strategy segments; target the strategy segment.
- **Version risk:** `recheck_current_cards_and_rules`.

### 40. AMG August 2026 update interview

- **ID:** `fury-amg26`.
- **Источник:** [Fury’s Finest / AMG](https://music.amazon.it/podcasts/1ed07879-849f-4c3d-8783-7a0030b7b92a/episodes/47b74b43-f2f0-428a-adfc-446c5fd10f2f/fury%27s-finest-a-marvel-crisis-protocol-podcast-amg%27s-will-shick-and-will-pagani-interview-august-2026-character-update-design-insights).
- **Дата:** 2026-09-01.
- **Тип:** `developer_interview`. **Проверка:** Только описание выпуска; выпуск не прослушан.
- **Темы:** design_intent, card_versions.
- **Use:** Candidate primary developer discussion; not listened to during this research.
- **Version risk:** `not_rules_authority`.

### 41. Mirage Havok and LVO 2026 report

- **ID:** `fury-lvo26`.
- **Источник:** [Fury’s Finest](https://podcasts.apple.com/us/podcast/mirage-havok-multiple-man-jubilee-news-las-vegas-open/id1076154822?i=1000795914071).
- **Дата:** 2026-10; exact date not verified.
- **Тип:** `player_report_audio`. **Проверка:** Только описание выпуска; выпуск не прослушан.
- **Темы:** actual_squads, post_game_review, meta.
- **Use:** Recent candidate; do not infer match details from episode description.
- **Version risk:** `recheck_current_cards_and_rules`.

### 42. Probability Manipulation

- **ID:** `danger-probability`.
- **Источник:** [The Danger Room](https://www.podscan.fm/podcasts/the-danger-room-a-marvel-crisis-protocol-podcast/episodes/probability-manipulation).
- **Дата:** 2026-02-23.
- **Тип:** `podcast_transcript`. **Проверка:** Просмотрен доступный фрагмент транскрипта; полный аудиоразбор не проводился.
- **Темы:** risk, variance, decision_making.
- **Use:** Original speaker transcript available through an aggregator; not full audio review.
- **Version risk:** `machine_transcript_verify_quotes`.

### 43. Adepticon Worlds Quarter Finals

- **ID:** `omnus-quarters26`.
- **Источник:** [Omnus Protocol](https://www.youtube.com/watch?v=zoBDxctatsE).
- **Дата:** 2026-04-02.
- **Тип:** `commentated_game`. **Проверка:** Только описание видео; видео не просмотрено.
- **Темы:** actual_squads, decisions, training.
- **Use:** Explicitly advertised as a commentated championship game; not watched in this research.
- **Version risk:** `pre_august_update`.

### 44. GT in Caledonia 29-30Aug2026 report

- **ID:** `bovine-gt26`.
- **Источник:** [The Bovine Overlord](https://thebovineoverlord.wordpress.com/2026/10/22/marvel-crisis-protocol-tournament-report-gt-in-caledonia-29-30aug2026/).
- **Дата:** 2026-10-22; event 2026-08-29/30.
- **Тип:** `player_report`. **Проверка:** Содержательная развёрнутая выдержка в поиске; отдельная страница могла быть недоступна.
- **Темы:** actual_squads, decisions, crises, post_game_review.
- **Use:** Post-August event report includes chosen squads, five tactics and reasons for mistakes.
- **Version risk:** `publication_date_differs_from_game_date`.

### 45. Second Wind 8 Simple Rules

- **ID:** `longshanks-35701`.
- **Источник:** [Longshanks](https://longshanks.org/event/35701/).
- **Дата:** 2026-09-05/06 event.
- **Тип:** `event_results`. **Проверка:** Просмотрена поисковая выдержка.
- **Темы:** events, rosters, results.
- **Use:** Join strategy reports to event/player data where IDs are verifiable. Published roster is not per-match squad.
- **Version risk:** `observational_and_selection_bias`.

### 46. Web Warrior Protocols

- **ID:** `wwp-hub`.
- **Источник:** [Web Warrior Protocols](https://webwarriorprotocols.wordpress.com/).
- **Дата:** Не установлена; подборка или обновляемая страница.
- **Тип:** `collection`. **Проверка:** Страница прочитана; для подборки это проверка структуры и ссылок.
- **Темы:** character_guides, tactics, video.
- **Use:** Blog explicitly moved most content to YouTube; old blog posts are historical.
- **Version risk:** `recheck_current_cards_and_rules`.

### 47. Omega Level Crisis

- **ID:** `omega-hub`.
- **Источник:** [Omega Level Crisis](https://www.omegalevelcrisis.com/).
- **Дата:** Не установлена; подборка или обновляемая страница.
- **Тип:** `collection`. **Проверка:** Страница прочитана; для подборки это проверка структуры и ссылок.
- **Темы:** beginner, casual.
- **Use:** Author explicitly targets casual/new players, not specifically competitive optimization.
- **Version risk:** `hub_only_not_article_review`.

### 48. 100 articles editor’s pick

- **ID:** `xavier-index`.
- **Источник:** [Xavier Protocols](https://xavierprotocols.wordpress.com/2020/06/28/100-articles-editors-pick/).
- **Дата:** 2020-06-28.
- **Тип:** `collection`. **Проверка:** Страница прочитана; для подборки это проверка структуры и ссылок.
- **Темы:** probabilities, activation, deployment, roster_building.
- **Use:** Historical fundamentals; some original external article links no longer accessible.
- **Version risk:** `historical_2020`.

### 49. Priority during a game

- **ID:** `xavier-priority`.
- **Источник:** [Xavier Protocols](https://xavierprotocols.wordpress.com/2020/06/30/priority-during-a-game/).
- **Дата:** 2020-06-30.
- **Тип:** `analysis`. **Проверка:** Содержательная часть статьи просмотрена в веб-выдаче.
- **Темы:** activation, priority, tempo.
- **Use:** Illustrates early versus late activation value; old priority rules cannot be reused as current instructions.
- **Version risk:** `historical_priority_rules`.

### 50. Goonhammer MCP section

- **ID:** `goonhammer-candidate`.
- **Источник:** [Goonhammer](https://www.goonhammer.com/marvel-crisis-protocol/).
- **Дата:** Не установлена; подборка или обновляемая страница.
- **Тип:** `candidate`. **Проверка:** Доступ заблокирован: HTTP 403. Не считать проверенным содержанием.
- **Темы:** character_guides, tactics.
- **Use:** Not treated as read or current; some indexed equivalents appear on Tabletop Battles.
- **Version risk:** `access_and_provenance_not_verified`.

### 51. Across the Bifrost site

- **ID:** `bifrost-candidate`.
- **Источник:** [Across the Bifrost](https://acrossthebifrost.com/).
- **Дата:** Не установлена; подборка или обновляемая страница.
- **Тип:** `candidate`. **Проверка:** Страница недоступна. Не считать проверенным содержанием.
- **Темы:** podcasts, tactics.
- **Use:** Do not confuse unavailable legacy site with currently published podcast episodes.
- **Version risk:** `access_and_archive_gaps`.

### 52. MCP Dice Calculator

- **ID:** `dice-rejected`.
- **Источник:** [Table Games Hub](https://tablegameshub.com/marvel-crisis-protocol-dice-calculator/).
- **Дата:** Не установлена; подборка или обновляемая страница.
- **Тип:** `calculator_candidate`. **Проверка:** Исключён из проверенной основы: в объяснении критов обнаружены внутренние противоречия.
- **Темы:** probabilities.
- **Use:** Page gives conflicting explanations of recursive criticals. Do not adopt without independent verification.
- **Version risk:** `not_accepted_as_rules_or_math_reference`.
