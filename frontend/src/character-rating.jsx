import React, { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { tournaments as t } from "./stores/index.js";

export const ratingNumber = (value) =>
  value == null
    ? "—"
    : (value > 0.05 ? "+" : "") +
      (Math.abs(value) < 0.05 ? 0 : value).toLocaleString("ru-RU", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });

export function RatingValue({ rating, compact = false }) {
  const title = !rating?.appearances
    ? "Нет подходящих выступлений для нового рейтинга"
    : `Экспериментальный рейтинг: ${ratingNumber(rating.value)} п.п. · ${rating.players} игроков, ${rating.switchers} меняли включение персонажа`;
  return (
    <span
      className={
        "at-adjusted-value" + (rating?.value < 0 ? " at-negative" : "")
      }
      title={title}
    >
      {compact ? "R " : ""}
      {ratingNumber(rating?.value)}
      {!compact && " п.п."}
    </span>
  );
}

export const CharacterRatingPanel = observer(function CharacterRatingPanel() {
  const key = t.ratingKey,
    data = t.data;
  useEffect(() => {
    t.loadRating();
  }, [key, data]);
  const model = t.activeRating,
    rating = model?.ratings[t.selected];
  const failed = t.ratingForKey === key && t.ratingStatus === "error";
  return (
    <section
      className="at-adjusted-rating"
      aria-label="Рейтинг с поправкой на игрока"
      aria-busy={!model && !failed}
    >
      <div className="at-adjusted-heading">
        <strong>Рейтинг с поправкой на игрока</strong>
        <span>Эксперимент</span>
      </div>
      <p className="at-rating-status" role="status">
        {failed
          ? t.ratingError
          : !model
            ? "Считаем в фоне…"
            : `${model.diagnostics.performances} выступлений · ${model.diagnostics.players} игроков · ${model.diagnostics.events} событий в расчёте`}
        {failed && (
          <>
            {" "}
            <button type="button" onClick={() => t.loadRating()}>
              Повторить
            </button>
          </>
        )}
      </p>
      {model && !t.collectionMode && !t.playerMode && (
        <div
          className="at-adjusted-character"
          data-character-rating={t.selected}
        >
          <strong
            className="at-adjusted-character-name"
            title={t.index.characters.get(t.selected)?.name}
          >
            {t.index.characters.get(t.selected)?.name}
          </strong>
          <RatingValue rating={rating} />
          <span>
            {rating?.appearances ? (
              <>
                {rating.players} игроков · {rating.switchers} с персонажем и без
                него
                {rating.switchers < 10 && <em>Мало игроков со сравнением</em>}
              </>
            ) : (
              "Нет подходящих выступлений"
            )}
          </span>
        </div>
      )}
      <p className="at-rating-scope">
        В выбранных странах и аффилиациях, по всем игрокам.
        {t.selectedPlayer &&
          " Выбор игрока сужает ростеры и старые баллы; рейтинг остаётся сравнением всех игроков."}
      </p>
      <details data-ui-disclosure>
        <summary>Как читать новый рейтинг</summary>
        <p>
          0 — нейтральная оценка включения в ростер; плюс и минус —
          относительный вклад в долю побед в процентных пунктах. Это оценка
          модели, а не измеренная прибавка к шансу победить.
        </p>
        <p>
          Сравнения одного игрока с персонажем и без него имеют вес 1. Различия
          между игроками — 0,15: постоянный выбор получает небольшой бонус или
          штраф. Сила игрока, контекст события и все 10 персонажей оцениваются
          совместно; вклад одного игрока ограничен, редкие персонажи сильнее
          тянутся к нулю. Вес 0,15 относится к данным, а не к доле итогового
          рейтинга.
        </p>
        <p>
          Учитываем завершённые индивидуальные результаты, полные ростеры из 10
          моделей и однозначный список на событие. Ничьи, варианты списков,
          парные результаты и неполные ростеры не входят в расчёт. Старые баллы
          и бонус побед +5% здесь не используются.
        </p>
        <p>
          Состав ростера не говорит, кого выставляли на стол. Неразделимые
          связки, выбор сильных игроков и сила соперников могут искажать оценку.
          Число игроков, менявших включение персонажа, показывает объём
          сравнений, а не доверительный интервал.
        </p>
      </details>
    </section>
  );
});
