import React from "react";
import { observer } from "mobx-react-lite";
import { rosters, actions } from "./stores/index.js";
import { cardStatus } from "./stores/rosters.js";
import { GameCard } from "./cards.jsx";

export const CharacterTactics = observer(function CharacterTactics({
  character,
}) {
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
