import React, { useLayoutEffect, useRef, useState } from "react";
import { GameCard } from "./cards.jsx";
import { cardViews } from "./stores/index.js";

const sides = ["p1", "p2"];

function TacticOptions({ card, disabled, onCancel, onCommand }) {
  const [choice, setChoice] = useState("");
  const [payments, setPayments] = useState({});
  const option =
    card.choices?.find((item) => item.value === choice) || card.choices?.[0];
  const contributions =
    card.payments &&
    Object.fromEntries(
      card.payments
        .filter((payer) => payments[payer.id])
        .map((payer) => [payer.id, payments[payer.id]]),
    );
  return (
    <fieldset className="game-options game-tactic-options">
      <legend>{card.label}</legend>
      {option && (
        <label>
          Эффект
          <select
            value={option.value}
            onChange={(event) => setChoice(event.target.value)}
          >
            {card.choices.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {card.payments?.map((payer) => (
        <label key={payer.id}>
          {payer.label} · Power
          <input
            type="number"
            min="0"
            max={payer.maximum}
            value={payments[payer.id] || 0}
            onChange={(event) =>
              setPayments({
                ...payments,
                [payer.id]: Number(event.target.value),
              })
            }
          />
        </label>
      ))}
      <button
        type="button"
        className="game-primary"
        disabled={
          disabled || (contributions && !Object.keys(contributions).length)
        }
        onClick={() =>
          onCommand({
            type: "tactic",
            value: card.value,
            choice: option?.value,
            payments: contributions,
          })
        }
      >
        Сыграть тактику
      </button>
      <button type="button" onClick={onCancel}>
        Отмена
      </button>
    </fieldset>
  );
}

export function GameTactics({
  state,
  catalog,
  side,
  playable,
  busy,
  onCommand,
}) {
  const [viewedSide, setViewedSide] = useState(side);
  const [selected, setSelected] = useState("");
  const strip = useRef(null);
  const scrollLeft = useRef(0);
  const tabButtons = useRef(null);
  const hand = state.squads[viewedSide]?.tactics || [];
  const played = (state.playedTactics?.[viewedSide] || []).filter((id) =>
    hand.includes(id),
  );
  const used = new Set(played);
  const ordered = [...hand.filter((id) => !used.has(id)), ...played];
  const choices = viewedSide === side ? playable : [];
  const chosen = choices.find((card) => card.value === selected);
  const playedKey = played.join("|");
  useLayoutEffect(() => {
    if (strip.current) strip.current.scrollLeft = scrollLeft.current;
  }, [viewedSide, playedKey]);

  function switchSide(player) {
    if (player !== viewedSide) scrollLeft.current = 0;
    setViewedSide(player);
    setSelected("");
  }

  function scroll(direction) {
    const row = strip.current;
    row?.scrollBy({
      left: direction * row.clientWidth * 0.85,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  function choose(option) {
    if (option.choices || option.payments) setSelected(option.value);
    else onCommand({ type: "tactic", value: option.value });
  }

  return (
    <div className="game-tactics">
      <div className="game-tactics-bar">
        <div
          className="game-tactics-tabs"
          role="tablist"
          aria-label="Тактики игроков"
          ref={tabButtons}
          onKeyDown={(event) => {
            const next =
              event.key === "Home"
                ? "p1"
                : event.key === "End"
                  ? "p2"
                  : ["ArrowLeft", "ArrowRight"].includes(event.key)
                    ? sides.find((player) => player !== viewedSide)
                    : null;
            if (!next) return;
            event.preventDefault();
            event.stopPropagation();
            switchSide(next);
            tabButtons.current.children[sides.indexOf(next)].focus();
          }}
        >
          {sides.map((player) => (
            <button
              key={player}
              type="button"
              role="tab"
              id={"game-tactics-tab-" + player}
              aria-controls={"game-tactics-panel-" + player}
              aria-selected={viewedSide === player}
              tabIndex={viewedSide === player ? 0 : -1}
              className={player}
              onClick={() => switchSide(player)}
            >
              {player.toUpperCase()}
            </button>
          ))}
        </div>
        {ordered.length > 1 && (
          <div
            className="game-tactics-scroll-buttons"
            aria-label="Прокрутка тактик"
          >
            <button
              type="button"
              aria-label="Предыдущие карты"
              onClick={() => scroll(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Следующие карты"
              onClick={() => scroll(1)}
            >
              ›
            </button>
          </div>
        )}
      </div>
      {sides.map((player) => (
        <div
          key={player}
          id={"game-tactics-panel-" + player}
          role="tabpanel"
          aria-labelledby={"game-tactics-tab-" + player}
          hidden={player !== viewedSide}
        >
          {player === viewedSide &&
            (ordered.length ? (
              <div
                ref={strip}
                onScroll={(event) => {
                  scrollLeft.current = event.currentTarget.scrollLeft;
                }}
                className="game-tactics-strip"
                role="region"
                aria-label={"Карты " + player.toUpperCase()}
                tabIndex={0}
              >
                {ordered.map((id) => {
                  const card = catalog.tactics[id];
                  const spent = used.has(id);
                  const available =
                    !spent && choices.find((option) => option.value === id);
                  return (
                    <div
                      className="game-tactics-card"
                      key={id}
                      data-played={spent}
                      data-card={id}
                    >
                      <div className="game-tactics-card-header">
                        <span
                          className="game-tactics-card-status"
                          data-ready={!!available}
                        >
                          {spent ? "Сыграна" : available ? "Готова" : "В руке"}
                        </span>
                        <button
                          type="button"
                          aria-label={"Открыть крупно: " + card.name}
                          onClick={() =>
                            cardViews.showGame(
                              card,
                              "tactics",
                              spent ? "Сыграна" : "В руке",
                            )
                          }
                        >
                          ↗
                        </button>
                      </div>
                      <div className="gc-surface game-tactics-card-face">
                        <GameCard card={card} kind="tactics" />
                      </div>
                      {available && (
                        <button
                          type="button"
                          className="game-primary game-tactics-play"
                          disabled={busy}
                          aria-label={"Сыграть: " + card.name}
                          onClick={() => choose(available)}
                        >
                          Сыграть · {available.cost} Power
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="game-tactics-empty">
                {state.squads[player]
                  ? "В отряде нет тактик."
                  : "Карты откроются после выбора отрядов."}
              </p>
            ))}
        </div>
      ))}
      {chosen && (
        <TacticOptions
          key={chosen.value}
          card={chosen}
          disabled={busy}
          onCommand={onCommand}
          onCancel={() => setSelected("")}
        />
      )}
    </div>
  );
}
