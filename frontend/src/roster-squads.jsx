import React, { useLayoutEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { rosters, catalog, actions } from "./stores/index.js";
import { Avatar, count } from "./common.jsx";

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
  const plan = rosters.squads,
    options = rosters.squadOptions;
  const result = rosters.squadVariants,
    group = result?.groups.find((g) => g.threat === options.threat);
  const candidates = rosters.squadCandidates.filter(Boolean),
    required = new Set(plan.required);
  const list = useRef(null);
  const resetKey = JSON.stringify([
    rosters.draft?.id,
    options.min,
    options.from,
    options.to,
    options.threat,
    [...required].sort(),
    candidates.map((c) => [c.slug, c.threatLevel, c.alterEgo]),
  ]);
  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = 0;
  }, [resetKey]);
  return (
    <details
      className="squad-planner"
      open={plan.open}
      onToggle={(e) => rosters.setSquadField("open", e.currentTarget.open)}
    >
      <summary>
        <span>Варианты отряда</span>
        <small>Threat · минимум персонажей · обязательные модели</small>
      </summary>
      {plan.open && (
        <div className="squad-planner-body">
          <div className="squad-settings">
            <PlannerNumber field="min" label="Минимум персонажей" max="10" />
            <PlannerNumber field="from" label="Threat: от" max="99" />
            <PlannerNumber field="to" label="Threat: до" max="99" />
          </div>
          <fieldset className="squad-required">
            <legend>Кого точно выставляю на стол</legend>
            <p>
              Все отмеченные персонажи войдут в каждый вариант. Подбираются
              только модели из текущего ростера.
            </p>
            {candidates.length ? (
              <div className="squad-required-options">
                {candidates.map((c) => (
                  <label
                    key={c.slug}
                    className={required.has(c.slug) ? "is-required" : ""}
                  >
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
          </fieldset>
          <p className="squad-explanation">
            Составы сгруппированы по точной сумме Threat с карточек. В каждом —
            не меньше {options.min} персонажей и все закреплённые модели.
          </p>
          {result?.errors.length > 0 ? (
            <div className="squad-error" role="alert">
              {result.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
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
                  {candidates.length < options.min
                    ? `В ростере ${candidates.length} персонажей, а нужно минимум ${options.min}.`
                    : `На ${options.threat} Threat составов с этими условиями нет. Попробуй другой Threat, уменьши минимум или сними часть закреплений.`}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </details>
  );
});
