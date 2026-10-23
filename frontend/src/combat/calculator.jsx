import React, { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { catalog, cardViews, ui } from "../stores/index.js";
import { Avatar } from "../common.jsx";
import { CONDITIONS, contextFields, immunities, profile } from "./profile.js";
import { calculate } from "./client.js";
const types = {
  physical: "Физическая",
  energy: "Энергетическая",
  mystic: "Мистическая",
};
const digits = (n) =>
  n.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
function CharacterSettings({ character, detail, value, onChange }) {
  if (!character) return null;
  const card = (value.form && detail?.secondStatCard) || detail?.statCard,
    fields = contextFields(character.slug),
    face = (value.side === "back" && card?.backSide) || card?.frontSide,
    immune = immunities(face),
    maxDamage = Math.max(0, Number(face?.stamina || 41) - 1);
  const set = (key, v) => onChange({ ...value, [key]: v });
  return (
    <section className="combat-character">
      <div className="combat-identity">
        <Avatar character={character} />
        <div>
          <strong>{character.name}</strong>
          <small>{character.alterEgo}</small>
        </div>
      </div>
      <div className="combat-controls">
        {detail?.secondStatCard && (
          <label className="field">
            Форма
            <select
              aria-label={`Форма ${character.name}`}
              value={value.form}
              onChange={(e) =>
                onChange({ ...value, form: +e.target.value, side: "front" })
              }
            >
              <option value={0}>
                {detail.statCard.frontSide?.nameOverride ||
                  detail.statCard.name}
              </option>
              <option value={1}>
                {detail.secondStatCard.frontSide?.nameOverride ||
                  detail.secondStatCard.name}
              </option>
            </select>
          </label>
        )}
        <label className="field">
          Сторона
          <select
            aria-label={`Сторона ${character.name}`}
            value={value.side}
            onChange={(e) => set("side", e.target.value)}
          >
            <option value="front">
              {card?.frontSide?.type === "injured" ? "Injured" : "Healthy"}
            </option>
            {card?.backSide && <option value="back">Injured</option>}
          </select>
        </label>
        <label className="field">
          Получено урона
          <input
            aria-label={`Урон на ${character.name}`}
            type="number"
            min="0"
            max={maxDamage}
            value={Math.min(value.damage, maxDamage)}
            onChange={(e) =>
              set("damage", Math.min(maxDamage, +e.target.value))
            }
          />
        </label>
        {fields.stance && (
          <label className="field">
            Режим
            <select
              value={value.stance}
              onChange={(e) => set("stance", e.target.value)}
            >
              {fields.stance.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <details className="combat-context">
        <summary>Условия и способности</summary>
        <div className="combat-checks">
          {[
            ["cover", "Есть укрытие (дистанция >2)"],
            ["moved", "Уже двигался / был размещён"],
            ["attacked", "Уже атаковал этого противника"],
            ["objective", "Держит / оспаривает цель"],
            ...(fields.special ? [["special", fields.special]] : []),
          ].map(([k, label]) => (
            <label className="check" key={k}>
              <input
                type="checkbox"
                checked={value[k]}
                onChange={(e) => set(k, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        {fields.tokens && (
          <label className="field">
            {fields.tokens}
            <input
              type="number"
              min="0"
              max="10"
              value={value.tokens}
              onChange={(e) => set("tokens", +e.target.value)}
            />
          </label>
        )}
        <div
          className="combat-conditions"
          aria-label={`Состояния ${character.name}`}
        >
          {CONDITIONS.map((key) => (
            <label className="check" key={key}>
              <input
                type="checkbox"
                checked={
                  value.conditions.includes(key) && !immune.includes(key)
                }
                disabled={immune.includes(key)}
                title={
                  immune.includes(key) ? "Иммунитет к состоянию" : undefined
                }
                onChange={(e) =>
                  set(
                    "conditions",
                    e.target.checked
                      ? [...value.conditions, key]
                      : value.conditions.filter((x) => x !== key),
                  )
                }
              />
              {key}
            </label>
          ))}
        </div>
      </details>
    </section>
  );
}
function Outcome({ value }) {
  return (
    <div className="combat-outcome">
      <strong>≈ {digits(value.mean)}</strong>
      <small>Урон ≥1: {Math.round(value.chance * 100)}%</small>
      <small>Погрешность ±{digits(value.error)}</small>
    </div>
  );
}
function RuleList({ label, entries }) {
  const unique = [...new Map(entries.map((e) => [e.name, e])).values()];
  return (
    <div>
      <b>{label}</b>
      {unique.length ? (
        <ul>
          {unique.map((e) => (
            <li key={e.name}>
              {e.name}
              {e.cost ? ` · ${e.cost} энергии` : " · пассивно / бесплатно"}
            </li>
          ))}
        </ul>
      ) : (
        <p>Без дополнительных правил для этого броска.</p>
      )}
    </div>
  );
}
function Direction({ value, attacker, defender, index }) {
  return (
    <section
      className="combat-direction"
      data-attacker={attacker.slug}
      data-combat-slot={index === 0 ? "first" : "second"}
    >
      <p className="eyebrow">
        {index === 0 ? "Первый → Второй" : "Второй → Первый"}
      </p>
      <h3>
        {attacker.name} <span aria-hidden="true">→</span> {defender.name}
      </h3>
      <div className="combat-result-head">
        <span>Атака</span>
        <span>Без допэнергии</span>
        <span>Полная энергия</span>
      </div>
      {value.attacks.map((a) => (
        <article className="combat-attack" key={a.id}>
          <div className="combat-result-row">
            <div>
              <strong>{a.name}</strong>
              <small>
                {types[a.type]} · сила {a.strength} · дальность {a.range} · цена{" "}
                {a.cost}
              </small>
            </div>
            {a.unavailable ? (
              <p className="combat-unavailable">{a.unavailable}</p>
            ) : (
              <>
                <Outcome value={a.base} />
                <Outcome value={a.full} />
              </>
            )}
          </div>
          <details className="combat-explanation">
            <summary>
              {a.warnings.length ? "Частичный расчёт · " : ""}Способности и
              пояснения
            </summary>
            {a.warnings.length > 0 && (
              <div className="combat-warning">
                <b>Не учтено:</b>
                <ul>
                  {a.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {a.notes.length > 0 && (
              <ul className="muted">
                {a.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            <div className="combat-rule-columns">
              <RuleList label="Атакующий" entries={a.rules.attacker} />
              <RuleList label="Защитник" entries={a.rules.defender} />
            </div>
            <p className="muted">
              Платные способности доступны только при достаточном остатке
              энергии. Сначала усиление пула, затем Cloak / Probability
              Manipulation, перебросы и снижение урона. Перебрасываем неудачные
              результаты; полный переброс используем, если он повышает ожидаемые
              успехи. Это фиксированная стратегия, не поиск идеального решения
              для каждого броска.
            </p>
          </details>
        </article>
      ))}
      {!value.attacks.length && (
        <p className="empty">У этой стороны карты нет атак.</p>
      )}
    </section>
  );
}
const CharacterPicker = observer(function CharacterPicker({
  field,
  label,
  value,
}) {
  const [query, setQuery] = useState("");
  const candidates = catalog.rows
    .filter(
      (c) =>
        c.slug === value ||
        `${c.name} ${c.alterEgo || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        String(a.alterEgo || "").localeCompare(String(b.alterEgo || "")),
    );
  return (
    <div className="combat-character-picker">
      <label className="field">
        {field === "source"
          ? "Найти первого персонажа"
          : "Найти второго персонажа"}
        <input
          type="search"
          placeholder="Имя или alter ego"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <label className="field">
        {label}
        <select
          aria-label={label}
          value={value}
          onChange={(e) => cardViews.setCalculator(field, e.target.value)}
        >
          <option value="">Выберите персонажа…</option>
          {candidates.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name} — {c.alterEgo || "Grunt"}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
});
const CalculatorContent = observer(function CalculatorContent({ config }) {
  const [outcome, setOutcome] = useState(null),
    [failure, setFailure] = useState(null),
    [retry, setRetry] = useState(0);
  const first = catalog.byId.get(config.source),
    second = catalog.byId.get(config.opponent);
  const firstDetail = catalog.details.get(config.source),
    secondDetail = catalog.details.get(config.opponent);
  const serialized = JSON.stringify(config),
    result = outcome?.key === serialized ? outcome.value : null,
    error = failure?.key === serialized ? failure.message : "";
  useEffect(() => {
    let live = true,
      job,
      timer;
    setOutcome(null);
    setFailure(null);
    Promise.all([
      first ? catalog.detail(config.source) : null,
      second ? catalog.detail(config.opponent) : null,
    ])
      .then(([a, b]) => {
        if (!live) return;
        if ((first && !a?.statCard) || (second && !b?.statCard))
          throw Error("Не удалось загрузить полные карты");
        if (!first || !second) return;
        timer = setTimeout(() => {
          try {
            job = calculate(
              profile(first, a, config.first),
              profile(second, b, config.second),
              { distance: config.distance },
            );
            job.promise.then(
              (value) => {
                if (live) setOutcome({ key: serialized, value });
              },
              (e) => {
                if (live) setFailure({ key: serialized, message: e.message });
              },
            );
          } catch (e) {
            if (live) setFailure({ key: serialized, message: e.message });
          }
        }, 150);
      })
      .catch((e) => {
        if (live) setFailure({ key: serialized, message: e.message });
      });
    return () => {
      live = false;
      clearTimeout(timer);
      job?.cancel();
    };
  }, [serialized, retry]);
  return (
    <>
      <header className="heading">
        <div>
          <span className="eyebrow">07 / КАЛЬКУЛЯТОР</span>
          <h1>Калькулятор атак</h1>
          <p>
            Выберите двух персонажей и сравните средний прямой урон каждой
            атакой в обе стороны.
          </p>
        </div>
      </header>
      <label className="field combat-distance">
        Дистанция
        <select
          aria-label="Дистанция"
          value={config.distance}
          onChange={(e) => cardViews.setCalculator("distance", e.target.value)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              Range {n}
            </option>
          ))}
        </select>
      </label>
      <div className="combat-characters">
        <div role="group" aria-label="Первый персонаж: выбор и настройки">
          <CharacterPicker
            field="source"
            label="Первый персонаж"
            value={config.source}
          />
          <CharacterSettings
            character={first}
            detail={firstDetail}
            value={config.first}
            onChange={(v) => cardViews.setCalculator("first", v)}
          />
        </div>
        <div role="group" aria-label="Второй персонаж: выбор и настройки">
          <CharacterPicker
            field="opponent"
            label="Второй персонаж"
            value={config.opponent}
          />
          <CharacterSettings
            character={second}
            detail={secondDetail}
            value={config.second}
            onChange={(v) => cardViews.setCalculator("second", v)}
          />
        </div>
      </div>
      <div className="combat-assumptions">
        <p>
          <b>Без допэнергии:</b> цена атаки уже оплачена, после оплаты у
          атакующего 0 энергии, у защитника тоже 0. Бесплатные и пассивные
          способности работают.
        </p>
        <p>
          <b>Полная энергия:</b> оба начинают с 10; цена атаки и усиления
          расходуют этот запас. Для каждой строки запас восстанавливается.
          Энергия, получаемая в процессе, не добавляется.
        </p>
      </div>
      {error ? (
        <div className="empty" role="alert">
          <p>{error}</p>
          <button onClick={() => setRetry((v) => v + 1)}>
            Повторить расчёт
          </button>
        </div>
      ) : !first || !second ? (
        <p className="empty">Выберите двух персонажей для сравнения.</p>
      ) : !result ? (
        <p className="loading" role="status">
          {firstDetail && secondDetail
            ? "Считаем броски и способности…"
            : "Загружаем карты…"}
        </p>
      ) : (
        result.map((value, index) => (
          <Direction
            key={index}
            value={value}
            index={index}
            attacker={index === 0 ? first : second}
            defender={index === 0 ? second : first}
          />
        ))
      )}
      <details className="combat-method">
        <summary>Что именно считаем</summary>
        <p>
          60 000 симуляций на атаку и сценарий. «±» — оценка 95% статистической
          погрешности, а не гарантия точности модели правил. Крита на
          дополнительном кубе или перебросе не хватает для ещё одного
          дополнительного куба. Один куб можно перебросить разными
          способностями; каждой способностью — только один раз. Черепы обычно не
          модифицируются.
        </p>
        <p>
          Один бросок атаки по одной цели; без союзников, лидерства, тактик,
          Infinity Gems, внешних аур, столкновений, контратак, повторных атак и
          последующего урона от состояний. Урон не ограничен оставшимся
          здоровьем. Особые неподдержанные правила отмечены у конкретной атаки.
          Условия вроде полученного урона и предыдущей атаки задаются выше.
        </p>
      </details>
    </>
  );
});
export const CalculatorPage = observer(function CalculatorPage() {
  // Unmount the worker-owning component on navigation; inputs remain in the store.
  if (ui.screen !== "calculator") return null;
  if (!ui.ready || !cardViews.calculator)
    return <p className="loading">Загружаем калькулятор…</p>;
  return (
    <div id="combat-calculator" className="combat-page">
      <CalculatorContent config={cardViews.calculator} />
    </div>
  );
});
