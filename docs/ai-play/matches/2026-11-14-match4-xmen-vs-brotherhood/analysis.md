# Партия 4 · X-Men (турнир, p1) против Brotherhood (турнир, p2) · тактика 1.5

**Итог:** X-Men побеждают 19:10 в 5-м раунде. Счёт после раундов: 4:3 → 8:5 → 12:8 → 15:9 → 19:10. Партия прервалась на 5-м раунде из-за лимита API и была доиграна с того же места.
Отряды: X-Men — Cyclops, Colossus, Quicksilver, Shadowcat, Storm (тактики: First Class, Xavier's Dream, To Me My X-Men!, Patch Up, Hold Still). Brotherhood — Magneto, Colossus, Mystique, Pyro, Toad (Magnetic Refraction, Pyrotechnics, Books of Truth, Sacrifice, Patch Up).

## Новые тактические карты в игре

Сыграны без ошибок движка: First Class, Patch Up (обе стороны), Xavier's Dream (−2 урона по Storm), Sacrifice (атака Colossus перешла с Toad на Pyro), The Books of Truth (защита), Magnetic Refraction. Не сыграны: Hold Still, To Me My X-Men! как карта, Pyrotechnics (не было врагов с Incinerate).

## Почему выиграли X-Men

- **Подвижные держатели книг.** Quicksilver и Shadowcat держали Spellbook и уходили из зоны угрозы, продолжая приносить VP (TACTICS, раздел 6). У Brotherhood медленный Magneto (S) и Pyro не успевали их догнать, и держателей так и не выбили.
- **Фланговые точки.** Storm и Cyclops держали фланговые канистры весь матч.
- Toad выбит: Dazed в R2, KO в R4. Это лишило Brotherhood дешёвого держателя.

## Ошибки

**Brotherhood:**
- Атаковал Storm через Fire Blast, хотя Shadowcat (Can't Touch This) и Colossus (Big Brother) раз за разом перенаправляли урон. Это потраченные действия.
- Слишком поздно начал отбивать вторую книгу.

**Обе стороны:** по 8 активаций закрыты без действий. В основном это держатели на безопасных точках (разумно), но у X-Men так ходили и Quicksilver с Colossus, хотя они могли стрелять.

## Пробелы в гайде (исправлены)

- `displace` в режиме advance или place принимает точку из `reach`, а не угол.
- Interact у Secure-жетонов передаётся через `value` из `interacts` (например `freedom|secure:…`).
