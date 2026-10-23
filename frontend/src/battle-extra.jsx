import { RoleIcons } from "./character-roles.jsx";
import React, { useEffect, useRef, useMemo } from "react";
import { observer } from "mobx-react-lite";
import {
  battle as b,
  rosters,
  catalog,
  cardViews,
  ui,
  actions,
} from "./stores/index.js";
import { conditions } from "./stores/battle.js";
import { Counter, StateCycle } from "./battle.jsx";
import { Avatar } from "./common.jsx";
import {
  GameCard,
  StatSurface,
  StatControls,
  ConditionReference,
  Icon,
} from "./cards.jsx";
import { PeerSetup } from "./peer.jsx";
export function Priority({ value, onChange, id, disabled = false }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="unknown">Не указан</option>
      <option value="mine">{b.label("mine")}</option>
      <option value="opponent">{b.label("opponent")}</option>
    </select>
  );
}
export const MissionGrid = observer(function MissionGrid({ setup = false }) {
  const m = b.current;
  return (
    <div className="mission-grid">
      {[
        ["secure", "Secure"],
        ["extract", "Extract"],
      ].map(([kind, label]) => (
        <div key={kind} className="mission-choice" data-kind={kind}>
          <span className="eyebrow">{label}</span>
          {m[kind] ? (
            <>
              <button
                className="mission-title"
                data-bt="mission-card"
                data-kind={kind}
                onClick={() => b.mission(kind)}
              >
                {m[kind].name} ↗
              </button>
              <small>
                Threat {m[kind].threatLevel} · карта {m[kind].setup || "—"}
              </small>
            </>
          ) : (
            <p className="muted">Не указан</p>
          )}
          {setup && (
            <div className="actions">
              <button
                data-bt="missions"
                data-kind={kind}
                onClick={() => b.openPicker("opponent", "crises", kind)}
              >
                {m[kind] ? "Заменить" : "Выбрать"}
              </button>
              {m[kind] && (
                <button
                  className="quiet"
                  data-bt="clear-mission"
                  data-kind={kind}
                  onClick={() => b.clearMission(kind)}
                >
                  Убрать ×
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
});
export const Squad = observer(function Squad({ team, side }) {
  return (
    <div className="setup-squad">
      {team.fighters.map((f) => (
        <div key={f.id} className="setup-fighter">
          <div className="selected-character-main">
            <button
              className="selected-character"
              data-bt="fighter-card"
              data-id={f.id}
              onClick={() => b.fighterCard(f.id)}
            >
              <Avatar character={catalog.byId.get(f.slug)} />
              <span>
                <strong>{f.name}</strong>
                <small>
                  {f.alterEgo} · Threat {f.threat}
                  {f.affiliations.some((a) => a.name === team.affiliation)
                    ? " · Аффилирован"
                    : ""}
                </small>
              </span>
            </button>
            <RoleIcons slug={f.slug} compact />
          </div>
          <button
            className="quiet"
            data-bt="remove-fighter"
            data-id={f.id}
            data-side={side}
            aria-label={"Убрать " + f.name}
            onClick={() => b.removeFighter(f.id, side)}
          >
            ×
          </button>
        </div>
      ))}
      {!team.fighters.length && (
        <div className="empty">
          <p>
            {side === b.ownSide
              ? "Выберите бойцов из своего ростера."
              : "Можно играть без учёта бойцов противника."}
          </p>
        </div>
      )}
    </div>
  );
});
export const TacticStrip = observer(function TacticStrip({
  team,
  side,
  readonly = false,
  compact = false,
  scope = "play",
}) {
  if (!team.tactics.length)
    return <p className="muted battle-small">Тактики не указаны.</p>;
  return (
    <div
      className={"battle-tactics" + (compact ? "" : " battle-tactics-strip")}
      role={compact ? undefined : "region"}
      aria-label={"Тактики " + b.label(side) + " · горизонтальная лента"}
      tabIndex={compact ? undefined : 0}
    >
      {team.tactics.map((t) => {
        const card =
            t.card ||
            rosters.card("tactics", rosters.canonical("tactics", t.slug)) ||
            rosters.card("tactics", t.slug),
          action = t.played ? "Вернуть в руку" : "Отметить сыгранной";
        if (compact)
          return (
            <div
              key={t.slug}
              className={"battle-tactic" + (t.played ? " played" : "")}
            >
              <button
                className="quiet tactic-name"
                data-bt="tactic-card"
                data-side={side}
                data-slug={t.slug}
                onClick={() => b.tactic(side, t.slug)}
              >
                {t.name} ↗
              </button>
              <button
                className="quiet"
                data-bt="remove-tactic"
                data-side={side}
                data-slug={t.slug}
                aria-label={"Убрать тактику " + t.name}
                onClick={() => b.removeTactic(side, t.slug)}
              >
                ×
              </button>
            </div>
          );
        const corner = (
          <button
            type="button"
            className="battle-tactic-flip"
            data-bt="flip-tactic"
            data-side={side}
            data-slug={t.slug}
            aria-label={action + ": " + t.name}
            aria-pressed={!!t.played}
            title={action}
            disabled={readonly}
            onClick={() => b.flipTactic(side, t.slug)}
          >
            <span aria-hidden="true">{t.played ? "↶" : "↻"}</span>
          </button>
        );
        return (
          <article
            key={t.slug}
            id={`battle-tactic-${scope}-${side}-${t.slug}`}
            className={
              "battle-tactic battle-tactic-card" + (t.played ? " played" : "")
            }
            aria-label={t.name + " · " + (t.played ? "сыграна" : "в руке")}
          >
            <div className="battle-tactic-card-top">
              <span className="battle-tactic-status">
                {t.played ? "✓ Сыграна" : "В руке"}
              </span>
              <button
                type="button"
                className="quiet battle-tactic-enlarge"
                data-bt="tactic-card"
                data-side={side}
                data-slug={t.slug}
                aria-label={"Открыть крупно: " + t.name}
                title="Открыть крупно"
                onClick={() => b.tactic(side, t.slug)}
              >
                ↗
              </button>
            </div>
            <div className="gc-surface battle-tactic-surface">
              {card ? (
                <GameCard
                  card={card}
                  kind="tactics"
                  side={t.played ? "back" : "front"}
                  corner={corner}
                />
              ) : (
                <div className="battle-tactic-unavailable">
                  <strong>{t.name}</strong>
                  <p>Текст карты недоступен.</p>
                  {corner}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
});
export const SetupTeam = observer(function SetupTeam({ side }) {
  const m = b.current,
    team = m[side],
    n = team.fighters.filter((f) =>
      f.affiliations.some((a) => a.name === team.affiliation),
    ).length;
  return (
    <section className="setup-team">
      <div className="section-title">
        <h2>{b.label(side)}</h2>
        <span
          className={
            "tag" +
            (team.fighters.reduce((n, f) => n + f.threat, 0) > m.threat
              ? " missing-tag"
              : "")
          }
        >
          Threat {team.fighters.reduce((n, f) => n + f.threat, 0)} / {m.threat}
        </span>
      </div>
      <button
        className="squad-add"
        data-bt="pick"
        data-side={side}
        data-kind="characters"
        onClick={() => b.openPicker(side, "characters")}
      >
        {side === b.ownSide
          ? "Выбрать из моего ростера"
          : "Быстро выбрать бойцов и карты"}{" "}
        +
      </button>
      <RoleIcons
        slugs={team.fighters}
        tactics={team.tactics}
        leaderSlug={team.fighters.find((f) => f.id === team.leader)?.slug || ""}
        context="squad"
        owner={side}
      />
      <Squad team={team} side={side} />
      <label className="field">
        Аффилиация отряда
        <select
          data-battle-aff={side}
          value={team.affiliation}
          onChange={(e) => b.setAffiliation(side, e.target.value)}
        >
          <option value="">Без основной аффилиации</option>
          {catalog.affiliations.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <small>
          {team.affiliation
            ? `${n} из ${team.fighters.length} · ${n > team.fighters.length / 2 ? "большинство есть" : "нужно большинство"}`
            : "Без выбранной аффилиации"}
        </small>
      </label>
      <label className="field">
        Лидер
        <select
          data-battle-leader={side}
          value={team.leader || ""}
          onChange={(e) => b.setLeader(side, e.target.value)}
        >
          <option value="">Без лидерства</option>
          {team.fighters
            .filter((f) =>
              f.affiliations.some(
                (a) => a.name === team.affiliation && a.isLeader,
              ),
            )
            .map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.alterEgo}
              </option>
            ))}
        </select>
      </label>
      <div className="section-title">
        <h3>Тактики · {team.tactics.length} / 5</h3>
        <button
          data-bt="pick"
          data-side={side}
          data-kind="tactics"
          onClick={() => b.openPicker(side, "tactics")}
        >
          + Выбрать
        </button>
      </div>
      <TacticStrip team={team} side={side} compact />
    </section>
  );
});
export const BattleSetup = observer(function BattleSetup() {
  const m = b.current;
  if (b.activeNetwork) return <PeerSetup />;
  const problems = b.domain.Core.errors(m);
  return (
    <>
      <div className="heading">
        <div>
          <span className="eyebrow">09 / Подготовка боя</span>
          <h1>Собрать отряд</h1>
          <p>{m.name} · подготовка сохраняется автоматически.</p>
        </div>
        <div className="actions">
          <button data-bt="map" onClick={() => actions.openBattleMap()}>
            Карта и расстояния
          </button>
          <button data-bt="home" onClick={b.home}>
            ← К партиям
          </button>
        </div>
      </div>
      <div className="setup-fields">
        <label className="field">
          Название партии
          <input
            id="battle-name"
            maxLength={100}
            value={m.name}
            onChange={(e) => b.setName(e.target.value)}
          />
        </label>
        <label className="field">
          Противник
          <input
            id="battle-opponent-name"
            maxLength={60}
            placeholder="Имя или команда"
            value={m.opponent.name}
            onChange={(e) => b.setName(e.target.value, true)}
          />
        </label>
        <label className="field">
          Лимит Threat
          <input
            id="battle-threat"
            type="number"
            min="1"
            max="99"
            value={m.threat}
            onChange={(e) => b.setThreat(e.target.value)}
          />
        </label>
        <label className="field">
          Приоритет
          <Priority
            id="battle-priority"
            value={m.priority}
            onChange={b.setPriority}
          />
        </label>
      </div>
      <div className="section-title">
        <h3>Миссия</h3>
      </div>
      <MissionGrid setup />
      <div className="setup-columns">
        <SetupTeam side="mine" />
        <SetupTeam side="opponent" />
      </div>
      {problems.length > 0 && (
        <div className="notice" role="alert">
          {problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}
      <p className="battle-rule-note">
        Выберите бойцов и карты на эту партию. Энергия начнётся с 0; Power Phase
        рассчитает фиксированное начисление каждому бойцу. Прокси и неполный
        состав допустимы.
      </p>
      <div className="editor-footer">
        <span className="battle-small">Подготовка сохранена</span>
        <button
          className="primary"
          data-bt="start"
          disabled={!!problems.length || !!b.busy}
          onClick={b.start}
        >
          Начать бой →
        </button>
      </div>
    </>
  );
});
function Modal({ id, className, open, onClose, children, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      id={id}
      className={className}
      aria-label={label}
      ref={ref}
      onClose={(event) => {
        if (!event.currentTarget.open) onClose?.(event);
      }}
    >
      {children}
    </dialog>
  );
}
export const BattlePickerModal = observer(function BattlePickerModal() {
  const p = b.picker,
    m = b.current,
    rows = b.pickerRows;
  return (
    <Modal
      id="battle-picker-dialog"
      className="roster-picker-dialog"
      label="Выбор для партии"
      open={!!p && !!m}
      onClose={() => {
        if (b.picker) b.closePicker();
      }}
    >
      <div id="battle-picker-content">
        {p && m && (
          <>
            <div className="dialog-heading">
              <div>
                <h2>
                  {p.mission
                    ? "Выбрать " +
                      (p.mission === "secure" ? "Secure" : "Extract")
                    : b.label(p.side) === "Мои"
                      ? "Из моего ростера"
                      : "Бойцы и карты противника"}
                </h2>
                <p>
                  {p.mission
                    ? "Укажите реальную миссию партии. Можно выбрать карту любого игрока."
                    : "Отмечайте несколько позиций подряд. Состав сохраняется сразу."}
                </p>
              </div>
              <button
                className="quiet close"
                data-bt="close-picker"
                aria-label="Закрыть выбор для партии"
                onClick={b.closePicker}
              >
                ×
              </button>
            </div>
            {!p.mission && (
              <div className="editor-tabs">
                {[
                  ["characters", "Персонажи"],
                  ["tactics", "Тактики"],
                ].map(([kind, label]) => (
                  <button
                    key={kind}
                    data-bt="picker-tab"
                    data-kind={kind}
                    className={p.kind === kind ? "selected" : ""}
                    onClick={() => b.pickerTab(kind)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="picker-tools">
              <input
                id="battle-picker-search"
                className="picker-search"
                type="search"
                placeholder="Поиск по началу слова…"
                aria-label="Поиск для партии"
                value={p.query}
                onChange={(e) => b.setPicker("query", e.target.value)}
              />
              <div className="picker-filters">
                {p.kind !== "crises" && (
                  <select
                    id="battle-picker-aff"
                    aria-label="Аффилиация для партии"
                    value={p.affiliation}
                    onChange={(e) => b.setPicker("affiliation", e.target.value)}
                  >
                    <option value="">Все аффилиации</option>
                    {catalog.affiliations.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                )}
                {p.kind === "characters" ? (
                  <label className="check">
                    <input
                      id="battle-picker-owned"
                      type="checkbox"
                      checked={p.owned}
                      onChange={(e) => b.setPicker("owned", e.target.checked)}
                    />
                    Есть у меня
                  </label>
                ) : (
                  <label className="check">
                    <input
                      id="battle-picker-available"
                      type="checkbox"
                      checked={p.available}
                      onChange={(e) =>
                        b.setPicker("available", e.target.checked)
                      }
                    />
                    Доступные в Standard
                  </label>
                )}
              </div>
            </div>
            <div className="picker-summary">
              <span>{rows.length} найдено</span>
              <span>
                {p.mission
                  ? ""
                  : `Threat ${m[p.side].fighters.reduce((n, f) => n + f.threat, 0)} / ${m.threat} · тактики ${m[p.side].tactics.length} / 5`}
              </span>
            </div>
            <div className="picker-results">
              {rows.map((c) => {
                const pendingKey = p.side + ":" + p.kind + ":" + c.slug;
                const checked = b.pendingPicks.has(pendingKey)
                  ? b.pendingPicks.get(pendingKey)
                  : p.mission
                    ? m[p.mission]?.slug === c.slug
                    : p.kind === "characters"
                      ? m[p.side].fighters.some((f) => f.slug === c.slug)
                      : m[p.side].tactics.some((t) => t.slug === c.slug);
                return (
                  <div
                    key={c.slug}
                    className={"picker-result" + (checked ? " chosen" : "")}
                  >
                    <label className="check picker-check">
                      <input
                        type={p.mission ? "radio" : "checkbox"}
                        name="battle-mission"
                        data-battle-pick={c.slug}
                        checked={checked}
                        disabled={!!b.busy}
                        onChange={(e) => b.pick(c.slug, e.target.checked)}
                      />
                      {p.kind === "characters" ? (
                        <Avatar character={c} />
                      ) : (
                        <span className="card-symbol">
                          {p.kind === "tactics"
                            ? "TT"
                            : p.mission === "secure"
                              ? "S"
                              : "E"}
                        </span>
                      )}
                      <span>
                        <strong>{c.name}</strong>
                        <small>
                          {p.kind === "characters"
                            ? `${c.alterEgo} · Threat ${c.threatLevel} · ${b.library.owned.has(c.slug) ? "Есть у меня" : "Нет в коллекции"}`
                            : p.kind === "tactics"
                              ? c.affiliation?.name || "Без аффилиации"
                              : `Threat ${c.threatLevel} · карта ${c.setup || "—"}`}
                        </small>
                      </span>
                    </label>
                    <button
                      className="quiet"
                      data-bt="picker-card"
                      data-slug={c.slug}
                      aria-label={"Посмотреть " + c.name}
                      onClick={() =>
                        p.kind === "characters"
                          ? actions.openCharacter(c.slug)
                          : b.game(c, p.kind)
                      }
                    >
                      ↗
                    </button>
                  </div>
                );
              })}
              {!rows.length && (
                <div className="empty">
                  <p>
                    {p.side === "mine" && !p.query
                      ? "В ростере нет подходящих позиций. Добавьте их в редакторе ростера перед подготовкой новой партии."
                      : "Ничего не найдено. Измените запрос или фильтры."}
                  </p>
                </div>
              )}
            </div>
            <div className="picker-footer">
              <span>
                {b.busy
                  ? "Загружаем карту…"
                  : "Выбор сохраняется в этой партии."}
              </span>
              <button
                className="primary"
                data-bt="close-picker"
                disabled={!!b.busy}
                onClick={b.closePicker}
              >
                Готово
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
});
const PowerPreview = observer(function PowerPreview({ match }) {
  const preview = b.domain.Phase.calculate(match).rows;
  return (
    <div className="power-preview">
      {["mine", "opponent"].map((side) => (
        <section key={side} className="power-preview-team">
          <h3>{b.label(side)}</h3>
          {preview
            .filter((row) => row.side === side)
            .map((row) => {
              const f = b.domain.Core.allFighters(match).find(
                (f) => f.id === row.id,
              );
              return (
                <div key={row.id} className="power-preview-row">
                  <Avatar character={catalog.byId.get(f.slug)} />
                  <div className="power-preview-copy">
                    <strong>{row.name}</strong>
                    <div className="power-reasons">
                      {row.steps.map((step, i) => (
                        <span key={i}>
                          {step.label}{" "}
                          <b>
                            {step.amount > 0 ? "+" : ""}
                            {step.amount}
                          </b>
                        </span>
                      ))}
                    </div>
                    {row.notes.map((note, i) => (
                      <small key={i}>{note}</small>
                    ))}
                  </div>
                  <span
                    className="power-result"
                    aria-label={"Энергия " + row.name}
                  >
                    {row.before} → <b>{row.after}</b>
                  </span>
                </div>
              );
            })}
        </section>
      ))}
    </div>
  );
});
const FighterDetail = observer(function FighterDetail() {
  const d = b.dialog,
    m = b.current,
    f = b.fighter(d.id),
    state = b.domain.State.describe(m, f),
    form = d.followActual ? f.form : d.form,
    side = d.followActual ? f.face : d.side,
    live = form === f.form && side === f.face,
    team = m.mine.fighters.some((item) => item.id === f.id)
      ? "mine"
      : "opponent",
    model = b.model(m, f),
    own = b.ownSide,
    sides = [own, own === "mine" ? "opponent" : "mine"];
  const view = useMemo(
    () => ({
      key: "battle",
      slug: f.slug,
      detail: m.references[f.slug],
      form,
      side,
      battle: live ? state : null,
      controlsOutside: true,
    }),
    [m, f, form, side, live],
  );
  const strip = useRef(null);
  useEffect(() => {
    const el = strip.current,
      selected = el?.querySelector(".battle-character-portrait.selected");
    if (!el || !selected) return;
    const rect = selected.getBoundingClientRect(),
      bounds = el.getBoundingClientRect();
    if (rect.left < bounds.left) el.scrollLeft += rect.left - bounds.left;
    else if (rect.right > bounds.right)
      el.scrollLeft += rect.right - bounds.right;
  }, [f.id]);
  return (
    <>
      <div className="dialog-heading battle-character-heading">
        <div>
          <h2>{f.name}</h2>
          <p>
            {f.alterEgo} · {b.label(team)}
          </p>
        </div>
        <button
          className="calculator-open"
          onClick={() => {
            cardViews.showCalculator(f.slug, {
              form,
              side,
              damage: Math.max(0, f.maxHp - f.hp),
              conditions: f.conditions || [],
            });
          }}
        >
          <i className="fa-solid fa-calculator" aria-hidden="true" />{" "}
          Калькулятор
        </button>
        <div className="battle-card-header-controls" data-card-view="battle">
          <StatControls
            view={view}
            onSwitch={(field, value) =>
              b.preview(
                field === "form" ? value : form,
                field === "form" ? "front" : value,
              )
            }
          />
        </div>
        <button
          className="quiet close"
          data-bt="close-dialog"
          aria-label="Закрыть окно партии"
          onClick={b.closeDialog}
        >
          ×
        </button>
      </div>
      <section
        className="battle-character-state"
        aria-label="Текущее состояние персонажа"
      >
        <div className="battle-character-resources">
          <span
            className={"battle-resource" + (f.hp !== f.maxHp ? " changed" : "")}
          >
            HP{" "}
            <b>
              {f.hp}/{f.maxHp}
            </b>
          </span>
          <span className="battle-resource">
            <Icon name="power" />
            <b>{f.power}</b>
          </span>
          <StateCycle
            fighter={f}
            plan={model.plan}
            disabled={m.status !== "active"}
          />
          {model.forms.length > 0 && (
            <label className="fighter-form-control">
              <span>Форма</span>
              <select
                data-battle-fighter-form={f.id}
                aria-label={"Форма в бою " + f.name}
                value={f.form}
                disabled={m.status !== "active"}
                onChange={(e) => b.changeForm(f.id, Number(e.target.value))}
              >
                {model.forms.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {model.reverse.length > 0 && (
            <label className="fighter-form-control">
              <span>Сторона</span>
              <select
                data-battle-fighter-face={f.id}
                aria-label={"Сторона в бою " + f.name}
                value={f.face}
                disabled={m.status !== "active"}
                onChange={(e) => b.changeForm(f.id, null, e.target.value)}
              >
                {model.reverse.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {f.acted && <span className="tag">✓ Походил</span>}
          {m.status === "finished" && <span className="tag">Бой завершён</span>}
        </div>
        <div className="battle-character-conditions">
          {f.conditions.map((condition) => (
            <ConditionReference
              key={condition}
              condition={condition.toLowerCase()}
              className={
                "battle-condition-chip" +
                (state.immuneConditions.includes(condition) ? " immune" : "")
              }
            >
              {condition}
              {state.immuneConditions.includes(condition) ? " · иммунитет" : ""}
            </ConditionReference>
          ))}
          {!f.conditions.length && (
            <span className="battle-small">Без особых состояний</span>
          )}
        </div>
      </section>
      <div key={f.id} className="battle-character-scroll">
        <div className="battle-character-view" data-fighter={f.id}>
          {!live && (
            <div className="battle-card-preview-note">
              <span>Просмотр другой стороны или формы</span>
              <button
                type="button"
                data-bt="fighter-current"
                onClick={b.followFighter}
              >
                К текущей карте
              </button>
            </div>
          )}
          <StatSurface view={view} />
          <p className="stat-card-view-note">
            {live
              ? "Красным — изменённые HP, характеристики и стоимость. Наведи на значение, чтобы увидеть причину."
              : "Здесь показаны печатные значения выбранной карты."}{" "}
            Переворот для просмотра не меняет бойца.
          </p>
          <div className="source-line">
            <a
              href={catalog.byId.get(f.slug).sourceUrl}
              target="_blank"
              rel="noopener"
            >
              Карточка на Jarvis ↗
            </a>
          </div>
        </div>
      </div>
      <nav className="battle-fighter-strip" aria-label="Персонажи боя">
        <div className="battle-fighter-strip-scroll" ref={strip}>
          {sides.map((side) => (
            <section
              key={side}
              className="battle-portrait-team"
              data-side={side}
              data-own={side === own}
              aria-label={b.label(side)}
            >
              <h3>{b.label(side)}</h3>
              <div className="battle-portrait-row">
                {m[side].fighters.map((other) => (
                  <button
                    key={other.id}
                    type="button"
                    id={"battle-portrait-" + other.id}
                    className={
                      "battle-character-portrait" +
                      (f.id === other.id ? " selected" : "")
                    }
                    data-bt="fighter-card"
                    data-id={other.id}
                    aria-pressed={f.id === other.id}
                    aria-label={b.label(side) + ": " + other.name}
                    title={`${other.name} · ${other.alterEgo} · HP ${other.hp}/${other.maxHp}`}
                    onClick={() => b.fighterCard(other.id)}
                  >
                    <Avatar character={catalog.byId.get(other.slug)} />
                    <span className="battle-portrait-name">{other.name}</span>
                    {other.status !== "ready" && (
                      <span
                        className={"battle-portrait-status " + other.status}
                      >
                        {other.status === "ko" ? "KO" : "D"}
                      </span>
                    )}
                  </button>
                ))}
                {!m[side].fighters.length && (
                  <span className="battle-small">Нет бойцов</span>
                )}
              </div>
            </section>
          ))}
        </div>
      </nav>
    </>
  );
});
export const BattleDialogModal = observer(function BattleDialogModal() {
  const d = b.dialog,
    m = b.current,
    f = d?.id && m ? b.fighter(d.id) : null;
  const titles = {
    "choose-roster": "Мой ростер",
    conditions: "Состояния",
    objectives: "Цели у бойца",
    missions: "Миссии и карты",
    log: "Журнал партии",
    round: `Начать раунд ${(m?.round || 0) + 1}?`,
    power: "Power Phase · раунд " + m?.round,
    remove: "Убрать бойца из партии?",
    finish: "Завершить партию?",
  };
  const descriptions = {
    "choose-roster":
      "Выберите сохранённый состав. Неполный ростер тоже подходит.",
    conditions: (f?.name || "") + " · отметьте или снимите жетоны.",
    objectives: f?.name,
    missions: "Карты и бойцы относятся только к этой партии.",
    log: "Последние 200 событий. ↶ отменяет последние 30 действий.",
    round: "Проверьте Cleanup и начисленные VP перед переходом.",
    power: "Энергия рассчитывается отдельно для каждого бойца.",
    remove:
      (f?.name || "") +
      " · его текущие HP, энергия и состояния исчезнут из состава.",
    finish: m
      ? `${m.name} · ${m.score.mine} : ${m.score.opponent} · раунд ${m.round}`
      : "",
  };
  const preview = useMemo(() => {
    if (d?.type !== "round" || !m) return null;
    const next = b.domain.Core.clone(m);
    b.domain.Core.nextRound(next);
    return next;
  }, [d?.type, m]);
  const already =
    m && (m.powerPhaseRound === m.round || m.basePowerRound === m.round);
  return (
    <Modal
      id="battle-dialog"
      className={
        "battle-dialog" +
        (d?.type === "fighter" ? " battle-character-dialog" : "")
      }
      label="Партия"
      open={!!d && (d.type === "choose-roster" || !!m)}
      onClose={() => {
        if (b.dialog) b.closeDialog();
      }}
    >
      <div id="battle-dialog-content">
        {d &&
          (d.type === "fighter" && f ? (
            <FighterDetail />
          ) : (
            <>
              <div className="dialog-heading">
                <div>
                  <h2>{titles[d.type]}</h2>
                  <p>{descriptions[d.type]}</p>
                </div>
                <button
                  className="quiet close"
                  data-bt="close-dialog"
                  aria-label="Закрыть окно партии"
                  onClick={b.closeDialog}
                >
                  ×
                </button>
              </div>
              {d.type === "choose-roster" &&
                (rosters.records.length ? (
                  <div className="battle-roster-choices">
                    {rosters.records.map((r) => (
                      <button
                        key={r.id}
                        data-bt="prepare"
                        data-roster={r.id}
                        onClick={() => b.prepare(r.id)}
                      >
                        <span>
                          <strong>{r.name}</strong>
                          <small>
                            {r.affiliation || "Без аффилиации"} ·{" "}
                            {r.characters.length} персонажей ·{" "}
                            {r.tactics.length} тактик
                          </small>
                        </span>
                        <span>→</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty">
                    <h3>Сначала нужен ростер</h3>
                    <p>
                      Создайте состав в разделе «Ростеры», затем выберите отряд
                      на партию.
                    </p>
                    <button
                      className="primary"
                      data-bt="make-roster"
                      onClick={() => {
                        b.closeDialog();
                        rosters.open();
                      }}
                    >
                      Создать ростер →
                    </button>
                  </div>
                ))}
              {d.type === "conditions" && f && (
                <>
                  <div className="condition-grid">
                    {conditions.map(([name, label]) => (
                      <button
                        key={name}
                        data-bt="condition"
                        data-id={f.id}
                        data-condition={name}
                        aria-pressed={f.conditions.includes(name)}
                        className={
                          f.conditions.includes(name) ? "selected" : ""
                        }
                        onClick={() => b.condition(f.id, name)}
                      >
                        {f.conditions.includes(name) ? "✓" : "○"} {name}
                        <small>{label}</small>
                      </button>
                    ))}
                  </div>
                  <div className="fighter-immunities">
                    <span>Иммунен:</span>
                    {b.domain.Phase.immunities(m, f).map((name) => (
                      <span key={name} className="tag">
                        {name === "Special Conditions"
                          ? "Все особые состояния"
                          : name}
                      </span>
                    ))}
                  </div>
                  <form
                    id="battle-condition-form"
                    data-id={f.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      b.addCondition(f.id);
                    }}
                  >
                    <label className="field">
                      Другое состояние
                      <input
                        name="condition"
                        maxLength={40}
                        placeholder="Название жетона"
                        value={b.customCondition}
                        onChange={(e) => b.setCustomCondition(e.target.value)}
                      />
                    </label>
                    <button type="submit">Добавить</button>
                  </form>
                  <div className="fighter-conditions">
                    {f.conditions
                      .filter((c) => !conditions.some(([name]) => name === c))
                      .map((c) => (
                        <button
                          key={c}
                          data-bt="condition"
                          data-id={f.id}
                          data-condition={c}
                          onClick={() => b.condition(f.id, c)}
                        >
                          {c} ×
                        </button>
                      ))}
                  </div>
                  <p className="battle-rule-note">
                    В Power Phase Poison, Stun и иммунитеты учитываются
                    автоматически.
                  </p>
                </>
              )}
              {d.type === "objectives" && f && (
                <>
                  <p className="battle-rule-note">
                    Число жетонов, которые несёт персонаж. VP начисляются
                    отдельно.
                  </p>
                  <Counter
                    value={f.objectives}
                    label={"цели " + f.name}
                    action="objective-counter"
                    attributes={{ "data-id": f.id }}
                    minusDisabled={f.objectives === 0}
                    plusDisabled={f.objectives === 20}
                  />
                  <button
                    className="primary"
                    data-bt="close-dialog"
                    onClick={b.closeDialog}
                  >
                    Готово
                  </button>
                </>
              )}
              {d.type === "missions" && m && (
                <>
                  <MissionGrid setup={m.status !== "finished"} />
                  {["mine", "opponent"].map((side) => (
                    <React.Fragment key={side}>
                      <h3>{b.label(side)}: тактики</h3>
                      <TacticStrip
                        team={m[side]}
                        side={side}
                        readonly={m.status === "finished"}
                        scope="missions"
                      />
                    </React.Fragment>
                  ))}
                  {m.status !== "finished" && (
                    <button
                      data-bt="pick"
                      data-side="opponent"
                      data-kind="tactics"
                      onClick={() => b.openPicker("opponent", "tactics")}
                    >
                      Изменить карты противника +
                    </button>
                  )}
                </>
              )}
              {d.type === "log" && m && (
                <div className="battle-log">
                  {m.log
                    .slice()
                    .reverse()
                    .map((entry, i) => (
                      <p key={i}>
                        <small>
                          Раунд {entry.round} ·{" "}
                          {new Date(entry.at).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                        <span>{entry.text}</span>
                      </p>
                    ))}
                  {!m.log.length && <p>Пока нет событий.</p>}
                </div>
              )}
              {d.type === "round" && m && (
                <>
                  {b.domain.Core.allFighters(m).some(
                    (f) => f.status === "ready" && !f.acted,
                  ) && (
                    <div className="notice">
                      Ещё могут активироваться:{" "}
                      {b.domain.Core.allFighters(m)
                        .filter((f) => f.status === "ready" && !f.acted)
                        .map((f) => f.name)
                        .join(", ")}
                      .
                    </div>
                  )}
                  <ul className="round-plan">
                    <li>Снять отметки «Походил» у всех бойцов.</li>
                    {b.domain.Core.roundPlan(m).map((p, i) => (
                      <li key={i}>
                        {p.name}:{" "}
                        {p.action === "injured"
                          ? `Injured, HP ${p.hp}, убрать состояния`
                          : "KO · нет доступной стороны Injured"}
                        .
                      </li>
                    ))}
                    <li>Остальные HP, условия, цели и тактики сохранить.</li>
                  </ul>
                  <label className="field">
                    Приоритет следующего раунда
                    <Priority
                      id="round-priority"
                      value={b.roundPriority}
                      onChange={b.setRoundPriority}
                    />
                  </label>
                  <label className="check">
                    <input
                      id="round-power"
                      type="checkbox"
                      checked={b.roundPower}
                      onChange={(e) => b.setRoundPower(e.target.checked)}
                    />
                    Рассчитать Power Phase нового раунда
                  </label>
                  <div id="round-power-preview" hidden={!b.roundPower}>
                    {preview && <PowerPreview match={preview} />}
                  </div>
                  <p className="battle-rule-note">
                    Фиксированные бонусы, Poison, Stun и иммунитеты учтены в
                    расчёте. Приоритет выбираете вы.
                  </p>
                  <div className="actions">
                    <button data-bt="close-dialog" onClick={b.closeDialog}>
                      Вернуться в бой
                    </button>
                    <button
                      className="primary"
                      data-bt="confirm-round"
                      data-round={m.round}
                      onClick={b.advance}
                    >
                      Начать раунд {m.round + 1}
                    </button>
                  </div>
                </>
              )}
              {d.type === "power" && m && (
                <>
                  {already && (
                    <div className="notice">
                      В этом раунде энергия уже начислялась. Повторное
                      применение начислит её ещё раз.
                    </div>
                  )}
                  <PowerPreview match={m} />
                  <p className="battle-rule-note">
                    Учтены фиксированные бонусы текущей стороны карты,
                    действующее фиксированное лидерство, Poison, Stun и
                    иммунитеты.
                  </p>
                  {already && (
                    <label className="check">
                      <input
                        id="power-repeat"
                        type="checkbox"
                        checked={b.powerRepeat}
                        onChange={(e) => b.setPowerRepeat(e.target.checked)}
                      />
                      Применить повторно в этом раунде
                    </label>
                  )}
                  <div className="actions">
                    <button data-bt="close-dialog" onClick={b.closeDialog}>
                      Отмена
                    </button>
                    <button
                      className="primary"
                      data-bt="confirm-power"
                      data-round={m.round}
                      disabled={already && !b.powerRepeat}
                      onClick={b.power}
                    >
                      Применить расчёт
                    </button>
                  </div>
                </>
              )}
              {d.type === "remove" && f && (
                <div className="actions">
                  <button data-bt="close-dialog" onClick={b.closeDialog}>
                    Отмена
                  </button>
                  <button
                    className="primary"
                    data-bt="confirm-remove"
                    data-id={f.id}
                    data-side={d.side}
                    onClick={() => b.removeFighter(f.id, d.side, true)}
                  >
                    Убрать бойца
                  </button>
                </div>
              )}
              {d.type === "finish" && m && (
                <>
                  <p className="battle-rule-note">
                    Партия останется в истории вместе с бойцами, картами и
                    журналом.
                  </p>
                  <p id="battle-finish-error" role="alert">
                    {b.error}
                  </p>
                  <div className="actions">
                    <button data-bt="close-dialog" onClick={b.closeDialog}>
                      Продолжить бой
                    </button>
                    <button
                      className="primary"
                      data-bt="confirm-finish"
                      onClick={b.finish}
                    >
                      Завершить и сохранить
                    </button>
                  </div>
                </>
              )}
            </>
          ))}
      </div>
    </Modal>
  );
});
