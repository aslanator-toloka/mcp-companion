import React, { useEffect, useId, useRef, useState } from "react";
import { Rule, StatSurface } from "./cards.jsx";
import { catalog as catalogStore } from "./stores/index.js";
import { UIIcon } from "./ui-icons.jsx";

const players = ["p1", "p2"];
const tabList = [
  ["fighter", "Боец"],
  ["mission", "Миссия"],
  ["tactics", "Тактики"],
  ["journal", "Журнал"],
];
const shortName = (name) => name.split(" · ")[0];

export function Scoreboard({ state, side, onSide, phase, disabled }) {
  return (
    <header className="game-scoreboard" aria-label="Счёт матча">
      {players.map((p) => (
        <button
          key={p}
          className={"game-score-team " + p}
          aria-pressed={side === p}
          aria-label={
            p.toUpperCase() + " · " + shortName(state.rosters[p].name)
          }
          disabled={disabled}
          onClick={() => onSide(p)}
        >
          <span className="game-team-copy">
            <small>
              {p.toUpperCase()}
              <span className="game-player-mode">
                {" "}
                · {state.controllers[p] === "cli" ? "CLI" : "Локально"}
              </span>
            </small>
            <strong>{shortName(state.rosters[p].name)}</strong>
          </span>
          <span className="game-vp">
            <b>{state.score?.[p] ?? 0}</b>
            <small>VP</small>
          </span>
        </button>
      ))}
      <div className="game-score-center">
        <span className="game-eyebrow">
          {state.round ? "Раунд " + state.round : "Подготовка матча"}
        </span>
        <div className="game-rounds" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <i
              key={i}
              data-current={i + 1 === state.round}
              data-past={i + 1 < state.round}
            />
          ))}
        </div>
        <span className="game-score-priority">
          {state.priority
            ? "Priority · " + state.priority.toUpperCase()
            : phase}
        </span>
      </div>
    </header>
  );
}

export function GameTabs({ value, onChange, panels }) {
  return (
    <aside className="game-inspector" aria-label="Информация о матче">
      <div
        className="game-tabs"
        role="tablist"
        aria-label="Разделы матча"
        onKeyDown={(event) => {
          const position = tabList.findIndex(([id]) => id === value);
          const index = {
            ArrowLeft: (position + 3) % 4,
            ArrowRight: (position + 1) % 4,
            Home: 0,
            End: 3,
          }[event.key];
          if (index === undefined) return;
          event.preventDefault();
          const [id] = tabList[index];
          onChange(id);
          event.currentTarget.querySelectorAll("button")[index].focus();
        }}
      >
        {tabList.map(([id, label]) => (
          <button
            key={id}
            type="button"
            id={"game-tab-" + id}
            role="tab"
            aria-controls={"game-pane-" + id}
            aria-selected={value === id}
            tabIndex={value === id ? 0 : -1}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tabList.map(([id]) => (
        <section
          key={id}
          className="game-tab-panel"
          role="tabpanel"
          id={"game-pane-" + id}
          aria-labelledby={"game-tab-" + id}
          hidden={value !== id}
        >
          {value === id && panels[id]}
        </section>
      ))}
    </aside>
  );
}

export function Vitals({ fighter }) {
  const f = fighter;
  return (
    <div className="game-vitals">
      <span className="game-health" title="Stamina">
        <img src="assets/card-icons/damage.png" alt="" />
        <strong>
          {f.hp}
          <small>/{f.maxHp} HP</small>
        </strong>
        <i
          aria-hidden="true"
          style={{ "--health": Math.max(0, f.hp / f.maxHp) * 100 + "%" }}
        />
      </span>
      <span className="game-power" title="Power">
        <img src="assets/card-icons/power.png" alt="" />
        <strong>
          {f.power}
          <small> Power</small>
        </strong>
      </span>
      {f.ko ? (
        <span>KO</span>
      ) : f.dazed ? (
        <span title="Dazed">Dz</span>
      ) : f.activated ? (
        <span>Активирован</span>
      ) : null}
      {f.flares > 0 && <span title="Flare">Flare {f.flares}</span>}
      {f.phoenix > 0 && <span title="Phoenix">Phoenix {f.phoenix}</span>}
      {f.neural && <span title="Neural Connection">Neural</span>}
      {f.selfDiscovery && <span title="Self-Discovery">+3 защ.</span>}
      {f.conditions?.map((name) => (
        <img
          key={name}
          className="game-condition"
          src={"assets/conditions/" + name + ".png"}
          alt={name}
          title={name}
        />
      ))}
    </div>
  );
}

const FighterCard = React.memo(function FighterCard({ fighter }) {
  const enlarged = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [flipped, setFlipped] = useState(false);
  useEffect(() => setFlipped(false), [fighter.form, fighter.injured]);
  useEffect(() => {
    let live = true;
    catalogStore
      .detail(fighter.slug)
      .then((detail) => {
        if (live) setData(detail);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [fighter.slug]);
  if (error) return <p role="status">{error}</p>;
  if (!data) return <p role="status">Загружается карта…</p>;
  const form = fighter.form || 0;
  const card = form === 1 ? data.secondStatCard : data.statCard;
  const canFlip = !!card?.backSide;
  const injured = !!fighter.injured && canFlip;
  const showingInjured = canFlip && flipped ? !injured : injured;
  const view = {
    key: "game:" + fighter.id,
    slug: fighter.slug,
    detail: data,
    form,
    side: showingInjured ? "back" : "front",
  };
  const label = fighter.name;
  const flipLabel = showingInjured
    ? "Показать здоровую сторону"
    : "Показать раненую сторону";
  const flipButton = canFlip && (
    <button
      type="button"
      className="game-card-icon game-card-flip"
      aria-label={flipLabel}
      title={flipLabel}
      onClick={() => setFlipped((value) => !value)}
    >
      <UIIcon name="flip" />
    </button>
  );
  return (
    <>
      <div className="game-card-frame">
        <StatSurface
          view={view}
          cardControls={
            <>
              <button
                type="button"
                className="game-card-icon game-card-open"
                onClick={() => enlarged.current.showModal()}
                aria-label={"Развернуть карту: " + label}
                title="Развернуть карту"
              >
                <UIIcon name="search" />
              </button>
              {flipButton}
            </>
          }
        />
      </div>
      <dialog className="game-full-card" ref={enlarged} aria-label={label}>
        <div className="game-full-card-head">
          <strong>{label}</strong>
          <button onClick={() => enlarged.current.close()}>Закрыть</button>
        </div>
        <StatSurface
          view={{ ...view, key: view.key + ":full" }}
          cardControls={flipButton}
        />
      </dialog>
    </>
  );
});

const powerInfo = {
  active: {
    label: "Активная",
    hint: "Применяется во время активации бойца при выполнении условий.",
  },
  reactive: {
    label: "Реакция",
    hint: "Предложение применить способность появится, когда сработает её условие.",
  },
  innate: {
    label: "Пассивная",
    hint: "Действует при выполнении условий из текста.",
  },
  leadership: {
    label: "Leadership",
    hint: "Действует для отряда, если эта Leadership выбрана при подготовке матча.",
  },
};

function keywordRules(name) {
  const rules = [];
  if (/\b(?:Flight|Wall Crawler)\b/.test(name))
    rules.push("При размещении шаблона для Advance боец считается Size 5.");
  if (/\bStealth\b/.test(name))
    rules.push("Бойца можно выбрать целью атаки только в пределах Range 3.");
  const immunity = name.match(/Immunity \[([^\]]+)\]/);
  if (immunity) rules.push("Иммунитет к состояниям " + immunity[1] + ".");
  const healing = name.match(/Healing Factor \[(\d+)\]/);
  if (healing)
    rules.push(
      "В конце своей активации боец может снять с себя до " +
        healing[1] +
        " урона.",
    );
  if (/\bPeerless\b/.test(name))
    rules.push("В отряде может быть только один боец с Peerless.");
  const grunt = name.match(/Grunts \[([^\]]+)\]/);
  if (grunt)
    rules.push("Grunt связан с " + grunt[1] + " и активируется перед ним.");
  return rules;
}

function extraAttack(name) {
  const data = window.MCP_GAME_CARD_DATA;
  return [
    data?.crises?.["the-montesi-formula-found-ca09"],
    data?.tactics?.["helios-laser-bombardment"],
    data?.tactics?.["repulsor-refraction"],
    data?.tactics?.["illicit-tech"],
  ]
    .flatMap((card) => card?.attacks || [])
    .find((attack) => attack.name === name);
}

function ActionEntry({
  type,
  name,
  icon,
  info,
  badge,
  available,
  pressed,
  onClick,
  onHover,
  hint,
  rules,
  children,
}) {
  const tooltipId = useId();
  const Heading = onClick ? "button" : "div";
  return (
    <article className="game-action-entry">
      <div
        className="game-action-heading"
        onPointerEnter={onHover ? () => onHover(true) : undefined}
        onPointerLeave={onHover ? () => onHover(false) : undefined}
      >
        <Heading
          className={"game-action-tile " + type}
          {...(onClick
            ? { type: "button", "aria-pressed": pressed, onClick }
            : { tabIndex: 0 })}
          aria-describedby={tooltipId}
          data-available={available}
        >
          <img src={"assets/card-icons/" + icon + ".png"} alt="" />
          <span>
            <strong>{name}</strong>
            {info && <small>{info}</small>}
          </span>
          <span className="game-action-badge">{badge}</span>
        </Heading>
        <span id={tooltipId} role="tooltip" className="game-action-tooltip">
          {hint}
        </span>
      </div>
      {rules.length > 0 && (
        <div className="game-action-rules">
          {rules.map((text, index) => (
            <p key={index}>
              <Rule text={text} />
            </p>
          ))}
        </div>
      )}
      {pressed && children}
    </article>
  );
}

export function FighterPanel({
  fighter,
  attackOptions,
  powers,
  aim,
  chosenPower,
  onAttack,
  onAttackHover,
  onPower,
  onPowerHover,
  children,
}) {
  if (!fighter)
    return (
      <div className="game-empty">
        <h3>Карточка бойца</h3>
        <p>Выбери портрет на поле или в отряде.</p>
      </div>
    );
  const known = fighter.attacks.map((attack, index) => ({ ...attack, index }));
  for (const a of attackOptions)
    if (!known.some((item) => item.index === a.index)) {
      known.push({
        ...a,
        ...extraAttack(a.name),
        type: a.types[0],
        powerCost: a.cost,
      });
    }
  return (
    <>
      <div className="game-fighter-title">
        <span className={"game-side-tag " + fighter.side}>
          {fighter.side.toUpperCase()}
        </span>
        <h3>{fighter.name}</h3>
      </div>
      <Vitals fighter={fighter} />
      <FighterCard key={fighter.id} fighter={fighter} />
      <div className="game-action-list">
        <h4>Атаки</h4>
        {known.map((a) => {
          const option = attackOptions.find((item) => item.index === a.index);
          return (
            <ActionEntry
              key={a.index}
              type={"attack " + a.type}
              icon={"badge-attack-" + a.type}
              name={a.name}
              info={[
                a.range && String(a.range).replace(/^([0-9])/, "R$1"),
                a.strength && a.strength + " куб.",
                a.powerCost != null && a.powerCost + " Power",
              ]
                .filter(Boolean)
                .join(" · ")}
              badge={option ? "Готова" : "Недоступна"}
              hint={
                option
                  ? "Нажми, чтобы увидеть доступные цели. Удерживай Shift, чтобы прибавить перемещение к дальности."
                  : "Наведи курсор, чтобы увидеть дальность. Удерживай Shift, чтобы прибавить перемещение."
              }
              rules={a.steps || []}
              available={!!option}
              pressed={aim?.index === a.index}
              onClick={() => onAttack(a, option)}
              onHover={(hovered) => onAttackHover(hovered ? a : null, option)}
            >
              {children}
            </ActionEntry>
          );
        })}
        <h4>Способности</h4>
        {fighter.powers.map((power) => {
          const option = powers.find((p) => p.value === power.name);
          const kind = powerInfo[power.type];
          const range =
            option?.range ??
            power.range ??
            Number(
              power.body?.match(
                /(?<!not )\bwithin\s+\|!range\|\s*([1-5])\b/i,
              )?.[1],
            );
          const hint = option
            ? "Нажми, чтобы выбрать цель или применить способность."
            : power.type === "active"
              ? "Сейчас способность недоступна. " + kind.hint
              : kind?.hint;
          return (
            <ActionEntry
              key={power.name}
              type="ability"
              icon={"badge-" + power.type}
              name={power.name}
              info={
                power.powerCost == null
                  ? ""
                  : (option?.cost ?? power.powerCost) + " Power"
              }
              badge={
                option
                  ? "Готова"
                  : power.type === "active"
                    ? "Недоступна"
                    : kind?.label || power.type
              }
              hint={
                range
                  ? hint +
                    " Удерживай Shift, чтобы прибавить перемещение к дальности."
                  : hint
              }
              rules={power.body ? [power.body] : keywordRules(power.name)}
              available={!!option}
              pressed={chosenPower?.value === power.name}
              onClick={option ? () => onPower(power) : undefined}
              onHover={
                range
                  ? (hovered) =>
                      onPowerHover(
                        hovered
                          ? {
                              range,
                              placement:
                                option?.mode === "place" || power.placement,
                            }
                          : null,
                      )
                  : undefined
              }
            >
              {children}
            </ActionEntry>
          );
        })}
      </div>
    </>
  );
}

export function TeamStrip({
  fighters,
  selected,
  active,
  catalog,
  ready,
  onFighter,
}) {
  if (!fighters.length) return null;
  return (
    <div className="game-team-strip" aria-label="Фигуры в партии">
      {players.map((side) => (
        <div className={"game-portraits " + side} key={side}>
          <span>{side.toUpperCase()}</span>
          {fighters
            .filter((f) => f.side === side)
            .map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onFighter(f.id)}
                aria-pressed={selected === f.id}
                aria-current={active === f.id ? "true" : undefined}
                aria-label={
                  (ready.includes(f.id) ? "Выбрать " : "Посмотреть ") +
                  f.name +
                  " · " +
                  side.toUpperCase() +
                  (active === f.id ? " · сейчас ходит" : "")
                }
                title={
                  f.name +
                  " · " +
                  f.hp +
                  "/" +
                  f.maxHp +
                  " HP · " +
                  f.power +
                  " Power" +
                  (f.ko ? " · KO" : f.dazed ? " · Dazed" : "")
                }
                data-acted={f.activated || f.ko || f.dazed}
              >
                <img src={catalog.characters[f.slug].portrait} alt="" />
                {active === f.id && (
                  <span className="game-portrait-turn" aria-hidden="true">
                    Ход
                  </span>
                )}
                {(f.ko || f.dazed) && (
                  <span
                    className="game-portrait-status"
                    data-status={f.ko ? "ko" : "dazed"}
                  >
                    {f.ko ? "KO" : "Dz"}
                  </span>
                )}
                <i
                  style={{
                    "--health": Math.max(0, f.hp / f.maxHp) * 100 + "%",
                  }}
                />
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
