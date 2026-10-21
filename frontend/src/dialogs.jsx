import React, { useEffect, useRef, useMemo } from "react";
import { observer } from "mobx-react-lite";
import {
  catalog,
  library,
  purchases,
  rosters,
  ui,
  actions,
} from "./stores/index.js";
import { CharacterDetail } from "./catalog.jsx";
import { ConnectedBoxDetail } from "./purchases.jsx";
import { StatControls, StatSurface } from "./cards.jsx";
export function Dialog({
  id,
  className,
  label,
  open,
  resetKey,
  onClose,
  children,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (open) {
      if (!el.open) el.showModal();
      el.scrollTop = 0;
    } else if (!open && el.open) el.close();
  }, [open, resetKey]);
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
const CharacterCard = observer(function CharacterCard() {
  const slug = catalog.selected,
    detail = catalog.details.get(slug);
  const view = useMemo(
    () => ({
      key: "catalog",
      slug,
      detail,
      form: catalog.selectedForm,
      side: catalog.selectedSide,
    }),
    [slug, detail, catalog.selectedForm, catalog.selectedSide],
  );
  if (catalog.detailError || !detail?.statCard)
    return catalog.detailError ? (
      <div className="empty">
        <h3>Карточка пока не загрузилась</h3>
        <p>{catalog.detailError}</p>
        <div className="actions">
          <button data-action="retry-card" onClick={catalog.retryDetail}>
            Повторить
          </button>
          <a
            href={catalog.byId.get(slug).sourceUrl}
            target="_blank"
            rel="noopener"
          >
            Открыть Jarvis ↗
          </a>
        </div>
      </div>
    ) : (
      <div className="loading">Загружаем полную карту…</div>
    );
  return (
    <StatSurface view={view}>
      <StatControls view={view} onSwitch={catalog.selectFace} />
    </StatSurface>
  );
});
export const CharacterModal = observer(function CharacterModal() {
  const c = catalog.byId.get(catalog.selected);
  return (
    <Dialog
      id="character-dialog"
      className="character-dialog"
      label="Карточка персонажа"
      open={!!c}
      resetKey={catalog.selected}
      onClose={catalog.close}
    >
      <div id="character-content">
        {c && (
          <CharacterDetail
            character={c}
            owned={library.owned.has(c.slug)}
            boxOwned={library.boxOwned.has(c.slug)}
            card={<CharacterCard />}
            boxes={(c.boxSets || [])
              .map((code) => purchases.byCode.get(code))
              .filter(Boolean)
              .map((set) => ({ set }))}
            boxError={purchases.error}
            rosters={library.snapshot.rosters.filter((r) =>
              r.characters.includes(c.slug),
            )}
            sourceDate={new Date(catalog.fetchedAt).toLocaleDateString("ru-RU")}
          />
        )}
      </div>
    </Dialog>
  );
});
export const BoxModal = observer(function BoxModal() {
  return (
    <Dialog
      id="box-set-dialog"
      className="box-set-dialog"
      label="Набор персонажей"
      open={!!purchases.selected}
      onClose={() => purchases.select(null)}
    >
      <div id="box-set-content">
        <ConnectedBoxDetail />
      </div>
    </Dialog>
  );
});
export const MembershipModal = observer(function MembershipModal() {
  const c = catalog.byId.get(catalog.selected);
  return (
    <Dialog
      id="roster-dialog"
      className="small-dialog"
      label="Ростеры"
      open={ui.membership && !!c}
      onClose={() => ui.setMembership(false)}
    >
      <div id="roster-content">
        {c && (
          <>
            <div className="dialog-heading">
              <div>
                <h2>Добавить в ростер</h2>
                <p>{c.name} · можно выбрать несколько.</p>
              </div>
              <button
                className="quiet close"
                data-action="close-roster"
                aria-label="Закрыть выбор ростеров"
                onClick={() => ui.setMembership(false)}
              >
                ×
              </button>
            </div>
            {rosters.records.length ? (
              rosters.records.map((r) => (
                <label key={r.id} className="check roster-pick">
                  <input
                    type="checkbox"
                    data-roster={r.id}
                    checked={r.characters.includes(c.slug)}
                    onChange={(e) =>
                      actions.membership(r.id, c.slug, e.target.checked)
                    }
                  />
                  {r.name}
                </label>
              ))
            ) : (
              <p className="muted">
                Сохранённых ростеров пока нет. Создайте первый.
              </p>
            )}
            <form
              id="create-roster"
              className="create-roster"
              onSubmit={(e) => {
                e.preventDefault();
                actions.createMembershipRoster(c.slug);
              }}
            >
              <label className="field">
                Название нового ростера
                <input
                  name="name"
                  maxLength={100}
                  placeholder="Например: Avengers · основной"
                  required
                  value={ui.rosterName}
                  onChange={(e) => ui.setRosterName(e.target.value)}
                />
              </label>
              <div className="actions">
                <button className="primary" type="submit">
                  Создать и добавить
                </button>
                <button
                  type="button"
                  data-action="close-roster"
                  onClick={() => ui.setMembership(false)}
                >
                  Готово
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </Dialog>
  );
});
export const DataModal = observer(function DataModal() {
  const file = useRef(null);
  return (
    <Dialog
      id="data-dialog"
      className="small-dialog"
      label="Данные приложения"
      open={!!ui.dataDialog}
      onClose={ui.closeData}
    >
      <div id="data-content">
        {ui.dataDialog === "confirm" ? (
          <>
            <div className="dialog-heading">
              <h2>Восстановить данные?</h2>
            </div>
            <p>
              Коллекция, ростеры, группы, запланированные и купленные наборы
              будут заменены содержимым файла. В старых файлах без списков
              наборов эти списки будут пустыми. Если файл содержит партии, они
              тоже будут восстановлены.
            </p>
            <div className="actions">
              <button
                id="confirm-import"
                className="primary"
                onClick={() => actions.restore()}
              >
                Восстановить
              </button>
              <button data-action="close-data" onClick={ui.closeData}>
                Отмена
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="dialog-heading">
              <div>
                <h2>Данные приложения</h2>
                <p>
                  Коллекция, ростеры, группы и партии хранятся в этом браузере.
                </p>
              </div>
              <button
                className="quiet close"
                data-action="close-data"
                aria-label="Закрыть данные"
                onClick={ui.closeData}
              >
                ×
              </button>
            </div>
            <p>
              Полные карты и портреты загружены из Jarvis. Для переноса
              используйте экспорт JSON и импорт здесь.
            </p>
            <div className="actions">
              <button
                className="primary"
                data-action="export"
                onClick={() => actions.export()}
              >
                Экспорт JSON
              </button>
              <button
                data-action="import"
                onClick={() => file.current?.click()}
              >
                Импорт JSON
              </button>
            </div>
            <input
              ref={file}
              id="import-file"
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files[0];
                e.target.value = "";
                if (f) actions.readImport(f);
              }}
            />
            <p className="notice">
              Экспорт включает отметки наличия, ростеры, группы, запланированные
              и купленные наборы и партии. Несохранённые правки и состояние
              интерфейса не экспортируются.
            </p>
          </>
        )}
      </div>
    </Dialog>
  );
});
