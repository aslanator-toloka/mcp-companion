import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { catalog } from "./stores/index.js";
import { CONDITIONS, TRAITS, EFFECTS, COMPARATORS } from "./catalog-filters.js";

function Choices({ label, choices, selected, onToggle }) {
  return (
    <fieldset className="catalog-choice-field">
      <legend>{label}</legend>
      <div className="catalog-choices">
        {choices.map((choice) => {
          const [value, text] = Array.isArray(choice)
            ? choice
            : [choice, choice];
          return (
            <button
              type="button"
              key={value}
              aria-pressed={selected.includes(value)}
              onClick={() => onToggle(value)}
            >
              {text}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
function Check({ children, checked, onChange }) {
  return (
    <label className="check catalog-filter-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}
function NumberField({ label, value, onChange, max = 99 }) {
  return (
    <label className="catalog-number-field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        max={max}
        placeholder="Любое"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Group({ title, children, open = false }) {
  return (
    <details className="catalog-filter-group" open={open || undefined}>
      <summary>{title}</summary>
      <div className="catalog-filter-group-body">{children}</div>
    </details>
  );
}
function ConditionChoices({ immune, selected, onToggle }) {
  return (
    <fieldset className="catalog-choice-field">
      <legend>{immune ? "Иммунитет к" : "Накладывает состояния"}</legend>
      <div className="catalog-choices">
        {CONDITIONS.map((condition) => {
          const name = condition[0].toUpperCase() + condition.slice(1),
            key = immune ? "immuneTo" + name : condition;
          return (
            <button
              type="button"
              key={key}
              aria-pressed={selected.includes(key)}
              onClick={() => onToggle(key)}
            >
              <img
                src={`assets/conditions/${condition}.png`}
                alt=""
                width="24"
                height="24"
              />
              {name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
function AttackFilter({ attack: a, index, update, remove }) {
  return (
    <fieldset className="catalog-attack-filter" data-attack-matcher={a.id}>
      <legend>Атака {index + 1}</legend>
      <div className="catalog-attack-numbers">
        {[
          ["range", "Дальность"],
          ["strength", "Сила"],
        ].map(([key, label]) => (
          <div className="catalog-attack-number" key={key}>
            <NumberField
              label={label}
              value={a[key]}
              onChange={(value) => update(key, value)}
            />
            <label>
              <span className="sr-only">{label}: сравнение</span>
              <select
                aria-label={`${label}: сравнение`}
                value={a[key + "Op"]}
                onChange={(e) => update(key + "Op", e.target.value)}
              >
                {COMPARATORS.map(([op, text]) => (
                  <option key={op} value={op}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>
      <Choices
        label="Тип атаки"
        choices={[
          ["physical", "Physical"],
          ["energy", "Energy"],
          ["mystic", "Mystic"],
        ]}
        selected={a.types}
        onToggle={(value) =>
          update(
            "types",
            a.types.includes(value)
              ? a.types.filter((t) => t !== value)
              : [...a.types, value],
          )
        }
      />
      <Choices
        label="Форма атаки"
        choices={[
          ["area", "Area"],
          ["beam", "Beam"],
        ]}
        selected={[a.shape]}
        onToggle={(value) => update("shape", a.shape === value ? "" : value)}
      />
      <button
        type="button"
        className="quiet catalog-remove-attack"
        onClick={remove}
      >
        Убрать блок {index + 1}
      </button>
    </fieldset>
  );
}
export const CatalogFilters = observer(function CatalogFilters() {
  const f = catalog.filters,
    [tag, setTag] = useState("");
  const change = catalog.setAdvanced;
  const toggle = (key, value) => catalog.toggleAdvanced(key, value);
  const toggleTag = (value) => toggle("tags", value);
  const knownTags = [
    ...new Set([
      ...catalog.tags,
      ...TRAITS.map((t) => t[0]),
      ...EFFECTS.map((t) => t[0]),
    ]),
  ].sort();
  const selectedAffiliations = catalog.selectedAffiliations;
  return (
    <details
      className="catalog-advanced"
      open={catalog.filtersOpen}
      onToggle={(e) => catalog.setFilter("filtersOpen", e.currentTarget.open)}
    >
      <summary>
        Фильтры персонажей{" "}
        {catalog.activeFilterCount > 0 && (
          <span className="catalog-filter-count">
            {catalog.activeFilterCount}
          </span>
        )}
      </summary>
      <div className="catalog-filter-sections">
        <p className="muted">
          Параметры разных разделов применяются вместе. Несколько значений в
          одной строке — любой из выбранных.
        </p>
        <Group title="Аффилиации">
          <Choices
            label="Аффилиации персонажа"
            choices={catalog.affiliations}
            selected={selectedAffiliations}
            onToggle={catalog.toggleAffiliation}
          />
          <Check
            checked={f.allAffiliations}
            onChange={(v) => change("allAffiliations", v)}
          >
            Состоит во всех выбранных аффилиациях
          </Check>
          <Check checked={f.leaders} onChange={(v) => change("leaders", v)}>
            Только лидеры, включая лидерство через тактики
          </Check>
        </Group>
        <Group title="Характеристики">
          <div className="catalog-filter-numbers">
            <NumberField
              label="Threat от"
              value={f.minThreat}
              max={20}
              onChange={(v) => change("minThreat", v)}
            />
            <NumberField
              label="Threat до"
              value={f.maxThreat}
              max={20}
              onChange={(v) => change("maxThreat", v)}
            />
            <NumberField
              label="Stamina от"
              value={f.minStamina}
              onChange={(v) => change("minStamina", v)}
            />
          </div>
          <Choices
            label="Размер персонажа"
            choices={[1, 2, 3, 4, 5]}
            selected={f.sizes}
            onToggle={(v) => toggle("sizes", v)}
          />
          <Choices
            label="Скорость"
            choices={["S", "M", "L"]}
            selected={f.speeds}
            onToggle={(v) => toggle("speeds", v)}
          />
          <p className="muted">
            Защита не ниже указанного значения. Характеристики основной здоровой
            формы.
          </p>
          <div className="catalog-filter-numbers">
            {[
              ["physicalDefense", "Physical от"],
              ["energyDefense", "Energy от"],
              ["mysticDefense", "Mystic от"],
            ].map(([key, label]) => (
              <NumberField
                key={key}
                label={label}
                value={f[key]}
                max={20}
                onChange={(v) => change(key, v)}
              />
            ))}
          </div>
        </Group>
        <Group title="Атаки">
          <p className="muted">
            Все условия одного блока должны совпасть у одной атаки. Учитываются
            обе стороны и формы карты.
          </p>
          <Check
            checked={f.allAttacks}
            onChange={(v) => change("allAttacks", v)}
          >
            Должен совпасть каждый блок атак
          </Check>
          <div className="catalog-attack-filters">
            {f.attacks.map((a, index) => (
              <AttackFilter
                key={a.id}
                attack={a}
                index={index}
                update={(key, value) => catalog.updateAttack(a.id, key, value)}
                remove={() => catalog.removeAttack(a.id)}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={f.attacks.length >= 20}
            onClick={catalog.addAttack}
          >
            Добавить блок атаки
          </button>
        </Group>
        <Group title="Способности и врождённые свойства">
          <Choices
            label="Должны быть все выбранные свойства"
            choices={TRAITS}
            selected={f.tags}
            onToggle={toggleTag}
          />
        </Group>
        <Group title="Игровые механики и эффекты">
          <Choices
            label="Должны быть все выбранные эффекты"
            choices={EFFECTS}
            selected={f.tags}
            onToggle={toggleTag}
          />
        </Group>
        <Group title="Состояния и иммунитеты">
          <ConditionChoices selected={f.tags} onToggle={toggleTag} />
          <ConditionChoices immune selected={f.tags} onToggle={toggleTag} />
        </Group>
        <Group title="Другие параметры">
          <Choices
            label="Размер базы"
            choices={[
              [35, "35 мм"],
              [50, "50 мм"],
              [65, "65 мм"],
            ]}
            selected={f.baseSizes}
            onToggle={(v) => toggle("baseSizes", v)}
          />
          <Choices
            label="Формат / Timeline"
            choices={[
              ["standard", "Standard"],
              ["extended", "Extended"],
              ["2024", "2024"],
              ["2025", "2025"],
              ["2026", "2026"],
            ]}
            selected={[f.timeline]}
            onToggle={(v) => change("timeline", v)}
          />
          <Check
            checked={f.hideUnreleased}
            onChange={(v) => change("hideUnreleased", v)}
          >
            Скрыть ещё не выпущенных
          </Check>
          <Check checked={f.missing} onChange={(v) => change("missing", v)}>
            Только отсутствующие в коллекции
          </Check>
        </Group>
        <Group title="Все теги">
          <p className="muted">
            Выбранные теги применяются одновременно. В строке поиска также можно
            писать #flight или !#flight.
          </p>
          <form
            className="catalog-tag-add"
            onSubmit={(e) => {
              e.preventDefault();
              if (knownTags.includes(tag) && !f.tags.includes(tag))
                toggleTag(tag);
              setTag("");
            }}
          >
            <label>
              <span className="sr-only">Найти тег</span>
              <input
                list="catalog-tag-options"
                placeholder="Найти тег…"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />
            </label>
            <datalist id="catalog-tag-options">
              {knownTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <button
              type="submit"
              disabled={!knownTags.includes(tag) || f.tags.includes(tag)}
            >
              Добавить тег
            </button>
          </form>
          <div className="catalog-choices">
            {f.tags.map((t) => (
              <button
                type="button"
                key={t}
                aria-label={`Убрать тег ${t}`}
                onClick={() => toggleTag(t)}
              >
                {t} ×
              </button>
            ))}
          </div>
        </Group>
        <div className="catalog-sort-fields">
          <label>
            Сортировка
            <select
              aria-label="Сортировка персонажей"
              value={f.sort}
              onChange={(e) => change("sort", e.target.value)}
            >
              <option value="name">По алфавиту</option>
              <option value="threat">По Threat</option>
              <option value="releaseDate">По дате выпуска</option>
              <option value="boxSet">По набору</option>
            </select>
          </label>
          <Check
            checked={f.descending}
            onChange={(v) => change("descending", v)}
          >
            По убыванию
          </Check>
        </div>
      </div>
    </details>
  );
});
