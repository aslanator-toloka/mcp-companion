import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { observer } from "mobx-react-lite";
import { photoImport as scan, rosters, battle } from "../stores/index.js";
import { UIIcon } from "../ui-icons.jsx";
import { useDialogBackdrop } from "../dialog-backdrop.js";
import { PHOTO_LIMIT } from "./recognizer.js";
const labels = {
  characters: ["Персонажи", "персонажей"],
  tactics: ["Тактики", "тактики"],
  crises: ["Кризисы", "кризисы"],
};
// Mount the review synchronously so the browser file input keeps this user gesture.
export function startPhotoCapture(open) {
  flushSync(open);
  if (!scan.target) return;
  if (scan.native) void scan.chooseNative("camera");
  else document.querySelector('#photo-import-dialog input[capture="environment"]')?.click();
}
export const PhotoButton = observer(function PhotoButton({
  type = "roster",
  kind,
  side = "opponent",
  mission = null,
  className = "",
  label = "По фото",
}) {
  const actualKind = kind || rosters.tab;
  const unavailable =
    type === "battle" &&
    (!battle.current ||
      battle.current.status === "finished" ||
      (battle.activeNetwork &&
        battle.current.status === "preparing" &&
        side !== battle.ownSide &&
        actualKind !== "crises"));
  if (unavailable) return null;
  return (
    <button
      type="button"
      className={`photo-add-button ${className}`}
      data-photo-kind={actualKind}
      data-photo-target={type}
      data-photo-side={type === "battle" ? side : undefined}
      aria-label={`Добавить ${labels[actualKind][1]} по фото${type === "battle" ? " · " + battle.label(side) : " в ростер"}`}
      onClick={(event) => {
        event.stopPropagation();
        startPhotoCapture(() => {
          type === "roster"
            ? scan.openRoster(actualKind)
            : scan.openBattle(side, actualKind, mission);
        });
      }}
    >
      <UIIcon name="camera" />
      {label}
    </button>
  );
});
const ManualSearch = observer(function ManualSearch() {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    list = useRef(null);
  const items = scan.suggestions,
    disabled = scan.busy || scan.applying;
  useEffect(() => {
    const el = list.current,
      item = el?.children[active];
    if (!el || !item) return;
    if (item.offsetTop < el.scrollTop) el.scrollTop = item.offsetTop;
    else if (
      item.offsetTop + item.offsetHeight >
      el.scrollTop + el.clientHeight
    )
      el.scrollTop = item.offsetTop + item.offsetHeight - el.clientHeight;
  }, [active, scan.query]);
  const choose = (slug) => {
    scan.addManual(slug);
    setOpen(false);
    setActive(0);
  };
  return (
    <div
      className="photo-manual-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor="photo-card-search">
        Не нашлось? Добавьте из каталога
      </label>
      <div className="photo-search-input">
        <UIIcon name="search" />
        <input
          id="photo-card-search"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open && !!scan.query.trim()}
          aria-controls="photo-card-suggestions"
          aria-activedescendant={
            open && items[active]
              ? `photo-option-${items[active].slug}`
              : undefined
          }
          placeholder="Начните вводить название…"
          value={scan.query}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            scan.setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (["ArrowDown", "ArrowUp"].includes(e.key)) {
              e.preventDefault();
              setOpen(true);
              setActive(
                (n) =>
                  (n + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
                  Math.max(1, items.length),
              );
            } else if (e.key === "Enter" && open && items[active]) {
              e.preventDefault();
              choose(items[active].slug);
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }
          }}
        />
      </div>
      <div
        id="photo-card-suggestions"
        ref={list}
        role="listbox"
        aria-label="Карты из каталога"
        hidden={!open || !scan.query.trim()}
      >
        {items.map((c, i) => (
          <button
            type="button"
            role="option"
            aria-selected={i === active}
            id={`photo-option-${c.slug}`}
            key={c.slug}
            tabIndex={-1}
            onPointerDown={(e) => e.preventDefault()}
            onPointerMove={() => setActive(i)}
            onClick={() => choose(c.slug)}
          >
            <span>
              <strong>{c.name}</strong>
              {c.alterEgo && <small>{c.alterEgo}</small>}
            </span>
            {scan.rows.some((r) => r.slug === c.slug) && (
              <small>В списке</small>
            )}
          </button>
        ))}
        {!items.length && (
          <p className="muted">Совпадений нет. Попробуйте другое название.</p>
        )}
      </div>
    </div>
  );
});
const RecognizedRow = observer(function RecognizedRow({ row }) {
  const c = scan.entry(row),
    problem = scan.problem(row),
    existing = scan.existing(row);
  return (
    <li
      className={`photo-result ${!row.exact || row.ambiguous ? "needs-review" : ""}`}
      data-photo-card={row.slug || row.key}
    >
      <label className="photo-result-choice">
        <input
          type="checkbox"
          checked={row.checked && !problem}
          disabled={!!problem || existing || scan.busy || scan.applying}
          aria-label={`Добавить ${row.name}`}
          onChange={(e) => scan.toggleRow(row.key, e.target.checked)}
        />
        {c?.portrait ? (
          <img className="photo-result-avatar" src={c.portrait} alt="" />
        ) : (
          <span
            className={`photo-card-kind kind-${scan.target.kind}`}
            aria-hidden="true"
          >
            {scan.target.kind === "tactics"
              ? "TT"
              : c?.type === "Secure"
                ? "S"
                : scan.target.kind === "crises"
                  ? "E"
                  : "?"}
          </span>
        )}
        <span className="photo-result-name">
          <strong>{row.name}</strong>
          <small>
            {c?.alterEgo ||
              (c?.type === "Secure"
                ? "Secure"
                : c?.type === "Extraction"
                  ? "Extract"
                  : "")}
            {c?.threat ? ` · Threat ${c.threat}` : ""}
          </small>
        </span>
      </label>
      <div className="photo-result-status">
        {existing ? (
          <span className="photo-already">Уже есть</span>
        ) : problem && !row.ambiguous ? (
          <span className="photo-warning">{problem}</span>
        ) : !row.exact || row.ambiguous ? (
          <span className="photo-warning">
            {row.ambiguous ? "Нужно уточнить карту" : "Проверьте название"}
          </span>
        ) : (
          <span className="photo-exact">Название совпало</span>
        )}
      </div>
      {(!row.exact || row.ambiguous) && (
        <label className="photo-correction">
          Подходящая карта
          <select
            value={row.slug || ""}
            disabled={scan.busy || scan.applying}
            onChange={(e) => scan.chooseRow(row.key, e.target.value)}
            aria-label={`Уточнить: ${row.evidence[0]?.text || row.name}`}
          >
            <option value="" disabled>
              Выберите карту…
            </option>
            {row.options.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.name}
                {o.alterEgo ? ` · ${o.alterEgo}` : ""}
              </option>
            ))}
          </select>
          {row.evidence[0] && <small>На фото: «{row.evidence[0].text}»</small>}
        </label>
      )}
    </li>
  );
});
export const PhotoImportModal = observer(function PhotoImportModal() {
  const dialog = useRef(null),
    files = useRef(null),
    camera = useRef(null),
    first = useRef(null);
  const open = !!scan.target,
    backdrop = useDialogBackdrop(scan.close);
  useEffect(() => {
    const el = dialog.current;
    if (open && !el.open) {
      el.showModal();
      first.current?.focus({ preventScroll: true });
    } else if (!open && el.open) el.close();
  }, [open]);
  useEffect(() => {
    const el = dialog.current;
    if (!open) return;
    const heading = el.querySelector(".photo-heading"),
      footer = el.querySelector(".photo-footer");
    const update = () => {
      el.style.setProperty(
        "--photo-heading-height",
        `${heading.offsetHeight}px`,
      );
      el.style.setProperty("--photo-footer-height", `${footer.offsetHeight}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(heading);
    observer.observe(footer);
    return () => observer.disconnect();
  }, [open]);
  const kind = scan.target?.kind || "characters",
    disabled = scan.busy || scan.applying || scan.photos.length >= PHOTO_LIMIT;
  return (
    <dialog
      id="photo-import-dialog"
      ref={dialog}
      {...backdrop}
      className="photo-import-dialog"
      aria-labelledby="photo-import-title"
      aria-describedby="photo-import-description"
      onCancel={(e) => {
        e.preventDefault();
        scan.close();
      }}
      onClose={() => {
        if (scan.target) scan.close();
      }}
    >
      {open && (
        <>
          <div className="dialog-heading photo-heading">
            <div>
              <span className="eyebrow">{scan.state.title}</span>
              <h2 id="photo-import-title">{labels[kind][0]} по фото</h2>
              <p id="photo-import-description">
                Проверьте найденные карты перед добавлением.
              </p>
            </div>
            <button
              type="button"
              className="quiet close"
              aria-label="Закрыть распознавание"
              disabled={scan.applying}
              onClick={scan.close}
            >
              <UIIcon name="close" />
            </button>
          </div>
          <div className="photo-dialog-body">
            {scan.state.error && (
              <div className="notice" role="alert">
                {scan.state.error}
              </div>
            )}
            <div className="photo-acquisition">
              <button
                ref={first}
                type="button"
                className="primary"
                disabled={disabled}
                onClick={() =>
                  scan.native
                    ? scan.chooseNative("camera")
                    : camera.current.click()
                }
              >
                <UIIcon name="camera" />
                Сфотографировать
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  scan.native
                    ? scan.chooseNative("gallery")
                    : files.current.click()
                }
              >
                <UIIcon name="image" />
                Выбрать фото
              </button>
              <input
                ref={camera}
                className="sr-only"
                tabIndex={-1}
                aria-label="Сфотографировать карты"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  scan.addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                ref={files}
                className="sr-only"
                tabIndex={-1}
                aria-label="Фотографии карт"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  scan.addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="photo-hint">
              Снимайте сторону с названием, без бликов; мелкие карты лучше
              фотографировать по 2–4 за раз. Можно добавить несколько снимков —
              повторы объединим. Фотографии обрабатываются на этом устройстве,
              правила берём из каталога приложения.
            </p>
            {scan.busy && (
              <div className="photo-progress" role="status" aria-live="polite">
                <span>{scan.stage}</span>
                <progress
                  max="1"
                  value={scan.progress}
                  aria-label="Распознавание фотографий"
                />
              </div>
            )}
            {scan.error && (
              <div className="notice photo-error" role="alert">
                {scan.error}
              </div>
            )}
            {!!scan.photos.length && (
              <div
                className="photo-sources"
                aria-label="Добавленные фотографии"
              >
                {scan.photos.map((p, i) => (
                  <article className="photo-source" key={p.id}>
                    <div className="photo-source-image">
                      {p.preview ? (
                        <img
                          src={p.preview}
                          alt={`Фото ${i + 1}: ${p.name}`}
                          style={{ transform: `rotate(${p.rotation}deg)` }}
                        />
                      ) : (
                        <UIIcon name="roster" />
                      )}
                    </div>
                    <strong>{p.textOnly ? "Текст" : `Фото ${i + 1}`}</strong>
                    <small className={p.error ? "photo-warning" : ""}>
                      {p.error
                        ? "Не прочитано"
                        : p.result
                          ? "Обработано"
                          : "Обрабатывается…"}
                    </small>
                    {p.error && (
                      <p className="photo-source-error" role="alert">
                        {p.error}
                      </p>
                    )}
                    <div className="photo-source-actions">
                      {!p.textOnly && (
                        <>
                          <button
                            type="button"
                            disabled={scan.busy || scan.applying}
                            onClick={() => scan.rotate(p.id, -90)}
                            aria-label={`Повернуть фото ${i + 1} влево и распознать снова`}
                          >
                            ↶ 90°
                          </button>
                          <button
                            type="button"
                            disabled={scan.busy || scan.applying}
                            onClick={() => scan.rotate(p.id, 90)}
                            aria-label={`Повернуть фото ${i + 1} вправо и распознать снова`}
                          >
                            ↷ 90°
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="quiet"
                        disabled={scan.busy || scan.applying}
                        onClick={() => scan.removePhoto(p.id)}
                        aria-label={`Убрать фото ${i + 1}`}
                      >
                        <UIIcon name="close" />
                      </button>
                    </div>
                    {p.result && (
                      <details className="photo-raw">
                        <summary>Прочитанный текст</summary>
                        <pre>
                          {String(p.result.text || "").slice(0, 12000) ||
                            "Текст не найден"}
                        </pre>
                      </details>
                    )}
                  </article>
                ))}
              </div>
            )}
            {scan.target.type === "battle" && (
              <div className="photo-battle-note">
                {kind === "crises"
                  ? "Для боя выберите по одной карте Secure и Extract. Выбранные кризисы заменят текущие миссии."
                  : `${scan.deps.battle.label(scan.target.side)}: добавляем в отряд этой партии. Существующие бойцы, HP и сыгранные тактики сохранятся.`}
              </div>
            )}
            <div className="photo-result-heading">
              <h3>Найдено: {scan.rows.length}</h3>
              <span>
                Выбрано {scan.selected.length} · новых {scan.pendingCount}
              </span>
            </div>
            {scan.rows.length ? (
              <ul className="photo-results" aria-label="Распознанные карты">
                {scan.rows.map((row) => (
                  <RecognizedRow key={row.key} row={row} />
                ))}
              </ul>
            ) : (
              <div className="photo-empty">
                <UIIcon name="camera" />
                <p>
                  {scan.photos.length && !scan.busy
                    ? "Не удалось уверенно найти названия. Снимите карты ближе, поверните фото или добавьте недостающее через поиск."
                    : "Сфотографируйте карты — найденные названия появятся здесь."}
                </p>
              </div>
            )}
            {!!scan.missionChanges.length && (
              <div className="notice">
                <strong>Будут заменены миссии:</strong>
                {scan.missionChanges.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </div>
            )}
            <ManualSearch />
            <details
              className="photo-text-import"
              open={scan.manualOpen}
              onToggle={(e) => {
                if (e.currentTarget.open !== scan.manualOpen)
                  scan.toggleManual();
              }}
            >
              <summary>Вставить уже распознанный текст</summary>
              <label htmlFor="photo-recognized-text">
                Названия карт, каждое с новой строки
              </label>
              <textarea
                id="photo-recognized-text"
                rows="4"
                maxLength="20000"
                value={scan.manualText}
                disabled={scan.busy || scan.applying}
                onChange={(e) => scan.setManualText(e.target.value)}
              />
              <button
                type="button"
                disabled={!scan.manualText.trim() || scan.busy || scan.applying}
                onClick={scan.recognizeText}
              >
                Найти названия в тексте
              </button>
            </details>
          </div>
          <div className="photo-footer">
            <div aria-live="polite">
              <strong>
                {scan.pendingCount
                  ? `Добавить: ${scan.pendingCount}`
                  : "Новые карты не выбраны"}
              </strong>
              {scan.selected.length > 0 && scan.selectionProblem && (
                <small className="photo-warning">{scan.selectionProblem}</small>
              )}
              {!!scan.rows.length && scan.uncertainCount > 0 && (
                <small>Проверьте неоднозначные совпадения.</small>
              )}
            </div>
            <div className="actions">
              <button
                type="button"
                disabled={scan.applying}
                onClick={scan.close}
              >
                {scan.busy ? "Отменить распознавание" : "Отмена"}
              </button>
              <button
                type="button"
                className="primary"
                disabled={
                  scan.busy ||
                  scan.applying ||
                  !scan.pendingCount ||
                  !!scan.selectionProblem
                }
                onClick={scan.apply}
              >
                {scan.applying
                  ? "Добавляю…"
                  : scan.target.type === "roster"
                    ? "Добавить в ростер"
                    : "Добавить в бой"}
              </button>
            </div>
          </div>
        </>
      )}
    </dialog>
  );
});
