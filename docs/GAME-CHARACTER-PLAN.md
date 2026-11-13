# Добавление персонажей в Game

Добавляем по одному персонажу. Статус «Готово» означает, что бойца можно взять в сохранённый ростер Game, а его атаки, способности и обязательные решения проверены через команды партии. Для каждого нового эффекта нужен сценарий с проверкой результата, включая отказ при недопустимом действии там, где это важно.

Перед добавлением способности сверяем эффект и момент срабатывания с уже существующими. Если у одноимённой атаки разных персонажей разный текст, правило задаём в `characterProfiles` по ключу `slug:имя`. Power на активные и реактивные суперспособности списываем через `combat.spend`, чтобы на трату могли реагировать Leadership вроде Xavier's School. Charge, Hit and Run и Freeze and Fade используют общую последовательность Move и Attack. Ice Slide и Air Lift используют одну механику выбора союзника до Move и размещения после него.

| Очередь | Персонаж | Статус | Следующий шаг |
| --- | --- | --- | --- |
| База | Earth’s Mightiest и уже добавленные бойцы | В Game | 17 бойцов и Ultron Drones. Базовые сценарии способностей уже в тестах. |
| 1 | Scarlet Witch | Готово | Сохранённый ростер и механики карты проверены. |
| 2 | Quicksilver | Готово | Проверены атаки, Speedster, Can’t Catch Me и перебросы. |
| 3 | Magneto | Готово | Проверены Metal Constructs, Leadership, Peerless, атаки и реакция. |
| 4 | Toad | Готово | Проверены Interact на Range 2, перенос жетона и Slippery. |
| 5 | Rogue | Готово | Проверены Mutant Absorption, Sap Power, броски и снижение урона. |
| 6 | Pyro | Готово | Проверены перенос Incinerate, Firewall и бонус ко всем целям луча. |
| 7 | The Blob | Готово | Проверены Push после атаки, Tickles и иммунитет к Push и Throw от атак. |
| 8 | Juggernaut | Готово | Проверены Push сквозь террейн, Nice Punch, Unstoppable Momentum и обе стороны карты. |
| 9 | Avalanche | Готово | Проверены обе атаки, Landslide и реакция после Advance. |
| 10 | Gambit | Готово | Проверены Wild в трёх типах броска, изменение кубиков и Enhanced Agility. |
| 11 | Sabretooth, Apex Predator | Готово | Проверены оба броска, бонус атаки, лечение и ограничение Alter Ego. |
| 12 | Colossus | Готово | Проверены Big Brother, обе версии Bozhe Moi, Organic Steel, атаки и Playing Catch. |
| 13 | Emma Frost | Готово | Проверены Diamond Form, Shield Mind, Power Inhibition и порядок Shatter. |
| 14 | Lady Mastermind | Готово | Проверены Mental Lock, Deadly Illusions, Brain Fog и заимствование атак. |
| 15 | Exodus | Готово | Проверены атаки, телепортация, оплата броска и защита союзников. |
| 16 | Shadow King | Готово | Проверены Projection, две атаки, Nightmare Visions и восстановление. |
| 17 | Beast | Готово | Проверены платные перебросы защиты и уклонения, Power за Failure. |
| 18 | Wolverine | Готово | Проверены Adamantium Skeleton, Wild Rage и усиленный Move + Attack. |
| 19 | Cyclops | Готово | Проверены X-Men Blue, Quick Draw и дополнительные атаки. |
| 20 | Storm | Готово | Проверены X-Men Gold, Eye of the Storm и Hurricane после всех целей. |
| 21 | Jean Grey | Готово | Проверены Shield Mind, Matter Transmutation и эффекты обеих атак. |
| 22 | Nightcrawler | Готово | Проверены переменный BAMF!, счётчик Place и Flurry of Blows. |
| 23 | Iceman | Готово | Проверены Ice Slide, Freeze and Fade, Cold Snap и обе атаки. |
| 24 | Angel | Готово | Проверены Air Lift и Hostile Takeover в одном Move, Flyby и Avenging Angel. |
| 25 | Professor X | Готово | Проверены Xavier's School, Professor's Guidance, Telepathic Lock и все три атаки. Браузер не проверен. |
| 26 | Psylocke | Готово | Проверены Katana с выбором типа, Neural Disruption, Pursuit, Telekinetic Combat Enhancement и Telepathic Precognition. |
| 27 | Shadowcat | Готово | Проверены атаки без защитных Critical, Sidestep и Ghosted, Phase Rush и обе части Can‘t Touch This. |
| 28 | Havok | Готово | Проверены Plasma Dispersion, Pierce и Incinerate Plasma Wave, Cosmic Energy Absorption и Blast Off. Leadership X-Factor не добавлен: в Game нет этой аффилиации. |
| 29 | Jubilee | Готово | Проверены Stun на Wild и Hit, Rapid Fire, Fireworks, Wolverine! и I Totally Meant to Do That!. |
| 30 | Domino | Готово | Проверены Rapid Fire, Grenade Bounce через LOS, Lucky Shot, Probability Manipulation и Things Tend To Go My Way. |
| 31 | Bishop | Готово | Проверены XSE Blaster в Range 3, Return With Interest с выбором типа и доплатой Power, Mutant Energy Absorption, Overload и иммунитеты. |
| 32 | X-23 | Готово | Проверены Claw Rush, Assassin Training, Frenzy после Daze и Lil‘ Sis. |
| 33 | Honey Badger | Готово | Проверены Hamstring, Claw Slash без Pierce, Too Dangerous to Ignore, Anklebiter и Big Sis. |

Следующую группу выбираем по аффилиациям и новым правилам, которые нужны для игры.

## 1. Scarlet Witch

- [x] Сверены обе стороны карты в каталоге и разъяснения AMG для Hex Bolt, Chosen of Chthon и Curse.
- [x] Hex Bolt даёт Power за урон, Chaos Magic предлагает выбор состояния за каждый Failure.
- [x] Cruel Twist подавляет защитные Critical, Reality Contortion даёт выбор защитного кубика при Failure.
- [x] Chosen of Chthon засчитывает Failure в атаке, защите и уклонении.
- [x] Telekinesis бросает подходящий террейн, Flight участвует в расчёте Advance.
- [x] Hex Field ограничивает Shake в радиусе способности, Curse реагирует на урон от вражеского эффекта.
- [x] Scarlet Witch доступна в сохранённом ростере, проверены карточка и Curse в браузере и состояние партии через CLI.

[Восемь сценариев Scarlet Witch](../tests/game-scarlet-witch.test.cjs).

[Atomic Mass Games](https://www.atomicmassgames.com/transmission/from-panel-to-play-scarlet-witch/), [разъяснение Curse](https://forums.atomicmassgames.com/topic/1120-scarlet-witch-curse-eligible-targets/), [FAQ и актуальные карты](https://www.atomicmassgames.com/mcp-rules/).

## 2. Quicksilver

- [x] Dash и цепочка Velocity, выбор порядка при двух срабатываниях, Medium Advance от Cyclonic Vortex.
- [x] Speedster сначала сбрасывает жетоны, затем даёт Long Advance. Wall Crawler применяется к Advance.
- [x] Supersonic Reflexes предлагает выбор кубиков защиты и уклонения.
- [x] Can’t Catch Me проверяет дальность после Advance, сохраняет Power одиночной отменённой атаки и учитывает остальные цели луча. Проверен KO от Kill Box до продолжения атаки.
- [x] Проверены карточка в браузере и CLI, сохранённый ростер принят движком.

[Сценарии Quicksilver](../tests/game-quicksilver.test.cjs), [разъяснения AMG по Quicksilver](https://forums.atomicmassgames.com/tags/quicksilver/).

## 3. Magneto

- [x] Reverse Polarity выбирает между перебросом и Push по дистанции. Magnetic Crush уничтожает подходящий террейн, добавляет кубики и наносит урон соседним врагам.
- [x] Fatal Attraction дорожает с каждым применением за ход. Polarity Shielding может остановить перемещение, не отменяя атаку.
- [x] Master of Magnetism размещает Size 2 Metal Construct и начисляет Power. From the Ruins предлагает получателей Power при разрушении террейна.
- [x] Flight, иммунитет к Shock и запрет пары Hulk и Magneto по Peerless.
- [x] Проверены сохранённый ростер, карточка, размещение с поля и допустимые точки через CLI.

Metal Construct использует квадратный габарит 35 мм в двумерной модели террейна Game.

[Сценарии Magneto](../tests/game-magneto.test.cjs), [разъяснение AMG по Metal Constructs](https://forums.atomicmassgames.com/topic/16416-interaction-between-magnetos-constructs-and-terrain-features/), [размеры подставок AMG](https://www.atomicmassgames.com/mcp-rules/).

## 4. Toad

- [x] Tongue Lash даёт Power и Poison на Wild. Spit Acid даёт Incinerate.
- [x] Hop, Wall Crawler и Medium Advance от Slippery после полученного урона.
- [x] Prehensile Tongue расширяет Interact до Range 2. Finders Keepers переносит Extract от союзника и соблюдает лимит жетонов.
- [x] Проверены сохранённый ростер и карточка в браузере и CLI.

## 5. Rogue

- [x] Absorbing Strike выбирает тип урона и использует Sap Power. Southern Hospitality даёт Short Throw после атаки.
- [x] Charge, Marvelous Strength и Mutant Absorption с отдельным броском пяти кубиков и уроном без начисления Power цели.
- [x] Kree-Mutant Physiology снижает входящий урон, Flight и иммунитет к Poison действуют.
- [x] Проверены сохранённый ростер и карточка в браузере и CLI.

[Сценарии Toad и Rogue](../tests/game-toad-rogue.test.cjs).

## 6. Pyro

- [x] Fire Blast и Flame Jet дают Power и Incinerate на Wild. Inferno накладывает Incinerate и наносит урон соседним врагам.
- [x] Firewall накладывает Root и Slow. Stoke the Flames усиливает броски по всем целям следующего луча.
- [x] Fire Manipulation предлагает выбрать цель для Incinerate рядом с защитником.

## 7. The Blob

- [x] Strike предлагает Push после урона по цели Size 3 или меньше. Thunderous Splash размещает Блоба перед уроном и отталкивает соседей от точки приземления.
- [x] Catch Little Man! бросает террейн. Nothing Can Move The Blob! блокирует Push и Throw от специальных правил атак.
- [x] Ha, Ha, Ha, That Tickles! снижает урон до минимума 1 и позволяет оттолкнуть атакующего, пока Блоб в сознании.

## 8. Juggernaut

- [x] Nothing Stops the Juggernaut! разрушает террейн Size 3 и меньше, снимает Stagger и даёт выбрать одну цель при одновременном контакте.
- [x] Unstoppable Momentum даёт Power после Move и усиливает следующую атаку. Rush предлагает бесплатный Push после Wild.
- [x] Nice Punch работает при атаке, Bleed и уроне в Cleanup. Helmet действует на здоровой стороне, Avatar of Cyttorak доступна на раненой. Проверен иммунитет к Stun.
- [x] Все трое проходят сбор сохранённого ростера, карточки открываются в браузере и через CLI. Предпросмотр Push Джаггернаута проверен на поле.

[Сценарии Pyro, The Blob и Juggernaut](../tests/game-brotherhood.test.cjs), [AMG о Stoke the Flames](https://forums.atomicmassgames.com/topic/8408-pyro/), [AMG о Tickles](https://forums.atomicmassgames.com/topic/7951-ha-ha-ha-that-tickles-superpower-question-on-blob/), [AMG о Push Джаггернаута](https://forums.atomicmassgames.com/topic/4218-nothing-stops-the-juggernaut-while-on-terrain/).

## 9. Avalanche

- [x] Seismokinesis даёт Power за каждую цель луча и накладывает Stun на Wild. Epicenter of Destruction накладывает Stun на каждую цель зоны.
- [x] Landslide отталкивает врага подходящего размера. Beware Falling Debris разрушает террейн и вызывает столкновение после Advance. Place и Climb проверены как отдельные типы перемещения.
- [x] Карточка и решение Beware Falling Debris проверены в браузере, результат и запись в журнале проверены через CLI.

## 10. Gambit

- [x] A Little Something Extra меняет один Hit на Wild. Wild даёт два успеха в атаке, защите и уклонении. 52 Card Pickup требует две отдельные грани Wild для Stun.
- [x] Bo Staff отталкивает до урона. Kinetic Ace наносит урон соседним врагам. Enhanced Agility предлагает Advance даже если Nice Punch отменил урон.
- [x] Карточка и сохранённый ростер проверены.

## 11. Sabretooth, Apex Predator

- [x] Claw Slash и Bloodthirsty Onslaught используют Pierce и Bleed. Bloodthirsty Onslaught размещает Саблезубого рядом с защитником.
- [x] Catch, Runt! бросает врага. Primal Pounce бросает Саблезубого без урона ему от столкновения. Stop Squealing and Die усиливает следующую подходящую атаку, Healing Factor восстанавливает 1 HP в конце активации.
- [x] Карточка и сохранённый ростер проверены. Обе версии Саблезубого доступны для ростера, в отряд входит одна версия по Alter Ego.

[Сценарии Avalanche, Gambit и Sabretooth](../tests/game-mutant-reinforcements.test.cjs), [AMG о типах перемещения](https://forums.atomicmassgames.com/topic/4232-what-is-considered-a-move-action/), [AMG об Enhanced Agility](https://forums.atomicmassgames.com/topic/17833-parting-shot-enhanced-agility-and-damage-reduction-to-0/).

## 12–16. Остальные бойцы Братства мутантов

- [x] Colossus меняет цель через Big Brother или двигается после атаки. Здоровая сторона получает защитные кубики за Power, раненая считает Blank. Organic Steel снижает урон и блокирует вражеский Push.
- [x] Emma Frost трансформируется до защиты и уклонения. Shield Mind отменяет подходящее движение союзника. Shatter предлагает обратную трансформацию после всех целей. Far From My Best Look проверена в начале и конце активации.
- [x] Lady Mastermind копирует параметры атаки и сохраняет тип шаблона. Mental Lock предлагает выбор защиты и оплату атакующему. Проверены лимит урона, Mind Over Matter и Power за Failure.
- [x] Exodus лечится через Psionic Vampirism и Healing Factor. Проверены Pull, Incinerate, Teleportation, переменная оплата террейна и Telekinetic Shield один раз за ход.
- [x] Shadow King размещает Projection, измеряет дальность от неё и снимает её при Mystic-уроне и в Cleanup. Проверены Nightmare Visions, Immortal Essence и дополнительные кубики Astral Disintegration.
- [x] Все пять карточек открываются в браузере и CLI. Проверены сохранённый ростер и размещение Projection на поле. Projection представлена круглым жетоном диаметром 1 дюйм.

[Сценарии Colossus, Emma Frost и Exodus](../tests/game-colossus-emma-exodus.test.cjs), [сценарии Lady Mastermind и Shadow King](../tests/game-astral-and-illusions.test.cjs), [AMG о Shatter](https://forums.atomicmassgames.com/topic/19662-timing-for-shatter-and-power-inhibition/), [AMG о копировании шаблонов](https://forums.atomicmassgames.com/topic/18859-lady-mastermind-your-reality-is-what-i-want-it-to-be-and-beamsareas/).

## 17–22. Uncanny X-Men

- [x] Beast платит за каждый выбранный кубик Stars and Garters и получает Power за Failure. Проверены Ambush, Float Like a . . ., Baser Instincts и Wall Crawler.
- [x] Wolverine усиливает одну атаку после Move, защищён Adamantium Skeleton, лечится на 2. На раненой стороне Wild Rage добавляет кубики и запрещает Interact.
- [x] Cyclops отталкивает и даёт дополнительную атаку через Speed of Sight. Проверены Suppression после урона, Quick Draw и получатели X-Men Blue.
- [x] Storm усиливает весь луч через Eye of the Storm. Hurricane поражает летающих врагов после всех целей. X-Men Gold даёт защитный переброс и Place один раз за раунд.
- [x] Jean Grey применяет Pierce по Failure, двигает активированные фигуры, защищает союзника через Shield Mind и получает дополнительный Power.
- [x] Nightcrawler платит 1–3 Power за BAMF!, считает Place для Brimstone Blitz, может выбрать порядок Puff of Smoke и Flurry of Blows. Проверены Stealth около террейна, защита и уклонение.
- [x] Карточки и сохранённый ростер проверены. Через браузер проверены выбор Power и Place для BAMF!, через CLI — допустимые точки и состояние после действия.

[Сценарии Beast и Wolverine](../tests/game-beast-wolverine.test.cjs), [Cyclops и Storm](../tests/game-xmen-leaders.test.cjs), [Jean Grey и Nightcrawler](../tests/game-jean-nightcrawler.test.cjs), [AMG о Nightcrawler](https://forums.atomicmassgames.com/tags/nightcrawler/).

## 23–24. Iceman и Angel

- [x] Freeze and Fade сначала разрешает атаку. Power от неё можно потратить на Ice Slide перед Move. Перемещение учитывает Size 5.
- [x] Cold Snap различает Move Action, Attack Action и отдельный Advance. Freezing Blast и Chill накладывают Slow и Stagger на Wild.
- [x] Air Lift и Hostile Takeover выбирают цели до Move и разрешаются после него. Flyby размещает Angel у последней цели луча, Avenging Angel бросает и накладывает Stun. Проверены Flight и Healing Factor.
- [x] Проверены сохранённый ростер, карточки и Air Lift на поле в браузере. CLI подтвердил допустимые точки и итоговое состояние.

[Сценарии Iceman и Angel](../tests/game-iceman-angel.test.cjs), [AMG о Freeze and Fade и Ice Slide](https://forums.atomicmassgames.com/topic/14400-freeze-and-fade-ice-slide/), [AMG о завершении Attack Action](https://forums.atomicmassgames.com/topic/14378-when-does-an-attack-action-end/).

## 25. Professor X

- [x] Psychic Dart даёт Power за урон и Root на Wild. Mental Suggestion после урона Advance защитника на его Speed. Astral Duel добавляет кубики по Mystic-защите и запрещает перебросы защиты.
- [x] Telepathic Lock работает как Mental Lock. Omega-Level Telepath защищает от Push и Advance от Mystic-атак и вражеских суперспособностей, как Helmet.
- [x] Professor's Guidance перебрасывает до трёх кубиков атакующего или защищающегося союзника в Range 4, по 1 Power за кубик, раз за Turn.
- [x] Xavier's School после траты Power на активную или реактивную суперспособность даёт 1 Power другому союзнику, раз за Turn. Траты на атаки и Leadership не считаются.
- [x] Сохранённый ростер и карточка через CLI проверены. Карточку и выбор Xavier's School в браузере ещё не смотрели.

[Сценарии Professor X](../tests/game-professor-x.test.cjs).

## 26–27. Psylocke и Shadowcat

- [x] Telekinetic Katana выбирает Energy или Mystic, снимает 1 Power за каждый Wild до урона и получает +2 кубика от Telekinetic Combat Enhancement только в следующей атаке Katana.
- [x] Psi-Bow предлагает Advance к защитнику на Hit. Psionic Assault накладывает Stun до урона. Telepathic Precognition перебрасывает свои кубики атаки или защиты за любое количество Power, раз за Turn.
- [x] Phasing Strike и Intangible Assault не учитывают защитные Critical и не добавляют за них кубики. На Wild Shadowcat делает Place в Range 1 или 2 от себя.
- [x] Phase Rush делает Place в Range 2. Can‘t Touch This добавляет 2 кубика защиты Shadowcat или союзнику в Range 2 против Physical и Energy, а также 2 кубика уклонения. После Push или Throw от атаки защищённый боец может сделать Place в Range 1.
- [x] Сохранённый ростер проверен. Браузер не проверен.

[Сценарии Psylocke и Shadowcat](../tests/game-psylocke-shadowcat.test.cjs).

## 28–30. Havok, Jubilee и Domino

- [x] Plasma Dispersion меняет по одному кубику на Hit за каждый Wild. Plasma Wave накладывает Incinerate на каждую цель и даёт Pierce на Wild. Cosmic Energy Absorption тратит действие на 2 Power, Blast Off делает Place в Range 2. Immunity к Incinerate действует.
- [x] Lumikinetic Blast накладывает Stun только при Wild и Hit. Princess of Pyrotechnics даёт бесплатную дополнительную атаку по тому же защитнику на Wild и Hit.
- [x] Fireworks перебрасывает до трёх кубиков защиты Jubilee или союзника в Range 2, раз за Turn для каждого защитника. Wolverine! переводит атаку на James Logan Howlett в Range 2. I Totally Meant to Do That! после Critical даёт 1 Power и сбрасывает жетоны, в атаке, защите и уклонении.
- [x] Probability Manipulation превращает оплаченные Failure в Critical и добавляет за них кубики, в атаке, защите и уклонении. Things Tend To Go My Way не даёт врагам дополнительных кубиков за Critical против Domino.
- [x] Сохранённый ростер проверен. Браузер не проверен.

[Сценарии Havok, Jubilee и Domino](../tests/game-havok-jubilee-domino.test.cjs).

## 31–33. Bishop, X-23 и Honey Badger

- [x] XSE Blaster накладывает Incinerate, только если защитник в Range 3. Return With Interest выбирает тип и принимает до 3 Power доплаты: каждая добавляет кубик каждой атаке. На Wild — Push от Bishop, затем Slow. В интерфейсе атаки появился выбор доплаты.
- [x] Mutant Energy Absorption работает против атаки любого типа: за каждый Wild в защите превращает Hit, Wild или Critical атакующего в Blank и даёт за это Power. Overload наносит 1 урон в Cleanup при 8 Power. Absorbed Energy Conversion бросает на Medium.
- [x] Claw Rush даёт Medium Advance после атаки. Assassin Training перебрасывает один кубик. Frenzy после Daze или KO во время активации даёт Short Advance и бесплатный Adamantium Slash, раз за Turn.
- [x] Big Sis и Lil‘ Sis после урона по сестре в Range 3 дают Medium Advance к источнику урона, раз за Turn.
- [x] Claw Slash у Honey Badger без Pierce. Hamstring при уроне накладывает Slow и Bleed, на Wild даёт Medium Advance. Too Dangerous to Ignore перехватывает атаку врага в Range 2. Anklebiter снимает кубик защиты у врага в Range 1 при атаке другого союзника, не даёт оспаривать Secure, взаимодействовать с ним и получать за него эффекты Power Phase.
- [x] Сохранённый ростер проверен, клиент пересобран. Браузер не проверен.

[Сценарии Bishop, X-23 и Honey Badger](../tests/game-bishop-x23-honey-badger.test.cjs).
