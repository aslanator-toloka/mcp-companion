import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { peer as p, battle as b, rosters, ui } from "./stores/index.js";
import { Avatar } from "./common.jsx";
import { Priority, MissionGrid, SetupTeam } from "./battle-extra.jsx";
export const PeerHome = observer(function PeerHome() {
  const supported = !!window.RTCPeerConnection;
  return (
    <>
      <section className="network-home">
        <div>
          <span className="eyebrow">ПРЯМАЯ СВЯЗЬ · ОДНА WI-FI-СЕТЬ</span>
          <h2>Один стол на двоих</h2>
          <p>
            Хозяин создаёт приглашение, второй игрок присылает ответ. Дальше бой
            синхронизируется напрямую между устройствами.
          </p>
        </div>
        <div className="actions">
          <button
            className="primary"
            data-peer="create"
            disabled={!supported || p.storageError}
            onClick={() => p.protocol?.showChoose("create")}
          >
            Создать совместный бой
          </button>
          <button
            data-peer="join"
            disabled={!supported || p.storageError}
            onClick={() => p.protocol?.showChoose("join")}
          >
            Подключиться к игроку
          </button>
        </div>
        {!supported && (
          <p className="notice">Браузер не поддерживает WebRTC.</p>
        )}
        {p.storageError && (
          <p className="notice">
            Сохранения совместных партий не прочитаны. Исходная запись
            сохранена.
          </p>
        )}
      </section>
      {p.books.length > 0 && (
        <>
          <div className="section-title">
            <h3>Совместные партии</h3>
          </div>
          <div className="match-grid">
            {p.books.map((book) => (
              <article key={book.id} className="match-tile">
                <span className="eyebrow">
                  {book.role === "mine" ? "Вы — хозяин" : "Вы — второй игрок"} ·{" "}
                  {book.packet.match.status === "preparing"
                    ? "Подготовка"
                    : book.packet.match.status === "finished"
                      ? "Завершён"
                      : "Идёт бой"}
                </span>
                <h3>{book.packet.match.name}</h3>
                <p>{book.packet.members.map((m) => m.name).join(" · ")}</p>
                <button
                  data-peer="resume"
                  data-id={book.id}
                  onClick={() => p.resume(book.id)}
                >
                  {book.packet.match.status === "finished"
                    ? "Посмотреть"
                    : "Продолжить / подключиться"}
                </button>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
});
export const PeerHeader = observer(function PeerHeader() {
  return b.activeNetwork ? (
    <div className="network-strip">
      <span className={"network-connection" + (p.connected ? "" : " offline")}>
        {p.connected
          ? "● Прямая связь"
          : p.role === "mine"
            ? "◌ Ждём второго игрока"
            : "◌ Нет связи с хозяином"}
      </span>
      <span>{p.role === "mine" ? "Вы — хозяин" : "Вы — второй игрок"}</span>
      <button className="quiet" data-peer="reconnect" onClick={p.reconnect}>
        {p.role === "mine" ? "Подключить игрока" : "Переподключиться"}
      </button>
      <small>
        {p.pending
          ? "Ждём подтверждения изменений…"
          : "Изменения сразу · контрольный снимок каждые 10 с"}
      </small>
    </div>
  ) : null;
});
export const PeerSetup = observer(function PeerSetup() {
  const room = p.room,
    m = room.match,
    side = room.side,
    other = side === "mine" ? "opponent" : "mine",
    team = m[side],
    enemy = m[other],
    ready = room.ready[side];
  return (
    <>
      <PeerHeader />
      <div className="heading">
        <div>
          <span className="eyebrow">ПОДГОТОВКА / ПРЯМАЯ СВЯЗЬ</span>
          <h1>Собрать свой отряд</h1>
          <p>
            {m.name} · вы играете за {team.name}
          </p>
        </div>
        <button data-bt="home" onClick={b.home}>
          ← К партиям
        </button>
      </div>
      <div className="setup-fields">
        <label className="field">
          Название партии
          <NetworkName value={m.name} />
        </label>
        <label className="field">
          Лимит Threat
          <input
            id="battle-threat"
            type="number"
            min="1"
            max="99"
            value={m.threat}
            onChange={(e) => b.setThreat(e.target.value)}
          />
        </label>
        <label className="field">
          Приоритет
          <Priority
            id="battle-priority"
            value={m.priority}
            onChange={b.setPriority}
          />
        </label>
      </div>
      <div className="section-title">
        <h3>Общая миссия</h3>
      </div>
      <MissionGrid setup />
      <div className="setup-columns">
        <SetupTeam side={side} />
        <section className="setup-team network-opponent">
          <span className="eyebrow">ВТОРОЙ ИГРОК</span>
          <h2>{enemy.name}</h2>
          <span className="tag">
            {room.members.length < 2
              ? "Ждём подключения"
              : room.ready[other]
                ? "✓ Готов к бою"
                : "Выбирает отряд"}
          </span>
          <div className="network-squad-preview">
            {enemy.fighters.map((f) => (
              <div key={f.id}>
                <Avatar character={b.catalog.byId.get(f.slug)} />
                <span>
                  {f.name}
                  <small>Threat {f.threat}</small>
                </span>
              </div>
            ))}
            {!enemy.fighters.length && (
              <p className="muted">Отряд появится здесь после выбора.</p>
            )}
          </div>
          <p className="battle-small">Отряд соперника выбирает второй игрок.</p>
        </section>
      </div>
      <p className="battle-rule-note">
        Изменение своего отряда снимает вашу готовность. Изменение общих условий
        снимает готовность обоих. Когда оба готовы, бой начнётся автоматически.
      </p>
      <div className="editor-footer">
        <span>
          {ready
            ? "✓ Вы готовы. Ждём второго игрока."
            : "Выберите бойцов и нажмите «Я готов»."}
        </span>
        <button
          className="primary"
          data-peer="ready"
          disabled={
            !!p.pending || !!b.busy || (p.role === "opponent" && !p.connected)
          }
          onClick={p.ready}
        >
          {ready ? "Отменить готовность" : "Я готов →"}
        </button>
      </div>
    </>
  );
});
export const PeerModal = observer(function PeerModal() {
  const ref = useRef(null),
    offer = useRef(null),
    answer = useRef(null),
    d = p.dialog,
    f = p.form,
    existing = p.books.find((book) => book.id === f.existingId);
  useEffect(() => {
    const el = ref.current;
    if (d && !el.open) el.showModal();
    else if (!d && el.open) el.close();
  }, [!!d]);
  const title =
    d === "choose"
      ? f.mode === "create"
        ? "Создать совместный бой"
        : "Подключиться к игроку"
      : d === "offer"
        ? "Подключить второго игрока"
        : d === "answer"
          ? "Передайте ответ хозяину"
          : "Готовим соединение";
  return (
    <dialog
      id="peer-connect-dialog"
      className="battle-dialog peer-connect-dialog"
      ref={ref}
      onClose={(event) => {
        if (event.currentTarget.open) return;
        if (p.dialog) p.close();
      }}
    >
      {d && (
        <>
          <div className="dialog-heading">
            <h2>{title}</h2>
            <button
              className="quiet"
              data-peer="close"
              aria-label="Закрыть подключение"
              onClick={p.close}
            >
              ×
            </button>
          </div>
          {d === "choose" && (
            <>
              <p className="battle-small">
                Оба устройства должны быть в одной Wi-Fi-сети. Сначала хозяин
                передаёт приглашение, затем второй игрок возвращает ответ.
                Отдельный сервер не используется.
              </p>
              <form
                id="peer-room-form"
                data-mode={f.mode}
                data-existing={f.existingId}
                onSubmit={(e) => {
                  e.preventDefault();
                  p.submit();
                }}
              >
                <label className="field">
                  Ваше имя
                  <input
                    name="name"
                    required
                    maxLength={60}
                    value={f.name}
                    autoComplete="nickname"
                    onChange={(e) => p.field("name", e.target.value)}
                  />
                </label>
                {existing ? (
                  <p className="battle-small">
                    Ростер этой партии:{" "}
                    {existing.packet.rosters[existing.role]?.name ||
                      "Сохранённый ростер"}
                  </p>
                ) : (
                  <label className="field">
                    Ваш ростер
                    <select
                      name="roster"
                      required
                      value={f.rosterId}
                      onChange={(e) => p.field("rosterId", e.target.value)}
                    >
                      <option value="">Выберите ростер</option>
                      {rosters.records.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {f.mode === "join" && (
                  <label className="field">
                    Приглашение хозяина
                    <textarea
                      name="offer"
                      id="peer-offer-input"
                      required
                      rows="5"
                      spellCheck="false"
                      autoCapitalize="off"
                      autoComplete="off"
                      placeholder="MCP-LAN-1.…"
                      value={f.offer}
                      onChange={(e) => p.field("offer", e.target.value)}
                    />
                  </label>
                )}
                {!rosters.records.length && !existing && (
                  <p className="notice">Сначала создайте ростер.</p>
                )}
                <button
                  className="primary"
                  type="submit"
                  disabled={
                    p.submitting || (!rosters.records.length && !existing)
                  }
                >
                  {f.mode === "create"
                    ? "Создать приглашение"
                    : "Подготовить ответ"}
                </button>
              </form>
            </>
          )}
          {d === "offer" && (
            <>
              <ol className="peer-steps">
                <li>Передайте приглашение второму игроку.</li>
                <li>
                  Он откроет «Подключиться к игроку», вставит приглашение и
                  пришлёт свой ответ.
                </li>
                <li>Вставьте этот ответ ниже.</li>
              </ol>
              <label className="field">
                Приглашение
                <textarea
                  id="peer-offer"
                  ref={offer}
                  rows="5"
                  readOnly
                  spellCheck="false"
                  value={p.offerText}
                />
              </label>
              <button
                data-peer="copy"
                data-copy="peer-offer"
                onClick={() => p.copy("offer", offer.current)}
              >
                Скопировать приглашение
              </button>
              <form
                id="peer-answer-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  p.accept();
                }}
              >
                <label className="field">
                  Ответ второго игрока
                  <textarea
                    id="peer-answer-input"
                    name="answer"
                    rows="5"
                    required
                    spellCheck="false"
                    autoCapitalize="off"
                    autoComplete="off"
                    placeholder="MCP-LAN-1.…"
                    value={f.answer}
                    onChange={(e) => p.field("answer", e.target.value)}
                  />
                </label>
                <button
                  className="primary"
                  type="submit"
                  disabled={p.submitting}
                >
                  Соединить устройства
                </button>
              </form>
              <p id="peer-connect-status" role="status">
                {p.status || "Ждём ответ второго игрока"}
              </p>
              <p className="battle-small">
                Это приглашение действует, пока страница хозяина открыта. После
                перезагрузки создайте новое приглашение для сохранённой партии.
              </p>
            </>
          )}
          {d === "answer" && (
            <>
              <p className="battle-small">
                Отправьте этот текст хозяину партии. Он вставит его в своё окно
                подключения. Когда связь установится, окно закроется
                автоматически.
              </p>
              <label className="field">
                Ваш ответ
                <textarea
                  id="peer-answer"
                  ref={answer}
                  rows="6"
                  readOnly
                  spellCheck="false"
                  value={p.answerText}
                />
              </label>
              <button
                data-peer="copy"
                data-copy="peer-answer"
                onClick={() => p.copy("answer", answer.current)}
              >
                Скопировать ответ
              </button>
              <p id="peer-connect-status" role="status">
                {p.status || "Ждём, пока хозяин примет ответ…"}
              </p>
              <p className="battle-small">
                Оба устройства должны быть в одной сети, а Wi-Fi разрешать связь
                устройств друг с другом. На iPad разрешите доступ к локальной
                сети. VPN может мешать подключению.
              </p>
            </>
          )}
          {d === "loading" && (
            <p className="battle-small">
              Собираем параметры локального соединения…
            </p>
          )}
          <p id="peer-form-error" role="alert" className="peer-error">
            {p.error}
          </p>
        </>
      )}
    </dialog>
  );
});

function NetworkName({ value }) {
  const [draft, setDraft] = useState(value),
    editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  return (
    <input
      id="battle-name"
      maxLength={100}
      value={draft}
      onFocus={() => (editing.current = true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        editing.current = false;
        b.setName(draft);
      }}
    />
  );
}
