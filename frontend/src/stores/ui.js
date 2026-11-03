import { makeAutoObservable, observable, observableRef } from "mobx";
export class UIStore {
  ready = false;
  screen = "catalog";
  mine = false;
  collapsed = false;
  theme = "dark";
  toast = "";
  sourceDate = "";
  dataDialog = null;
  pendingImport = null;
  importFileName = "";
  importError = "";
  membership = false;
  rosterName = "";
  actions = {};
  timer = null;
  constructor(storage) {
    this.storage = storage;
    try {
      this.collapsed =
        storage?.getItem("mcp-companion-sidebar-collapsed-v1") === "1";
    } catch {}
    try {
      if (storage?.getItem("mcp-companion-theme-v1") === "light")
        this.theme = "light";
    } catch {}
    makeAutoObservable(
      this,
      {
        actions: observableRef,
        pendingImport: observableRef,
        storage: false,
        timer: false,
      },
      { autoBind: true },
    );
  }
  setDataDialog(value) {
    this.dataDialog = value;
  }
  confirmImport(value, fileName = "") {
    this.pendingImport = value;
    this.importFileName = fileName;
    this.importError = "";
    this.dataDialog = "confirm";
  }
  setImportError(message) {
    this.importError = message;
  }
  cancelImport() {
    this.pendingImport = null;
    this.importFileName = "";
    this.importError = "";
    this.dataDialog = "main";
  }
  closeData() {
    this.dataDialog = null;
    this.pendingImport = null;
    this.importFileName = "";
    this.importError = "";
  }
  setMembership(value) {
    this.membership = value;
    if (!value) this.rosterName = "";
  }
  setRosterName(value) {
    this.rosterName = value;
  }
  configure(actions) {
    this.actions = actions;
  }
  activate(screen, mine = false) {
    this.screen = screen;
    this.mine = mine;
  }
  setReady(date) {
    this.ready = true;
    this.sourceDate = date;
  }
  toggleSidebar() {
    this.collapsed = !this.collapsed;
    document.documentElement.classList.toggle(
      "sidebar-is-collapsed",
      this.collapsed,
    );
    try {
      this.storage?.setItem(
        "mcp-companion-sidebar-collapsed-v1",
        this.collapsed ? "1" : "0",
      );
    } catch {}
  }
  toggleTheme() {
    this.theme = this.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = this.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      this.theme === "dark" ? "#101722" : "#2563eb",
    );
    try {
      this.storage?.setItem("mcp-companion-theme-v1", this.theme);
    } catch {}
  }
  notify(text) {
    this.toast = text;
    clearTimeout(this.timer);
    this.timer = setTimeout(this.clearToast, 2800);
  }
  clearToast() {
    this.toast = "";
  }
}
