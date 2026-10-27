import React, { useLayoutEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { rosters, catalog, actions } from "./stores/index.js";
import { RoleIcons } from "./character-roles.jsx";
import { Avatar, count } from "./common.jsx";
import { UIIcon } from "./ui-icons.jsx";

const PlannerNumber = observer(function PlannerNumber({ field, label, max }) {
  return (
    <label className="squad-number">
      <span>{label}</span>
      <input
        type="number"
        min="1"
        max={max}
        value={rosters.squads[field]}
        onChange={(e) => rosters.setSquadField(field, e.target.value)}
        onBlur={() => rosters.normalizeSquadField(field)}
      />
    </label>
  );
});
export const RosterSquads = observer(function RosterSquads() {
  const [controlsOpen, setControlsOpen] = useState(
    () => matchMedia("(min-width: 1000px)").matches,
  );
  const controlsToggle = useRef(null);
  const toggleControls = () => {
    setControlsOpen((open) => !open);
  };
  const editConditions = () => {
    setControlsOpen(true);
    controlsToggle.current?.scrollIntoView({ block: "start" });
    controlsToggle.current?.focus({ preventScroll: true });
  };
  const plan = rosters.squads,
    options = rosters.squadOptions;
  const result = rosters.squadVariants,
    group = result?.groups.find((g) => g.threat === options.threat);
  const candidates = rosters.squadCandidates.filter(Boolean),
    required = new Set(plan.required),
    excluded = new Set(plan.excluded),
    available = candidates.filter((c) => !excluded.has(c.slug)).length;
  const nearest = result?.groups
    .filter((g) => g.squads.length)
    .sort(
      (a, b) =>
        Math.abs(a.threat - options.threat) -
          Math.abs(b.threat - options.threat) || a.threat - b.threat,
    )[0];
  const list = useRef(null);
  const resetKey = JSON.stringify([
    rosters.draft?.id,
    options.min,
    options.from,
    options.to,
    options.threat,
    [...required].sort(),
    [...excluded].sort(),
    candidates.map((c) => [c.slug, c.threatLevel, c.alterEgo]),
  ]);
  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = 0;
  }, [resetKey]);
  return (
    <details
      data-ui-disclosure
      className="squad-planner"
      open={plan.open}
      onToggle={(e) => rosters.setSquadField("open", e.currentTarget.open)}
    >
      <summary>
        <span>Варианты отряда</span>
        <small>
          {options.threat} Threat · минимум {options.min} · обязательно{" "}
          {required.size} · исключено {excluded.size}
        </small>
      </summary>
      {plan.open && (
        <div className="squad-planner-body squad-layout">
          <section
            className="squad-controls"
            aria-label="Условия подбора отряда"
          >
            <div className="squad-controls-head">
              <button
                ref={controlsToggle}
                type="button"
                className="quiet squad-controls-toggle"
                aria-expanded={controlsOpen}
                aria-controls="squad-controls-body"
                onClick={toggleControls}
              >
                <span>
                  <strong>Условия отряда</strong>
                  <small>
                    Минимум {options.min} · {options.from}–{options.to} Threat
                  </small>
                </span>
                <UIIcon name="chevron" />
              </button>
              <button
                type="button"
                className="quiet squad-reset"
                onClick={rosters.resetSquadConditions}
              >
                Сбросить условия
              </button>
            </div>
            <div id="squad-controls-body" hidden={!controlsOpen}>
              <div className="squad-settings">
                <PlannerNumber
                  field="min"
                  label="Минимум персонажей"
                  max="10"
                />
                <PlannerNumber field="from" label="Threat: от" max="99" />
                <PlannerNumber field="to" label="Threat: до" max="99" />
              </div>
              <fieldset className="squad-required">
                <legend>Персонажи отряда</legend>
                <p>
                  Галочка — обязательно в каждом составе. «Исключить» — не
                  использовать в вариантах. Сам ростер не изменится.
                </p>
                {candidates.length ? (
                  <div className="squad-required-options">
                    {candidates.map((c) => (
                      <div
                        key={c.slug}
                        className={
                          "squad-candidate" +
                          (required.has(c.slug) ? " is-required" : "") +
                          (excluded.has(c.slug) ? " is-excluded" : "")
                        }
                      >
                        <label>
                          <input
                            type="checkbox"
                            checked={required.has(c.slug)}
                            data-squad-required={c.slug}
                            onChange={(e) =>
                              rosters.setSquadRequired(c.slug, e.target.checked)
                            }
                          />
                          <Avatar character={c} />
                          <span>
                            <strong>{c.name}</strong>
                            <small>{c.alterEgo}</small>
                          </span>
                          <b>{c.threatLevel} Threat</b>
                        </label>
                        <button
                          type="button"
                          className="squad-exclude"
                          data-squad-exclude={c.slug}
                          aria-label={
                            (excluded.has(c.slug)
                              ? "Вернуть в варианты: "
                              : "Исключить из вариантов: ") + c.name
                          }
                          aria-pressed={excluded.has(c.slug)}
                          onClick={() =>
                            rosters.setSquadExcluded(
                              c.slug,
                              !excluded.has(c.slug),
                            )
                          }
                        >
                          {excluded.has(c.slug) ? "Вернуть" : "Исключить"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    Добавь персонажей в ростер, чтобы увидеть варианты.
                  </p>
                )}
                {required.size > 0 && (
                  <button
                    type="button"
                    className="quiet"
                    onClick={rosters.clearSquadRequired}
                  >
                    Снять все закрепления
                  </button>
                )}
                {excluded.size > 0 && (
                  <button
                    type="button"
                    className="quiet"
                    onClick={rosters.clearSquadExcluded}
                  >
                    Снять все исключения
                  </button>
                )}
              </fieldset>
            </div>
          </section>
          <section className="squad-results" aria-label="Подходящие составы">
            <div className="squad-results-heading">
              <h3>Подходящие составы</h3>
              <button type="button" className="quiet" onClick={editConditions}>
                Изменить условия
              </button>
            </div>
            {(required.size > 0 || excluded.size > 0) && (
              <div
                className="squad-active-constraints"
                aria-label="Действующие ограничения отряда"
              >
                {[
                  [
                    "На стол",
                    required,
                    (slug) => rosters.setSquadRequired(slug, false),
                  ],
                  [
                    "Исключены",
                    excluded,
                    (slug) => rosters.setSquadExcluded(slug, false),
                  ],
                ].map(
                  ([label, slugs, clear]) =>
                    slugs.size > 0 && (
                      <div key={label}>
                        <span>{label}:</span>
                        {[...slugs].map((slug) => (
                          <button
                            key={slug}
                            type="button"
                            className="quiet"
                            aria-label={
                              (label === "На стол"
                                ? "Снять закрепление: "
                                : "Вернуть в подбор: ") +
                              catalog.byId.get(slug)?.name
                            }
                            onClick={() => clear(slug)}
                          >
                            {catalog.byId.get(slug)?.name}
                            <UIIcon name="close" />
                          </button>
                        ))}
                      </div>
                    ),
                )}
              </div>
            )}
            <p className="squad-explanation">
              Точная сумма Threat; минимум {options.min} персонажей.
              Закреплённые входят в каждый вариант.
            </p>
            {result?.errors.length > 0 ? (
              <div className="squad-error" role="alert">
                {result.errors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
                <button type="button" onClick={rosters.resetSquadConditions}>
                  Вернуть исходные условия
                </button>
              </div>
            ) : (
              <>
                <div
                  className="squad-threats"
                  role="group"
                  aria-label="Варианты по Threat"
                >
                  {result?.groups.map((g) => (
                    <button
                      type="button"
                      key={g.threat}
                      data-squad-threat={g.threat}
                      aria-pressed={g.threat === options.threat}
                      onClick={() => rosters.setSquadField("threat", g.threat)}
                    >
                      <strong>{g.threat} Threat</strong>
                      <span>
                        {count(
                          g.squads.length,
                          "вариант",
                          "варианта",
                          "вариантов",
                        )}
                      </span>
                    </button>
                  ))}
                </div>
                <p
                  className="squad-result-count"
                  role="status"
                  aria-live="polite"
                >
                  {group
                    ? `${group.threat} Threat: ${count(group.squads.length, "вариант", "варианта", "вариантов")}`
                    : "Выбери значение Threat"}
                </p>
                {group?.squads.length ? (
                  <>
                    <ol
                      id="roster-squad-variants"
                      ref={list}
                      className="squad-variants"
                    >
                      {group.squads
                        .slice(0, options.limit)
                        .map((squad, index) => (
                          <li key={squad.key} data-squad-variant={squad.key}>
                            <div className="squad-variant-head">
                              <span className="squad-row-number">
                                {index + 1}
                              </span>
                              <strong>
                                {count(
                                  squad.count,
                                  "персонаж",
                                  "персонажа",
                                  "персонажей",
                                )}
                              </strong>
                              <span>{squad.threat} Threat</span>
                            </div>
                            <RoleIcons
                              slugs={squad.slugs}
                              tactics={rosters.draft?.tactics}
                              context="squad"
                              owner={squad.key}
                              compact
                            />
                            <div className="squad-members">
                              {squad.slugs.map((slug) => {
                                const c = catalog.byId.get(slug);
                                return (
                                  <button
                                    type="button"
                                    key={slug}
                                    className={
                                      required.has(slug) ? "is-required" : ""
                                    }
                                    data-squad-member={slug}
                                    onClick={() => actions.openCharacter(slug)}
                                  >
                                    {required.has(slug) && (
                                      <span className="sr-only">
                                        Обязательный:{" "}
                                      </span>
                                    )}
                                    {c.name}
                                    <b>{c.threatLevel}</b>
                                  </button>
                                );
                              })}
                            </div>
                          </li>
                        ))}
                    </ol>
                    {group.squads.length > options.limit && (
                      <button
                        type="button"
                        className="squad-more"
                        onClick={rosters.moreSquads}
                      >
                        Показать ещё{" "}
                        {Math.min(30, group.squads.length - options.limit)}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="squad-empty">
                    <h3>Нет подходящих составов</h3>
                    <p>
                      {available < options.min
                        ? excluded.size
                          ? `После исключений доступно ${available} персонажей, а нужно минимум ${options.min}.`
                          : `В ростере ${candidates.length} персонажей, а нужно минимум ${options.min}.`
                        : `На ${options.threat} Threat составов с этими условиями нет. Попробуй другой Threat, уменьши минимум или сними часть закреплений.`}
                    </p>
                    <div className="squad-empty-actions">
                      {!candidates.length && (
                        <button
                          type="button"
                          onClick={() => rosters.openPicker("characters")}
                        >
                          Добавить персонажей
                        </button>
                      )}
                      {available > 0 && available < options.min && (
                        <button
                          type="button"
                          onClick={() =>
                            rosters.setSquadField("min", available)
                          }
                        >
                          Минимум{" "}
                          {count(
                            available,
                            "персонаж",
                            "персонажа",
                            "персонажей",
                          )}
                        </button>
                      )}
                      {nearest && (
                        <button
                          type="button"
                          onClick={() =>
                            rosters.setSquadField("threat", nearest.threat)
                          }
                        >
                          Показать {nearest.threat} Threat ·{" "}
                          {count(
                            nearest.squads.length,
                            "вариант",
                            "варианта",
                            "вариантов",
                          )}
                        </button>
                      )}
                      {excluded.size > 0 && (
                        <button
                          type="button"
                          onClick={rosters.clearSquadExcluded}
                        >
                          Вернуть всех исключённых
                        </button>
                      )}
                      {required.size > 0 && (
                        <button
                          type="button"
                          onClick={rosters.clearSquadRequired}
                        >
                          Убрать обязательных персонажей
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </details>
  );
});
