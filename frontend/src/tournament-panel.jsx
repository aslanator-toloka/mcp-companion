import React, { useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { tournaments as t, ui, actions } from "./stores/index.js";
import {
  TournamentCharacters,
  TournamentAffiliations,
  TournamentPlayers,
  TournamentOverview,
  TournamentRosters,
} from "./tournaments.jsx";
import { CharacterRatingPanel } from "./character-rating.jsx";
function ArchiveDialog({ openState, children, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (openState && !el.open) el.showModal();
    else if (!openState && el.open) el.close();
  }, [openState]);
  return (
    <dialog
      {...props}
      ref={ref}
      onClose={(event) => {
        if (event.currentTarget.open) return;
        if (t.dialog) t.closeDialog();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          t.closeDialog();
      }}
    >
      {children}
    </dialog>
  );
}
const ArchiveSection0 = observer(function ArchiveSection0() {
  return (
    <section className={"at-intro"}>
      <div>
        <p className={"at-eyebrow"}>{"ТУРНИРНЫЙ АРХИВ / 2026"}</p>
        <h1>{"Турнирные ростеры"}</h1>
        <p className={"at-intro-copy"}>
          {
            "Выбери персонажа или игрока и посмотри турнирные составы со всеми результатами — от побед до поражений."
          }
        </p>
      </div>
      <div className={"at-snapshot-counts"} aria-label={"Состав архива"}>
        <div>
          <strong id={"at-total-rosters"}>{t.data.meta.rosters}</strong>
          <span>{"ростеров"}</span>
        </div>
        <div>
          <strong id={"at-total-events"}>{t.data.meta.events}</strong>
          <span>{"событий"}</span>
        </div>
        <div>
          <strong id={"at-total-characters"}>{t.data.characters.length}</strong>
          <span>{"персонажей"}</span>
        </div>
      </div>
    </section>
  );
});
const ArchiveSection1 = observer(function ArchiveSection1() {
  return (
    <section
      className={"at-affiliation-bar"}
      aria-label={"Фильтр турниров по аффилиациям"}
    >
      <div className={"at-affiliation-heading"}>
        <strong>{"Аффилиации турнира"}</strong>
        <small>{"Можно выбрать несколько"}</small>
      </div>
      <button
        id={"at-affiliation-picker"}
        className={"at-affiliation-picker"}
        type={"button"}
        aria-haspopup={"dialog"}
        aria-controls={"at-affiliation-dialog"}
        onClick={() => {
          t.openDialog("affiliation");
        }}
      >
        <span id={"at-affiliation-label"}>
          {t.selectedAffiliations.length
            ? t.selectedAffiliations.join(" · ")
            : "Все аффилиации"}
        </span>
        <span aria-hidden={"true"}>{"⌄"}</span>
      </button>
      <ArchiveDialog
        id={"at-affiliation-dialog"}
        className={"at-affiliation-dialog"}
        aria-labelledby={"at-affiliation-title"}
        openState={t.dialog === "affiliation"}
      >
        <div className={"at-affiliation-dialog-head"}>
          <div>
            <p className={"at-eyebrow"}>{"ВСЕ ВЫСТУПЛЕНИЯ"}</p>
            <h2 id={"at-affiliation-title"}>{"Аффилиации"}</h2>
          </div>
          <button
            id={"at-affiliation-close"}
            type={"button"}
            aria-label={"Закрыть выбор аффилиаций"}
            onClick={() => {
              t.closeDialog();
            }}
          >
            {"×"}
          </button>
        </div>
        <p className={"at-affiliation-description"}>
          {
            "Баллы по оценённым выступлениям с учётом выбранных стран, включая неудачные результаты. Среднее сглажено одним нулевым выступлением; при менее четырёх выступлениях — 0. Выбери одну или несколько аффилиаций: баллы персонажей и ростеры будут показаны для любой из выбранных."
          }
        </p>
        <div className={"at-affiliation-tools"}>
          <label>
            {"Сортировка "}
            <select
              id={"at-affiliation-sort"}
              aria-label={"Сортировка аффилиаций"}
              value={t.affiliationSort}
              onChange={(e) => t.setField("affiliationSort", e.target.value)}
            >
              <option value={"points"}>{"По общим баллам"}</option>
              <option value={"average"}>{"По средним баллам"}</option>
              <option value={"name"}>{"По алфавиту"}</option>
            </select>
          </label>
          <button
            id={"at-affiliation-clear"}
            type={"button"}
            onClick={() => {
              t.clearAffiliations();
            }}
            disabled={!t.affiliations.size}
          >
            {"Сбросить"}
          </button>
        </div>
        <div className={"at-affiliation-columns"} aria-hidden={"true"}>
          <span>{"№"}</span>
          <span>{"Аффилиация / выступления"}</span>
          <span>{"Всего"}</span>
          <span>{"Ср. сглаж."}</span>
        </div>
        <div
          id={"at-affiliation-options"}
          className={"at-affiliation-options"}
          role={"group"}
          aria-label={"Аффилиации ростеров"}
        >
          <TournamentAffiliations
            rows={t.affiliationRows}
            selected={[...t.affiliations]}
          />
        </div>
        <div className={"at-affiliation-dialog-foot"}>
          <span
            id={"at-affiliation-selected-count"}
            role={"status"}
            aria-live={"polite"}
          >
            {t.affiliations.size
              ? "Выбрано: " + t.affiliations.size
              : "Все аффилиации"}
          </span>
          <button
            id={"at-affiliation-done"}
            type={"button"}
            onClick={() => {
              t.closeDialog();
            }}
          >
            {"Готово"}
          </button>
        </div>
      </ArchiveDialog>
      <div
        id={"at-affiliation-chips"}
        className={"at-affiliation-chips"}
        aria-label={"Выбранные аффилиации"}
        hidden={!t.affiliations.size}
      >
        {t.selectedAffiliations.map((name) => (
          <button
            key={name}
            className="at-affiliation-chip"
            data-remove-affiliation={name}
            aria-label={"Убрать аффилиацию " + name}
            onClick={() => t.toggleAffiliation(name, false)}
          >
            {name} ×
          </button>
        ))}
      </div>
    </section>
  );
});
const TournamentCountries = observer(function TournamentCountries() {
  return (
    <section
      className="at-affiliation-bar at-country-bar"
      aria-label="Фильтр турниров по странам"
    >
      <div className="at-affiliation-heading">
        <strong>Страны</strong>
        <small>Турниры и игроки</small>
      </div>
      <label className="at-country-field">
        Страна турнира
        <select
          id="at-event-country"
          aria-label="Страна проведения турнира"
          value={t.eventCountry}
          onChange={(e) => t.setField("eventCountry", e.target.value)}
        >
          <option value="">Все страны турниров</option>
          {t.geography.options.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} · {c.count} турниров
            </option>
          ))}
          <option value="__unknown__">
            Страна не указана · {t.geography.unknownEvents} турниров
          </option>
        </select>
      </label>
      <label className="at-country-field">
        Страна игрока
        <select
          id="at-roster-country"
          aria-label="Страна игрока в турнирах"
          value={t.rosterCountry}
          onChange={(e) => t.setField("rosterCountry", e.target.value)}
        >
          <option value="">Все страны игроков</option>
          {t.countries.map(([code, c]) => (
            <option key={code} value={code}>
              {c.name} · {c.count} игроков
            </option>
          ))}
          <option value="__unknown__">
            Страна не указана ·{" "}
            {t.allPlayers.filter((p) => !p.countryCode).length} игроков
          </option>
        </select>
      </label>
      <button
        type="button"
        className="quiet"
        disabled={!t.eventCountry && !t.rosterCountry}
        onClick={t.clearCountries}
      >
        Сбросить страны
      </button>
      <p className="at-country-description">
        Оба фильтра применяются вместе к ростерам, баллам персонажей и
        аффилиаций, а также результатам в выборе игрока.
      </p>
    </section>
  );
});
const ArchiveSection2 = observer(function ArchiveSection2() {
  return (
    <section
      className={"at-affiliation-bar at-player-bar"}
      aria-label={"Фильтр турниров по игроку"}
    >
      <div className={"at-affiliation-heading"}>
        <strong>{"Игрок турнира"}</strong>
        <small>{"Выбери игрока или смотри всех"}</small>
      </div>
      <button
        id={"at-player-picker"}
        className={"at-affiliation-picker"}
        type={"button"}
        aria-haspopup={"dialog"}
        aria-controls={"at-player-dialog"}
        onClick={() => {
          t.openDialog("player");
        }}
      >
        <span id={"at-player-label"}>
          {t.selectedPlayer
            ? t.playersById.get(t.selectedPlayer).name
            : "Все игроки"}
        </span>
        <span aria-hidden={"true"}>{"⌄"}</span>
      </button>
      <div
        id={"at-player-actions"}
        className={"at-player-actions"}
        hidden={!t.selectedPlayer}
      >
        <button
          id={"at-player-all"}
          type={"button"}
          onClick={() => {
            t.choosePlayer(t.selectedPlayer, true);
          }}
          hidden={!t.selectedPlayer}
        >
          {"Все ростеры игрока"}
        </button>
        <button
          id={"at-player-clear"}
          type={"button"}
          onClick={() => {
            t.choosePlayer(null);
          }}
          disabled={!t.selectedPlayer}
        >
          {"Сбросить игрока"}
        </button>
      </div>
      <ArchiveDialog
        id={"at-player-dialog"}
        className={"at-affiliation-dialog at-player-dialog"}
        aria-labelledby={"at-player-title"}
        openState={t.dialog === "player"}
      >
        <div className={"at-affiliation-dialog-head"}>
          <div>
            <p className={"at-eyebrow"}>{"ИГРОКИ / ТУРНИРНЫЙ АРХИВ"}</p>
            <h2 id={"at-player-title"}>{"Выбрать игрока"}</h2>
          </div>
          <button
            id={"at-player-close"}
            type={"button"}
            aria-label={"Закрыть выбор игрока"}
            onClick={() => {
              t.closeDialog();
            }}
          >
            {"×"}
          </button>
        </div>
        <p
          id={"at-player-score-scope"}
          className={"at-affiliation-description"}
        >{`Баллы и выступления: ${t.playerAffiliation ? (t.playerAffiliation === "__none__" ? "без указанной аффилиации" : t.playerAffiliation) : "все аффилиации игрока"}. Учитываются выбранные страны турниров и игроков. Среднее сглажено; до 2 оценённых выступлений в этой выборке — 0.`}</p>
        <label className={"at-search-box at-player-search"}>
          <input
            id={"at-player-search"}
            type={"search"}
            placeholder={"Имя, ID, страна или аффилиация…"}
            aria-label={"Поиск игрока"}
            autoComplete={"off"}
            value={t.playerQuery}
            onChange={(e) => t.setField("playerQuery", e.target.value)}
          />
        </label>
        <div className={"at-affiliation-tools at-player-tools"}>
          <label>
            {"Аффилиация "}
            <select
              id={"at-player-affiliation"}
              aria-label={"Аффилиация игроков"}
              value={t.playerAffiliation}
              onChange={(e) => t.setField("playerAffiliation", e.target.value)}
            >
              <option value={""}>{"Все аффилиации"}</option>
              {t.affiliationNames.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
              <option value="__none__">Без указанной аффилиации</option>
            </select>
          </label>
          <label>
            {"Страна "}
            <select
              id={"at-player-country"}
              aria-label={"Страна игрока"}
              value={t.playerCountry}
              onChange={(e) => t.setField("playerCountry", e.target.value)}
            >
              <option value={""}>{"Все страны"}</option>
              {t.countries.map(([code, c]) => (
                <option key={code} value={code}>
                  {c.name} · {c.count}
                </option>
              ))}
              <option value="__unknown__">
                Страна не указана ·{" "}
                {t.allPlayers.filter((p) => !p.countryCode).length}
              </option>
            </select>
          </label>
          <label>
            {"Сортировка "}
            <select
              id={"at-player-sort"}
              aria-label={"Сортировка игроков"}
              value={t.playerSort}
              onChange={(e) => t.setField("playerSort", e.target.value)}
            >
              <option value={"points"}>{"По общим баллам"}</option>
              <option value={"average"}>{"По средним баллам"}</option>
              <option value={"name"}>{"По имени"}</option>
              <option value={"affiliation"}>{"По аффилиациям"}</option>
            </select>
          </label>
        </div>
        <p className={"at-player-sort-note"}>
          {
            "Страна — из флага игрока в Longshanks. Метки показывают аффилиации за весь архив. При выборе аффилиации баллы, среднее и число выступлений считаются только по ней; сортировка по баллам использует эти же значения."
          }
        </p>
        <div className={"at-player-columns"} aria-hidden={"true"}>
          <span>{"№"}</span>
          <span>{"Игрок / аффилиации"}</span>
          <span>{"Всего"}</span>
          <span>{"Ср. сглаж."}</span>
        </div>
        <div
          id={"at-player-options"}
          className={"at-player-options"}
          role={"group"}
          aria-label={"Игроки турниров"}
        >
          <TournamentPlayers
            rows={t.playerRows.slice(0, t.playerLimit)}
            selected={t.selectedPlayer}
          />
        </div>
        <button
          id={"at-player-more"}
          className={"at-player-more"}
          type={"button"}
          onClick={() => {
            t.morePlayers();
          }}
          hidden={t.playerRows.length <= t.playerLimit}
        >{`Показать ещё ${Math.min(60, t.playerRows.length - t.playerLimit)} игроков`}</button>
        <div className={"at-affiliation-dialog-foot"}>
          <span
            id={"at-player-status"}
            role={"status"}
            aria-live={"polite"}
          >{`${t.playerRows.length} / ${t.allPlayers.length} игроков${t.selectedPlayer ? " · выбран: " + t.playersById.get(t.selectedPlayer).name : ""}`}</span>
          <button
            id={"at-player-done"}
            type={"button"}
            onClick={() => {
              t.closeDialog();
            }}
          >
            {"Готово"}
          </button>
        </div>
      </ArchiveDialog>
    </section>
  );
});
const ArchiveSection3 = observer(function ArchiveSection3() {
  return (
    <section className={"at-collection-bar"}>
      <div>
        <strong>{"Общая коллекция"}</strong>
        <p
          id={"at-collection-status"}
          role={"status"}
        >{`Моя коллекция · ${t.readyRows.length} доступных ростеров`}</p>
      </div>
      <div className={"at-collection-actions"}>
        <button
          id={"at-available-rosters"}
          type={"button"}
          onClick={() => {
            t.chooseCollection();
          }}
          disabled={!ui.ready}
        >
          {"Ростеры из моих персонажей"}
        </button>
        <button
          type="button"
          data-action="mine"
          onClick={() => actions.navigate("mine")}
        >
          {"Изменить коллекцию"}
        </button>
      </div>
      <small>
        {
          "Сравниваются версии персонажей. Тактики и кризисы в проверку наличия не входят."
        }
      </small>
    </section>
  );
});
const ArchiveSection4 = observer(function ArchiveSection4() {
  return (
    <>
      <CharacterRatingPanel />
      <div className={"at-archive-layout"}>
        <aside className={"at-character-panel"} aria-label={"Выбор персонажа"}>
          <div className={"at-panel-top"}>
            <h2>
              {"Персонажи "}
              <span
                id={"at-character-total"}
              >{`${t.characterRows.length} / ${t.data.characters.length}`}</span>
            </h2>
            <label className={"at-search-box"}>
              <svg viewBox={"0 0 24 24"} aria-hidden={"true"}>
                <circle cx={"10.5"} cy={"10.5"} r={"6.5"} />
                <path d={"m16 16 4 4"} />
              </svg>
              <input
                id={"at-character-search"}
                type={"search"}
                placeholder={"Имя или alter ego…"}
                autoComplete={"off"}
                aria-label={"Поиск персонажа"}
                value={t.characterQuery}
                onChange={(e) => t.setField("characterQuery", e.target.value)}
              />
            </label>
            <div className={"at-character-toolbar"}>
              <label className={"at-checkbox"}>
                <input
                  id={"at-only-used"}
                  type={"checkbox"}
                  checked={t.onlyUsed}
                  onChange={(e) => t.setField("onlyUsed", e.target.checked)}
                />
                {" Только с ростерами"}
              </label>
              <select
                id={"at-character-sort"}
                aria-label={"Сортировка персонажей"}
                value={t.characterSort}
                onChange={(e) => t.setField("characterSort", e.target.value)}
              >
                <option value={"points"}>{"По общим баллам"}</option>
                <option value={"average"}>{"По средним баллам"}</option>
                <option value={"rating"}>
                  {"По рейтингу с поправкой на игрока"}
                </option>
                <option value={"frequency"}>{"Частые сначала"}</option>
                <option value={"name"}>{"По имени"}</option>
              </select>
            </div>
          </div>
          <div
            id={"at-character-list"}
            className={"at-character-list"}
            aria-label={"Персонажи"}
          >
            <TournamentCharacters
              rows={t.characterRows}
              selected={t.selected}
              collectionMode={t.collectionMode}
              playerMode={t.playerMode}
            />
          </div>
          <div className={"at-sidebar-foot"}>
            <span className={"at-tiny-square"} />
            <span>{"Справа — сумма, среднее и новый рейтинг R"}</span>
          </div>
        </aside>
        <section
          className={"at-results-panel"}
          aria-label={"Ростеры выбранного персонажа"}
        >
          <div id={"at-character-overview"} className={"at-character-overview"}>
            {t.overview && <TournamentOverview {...t.overview} />}
          </div>
          <div className={"at-results-toolbar"}>
            <label className={"at-search-box at-result-search"}>
              <svg viewBox={"0 0 24 24"} aria-hidden={"true"}>
                <circle cx={"10.5"} cy={"10.5"} r={"6.5"} />
                <path d={"m16 16 4 4"} />
              </svg>
              <input
                id={"at-result-search"}
                type={"search"}
                placeholder={"Игрок, турнир, affiliation…"}
                aria-label={"Поиск среди ростеров"}
                value={t.resultQuery}
                onChange={(e) => t.setField("resultQuery", e.target.value)}
              />
            </label>
            <label className={"at-select-box"}>
              <span>{"Сортировка"}</span>
              <select
                id={"at-result-sort"}
                aria-label={"Сортировка ростеров"}
                value={t.resultSort}
                onChange={(e) => t.setField("resultSort", e.target.value)}
              >
                <option value={"recent"}>{"Новые сначала"}</option>
                <option value={"wins"}>{"Больше побед"}</option>
                <option value={"player"}>{"По игроку"}</option>
              </select>
            </label>
          </div>
          <div className={"at-results-heading"}>
            <p
              id={"at-result-count"}
              aria-live={"polite"}
            >{`${t.rosterRows.length} ростеров${t.resultQuery || t.affiliations.size ? " из " + t.total : ""}`}</p>
            <span>{"W / L / D"}</span>
          </div>
          <div id={"at-roster-list"} className={"at-roster-list"}>
            <TournamentRosters
              items={t.rosterRows
                .slice(0, t.limit)
                .map((row) => ({ row, availability: t.availability(row) }))}
              total={t.total}
              selectedPlayer={t.selectedPlayer}
            />
          </div>
          <button
            id={"at-show-more"}
            className={"at-show-more"}
            type={"button"}
            onClick={() => {
              t.moreRosters();
            }}
            hidden={t.rosterRows.length <= t.limit}
          >{`Показать ещё ${Math.min(20, t.rosterRows.length - t.limit)} · осталось ${t.rosterRows.length - t.limit}`}</button>
        </section>
      </div>
    </>
  );
});
const ArchiveSection5 = observer(function ArchiveSection5() {
  return (
    <details className={"at-about-data at-score-method"}>
      <summary>
        {"Как считаются баллы "}
        <span>{"Победы +5% · поражения в минус"}</span>
      </summary>
      <div>
        <p>
          {
            "Баллы за завершённое выступление зависят от W/L/D, размера поля и места. При большем числе поражений, чем побед, балл всегда отрицательный. Ничьи дают 0. При равных победах и поражениях есть небольшой плюс за победы."
          }
        </p>
        <p>
          <b>{"R = W − L + min(0,05 × W; 0,5)"}</b>
          {
            ". Пока побед не больше 10, это 1,05 × W − L. Ограничение бонуса половиной победы сохраняет минус и в длинных лигах. Например: 2/3 → −0,90; 3/3 → +0,15; 4/2 → +2,20 до турнирных множителей."
          }
        </p>
        <p>
          <b>{"F = √(log₂(max(N, 2)) / log₂(16))"}</b>
          {
            " — положительный вес размера поля. При 16 участниках F = 1; рост плавный. Для doubles N — число пар."
          }
        </p>
        <p>
          <b>{"k̄ = k + (t − 1)/2; z = (N + 1 − 2k̄)/(N − 1)"}</b>
          {
            ", где k — место, t — число игроков с этим местом. При N = 1 принимаем z = 0. "
          }
          <b>{"P = 1 + 0,25 × sign(R) × z"}</b>
          {
            ". Множитель места лежит между 0,75 и 1,25: более высокое место улучшает и положительный, и отрицательный балл."
          }
        </p>
        <p>
          <b>{"B = 100 × R × F × P"}</b>
          {
            ". Множители положительные, поэтому они сохраняют знак R. Это пробная система; размеры поля и места не заменяют рейтинг конкретных соперников."
          }
        </p>
        <p>
          {
            "Если у одного игрока за событие M вариантов списка, каждый получает вклад B/M и вес 1/M. Сумма персонажа или аффилиации — сумма подходящих вкладов. Один ростер учитывается в объединении выбранных аффилиаций один раз."
          }
        </p>
        <p>
          <b>{"Сглаженное среднее = Σ(B/M) / (Σ(1/M) + 1)"}</b>
          {
            ". Единица — условное нулевое выступление: при одинаковом положительном качестве большая выборка получает чуть более высокую оценку. Среднее игрока считается от 2 разных оценённых выступлений; у персонажей и аффилиаций — от 4. Ниже своего порога среднее равно 0. Продолжающиеся события не увеличивают ни сумму, ни вес."
          }
        </p>
        <p>
          {
            "Сумма и среднее персонажа считаются внутри выбранных аффилиаций ростеров. В командных событиях используются индивидуальные результаты; doubles явно отмечены как результаты пары. Основной этап и плейофф показаны отдельно. Среднее баллов не является винрейтом."
          }
        </p>
        <p
          id={"at-scoring-coverage"}
        >{`Места сопоставлены для ${t.data.meta.placesMatched} результатов. Баллы рассчитаны для ${t.data.meta.scoredResults} завершённых выступлений. ${t.data.meta.unrankedResults || 0} результатов без опубликованного места не получают баллов; ${t.data.meta.provisionalResults} — продолжающиеся события.`}</p>
      </div>
    </details>
  );
});
const ArchiveSection6 = observer(function ArchiveSection6() {
  return (
    <details className={"at-about-data"}>
      <summary>
        {"Что входит в архив "}
        <span>{"Рейтинговые · офлайн · все результаты"}</span>
      </summary>
      <div>
        <p
          id={"at-archive-summary"}
        >{`${t.data.meta.results} сыгранных результатов со submitted list без ограничений по победам и поражениям. Рейтинговые офлайн-события; singles, doubles и team. ${t.data.meta.rosters} вариантов ростеров. Несколько списков игрока за событие остаются одним выступлением.`}</p>
        <p
          id={"at-coverage-note"}
        >{`В архиве ${t.data.meta.encoded} кодированных и ${t.data.meta.text} текстовых листов. Текстовые листы отмечены в выдаче; оригинал доступен при раскрытии. ${t.data.meta.unindexed} лист содержит только название без состава. Prime Sentinel объединён в один пункт.`}</p>
        <p
          id={"at-data-period"}
        >{`Период: ${t.data.meta.start} — ${t.data.meta.end} включительно. Начальная дата округлена Longshanks до 5 августа. Снимок: ${new Date(t.data.meta.snapshot).toLocaleString("ru-RU")}.`}</p>
        <details id={"at-unindexed-lists"}>
          <summary>{"Листы без распознанного состава"}</summary>
          <div id={"at-unindexed-content"}>
            {t.data.rosters
              .filter((r) => !r.characterIds.length)
              .map((r) => (
                <p key={r.id}>
                  <b>{r.player}</b> ·{" "}
                  <a
                    href={r.eventUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {r.event} ↗
                  </a>
                  <br />
                  Лист #{r.listId}: {r.rawText}
                </p>
              ))}
          </div>
        </details>
        <a
          id={"at-source-results"}
          href={`https://mcp.longshanks.org/events/history/?date_from=${t.data.meta.start}&date_to=${t.data.meta.end}`}
          target={"_blank"}
          rel={"noopener noreferrer"}
        >
          {"События на Longshanks ↗"}
        </a>
      </div>
    </details>
  );
});
const ArchiveSection7 = observer(function ArchiveSection7() {
  return (
    <footer>
      <span>{"MCP ROSTER ATLAS"}</span>
      <span>{"Выбор персонажа → турнирные составы"}</span>
    </footer>
  );
});
export const TournamentPanel = observer(function TournamentPanel() {
  return t.data ? (
    <>
      {" "}
      <ArchiveSection0 />
      <TournamentCountries />
      <ArchiveSection1 />
      <ArchiveSection2 />
      <ArchiveSection3 />
      <ArchiveSection4 />
      <ArchiveSection5 />
      <ArchiveSection6 />
      <ArchiveSection7 />{" "}
    </>
  ) : null;
});
