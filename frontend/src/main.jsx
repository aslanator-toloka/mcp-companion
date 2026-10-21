import * as runtime from "./runtime.jsx";
import { CatalogList, CharacterDetail } from "./catalog.jsx";
import { PurchasesPage, BoxDetail } from "./purchases.jsx";
import { RosterList, RosterEditor, RosterPicker } from "./rosters.jsx";
import {
  TournamentCharacters,
  TournamentAffiliations,
  TournamentPlayers,
  TournamentRosters,
  TournamentRosterBody,
  TournamentOverview,
} from "./tournaments.jsx";
import { BattleHome, BattlePlay } from "./battle.jsx";
const views = {
  BattleHome,
  BattlePlay,
  TournamentCharacters,
  TournamentAffiliations,
  TournamentPlayers,
  TournamentRosters,
  TournamentRosterBody,
  TournamentOverview,
  CatalogList,
  CharacterDetail,
  PurchasesPage,
  BoxDetail,
  RosterList,
  RosterEditor,
  RosterPicker,
};
window.MCPReact = {
  ...runtime,
  view: (target, name, props) => {
    if (!views[name]) throw Error("Unknown React view: " + name);
    runtime.render(target, views[name], props);
  },
};
