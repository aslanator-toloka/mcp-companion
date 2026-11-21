import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { album, ui, actions } from "./stores/index.js";
import {
  ALBUM_POCKETS,
  ALBUM_SHEETS,
  pageLabel,
} from "./tactics-album.js";
import { count } from "./common.jsx";
function AlbumCard({ slot, compact = false }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={"album-card" + (compact ? " compact" : "")}>
      {slot.art && !failed && (
        <img
          className="album-card-art"
          src={slot.art}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
      <span className="album-card-text">
        <span className="album-card-number">{slot.number}</span>
        <span className="album-card-name">{slot.name}</span>
        {!compact && (
          <span className="album-card-meta">
            {[slot.character, (slot.box + " " + slot.boxName).trim()]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </span>
    </span>
  );
}
const AlbumSearch = observer(function AlbumSearch() {
  const results = album.results,
    open = album.query.trim() !== "";
  return (
    <div className="album-search">
      <label className="search-label">
        <span className="sr-only">Поиск карты тактики по названию</span>
        <input
          id="album-search"
          type="search"
          placeholder="Название карты или персонаж…"
          autoComplete="off"
          value={album.query}
          aria-controls="album-results"
          onChange={(e) => album.setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") album.setQuery("");
            if (e.key === "Enter" && results[0]) album.jump(results[0].number);
          }}
        />
      </label>
      <div
        id="album-results"
        className="album-results"
        hidden={!open}
        role="list"
        aria-label="Найденные карты"
      >
        {results.map((slot) => (
          <button
            key={slot.number}
            type="button"
            role="listitem"
            className="album-hit"
            data-album-hit={slot.number}
            onClick={() => album.jump(slot.number)}
          >
            <AlbumCard slot={slot} compact />
            <span className="album-hit-where">
              <b>№ {slot.number}</b>
              стр. {slot.page} · {pageLabel(slot.page)}
            </span>
          </button>
        ))}
        {!results.length && (
          <p className="album-empty">
            В альбоме нет карт с «{album.query.trim()}»
          </p>
        )}
      </div>
    </div>
  );
});
const AlbumTabs = observer(function AlbumTabs() {
  const ref = useRef(null);
  useEffect(() => {
    const strip = ref.current,
      current = strip?.querySelector('[aria-current="page"]');
    if (!strip || !current) return;
    const frame = strip.getBoundingClientRect(),
      item = current.getBoundingClientRect();
    // Scroll only the tab strip, never the page.
    if (item.right > frame.right || item.left < frame.left)
      strip.scrollLeft +=
        item.left - frame.left - frame.width / 2 + item.width / 2;
  }, [album.page]);
  return (
    <nav ref={ref} className="album-tabs" aria-label="Страницы альбома">
      {Array.from({ length: album.lastPage }, (_, i) => i + 1).map((page) => (
        <button
          key={page}
          type="button"
          className={
            "album-tab" +
            (page <= album.usedPages ? " used" : "") +
            (page === album.page ? " selected" : "")
          }
          aria-current={page === album.page ? "page" : undefined}
          title={pageLabel(page)}
          onClick={() => album.setPage(page)}
        >
          {page}
        </button>
      ))}
    </nav>
  );
});
const AlbumPage = observer(function AlbumPage() {
  const slots = album.pageSlots,
    groups = [...new Set(slots.map((s) => s.group))],
    ref = useRef(null);
  useEffect(() => {
    if (album.highlight == null) return;
    ref.current
      ?.querySelector(`[data-album-number="${album.highlight}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [album.highlight, album.page]);
  return (
    <section
      ref={ref}
      className={"album-page" + (album.page % 2 ? "" : " back-side")}
      aria-label={"Страница " + album.page}
    >
      <div className="album-page-head">
        <div>
          <h2>
            Страница {album.page}
            <small>{pageLabel(album.page)}</small>
          </h2>
          <p>
            {groups.length ? groups.join(" · ") : "Свободная страница"}
            {slots.length
              ? ` · карты ${slots[0].number}–${slots[slots.length - 1].number}`
              : ""}
          </p>
        </div>
        <div className="album-page-nav">
          <button
            type="button"
            data-action="album-prev"
            disabled={album.page === 1}
            onClick={() => album.setPage(album.page - 1)}
          >
            ← Назад
          </button>
          <button
            type="button"
            data-action="album-next"
            disabled={album.page === album.lastPage}
            onClick={() => album.setPage(album.page + 1)}
          >
            Вперёд →
          </button>
        </div>
      </div>
      <div className="album-pockets">
        {Array.from({ length: ALBUM_POCKETS }, (_, i) => {
          const slot = slots.find((s) => s.pocket === i + 1);
          return slot ? (
            <button
              key={i}
              type="button"
              className={
                "album-pocket" +
                (slot.loose ? " loose" : "") +
                (album.highlight === slot.number ? " highlighted" : "")
              }
              data-album-number={slot.number}
              disabled={!slot.card}
              title={slot.card ? "Открыть карту" : undefined}
              onClick={() => actions.showGameCard("tactics", slot.slug)}
            >
              <AlbumCard slot={slot} />
            </button>
          ) : (
            <span key={i} className="album-pocket empty">
              пусто
            </span>
          );
        })}
      </div>
    </section>
  );
});
export const AlbumWorkspace = observer(function AlbumWorkspace() {
  const total = album.slots.length,
    overflow = total > ALBUM_POCKETS * ALBUM_SHEETS * 2;
  return (
    <>
      <div className="heading">
        <div>
          <span className="eyebrow">11 / Альбом</span>
          <h1>Альбом тактик</h1>
          <p>
            Ваш альбом карт тактик по номерам:{" "}
            {ALBUM_SHEETS} двусторонних листов по {ALBUM_POCKETS} кармашков.
          </p>
        </div>
        <span className="stage-label">
          {count(total, "карта", "карты", "карт")} · {album.usedPages} из{" "}
          {ALBUM_SHEETS * 2} стр.
        </span>
      </div>
      {!ui.ready ? null : album.error ? (
        <div className="empty">
          <h3>Альбом не загрузился</h3>
          <p>{album.error}</p>
        </div>
      ) : (
        <>
          <div className="album-tools">
            <AlbumSearch />
            <AlbumTabs />
          </div>
          {overflow && (
            <p className="notice" role="status">
              Карты не помещаются в {ALBUM_SHEETS} листов: последние уходят на
              страницы после {ALBUM_SHEETS * 2}.
            </p>
          )}
          <AlbumPage />
          <p className="album-note">
            Номера закреплены: новые карты всегда встают в конец альбома. Одна
            карта с разными артами занимает отдельные кармашки, копии с той же
            картинкой — один.
          </p>
        </>
      )}
    </>
  );
});
