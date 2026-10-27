import { CharacterTactics } from "./character-tactics.jsx";
import { observer } from "mobx-react-lite";
import { catalog, library, actions } from "./stores/index.js";
import React, { memo } from "react";
import { Avatar, OwnedCheckbox } from "./common.jsx";
import { CharacterBoxes } from "./purchases.jsx";
import { RoleIcons } from "./character-roles.jsx";
import { ModelProgress } from "./model-progress.jsx";
const CharacterRow = observer(function CharacterRow({
  character: c,
  owned,
  boxOwned,
}) {
  owned = library.owned.has(c.slug);
  boxOwned = library.boxOwned.has(c.slug);
  return (
    <div className="character-row">
      <div className="character-row-main">
        <button
          className="row-open"
          data-action="character"
          onClick={(event) => {
            event.stopPropagation();
            actions.openCharacter(c.slug);
          }}
          data-slug={c.slug}
          aria-label={`Открыть карточку ${c.name}, ${c.alterEgo}`}
        >
          <Avatar character={c} />
          <span className="row-copy">
            <strong>{c.name}</strong>
            <span className="alter-ego">
              {c.alterEgo || "Без alter ego"}
              {c.isGrunt ? " · Grunt" : ""}
            </span>
            <span className="affiliations">
              {c.affiliations.length ? (
                c.affiliations.map((a) => (
                  <span key={a.slug || a.name} className="affiliation">
                    {a.name}
                    {a.isLeader && (
                      <span className="leader-mark"> · лидер</span>
                    )}
                  </span>
                ))
              ) : (
                <span>Без аффилиации</span>
              )}
            </span>
          </span>
        </button>
        <RoleIcons slug={c.slug} compact />
        <span className="row-threat">
          <b>{c.threatLevel ?? "—"}</b>
          <small>THREAT</small>
        </span>
      </div>
      <div className={"owned-control" + (owned ? " owned" : "")}>
        <OwnedCheckbox character={c} owned={owned} boxOwned={boxOwned} />
      </div>
    </div>
  );
});
export const CatalogList = observer(function CatalogList() {
  const items = catalog.filtered.map((character) => ({ character })),
    onlyOwned = catalog.onlyOwned;
  return items.length ? (
    items.map((item) => <CharacterRow key={item.character.slug} {...item} />)
  ) : (
    <div className="empty">
      <h3>{onlyOwned ? "Здесь пока пусто" : "Ничего не найдено"}</h3>
      <p>
        {onlyOwned
          ? "Отметьте свои модели в каталоге или измените остальные фильтры."
          : "Попробуйте другое имя или снимите фильтры."}
      </p>
      <button
        data-action="reset"
        onClick={(event) => {
          event.stopPropagation();
          catalog.reset();
        }}
      >
        Показать всех персонажей
      </button>
    </div>
  );
});
export function CharacterDetail({
  character: c,
  owned,
  boxOwned,
  card,
  boxes,
  boxError,
  rosters,
  sourceDate,
}) {
  return (
    <>
      <header className="detail-head">
        <div className="detail-top">
          <Avatar character={c} large />
          <div className="detail-name">
            <span className="eyebrow">02 / Карточка персонажа</span>
            <h2>{c.name}</h2>
            <p>{c.alterEgo}</p>
            <div className="detail-character-actions">
              <RoleIcons slug={c.slug} />
              <button
                className="character-role calculator-open"
                aria-label="Калькулятор"
                title="Калькулятор"
                onClick={() =>
                  actions.openCalculator(c.slug, {
                    form: catalog.selectedForm,
                    side: catalog.selectedSide,
                  })
                }
              >
                <i className="fa-solid fa-calculator" aria-hidden="true" />
              </button>
            </div>
            <div className="tags">
              {c.affiliations.map((a) => (
                <span className="tag" key={a.slug || a.name}>
                  {a.name}
                  {a.isLeader ? " · лидер" : ""}
                </span>
              ))}
              {c.isGrunt && <span className="tag">Grunt</span>}
            </div>
          </div>
          <div className="detail-collection-controls">
            <OwnedCheckbox
              character={c}
              owned={owned}
              boxOwned={boxOwned}
              detail
            />
            <ModelProgress character={c} compact />
          </div>
          <button
            className="quiet close"
            data-action="close-character"
            onClick={(event) => {
              event.stopPropagation();
              catalog.close();
            }}
            aria-label="Закрыть карточку"
            data-dialog-initial-focus
          >
            ×
          </button>
        </div>
      </header>
      <div className="detail-body">
        {card}
        <CharacterTactics character={c} />
        <CharacterBoxes items={boxes} error={boxError} />
        <section className="detail-section roster-memberships">
          <div className="section-title">
            <h3>В моих ростерах</h3>
            <button
              data-action="pick-roster"
              onClick={(event) => {
                event.stopPropagation();
                actions.pickRoster();
              }}
            >
              Добавить в ростер +
            </button>
          </div>
          {rosters.length ? (
            rosters.map((r) => (
              <button
                key={r.id}
                className="roster-link"
                data-action="view-roster"
                data-id={r.id}
                onClick={(event) => {
                  event.stopPropagation();
                  actions.openRoster(r.id);
                }}
              >
                <span>
                  <strong>{r.name}</strong>
                  <small>{r.affiliation || "Без выбранной аффилиации"}</small>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            ))
          ) : (
            <div className="no-rosters">Пока ни в одном ростере.</div>
          )}
        </section>
        <div className="source-line">
          <a href={c.sourceUrl} target="_blank" rel="noopener">
            Карточка на Jarvis ↗
          </a>
          <span>Данные Jarvis · {sourceDate}</span>
        </div>
      </div>
    </>
  );
}
