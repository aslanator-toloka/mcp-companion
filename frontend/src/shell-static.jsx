import { actions } from "./stores/index.js";
import {
  CharacterModal,
  BoxModal,
  MembershipModal,
  DataModal,
} from "./dialogs.jsx";
import { BattleWorkspace } from "./battle.jsx";
import { BattlePickerModal, BattleDialogModal } from "./battle-extra.jsx";
import { PeerModal } from "./peer.jsx";
import { GameCardModal, ConditionModal, RuleReferenceModal } from "./cards.jsx";
import { TournamentPanel } from "./tournament-panel.jsx";
import {
  RosterWorkspace,
  RosterPickerModal,
  RosterActionModal,
} from "./rosters.jsx";
import React, { memo } from "react";
import {
  Navigation,
  SidebarToggle,
  CatalogPanel,
  Sidebar,
  Toast,
  SourceDate,
  Screen,
} from "./shell.jsx";
import { ConnectedPurchases, ConnectedBoxDetail } from "./purchases.jsx";
// Persistent JSX shell; feature stores own state and route visibility.
export const StaticShell = memo(function StaticShell() {
  return (
    <>
      <header className={"review"}>
        <SidebarToggle />
        <span>
          <strong>{"MCP COMPANION"}</strong>
          <small>{"Турниры · коллекция · ростеры"}</small>
        </span>
      </header>
      <div className={"shell"}>
        <Sidebar>
          <a className={"brand"} href={"./"}>
            <span className={"brand-mark"}>{"MCP"}</span>
            <span>
              {"COMPANION"}
              <small>{"За столом и между играми"}</small>
            </span>
          </a>
          <Navigation />
          <div className={"sidebar-bottom"}>
            <small>{"Локальная версия · данные на этом устройстве"}</small>
            <button data-action="data" onClick={() => actions.showData()}>
              {"Данные и экспорт"}
            </button>
            <a
              href={"https://www.jarvis-protocol.com/characters"}
              target={"_blank"}
              rel={"noopener"}
            >
              {"Данные · Jarvis Protocol ↗"}
            </a>
            <SourceDate />
          </div>
        </Sidebar>
        <main>
          <Screen name="catalog" id="catalog-screen">
            <CatalogPanel />
          </Screen>
          <Screen name="rosters" id="rosters-screen">
            <RosterWorkspace />
          </Screen>
          <Screen name="battle" id="battle-screen">
            <BattleWorkspace />
          </Screen>
          <Screen name="tournaments" id="tournaments-screen">
            <TournamentPanel />
          </Screen>
          <Screen name="purchases" id="purchases-screen">
            <ConnectedPurchases />
          </Screen>
        </main>
      </div>
      <BoxModal />
      <CharacterModal />
      <MembershipModal />
      <DataModal />
      <RosterPickerModal />
      <RosterActionModal />
      <GameCardModal />
      <BattleDialogModal />
      <BattlePickerModal />
      <Toast />
      <ConditionModal />
      <RuleReferenceModal />
      <PeerModal />
    </>
  );
});
