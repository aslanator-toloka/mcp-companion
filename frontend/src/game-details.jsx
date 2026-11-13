import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GameCard } from "./cards.jsx";
import { clean } from "./combat/profile.js";

const title = (text) => clean(text).replace(/\\/g, " ").replace(/\s+/g, " ");
const current = (values, key) =>
  values.find((v) => v.value === key) || values[0];

function cardPreviewPosition(button) {
  const rect = button.getBoundingClientRect();
  const margin = 12;
  const ratio = 640 / 446;
  const width = Math.min(
    328,
    innerWidth - margin * 2,
    (innerHeight - margin * 2) / ratio,
  );
  const height = width * ratio;
  const left = rect.left - width - margin;
  const right = rect.right + margin;
  if (left >= margin || right + width <= innerWidth - margin) {
    return {
      width,
      left: left >= margin ? left : right,
      top: Math.max(margin, Math.min(rect.top, innerHeight - height - margin)),
    };
  }

  const above = rect.top - margin * 2;
  const below = innerHeight - rect.bottom - margin * 2;
  const fittedWidth = Math.min(width, Math.max(above, below) / ratio);
  return {
    width: fittedWidth,
    left: Math.max(
      margin,
      Math.min(rect.left, innerWidth - fittedWidth - margin),
    ),
    top:
      above > below
        ? rect.top - fittedWidth * ratio - margin
        : rect.bottom + margin,
  };
}

export function DecisionButton({ card, disabled, onClick, children }) {
  const [preview, setPreview] = useState(null);
  const open = !!(preview && card && !disabled);
  useEffect(() => {
    if (!open) return;
    const close = () => setPreview(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onPointerEnter={(event) => {
          if (card && event.pointerType !== "touch")
            setPreview(cardPreviewPosition(event.currentTarget));
        }}
        onPointerLeave={() => setPreview(null)}
        onFocus={(event) => {
          if (card && event.currentTarget.matches(":focus-visible"))
            setPreview(cardPreviewPosition(event.currentTarget));
        }}
        onBlur={() => setPreview(null)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setPreview(null);
        }}
        onClick={() => {
          setPreview(null);
          onClick();
        }}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            className="game-decision-card-preview gc-surface"
            style={preview}
            inert
          >
            <GameCard card={card} kind="tactics" />
          </div>,
          document.body,
        )}
    </>
  );
}

export function MissionDetails({ catalog, state }) {
  const cards = [
    ...new Set([...Object.values(state.mission), ...state.offers]),
  ];
  if (!cards.length) return null;
  return (
    <section className="game-details">
      <h3>Миссия</h3>
      {cards.map((id) => {
        const card = catalog.crises[id];
        return (
          <details key={id}>
            <summary>
              {card.type} · {card.name} · {card.threatLevel} Threat
            </summary>
            <p>{title(card.setupDescription)}</p>
            <p>
              <strong>Очки.</strong> {title(card.scoringDescription)}
            </p>
            {card.paragraphs?.map((paragraph, index) => (
              <p key={index}>{title(paragraph)}</p>
            ))}
            {card.body && <p>{title(card.body)}</p>}
          </details>
        );
      })}
    </section>
  );
}

export function ActionFeed({ state }) {
  const active = state.fighters.find((f) => f.id === state.active);
  const log = state.log.slice(-10).reverse();
  const pending = state.pendingAttack;
  const pendingTarget = state.fighters.find((f) => f.id === pending?.target);
  return (
    <section className="game-details">
      <h3>Что происходит</h3>
      <div role="status" aria-live="polite" aria-atomic="true">
        {state.phase === "finished" ? (
          <p>
            {state.winner
              ? "Победа " + state.winner.toUpperCase()
              : "Матч завершён без результата"}
          </p>
        ) : (
          <p>
            {active && (
              <strong>
                {active.side.toUpperCase()} · {active.name}.{" "}
              </strong>
            )}
            {pendingTarget
              ? pendingTarget.name + " отвечает на атаку."
              : state.drops?.length && !state.effects?.length
                ? "Ожидается размещение выпавшего жетона."
                : state.effects?.length
                  ? "Ожидается решение по эффекту атаки."
                  : active
                    ? "Осталось действий: " + state.actionsLeft + "."
                    : state.awaitingSide
                      ? "Решение за " + state.awaitingSide.toUpperCase() + "."
                      : "Оба игрока делают выбор."}
          </p>
        )}
        {log[0] && (
          <p>
            {log[0].side && log[0].side.toUpperCase() + " · "}
            {log[0].text}
          </p>
        )}
      </div>
      <DiceLog state={state} />
      <details>
        <summary>Последние события</summary>
        <ol className="game-log">
          {log.map((entry, i) => (
            <li key={i}>
              {entry.side && entry.side.toUpperCase() + " · "}
              {entry.text}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

function DiceLog({ state }) {
  const history = state.log
    .map((entry, index) => {
      const pools =
        entry.rolls ||
        (entry.rolled
          ? [
              {
                label: "Атака",
                faces: entry.rolled,
                successes: entry.rollSummary?.attackHits,
              },
              {
                label: "Защита",
                faces: entry.defense,
                successes: entry.rollSummary?.defenseHits,
              },
            ]
          : Object.entries(entry.dice || {}).map(([side, faces]) => ({
              label: side.toUpperCase(),
              faces,
            })));
      return { entry, index, pools };
    })
    .filter(({ pools }) => pools.length)
    .reverse();
  const pending = state.effects?.[0]?.resume;
  const currentAttack = pending?.rolls?.rolled || pending?.initial;
  const currentPools = currentAttack
    ? [
        {
          label: "Атака",
          faces: currentAttack,
          successes: state.attackRoll?.attackHits,
        },
        {
          label: "Защита",
          faces: pending.rolls?.defense,
          successes: state.attackRoll?.defenseHits,
        },
      ]
    : [];

  return (
    <section className="game-dice-log" aria-label="Броски кубиков">
      <h3>Броски кубиков</h3>
      {currentPools.length > 0 && (
        <div className="game-dice-log-entry">
          <strong>Текущая атака</strong>
          <LoggedDice pools={currentPools} />
          <AttackDamage incoming={state.attackRoll?.incoming} />
        </div>
      )}
      {history.length > 0 ? (
        <ol
          className="game-dice-log-list"
          tabIndex={0}
          aria-label="История бросков"
        >
          {history.map(({ entry, index, pools }) => (
            <li key={index} className="game-dice-log-entry">
              <small>
                {entry.round ? "Раунд " + entry.round : "Подготовка"}
                {entry.side && " · " + entry.side.toUpperCase()}
              </small>
              <strong>
                {entry.dealt == null
                  ? entry.text
                  : entry.text.replace(/ · \d+ урона$/, "")}
              </strong>
              <LoggedDice pools={pools} />
              <AttackDamage
                incoming={entry.rollSummary?.incoming}
                dealt={entry.dealt}
              />
            </li>
          ))}
        </ol>
      ) : (
        !currentPools.length && <p>Бросков пока нет.</p>
      )}
    </section>
  );
}

function AttackDamage({ incoming, dealt }) {
  if (incoming == null && dealt == null) return null;
  return (
    <div className="game-damage-total">
      {dealt != null && <strong>Нанесено {dealt} урона</strong>}
      {incoming != null && incoming !== dealt && (
        <span>Урон по кубикам · {incoming}</span>
      )}
    </div>
  );
}

function dicePoolLabel(label, successes) {
  return successes == null ? label : `${label} · успехи ${successes}`;
}

function LoggedDice({ pools }) {
  return (
    <div className="game-dice-line">
      {pools
        .filter(({ faces }) => faces?.length)
        .map(({ label, faces, successes }) => (
          <div key={label} role="group" aria-label={label}>
            <strong>{dicePoolLabel(label, successes)}</strong>
            {faces.map((value, index) => (
              <GameDie key={index} value={value} />
            ))}
          </div>
        ))}
    </div>
  );
}

export function InteractMenu({ interacts, disabled, onCommand }) {
  const [id, setId] = useState("");
  const [target, setTarget] = useState("");
  const objective = current(interacts, id);
  const recipient = objective.targets && current(objective.targets, target);
  return (
    <fieldset className="game-options">
      <legend>Interact · 1 Power</legend>
      <label>
        Цель{" "}
        <select
          value={objective.value}
          onChange={(event) => setId(event.target.value)}
        >
          {interacts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {recipient && (
        <label>
          Лечить{" "}
          <select
            value={recipient.value}
            onChange={(event) => setTarget(event.target.value)}
          >
            {objective.targets.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        disabled={disabled}
        onClick={() =>
          onCommand({
            type: "interact",
            value: objective.value,
            target: recipient?.value,
          })
        }
      >
        Взаимодействовать
      </button>
    </fieldset>
  );
}

export function VolleyMenu({ action, disabled, onCommand }) {
  const [sample, setSample] = useState(false);
  const choosingOrder = action.options.length > 1;
  return (
    <fieldset className="game-options">
      <legend>{choosingOrder ? "Порядок целей" : "Атака по одной цели"}</legend>
      {action.sampleBoost && (
        <label>
          <input
            type="checkbox"
            checked={sample}
            onChange={(event) => setSample(event.target.checked)}
          />{" "}
          Потратить Genetic Sample
        </label>
      )}
      {action.options.map((option) => (
        <button
          key={option.value}
          disabled={disabled}
          onClick={() =>
            onCommand({
              type: "volley-target",
              value: option.value,
              sample: action.sampleBoost && sample,
            })
          }
        >
          {choosingOrder ? option.label : "Атаковать · " + option.label}
        </button>
      ))}
    </fieldset>
  );
}

export function GameDie({ value }) {
  return (
    <span
      className="game-die-face"
      role="img"
      aria-label={value}
      title={value}
      data-face={value}
    >
      {value !== "blank" && (
        <img src={"assets/card-icons/" + value + ".png"} alt="" />
      )}
    </span>
  );
}

export function DiceMenu({ action, rolls, summary, disabled, onCommand }) {
  const [indices, setIndices] = useState([]);
  const [face, setFace] = useState("critical");
  const [amount, setAmount] = useState(1);
  const selected = indices
    .filter((index) => action.eligible?.includes(index))
    .slice(0, action.max);
  const selectionRole = action.role || "rolled";
  const defenseReroll = action.id === "defense-power";
  return (
    <fieldset className="game-options game-dice-prompt">
      <legend>{action.label}</legend>
      <p>
        {action.kind === "reduce"
          ? "Сократи входящий урон."
          : defenseReroll
            ? "Эта способность применяется один раз за атаку. Выбери сразу все кубики для переброса."
            : "Выбери кубики для эффекта."}
        {action.cost > 0 && " · " + action.cost + " Power"}
        {action.variable && " · 1 Power за кубик"}
      </p>
      {[
        ["rolled", "Атака", summary?.attackHits],
        ["defense", "Защита", summary?.defenseHits],
      ].map(([role, label, successes]) => {
        const selectable = action.kind !== "reduce" && role === selectionRole;
        const dice = selectable ? action.dice : rolls?.[role];
        if (!dice?.length) return null;
        return (
          <div
            key={role}
            className="game-dice-pool"
            role="group"
            aria-label={label}
          >
            <strong>{dicePoolLabel(label, successes)}</strong>
            <div className="game-dice-faces">
              {dice.map((value, index) =>
                selectable ? (
                  <label key={index} className="game-die-pick">
                    <input
                      type="checkbox"
                      aria-label={value + " · кубик " + (index + 1)}
                      checked={selected.includes(index)}
                      disabled={
                        disabled ||
                        !action.eligible.includes(index) ||
                        (selected.length >= action.max &&
                          !selected.includes(index))
                      }
                      onChange={(event) =>
                        setIndices(
                          event.target.checked
                            ? [...selected, index]
                            : selected.filter((i) => i !== index),
                        )
                      }
                    />
                    <GameDie value={value} />
                  </label>
                ) : (
                  <GameDie key={index} value={value} />
                ),
              )}
            </div>
          </div>
        );
      })}
      <AttackDamage incoming={summary?.incoming} />
      {action.kind === "reduce" && (
        <label>
          Снизить урон на
          <input
            type="number"
            min="1"
            max={action.max}
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
        </label>
      )}
      {action.kind === "change" && (
        <label>
          Новая грань
          <select
            value={face}
            onChange={(event) => setFace(event.target.value)}
          >
            {["critical", "wild", "hit", "block", "failure", "blank"].map(
              (name) => (
                <option key={name}>{name}</option>
              ),
            )}
          </select>
        </label>
      )}
      <button
        disabled={disabled || (action.kind !== "reduce" && !selected.length)}
        onClick={() =>
          onCommand({ type: "modify-dice", indices: selected, face, amount })
        }
      >
        {defenseReroll ? "Перебросить выбранные" : "Применить"}
      </button>
    </fieldset>
  );
}
