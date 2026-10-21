import React, { memo } from "react";
import { Avatar, Control, Markup } from "./common.jsx";
const iconLabels = {
  physical: "Physical",
  energy: "Energy",
  mystic: "Mystic",
  speed: "Speed",
  power: "Power",
  range: "Range",
  strength: "Strength",
  innate: "Innate",
  active: "Active",
  reactive: "Reactive",
  leadership: "Leadership",
};
const Icon = memo(function Icon({ name, badge = false }) {
  const plain = name.replace(/^badge-(attack-)?/, "");
  return (
    <img
      className={"sc-icon" + (badge ? " sc-badge-icon" : "")}
      src={"assets/card-icons/" + name + ".png"}
      alt={iconLabels[plain] || plain}
      title={iconLabels[plain] || plain}
      width={24}
      height={24}
    />
  );
});
function Counter({
  value,
  label,
  action,
  attributes,
  minusDisabled,
  plusDisabled,
}) {
  return (
    <div className="battle-counter">
      <button
        data-bt={action}
        data-delta="-1"
        {...attributes}
        aria-label={"Уменьшить " + label}
        disabled={minusDisabled}
      >
        −
      </button>
      <strong aria-label={label}>{value}</strong>
      <button
        data-bt={action}
        data-delta="1"
        {...attributes}
        aria-label={"Увеличить " + label}
        disabled={plusDisabled}
      >
        +
      </button>
    </div>
  );
}
const StateCycle = memo(function StateCycle({
  fighter: f,
  plan,
  disabled,
  showNext = false,
}) {
  return (
    <button
      type="button"
      className={"fighter-state-cycle state-" + plan.current}
      data-bt="cycle-status"
      data-id={f.id}
      data-next-status={plan.next}
      aria-label={`Состояние ${f.name}: ${plan.label}. Переключить в ${plan.nextLabel}`}
      title={`${plan.label} → ${plan.nextLabel}. Отмена — кнопкой ↶`}
      disabled={disabled}
    >
      <span>
        {plan.label}
        {showNext ? " → " + plan.nextLabel : ""}
      </span>
      <span aria-hidden="true">↻</span>
    </button>
  );
});
function EnergyBadge({ energy: e }) {
  if (e.kind === "none") return null;
  if (e.kind === "variable")
    return (
      <span
        className="fighter-energy-badge variable"
        aria-label={"Переменная стоимость энергии: " + e.cost}
        title="Переменная стоимость — см. описание"
      >
        <Icon name="power" />
        <b>{e.cost}</b>
      </span>
    );
  const missing = e.missing > 0,
    label = `Стоимость на карте: ${e.cost} энергии. ${e.cost === 0 ? "Без затрат энергии." : missing ? `Есть ${e.power} из ${e.cost}; не хватает энергии: ${e.missing}.` : `Энергии хватает: есть ${e.power}, нужно ${e.cost}.`}`;
  return (
    <span
      className={
        "fighter-energy-badge " +
        (missing ? "missing" : e.cost ? "enough" : "free")
      }
      data-energy-missing={e.missing}
      aria-label={label}
      title={label}
    >
      <Icon name="power" />
      <b>{missing ? `${e.power}/${e.cost}` : e.cost}</b>
    </span>
  );
}
const Ability = memo(function Ability({ ability: a }) {
  return (
    <details
      className="fighter-ability"
      id={"ability-" + a.key}
      data-ability-name={a.name}
    >
      <summary>
        <Icon
          name={"badge-" + (a.kind === "attack" ? "attack-" : "") + a.type}
          badge
        />
        <span className="fighter-ability-name" lang="en" title={a.name}>
          {a.name}
        </span>
        {a.kind === "attack" && (
          <span className="fighter-attack-stats">
            <span title="Дальность" aria-label={"Дальность: " + a.range}>
              <Icon name="range" />
              <b>{a.range}</b>
            </span>
            <span title="Сила атаки" aria-label={"Сила атаки: " + a.strength}>
              <Icon name="strength" />
              <b>{a.strength}</b>
            </span>
          </span>
        )}
        <EnergyBadge energy={a.energy} />
      </summary>
      <div className="fighter-ability-description" lang="en">
        <Markup
          html={
            a.bodyMarkup ||
            '<p class="muted">У этой атаки нет дополнительных эффектов.</p>'
          }
        />
      </div>
    </details>
  );
});
const Fighter = memo(function Fighter({ model }) {
  const {
    fighter: f,
    character,
    plan,
    summary,
    readonly,
    immunities,
    forms,
    reverse,
  } = model;
  return (
    <article
      className={
        "battle-fighter" +
        (f.acted ? " acted" : "") +
        (f.status !== "ready" ? " unavailable" : "")
      }
      data-fighter={f.id}
      data-status={f.status}
    >
      <div className="fighter-heading">
        <button
          className="fighter-portrait"
          data-bt="fighter-card"
          data-id={f.id}
          aria-label={"Карточка " + f.name}
        >
          <Avatar character={character} />
        </button>
        <div className="fighter-name">
          <h3>{f.name}</h3>
          <small>
            {f.alterEgo} · Threat {f.threat}
          </small>
          <StateCycle fighter={f} plan={plan} disabled={readonly} />
        </div>
      </div>
      {summary && (
        <dl
          className="fighter-card-stats"
          aria-label="Характеристики текущей стороны карты"
        >
          {[
            ["speed", "move", "Move"],
            ["physical", "physical", "Физическая защита"],
            ["energy", "energy", "Энергетическая защита"],
            ["mystic", "mystic", "Мистическая защита"],
          ].map(([icon, key, label]) => (
            <div
              key={key}
              data-fighter-stat={key}
              aria-label={label + ": " + (summary.stats[key] ?? "—")}
            >
              <dt>
                <Icon name={"badge-" + icon} badge />
                <span>{key === "move" ? "Move" : label.split(" ")[0]}</span>
              </dt>
              <dd>{summary.stats[key] ?? "—"}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="fighter-counters">
        <div>
          <span>HP · осталось / {f.maxHp}</span>
          <Counter
            value={f.hp}
            label={"HP " + f.name}
            action="counter"
            attributes={{ "data-id": f.id, "data-field": "hp" }}
            minusDisabled={readonly || f.hp === 0}
            plusDisabled={readonly || f.hp === f.maxHp}
          />
        </div>
        <div>
          <span>Энергия</span>
          <Counter
            value={f.power}
            label={"энергию " + f.name}
            action="counter"
            attributes={{ "data-id": f.id, "data-field": "power" }}
            minusDisabled={readonly || f.power === 0}
            plusDisabled={readonly || f.power === 10}
          />
        </div>
      </div>
      <div className="hpbar" aria-hidden="true">
        <i style={{ width: (100 * f.hp) / f.maxHp + "%" }} />
      </div>
      {f.hp === 0 && f.status === "ready" && (
        <div className="fighter-zero">
          <span>HP закончились</span>
          <StateCycle fighter={f} plan={plan} disabled={readonly} showNext />
        </div>
      )}
      <div className="fighter-conditions">
        {f.conditions.length ? (
          f.conditions.map((c) => (
            <span key={c} className="tag">
              {c}
            </span>
          ))
        ) : (
          <small>Без состояний</small>
        )}
        <button
          className="quiet"
          data-bt="conditions"
          data-id={f.id}
          disabled={readonly}
        >
          Состояния +
        </button>
      </div>
      <div className="fighter-immunities">
        <span>Иммунен:</span>
        {immunities.length ? (
          immunities.map((name) => (
            <span key={name} className="tag">
              {name === "Special Conditions" ? "Все особые состояния" : name}
            </span>
          ))
        ) : (
          <small>Нет</small>
        )}
      </div>
      <button
        className={"activation" + (f.acted ? " selected" : "")}
        data-bt="activate"
        data-id={f.id}
        disabled={readonly || f.status !== "ready"}
      >
        {f.status !== "ready"
          ? "Не может активироваться"
          : f.acted
            ? "✓ Походил · отменить"
            : "○ Ещё не походил"}
      </button>
      {summary && (
        <div className="fighter-abilities">
          {[
            ["attack", "Атаки"],
            ["power", "Способности"],
          ].map(([kind, label]) => {
            const abilities = summary.abilities.filter((a) => a.kind === kind);
            return abilities.length ? (
              <section
                className="fighter-ability-group"
                aria-label={label + " " + f.name}
                key={kind}
              >
                <h4>{label}</h4>
                {abilities.map((a) => (
                  <Ability key={a.key} ability={a} />
                ))}
              </section>
            ) : null;
          })}
        </div>
      )}
      <div className="fighter-bottom">
        <button className="quiet" data-bt="fighter-card" data-id={f.id}>
          Карточка ↗
        </button>
        {(forms.length || reverse.length) > 0 && (
          <span className="fighter-form-controls">
            {forms.length > 0 && (
              <label className="fighter-form-control">
                <span>Форма</span>
                <Control
                  as="select"
                  data-battle-fighter-form={f.id}
                  aria-label={"Форма в бою " + f.name}
                  value={String(f.form)}
                  disabled={readonly}
                >
                  {forms.map((c) => (
                    <option value={c.value} key={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Control>
              </label>
            )}
            {reverse.length > 0 && (
              <label className="fighter-form-control">
                <span>Сторона</span>
                <Control
                  as="select"
                  data-battle-fighter-face={f.id}
                  aria-label={"Сторона в бою " + f.name}
                  value={f.face}
                  disabled={readonly}
                >
                  {reverse.map((c) => (
                    <option value={c.value} key={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Control>
              </label>
            )}
          </span>
        )}
        <span>Цели {f.objectives}</span>
        <button
          className="quiet"
          data-bt="objectives"
          data-id={f.id}
          disabled={readonly}
        >
          Изменить
        </button>
      </div>
    </article>
  );
});
const MatchTile = memo(function MatchTile({ match: m, portraits }) {
  const done = m.status === "finished",
    preparing = m.status === "preparing";
  return (
    <article className="match-tile">
      <div className="roster-tile-top">
        <span className="eyebrow">
          {preparing ? "Подготовка" : done ? "Завершён" : "Идёт бой"}
        </span>
        <span className="tag">Threat {m.threat}</span>
      </div>
      <h3>{m.name}</h3>
      <p>
        {m.opponent.name} · {new Date(m.updatedAt).toLocaleDateString("ru-RU")}
      </p>
      <div className="roster-portraits">
        {portraits.map((c, i) => (
          <Avatar character={c} key={c.slug + ":" + i} />
        ))}
      </div>
      <div className="match-tile-bottom">
        <span>
          {preparing
            ? `${m.mine.fighters.length} бойцов выбрано`
            : `Раунд ${m.round} · ${m.score.mine} : ${m.score.opponent}`}
        </span>
        <button className={done ? "" : "primary"} data-bt="open" data-id={m.id}>
          {preparing
            ? "Продолжить подготовку"
            : done
              ? "Посмотреть"
              : "Продолжить бой →"}
        </button>
      </div>
    </article>
  );
});
export function BattleHome({ pending, history, networkMarkup, readError }) {
  return (
    <>
      <Markup html={networkMarkup} />
      <div className="heading">
        <div>
          <span className="eyebrow">08 / Бой</span>
          <h1>За столом</h1>
          <p>Продолжить партию или собрать отряд для новой.</p>
        </div>
        <button
          className="primary"
          data-bt="choose-roster"
          disabled={readError}
        >
          Новый бой +
        </button>
      </div>
      {readError && (
        <div className="notice">
          Сохранение партий не удалось прочитать. Исходная запись не
          перезаписывается; восстановите резервный JSON через «Данные».
        </div>
      )}
      {pending.length ? (
        <div className="match-grid">
          {pending.map((item) => (
            <MatchTile key={item.match.id} {...item} />
          ))}
        </div>
      ) : (
        <div className="empty roster-empty">
          <h3>Пока нет незавершённых партий</h3>
          <p>
            Выберите свой ростер, отметьте бойцов и начните. Противника можно
            добавить позже.
          </p>
          <button className="primary" data-bt="choose-roster">
            Выбрать ростер →
          </button>
        </div>
      )}
      <div className="section-title battle-history-title">
        <h3>История партий</h3>
        <span className="muted">{history.length}</span>
      </div>
      {history.length ? (
        <div className="match-grid">
          {history.map((item) => (
            <MatchTile key={item.match.id} {...item} />
          ))}
        </div>
      ) : (
        <p className="muted">Здесь появятся завершённые партии.</p>
      )}
    </>
  );
}
export function BattlePlay({
  match: m,
  teamSide,
  ownSide,
  labels,
  networkMarkup,
  fighters,
  tacticsMarkup,
  canUndo,
  network,
}) {
  const readonly = m.status === "finished",
    team = m[teamSide],
    showingMine = teamSide === ownSide,
    ready = team.fighters.filter(
      (f) => f.status === "ready" && !f.acted,
    ).length;
  return (
    <>
      <button
        id="battle-side-switch"
        className="battle-side-switch"
        data-bt="team"
        data-side={teamSide === "mine" ? "opponent" : "mine"}
        aria-label={
          showingMine ? "Показать отряд противника" : "Показать мой отряд"
        }
        title={showingMine ? "Показать отряд противника" : "Показать мой отряд"}
      >
        <span className={showingMine ? "current" : ""}>Я</span>
        <span aria-hidden="true">⇄</span>
        <span className={!showingMine ? "current" : ""}>Противник</span>
      </button>
      <Markup html={networkMarkup} />
      <div className="heading">
        <div>
          <span className="eyebrow">
            11 / {readonly ? "Завершённая партия" : "Бой"}
          </span>
          <h1>{m.name}</h1>
          <p>
            {m[network && ownSide === "opponent" ? "mine" : "opponent"].name} ·
            Threat {m.threat}
            {readonly ? " · снимок на момент завершения" : ""}
          </p>
        </div>
        <button data-bt="home">← К партиям</button>
      </div>
      <div className="battle-dashboard">
        <div className="round-label">
          <span>Раунд</span>
          <b>{m.round}</b>
        </div>
        {["mine", "opponent"].map((side) => (
          <div className="score-box" key={side}>
            <span>{labels[side]} VP</span>
            <Counter
              value={m.score[side]}
              label={labels[side] + " VP"}
              action="score"
              attributes={{ "data-side": side }}
              minusDisabled={readonly || m.score[side] === 0}
              plusDisabled={readonly}
            />
          </div>
        ))}
        <label className="field">
          Приоритет
          <Control
            as="select"
            id="battle-priority"
            value={m.priority}
            disabled={readonly}
          >
            <option value="unknown">Не указан</option>
            <option value="mine">{labels.mine}</option>
            <option value="opponent">{labels.opponent}</option>
          </Control>
        </label>
        <button
          className="quiet battle-undo"
          data-bt="undo"
          disabled={readonly || !canUndo}
        >
          ↶ Отмена
        </button>
      </div>
      <div className="battle-toolbar">
        {[
          ["round", "Следующий раунд →"],
          ["power", "Power Phase"],
          ["map", "Карта и расстояния"],
          ["missions", "Миссии и карты"],
          ["log", "Журнал"],
          ["finish", "Завершить"],
        ].map(([action, label]) => (
          <button
            key={action}
            className={
              action === "round"
                ? "primary"
                : action === "finish"
                  ? "quiet"
                  : undefined
            }
            data-bt={action}
            disabled={readonly && ["round", "power", "finish"].includes(action)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="battle-side-tabs" role="tablist" aria-label="Сторона боя">
        {["mine", "opponent"].map((side) => (
          <button
            role="tab"
            aria-selected={teamSide === side}
            data-bt="team"
            data-side={side}
            className={teamSide === side ? "selected" : ""}
            key={side}
          >
            {labels[side]}
            <span>{m[side].fighters.length}</span>
          </button>
        ))}
      </div>
      <div className="section-title">
        <div>
          <h3>{labels[teamSide] === "Мои" ? "Мой отряд" : team.name}</h3>
          <p className="battle-small">
            {ready} могут походить · {team.affiliation || "Без аффилиации"}
            {team.leader
              ? " · лидер " +
                (team.fighters.find((f) => f.id === team.leader)?.name || "—")
              : ""}
          </p>
        </div>
        {(teamSide === "opponent" || network) && !readonly && (
          <button data-bt="pick" data-side={teamSide} data-kind="characters">
            Изменить состав +
          </button>
        )}
      </div>
      <div className="fighter-grid">
        {fighters.length ? (
          fighters.map((model) => (
            <Fighter key={model.fighter.id} model={model} />
          ))
        ) : (
          <div className="empty roster-empty">
            <h3>Противник не указан</h3>
            <p>
              Его счёт уже можно вести. Бойцов и карты добавьте, когда они
              станут известны.
            </p>
            {!readonly && (
              <button
                className="primary"
                data-bt="pick"
                data-side="opponent"
                data-kind="characters"
              >
                Выбрать бойцов и карты +
              </button>
            )}
          </div>
        )}
      </div>
      <div className="section-title battle-tactics-title">
        <h3>Тактики · {team.tactics.filter((t) => !t.played).length} в руке</h3>
        {(teamSide === "opponent" || network) && !readonly && (
          <button data-bt="pick" data-side={teamSide} data-kind="tactics">
            Изменить карты +
          </button>
        )}
      </div>
      <Markup html={tacticsMarkup} />
      <p className="battle-rule-note">
        HP, энергию, цели и эффекты меняете вы. Повреждение не начисляет энергию
        автоматически. Изменения партии сохраняются сразу; ↶ отменяет последнюю
        правку.
      </p>
    </>
  );
}
