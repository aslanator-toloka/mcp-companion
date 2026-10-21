import { share } from "./share.js";
import {
  makeAutoObservable,
  observable,
  observableRef,
  runInAction,
} from "mobx";
import { words } from "./catalog.js";
export const conditions = [
  ["Bleed", "Кровотечение"],
  ["Hex", "Проклятие"],
  ["Incinerate", "Горение"],
  ["Judgment", "Осуждение"],
  ["Poison", "Яд"],
  ["Root", "Корни"],
  ["Shock", "Шок"],
  ["Slow", "Замедление"],
  ["Stagger", "Потеря действия"],
  ["Stun", "Оглушение"],
];
const now = () => new Date().toISOString();
export class BattleStore {
  pendingPicks = observable.map({}, { deep: false });
  matches = observable.map({}, { deep: false });
  matchId = null;
  view = "home";
  team = "mine";
  picker = null;
  busy = 0;
  dialog = null;
  readError = false;
  roundPower = true;
  roundPriority = "unknown";
  powerRepeat = false;
  customCondition = "";
  error = "";
  networkRevision = 0;
  constructor(library, catalog, rosters, ui, cards, storage) {
    Object.assign(this, {
      library,
      catalog,
      rosters,
      ui,
      cards,
      storage,
      domain: null,
      network: null,
      modelCache: new Map(),
    });
    makeAutoObservable(
      this,
      {
        library: false,
        catalog: false,
        rosters: false,
        ui: false,
        cards: false,
        storage: false,
        domain: false,
        network: false,
        modelCache: false,
      },
      { autoBind: true },
    );
  }
  configure(domain, network) {
    this.domain = domain;
    this.network = network;
  }
  get current() {
    this.networkRevision;
    return this.network?.current?.() || this.matches.get(this.matchId);
  }
  get activeNetwork() {
    this.networkRevision;
    return !!this.network?.active?.();
  }
  get ownSide() {
    this.networkRevision;
    return this.network?.ownSide?.() || "mine";
  }
  label(side) {
    this.networkRevision;
    return (
      this.network?.label?.(side) || (side === "mine" ? "Мои" : "Противник")
    );
  }
  get rows() {
    this.networkRevision;
    return [...this.matches.values()]
      .filter((m) => !this.network?.isPeer?.(m.id))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  fighter(id) {
    return this.domain.Core.allFighters(this.current).find((f) => f.id === id);
  }
  validate(value) {
    const { Core, Geometry } = this.domain;
    Core.validate(value);
    for (const m of value.matches) {
      Geometry.validate(m.map);
      for (const u of m.undo) Geometry.validate(u.progress.map);
      if (
        [m, ...m.undo.map((u) => u.progress)].some((progress) =>
          Core.allFighters(progress).some(
            (f) => !this.catalog.byId.has(f.slug),
          ),
        )
      )
        throw Error("В партии указан неизвестный персонаж.");
    }
    return value;
  }
  serialize() {
    return { version: 1, matches: [...this.matches.values()] };
  }
  replace(value, { persist = true } = {}) {
    try {
      this.validate(value);
      if (persist)
        this.storage.setItem("mcp-companion-battles-v1", JSON.stringify(value));
      const ids = new Set(value.matches.map((m) => m.id));
      for (const id of this.matches.keys())
        if (!ids.has(id)) this.matches.delete(id);
      for (const m of value.matches)
        this.matches.set(m.id, share(this.matches.get(m.id), m));
      this.readError = false;
      return true;
    } catch (error) {
      this.error = error.message || "Не удалось сохранить партию.";
      this.ui.notify(this.error);
      return false;
    }
  }
  load() {
    try {
      const raw = this.storage.getItem("mcp-companion-battles-v1");
      if (raw && !this.replace(JSON.parse(raw), { persist: false }))
        this.readError = true;
    } catch {
      this.readError = true;
      this.ui.notify(
        "Сохранение партий не прочитано. Исходная запись сохранена.",
      );
    }
  }
  write(match) {
    if (this.readError) {
      this.ui.notify(
        "Восстановите данные партий из экспорта, прежде чем создавать новую.",
      );
      return false;
    }
    const matches = [...this.matches.values()],
      index = matches.findIndex((m) => m.id === match.id);
    if (index < 0) matches.unshift(match);
    else matches[index] = match;
    return this.replace({ version: 1, matches });
  }
  edit(label, mutate) {
    const m = this.current;
    if (!m || m.status === "finished") return false;
    if (this.activeNetwork) return this.network.edit(label, mutate);
    try {
      const { Core } = this.domain,
        next =
          m.status === "preparing"
            ? Core.clone(m)
            : Core.update(m, label, mutate, now());
      if (m.status === "preparing") {
        mutate(next);
        next.updatedAt = now();
      }
      return this.write(next);
    } catch (e) {
      this.ui.notify(e.message);
      return false;
    }
  }
  setLocation(field, value) {
    this[field] = value;
    return value;
  }
  networkChanged() {
    this.networkRevision++;
    if (this.current?.status !== "preparing" && this.view === "setup")
      this.view = "play";
  }
  home() {
    this.matchId = null;
    this.view = "home";
    this.closeDialog();
    this.ui.actions.showBattleScreen();
  }
  open(id) {
    const m = this.matches.get(id);
    if (!m) return;
    this.matchId = id;
    this.team = "mine";
    this.view = m.status === "preparing" ? "setup" : "play";
    this.ui.actions.showBattleScreen();
  }
  selectTeam(side) {
    this.team = side;
  }
  prepare(rosterId) {
    if (this.readError) return;
    this.rosters.requestLeave(() => {
      const r = this.library.snapshot.rosters.find((r) => r.id === rosterId);
      if (!r) {
        this.ui.notify("Выберите сохранённый ростер.");
        return;
      }
      const at = now(),
        m = {
          id: crypto.randomUUID(),
          status: "preparing",
          name: r.name,
          createdAt: at,
          updatedAt: at,
          sourceRoster: JSON.parse(JSON.stringify(r)),
          threat: 17,
          round: 1,
          score: { mine: 0, opponent: 0 },
          priority: "unknown",
          mine: {
            name: "Я",
            affiliation: r.affiliation,
            leader: null,
            fighters: [],
            tactics: [],
          },
          opponent: {
            name: "Противник",
            affiliation: "",
            leader: null,
            fighters: [],
            tactics: [],
          },
          secure: null,
          extract: null,
          references: {},
          undo: [],
          log: [],
        };
      if (this.write(m)) {
        this.closeDialog();
        this.open(m.id);
      }
    });
  }
  chooseRoster() {
    this.rosters.requestLeave(() => this.openDialog("choose-roster"));
  }
  prepareEditor() {
    const id = this.rosters.draft?.id;
    if (id && this.rosters.save()) this.prepare(id);
  }
  start() {
    const m = this.current,
      errors = this.domain.Core.errors(m);
    if (errors.length || this.busy) {
      if (errors.length) this.ui.notify(errors[0]);
      return;
    }
    if (
      this.edit("Бой начат", (next) => {
        next.status = "active";
        next.startedAt = now();
        next.log = [{ at: now(), round: 1, text: "Бой начат" }];
        next.undo = [];
      })
    ) {
      this.view = "play";
      this.ui.actions.scrollTop?.();
    }
  }
  counter(id, field, delta) {
    const f = this.fighter(id);
    if (f)
      this.edit(
        `${f.name}: ${field === "hp" ? "HP" : field === "power" ? "энергия" : "цели"} ${delta > 0 ? "+1" : "−1"}`,
        (next) =>
          this.domain.Core.counter(
            this.domain.Core.allFighters(next).find((f) => f.id === id),
            field,
            delta,
          ),
      );
  }
  score(side, delta) {
    this.edit(
      `${this.label(side)}: VP ${delta > 0 ? "+1" : "−1"}`,
      (next) => (next.score[side] = Math.max(0, next.score[side] + delta)),
    );
  }
  activate(id) {
    const f = this.fighter(id);
    if (f?.status === "ready")
      this.edit(
        `${f.name}: ${f.acted ? "снята активация" : "походил"}`,
        (next) => {
          const target = this.domain.Core.allFighters(next).find(
            (f) => f.id === id,
          );
          target.acted = !target.acted;
        },
      );
  }
  cycle(id) {
    const f = this.fighter(id);
    if (f)
      this.edit(f.name + ": смена состояния ↻", (next) =>
        this.domain.Core.cycleStatus(
          next,
          this.domain.Core.allFighters(next).find((f) => f.id === id),
        ),
      );
  }
  changeForm(id, form = null, face = null) {
    const f = this.fighter(id);
    if (!f) return;
    this.edit(f.name + ": изменена форма или сторона", (next) => {
      const fighter = this.domain.Core.allFighters(next).find(
          (f) => f.id === id,
        ),
        detail = next.references[fighter.slug],
        actualForm = form ?? fighter.form,
        card = actualForm === 1 ? detail.secondStatCard : detail.statCard,
        which =
          face ||
          (Number(card?.[fighter.face + "Side"]?.stamina) > 0
            ? fighter.face
            : "front");
      this.domain.Core.changeFace(next, fighter, which, actualForm);
      if (fighter.status !== "ready") fighter.hp = 0;
    });
  }
  condition(id, name) {
    const f = this.fighter(id);
    if (f)
      this.edit(
        `${f.name}: ${f.conditions.includes(name) ? "снято" : "добавлено"} ${name}`,
        (next) => {
          const target = this.domain.Core.allFighters(next).find(
            (f) => f.id === id,
          );
          target.conditions = target.conditions.includes(name)
            ? target.conditions.filter((c) => c !== name)
            : [...target.conditions, name];
        },
      );
  }
  setCustomCondition(value) {
    this.customCondition = value;
  }
  addCondition(id) {
    const name = this.customCondition.trim();
    if (!name) return;
    if (!this.fighter(id).conditions.includes(name)) this.condition(id, name);
    this.customCondition = "";
  }
  setPriority(value) {
    this.edit(
      "Приоритет: " +
        (value === "mine"
          ? "у меня"
          : value === "opponent"
            ? "у противника"
            : "не указан"),
      (next) => (next.priority = value),
    );
  }
  setThreat(value) {
    const threat = Number(value);
    if (!Number.isInteger(threat) || threat < 1 || threat > 99) {
      this.ui.notify("Threat должен быть целым числом от 1 до 99.");
      return;
    }
    if (this.current?.threat !== threat)
      this.edit("Лимит Threat изменён", (next) => (next.threat = threat));
  }
  setName(value, opponent = false) {
    if (this.current?.status !== "preparing") return;
    const current = opponent ? this.current.opponent.name : this.current.name;
    if (current === value) return;
    this.edit("Название партии изменено", (next) => {
      if (opponent) next.opponent.name = value;
      else next.name = value;
    });
  }
  setAffiliation(side, value) {
    this.edit("Аффилиация отряда изменена", (next) => {
      next[side].affiliation = value;
      next[side].leader = null;
    });
  }
  setLeader(side, value) {
    this.edit("Лидер выбран", (next) => (next[side].leader = value || null));
  }
  removeFighter(id, side, confirmed = false) {
    const f = this.fighter(id);
    if (!f) return;
    if (this.current.status === "active" && !confirmed) {
      this.picker = null;
      this.dialog = { type: "remove", id, side };
      return;
    }
    if (
      this.edit("Убран " + f.name, (next) => {
        next[side].fighters = next[side].fighters.filter((f) => f.id !== id);
        if (next[side].leader === id) next[side].leader = null;
      })
    )
      this.closeDialog();
  }
  removeTactic(side, slug) {
    this.edit(
      "Убрана тактика",
      (next) =>
        (next[side].tactics = next[side].tactics.filter(
          (t) => t.slug !== slug,
        )),
    );
  }
  flipTactic(side, slug) {
    const tactic = this.current?.[side]?.tactics.find((t) => t.slug === slug);
    if (!tactic) return;
    const played = !tactic.played;
    this.edit(
      `${tactic.name}: ${played ? "сыграна" : "возвращена в руку"}`,
      (next) => {
        const t = next[side].tactics.find((t) => t.slug === slug);
        if (!t) throw Error("Карта уже убрана из партии.");
        t.played = played;
      },
    );
  }
  game(card, kind) {
    if (card) this.cards.showGame(card, kind, "Снимок для партии");
  }
  tactic(side, slug) {
    const t = this.current?.[side].tactics.find((t) => t.slug === slug);
    this.game(
      t?.card ||
        this.rosters.card("tactics", this.rosters.canonical("tactics", slug)),
      "tactics",
    );
  }
  mission(kind) {
    this.game(this.current?.[kind], "crises");
  }
  clearMission(kind) {
    this.edit("Убрана миссия " + kind, (next) => (next[kind] = null));
  }
  openPicker(side, kind = "characters", mission = null) {
    this.picker = {
      side,
      kind,
      mission,
      query: "",
      affiliation: "",
      owned: false,
      available: false,
    };
  }
  closePicker() {
    this.picker = null;
  }
  setPicker(name, value) {
    if (this.picker) this.picker[name] = value;
  }
  pickerTab(kind) {
    if (this.picker)
      Object.assign(this.picker, {
        kind,
        query: "",
        affiliation: "",
        owned: false,
      });
  }
  get pickerRows() {
    const p = this.picker,
      m = this.current;
    if (!p || !m) return [];
    let rows =
      p.kind === "characters"
        ? this.catalog.rows.filter((c) => !c.isGrunt)
        : this.rosters.cards[p.kind];
    const networkRoster = this.network?.roster?.(p.side);
    if ((networkRoster || p.side === "mine") && p.kind !== "crises")
      rows = rows.filter((c) =>
        (networkRoster || m.sourceRoster)[p.kind].some((s) =>
          p.kind === "characters"
            ? s === c.slug
            : this.rosters.canonical(p.kind, s) === c.slug,
        ),
      );
    if (p.mission)
      rows = rows.filter(
        (c) => c.type === (p.mission === "secure" ? "Secure" : "Extraction"),
      );
    return rows.filter(
      (c) =>
        words(p.query).every((q) =>
          words(c.name + " " + (c.alterEgo || "")).some((w) => w.startsWith(q)),
        ) &&
        (!p.affiliation ||
          (p.kind === "characters"
            ? c.affiliations.some((a) => a.name === p.affiliation)
            : c.affiliation?.name === p.affiliation)) &&
        (!p.owned || this.library.owned.has(c.slug)) &&
        (!p.available ||
          ["legal", "restricted"].includes(c.standardTimelineStatus)),
    );
  }
  async pick(slug, include) {
    if (!this.picker || !this.current) return;
    const p = { ...this.picker },
      id = this.matchId;
    if (
      !include &&
      p.kind === "characters" &&
      this.current.status === "active"
    ) {
      this.removeFighter(
        this.current[p.side].fighters.find((f) => f.slug === slug)?.id,
        p.side,
      );
      return;
    }
    const pendingKey = p.side + ":" + p.kind + ":" + slug;
    this.pendingPicks.set(pendingKey, include);
    let detail;
    try {
      if (include && p.kind === "characters") {
        this.busy++;
        detail = await this.catalog.detail(slug);
      }
      if (this.matchId !== id || this.current?.status === "finished") return;
      await (this.activeNetwork ? this.network.editAsync : this.edit)(
        `${this.label(p.side)}: ${include ? "добавлено" : "убрано"} ${this.catalog.byId.get(slug)?.name || this.rosters.card(p.kind, slug)?.name || slug}`,
        (m) => {
          const team = m[p.side],
            Core = this.domain.Core;
          if (p.kind === "characters") {
            if (include) {
              m.references[slug] = Core.clone({
                statCard: {
                  frontSide: detail.statCard.frontSide,
                  backSide: detail.statCard.backSide,
                },
                secondStatCard: detail.secondStatCard
                  ? {
                      frontSide: detail.secondStatCard.frontSide,
                      backSide: detail.secondStatCard.backSide,
                    }
                  : null,
              });
              if (!team.fighters.some((f) => f.slug === slug))
                team.fighters.push(
                  Core.fighter(
                    this.catalog.byId.get(slug),
                    detail,
                    crypto.randomUUID(),
                  ),
                );
            } else {
              const removed = team.fighters.find((f) => f.slug === slug);
              team.fighters = team.fighters.filter((f) => f.slug !== slug);
              if (team.leader === removed?.id) team.leader = null;
            }
          } else if (p.mission)
            m[p.mission] = Core.clone(this.rosters.card("crises", slug));
          else if (include) {
            const c = this.rosters.card("tactics", slug);
            if (!team.tactics.some((t) => t.slug === slug))
              team.tactics.push({
                slug,
                name: c.name,
                played: false,
                card: Core.clone(c),
              });
          } else team.tactics = team.tactics.filter((t) => t.slug !== slug);
        },
      );
    } catch (e) {
      this.ui.notify(e.message);
    } finally {
      runInAction(() => {
        this.pendingPicks.delete(pendingKey);
        if (include && p.kind === "characters") this.busy--;
      });
    }
  }
  openDialog(type, id) {
    this.dialog = { type, id, matchId: this.matchId };
    this.customCondition = "";
    this.error = "";
    if (type === "round") {
      this.roundPriority = this.current.priority;
      this.roundPower = true;
    }
    if (type === "power") this.powerRepeat = false;
  }
  closeDialog() {
    this.dialog = null;
  }
  fighterCard(id) {
    const f = this.fighter(id);
    if (f)
      this.dialog = {
        type: "fighter",
        id,
        matchId: this.matchId,
        followActual: true,
        form: f.form,
        side: f.face,
      };
  }
  preview(form, side) {
    if (this.dialog?.type !== "fighter") return;
    const f = this.fighter(this.dialog.id);
    if (f)
      Object.assign(this.dialog, {
        form,
        side,
        followActual: form === f.form && side === f.face,
      });
  }
  followFighter() {
    if (this.dialog) this.dialog.followActual = true;
  }
  setRoundPower(value) {
    this.roundPower = value;
  }
  setRoundPriority(value) {
    this.roundPriority = value;
  }
  setPowerRepeat(value) {
    this.powerRepeat = value;
  }
  get canUndo() {
    return this.activeNetwork
      ? this.network.canUndo()
      : !!this.current?.undo.length;
  }
  undo() {
    if (this.activeNetwork) return this.network.undo();
    if (this.current && this.write(this.domain.Core.undo(this.current, now())))
      this.ui.notify("Последнее изменение отменено");
  }
  async advance() {
    const m = this.current;
    if (this.activeNetwork) {
      this.network.round(m.round, this.roundPriority, this.roundPower);
      this.closeDialog();
      return;
    }
    if (
      this.edit(`Начат раунд ${m.round + 1}`, (next) => {
        this.domain.Core.nextRound(next);
        next.priority = this.roundPriority;
        if (this.roundPower) this.domain.Phase.apply(next);
      })
    )
      this.closeDialog();
  }
  power() {
    const m = this.current;
    if (this.activeNetwork) {
      this.network.power(m.round, this.powerRepeat);
      this.closeDialog();
      return;
    }
    if (
      this.edit(
        "Power Phase: фиксированные начисления по картам и состояниям",
        (next) => this.domain.Phase.apply(next),
      )
    )
      this.closeDialog();
  }
  async finish() {
    try {
      if (this.activeNetwork) await this.network.finish();
      else if (
        !this.edit("Партия завершена", (next) => {
          next.status = "finished";
          next.finishedAt = now();
        })
      )
        return;
      runInAction(() => {
        this.closeDialog();
        this.view = "home";
        this.matchId = null;
      });
      this.ui.notify("Партия сохранена в истории");
    } catch (e) {
      runInAction(() => (this.error = e.message));
    }
  }
  model(m, f) {
    const key = m.id + ":" + f.id,
      signature = JSON.stringify([f, m.status, this.domain.Core.face(m, f)]),
      previous = this.modelCache.get(key);
    if (previous?.signature === signature) return previous.model;
    const detail = m.references[f.slug],
      card = f.form === 1 ? detail?.secondStatCard : detail?.statCard,
      model = {
        fighter: f,
        character: this.catalog.byId.get(f.slug),
        readonly: m.status !== "active",
        plan: this.domain.Core.statusPlan(m, f),
        immunities: this.domain.Phase.immunities(m, f),
        forms: detail?.secondStatCard
          ? [
              [0, detail.statCard],
              [1, detail.secondStatCard],
            ].map(([value, c]) => ({
              value: String(value),
              label:
                c.frontSide?.nameOverride ||
                (value === 0 ? "Основная" : "Другая"),
            }))
          : [],
        reverse:
          card?.backSide?.type === "healthy" &&
          Number(card.backSide.stamina) > 0
            ? ["front", "back"].map((value) => ({
                value,
                label:
                  card[value + "Side"]?.nameOverride ||
                  (value === "front" ? "Основная" : "Обратная"),
              }))
            : [],
        summary: this.domain.Summary.describe(m, f),
      };
    this.modelCache.set(key, { signature, model });
    if (this.modelCache.size > 100)
      this.modelCache.delete(this.modelCache.keys().next().value);
    return model;
  }
}
