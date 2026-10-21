import { share } from "./share.js";
import { makeAutoObservable, observableRef } from "mobx";
export class PeerSessionStore {
  books = [];
  storageError = false;
  profile = null;
  room = null;
  role = null;
  connected = false;
  offerText = "";
  answerText = "";
  pending = 0;
  dialog = null;
  form = {
    mode: "create",
    existingId: "",
    name: "",
    rosterId: "",
    offer: "",
    answer: "",
  };
  error = "";
  status = "";
  submitting = false;
  protocol = null;
  constructor(ui) {
    this.ui = ui;
    makeAutoObservable(
      this,
      {
        ui: false,
        protocol: false,
        books: observableRef,
        profile: observableRef,
        room: observableRef,
      },
      { autoBind: true },
    );
  }
  bind(protocol) {
    this.protocol = protocol;
  }
  set(name, value) {
    this[name] = name === "room" ? share(this.room, value) : value;
    return this[name];
  }
  refresh(pending) {
    this.pending = pending;
  }
  show(dialog) {
    this.dialog = dialog;
    this.error = "";
  }
  close() {
    this.dialog = null;
  }
  choose(mode, existing) {
    this.form = {
      mode,
      existingId: existing?.id || "",
      name: this.profile?.name || (mode === "create" ? "Игрок 1" : "Игрок 2"),
      rosterId: "",
      offer: "",
      answer: "",
    };
    this.show("choose");
  }
  field(name, value) {
    this.form[name] = value;
  }
  fail(text) {
    this.error = text;
  }
  async resume(id) {
    try {
      this.protocol.openSaved(id);
      if (!this.connected && this.room.match.status !== "finished")
        await this.protocol.reconnect();
    } catch (e) {
      this.ui.notify(e.message);
    }
  }
  async reconnect() {
    try {
      await this.protocol.reconnect();
    } catch (e) {
      this.ui.notify(e.message);
    }
  }
  async submit() {
    await this.protocol.submitRoom({ ...this.form });
  }
  async accept() {
    await this.protocol.acceptAnswer(this.form.answer);
  }
  ready() {
    this.protocol.ready();
  }
  async copy(kind, field) {
    try {
      await navigator.clipboard.writeText(
        kind === "offer" ? this.offerText : this.answerText,
      );
      this.ui.notify("Текст скопирован");
    } catch {
      field?.focus();
      field?.select();
      this.ui.notify("Выделен весь текст — скопируйте его.");
    }
  }
}
