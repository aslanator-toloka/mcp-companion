# Стандартные фоны карточек

Вместо плоского CSS-градиента используются оригинальные фоновые изображения из публичного Jarvis. Фон включает комиксные панели, полутоновые точки и цветовые переходы. Healthy и Injured имеют отдельные изображения; классические карточки и Grunts — свои шаблоны.

Картинки сохранены в `assets/card-backgrounds/`, загружаются с того же GitHub Pages без runtime-зависимости от Jarvis. Подбор в `card-viewer.css` по `data-card-template` и `.sc-injured`; шаблон задаётся в `frontend/src/cards.jsx` из прежнего structured card.template/isGrunt. Масштабирование 100% ширины, высота по пропорциям — как исходный `<img width="100%">` в Jarvis. Тексты правил и статистика остаются элементами HTML. Пользовательский фон из card-skins перекрывает стандартный; «Оригинал» возвращает текстуру Jarvis.

Источники проверены по сохранённым HTML карточек в `assets/stat-cards/*.json` и публичному JavaScript Jarvis. [Страница примера Jarvis](https://www.jarvis-protocol.com/characters/spider-man-noir).

- `healthy-2023.png`: https://www.jarvis-protocol.com/assets/images/0cdbd9b73d17916741ae.png
- `injured-2023.png`: https://www.jarvis-protocol.com/assets/images/60dc2469004ddaa4fa2b.png
- `healthy-classic.png`: https://www.jarvis-protocol.com/assets/images/7dbd2f69c6c3da48c981.png
- `injured-classic.png`: https://www.jarvis-protocol.com/assets/images/a4c313f0ff4f66f7ec80.png
- `grunt.png`: https://www.jarvis-protocol.com/assets/images/726ec56586d879a897f4.png
