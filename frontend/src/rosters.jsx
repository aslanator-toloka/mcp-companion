import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";
import {
  rosters,
  library,
  catalog,
  ui,
  actions,
  battle,
} from "./stores/index.js";
import { cardStatus } from "./stores/rosters.js";
import { RosterSquads } from "./roster-squads.jsx";
import React, { memo } from "react";
import { Avatar, CollectionStatus, Control, number, count } from "./common.jsx";
const Options = ({ names, empty }) => (
  <>
    <option value="">{empty}</option>
    {names.map((name) => (
      <option key={name} value={name}>
        {name}
      </option>
    ))}
  </>
);
const RosterTile = memo(function RosterTile({
  roster: r,
  status,
  subtitle,
  missing,
  portraits,
  groups,
}) {
  return (
    <article className="roster-tile">
      <div className="roster-tile-top">
        <span className="eyebrow">
          {r.affiliation || "Без основной аффилиации"}
        </span>
        <span className="tag">{status}</span>
      </div>
      <button
        className="roster-title"
        data-rs="edit"
        data-id={r.id}
        onClick={(event) => {
          event.stopPropagation();
          rosters.open(r.id);
        }}
      >
        {r.name}
      </button>
      <div className="roster-portraits">
        {portraits.map((c) => (
          <Avatar key={c.slug} character={c} />
        ))}
        {r.characters.length > 6 && (
          <span className="portrait-overflow">+{r.characters.length - 6}</span>
        )}
        {!r.characters.length && (
          <span className="muted">Персонажи ещё не выбраны</span>
        )}
      </div>
      <p className="roster-subtitle">{subtitle}</p>
      <div className="roster-tags">
        {groups.map((g) => (
          <span className="tag" key={g.id}>
            {g.name}
          </span>
        ))}
        <span className={"tag" + (missing ? " missing-tag" : "")}>
          {!r.characters.length
            ? "Пустой состав"
            : missing
              ? "Нет " + count(missing, "модели", "моделей", "моделей")
              : "Все модели есть"}
        </span>
      </div>
      <div className="actions roster-tile-actions">
        <button
          className="primary"
          data-rs="edit"
          data-id={r.id}
          onClick={(event) => {
            event.stopPropagation();
            rosters.open(r.id);
          }}
        >
          Открыть ростер →
        </button>
        <button
          data-bt="prepare"
          data-roster={r.id}
          onClick={() => battle.prepare(r.id)}
        >
          Бой →
        </button>
        <button
          data-rs="duplicate"
          data-id={r.id}
          onClick={(event) => {
            event.stopPropagation();
            rosters.duplicate(r.id);
          }}
        >
          Копия
        </button>
        <button
          className="quiet"
          data-rs="delete"
          data-id={r.id}
          aria-label={"Удалить ростер " + r.name}
          onClick={(event) => {
            event.stopPropagation();
            rosters.remove(r.id);
          }}
        >
          ×
        </button>
      </div>
    </article>
  );
});
export const RosterList = observer(function RosterList({
  items,
  filters,
  affiliations,
  groups,
  total,
}) {
  return (
    <>
      <div className="heading">
        <div>
          <span className="eyebrow">04 / Ростеры</span>
          <h1>Мои ростеры</h1>
          <p>Сохранённые составы, карты и группы для разных планов игры.</p>
        </div>
        <div className="actions">
          <button
            data-rs="groups"
            onClick={(event) => {
              event.stopPropagation();
              rosters.showGroups();
            }}
          >
            Группы
          </button>
          <button
            className="primary"
            data-rs="new"
            onClick={(event) => {
              event.stopPropagation();
              rosters.open();
            }}
          >
            Новый ростер +
          </button>
        </div>
      </div>
      <div className="catalog-tools">
        <label className="search-label">
          <span className="sr-only">Найти ростер</span>
          <Control
            id="roster-search"
            type="search"
            value={filters.query}
            placeholder="Найти ростер по названию…"
            autoComplete="off"
            onChange={(event) => {
              event.stopPropagation();
              rosters.setFilter("query", event.target.value);
            }}
          />
        </label>
        <div className="filter-row roster-filters">
          <label>
            Аффилиация
            <Control
              as="select"
              id="roster-affiliation"
              aria-label="Аффилиация ростера"
              value={filters.affiliation}
              onChange={(event) => {
                event.stopPropagation();
                rosters.setFilter("affiliation", event.target.value);
              }}
            >
              <Options names={affiliations} empty="Все аффилиации" />
            </Control>
          </label>
          <label>
            Группа
            <Control
              as="select"
              id="roster-group"
              aria-label="Группа ростера"
              value={filters.group}
              onChange={(event) => {
                event.stopPropagation();
                rosters.setFilter("group", event.target.value);
              }}
            >
              <option value="">Все группы</option>
              <option value="__none">Без группы</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Control>
          </label>
          <label className="check only-owned">
            <Control
              id="roster-owned"
              type="checkbox"
              checked={filters.owned}
              onChange={(event) => {
                event.stopPropagation();
                rosters.setFilter("owned", event.target.checked);
              }}
            />
            Все модели есть
          </label>
          <button
            className="quiet"
            data-rs="reset-filters"
            onClick={(event) => {
              event.stopPropagation();
              rosters.resetFilters();
            }}
          >
            Сбросить
          </button>
        </div>
      </div>
      <div className="list-heading">
        <span role="status" aria-live="polite">
          {count(items.length, "ростер", "ростера", "ростеров")}
        </span>
        <span>Последние изменения сверху</span>
      </div>
      {items.length ? (
        <div className="roster-grid">
          {items.map((item) => (
            <RosterTile key={item.roster.id} {...item} />
          ))}
        </div>
      ) : (
        <div className="empty roster-empty">
          <h3>{total ? "Ничего не найдено" : "Создайте первый ростер"}</h3>
          <p>
            {total
              ? "Измените запрос или снимите фильтры."
              : "Выберите персонажей и карты, дайте составу название и сохраните его."}
          </p>
          <button
            className="primary"
            data-rs={total ? "reset-filters" : "new"}
            onClick={(event) => {
              event.stopPropagation();
              total ? rosters.resetFilters() : rosters.open();
            }}
          >
            {total ? "Сбросить фильтры" : "Создать ростер +"}
          </button>
        </div>
      )}
    </>
  );
});
const SelectedItem = memo(function SelectedItem({ item, kind }) {
  const { slug, character: c, card, status, affiliated } = item;
  return (
    <div className="selected-row">
      {kind === "characters" ? (
        <>
          <button
            className="selected-character"
            data-action="character"
            onClick={() => actions.openCharacter(slug)}
            data-slug={slug}
          >
            <Avatar character={c} />
            <span>
              <strong>{c.name}</strong>
              <small>{c.alterEgo}</small>
              <span className="selected-meta">
                Threat {c.threatLevel} · <CollectionStatus status={status} />
                {affiliated ? " · Аффилирован" : ""}
              </span>
            </span>
          </button>
          <div className="selected-row-actions">
            <button
              className="quiet character-card-picker"
              data-rs="character-cards"
              data-slug={slug}
              aria-label={"Добавить карты " + c.name}
              onClick={(event) => {
                event.stopPropagation();
                rosters.openPicker("tactics", slug);
              }}
            >
              Добавить карты
            </button>
            <button
              className="quiet"
              data-rs="remove-item"
              data-kind={kind}
              data-slug={slug}
              aria-label={"Убрать " + c.name + " из ростера"}
              onClick={(event) => {
                event.stopPropagation();
                rosters.removeItem(kind, slug);
              }}
            >
              Убрать ×
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            className="selected-card"
            data-rs="card"
            data-kind={kind}
            data-slug={slug}
            onClick={(event) => {
              event.stopPropagation();
              actions.showGameCard(kind, slug);
            }}
          >
            <span className="card-symbol">
              {kind === "tactics" ? "TT" : card?.type === "Secure" ? "S" : "E"}
            </span>
            <span>
              <strong>{card?.name || slug}</strong>
              <small>
                {kind === "crises"
                  ? `${card?.type === "Secure" ? "Secure" : "Extract"} · Threat ${card?.threatLevel ?? "—"} · карта ${card?.setup || "—"}`
                  : card?.affiliation?.name || "Без аффилиации"}{" "}
                · {status}
              </small>
            </span>
          </button>
          <button
            className="quiet"
            data-rs="remove-item"
            data-kind={kind}
            data-slug={slug}
            onClick={(event) => {
              event.stopPropagation();
              rosters.removeItem(kind, slug);
            }}
          >
            Убрать ×
          </button>
        </>
      )}
    </div>
  );
});
export const RosterEditor = observer(function RosterEditor({
  roster: r,
  saved,
  conflict,
  groups,
  affiliations,
  tab,
  items,
  notes,
  secure,
  extract,
}) {
  const source = r.tournamentSource;
  return (
    <>
      <div className="heading">
        <div>
          <span className="eyebrow">05 / Редактор ростера</span>
          <h1>{saved ? "Редактировать ростер" : "Новый ростер"}</h1>
          <p>Правки применятся после нажатия «Сохранить ростер».</p>
        </div>
        <button
          data-rs="back"
          onClick={(event) => {
            event.stopPropagation();
            rosters.navigate();
          }}
        >
          ← К ростерам
        </button>
      </div>
      {source && (
        <div className="notice">
          <b>Из турнирного архива</b> · {source.player} · {source.record} ·
          место {source.place} / {source.fieldSize}
          <br />
          <a href={source.url} target="_blank" rel="noopener">
            {source.event} ↗
          </a>
        </div>
      )}
      {conflict && (
        <div className="notice">
          Сохранённый ростер изменился в другой вкладке. Проверьте актуальную
          версию перед сохранением.
        </div>
      )}
      <div className="editor-info">
        <div className="editor-fields">
          <label className="field">
            Название ростера
            <Control
              id="editor-name"
              value={r.name}
              maxLength={100}
              placeholder="Например: Web Warriors · контроль"
              onChange={(event) => {
                event.stopPropagation();
                rosters.setField("name", event.target.value);
              }}
            />
          </label>
          <label className="field">
            Основная аффилиация
            <Control
              as="select"
              id="editor-affiliation"
              aria-label="Основная аффилиация"
              value={r.affiliation}
              onChange={(event) => {
                event.stopPropagation();
                rosters.setField("affiliation", event.target.value);
              }}
            >
              <Options names={affiliations} empty="Без основной аффилиации" />
            </Control>
          </label>
        </div>
        <div id="editor-error" className="editor-error" role="alert">
          {rosters.error}
        </div>
        <div className="editor-groups">
          <span className="field-label">Группы</span>
          <div className="group-checks">
            {groups.map((g) => (
              <label key={g.id} className="check">
                <Control
                  type="checkbox"
                  data-editor-group={g.id}
                  checked={r.groups.includes(g.id)}
                  onChange={(event) => {
                    event.stopPropagation();
                    rosters.setGroup(g.id, event.target.checked);
                  }}
                />
                {g.name}
              </label>
            ))}
            {!groups.length && <span className="muted">Групп пока нет</span>}
            <button
              className="quiet"
              data-rs="new-group"
              onClick={(event) => {
                event.stopPropagation();
                rosters.groupForm();
              }}
            >
              + Новая группа
            </button>
          </div>
        </div>
      </div>
      <div className="roster-summary">
        <span>
          <b>{r.characters.length}</b> / 10 персонажей
        </span>
        <span>
          <b>{r.tactics.length}</b> / 10 тактик
        </span>
        <span>
          Secure <b>{secure}</b> / 5
        </span>
        <span>
          Extract <b>{extract}</b> / 5
        </span>
      </div>
      <RosterSquads />
      <div className="editor-tabs" role="tablist" aria-label="Состав ростера">
        {[
          ["characters", "Персонажи"],
          ["tactics", "Тактики"],
          ["crises", "Кризисы"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            data-rs="tab"
            data-tab={id}
            className={tab === id ? "selected" : ""}
            onClick={(event) => {
              event.stopPropagation();
              rosters.setTab(id);
            }}
          >
            {label}
            <span>{r[id].length}</span>
          </button>
        ))}
      </div>
      <div className="section-title roster-section-title">
        <h3>
          {tab === "characters"
            ? "Состав персонажей"
            : tab === "tactics"
              ? "Team Tactics"
              : "Secure и Extract"}
        </h3>
        <button
          data-rs="pick"
          onClick={(event) => {
            event.stopPropagation();
            rosters.openPicker();
          }}
        >
          + Добавить
        </button>
      </div>
      {items.length ? (
        <div className="selected-items">
          {items.map((item) => (
            <SelectedItem key={tab + ":" + item.slug} item={item} kind={tab} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h3>
            {tab === "characters"
              ? "Персонажи не выбраны"
              : tab === "tactics"
                ? "Тактики не выбраны"
                : "Кризисы не выбраны"}
          </h3>
          <p>
            Добавьте позиции из каталога. Неполный ростер тоже можно сохранить.
          </p>
          <button
            data-rs="pick"
            className="primary"
            onClick={(event) => {
              event.stopPropagation();
              rosters.openPicker();
            }}
          >
            + Добавить
          </button>
        </div>
      )}
      {notes.length > 0 && (
        <div className="notice">
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      )}
      <p className="roster-footnote">
        Счётчики — ориентир обычного ростера. Статусы карт взяты из Jarvis; это
        не полная проверка правил и турнирной легальности.
      </p>
      <div className="editor-footer">
        <div className="actions">
          {saved && (
            <>
              <button data-bt="prepare-editor" onClick={battle.prepareEditor}>
                Начать бой →
              </button>
              <button
                className="quiet"
                data-rs="duplicate"
                data-id={r.id}
                onClick={(event) => {
                  event.stopPropagation();
                  rosters.duplicate(r.id);
                }}
              >
                Копия
              </button>
              <button
                className="quiet"
                data-rs="delete"
                data-id={r.id}
                onClick={(event) => {
                  event.stopPropagation();
                  rosters.remove(r.id);
                }}
              >
                Удалить
              </button>
            </>
          )}
        </div>
        <div className="actions">
          <button
            data-rs="back"
            onClick={(event) => {
              event.stopPropagation();
              rosters.navigate();
            }}
          >
            Отмена
          </button>
          <button
            className="primary"
            data-rs="save"
            onClick={(event) => {
              event.stopPropagation();
              if (rosters.save()) actions.showRosterList();
            }}
          >
            Сохранить ростер
          </button>
        </div>
      </div>
    </>
  );
});
const CardStats = memo(function CardStats({ stats, covered }) {
  if (!stats || !covered)
    return (
      <span className="picker-card-stats muted">
        Нет полных данных в этом контексте
      </span>
    );
  return (
    <span className="picker-card-stats">
      <span
        className="card-pick-rate"
        title="Доля полностью распознанных списков в выбранном контексте; варианты выступления учтены с весом 1/M"
      >
        <b>{number(stats.share)}%</b> популярность
      </span>
      <span>{count(stats.count, "ростер", "ростера", "ростеров")}</span>
      <span title="Сумма баллов выступлений с этой картой">
        Σ {number(stats.points)}
      </span>
      <span title="Сглаженное среднее баллов; при менее 4 оценённых выступлениях — 0">
        ср. {number(stats.average)}
      </span>
    </span>
  );
});
const CharacterOptions = ({ characters }) =>
  characters.map((c) => (
    <option key={c.slug} value={c.slug}>
      {c.name}
      {c.alterEgo ? " · " + c.alterEgo : ""}
    </option>
  ));
function CardInsights({
  picker: p,
  coverage,
  affiliations,
  characters,
  relatedName,
}) {
  return (
    <section
      className="card-insight-tools"
      aria-label="Контекст популярности и баллов"
    >
      <strong>Популярность и баллы</strong>
      <div className="card-insight-controls">
        <label>
          Аффилиация ростеров
          <Control
            as="select"
            id="roster-picker-stats-affiliation"
            aria-label="Аффилиация для статистики карт"
            value={p.statsAffiliation}
            onChange={(event) => {
              event.stopPropagation();
              rosters.setPicker("statsAffiliation", event.target.value);
            }}
          >
            <Options names={affiliations} empty="Все аффилиации" />
          </Control>
        </label>
        <label>
          Персонаж в ростере
          <Control
            as="select"
            id="roster-picker-stats-character"
            aria-label="Персонаж для статистики карт"
            value={p.statsCharacter}
            onChange={(event) => {
              event.stopPropagation();
              rosters.setPicker("statsCharacter", event.target.value);
            }}
          >
            <option value="">Любой персонаж</option>
            <CharacterOptions characters={characters} />
          </Control>
        </label>
        <label>
          Сортировка
          <Control
            as="select"
            id="roster-picker-sort"
            aria-label="Сортировка карт"
            value={p.sort}
            onChange={(event) => {
              event.stopPropagation();
              rosters.setPicker("sort", event.target.value);
            }}
          >
            {[
              ["popularity", "По популярности"],
              ["points", "По сумме баллов"],
              ["average", "По среднему баллу"],
              ["name", "По алфавиту"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Control>
        </label>
      </div>
      {p.relatedTo && (
        <label className="check related-card-switch">
          <Control
            type="checkbox"
            id="roster-picker-related"
            checked={p.relatedOnly}
            onChange={(event) => {
              event.stopPropagation();
              rosters.setPicker("relatedOnly", event.target.checked);
            }}
          />
          Только связанные карты: {relatedName || "персонажа"}
        </label>
      )}
      <p className="card-insight-coverage" role="status">
        Статистика по {coverage.covered} из {coverage.total} списков в контексте
        {coverage.excluded ? ` · ${coverage.excluded} без полного разбора` : ""}
        .
      </p>
      <details className="card-insight-method">
        <summary>Как считаются показатели</summary>
        <p>
          Популярность — доля списков с картой. Варианты одного выступления
          учитываются с весом 1/M; разные печатные версии карты объединены. В
          знаменатель входят только полностью разобранные списки
          соответствующего типа карт. Сумма и среднее — по оценённым завершённым
          выступлениям и прежней турнирной формуле, включая отрицательные
          результаты; среднее сглажено и равно 0 до 4 оценённых выступлений.
          Фильтры аффилиации и персонажа применяются вместе.
        </p>
      </details>
    </section>
  );
}
const PickerRow = memo(
  function PickerRow({ item, kind, covered }) {
    const { card: c, chosen, stats, owners, status } = item,
      isCard = kind !== "characters";
    return (
      <div
        className={"picker-result" + (chosen ? " chosen" : "")}
        data-card-slug={isCard ? c.slug : undefined}
        data-popularity={isCard ? stats?.share || 0 : undefined}
        data-points={isCard ? stats?.points || 0 : undefined}
      >
        <label className="check picker-check">
          <Control
            type="checkbox"
            data-pick-kind={kind}
            value={c.slug}
            checked={chosen}
            onChange={(event) => {
              event.stopPropagation();
              rosters.choose(kind, c.slug, event.target.checked);
            }}
          />
          {!isCard ? (
            <Avatar character={c} />
          ) : (
            <span className="card-symbol">
              {kind === "tactics" ? "TT" : c.type === "Secure" ? "S" : "E"}
            </span>
          )}
          <span>
            <strong>{c.name}</strong>
            <small>
              {!isCard ? (
                <>
                  {c.alterEgo} · Threat {c.threatLevel} ·{" "}
                  <CollectionStatus status={status} />
                </>
              ) : kind === "tactics" ? (
                `${c.affiliation?.name || "Без аффилиации"} · ${status}`
              ) : (
                `${c.type === "Secure" ? "Secure" : "Extract"} · Threat ${c.threatLevel} · ${status} · ${c.challengerStatus === "legal" ? "Challenger" : "Вне Challenger"}`
              )}
            </small>
            {owners?.length > 0 && (
              <span className="picker-card-owners">
                {owners.length === 1 ? "Персонаж" : "Персонажи"}:{" "}
                {owners.join(", ")}
              </span>
            )}
            {isCard && <CardStats stats={stats} covered={covered} />}
          </span>
        </label>
        <button
          className="quiet"
          data-action={!isCard ? "character" : undefined}
          data-rs={isCard ? "card" : undefined}
          data-kind={isCard ? kind : undefined}
          data-slug={c.slug}
          aria-label={"Посмотреть " + c.name}
          onClick={(event) => {
            event.stopPropagation();
            isCard
              ? actions.showGameCard(kind, c.slug)
              : actions.openCharacter(c.slug);
          }}
        >
          ↗
        </button>
      </div>
    );
  },
  (a, b) =>
    a.kind === b.kind &&
    a.covered === b.covered &&
    a.item.card === b.item.card &&
    a.item.chosen === b.item.chosen &&
    a.item.stats === b.item.stats &&
    a.item.status?.kind === b.item.status?.kind &&
    (typeof a.item.status === "string"
      ? a.item.status === b.item.status
      : true) &&
    (a.item.owners || []).join("|") === (b.item.owners || []).join("|"),
);
export const RosterPicker = observer(function RosterPicker({
  picker: p,
  items,
  coverage,
  affiliations,
  archiveAffiliations,
  characters,
  relatedName,
  title,
  selectedCount,
  error,
}) {
  const kind = p.kind,
    isCard = kind !== "characters";
  return (
    <>
      <div className="dialog-heading">
        <div>
          <h2>{title}</h2>
          <p>Отметьте несколько позиций. Они попадут в редактируемый состав.</p>
        </div>
        <button
          className="quiet close"
          data-rs="close-picker"
          aria-label="Закрыть добавление"
          onClick={(event) => {
            event.stopPropagation();
            rosters.closePicker();
          }}
        >
          ×
        </button>
      </div>
      <div className="picker-tools">
        <Control
          className="picker-search"
          id="roster-picker-search"
          type="search"
          value={p.query}
          placeholder="Поиск по началу слова…"
          aria-label="Поиск для добавления"
          onChange={(event) => {
            event.stopPropagation();
            rosters.setPicker("query", event.target.value);
          }}
        />
        <div className="picker-filters">
          {kind !== "crises" ? (
            <Control
              as="select"
              id="roster-picker-affiliation"
              aria-label={
                isCard ? "Аффилиация карты" : "Аффилиация для добавления"
              }
              value={p.affiliation}
              onChange={(event) => {
                event.stopPropagation();
                rosters.setPicker("affiliation", event.target.value);
              }}
            >
              <Options
                names={affiliations}
                empty={isCard ? "Любая аффилиация карты" : "Все аффилиации"}
              />
            </Control>
          ) : (
            <Control
              as="select"
              id="roster-picker-type"
              aria-label="Тип кризиса"
              value={p.type}
              onChange={(event) => {
                event.stopPropagation();
                rosters.setPicker("type", event.target.value);
              }}
            >
              <option value="">Secure и Extract</option>
              <option value="Secure">Secure</option>
              <option value="Extraction">Extract</option>
            </Control>
          )}
          {kind === "tactics" && (
            <Control
              as="select"
              id="roster-picker-character"
              aria-label="Персонаж карты"
              value={p.relatedOnly ? p.relatedTo : ""}
              onChange={(event) => {
                event.stopPropagation();
                rosters.setPicker("relatedTo", event.target.value);
              }}
            >
              <option value="">Персонаж карты: любой</option>
              <CharacterOptions characters={characters} />
            </Control>
          )}
          {kind === "crises" && (
            <label className="check">
              <Control
                id="roster-picker-challenger"
                type="checkbox"
                checked={p.challenger}
                onChange={(event) => {
                  event.stopPropagation();
                  rosters.setPicker("challenger", event.target.checked);
                }}
              />
              Только Challenger
            </label>
          )}
          {kind === "characters" ? (
            <label className="check">
              <Control
                id="roster-picker-owned"
                type="checkbox"
                checked={p.owned}
                onChange={(event) => {
                  event.stopPropagation();
                  rosters.setPicker("owned", event.target.checked);
                }}
              />
              Есть у меня
            </label>
          ) : (
            <label className="check">
              <Control
                id="roster-picker-available"
                type="checkbox"
                checked={p.available}
                onChange={(event) => {
                  event.stopPropagation();
                  rosters.setPicker("available", event.target.checked);
                }}
              />
              Доступные в Standard
            </label>
          )}
        </div>
        {coverage && (
          <CardInsights
            picker={p}
            coverage={coverage}
            affiliations={archiveAffiliations}
            characters={characters}
            relatedName={relatedName}
          />
        )}
      </div>
      <div className="picker-summary">
        <span>{items.length} найдено</span>
        <span>В составе: {selectedCount}</span>
      </div>
      <div className="picker-results">
        {error && isCard && <div className="notice">{error}</div>}
        {items.length ? (
          items.map((item) => (
            <PickerRow
              key={kind + ":" + item.card.slug}
              item={item}
              kind={kind}
              covered={coverage?.covered || 0}
            />
          ))
        ) : (
          <div className="empty">
            <p>
              {p.relatedOnly
                ? "У этого персонажа нет связанных тактик в снимке Jarvis. Снимите отметку «Только связанные карты», чтобы посмотреть все тактики и их статистику с этим персонажем."
                : "Ничего не найдено. Измените запрос или фильтры."}
            </p>
          </div>
        )}
      </div>
      <div className="picker-footer">
        <span>Правки сохранятся вместе с ростером.</span>
        <button
          className="primary"
          data-rs="close-picker"
          onClick={(event) => {
            event.stopPropagation();
            rosters.closePicker();
          }}
        >
          Готово
        </button>
      </div>
    </>
  );
});

const countText = (r) =>
  `${count(r.characters.length, "персонаж", "персонажа", "персонажей")} · ${count(r.tactics.length, "тактика", "тактики", "тактик")} · Secure ${rosters.crisisCount(r, "Secure")} / Extract ${rosters.crisisCount(r, "Extraction")}`;
export const RosterWorkspace = observer(function RosterWorkspace() {
  if (rosters.draft) {
    const r = rosters.draft,
      tab = rosters.tab;
    return (
      <RosterEditor
        roster={r}
        saved={rosters.records.some((s) => s.id === r.id)}
        conflict={rosters.conflict}
        groups={rosters.groups}
        affiliations={rosters.affiliations}
        tab={tab}
        items={r[tab].map((slug) =>
          tab === "characters"
            ? {
                slug,
                character: catalog.byId.get(slug),
                status: library.status(slug),
                affiliated: catalog.byId
                  .get(slug)
                  ?.affiliations.some((a) => a.name === r.affiliation),
              }
            : {
                slug,
                card: rosters.card(tab, slug),
                status: cardStatus(rosters.card(tab, slug)),
              },
        )}
        notes={rosters.notes}
        secure={rosters.crisisCount(r, "Secure")}
        extract={rosters.crisisCount(r, "Extraction")}
      />
    );
  }
  return (
    <RosterList
      items={rosters.visible.map((r) => ({
        roster: r,
        status:
          r.characters.length === 10 &&
          r.tactics.length === 10 &&
          rosters.crisisCount(r, "Secure") === 5 &&
          rosters.crisisCount(r, "Extraction") === 5
            ? "Укомплектован"
            : "Черновик",
        subtitle: countText(r),
        missing: rosters.missing(r),
        portraits: r.characters
          .slice(0, 6)
          .map((slug) => catalog.byId.get(slug)),
        groups: r.groups.map(
          (id) =>
            rosters.groups.find((g) => g.id === id) || { id, name: "Группа" },
        ),
      }))}
      filters={rosters.filters}
      affiliations={rosters.affiliations}
      groups={rosters.groups}
      total={rosters.records.length}
    />
  );
});
function Modal({ id, className, label, open, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      id={id}
      className={className}
      aria-label={label}
      onClose={(event) => {
        if (!event.currentTarget.open) onClose?.(event);
      }}
    >
      {children}
    </dialog>
  );
}
export const RosterPickerModal = observer(function RosterPickerModal() {
  const p = rosters.picker,
    kind = p?.kind,
    coverage = rosters.coverage;
  const title = p?.relatedOnly
    ? `Карты персонажа · ${catalog.byId.get(p.relatedTo)?.name || ""}`
    : kind === "characters"
      ? "Добавить персонажей"
      : kind === "tactics"
        ? "Добавить тактики"
        : "Добавить кризисы";
  return (
    <Modal
      id="roster-picker-dialog"
      className={
        "roster-picker-dialog" +
        (p && kind !== "characters" ? " card-insights-dialog" : "")
      }
      label="Добавление в ростер"
      open={!!p}
      onClose={rosters.closePicker}
    >
      <div id="roster-picker-content">
        {p && rosters.draft && (
          <RosterPicker
            picker={p}
            items={rosters.pickerItems}
            coverage={
              coverage
                ? {
                    covered: coverage.covered,
                    total: coverage.total,
                    excluded: coverage.excluded,
                  }
                : null
            }
            affiliations={rosters.affiliations}
            archiveAffiliations={rosters.archiveAffiliations}
            characters={catalog.rows.filter((c) => !c.isGrunt)}
            relatedName={catalog.byId.get(p.relatedTo)?.name}
            title={title}
            selectedCount={rosters.draft[kind].length}
            error={rosters.cardError}
          />
        )}
      </div>
    </Modal>
  );
});
export const RosterActionModal = observer(function RosterActionModal() {
  const d = rosters.dialog;
  return (
    <Modal
      id="roster-action-dialog"
      className="small-dialog"
      label="Действия с ростерами"
      open={!!d}
      onClose={() => {
        if (!rosters.dialog) return;
        rosters.closeDialog();
      }}
    >
      <div id="roster-action-content">
        {d && (
          <>
            <div className="dialog-heading">
              <div>
                <h2>{d.title}</h2>
                <p>{d.description}</p>
              </div>
              <button
                className="quiet close"
                data-rs="close-action"
                aria-label="Закрыть окно"
                onClick={rosters.closeDialog}
              >
                ×
              </button>
            </div>
            {d.type === "leave" && (
              <div className="actions">
                <button
                  className="primary"
                  data-rs="save-leave"
                  onClick={() => rosters.leaveWith(true)}
                >
                  Сохранить и выйти
                </button>
                <button
                  data-rs="discard-leave"
                  onClick={() => rosters.leaveWith(false)}
                >
                  Выйти без сохранения
                </button>
                <button
                  className="quiet"
                  data-rs="close-action"
                  onClick={rosters.closeDialog}
                >
                  Продолжить редактирование
                </button>
              </div>
            )}
            {d.type === "conflict" && (
              <div className="actions">
                <button data-rs="reload-editor" onClick={rosters.reloadDraft}>
                  Открыть актуальный
                </button>
                <button
                  className="primary"
                  data-rs="force-save"
                  onClick={rosters.forceSave}
                >
                  Сохранить мои правки
                </button>
                <button data-rs="close-action" onClick={rosters.closeDialog}>
                  Отмена
                </button>
              </div>
            )}
            {d.type === "delete" && (
              <div className="actions">
                <button data-rs="close-action" onClick={rosters.closeDialog}>
                  Отмена
                </button>
                <button
                  className="primary"
                  data-rs="confirm-delete"
                  onClick={() => rosters.confirmRemove(d.id)}
                >
                  Удалить ростер
                </button>
              </div>
            )}
            {d.type === "groups" && (
              <>
                {rosters.groups.length ? (
                  rosters.groups.map((g) => (
                    <div key={g.id} className="group-row">
                      <span>
                        <strong>{g.name}</strong>
                        <small>
                          {count(
                            rosters.records.filter((r) =>
                              r.groups.includes(g.id),
                            ).length,
                            "ростер",
                            "ростера",
                            "ростеров",
                          )}
                        </small>
                      </span>
                      <div className="actions">
                        <button
                          data-rs="rename-group"
                          onClick={() => rosters.groupForm(g.id)}
                        >
                          Название
                        </button>
                        <button
                          className="quiet"
                          data-rs="delete-group"
                          aria-label={"Удалить группу " + g.name}
                          onClick={() => rosters.removeGroup(g.id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">Групп ещё нет.</p>
                )}
                <div className="actions">
                  <button
                    className="primary"
                    data-rs="new-group"
                    onClick={() => rosters.groupForm()}
                  >
                    + Новая группа
                  </button>
                </div>
              </>
            )}
            {d.type === "group" && (
              <form
                id="roster-group-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  rosters.saveGroup();
                }}
              >
                <label className="field">
                  Название группы
                  <input
                    name="name"
                    maxLength={60}
                    required
                    value={d.name}
                    onChange={(e) => rosters.editGroupName(e.target.value)}
                    placeholder="Название группы"
                  />
                </label>
                <div className="actions">
                  <button className="primary" type="submit">
                    {d.id ? "Сохранить название" : "Создать группу"}
                  </button>
                  <button
                    type="button"
                    data-rs="close-action"
                    onClick={rosters.closeDialog}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}
            {d.type === "delete-group" && (
              <div className="actions">
                <button data-rs="groups" onClick={rosters.showGroups}>
                  Отмена
                </button>
                <button
                  className="primary"
                  data-rs="confirm-delete-group"
                  onClick={() => rosters.confirmRemoveGroup(d.id)}
                >
                  Удалить группу
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
});
