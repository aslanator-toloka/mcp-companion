/* Browser-hosted battles for the GitHub Pages edition. No account, signalling or relay service. */
"use strict";

export function createPeerProtocol(ctx, s) {
  const {
    Core,
    Geometry,
    Power,
    RoomCore,
    PeerLink,
    characters,
    cards,
    battle,
    library,
    catalog,
    ui,
  } = ctx;
  const KEY = "mcp-companion-peer-rooms-v1",
    PROFILE = "mcp-companion-peer-profile-v1";
  s.set("books", []);
  s.set("storageError", false);
  s.set("room", null);
  s.set("role", null);
  s.set("connected", false);
  s.set("offerText", "");
  s.set("answerText", "");
  let authority = null,
    link = null,
    remoteUser = null,
    remoteReferences = [];
  let queue = [],
    sending = false,
    retry = null,
    hostChain = Promise.resolve(),
    domainPromise = null,
    seen = [],
    session = 0;
  let snapshotsReceived = 0,
    lastFullSyncAt = 0;
  const requests = new Map(),
    clone = (value) => Core.clone(value);
  const active = () => !!s.room && battle.matchId === s.room.id;
  const current = () => (active() ? s.room.match : null);
  const ownSide = () => (active() ? s.room.side : "mine");
  const label = (side) => (side === ownSide() ? "Мои" : "Противник");
  const equal = (a, b) =>
    a === b ||
    (!!a &&
      !!b &&
      typeof a === "object" &&
      typeof b === "object" &&
      Array.isArray(a) === Array.isArray(b) &&
      Object.keys(a).length === Object.keys(b).length &&
      Object.keys(a).every((k) => Object.hasOwn(b, k) && equal(a[k], b[k])));
  function error(text, status = 400) {
    const e = new Error(text);
    e.status = status;
    return e;
  }
  try {
    s.set("books", JSON.parse(localStorage.getItem(KEY) || "[]"));
    if (
      !Array.isArray(s.books) ||
      s.books.some(
        (b) =>
          !b ||
          typeof b.id !== "string" ||
          !["mine", "opponent"].includes(b.role) ||
          !b.packet,
      )
    )
      throw Error();
  } catch {
    s.set("books", []);
    s.set("storageError", true);
  }
  try {
    s.set("profile", JSON.parse(localStorage.getItem(PROFILE) || "null"));
  } catch {}
  if (!s.profile || !/^[-a-f0-9]{36}$/i.test(s.profile.id || ""))
    s.set("profile", {
      id: crypto.randomUUID(),
      name: "",
    });
  function saveProfile(name) {
    s.profile.name =
      String(name || "")
        .trim()
        .slice(0, 60) || "Игрок";
    localStorage.setItem(PROFILE, JSON.stringify(s.profile));
  }
  function saveBook(entry) {
    if (s.storageError)
      throw error(
        "Сохранения сетевых партий не прочитаны. Исходная запись не перезаписана.",
      );
    const next = [entry, ...s.books.filter((b) => b.id !== entry.id)];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      throw error(
        "Не хватает места для партии. Экспортируйте данные и освободите место на устройстве.",
      );
    }
    s.set("books", next);
  }
  function persistAuthority(next, nextSeen = seen) {
    const p = domain.packet(next, s.profile.id, {
      live: true,
    });
    saveBook({
      id: next.id,
      role: "mine",
      packet: p,
      authority: next,
      seen: nextSeen,
      at: new Date().toISOString(),
    });
    authority = next;
    seen = nextSeen;
  }
  async function domainReady(slugs = []) {
    if (!domainPromise)
      domainPromise = (async () => {
        const response = await fetch("data/roster-cards.json");
        if (!response.ok) throw error("Не загрузились карты ростеров.");
        const data = await response.json();
        domain = RoomCore({
          Core: Core,
          Geometry: Geometry,
          Power: Power,
          characters,
          tacticCards: new Map(data.tactics.map((c) => [c.slug, c])),
          crisisCards: new Map(data.crises.map((c) => [c.slug, c])),
          getDetail: (slug) => {
            const d = cards.get(slug);
            if (!d) throw error("Сначала загрузите карточку " + slug);
            return d;
          },
          randomUUID: () => crypto.randomUUID(),
          randomInt: (n) => {
            const a = new Uint32Array(1),
              limit = Math.floor(0x100000000 / n) * n;
            do {
              crypto.getRandomValues(a);
            } while (a[0] >= limit);
            return a[0] % n;
          },
          eq: equal,
        });
      })().catch((e) => {
        domainPromise = null;
        throw e;
      });
    await domainPromise;
    await Promise.all(
      [...new Set(slugs)].map(async (slug) => {
        if (!characters.has(slug)) throw error("Неизвестный персонаж.");
        await catalog.detail(slug);
      }),
    );
  }
  let domain;
  function shareRoster(roster) {
    const r = {
      id: roster.id,
      name: roster.name,
      affiliation: roster.affiliation || "",
      characters: [...roster.characters],
      tactics: [...(roster.tactics || [])],
      crises: [...(roster.crises || [])],
      groups: [],
    };
    domain.validateLibrary({
      collection: {
        version: 1,
        owned: [],
        groups: [],
        rosters: [r],
      },
      battles: {
        version: 1,
        matches: [],
      },
    });
    return r;
  }
  function apply(packet, { force = false } = {}) {
    if (
      !packet ||
      (packet.id !== link?.signal?.roomId &&
        packet.id !== s.room?.id &&
        packet.id !== battle.matchId)
    )
      throw error("Пришла другая партия.");
    if (
      packet.side !== (s.role === "mine" ? "mine" : "opponent") ||
      !Number.isInteger(packet.revision) ||
      !packet.ready ||
      !Array.isArray(packet.members) ||
      packet.members.length > 2
    )
      throw error("Некорректный снимок партии.");
    if (
      !force &&
      s.room?.id === packet.id &&
      packet.revision <= s.room.revision
    ) {
      publishConnectionStatus();
      return;
    }
    if (packet.referencesDelta)
      packet.match.references = {
        ...s.room?.match.references,
        ...packet.match.references,
      };
    battle.validate({
      version: 1,
      matches: [packet.match],
    });
    const started =
      s.room?.match.status === "preparing" && packet.match.status === "active";
    if (s.role === "opponent") {
      try {
        saveBook({
          id: packet.id,
          role: s.role,
          packet: clone(packet),
          at: new Date().toISOString(),
        });
      } catch (e) {
        ui.notify(e.message);
      }
    }
    s.set("room", packet);
    // Keep an ordinary local snapshot too: it participates in the existing JSON backup.
    battle.write(clone(packet.match));
    battle.networkChanged();
    if (started) window.scrollTo(0, 0);
  }
  function publishAuthority() {
    apply(
      domain.packet(authority, s.profile.id, {
        live: true,
      }),
    );
  }
  async function broadcast(full = false) {
    if (!s.connected || !remoteUser) return;
    const connection = link,
      target = authority,
      stamp = session;
    const packet = domain.packet(target, remoteUser, {
      live: true,
      ...(!full
        ? {
            knownReferences: remoteReferences,
          }
        : {}),
    });
    try {
      await connection.send({
        type: "state",
        packet,
      });
    } catch (e) {
      if (connection === link && stamp === session) connectionError(e);
      return;
    }
    if (connection === link && stamp === session)
      remoteReferences = Object.keys(target.match.references);
  }
  function serial(fn) {
    const pending = hostChain.then(fn);
    hostChain = pending.catch(() => {});
    return pending;
  }
  async function processCommand(userId, body) {
    const target = authority,
      stamp = session;
    await domainReady([
      ...Object.keys(authority.match.references || {}),
      ...["mine", "opponent"].flatMap((s) =>
        (body?.match?.[s]?.fighters || []).map((f) => f.slug),
      ),
    ]);
    if (authority !== target || session !== stamp)
      throw error("Соединение изменилось. Переподключитесь.", 409);
    if (
      !body ||
      typeof body.operationId !== "string" ||
      !/^[-a-zA-Z0-9_]{16,100}$/.test(body.operationId)
    )
      throw error("Нет идентификатора действия.");
    const key = userId + ":" + body.operationId;
    if (seen.includes(key))
      return domain.packet(authority, userId, {
        live: true,
        knownReferences: body.knownReferences,
      });
    if (body.revision !== authority.revision) {
      const e = error("Партия обновилась.", 409);
      e.data = {
        room: domain.packet(authority, userId, {
          live: true,
          knownReferences: body.knownReferences,
        }),
      };
      throw e;
    }
    const candidate = clone(authority);
    switch (body.action) {
      case "edit":
        domain.editRoom(candidate, userId, body.match, body.label);
        break;
      case "ready":
        domain.readyRoom(candidate, userId, body.ready);
        break;
      case "round":
        domain.advanceRoom(candidate, userId, body);
        break;
      case "power":
        domain.powerRoom(candidate, userId, body);
        break;
      case "undo":
        domain.member(candidate, userId);
        if (candidate.match.status !== "active")
          throw error("Отмена доступна во время боя.");
        candidate.match = Core.undo(candidate.match, new Date().toISOString());
        domain.validateMatch(candidate.match);
        break;
      default:
        throw error("Неизвестное действие.");
    }
    candidate.revision++;
    candidate.match.updatedAt = new Date().toISOString();
    persistAuthority(candidate, [...seen, key]);
    publishAuthority();
    broadcast().catch(connectionError);
    return domain.packet(authority, userId, {
      live: true,
      knownReferences: body.knownReferences,
    });
  }
  function connectionError(e) {
    s.set("connected", false);
    link?.close();
    failRequests();
    publishConnectionStatus();
    if (e) console.warn("Direct battle: connection interrupted");
  }
  function failRequests() {
    for (const [, p] of requests) {
      clearTimeout(p.timer);
      p.reject(Error("Соединение прервано."));
    }
    requests.clear();
  }
  function stopLink() {
    session++;
    s.set("connected", false);
    remoteUser = null;
    remoteReferences = [];
    s.set("offerText", s.set("answerText", ""));
    const old = link;
    link = null;
    old?.close();
    failRequests();
    clearTimeout(retry);
    publishConnectionStatus();
  }
  function setLink() {
    stopLink();
    const token = session;
    link = new PeerLink.Link({
      onState: (state) => {
        if (token !== session) return;
        if (state === "connected") {
          s.set("connected", true);
          publishConnectionStatus();
          if (s.role === "opponent")
            joinHandshake().catch((e) => {
              connectionError(e);
              showPeerError(e.message);
            });
        } else if (
          ["disconnected", "failed", "closed", "invalid"].includes(state)
        ) {
          s.set("connected", false);
          failRequests();
          publishConnectionStatus();
          if (state === "invalid")
            ui.notify("Получено некорректное сообщение. Соединение закрыто.");
          if (state === "failed")
            showPeerError(
              "Прямая связь не установлена. Проверьте Wi-Fi, разрешения локальной сети и доступ устройств друг к другу. VPN может мешать прямому подключению. Создайте новое приглашение для повторной попытки.",
            );
        }
        s.set(
          "status",
          state === "connected"
            ? "Прямая связь установлена"
            : state === "waiting"
              ? "Ждём ответ второго игрока"
              : state === "connecting"
                ? "Соединяем устройства…"
                : s.connected
                  ? "В сети"
                  : "Нет соединения",
        );
      },
      onMessage: (message) => {
        if (token === session)
          receive(message).catch((e) => {
            connectionError(e);
            ui.notify(e.message);
          });
      },
    });
    return link;
  }
  function rpc(type, body) {
    if (!link?.connected)
      return Promise.reject(Error("Нет прямого соединения."));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        requests.delete(id);
        reject(Error("Хозяин не ответил. Изменение ожидает подтверждения."));
      }, 12000);
      requests.set(id, {
        resolve,
        reject,
        timer,
      });
      link
        .send({
          type,
          id,
          body,
        })
        .catch((e) => {
          clearTimeout(timer);
          requests.delete(id);
          reject(e);
        });
    });
  }
  async function receive(message) {
    const connection = link,
      stamp = session,
      targetId = authority?.id;
    if (!message || typeof message.type !== "string")
      throw error("Некорректное сообщение.");
    if (message.type === "reply") {
      const p = requests.get(message.id);
      if (!p) return;
      requests.delete(message.id);
      clearTimeout(p.timer);
      if (message.ok) p.resolve(message.packet);
      else {
        const e = error(
          message.error || "Действие отклонено.",
          message.status || 400,
        );
        e.data = message.data;
        p.reject(e);
      }
      return;
    }
    if (s.role === "opponent" && message.type === "state") {
      snapshotsReceived++;
      if (!message.packet?.referencesDelta) lastFullSyncAt = Date.now();
      apply(message.packet);
      return;
    }
    if (s.role !== "mine" || !["join", "command"].includes(message.type))
      throw error("Неизвестное сообщение.");
    if (typeof message.id !== "string" || message.id.length > 100)
      throw error("Некорректный запрос.");
    await serial(async () => {
      if (
        connection !== link ||
        stamp !== session ||
        targetId !== authority?.id
      )
        return;
      try {
        let packet;
        if (message.type === "join") {
          const user = message.body?.user;
          if (
            !user ||
            !/^[-a-f0-9]{36}$/i.test(user.id || "") ||
            user.id === s.profile.id ||
            typeof user.name !== "string" ||
            !user.name.trim() ||
            user.name.length > 60
          )
            throw error("Некорректный игрок.");
          await domainReady();
          if (connection !== link || stamp !== session) return;
          const roster = shareRoster(message.body.roster);
          if (
            authority.members.length === 2 &&
            !authority.members.some(
              (m) => m.userId === user.id && m.side === "opponent",
            )
          )
            throw error("В этой партии уже сохранён другой второй игрок.", 403);
          const next = clone(authority);
          if (domain.joinRoom(next, user, roster)) {
            next.revision++;
            next.match.updatedAt = new Date().toISOString();
          }
          persistAuthority(next);
          remoteUser = user.id;
          publishAuthority();
          packet = domain.packet(authority, user.id, {
            live: true,
          });
          remoteReferences = Object.keys(authority.match.references);
        } else {
          if (!remoteUser) throw error("Сначала подключитесь к партии.", 403);
          packet = await processCommand(remoteUser, message.body);
        }
        if (connection !== link || stamp !== session) return;
        await connection.send({
          type: "reply",
          id: message.id,
          ok: true,
          packet,
        });
        if (message.type === "join") {
          s.close();
          drain();
        }
      } catch (e) {
        if (connection === link && stamp === session)
          await connection.send({
            type: "reply",
            id: message.id,
            ok: false,
            error: e.message,
            status: e.status || 400,
            data: e.data,
          });
      }
    });
  }
  let guestRoster = null;
  async function joinHandshake() {
    const packet = await rpc("join", {
      user: {
        id: s.profile.id,
        name: s.profile.name,
      },
      roster: guestRoster,
    });
    battle.setLocation("matchId", packet.id);
    battle.setLocation("team", "opponent");
    battle.setLocation(
      "view",
      packet.match.status === "preparing" ? "setup" : "play",
    );
    apply(packet, {
      force: true,
    });
    ui.actions.showBattleScreen();
    s.close();
    drain();
  }
  function publishConnectionStatus() {
    s.refresh(queue.length);
  }
  function showPeerError(text) {
    s.fail(text);
  }
  function showChoose(mode, existing = null) {
    if (queue.length && !existing) {
      ui.notify(
        "Сначала дождитесь подтверждения изменений или переподключитесь к этой партии.",
      );
      return;
    }
    s.choose(mode, existing);
  }
  function showOffer() {
    s.show("offer");
  }
  function showAnswer() {
    s.show("answer");
  }
  async function invite() {
    if (!authority) throw error("Откройте партию хозяина.");
    if (s.connected) throw error("Второй игрок уже подключён.");
    if (
      s.offerText &&
      link &&
      !link.closed &&
      ["new", "connecting"].includes(link.pc.connectionState)
    ) {
      showOffer();
      return;
    }
    const next = setLink();
    s.show("loading");
    try {
      const text = await next.offer(authority.id);
      if (link === next) {
        s.set("offerText", text);
        showOffer();
      }
    } catch (e) {
      if (link === next) {
        stopLink();
        showPeerError(e.message);
      }
      throw e;
    }
  }
  function openSaved(id) {
    const saved = s.books.find((b) => b.id === id);
    if (!saved) throw error("Сохранение партии не найдено.");
    if (queue.length && s.room?.id !== id)
      throw error("Дождитесь подтверждения текущих изменений.");
    if (s.connected && s.room?.id === id) {
      battle.setLocation("matchId", id);
      battle.setLocation("team", s.room.side);
      battle.setLocation(
        "view",
        s.room.match.status === "preparing" ? "setup" : "play",
      );
      ui.actions.showBattleScreen();
      return;
    }
    stopLink();
    s.set("role", saved.role);
    authority = saved.authority ? clone(saved.authority) : null;
    seen = saved.seen || [];
    s.set("room", clone(saved.packet));
    battle.setLocation("matchId", id);
    battle.setLocation("team", s.role);
    battle.setLocation(
      "view",
      s.room.match.status === "preparing" ? "setup" : "play",
    );
    ui.actions.showBattleScreen();
  }
  async function reconnect() {
    if (!s.room) throw error("Сначала откройте сохранённую партию.");
    if (s.connected) throw error("Прямое соединение уже установлено.");
    if (s.room.match.status === "finished") return;
    await domainReady(Object.keys(s.room.match.references));
    if (s.role === "mine") await invite();
    else
      showChoose(
        "join",
        s.books.find((b) => b.id === s.room.id),
      );
  }
  async function submitRoom({
    name,
    rosterId,
    offer: offerInput,
    existingId,
    mode,
  }) {
    s.set("submitting", true);
    try {
      saveProfile(name);
      await domainReady();
      if (mode === "create") {
        if (queue.length) throw error("Дождитесь подтверждения изменений.");
        const roster = library.snapshot.rosters.find((r) => r.id === rosterId);
        if (!roster) throw error("Выберите сохранённый ростер.");
        stopLink();
        s.set("role", "mine");
        seen = [];
        const next = domain.createRoom(
          {
            id: s.profile.id,
            name: s.profile.name,
          },
          shareRoster(roster),
        );
        persistAuthority(next);
        s.set("room", null);
        battle.setLocation("matchId", next.id);
        battle.setLocation("team", "mine");
        battle.setLocation("view", "setup");
        apply(
          domain.packet(next, s.profile.id, {
            live: true,
          }),
          {
            force: true,
          },
        );
        ui.actions.showBattleScreen();
        await invite();
      } else {
        const offer = PeerLink.decode(offerInput, "offer"),
          existing = existingId
            ? s.books.find((b) => b.id === existingId)
            : s.books.find((b) => b.id === offer.roomId);
        if (existing && existing.id !== offer.roomId)
          throw error(
            "Приглашение от другой партии. Откройте новое подключение.",
          );
        if (existing?.role === "mine")
          throw error("На этом устройстве вы хозяин этой партии.");
        if (queue.length && s.room?.id !== offer.roomId)
          throw error("Есть неподтверждённые изменения другой партии.");
        const roster =
          existing?.packet.rosters.opponent ||
          library.snapshot.rosters.find((r) => r.id === rosterId);
        if (!roster) throw error("Выберите ростер.");
        guestRoster = shareRoster(roster);
        s.set("role", "opponent");
        authority = null;
        s.set("room", existing ? clone(existing.packet) : null);
        const next = setLink();
        s.show("loading");
        const text = await next.answer(offerInput);
        if (link === next) {
          s.set("answerText", text);
          showAnswer();
        }
      }
    } catch (e) {
      showPeerError(e.message);
    } finally {
      s.set("submitting", false);
    }
  }
  async function acceptAnswer(answer) {
    s.set("submitting", true);
    try {
      await link.accept(answer);
    } catch (e) {
      showPeerError(e.message);
    } finally {
      s.set("submitting", false);
    }
  }
  function enqueue(action, mutate, label, extra = {}, completion = {}) {
    if (!active()) return false;
    if (s.role === "opponent" && !s.connected) {
      ui.notify("Нет связи с хозяином. Переподключитесь, чтобы менять бой.");
      return false;
    }
    queue.push({
      action,
      mutate,
      label,
      extra,
      id: crypto.randomUUID(),
      ...completion,
    });
    publishConnectionStatus();
    drain();
    return true;
  }
  async function drain() {
    if (
      sending ||
      !queue.length ||
      !s.room ||
      (s.role === "opponent" && !s.connected)
    )
      return;
    sending = true;
    clearTimeout(retry);
    const job = queue[0];
    try {
      let complete = false;
      for (let attempt = 0; attempt < 12; attempt++) {
        const body = {
          action: job.action,
          operationId: job.id,
          revision: s.room.revision,
          knownReferences: Object.keys(s.room.match.references),
          ...job.extra,
        };
        if (job.action === "edit") {
          const { undo, log, ...editable } = s.room.match;
          const next = clone(editable);
          try {
            job.mutate(next);
          } catch {
            throw error("Партия изменилась: повторите действие.");
          }
          delete next.references;
          body.match = next;
          body.label = job.label;
        }
        try {
          const packet =
            s.role === "mine"
              ? await serial(() => processCommand(s.profile.id, body))
              : await rpc("command", body);
          apply(packet);
          queue.shift();
          job.resolve?.();
          complete = true;
          break;
        } catch (e) {
          if (e.status === 409 && e.data?.room) {
            apply(e.data.room);
            continue;
          }
          throw e;
        }
      }
      if (!complete)
        throw error("Много одновременных изменений. Повторите действие.", 409);
    } catch (e) {
      if (!e.status) {
        ui.notify("Нет подтверждения. Изменение ждёт переподключения.");
        retry = setTimeout(drain, 2500);
        return;
      }
      queue.shift();
      job.reject?.(e);
      ui.notify(e.message);
    } finally {
      sending = false;
      publishConnectionStatus();
    }
    if (queue.length) drain();
  }
  let heartbeat;
  function startHeartbeat() {
    clearInterval(heartbeat);
    heartbeat = setInterval(() => {
      if (s.role === "mine" && s.connected && authority)
        broadcast(true).catch(connectionError);
    }, 10000);
  }
  startHeartbeat();
  window.addEventListener("beforeunload", (e) => {
    if (queue.length || s.connected) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("pagehide", () => {
    clearInterval(heartbeat);
    stopLink();
  });
  window.addEventListener("pageshow", startHeartbeat);
  document.addEventListener("visibilitychange", () => {
    if (
      document.visibilityState === "visible" &&
      s.role === "mine" &&
      s.connected
    )
      broadcast(true).catch(connectionError);
  });
  return {
    available: () => true,
    active,
    current,
    ownSide,
    label,
    showChoose,
    openSaved,
    reconnect,
    submitRoom,
    acceptAnswer,
    ready: () =>
      enqueue("ready", null, "", {
        ready: !s.room.ready[s.room.side],
      }),
    list: async () => {},
    isPeer: (id) => s.books.some((b) => b.id === id),
    canUndo: () => !!s.room?.undoCount,
    get pending() {
      return queue.length;
    },
    edit: (text, fn) => enqueue("edit", fn, text),
    editAsync: (text, fn) =>
      new Promise((resolve, reject) => {
        if (!enqueue("edit", fn, text, {}, { resolve, reject }))
          reject(Error("Нет соединения."));
      }),
    undo: () => enqueue("undo"),
    finish: () =>
      new Promise((resolve, reject) => {
        if (
          !enqueue(
            "edit",
            (next) => {
              next.status = "finished";
            },
            "Партия завершена",
            {},
            {
              resolve,
              reject,
            },
          )
        )
          reject(Error("Нет соединения."));
      }),
    round: (round, priority, power) =>
      enqueue("round", null, "", {
        round,
        priority,
        power,
      }),
    power: (round, repeat) =>
      enqueue("power", null, "", {
        round,
        repeat,
      }),
    roster: (side) => (active() ? s.room.rosters[side] : null),
    // Read-only diagnostics, without ICE addresses or connection codes.
    diagnostics: async () => ({
      role: s.role,
      connected: s.connected,
      snapshotsReceived,
      lastFullSyncAt,
      revision: s.room?.revision,
      pending: queue.length,
      connectionState: link?.pc.connectionState,
      iceState: link?.pc.iceConnectionState,
      signalingState: link?.pc.signalingState,
      connection: await link?.stats(),
    }),
  };
}
