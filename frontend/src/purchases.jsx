import { observer } from "mobx-react-lite";
import { library, purchases, catalog, actions } from "./stores/index.js";
import React, { memo, useState } from "react";
import { Avatar, CollectionStatus, Control, count } from "./common.jsx";
const summary = (set) =>
  (set.characters || [])
    .map((c) => c.name + (c.amount > 1 ? " ×" + c.amount : ""))
    .join(" · ") ||
  (set.missing ? "Нет данных о составе набора" : "Без миниатюр персонажей");
const BoxImage = memo(function BoxImage({ set, large = false }) {
  const [failed, setFailed] = useState(false);
  return set.image && !failed ? (
    <img
      className={"box-set-image" + (large ? " large" : "")}
      src={set.image}
      onError={() => setFailed(true)}
      alt={`Коробка ${set.name} · ${set.code}`}
      loading={large ? undefined : "lazy"}
      decoding="async"
    />
  ) : (
    <span className="box-set-image-placeholder">
      Изображение набора недоступно
    </span>
  );
});
export const BoxActions = observer(function BoxActions({ set }) {
  const planned =
      library.wishlist.has(set.code) && !library.bought.has(set.code),
    bought = library.bought.has(set.code);
  return (
    <div className="box-set-actions">
      <button
        type="button"
        className={"purchase-wishlist-button" + (planned ? " is-planned" : "")}
        data-wishlist-code={set.code}
        onClick={(event) => {
          event.stopPropagation();
          if (!library.toggleWishlist(set.code) && library.error)
            actions.notify(library.error);
        }}
        disabled={bought}
        title={bought ? "Набор уже куплен" : undefined}
        aria-pressed={planned}
        aria-label={`${planned ? "Убрать из запланированных покупок" : "Добавить в запланированные покупки"}: ${set.name}`}
      >
        {planned ? "★ В планах" : "☆ Запланировать"}
      </button>
      <button
        type="button"
        className={"purchase-bought-button" + (bought ? " is-purchased" : "")}
        data-purchased-code={set.code}
        onClick={(event) => {
          event.stopPropagation();
          if (!library.togglePurchased(set.code) && library.error)
            actions.notify(library.error);
        }}
        aria-pressed={bought}
        aria-label={`${bought ? "Снять отметку купленного набора" : "Отметить набор купленным"}: ${set.name}`}
      >
        {bought ? "✓ Куплен" : "Отметить купленным"}
      </button>
    </div>
  );
});
const BoxOpportunities = observer(function BoxOpportunities({
  code,
  expanded = false,
}) {
  const [open, setOpen] = useState(expanded);
  const stats = purchases.opportunities?.get(code);
  if (!stats) return null;
  const extras = [...stats.complements].sort(
    (a, b) =>
      b[1].length - a[1].length ||
      purchases.box(a[0]).name.localeCompare(purchases.box(b[0]).name),
  );
  return (
    <section
      className="box-opportunities"
      data-box-opportunities={code}
      aria-label="Какие ростеры откроет покупка"
    >
      <button
        className="box-opportunity-link"
        data-show-unlocks
        type="button"
        disabled={!stats.unlocked.length}
        onClick={() => actions.showPurchaseRosters(code)}
      >
        Откроет: <strong data-box-unlocks>{stats.unlocked.length}</strong>{" "}
        {count(stats.unlocked.length, "ростер", "ростера", "ростеров").replace(
          /^\d+ /,
          "",
        )}{" "}
        →
      </button>
      <button
        className="box-opportunity-link"
        data-show-almost
        type="button"
        disabled={!stats.almost.length}
        onClick={() => actions.showPurchaseRosters(code, "almost")}
      >
        Ещё одна коробка: <strong data-box-almost>{stats.almost.length}</strong>{" "}
        {count(stats.almost.length, "ростер", "ростера", "ростеров").replace(
          /^\d+ /,
          "",
        )}{" "}
        →
      </button>
      <small title="Завершённые выступления: 4+ победы / ≤1 поражение или 3+ победы / 0 поражений. Считаются опубликованные полные составы по персонажам; тактики и кризисы не проверяются. Уже доступные составы не включены.">
        По персонажам твоей коллекции · 4+/≤1 или 3+/0
      </small>
      {extras.length > 0 && (
        <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary>Варианты последней коробки · {extras.length}</summary>
          {open && (
            <ul>
              {extras.map(([extra, ids]) => {
                const box = purchases.box(extra);
                const missing = [
                  ...stats.missingByComplement.get(extra).values(),
                ].sort((a, b) => a.name.localeCompare(b.name));
                return (
                  <li key={extra}>
                    <button
                      type="button"
                      data-complement-box={extra}
                      onClick={(e) => {
                        e.stopPropagation();
                        actions.openBoxSet(extra);
                      }}
                    >
                      {box.code} · {box.name}
                    </button>
                    <small data-missing-from-box={extra}>
                      Не хватает:{" "}
                      {missing.map((character, i) => (
                        <React.Fragment key={character.id}>
                          {i > 0 ? " · " : ""}
                          {character.name}
                          {ids.length > 1
                            ? ` (${count(character.rosters.length, "ростер", "ростера", "ростеров")})`
                            : ""}
                        </React.Fragment>
                      ))}
                    </small>
                    <button
                      type="button"
                      data-show-complement={extra}
                      onClick={() =>
                        actions.showPurchaseRosters(code, "almost", extra)
                      }
                    >
                      {count(ids.length, "ростер", "ростера", "ростеров")} →
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {open && (
            <small>
              Один ростер может подходить к нескольким коробкам; в общем числе
              он учтён один раз.
            </small>
          )}
        </details>
      )}
    </section>
  );
});
export const BoxTile = memo(function BoxTile({
  set,
  planned,
  bought,
  compact = false,
}) {
  return (
    <article
      className={"box-set-tile" + (compact ? " compact" : "")}
      data-box-set={set.code}
    >
      <button
        className="box-set-open"
        type="button"
        data-box-code={set.code}
        onClick={(event) => {
          event.stopPropagation();
          actions.openBoxSet(set.code);
        }}
        aria-label={"Посмотреть набор " + set.code}
      >
        <div className="box-set-cover">
          <BoxImage set={set} />
        </div>
        <div className="box-set-copy">
          <small>{set.code}</small>
          <strong>{set.name}</strong>
          <p>{summary(set)}</p>
        </div>
        <span className="box-set-arrow" aria-hidden="true">
          ↗
        </span>
      </button>
      <BoxOpportunities code={set.code} />
      <BoxActions set={set} planned={planned} bought={bought} />
    </article>
  );
});
export function CharacterBoxes({ items, error }) {
  return (
    <section className="detail-section character-box-sets">
      <div className="section-title">
        <h3>В каких наборах</h3>
        <button
          className="quiet"
          type="button"
          data-action="purchases"
          onClick={(event) => {
            event.stopPropagation();
            actions.navigate("purchases");
          }}
        >
          Запланированные покупки →
        </button>
      </div>
      {error && <p className="purchase-data-note">{error}</p>}
      {items.length ? (
        <div className="character-box-set-list">
          {items.map((item) => (
            <BoxTile key={item.set.code} {...item} compact />
          ))}
        </div>
      ) : (
        <p className="muted">
          В каталоге пока нет информации о наборах этого персонажа.
        </p>
      )}
    </section>
  );
}
export function PurchasesPage({
  items,
  count,
  boughtCount,
  total,
  tab,
  query,
  error,
}) {
  return (
    <>
      <div className="heading">
        <div>
          <span className="eyebrow">09 / Вишлист наборов</span>
          <h1>Запланированные покупки</h1>
          <p>Наборы, которые хочется добавить в коллекцию.</p>
        </div>
        <span className="purchase-count">{count} в планах</span>
      </div>
      <div className="purchase-toolbar">
        <div className="purchase-tabs" role="group" aria-label="Список наборов">
          {[
            ["wishlist", "Мой вишлист", count],
            ["purchased", "Купленные", boughtCount],
            ["all", "Все наборы", total],
          ].map(([id, label, n]) => (
            <button
              key={id}
              type="button"
              data-purchase-tab={id}
              onClick={(event) => {
                event.stopPropagation();
                purchases.setTab(id);
              }}
              aria-pressed={tab === id}
              className={tab === id ? "selected" : ""}
            >
              {label} · {n}
            </button>
          ))}
        </div>
        <label className="purchase-search">
          <span className="sr-only">Поиск наборов</span>
          <Control
            id="purchase-search"
            type="search"
            value={query}
            onChange={(event) => {
              event.stopPropagation();
              purchases.setQuery(event.target.value);
            }}
            placeholder="Название, код набора или персонаж…"
          />
        </label>
      </div>
      {error && (
        <p className="notice">
          {error}{" "}
          <button
            type="button"
            data-box-retry
            onClick={() => actions.retryBoxes()}
          >
            Повторить
          </button>
        </p>
      )}
      <p className="purchase-results-count" role="status">
        Найдено: {items.length}
      </p>
      {items.length ? (
        <div className="purchase-grid">
          {items.map((item) => (
            <BoxTile key={item.set.code} {...item} />
          ))}
        </div>
      ) : (
        <div className="empty purchase-empty">
          <h3>
            {query
              ? "Ничего не найдено"
              : tab === "purchased"
                ? "Пока нет купленных наборов"
                : "Пока нет запланированных покупок"}
          </h3>
          <p>
            {query
              ? "Попробуйте другое название, код или имя персонажа."
              : "Отмечайте наборы в карточках персонажей или откройте весь каталог наборов."}
          </p>
          {!query && (
            <button
              type="button"
              className="primary"
              data-purchase-tab="all"
              onClick={(event) => {
                event.stopPropagation();
                purchases.setTab("all");
              }}
            >
              Выбрать наборы →
            </button>
          )}
        </div>
      )}
    </>
  );
}
const BoxMember = observer(function BoxMember({ item, character }) {
  const status = library.status(item.slug);
  const content = (
    <>
      {character ? (
        <Avatar character={character} />
      ) : (
        <span className="box-set-member-placeholder">◇</span>
      )}
      <span>
        <strong>
          {item.name}
          {item.amount > 1 ? " ×" + item.amount : ""}
        </strong>
        <small>
          {character
            ? character.alterEgo || ""
            : "Карточки этой версии пока нет в каталоге"}{" "}
          · <CollectionStatus status={status} />
        </small>
      </span>
      {character && <span aria-hidden="true">↗</span>}
    </>
  );
  const entry = character ? (
    <button
      type="button"
      className="box-set-member"
      data-action="catalog-character"
      onClick={(event) => {
        event.stopPropagation();
        actions.openCatalogCharacter(item.slug);
      }}
      data-slug={item.slug}
    >
      {content}
    </button>
  ) : (
    <div className="box-set-member">{content}</div>
  );
  return <div className="box-set-member-row">{entry}</div>;
});
export function BoxDetail({ set, planned, bought, members }) {
  return (
    <>
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">{set.code}</span>
          <h2>{set.name}</h2>
        </div>
        <button
          type="button"
          className="quiet close"
          data-box-close
          onClick={(event) => {
            event.stopPropagation();
            actions.closeBoxSet();
          }}
          aria-label="Закрыть набор"
        >
          ×
        </button>
      </div>
      <div className="box-set-detail">
        <div className="box-set-detail-cover">
          <BoxImage set={set} large />
          <BoxActions set={set} planned={planned} bought={bought} />
        </div>
        <section className="box-set-members">
          <h3>Персонажи в наборе</h3>
          {members.length ? (
            members.map((member) => (
              <BoxMember key={member.item.slug} {...member} />
            ))
          ) : (
            <p className="muted">
              {set.missing
                ? "Нет данных о составе набора."
                : "В этом наборе нет миниатюр персонажей."}
            </p>
          )}
        </section>
      </div>
      <BoxOpportunities key={set.code} code={set.code} expanded />
      <p className="purchase-data-note">
        Состав набора — из каталога Jarvis. «Куплен» отмечает всех персонажей
        набора в коллекции.
      </p>
    </>
  );
}

export const ConnectedPurchases = observer(function ConnectedPurchases() {
  return (
    <PurchasesPage
      items={purchases.filtered.map((set) => ({ set }))}
      count={library.wishlist.size}
      boughtCount={library.bought.size}
      total={purchases.rows.length}
      tab={purchases.tab}
      query={purchases.query}
      error={purchases.error}
    />
  );
});
export const ConnectedBoxDetail = observer(function ConnectedBoxDetail() {
  if (!purchases.selected) return null;
  const set = purchases.box(purchases.selected);
  return (
    <BoxDetail
      set={set}
      members={set.characters.map((item) => ({
        item,
        character: catalog.byId.get(item.slug),
      }))}
    />
  );
});
