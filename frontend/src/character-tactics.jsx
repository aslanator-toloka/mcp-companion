import React from "react";
import { observer } from "mobx-react-lite";
import { rosters, actions } from "./stores/index.js";
import { cardStatus } from "./stores/rosters.js";
import { GameCard } from "./cards.jsx";

const percent = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

export const CharacterTactics = observer(function CharacterTactics({
  character,
}) {
  const stats = rosters.insights?.statistics("tactics", {
    character: character.slug,
    record: { minWins: 3, maxLosses: 1 },
  });
  const cards = rosters.cards.tactics.filter((card) =>
    actions.relatedCard(card, character),
  );
  return (
    <section
      className="detail-section character-tactics"
      aria-label="Карты персонажа"
      data-character-tactics={character.slug}
    >
      <div className="section-title">
        <h3>
          Карты персонажа <span className="tag">{cards.length}</span>
        </h3>
      </div>
      {cards.length > 0 && stats && (
        <p className="character-tactics-coverage" data-tactics-coverage>
          Частота выбора в ростерах с {character.name} · 3+/≤1. Тактики
          распознаны в {stats.covered} из {stats.total} ростеров.
        </p>
      )}
      {rosters.cardError ? (
        <p className="notice">{rosters.cardError}</p>
      ) : cards.length ? (
        <div className="character-tactics-grid">
          {cards.map((card) => (
            <article
              key={card.slug}
              className="character-tactic-preview"
              data-card-slug={card.slug}
            >
              <button
                type="button"
                className="character-tactic-open"
                aria-label={"Открыть тактику " + card.name}
                onClick={() => actions.showGameCard("tactics", card.slug)}
              >
                <strong>{card.name}</strong>
                <span aria-hidden="true">↗</span>
              </button>
              <p
                className="character-tactic-popularity"
                data-tactic-popularity
                title="Доля ростеров с этой картой среди ростеров с персонажем: 3+ победы, не больше 1 поражения, только завершённые выступления с полностью распознанными тактиками. Варианты одного выступления учитываются с весом 1/M; разные печатные версии карты объединены."
              >
                <strong>
                  {stats?.covered
                    ? `${percent.format(stats.cards.get(card.slug)?.share ?? 0)}%`
                    : "—"}
                </strong>
                <span>
                  {stats?.covered
                    ? `ростеров · ${stats.cards.get(card.slug)?.count ?? 0} из ${stats.covered} списков`
                    : "Нет данных по ростерам 3+/≤1"}
                </span>
              </p>
              <div className="gc-surface">
                <GameCard card={card} kind="tactics" />
              </div>
              <small className="character-tactic-status">
                {cardStatus(card)}
              </small>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">Персональных карт тактики в каталоге нет.</p>
      )}
    </section>
  );
});
