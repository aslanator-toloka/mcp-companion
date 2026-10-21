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
      <button className="roster-title" data-rs="edit" data-id={r.id}>
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
        <button className="primary" data-rs="edit" data-id={r.id}>
          Открыть ростер →
        </button>
        <button data-bt="prepare" data-roster={r.id}>
          Бой →
        </button>
        <button data-rs="duplicate" data-id={r.id}>
          Копия
        </button>
        <button
          className="quiet"
          data-rs="delete"
          data-id={r.id}
          aria-label={"Удалить ростер " + r.name}
        >
          ×
        </button>
      </div>
    </article>
  );
});
export function RosterList({ items, filters, affiliations, groups, total }) {
  return (
    <>
      <div className="heading">
        <div>
          <span className="eyebrow">04 / Ростеры</span>
          <h1>Мои ростеры</h1>
          <p>Сохранённые составы, карты и группы для разных планов игры.</p>
        </div>
        <div className="actions">
          <button data-rs="groups">Группы</button>
          <button className="primary" data-rs="new">
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
            />
            Все модели есть
          </label>
          <button className="quiet" data-rs="reset-filters">
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
          <button className="primary" data-rs={total ? "reset-filters" : "new"}>
            {total ? "Сбросить фильтры" : "Создать ростер +"}
          </button>
        </div>
      )}
    </>
  );
}
const SelectedItem = memo(function SelectedItem({ item, kind }) {
  const { slug, character: c, card, status, affiliated } = item;
  return (
    <div className="selected-row">
      {kind === "characters" ? (
        <>
          <button
            className="selected-character"
            data-action="character"
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
            >
              Добавить карты
            </button>
            <button
              className="quiet"
              data-rs="remove-item"
              data-kind={kind}
              data-slug={slug}
              aria-label={"Убрать " + c.name + " из ростера"}
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
          >
            Убрать ×
          </button>
        </>
      )}
    </div>
  );
});
export function RosterEditor({
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
        <button data-rs="back">← К ростерам</button>
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
            />
          </label>
          <label className="field">
            Основная аффилиация
            <Control
              as="select"
              id="editor-affiliation"
              aria-label="Основная аффилиация"
              value={r.affiliation}
            >
              <Options names={affiliations} empty="Без основной аффилиации" />
            </Control>
          </label>
        </div>
        <div id="editor-error" className="editor-error" role="alert" />
        <div className="editor-groups">
          <span className="field-label">Группы</span>
          <div className="group-checks">
            {groups.map((g) => (
              <label key={g.id} className="check">
                <Control
                  type="checkbox"
                  data-editor-group={g.id}
                  checked={r.groups.includes(g.id)}
                />
                {g.name}
              </label>
            ))}
            {!groups.length && <span className="muted">Групп пока нет</span>}
            <button className="quiet" data-rs="new-group">
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
        <button data-rs="pick">+ Добавить</button>
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
          <button data-rs="pick" className="primary">
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
              <button data-bt="prepare-editor">Начать бой →</button>
              <button className="quiet" data-rs="duplicate" data-id={r.id}>
                Копия
              </button>
              <button className="quiet" data-rs="delete" data-id={r.id}>
                Удалить
              </button>
            </>
          )}
        </div>
        <div className="actions">
          <button data-rs="back">Отмена</button>
          <button className="primary" data-rs="save">
            Сохранить ростер
          </button>
        </div>
      </div>
    </>
  );
}
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
export function RosterPicker({
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
              />
              Есть у меня
            </label>
          ) : (
            <label className="check">
              <Control
                id="roster-picker-available"
                type="checkbox"
                checked={p.available}
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
        <button className="primary" data-rs="close-picker">
          Готово
        </button>
      </div>
    </>
  );
}
