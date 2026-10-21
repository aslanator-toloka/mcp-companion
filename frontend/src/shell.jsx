import React, { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { catalog, library, ui, actions } from "./stores/index.js";
import { CatalogList } from "./catalog.jsx";
import { ConnectedPurchases, ConnectedBoxDetail } from "./purchases.jsx";
import { StaticShell } from "./shell-static.jsx";
export const Navigation = observer(function Navigation() {
  const items = [
    ["tournaments", "00", "Турниры"],
    ["all", "01", "Персонажи"],
    ["mine", "03", "Моя коллекция"],
    ["rosters", "04", "Ростеры"],
    ["battle", "08", "Бой"],
    ["purchases", "09", "Запланированные покупки"],
  ];
  const selected =
    ui.screen === "catalog" ? (catalog.onlyOwned ? "mine" : "all") : ui.screen;
  return (
    <nav aria-label="Разделы приложения">
      {items.map(([id, index, label]) => (
        <button
          key={id}
          disabled={!ui.ready}
          className={"nav-item" + (selected === id ? " selected" : "")}
          data-action={id}
          onClick={(event) => {
            event.stopPropagation();
            actions.navigate(id);
          }}
        >
          <span>{index}</span>
          {label}
          {id === "purchases" && (
            <b
              id="purchase-nav-count"
              className="purchase-nav-count"
              hidden={!library.wishlist.size}
            >
              {library.wishlist.size}
            </b>
          )}
        </button>
      ))}
      <button
        className="mobile-data quiet"
        data-action="data"
        onClick={(event) => {
          event.stopPropagation();
          actions.showData();
        }}
      >
        Данные
      </button>
    </nav>
  );
});
export const SidebarToggle = observer(function SidebarToggle() {
  useEffect(
    () =>
      document.documentElement.classList.toggle(
        "sidebar-is-collapsed",
        ui.collapsed,
      ),
    [],
  );
  return (
    <button
      id="sidebar-toggle"
      className="sidebar-toggle"
      type="button"
      aria-controls="app-sidebar"
      aria-expanded={!ui.collapsed}
      aria-label={ui.collapsed ? "Развернуть меню" : "Свернуть меню"}
      title={ui.collapsed ? "Развернуть меню" : "Свернуть меню"}
      onClick={ui.toggleSidebar}
    >
      <span aria-hidden="true">☰</span>
    </button>
  );
});
export const CatalogPanel = observer(function CatalogPanel() {
  const f = (name, event) =>
    catalog.setFilter(
      name,
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value,
    );
  return (
    <>
      <div className="heading">
        <div>
          <span className="eyebrow">01 / Каталог</span>
          <h1 id="page-title">
            {catalog.onlyOwned ? "Моя коллекция" : "Персонажи"}
          </h1>
          <p>Найти персонажа, посмотреть карту, отметить модель в коллекции.</p>
        </div>
        <span className="stage-label">На этом устройстве</span>
      </div>
      <div className="catalog-tools">
        <label className="search-label">
          <span className="sr-only">Поиск по имени или alter ego</span>
          <input
            id="search"
            type="search"
            placeholder="Имя персонажа или alter ego…"
            autoComplete="off"
            value={catalog.query}
            disabled={!ui.ready}
            onChange={(e) => f("query", e)}
          />
          <kbd>/</kbd>
        </label>
        <div className="filter-row">
          <label>
            Аффилиация
            <select
              id="affiliation"
              aria-label="Аффилиация"
              value={catalog.affiliation}
              onChange={(e) => {
                e.stopPropagation();
                f("affiliation", e);
              }}
            >
              <option value="">Все аффилиации</option>
              {catalog.affiliations.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label>
            Threat
            <select
              id="threat"
              aria-label="Threat"
              value={catalog.threat}
              onChange={(e) => {
                e.stopPropagation();
                f("threat", e);
              }}
            >
              <option value="">Любой Threat</option>
              {catalog.threats.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="check only-owned">
            <input
              id="only-owned"
              type="checkbox"
              checked={catalog.onlyOwned}
              onChange={(e) => {
                e.stopPropagation();
                f("onlyOwned", e);
                actions.catalogMode(catalog.onlyOwned);
              }}
            />
            Есть у меня
          </label>
          <button
            className="quiet"
            data-action="reset"
            onClick={(e) => {
              e.stopPropagation();
              catalog.reset();
              actions.catalogMode(false);
            }}
          >
            Сбросить
          </button>
        </div>
      </div>
      <div className="list-heading">
        <span id="result" role="status" aria-live="polite">
          {catalog.error
            ? "Каталог недоступен"
            : !ui.ready
              ? "Загружаем каталог…"
              : catalog.onlyOwned
                ? "Модели с отметкой «Есть у меня»"
                : `${catalog.filtered.length} записей · по алфавиту`}
        </span>
        <span className="column-note">
          Персонаж / версия <span>Threat</span>
          <span>Коллекция</span>
        </span>
      </div>
      <div id="characters" className="character-list" aria-label="Персонажи">
        {ui.ready ? (
          <CatalogList />
        ) : catalog.error ? (
          <div className="empty">
            <h3>Не удалось загрузить каталог</h3>
            <p>{catalog.error}</p>
            <button id="retry-load" onClick={() => actions.retry()}>
              Повторить
            </button>
          </div>
        ) : null}
      </div>
      <footer className="catalog-footer">
        Игровые версии и формы показаны отдельно. Тексты карт — на английском,
        как в Jarvis.
      </footer>
    </>
  );
});
export const Sidebar = observer(function Sidebar({ children }) {
  return (
    <aside id="app-sidebar" className="sidebar" hidden={ui.collapsed}>
      {children}
    </aside>
  );
});
export const Toast = observer(function Toast() {
  return (
    <div
      id="toast"
      role="status"
      aria-live="polite"
      className={ui.toast ? "show" : ""}
    >
      {ui.toast}
    </div>
  );
});
export const SourceDate = observer(function SourceDate() {
  return <small id="source-date">{ui.sourceDate}</small>;
});
export function AppShell() {
  return <StaticShell />;
}

export const Screen = observer(function Screen({ name, children, ...props }) {
  return (
    <section
      {...props}
      aria-label={
        {
          catalog: "Персонажи",
          rosters: "Ростеры",
          battle: "Бой",
          tournaments: "Турнирный архив",
          purchases: "Запланированные покупки",
        }[name]
      }
      hidden={ui.screen !== name}
    >
      {children}
    </section>
  );
});
