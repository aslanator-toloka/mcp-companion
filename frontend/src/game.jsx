import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { library, ui } from "./stores/index.js";
import { Board } from "./game-battlefield.jsx";
import { FighterPanel, GameTabs, Scoreboard, TeamStrip } from "./game-hud.jsx";
import { useGameFeedback } from "./game-feedback.js";
import { GameTactics } from "./game-tactics.jsx";
import {
  ActionFeed,
  DecisionButton,
  DiceMenu,
  GameDie,
  InteractMenu,
  MissionDetails,
  VolleyMenu,
} from "./game-details.jsx";

const base = "/__mcp_game/";
const sides = ["p1", "p2"];
const attackRange = (card, option) =>
  option?.range ?? Number(String(card.range || "").replace(/^[AB]/, ""));
const phases = {
  priority: "Бросок за Priority",
  "crisis-type": "Выбор типа кризиса",
  "first-crisis": "Выбор первого кризиса",
  "second-crisis": "Выбор второго кризиса",
  threat: "Лимит Threat",
  edge: "Выбор края",
  squad: "Сбор отрядов",
  deployment: "Расстановка",
  leadership: "Выбор Leadership",
  "round-priority": "Priority первого раунда",
  activation: "Активация",
  finished: "Матч завершён",
};
const decisionLabels = {
  "modify-dice": "Изменение кубиков",
  "choose-condition": "Выбор состояния",
  "granted-attack": "Выбор атаки",
  "bonus-attack": "Выбор дополнительной атаки",
  "granted-move": "Перемещение бойца",
  "bonus-move": "Дополнительное перемещение",
  "grunt-deploy": "Расстановка бойца",
  "throw-terrain": "Бросок террейна",
  transform: "Трансформация бойца",
  "spawn-drones": "Размещение дронов",
  "place-construct": "Размещение Metal Construct",
  "move-reaction": "Реакция перед Move",
  "strike-order": "Порядок Dash и Velocity",
  "magnetic-crush": "Выбор террейна · Magnetic Crush",
  "from-the-ruins": "Выбор получателя Power · From the Ruins",
  "xavier-school": "Выбор получателя Power · Xavier's School",
  frenzy: "Frenzy · Advance и Adamantium Slash",
  "phase-tactic": "Розыгрыш тактики",
};

function matchStatus(state) {
  if (!state) return "Настройка матча";
  const { phase, awaitingSide, decisionSide, active, pendingAttack } = state;
  if (phase === "finished") return phases.finished;

  const effect = state.effects?.[0];
  let activity = phases[phase];
  if (pendingAttack) activity = "Реакция на атаку";
  else if (effect) {
    activity =
      decisionLabels[effect.type] ||
      (effect.type === "displace" ? "Перемещение бойца" : "Выбор эффекта");
  } else if (state.drops?.length) activity = "Размещение жетона";
  else if (state.volley) activity = "Выбор цели";
  else if (phase === "activation") {
    const fighter = state.fighters.find((item) => item.id === active);
    activity = fighter ? "Активация: " + fighter.name : "Выбор бойца";
  }

  if (!awaitingSide) return activity;
  const player = awaitingSide === "p1" ? 1 : 2;
  const prefix =
    phase !== "activation"
      ? "Игрок " + player
      : awaitingSide === decisionSide
        ? "Ход игрока " + player
        : "Решение игрока " + player;
  return prefix + " · " + activity;
}

const labels = {
  roll: "Бросить кубики",
  advance: "Advance",
  climb: "Climb",
  undo: "Отменить действие",
  end: "Завершить ход",
  pass: "Пас",
  shake: "Снять состояние",
  secure: "Secure",
  extract: "Extraction",
  north: "Верх",
  south: "Низ",
  east: "Справа",
  west: "Слева",
};
async function request(route, body, signal) {
  const response = await fetch(base + route, {
    signal,
    ...(body && {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  if (
    !(response.headers.get("Content-Type") || "").includes("application/json")
  )
    throw Error(
      "Запустите локальный сервер MCP Companion через npm run serve.",
    );
  const result = await response.json();
  if (!response.ok) throw Error(result.error);
  return result;
}

function RosterSetup({ catalog, records, onStart }) {
  const [selected, setSelected] = useState({ p1: "avengers", p2: "cabal" });
  const available = records.filter((r) =>
    ["characters", "tactics", "crises"].every((kind) => {
      const index = kind === "crises" ? catalog.crises : catalog[kind];
      return (
        r[kind]?.length === 10 &&
        r[kind].every((id) => Object.hasOwn(index, id))
      );
    }),
  );
  return (
    <div className="game-controls">
      {sides.map((side) => (
        <label key={side}>
          {side.toUpperCase()}{" "}
          <select
            value={selected[side]}
            onChange={(event) =>
              setSelected({ ...selected, [side]: event.target.value })
            }
          >
            {catalog.presets.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            {available.map((r) => (
              <option key={r.id} value={"saved:" + r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button
        onClick={() =>
          onStart(
            Object.fromEntries(
              sides.map((side) => [
                side,
                available.find((r) => "saved:" + r.id === selected[side]) ||
                  selected[side],
              ]),
            ),
          )
        }
      >
        Начать матч
      </button>
    </div>
  );
}

function SquadForm({ roster, catalog, maximum, onSubmit }) {
  const [characters, setCharacters] = useState([]);
  const [tactics, setTactics] = useState([]);
  const [affiliation, setAffiliation] = useState("");
  const toggle = (ids, id) =>
    ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
  const threat = characters.reduce(
    (sum, slug) => sum + catalog.characters[slug].threatLevel,
    0,
  );
  const affiliations = [
    ...new Set(
      characters.flatMap((id) =>
        catalog.characters[id].affiliations.map((a) => a.name),
      ),
    ),
  ].filter(
    (name) =>
      characters.filter((id) =>
        catalog.characters[id].affiliations.some((a) => a.name === name),
      ).length *
        2 >
      characters.length,
  );
  const selectedAffiliation = affiliations.includes(affiliation)
    ? affiliation
    : "";
  const visibleTactics = roster.tactics.filter(
    (id) =>
      !catalog.tactics[id].affiliation ||
      catalog.tactics[id].affiliation === selectedAffiliation,
  );
  const selectedTactics = tactics.filter((id) => visibleTactics.includes(id));
  return (
    <div className="game-squad">
      <fieldset>
        <legend>
          Персонажи · {threat}/{maximum} Threat
        </legend>
        {roster.characters.map((id) => {
          const card = catalog.characters[id];
          const picked = characters.includes(id);
          const duplicate = characters.some(
            (slug) =>
              catalog.characters[slug].alterEgo === card.alterEgo ||
              (catalog.characters[slug].peerless && card.peerless),
          );
          return (
            <label key={id}>
              <input
                type="checkbox"
                checked={picked}
                disabled={
                  !picked && (threat + card.threatLevel > maximum || duplicate)
                }
                onChange={() => setCharacters(toggle(characters, id))}
              />
              {card.name} · {card.threatLevel}
            </label>
          );
        })}
      </fieldset>
      <fieldset>
        <legend>Аффилиация и тактики · {selectedTactics.length}/5</legend>
        <select
          aria-label="Аффилиация"
          value={selectedAffiliation}
          onChange={(event) => setAffiliation(event.target.value)}
        >
          <option value="">Без аффилиации</option>
          {affiliations.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        {visibleTactics.map((id) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={tactics.includes(id)}
              disabled={!tactics.includes(id) && selectedTactics.length === 5}
              onChange={() => setTactics(toggle(selectedTactics, id))}
            />
            {catalog.tactics[id].name}
          </label>
        ))}
      </fieldset>
      <button
        disabled={!characters.length}
        onClick={() =>
          onSubmit({
            type: "squad",
            characters,
            tactics: selectedTactics,
            affiliation: selectedAffiliation,
          })
        }
      >
        Подтвердить выбор
      </button>
    </div>
  );
}

function GamePanel() {
  const undoButton = useRef(null);
  const [catalog, setCatalog] = useState(null);
  const [side, setSide] = useState("p1");
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  const [inspected, setInspected] = useState("");
  const [aim, setAim] = useState(null);
  const [rangePreview, setRangePreview] = useState(null);
  const [chosenPower, setChosenPower] = useState(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [moveMode, setMoveMode] = useState("advance");
  const [tab, setTab] = useState("fighter");
  const [damageType, setDamageType] = useState("");
  const [payer, setPayer] = useState("");
  const [powerSpend, setPowerSpend] = useState("");
  const [boost, setBoost] = useState("");
  const [flares, setFlares] = useState("");
  const [decree, setDecree] = useState(false);
  const feedback = useGameFeedback(state);
  useEffect(() => {
    function onUndoShortcut(event) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.ctrlKey === event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        (event.code !== "KeyZ" &&
          !["z", "\u001a"].includes(event.key.toLowerCase()))
      )
        return;
      const button = undoButton.current;
      const target = event.target;
      if (
        !button ||
        button.disabled ||
        target.isContentEditable ||
        target.closest?.("input, textarea, select") ||
        document.querySelector("dialog[open]")
      )
        return;
      event.preventDefault();
      button.click();
    }
    window.addEventListener("keydown", onUndoShortcut, true);
    return () => window.removeEventListener("keydown", onUndoShortcut, true);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    request("catalog", null, abort.signal)
      .then(setCatalog)
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!catalog) return;
    const abort = new AbortController();
    let timer;
    async function poll() {
      try {
        const next = await request("state?side=" + side, null, abort.signal);
        if (!abort.signal.aborted)
          setState((current) =>
            current?.revision > next?.revision ||
            (current?.revision === next?.revision &&
              current?.perspective === next?.perspective)
              ? current
              : next,
          );
      } catch (e) {
        if (!abort.signal.aborted) setError(e.message);
      }
      if (!abort.signal.aborted) timer = setTimeout(poll, 600);
    }
    poll();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [catalog, side]);

  async function mutate(route, payload) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await request(route, payload);
      setState(next);
      setChosenPower(null);
      setAim(null);
      setConfirmFinish(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const command = (action) =>
    mutate("command", {
      side,
      action,
      source: "browser",
      revision: state.revision,
    });
  const ownActions =
    state?.controllers[side] === "browser" ? state.actions[side] || [] : [];
  const deploy = ownActions.find((action) => action.type === "deploy");
  const deployFighter = deploy?.fighters.includes(selected)
    ? selected
    : deploy?.fighters[0];
  const attack = ownActions.find((a) => a.type === "attack");
  const volley = ownActions.find((a) => a.type === "volley-target");
  const modifier = ownActions.find((a) => a.type === "modify-dice");
  const interact = ownActions.find((a) => a.type === "interact");
  const shake = ownActions.find((a) => a.type === "shake");
  const powers = ownActions.find((a) => a.type === "power")?.powers || [];
  const selectedPower =
    chosenPower && chosenPower.fighter === state?.active
      ? powers.find((p) => p.value === chosenPower.value)
      : undefined;
  const fighters = state?.fighters || [];
  const focused =
    fighters.find((f) => f.id === inspected) ||
    fighters.find((f) => f.id === state?.active) ||
    fighters.find((f) => f.side === side);
  const ready = ownActions
    .filter((a) => a.type === "activate")
    .map((a) => a.value);
  const attackOption =
    aim && aim.fighter === state?.active
      ? attack?.attacks.find((item) => item.index === aim.index)
      : undefined;
  const powerTargets = selectedPower?.targets?.filter(
    (target) =>
      !selectedPower.variableCost ||
      !powerSpend ||
      target.minPower <= Number(powerSpend),
  );
  const selectedType = attackOption?.types.includes(damageType)
    ? damageType
    : attackOption?.types[0];
  const attackTargets = attackOption?.targets?.filter(
    (target) => !target.types || target.types.includes(selectedType),
  );
  const targetIds =
    attackTargets?.map((t) => t.value) ||
    powerTargets?.map((t) => t.value) ||
    volley?.options?.map((t) => t.value) ||
    [];
  const currentPayers = attackOption?.payers || selectedPower?.payers || [];
  const currentPayer = currentPayers.some((p) => p.value === payer)
    ? payer
    : undefined;
  const clearSelection = () => {
    setAim(null);
    setChosenPower(null);
    setPayer("");
    setPowerSpend("");
  };
  function inspect(id) {
    setInspected(id);
    setTab("fighter");
    setRangePreview(null);
    if (id !== state.active) clearSelection();
  }
  function chooseAttack(card, option, fighterId) {
    inspect(fighterId);
    clearSelection();
    const rangeText = String(card.range || "");
    setAim({
      ...option,
      name: card.name,
      index: card.index,
      fighter: fighterId,
      shape:
        option?.shape || { A: "area", B: "beam" }[rangeText[0]] || "single",
      range: attackRange(card, option),
      angle: 0,
    });
  }
  function choosePower(value, fighterId) {
    inspect(fighterId);
    clearSelection();
    setChosenPower({ value, fighter: fighterId });
  }
  function activate(id) {
    if (ready.includes(id)) command({ type: "activate", value: id });
  }
  function fire(target, angle) {
    if (!attackOption) return;
    command({
      type: "attack",
      index: attackOption.index,
      target,
      angle,
      damageType: selectedType,
      payer: currentPayer,
      ...(attackOption.boostMax > 0 && boost && { boost: Number(boost) }),
      ...(attackOption.flareMax > 0 && flares && { flares: Number(flares) }),
      ...(attackOption.decree && decree && { decree: true }),
    });
  }
  function hitTarget(id) {
    if (attackOption) {
      if (attackOption.shape === "beam") fire(undefined, aim.angle);
      else fire(attackOption.shape === "single" ? id : undefined);
    } else if (powerTargets?.some((t) => t.value === id)) {
      command({
        type: "power",
        value: selectedPower.value,
        target: id,
        payer: currentPayer,
        ...(selectedPower.variableCost &&
          powerSpend && { amount: Number(powerSpend) }),
      });
    } else if (
      volley?.options.some((t) => t.value === id) &&
      !volley.sampleBoost
    ) {
      command({ type: "volley-target", value: id });
    }
  }
  const tactics = ownActions.find((a) => a.type === "tactic");
  const grantedMove = ownActions.find((a) => a.type === "granted-move");
  const displacement = ownActions.find(
    (a) => a.type === "displace" || a.type === "throw-terrain",
  );
  const positionEffect =
    displacement && ["place", "advance"].includes(displacement.mode)
      ? displacement
      : null;
  const direction = displacement && !positionEffect ? displacement : null;
  const bonusMove = ownActions.some((a) => a.type === "bonus-move");
  const position =
    positionEffect ||
    ownActions.find((a) =>
      [
        "drop-objective",
        "transform",
        "spawn-drones",
        "place-construct",
      ].includes(a.type),
    ) ||
    (grantedMove
      ? { ...grantedMove, moveMode }
      : bonusMove
        ? { type: "bonus-move", speed: "S" }
        : selectedPower &&
          ["advance", "place"].includes(selectedPower.mode) && {
            ...selectedPower,
            payer: currentPayer,
            type: "power",
          });
  const mode =
    aim || selectedPower?.mode === "target"
      ? null
      : position
        ? position.type
        : deploy
          ? "deploy"
          : ownActions.some((a) => a.type === moveMode)
            ? moveMode
            : null;
  const phase = phases[state?.phase];
  const pending = state?.pendingAttack;
  const effect = state?.effects?.[0];
  const latest = state?.log.at(-1);
  const commandButtons = ownActions.flatMap(
    ({ type, value, label, options }) => {
      if (
        [
          "squad",
          "deploy",
          "attack",
          "volley-target",
          "modify-dice",
          "transform",
          "spawn-drones",
          "place-construct",
          "displace",
          "throw-terrain",
          "granted-move",
          "tactic",
          "interact",
          "power",
          "bonus-move",
          "drop-objective",
          "activate",
          "shake",
          "advance",
          "climb",
          "undo",
          "pass",
          "end",
        ].includes(type)
      )
        return [];
      return (options || [{ value, label: label || labels[type] }]).map(
        (opt) => {
          const cardId =
            type === "phase-choice" && effect?.type === "phase-tactic"
              ? effect.card
              : type === "go-get-em"
                ? "go-get-em-tiger"
                : type === "hydra-tactic"
                  ? opt.value
                  : null;
          return (
            <DecisionButton
              key={type + ":" + opt.value}
              card={cardId ? catalog.tactics[cardId] : undefined}
              disabled={busy}
              onClick={() => command({ type, value: opt.value })}
            >
              {type === "shake"
                ? "Снять " + opt.label
                : labels[opt.value] || opt.label}
            </DecisionButton>
          );
        },
      );
    },
  );
  const selectable = aim || chosenPower;
  const boardAim =
    (aim && { ...aim, damageType: selectedType }) ||
    (selectedPower?.mode === "target" &&
      selectedPower.range && {
        shape: "single",
        range: selectedPower.range,
        fighter: state.active,
      });
  const control = selectable && (
    <div className="game-aim-panel">
      <div>
        <strong>{aim?.name || chosenPower?.value}</strong>
        <button className="game-quiet" onClick={clearSelection}>
          Сбросить
        </button>
      </div>
      <p>
        {aim
          ? !attackOption
            ? "Сейчас нет доступной цели или не хватает ресурса."
            : attackOption.shape === "beam"
              ? "Наведи луч на поле и щёлкни, чтобы зафиксировать направление."
              : "Выбери подсвеченную цель на поле."
          : !selectedPower
            ? "Сейчас способность недоступна."
            : position
              ? "Выбери подсвеченную точку на поле."
              : selectedPower.effect === "transfer-extract"
                ? "Выбери жетон, который держит союзник."
                : selectedPower.targets
                  ? "Выбери подсвеченную цель."
                  : "Подтверди применение способности."}
      </p>
      {attackOption?.types.length > 1 && (
        <div className="game-action-chips" aria-label="Тип атаки">
          {attackOption.types.map((type) => (
            <button
              key={type}
              aria-pressed={selectedType === type}
              onClick={() => setDamageType(type)}
            >
              {type}
            </button>
          ))}
        </div>
      )}
      {attackOption?.boostMax > 0 && (
        <label>
          Доплата Power{" "}
          <select value={boost} onChange={(e) => setBoost(e.target.value)}>
            <option value="">0</option>
            {Array.from({ length: attackOption.boostMax }, (_, i) => i + 1).map(
              (amount) => (
                <option key={amount} value={amount}>
                  {amount} · +{amount} куб.
                </option>
              ),
            )}
          </select>
        </label>
      )}
      {attackOption?.decree && (
        <label>
          <input
            type="checkbox"
            checked={decree}
            onChange={(e) => setDecree(e.target.checked)}
          />{" "}
          Бонус союзника: Death‘s Decree / Talons / Ferocity
        </label>
      )}
      {attackOption?.flareMax > 0 && (
        <label>
          Thermokinesis · Flare{" "}
          <select value={flares} onChange={(e) => setFlares(e.target.value)}>
            <option value="">0</option>
            {Array.from({ length: attackOption.flareMax }, (_, i) => i + 1).map(
              (amount) => (
                <option key={amount} value={amount}>
                  {amount} · +{amount} куб.
                </option>
              ),
            )}
          </select>
        </label>
      )}
      {currentPayers.length > 0 && (
        <label>
          Платит{" "}
          <select
            value={currentPayer || ""}
            onChange={(e) => setPayer(e.target.value)}
          >
            <option value="">Активный боец</option>
            {currentPayers.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {attackOption?.shape === "beam" && (
        <div className="game-action-chips">
          <label>
            Угол{" "}
            <input
              type="number"
              min="0"
              max="359"
              aria-label="Угол луча"
              value={Math.round(aim.angle)}
              onChange={(event) =>
                setAim({ ...aim, angle: Number(event.target.value) })
              }
            />
          </label>
          <button disabled={busy} onClick={() => fire(undefined, aim.angle)}>
            Запустить луч
          </button>
        </div>
      )}
      {attackOption?.shape === "area" && (
        <button disabled={busy} onClick={() => fire()}>
          Атаковать по области
        </button>
      )}
      {attackOption?.shape === "single" && (
        <div className="game-action-chips" aria-label="Цели атаки">
          {attackTargets.map((t) => (
            <button key={t.value} disabled={busy} onClick={() => fire(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {selectedPower?.variableCost && (
        <label>
          Power{" "}
          <select
            value={powerSpend}
            onChange={(event) => setPowerSpend(event.target.value)}
          >
            <option value="">
              {selectedPower.targets
                ? "Минимум для цели"
                : 1 + selectedPower.tax + " Power"}
            </option>
            {Array.from(
              { length: selectedPower.maxPower },
              (_, i) => i + 1,
            ).map((amount) => (
              <option key={amount} value={amount}>
                {amount + selectedPower.tax}
              </option>
            ))}
          </select>
        </label>
      )}
      {selectedPower && !position && !selectedPower.targets && (
        <button
          disabled={busy}
          onClick={() =>
            command({
              type: "power",
              value: selectedPower.value,
              payer: currentPayer,
              ...(selectedPower.variableCost &&
                powerSpend && { amount: Number(powerSpend) }),
            })
          }
        >
          Применить
        </button>
      )}
      {selectedPower?.targets && (
        <div className="game-action-chips" aria-label="Цели способности">
          {powerTargets.map((t) => (
            <button
              key={t.value}
              disabled={busy}
              onClick={() => hitTarget(t.value)}
            >
              {t.label}
              {selectedPower.variableCost &&
                !powerSpend &&
                " · " + (t.minPower + selectedPower.tax) + " Power"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  const setup =
    state && state.phase !== "activation" && state.phase !== "finished";
  return (
    <div className="game-panel">
      <header className="game-titlebar">
        <div>
          <span className="game-eyebrow">MARVEL CRISIS PROTOCOL</span>
          <h1>Game</h1>
          <p
            className="game-match-status"
            role="status"
            data-side={state?.awaitingSide}
          >
            {matchStatus(state)}
          </p>
        </div>
        <div className="game-title-tools">
          <button aria-pressed={feedback.sound} onClick={feedback.toggleSound}>
            Звук {feedback.sound ? "вкл." : "выкл."}
          </button>
          {state && state.phase !== "finished" && (
            <details className="game-match-menu">
              <summary>Матч</summary>
              {state.controllers[side] === "cli" && (
                <button
                  disabled={busy}
                  onClick={() => command({ type: "take" })}
                >
                  Вернуть управление
                </button>
              )}
              {confirmFinish ? (
                <>
                  <button
                    disabled={busy}
                    onClick={() => mutate("finish", { id: state.id })}
                  >
                    Завершить без результата
                  </button>
                  <button onClick={() => setConfirmFinish(false)}>
                    Продолжить матч
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmFinish(true)}>
                  Завершить матч
                </button>
              )}
            </details>
          )}
        </div>
      </header>
      {error && (
        <p className="game-alert" role="alert">
          {error}
        </p>
      )}
      {!catalog && !error && <p>Подключение к локальному движку…</p>}
      {catalog && (!state || state.phase === "finished") && (
        <RosterSetup
          catalog={catalog}
          records={library.snapshot.rosters}
          onStart={(rosters) =>
            mutate("new", { ...rosters, replace: state?.id })
          }
        />
      )}
      {state && (
        <div className="game-workspace">
          <Scoreboard
            state={state}
            side={side}
            phase={phase}
            disabled={busy}
            onSide={(value) => {
              setSide(value);
              clearSelection();
            }}
          />
          <div className="game-layout">
            <section className="game-stage" aria-label="Поле боя">
              <div className="game-stage-head">
                <div>
                  <span className="game-eyebrow">
                    {state.threat ? state.threat + " THREAT" : "36 × 36"}
                  </span>
                  <h2>{phase}</h2>
                </div>
                <span
                  className="game-turn-badge"
                  data-side={state.awaitingSide}
                >
                  {state.awaitingSide
                    ? "Ход " + state.awaitingSide.toUpperCase()
                    : state.phase === "finished"
                      ? "Матч закрыт"
                      : "Выбор сторон"}
                </span>
              </div>
              <Board
                state={state}
                catalog={catalog}
                aim={direction ? null : boardAim}
                rangePreview={
                  rangePreview?.fighter === focused?.id ? rangePreview : null
                }
                direction={busy ? null : direction}
                onDirection={(angle) =>
                  command({ type: direction.type, angle })
                }
                frames={feedback.frames}
                quickActions={
                  !busy && (attack?.attacks.length || powers.length)
                    ? { attacks: attack?.attacks || [], powers }
                    : null
                }
                onQuickAttack={(option, id) => chooseAttack(option, option, id)}
                onQuickPower={(power, id) => choosePower(power.value, id)}
                targetIds={targetIds}
                onTarget={hitTarget}
                onAngle={(angle) => {
                  if (aim?.shape === "beam")
                    setAim((current) =>
                      current?.shape === "beam" &&
                      Math.round(current.angle) !== Math.round(angle)
                        ? { ...current, angle }
                        : current,
                    );
                }}
                onFire={(angle) => {
                  if (attackOption?.shape === "beam") fire(undefined, angle);
                }}
                onInspect={inspect}
                onActivate={activate}
                position={busy ? null : position}
                side={side}
                mode={busy ? null : mode}
                selected={deployFighter || position?.mover || state.active}
                onDrop={command}
              />
            </section>
            <div className="game-sideboard">
              <section
                className="game-prompt game-turn-controls"
                aria-label="Управление ходом"
              >
                <div
                  className="game-last-action"
                  role="status"
                  aria-live="polite"
                >
                  <span className="game-eyebrow">
                    {latest?.side
                      ? latest.side.toUpperCase() + " · СОБЫТИЕ"
                      : "СОБЫТИЕ"}
                  </span>
                  <strong>
                    {pending
                      ? "Ответ на атаку · " +
                        (fighters.find((f) => f.id === pending.target)?.name ||
                          "")
                      : latest?.text || phase}
                  </strong>
                </div>
                <div className="game-action-chips">
                  {state.active && (
                    <output className="game-action-count">
                      Осталось действий <strong>{state.actionsLeft}</strong>
                    </output>
                  )}
                  {["advance", "climb"]
                    .filter(
                      (type) =>
                        grantedMove || ownActions.some((a) => a.type === type),
                    )
                    .map((type) => (
                      <button
                        key={type}
                        disabled={busy}
                        aria-pressed={moveMode === type && !selectable}
                        onClick={() => {
                          clearSelection();
                          setMoveMode(type);
                        }}
                      >
                        {labels[type]}
                      </button>
                    ))}
                  {ownActions.some((a) => a.type === "undo") && (
                    <button
                      ref={undoButton}
                      aria-keyshortcuts="Control+Z Meta+Z"
                      disabled={busy}
                      onClick={() => command({ type: "undo" })}
                    >
                      Отменить
                    </button>
                  )}
                  {state.active &&
                    state.decisionSide === side &&
                    (shake?.options.length > 1 ? (
                      <details className="game-shake-menu">
                        <summary>Shake</summary>
                        {shake.options.map(({ value, label }) => (
                          <button
                            key={value}
                            disabled={busy}
                            onClick={() => command({ type: "shake", value })}
                          >
                            Снять {label}
                          </button>
                        ))}
                      </details>
                    ) : (
                      <button
                        disabled={busy || !shake}
                        onClick={() =>
                          command({
                            type: "shake",
                            value: shake.options[0].value,
                          })
                        }
                      >
                        Shake
                      </button>
                    ))}
                  {ownActions.some((a) => a.type === "pass") && (
                    <button
                      disabled={busy}
                      title="Передать ход, сохранив активацию бойца"
                      onClick={() => command({ type: "pass" })}
                    >
                      {labels.pass}
                    </button>
                  )}
                  {ownActions.some((a) => a.type === "end") && (
                    <button
                      className="game-primary"
                      disabled={busy}
                      onClick={() => command({ type: "end" })}
                    >
                      Завершить ход
                    </button>
                  )}
                </div>
                <TeamStrip
                  fighters={fighters}
                  selected={focused?.id}
                  active={state.active}
                  catalog={catalog}
                  ready={ready}
                  onFighter={(id) => {
                    inspect(id);
                    activate(id);
                  }}
                />
              </section>
              {(setup ||
                commandButtons.length > 0 ||
                modifier ||
                volley ||
                interact ||
                (displacement && !positionEffect) ||
                (position && !selectedPower)) && (
                <section
                  className="game-prompt game-match-prompt"
                  aria-label="Действия матча"
                >
                  <span className="game-eyebrow">
                    {setup ? "ПОДГОТОВКА" : "РЕШЕНИЕ"}
                  </span>
                  {state.committed[side] && (
                    <p>Выбор принят. Ждём вторую сторону.</p>
                  )}
                  {setup && state.roll && (
                    <div className="game-dice-line">
                      {sides.map((p) => (
                        <div key={p}>
                          <strong>{p.toUpperCase()}</strong>
                          {state.roll.dice[p].map((value, i) => (
                            <GameDie key={i} value={value} />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  {commandButtons.length > 0 && (
                    <div className="game-action-chips">{commandButtons}</div>
                  )}
                  {deploy && (
                    <label>
                      Расставить{" "}
                      <select
                        value={deployFighter}
                        onChange={(event) => setSelected(event.target.value)}
                      >
                        {deploy.fighters.map((id) => (
                          <option key={id} value={id}>
                            {fighters.find((f) => f.id === id).name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {ownActions.some((action) => action.type === "squad") && (
                    <SquadForm
                      key={state.id + side}
                      roster={state.rosters[side]}
                      catalog={catalog}
                      maximum={state.threat}
                      onSubmit={command}
                    />
                  )}
                  {direction && (
                    <p>
                      {direction.mode === "push" ? "Толчок" : "Бросок"} ·{" "}
                      {direction.name}. Выбери направление на поле.
                    </p>
                  )}
                  {modifier && (
                    <DiceMenu
                      key={modifier.id}
                      action={modifier}
                      rolls={effect?.resume?.rolls}
                      summary={state.attackRoll}
                      disabled={busy}
                      onCommand={command}
                    />
                  )}
                  {volley && (
                    <VolleyMenu
                      action={volley}
                      disabled={busy}
                      onCommand={command}
                    />
                  )}
                  {interact && (
                    <InteractMenu
                      key={"interact:" + state.active}
                      interacts={interact.interacts}
                      disabled={busy}
                      onCommand={command}
                    />
                  )}
                  {position && !selectedPower && (
                    <p>Выбери подсвеченную точку на поле.</p>
                  )}
                </section>
              )}
              <GameTabs
                value={tab}
                onChange={(value) => {
                  setRangePreview(null);
                  setTab(value);
                }}
                panels={{
                  fighter: (
                    <FighterPanel
                      fighter={focused}
                      attackOptions={
                        focused?.id === state.active
                          ? attack?.attacks || []
                          : []
                      }
                      powers={focused?.id === state.active ? powers : []}
                      aim={aim}
                      chosenPower={chosenPower}
                      onAttack={(card, option) =>
                        chooseAttack(card, option, focused.id)
                      }
                      onAttackHover={(card, option) =>
                        setRangePreview(
                          card
                            ? {
                                fighter: focused.id,
                                range: attackRange(card, option),
                                origin: option?.origin || focused.projection,
                              }
                            : null,
                        )
                      }
                      onPower={(card) => choosePower(card.name, focused.id)}
                      onPowerHover={(preview) =>
                        setRangePreview(
                          preview && {
                            ...preview,
                            fighter: focused.id,
                            origin: focused.projection,
                          },
                        )
                      }
                    >
                      {control}
                    </FighterPanel>
                  ),
                  mission: <MissionDetails catalog={catalog} state={state} />,
                  tactics: (
                    <GameTactics
                      key={state.id}
                      state={state}
                      catalog={catalog}
                      side={side}
                      playable={tactics?.cards || []}
                      busy={busy}
                      onCommand={command}
                    />
                  ),
                  journal: <ActionFeed state={state} />,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const GameWorkspace = observer(function GameWorkspace() {
  return ui.screen === "game" ? <GamePanel /> : null;
});
