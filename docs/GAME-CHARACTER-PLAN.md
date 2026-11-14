# Добавление персонажей в Game

Добавляем по одному персонажу. Статус «Готово» означает, что бойца можно взять в сохранённый ростер Game, а его атаки, способности и обязательные решения проверены через команды партии. Для каждого нового эффекта нужен сценарий с проверкой результата, включая отказ при недопустимом действии там, где это важно.

Перед добавлением способности сверяем эффект и момент срабатывания с уже существующими. Если у одноимённой атаки разных персонажей разный текст, правило задаём в `characterProfiles` по ключу `slug:имя`. Урон снимаем через `combat.heal`, чтобы его мог остановить Anti-Healing Factor Corrosive. Power на активные и реактивные суперспособности списываем через `combat.spend`, чтобы на трату могли реагировать Leadership вроде Xavier's School. Charge, Hit and Run и Freeze and Fade используют общую последовательность Move и Attack. Ice Slide и Air Lift используют одну механику выбора союзника до Move и размещения после него.

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
| 34 | Magik | Готово | Проверены Darkchylde с Failure в обоих бросках, Hex на Critical и Wild, Limbo Step и Scrying Mirrors только против Mystic. |
| 35 | Cable | Готово | Проверены перебросы Plasma Rifle в Range 3, лечение Askani‘Son, Omega Level Threat, Wetworks и отряд X-Force. |
| 36 | Logan the Wolverine | Готово | Проверены X-Slash с Place, Tornado Claw, What I Do Isn‘t Very Nice, On the Hunt и Get Out of my Head!. |
| 37 | Archangel | Готово | Проверены Razor Wing Strike, Overwing, Avatar of Death, Wing Shield и Chosen of Apocalypse. |
| 38 | Mirage | Готово | Проверены Neural Connection, Figment of Fantasy, Telepathic Emotion Manifestation, Psionic Salvo и Coming of Age. |
| 39 | Sunspot | Готово | Проверены жетоны Flare, Thermokinesis, Dark Solar Blast, Sunburn и взрыв Flare State. |
| 40 | Deadpool | Готово | Проверены Stab, Stab и Bang, Bang, Duodenum Poke, Maximum Effort!, Merc with a Mouth, перебросы и защита от Mystic Advance. |
| 41 | Warlock | Готово | Проверены T-O Talons, Self Must Protect Selffriend, Techno-Organic Absorption, Transmode Virus Infection и Unstable Outline. |
| 42 | Maverick | Готово | Проверены Rapid Fire, Agent Zero, Anti-Healing Factor Corrosive и Kinetic Energy Absorption. |
| 43 | Weapon X | Готово | Проверены Berserker Rage по повторной цели, Rampage и Wild Abandon, Savagery Protocols и Aimless Aggression. |
| 44 | Omega Red | Готово | Проверены Carbonadium Coils и Armor, Absorb Essence, Ensnare, Death Factor и Death Spores. |
| 45 | Cassandra Nova | Готово | Проверены Telepathic Cloak, Psionic Bolt без Pierce, Mind Possession, Flesh Manipulation, Biokinesis, Psychic Distraction и Telekinetic Deflection. |
| 46 | Multiple Man | Готово | Проверены Kinetic Duplication, Shared Experiences, Dogpile и Monkey Pile рядом с дубликатами, Duplicate Reabsorption, Follow the Leads и правила Interact для Duplicates. |
| 47 | Phoenix | Готово, кроме All Are Beneath Me | Проверены атаки и способности обеих сторон, жетоны Phoenix, переход в Phoenix Unleashed и взрыв Untamed Cosmic Entity. Атака от Flame Pillar не сделана. |
| 48 | Red Guardian | Готово | Проверены Strike с Push, Ricochet у Shield Throw, Focused Repulsion Field и Red Guardian‘s Suit. |
| 49 | Ursa Major | Готово | Проверены Bear-Handed Slap, Bear-Armed Brawler и Ursine Temper. |
| 50 | Darkstar | Готово | Проверены переброс всех кубиков Darkforce Strike, Darkforce Barrier и Dimensional Portal. |
| 51 | Black Widow | Готово | Проверены свои версии Strike и Pistol, Mixed Technique и Counter-Strike. |
| 52 | Crimson Dynamo | Готово | Проверены Electric Blast, Homing Rockets, Disruption Field, Overcharge Capacitors, броня и Unbreakable Red Line. |
| 53 | Black Panther | Готово | Проверены Strike с Push, Kinetic Burst с доплатой, Mantle, Pounce, обе версии Vibranium Armor и King of Wakanda. |
| 54 | Okoye | Готово | Проверены Bodyguard, General of the Dora Milaje и Strike после Vibranium Spear Thrust. |
| 55 | Shuri | Готово | Проверены Panther Gauntlets с лимитом урона, Sonic Crush, Super Genius, Upgrades и Head of Wakanda R&D. |
| 56 | M'Baku | Готово | Проверены два эффекта Knobkerrie до урона, Avalanche, Chieftain of the Jabari, Solid Frame и Blessed by Ghekre. |
| 57 | Killmonger | Готово | Проверены Black Ops Strike, Focused on the Kill, Special Forces и Kill Count. |
| 58 | King T'Challa | Готово | Проверены Vibranium Spear вблизи и издали, Bound, Royal Rebuke, Defender of Wakanda и Strength of the Ancestors. |
| 59 | Black Panther, Chosen of Bast | Готово, кроме Insight of the Ancients | Проверены Finisher с перебросами и Superior Agility. |
| 60 | Killmonger, Usurper | Готово | Проверены атаки с запретом модификаций защиты, K‘Liluna‘s Fury и жетоны Herb. |
| 61 | Corvus Glaive | Готово, кроме Gem Bearer | Проверены Glaive‘s Edge, Death Blow, Atom Splitter и Husband of Proxima Midnight. Infinity Gems в Game нет. |
| 62 | Proxima Midnight | Готово | Проверены Spear Throw, Quantum Starburst, Martial Prowess и Wife of Corvus Glaive. |
| 63 | Black Dwarf | Готово | Проверены Enforced Oblivion, Black Fury, Intimidating Presence и Invulnerable Skin. |
| 64 | Ebony Maw | Готово, кроме Gem Bearer | Проверены Black Tongue, Herald of Doom, Mind Over Matter и Incredible Psychic Potential. |
| 65 | Supergiant | Готово, кроме Gem Bearer | Проверены Devastate Intellect с Devour Mind, Ethereal, Omnipathy, Supreme Control и Submit! для жетона Senator. |
| 66 | Black Swan | Готово, кроме Gem Bearer | Проверены Midnight Field, Telepathic Suggestion и Follow-Up Eye Beam вне дальности. |
| 67 | Nebula | Готово | Проверены Assassin, Cybernetic Enhancements и Shock Sword Assault. |
| 68 | Cosmic Ghost Rider | Готово | Проверены Psychosis, Spirit of Vengeance в Cleanup, Penance Stare, Hellcycle, Chains of Cyttorak и Cosmic Justice on Wheels. |
| 69 | Thanos, the Mad Titan | Готово, кроме Infinity Gems | Проверены Death‘s Decree, Death‘s Agenda (VP за KO), Cosmic Blast, Cosmic Portal и Being of Immeasurable Power. |
| 70 | Wong | Готово | Проверены Faithful Assistant, Meditate, The Vishanti‘s Blessing и Servant to the Sorcerer Supreme. |
| 71 | Clea | Готово | Проверены Icy Tendrils, Descendant of the Faltine, Vapors of Dormammu и Talons of Farallah. |
| 72 | Doctor Strange | Готово, кроме Gem Bearer | Проверены Bolts of Bedevilment, Crimson Bands, Eye of Agamotto, Shield of the Seraphim, Hoggoth‘s Hoary Wisdom, Oshtur‘s Refuge и Judgment of the Vishanti. |

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

## 34–36. Magik, Cable и Logan the Wolverine

- [x] Darkchylde засчитывает Failure из бросков атаки и защиты как успехи атакующего и накладывает Bleed и Incinerate. Bolts of Oshtur накладывает Hex на Critical и Wild. Limbo Step делает Place на дальность, равную оплаченному Power. Scrying Mirrors of Limbo работает как Mutant Energy Absorption, но только против Mystic.
- [x] Plasma Rifle перебрасывает до двух кубиков, если цель в Range 3. Askani‘Son лечит Cable на 1 за каждую цель, получившую урон. Omega Level Threat стоит не меньше размера террейна. Techno-Organic Virus Suppression и Psionic Nexus дают +1 Power в Power Phase.
- [x] Wetworks позволяет каждому союзнику раз за Turn перебросить один кубик атаки, включая Failure. После такого переброса цель в Range 3 не получает Cover. Отряд X-Force из добавленных бойцов собирается, и ему предлагается Wetworks.
- [x] X-Slash ставит Logan в Range 1 от защитника. Tornado Claw ставит его у последней цели луча. What I Do Isn‘t Very Nice тратит действие на X-Slash и затем предлагает Short Throw цели Size 3 и меньше. On the Hunt даёт два переброса, если рядом нет союзников. Get Out of my Head! наносит 1 урон союзникам в Range 3 и даёт им Power.
- [x] Сохранённый ростер проверен. Браузер не проверен.

[Сценарии Magik, Cable и Logan](../tests/game-magik-cable-logan.test.cjs).

## 37–39. Archangel, Mirage и Sunspot

- [x] Razor Wing Strike даёт выбор Bleed или Poison за каждый Wild, на Critical ставит Archangel в Range 1 от цели. Avatar of Death на Wild накладывает Stagger, а цели с Bleed и Poison вместо этого даёт Activated. Wing Shield добавляет 2 кубика защиты или уклонения только самому Archangel. Chosen of Apocalypse работает как Plasma Dispersion.
- [x] Neurokinetic Arrows на Wild переносит единственный жетон Neural Connection на защитника. Figment of Fantasy и Telepathic Emotion Manifestation достают врага в Range 1 или в Range 5 с жетоном и снимают его. Psionic Salvo на Critical и Wild даёт бесплатную атаку по другой цели.
- [x] Coming of Age: при переходе союзника на раненую сторону он получает 3 Power и жетон Self-Discovery (+3 кубика защиты и уклонения до конца его активации). Лидерство New Mutants.
- [x] Sunspot получает Flare после любого перемещения, максимум 3. UV Strike добавляет Flare на Wild и Hit. Thermokinesis тратит Flare на кубики до броска и накладывает Incinerate. Выбор Flare есть в интерфейсе атаки. Dark Solar Blast наносит 1 урон всем рядом с защитником без начисления Power. Sunburn даёт Advance на Speed или Long с Flight при 3 Flare, затем атаку. Перед Daze или KO Sunspot тратит все Flare и наносит 1 урон врагам в Range, равном их числу. High Energy Conversion ограничивает размер цели числом Flare.
- [x] Отряд X-Force с новыми бойцами собирается. Браузер не проверен. Flare, Neural Connection и Self-Discovery показаны в строке бойца.

[Сценарии Archangel, Mirage и Sunspot](../tests/game-archangel-mirage-sunspot.test.cjs).

## 40–41. Deadpool и Warlock

- [x] Stab даёт повторную атаку на двух Wild, Bang на Wild и Hit. Duodenum Poke при уроне накладывает Bleed и Slow. Maximum Effort! на раненой стороне после Short Advance наносит 1 урон всем в Range 2 и даёт Deadpool Power за каждый урон.
- [x] Merc with a Mouth снимает 2 Power с врага в Range 3, раз за раунд на каждого врага. Leg Day делает Place в Range 2. I Know Karate и All Right, Now it‘s Serious... перебрасывают один кубик. Раненый Deadpool оспаривает задания как здоровый. Unicorns... защищает от Push и Advance от Mystic и вражеских способностей.
- [x] T-O Talons накладывает Bleed и Poison на Wild, Buster Cannon — Shock. Self Must Protect Selffriend перед броском предлагает уничтожить террейн Size 3 и меньше в Range 3: можно перебросить столько кубиков, каков его размер. На Wild — Short Throw от Warlock.
- [x] Techno-Organic Absorption уничтожает террейн и лечит на его размер. Transmode Virus Infection наносит 2 урона Warlock и врагам с Poison в Range 2. Unstable Outline добавляет кубик защиты против Physical и Energy, если атакующий дальше Range 3.
- [x] Отряд X-Force собирается. Браузер не проверен.

[Сценарии Deadpool и Warlock](../tests/game-deadpool-warlock.test.cjs).

## 42–44. Maverick, Weapon X и Omega Red

- [x] Лечение идёт через `combat.heal`. Anti-Healing Factor Corrosive предлагает Maverick за 2 Power отменить лечение врага в Range 3. Kinetic Energy Absorption после физического урона даёт 1 Power и Short Advance по желанию. Plasma Blasters даёт Rapid Fire на Hit, Agent Zero — Throw на Wild.
- [x] Berserker Rage на здоровой стороне получает +1 кубик против цели, которую Weapon X уже атаковал в этот Turn. Uncontrollable Weapon: Rampage на Wild и Hit бьёт всех в Range 2, на двух Wild — бесплатный повтор. Savagery Protocols у Secure даёт +2 кубика атаки и −1 кубик защиты, не даёт держать Extract. Aimless Aggression при KO бросает 5 кубиков и бьёт всех рядом. Healing Factor [3] учтён.
- [x] Carbonadium Coils лечит Omega Red при уроне. Carbonadium Armor снижает урон от врагов на 1. Absorb Essence на Wild превращает защитный успех в Failure и даёт Power. Ensnare притягивает видимого врага в Range 4, по одному разу на цель за Turn. Death Factor наносит 2 урона себе и врагам с Poison. Death Spores отравляет врагов, закончивших активацию рядом, и врагов рядом в конце своей активации.
- [x] Отряды Weapon X и Hellfire Club собираются. Браузер не проверен.

[Сценарии Maverick, Weapon X и Omega Red](../tests/game-weapon-x-omega-red.test.cjs).

## 45. Cassandra Nova

- [x] Telepathic Cloak: Cassandra можно атаковать только из Range 3. Даёт +1 Power в Power Phase. Её Psionic Bolt вытягивает Power на Wild, без Pierce другой версии. Mind Possession предлагает Short Advance защитника даже без урона.
- [x] Flesh Manipulation на Wild отталкивает всех остальных в Range 2 и наносит им 1 урон. Biokinesis накладывает Root и Slow.
- [x] Psychic Distraction: когда враг заканчивает перемещение в Range 3, Cassandra может бросить 4 кубика, нанести урон за Critical и Wild и затем сделать Short Advance. Telekinetic Deflection за 2 Power отменяет урон от столкновения.
- [x] Отряды Hellfire Club и Servants of the Apocalypse собираются. Apocalypse пока не добавлен: его Leadership раздаёт карты Всадников, которых нет в данных.

[Сценарии Cassandra Nova](../tests/game-cassandra-nova.test.cjs).

## 46. Multiple Man и Duplicates

- [x] Kinetic Duplication: после урона, если Multiple Man не Dazed и дубликатов нет в игре, он ставит Multiple Man Duplicates в Range 2. Duplicates активируются вместе с ним, как Ultron Drones. Взрыв при KO остался только у Ultron Drones.
- [x] Shared Experiences даёт 1 Power, когда дубликаты в Range 3 наносят урон врагу или получают его. Strike Multiple Man и Dogpile дубликатов перебрасывают до двух кубиков, если другой рядом с защитником. Madrox Monkey Pile! получает +2 кубика рядом с дубликатами и накладывает Stagger на Wild и Hit.
- [x] Duplicate Reabsorption убирает дубликатов, забирает их жетон Extract и лечит Multiple Man на 3. Follow the Leads — Short Throw самого себя.
- [x] Duplicates взаимодействуют с жетонами бесплатно и только если жетон оспаривает другой союзник. В конце активации вне Range 3 от Multiple Man сбрасывают жетоны. X-Factor Investigations даёт +1 Power союзникам у Secure в Power Phase. Переброс кубиков при Interact не сделан: в Game таких бросков почти нет.
- [x] Отряды X-Factor и Uncanny X-Men собираются. Браузер не проверен.

[Сценарии Multiple Man](../tests/game-multiple-man.test.cjs).

## 47. Phoenix

- [x] Bolts of Flame даёт Power и Incinerate на Wild. Firestorm снимает 1 урон союзникам в Range 3. Cosmically Empowered Telekinesis — Medium Throw. Rejuvenating Flames лечит 2 и снимает одно состояние, по разу на цель за Turn. Psionic Nexus даёт +1 Power. Burning Resolve за 3 Power отменяет вражеские Advance, Place или Push союзника в Range 3. Immune [..] теперь читается как Immunity.
- [x] Жетоны Phoenix: +1 за Daze или KO союзника (не грунта), +3 при собственном Daze. В начале хода своей стороны с 3 жетонами, а также при переходе на раненую сторону Phoenix становится Phoenix Unleashed: обратная сторона карты, Size 4, урон и состояния сброшены, Power и жетоны сохраняются.
- [x] Phoenix Unleashed получает +1 Power за каждый жетон в Power Phase и теряет жетон, когда вырубает врага. Phoenix Blast может уничтожить террейн Size 2–4 ради кубиков, на его месте встаёт Flame Pillar (не больше двух); после атаки +1 жетон. Molecular Disintegration снимает жетон, если цель устояла. Temporal Domination перебрасывает до трёх кубиков за жетон, раз за Turn.
- [x] При KO или с 5+ жетонами в конце активации — взрыв: бросок кубиков по числу жетонов, урон всем в Range 5 за каждый Critical, Wild и Hit, уничтожение террейна до этого размера, затем KO.
- [ ] All Are Beneath Me: измерение Range и LOS от Flame Pillar и Incinerate целям не сделаны. Место для Flame Pillar берётся там, где стоял уничтоженный террейн, без отдельного выбора.
- [x] Отряд Uncanny X-Men собирается, жетоны видны в строке бойца. Браузер не проверен.

[Сценарии Phoenix](../tests/game-phoenix.test.cjs).

## 48–50. Red Guardian, Ursa Major и Darkstar

- [x] Strike Red Guardian всегда делает Push цели Size 3 и меньше. Shield Throw игнорирует LOS и на Wild даёт Ricochet по цели в Range 3 от первой. Siberian Shield Slam может бросить цель до урона. Focused Repulsion Field засчитывает Blank в защите. Red Guardian‘s Suit даёт 1 Power за любой урон, если он не Dazed.
- [x] Bear-Handed Slap накладывает Bleed на Wild. Bear-Armed Brawler может бросить цель Size 4 до урона и всегда накладывает Stagger. Ursine Temper бросает террейн на Medium.
- [x] Darkforce Strike разрешает перебросить только все кубики атаки сразу. Rending Force выбирает Physical или Energy. Dimensional Portal делает Place Darkstar или союзника в Range 3, по разу на цель за Turn. Darkforce Barrier добавляет 2 кубика защиты и запрещает этой атаке двигать защитника.
- [x] Отряд Winter Guard с Omega Red собирается. Браузер не проверен.

[Сценарии Winter Guard](../tests/game-winter-guard.test.cjs).

## 51–52. Black Widow и Crimson Dynamo

- [x] Strike Black Widow — Energy, на Wild снимает 1 Power с цели и не отталкивает. Её Pistol без Rapid Fire. Mixed Technique при уроне накладывает Stagger, на Wild даёт Short Advance. Counter-Strike после атаки по ней бросает 4 кубика против атакующего в Range 3.
- [x] Electric Blast накладывает Shock на Wild. Homing Rockets игнорирует LOS и на Wild бьёт врагов рядом с целью. Disruption Field перебрасывает до двух кубиков врага, атакующего Dynamo или союзника из Range 3. Overcharge Capacitors тратит действие на 2 Power, Propulsion Thrusters делает Place в Range 2. Carborundum Matrix Alloy снижает урон от врагов на 1.
- [x] Unbreakable Red Line в начале активации союзника предлагает снять одно состояние. Союзник у Secure перед вражеским Push бросает кубик и на Critical, Wild или Block остаётся на месте.
- [x] Winter Guard собран полностью. Браузер не проверен.

[Сценарии Black Widow и Crimson Dynamo](../tests/game-widow-dynamo.test.cjs).

## 53–55. Black Panther, Okoye и Shuri

- [x] Strike Black Panther всегда отталкивает цель Size 3 и меньше до урона. Kinetic Burst принимает до 3 Power доплаты и на Wild отталкивает и ранит всех в Range 2. Mantle of the Black Panther до конца хода разрешает перебрасывать любые кубики атаки. Pounce — Short Throw себя без урона от столкновения. Vibranium Armor на здоровой стороне засчитывает Blank против Physical и Energy, на раненой — реакция +2 кубика.
- [x] King of Wakanda: союзник может заплатить 1 Power за переброс одного кубика атаки или защиты. Переброс при уклонении не сделан.
- [x] Strike Okoye только даёт Power. Vibranium Spear Thrust с Pierce даёт Strike на Wild. Bodyguard перехватывает атаку на союзника в Range 2. General of the Dora Milaje перебрасывает кубик защиты.
- [x] Panther Gauntlets наносит не больше 1 урона и отталкивает. Sonic Crush накладывает Stun, на Wild — Stagger. Super Genius автоматически считает Block вместо Hit, если Block больше. Upgrades работает как Professor's Guidance, но без ограничения за Turn. Head of Wakanda R&D даёт 1 Power за бросок с Failure.
- [x] Отряд Wakanda собирается. Браузер не проверен.

[Сценарии Wakanda](../tests/game-wakanda.test.cjs).

## 56–58. M'Baku, Killmonger и King T'Challa

- [x] `beforeMove` и `afterMove` в профилях атак теперь могут быть списком. Knobkerrie: Pursuit на Wild, затем Push на Critical, оба до урона. Wrath of the Jabari: Throw до урона, на Wild и Hit — Short Advance и Knobkerrie по другому врагу. Chieftain of the Jabari: Physical и Energy атаки персонажей Size 3 и меньше не могут сдвинуть M'Baku. Solid Frame отменяет урон от столкновений с персонажами.
- [x] Blessed by Ghekre раз за Turn меняет кубик на Hit при Wild. Союзник у жетона раз за Turn бросает кубик перед вражеским Push или Place.
- [x] Black Ops Strike ставит Killmonger у цели после урона. Focused on the Kill даёт +2 кубика по повторной цели. Special Forces, как и Super Genius, считает Block вместо Hit. Kill Count копит жетоны за Daze и KO врагов и даёт по перебросу за жетон.
- [x] Vibranium Spear перебрасывает 2 кубика по цели в Range 2, а дальнюю маленькую цель притягивает. Bound даёт Place и перебросы для следующего Vibranium Spear. Royal Rebuke работает как Counter-Strike. Defender of Wakanda раз за Turn даёт Power, когда союзник получает урон. Strength of the Ancestors раз за Turn наносит 1 урон врагу, вытолкнутому в террейн.
- [x] Отряд Wakanda собирается. Браузер не проверен.

[Сценарии M'Baku, Killmonger и King T'Challa](../tests/game-wakanda-rivals.test.cjs).

## 59–60. Black Panther, Chosen of Bast и Killmonger, Usurper

- [x] Spirit Predator на Wild и Hit даёт Panther Strike со свободными перебросами. Попутно исправлено: бесплатные перебросы бонусных атак раньше терялись (у Claw Slash Sabretooth тоже). Superior Agility не даёт врагам менять кубики атаки по нему. Pounce, Stealth и Wallcrawler уже работали.
- [ ] Insight of the Ancients не сделан: при Interact в Game нет бросков кубиков.
- [x] Covert Armament и K‘Liluna‘s Fury запрещают защитнику менять кубики, Fury добавляет кубик за каждый урон Killmonger. Strength of the New Generation в Power Phase раздаёт до трёх жетонов Herb. Жетон автоматически тратится на +1 кубик при следующей атаке, а оставшийся в Cleanup наносит 1 урон и даёт 1 Power. Жетоны Herb и Kill Count видны в строке бойца.
- [x] Wakanda собрана полностью. Браузер не проверен.

[Сценарии Chosen of Bast и Usurper](../tests/game-wakanda-heirs.test.cjs).

## 61–63. Corvus Glaive, Proxima Midnight и Black Dwarf

- [x] Strike Corvus и Proxima — с Pierce на Wild. Glaive‘s Edge тратит действие: Place в Range 1, затем бесплатный Strike или Death Blow, где Blank засчитываются как успехи. Death Blow даёт Medium Advance, на Wild и Block — Strike. Atom Splitter на Hit даёт Advance к цели.
- [x] Husband и Wife в конце активации за 1 Power позволяют партнёру в Range 3 сразу активироваться в тот же ход. Glaive of Immortality, Invulnerability и Invulnerable Skin снижают урон от врагов на 1.
- [x] Spear Throw ставит Proxima у цели, на Wild — Poison. Quantum Starburst при уроне накладывает Bleed, Poison и Stun. Martial Prowess против атаки из Range 2: пять кубиков защиты, а без урона атакующий получает 2 урона.
- [x] Enforced Oblivion: действие на Move и +2 кубика к следующей атаке. Black Fury бросает врага или террейн до Size 4 на Medium. Intimidating Presence перехватывает атаку врага в Range 2.
- [ ] Gem Bearer и Infinity Gems в Game не реализованы.
- [x] Отряд Black Order собирается. Браузер не проверен.

[Сценарии Black Order](../tests/game-black-order.test.cjs).

## 64–66. Ebony Maw, Supergiant и Black Swan

- [x] Black Tongue на Wild даёт Short Advance цели. Herald of Doom не даёт цели Power и на Wild может бросить цель Size 2. Telekinetic Powerhouse бросает террейн на Long. Mind Over Matter у Ebony Maw работает как Mental Lock. Incredible Psychic Potential даёт +2 Power.
- [x] Mental Vampire лечит 1 при уроне. Devastate Intellect вместо урона снимает Power, накладывает Stun и Stagger, а Devour Mind по точному набору граней вырубает цель. Ethereal снижает урон от физических атак и столкновений до 1 и сбрасывает жетоны. Omnipathy даёт Power за Critical врагов в Range 3. Supreme Control отменяет вражеский Push союзника в Range 4. Submit! за 1–5 Power берёт Senator в Range, равном оплате, без платы за Interact.
- [x] Strike Black Swan на Wild отталкивает цель до Size 4. Eye Beam всегда накладывает Incinerate и даёт Pierce на Wild. Everything Dies на Wild бросает цель, а на Hit даёт бесплатный Eye Beam по той же цели без учёта дальности и LOS. Midnight Field за Power превращает Wild атакующего в Blank. Telepathic Suggestion за 1 Power перебрасывает кубик защиты.
- [x] Отряд Black Order собирается. Браузер не проверен.

[Сценарии Ebony Maw, Supergiant и Black Swan](../tests/game-black-order-psychics.test.cjs).

## 67–69. Nebula, Cosmic Ghost Rider и Thanos

- [x] Assassin не держит, не оспаривает и не берёт жетоны, но перебрасывает любые кубики атаки против того, кто держит или оспаривает жетон. Cybernetic Enhancements перебрасывает кубик защиты и лечит 1 в начале активации. Shock Sword Assault ставит Nebula у цели, на Wild — Stun.
- [x] Psychosis появляется в первой Power Phase и при Daze: Failure засчитываются как успехи в атаке, защите и уклонении, а жетоны недоступны. В Cleanup Ghost Rider снимает Psychosis, бросает 5 кубиков за Power и при 5+ Power снова получает Psychosis и сбрасывает жетоны.
- [x] Penance Stare не даёт Power цели, а по своему набору граней превращает все Block защиты в Failure. Interstellar Hellcycle делает Place на 1–5. Chains of Cyttorak притягивает и поджигает. Cosmic Justice on Wheels за 3 Power стреляет Hellfire Blasters в того, кто вырубил союзника.
- [x] Death‘s Decree за 2 Power добавляет союзнику в Range 4 +2 кубика, раненому +4, раз за Turn. В окне атаки появился переключатель. Death‘s Agenda даёт 1 VP за KO не-грунта врага. Being of Immeasurable Power снижает урон от врагов на 1, вплоть до 0.
- [ ] Infinity Gems: Gem Bearer и бесплатные способности камней у Thanos не реализованы.
- [x] Peerless не пускает Thanos и Cosmic Ghost Rider в один отряд. Black Order собран полностью, кроме камней. Браузер не проверен.

[Сценарии Nebula, Cosmic Ghost Rider и Thanos](../tests/game-black-order-titans.test.cjs).

## 70–72. Wong, Clea и Doctor Strange

- [x] Faithful Assistant даёт союзнику 1 Power раз за раунд. Meditate — действие за 1 Power. The Vishanti‘s Blessing тратит действие и лечит 2 или снимает одно состояние, раз за раунд на цель. Servant to the Sorcerer Supreme добавляет Wong кубик защиты рядом со Stephen Strange.
- [x] Demon Claws накладывает Bleed на Wild. Icy Tendrils накладывает Slow, Stun и Stagger по своим наборам граней. Descendant of the Faltine даёт 3 Power и 2 урона, если в броске 5 кубиков есть Failure. Oshtur‘s Mighty Hand бросает цель до Size 2. Vapors of Dormammu делает Place в Range 2. Talons of Farallah, через тот же переключатель, что Death‘s Decree, добавляет 2 кубика и даёт Judgment цели с угрозой 5+ после урона.
- [x] Bolts of Bedevilment даёт Pierce на Block и Push после урона. Crimson Bands накладывает Stagger, а по своему набору граней даёт цели Activated. Eye of Agamotto разрешает перебросить сразу все кубики. Shield of the Seraphim даёт Power за Block в броске. Hoggoth‘s Hoary Wisdom: +2 кубика защиты или уклонения себе или союзнику в Range 3 против любой атаки. Oshtur‘s Refuge лечит 3. Judgment of the Vishanti (Defenders) раз за Turn накладывает Hex.
- [ ] Eye of Agamotto: модификация Failure не сделана, только переброс всех кубиков.
- [x] Отряд Convocation собирается. Браузер не проверен.

[Сценарии Wong, Clea и Doctor Strange](../tests/game-convocation.test.cjs).
