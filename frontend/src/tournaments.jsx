import { UIIcon } from "./ui-icons.jsx";
import React, { memo, useState } from "react";
import { Control, number, count } from "./common.jsx";
import { observer } from "mobx-react-lite";
import { tournaments as t, purchases, actions } from "./stores/index.js";
import { RatingValue } from "./character-rating.jsx";
const mean = (value) => (value === null ? "—" : number(value));
const initials = (name) =>
  name
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
const link = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : "#";
  } catch {
    return "#";
  }
};
const date = (value) =>
  new Date(value + "T12:00:00").toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const ArchiveCharacter = memo(function ArchiveCharacter({
  character: c,
  index,
  selected,
}) {
  return (
    <div className="at-character-entry">
      <button
        className={"at-character-button" + (c.count ? "" : " at-zero")}
        type="button"
        data-character={c.id}
        aria-pressed={selected}
        aria-label={`${c.name} (${c.alterEgo}), всего ${number(c.points)} баллов, среднее ${mean(c.average)}, ${count(c.count, "ростер", "ростера", "ростеров")}, аффилиейшены: ${c.affiliations.join(", ") || "не указаны в каталоге"}`}
        onClick={(event) => {
          event.stopPropagation();
          t.chooseCharacter(c.id, false);
        }}
      >
        <span className="at-row-index" aria-hidden="true">
          {index + 1}
        </span>
        <span className="at-character-avatar" aria-hidden="true">
          {initials(c.name)}
        </span>
        <span className="at-character-name">
          <strong>{c.name}</strong>
          <small>
            {c.alterEgo} · {c.count}
          </small>
          <span className="at-character-affiliations">
            {c.affiliations.join(" · ") || "Не указаны в каталоге"}
          </span>
        </span>
        <span className="at-character-frequency">
          <span
            className={c.points < 0 ? "at-negative" : ""}
            title="Общие баллы"
          >
            Σ {number(c.points)}
          </span>
          <small
            className={c.average < 0 ? "at-negative" : ""}
            title="Сглаженное среднее с одним нулевым выступлением; при менее 4 выступлениях — 0"
          >
            Ø {mean(c.average)}
          </small>
          <small>
            <RatingValue rating={c.rating} compact />
          </small>
        </span>
      </button>
      <button
        type="button"
        className="at-character-catalog-arrow"
        data-action="catalog-character"
        data-slug={(c.inventoryIds || [c.id])[0]}
        aria-label={"Открыть " + c.name + " в разделе Персонажи"}
        title="В раздел Персонажи"
        onClick={(event) => {
          event.stopPropagation();
          actions.openCatalogCharacter((c.inventoryIds || [c.id])[0]);
        }}
      >
        <UIIcon name="external" />
      </button>
    </div>
  );
});
export function TournamentCharacters({
  rows,
  selected,
  collectionMode,
  playerMode,
}) {
  return rows.length ? (
    rows.map((c, i) => (
      <ArchiveCharacter
        key={c.id}
        character={c}
        index={i}
        selected={!collectionMode && !playerMode && c.id === selected}
      />
    ))
  ) : (
    <div className="at-empty-character">
      Ничего не найдено.
      <br />
      Попробуй другое имя.
    </div>
  );
}
export function TournamentAffiliations({ rows, selected }) {
  return rows.map((a, i) => (
    <label key={a.name} className="at-affiliation-option">
      <span className="at-row-index" aria-hidden="true">
        {i + 1}
      </span>
      <Control
        type="checkbox"
        value={a.name}
        checked={selected.includes(a.name)}
        onChange={(event) => t.toggleAffiliation(a.name, event.target.checked)}
      />
      <span className="at-affiliation-name">
        <strong>{a.name}</strong>
        <small>
          {count(a.scoredResults, "выступление", "выступления", "выступлений")}
        </small>
      </span>
      <span
        className={
          "at-affiliation-score " + (a.points < 0 ? "at-negative" : "")
        }
        aria-label={`Всего ${number(a.points)} баллов`}
      >
        {number(a.points)}
      </span>
      <span
        className={
          "at-affiliation-score " + (a.average < 0 ? "at-negative" : "")
        }
        aria-label={`Сглаженное среднее ${mean(a.average)}`}
      >
        {mean(a.average)}
      </span>
    </label>
  ));
}
export function TournamentPlayers({ rows, selected }) {
  return rows.length ? (
    rows.map((p, i) => (
      <label className="at-player-option" key={p.id}>
        <span className="at-row-index" aria-hidden="true">
          {i + 1}
        </span>
        <Control
          type="radio"
          name="at-player-choice"
          value={p.id}
          checked={selected === p.id}
          onChange={() => t.choosePlayer(p.id)}
        />
        <span className="at-player-name">
          <strong>{p.name}</strong>
          <small>
            #{p.id} · {p.country || "Страна не указана"} ·{" "}
            {count(p.resultsCount, "выступление", "выступления", "выступлений")}{" "}
            · оценено: {p.scoredResults}
          </small>
          <span className="at-player-affiliations">
            {p.affiliationCounts.length ? (
              p.affiliationCounts.map((a) => (
                <span className="at-affiliation-tag" key={a.name}>
                  {a.name} · {a.appearances}
                </span>
              ))
            ) : (
              <span className="at-affiliation-empty">
                Без указанной аффилиации
              </span>
            )}
          </span>
        </span>
        <span
          className={"at-player-score " + (p.points < 0 ? "at-negative" : "")}
          aria-label={`Всего ${number(p.points)} баллов`}
        >
          {number(p.points)}
        </span>
        <span
          className={"at-player-score " + (p.average < 0 ? "at-negative" : "")}
          aria-label={`Сглаженное среднее ${mean(p.average)}`}
        >
          {mean(p.average)}
        </span>
      </label>
    ))
  ) : (
    <div className="at-player-empty">
      Игроки не найдены. Измени поиск, страну или аффилиацию.
    </div>
  );
}
function Ownership({ status }) {
  return status ? (
    <small className={"at-ownership-tag at-" + status.kind}>
      {status.kind === "owned" ? "✓ " : ""}
      {status.label}
    </small>
  ) : (
    <small className="at-ownership-unknown">Наличие не подключено</small>
  );
}
function CatalogArrow({ slug, name }) {
  return (
    <button
      className="at-roster-catalog-arrow"
      type="button"
      data-action="catalog-character"
      data-slug={slug}
      aria-label={"Открыть " + name + " в разделе Персонажи"}
      title="Открыть карточку в Персонажах"
      onClick={(event) => {
        event.stopPropagation();
        actions.openCatalogCharacter(slug);
      }}
    >
      <UIIcon name="external" />
    </button>
  );
}
function Placement({ row: r }) {
  return (
    <div className="at-placement-line">
      <span>
        {r.place === null ? (
          "Место не опубликовано"
        ) : (
          <>
            {r.provisional
              ? "Текущее место"
              : r.resultBasis === "doubles_pair"
                ? "Место пары"
                : "Место"}{" "}
            <b>
              {r.place} / {r.fieldSize}
            </b>
          </>
        )}
        {r.sharedPlaceCount > 1
          ? ` · разделено с ${count(r.sharedPlaceCount - 1, "игроком", "игроками", "игроками")}`
          : ""}
        {r.stage === "main" ? " · основной этап" : ""}
      </span>
      {r.performancePoints !== null ? (
        <span
          className={
            "at-points-badge " + (r.performancePoints < 0 ? "at-negative" : "")
          }
        >
          {number(r.performancePoints)} баллов
        </span>
      ) : (
        <span className="at-provisional-badge">
          {r.provisional ? "Событие продолжается" : "Без итоговых баллов"}
        </span>
      )}
    </div>
  );
}
const TournamentRosterCard = observer(function TournamentRosterCard({
  row: r,
  availability: a,
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="at-roster-card"
      data-roster={r.id}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="at-roster-summary">
        <span className="at-rank-mark" aria-hidden="true">
          {r.wins}W
        </span>
        <div className="at-roster-info">
          <div className="at-player-line">
            <h3>{r.player}</h3>
            {r.kind === "text" ? (
              <span className="at-text-badge">Текстовый лист</span>
            ) : r.kind === "restricted" ? (
              <span className="at-text-badge">Состав недоступен</span>
            ) : null}
            {r.variantCount > 1 && (
              <span className="at-variant-badge">Вариант {r.variant}</span>
            )}
          </div>
          <div className="at-event-line">
            <time dateTime={r.date}>{date(r.date)}</time>
            <span className="at-event-name">{r.event}</span>
          </div>
          <div className="at-roster-affiliations">
            {r.affiliations.map((aff) => (
              <span className="at-affiliation-tag" key={aff}>
                {aff}
              </span>
            ))}
          </div>
          {r.resultBasis === "doubles_pair" && (
            <span className="at-text-badge">Результат пары</span>
          )}
          <Placement row={r} />
          <div className="at-availability-line">
            {a && (
              <span
                className={"at-availability-tag" + (a.ready ? " at-ready" : "")}
              >
                {a.ready
                  ? "✓ Все персонажи есть"
                  : a.complete
                    ? `Есть ${a.have} / ${a.total} · не хватает ${a.missing.length}`
                    : `Распознано ${a.total} персонажей · состав неполный`}
              </span>
            )}
          </div>
        </div>
        <div
          className="at-record"
          aria-label={`${r.wins} побед, ${r.losses} поражений, ${r.draws} ничьих`}
        >
          <span className="at-win">{r.wins}</span>
          <span className="at-slash">/</span>
          <span className="at-loss">{r.losses}</span>
          <span className="at-slash">/</span>
          <span className="at-draw">{r.draws}</span>
        </div>
        <UIIcon name="chevron" className="at-chevron" />
      </summary>
      <div className="at-roster-body">
        {open && <TournamentRosterBody {...t.body(r)} />}
      </div>
    </details>
  );
});
export function TournamentRosters({ items, total, selectedPlayer }) {
  return items.length ? (
    items.map((item) => <TournamentRosterCard key={item.row.id} {...item} />)
  ) : (
    <div className="at-empty-state">
      <strong>
        {total ? "Ростеры не найдены" : "Пока нет ростеров в этой выборке"}
      </strong>
      {total
        ? "Попробуй другое имя игрока, событие или affiliation."
        : selectedPlayer
          ? "У этого игрока нет ростеров с выбранным персонажем. Выбери другого персонажа или нажми «Все ростеры игрока»."
          : "Выбери другого персонажа. В архив входят сыгранные результаты с опубликованными ростерами."}
    </div>
  );
}
export function TournamentRosterBody({
  row: r,
  characters,
  selected,
  hasCollection,
}) {
  const scoring = r.scoringComponents;
  return (
    <>
      {scoring && (
        <p className="at-text-note">
          Баллы: 100 × {number(scoring.base, 2)} за W/L ×{" "}
          {scoring.field.toFixed(3)} за размер поля ×{" "}
          {scoring.placeFactor.toFixed(3)} за место ≈{" "}
          {number(r.performancePoints)}. Ничьи нейтральны; бонус побед ограничен
          +0,5.
        </p>
      )}
      {r.resultBasis === "doubles_pair" && (
        <p className="at-text-note">
          Парный турнир: W/L/D и место относятся к паре {r.teamName || ""};
          размер поля — число пар. Показан опубликованный ростер этого
          участника.
        </p>
      )}
      <div className="at-roster-actions">
        <button
          type="button"
          data-tournament-import={r.id}
          onClick={(event) => {
            event.stopPropagation();
            actions.openTournamentDraft(r);
          }}
        >
          Открыть в моём билдере →
        </button>
      </div>
      <RosterBoxNeeds roster={r} />
      <div className="at-detail-caption">
        <span>
          {r.location} · Лист #{r.listId}
        </span>
        <a href={link(r.eventUrl)} target="_blank" rel="noopener noreferrer">
          Открыть турнир ↗
        </a>
      </div>
      {r.topCutPlace && (
        <p className="at-text-note">
          Плейофф: место {r.topCutPlace} / {r.topCutFieldSize}; результат{" "}
          {r.topCutRecord.wins}/{r.topCutRecord.losses}/{r.topCutRecord.draws}.
          Баллы этого ростера относятся к основному этапу, соответствующему
          результату W/L/D в выдаче.
        </p>
      )}
      {r.variantCount > 1 && r.pointsShare !== null && (
        <p className="at-text-note">
          {number(r.performancePoints)} баллов за выступление поделены между{" "}
          {r.variantCount} вариантами списка: вклад этого варианта —{" "}
          {number(r.pointsShare)}.
        </p>
      )}
      {r.kind !== "encoded" ? (
        <>
          <p className="at-text-note">
            {r.kind === "restricted"
              ? "Содержимое списка недоступно в публичном просмотре."
              : "Текстовый лист. В поиск включены распознанные имена персонажей; полный оригинал — ниже."}
          </p>
          <div className="at-text-characters">
            {characters.map((c) => (
              <React.Fragment key={c.entry.id}>
                <button
                  className="at-co-chip"
                  data-character={c.entry.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    t.chooseCharacter(c.entry.id, true);
                  }}
                >
                  {c.info.name}
                </button>
                <CatalogArrow slug={c.inventorySlug} name={c.info.name} />
                <Ownership status={c.status} />
              </React.Fragment>
            ))}
          </div>
          <pre className="at-raw-text">{r.rawText}</pre>
        </>
      ) : (
        <>
          <div className="at-roster-columns">
            <div className="at-roster-column">
              <h4>
                Персонажи <span>{r.characters.length}</span>
              </h4>
              <ul>
                {characters.map((c, i) => (
                  <li
                    key={(c.entry.id || c.entry.name) + ":" + i}
                    className={c.entry.id === selected ? "at-selected" : ""}
                  >
                    {c.entry.id ? (
                      <>
                        <span className="at-roster-character-name">
                          <button
                            className="at-roster-character-button"
                            data-character={c.entry.id}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              t.chooseCharacter(c.entry.id, true);
                            }}
                          >
                            {c.info.name}
                          </button>
                          <CatalogArrow
                            slug={c.inventorySlug}
                            name={c.info.name}
                          />
                        </span>
                        <small>{c.info.alterEgo}</small>
                        <small className="at-roster-character-affiliations">
                          {c.info.affiliations.join(" · ") ||
                            "Не указаны в каталоге"}
                        </small>
                      </>
                    ) : (
                      c.entry.name
                    )}
                    {hasCollection && <Ownership status={c.status} />}{" "}
                    {(c.entry.gems || []).length > 0 && (
                      <small className="at-gems">
                        {c.entry.gems.join(" · ")}
                      </small>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="at-roster-column">
              <h4>
                Team tactics <span>{r.tactics.length}</span>
              </h4>
              <ul>
                {r.tactics.map((t, i) => (
                  <li key={t + ":" + i}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="at-roster-column">
              <h4>
                Crises <span>{r.crises.length}</span>
              </h4>
              <ul>
                {r.crises.map((t, i) => (
                  <li key={t + ":" + i}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
          {r.jarvisUrl && (
            <div className="at-roster-actions">
              <a
                href={link(r.jarvisUrl)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Открыть в Jarvis Protocol ↗
              </a>
            </div>
          )}
        </>
      )}
    </>
  );
}
const RosterBoxNeeds = observer(function RosterBoxNeeds({ roster }) {
  const needs = purchases.rosterNeeds(roster);
  if (!needs) return null;
  const openBox = (box) => (
    <button
      key={box.code}
      type="button"
      data-needed-box={box.code}
      onClick={(e) => {
        e.stopPropagation();
        actions.openBoxSet(box.code);
      }}
    >
      {box.code} · {box.name} ↗
    </button>
  );
  const plan = (value, i) => (
    <div className="at-box-plan" key={value.boxes.map((b) => b.code).join("|")}>
      {needs.plans.length > 1 && <strong>Вариант {i + 1}</strong>}
      <ul>
        {value.boxes.map((box) => (
          <li key={box.code}>
            {openBox(box)}
            <small>Нужны: {box.needed.map((c) => c.name).join(" · ")}</small>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <section
      className="at-roster-box-needs"
      data-roster-box-needs={roster.id}
      aria-label="Коробки для этого ростера"
    >
      <h4>Каких коробок не хватает</h4>
      {!needs.complete ? (
        <p>
          Состав распознан не полностью — полный список покупок пока определить
          нельзя.
        </p>
      ) : needs.minimum === 0 ? (
        <p className="at-ready">
          Все персонажи уже есть — покупать коробки не нужно.
        </p>
      ) : (
        <>
          <p>
            Не хватает:{" "}
            {needs.missing
              .map((c) => c.name + (c.count > 1 ? ` ×${c.count}` : ""))
              .join(" · ")}
          </p>
          {needs.minimum !== null ? (
            <>
              <p>
                <b>
                  Минимум{" "}
                  {count(needs.minimum, "коробка", "коробки", "коробок")}
                </b>{" "}
                по текущему каталогу
              </p>
              {plan(needs.plans[0], 0)}
              {needs.plans.length > 1 && (
                <details data-ui-disclosure>
                  <summary>Другие минимальные варианты</summary>
                  {needs.plans.slice(1).map((p, i) => plan(p, i + 1))}
                </details>
              )}
            </>
          ) : (
            <>
              <p>Варианты коробок по недостающим персонажам:</p>
              <ul>
                {needs.choices.map((c) => (
                  <li key={c.id}>
                    <b>{c.name}</b>
                    {c.boxes.length ? (
                      c.boxes.map(openBox)
                    ) : (
                      <small>В каталоге нет набора с этим персонажем.</small>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          <small>
            Учитываются персонажи из твоей коллекции. Карты тактики и кризисы не
            проверяются.
          </small>
        </>
      )}
    </section>
  );
});
function ScoreContext({ affiliations, playerName, suffix = "все результаты" }) {
  return (
    <p className="at-score-context">
      {affiliations.length ? (
        <>
          Баллы в ростерах: <b>{affiliations.join(" · ")}</b>
        </>
      ) : (
        "Баллы по всем аффилиациям"
      )}
      {playerName ? (
        <>
          {" "}
          · игрок <b>{playerName}</b>
        </>
      ) : null}{" "}
      · {suffix}
    </p>
  );
}
function ProfileAffiliations({ affiliations }) {
  return (
    <div
      className="at-profile-affiliations"
      aria-label="Аффилиейшены персонажа"
    >
      {affiliations.length ? (
        affiliations.map((a) => (
          <span
            key={typeof a === "string" ? a : a.name}
            className="at-affiliation-tag"
          >
            {typeof a === "string" ? a : a.name + " · " + a.appearances}
          </span>
        ))
      ) : (
        <span className="at-affiliation-empty">Не указаны в каталоге</span>
      )}
    </div>
  );
}
export function TournamentOverview({
  mode,
  character: c,
  stats: s,
  profileAffiliations,
  affiliations,
  playerName,
  inventorySlug,
  ownership,
  peers,
  available,
  purchase,
}) {
  if (mode === "purchase")
    return (
      <div className="at-purchase-filter" data-purchase-filter>
        <div className="at-version-label">РОСТЕРЫ ПОКУПКИ · 4+/≤1 ИЛИ 3+/0</div>
        <h2>
          {purchase.code} · {purchase.name}
        </h2>
        <p>
          {purchase.kind === "unlocked"
            ? "Покупка откроет эти ростеры по персонажам."
            : purchase.extra
              ? `Для этих ростеров после покупки потребуется ещё ${purchase.extra}.`
              : "После покупки для каждого из этих ростеров останется докупить одну коробку."}
        </p>
        <p>
          Найдено: <strong>{purchase.count}</strong>. Расчёт относительно
          текущей коллекции.
        </p>
        {purchase.missing.length > 0 && (
          <p>Не хватает: {purchase.missing.join(" · ")}</p>
        )}
        <button
          type="button"
          className="at-co-chip"
          onClick={() => t.clearPurchaseFilter()}
        >
          Снять фильтр покупки
        </button>
      </div>
    );
  if (mode === "collection")
    return (
      <>
        <div className="at-overview-title">
          <span className="at-selected-icon" aria-hidden="true">
            ✓
          </span>
          <div>
            <div className="at-version-label">МОЯ КОЛЛЕКЦИЯ</div>
            <h2>Ростеры из моих персонажей</h2>
            <p>
              Полные совпадения по персонажам.{" "}
              {affiliations.length
                ? "Аффилиации: " + affiliations.join(" · ") + "."
                : "Все аффилиации архива."}
              {playerName ? (
                <>
                  {" "}
                  · игрок <b>{playerName}</b>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="at-overview-stats">
          {[
            [available.count, "доступных ростеров"],
            [available.events, "событий"],
            [available.players, "игроков"],
          ].map(([n, label]) => (
            <div className="at-overview-stat" key={label}>
              <strong>{n}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </>
    );
  if (mode === "player")
    return (
      <>
        <div className="at-overview-title">
          <span className="at-selected-icon" aria-hidden="true">
            {initials(s.name)}
          </span>
          <div>
            <div className="at-version-label">
              ИГРОК · #{s.id} · {s.country || "Страна не указана"}
            </div>
            <h2>{s.name}</h2>
            <p>
              Все ростеры игрока. Выбери персонажа слева, чтобы сузить составы и
              его баллы.
            </p>
            <ProfileAffiliations affiliations={profileAffiliations} />
          </div>
        </div>
        <ScoreContext
          affiliations={affiliations}
          suffix="все результаты игрока"
        />
        <div className="at-overview-stats at-scored-stats">
          <div className="at-overview-stat">
            <strong className={s.points < 0 ? "at-negative" : ""}>
              {number(s.points)}
            </strong>
            <span>всего баллов</span>
          </div>
          <div className="at-overview-stat">
            <strong className={s.average < 0 ? "at-negative" : ""}>
              {mean(s.average)}
            </strong>
            <span title="Для игрока — от 2 оценённых выступлений">
              сглаж. среднее · оценено: {s.scoredResults}
            </span>
          </div>
          {[
            [s.resultsCount, "выступлений"],
            [s.events, "событий"],
            [s.count, "вариантов ростера"],
          ].map(([n, label]) => (
            <div className="at-overview-stat" key={label}>
              <strong>{n}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </>
    );
  return (
    <>
      <div className="at-overview-top">
        <div className="at-overview-title">
          <span className="at-selected-icon" aria-hidden="true">
            {initials(c.name)}
          </span>
          <div>
            <div className="at-version-label">
              {c.grunt ? "GRUNT" : "ПЕРСОНАЖ"} · {c.threat ?? "—"} THREAT
            </div>
            <h2>{c.name}</h2>
            <p className="at-character-meta">
              {c.alterEgo} <Ownership status={ownership} />
            </p>
            <ProfileAffiliations affiliations={c.affiliations} />
          </div>
        </div>
        <div className="at-overview-actions">
          <CatalogArrow slug={inventorySlug} name={c.name} />
          <button
            className="at-share-button"
            type="button"
            id="at-share-character"
            aria-label="Скопировать ссылку на персонажа"
            onClick={(event) => {
              event.stopPropagation();
              t.share();
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"
                transform="translate(1 0) scale(.9)"
              />
            </svg>
            <span>Ссылка</span>
          </button>
        </div>
      </div>
      <ScoreContext affiliations={affiliations} playerName={playerName} />
      <div className="at-overview-stats at-scored-stats">
        <div
          className="at-overview-stat at-point-total"
          title="Сумма баллов за W/L/D, размер поля и место; варианты делят балл"
        >
          <strong className={s.points < 0 ? "at-negative" : ""}>
            {number(s.points)}
          </strong>
          <span>всего баллов</span>
        </div>
        <div
          className="at-overview-stat at-point-average"
          title="Сумма вкладов / (сумма весов + 1); при менее 4 выступлениях — 0"
        >
          <strong className={s.average < 0 ? "at-negative" : ""}>
            {mean(s.average)}
          </strong>
          <span>
            сглаж. среднее ·{" "}
            {count(
              s.scoredResults,
              "выступление",
              "выступления",
              "выступлений",
            )}
          </span>
        </div>
        <div className="at-overview-stat">
          <strong>{s.count}</strong>{" "}
          <small>{s.share.toFixed(1).replace(".", ",")}%</small>
          <span>ростеров в этой выборке</span>
        </div>
        <div className="at-overview-stat">
          <strong>{s.events}</strong>
          <span>
            {count(s.events, "событие", "события", "событий").replace(
              /^\d+ /,
              "",
            )}
          </span>
        </div>
        <div className="at-overview-stat">
          <strong>{s.players}</strong>
          <span>
            {count(s.players, "игрок", "игрока", "игроков").replace(
              /^\d+ /,
              "",
            )}
          </span>
        </div>
      </div>
      {peers?.length > 0 && (
        <details data-ui-disclosure className="at-cooccurrence">
          <summary>Часто берут вместе · {peers.length}</summary>
          <div className="at-cooccurrence-options">
            {peers.map((p) => (
              <button
                key={p.id}
                className="at-co-chip"
                type="button"
                data-character={p.id}
                onClick={(event) => {
                  event.stopPropagation();
                  t.chooseCharacter(p.id, true);
                }}
              >
                {p.name}
                <small>{p.count}</small>
              </button>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
