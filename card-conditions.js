/* Special condition effects, paraphrased from Jarvis' Protocol / Core Rules Appendix B.
   Reference: https://www.jarvis-protocol.com/characters/moondragon (English UI, 2026-10-17).
   The ten effects are read-only help; opening a definition never applies a token. */
(function(root){
  'use strict';
  const definitions=Object.freeze({
    bleed:{name:'Bleed',body:'After each Activation, suffer 1 |!damage|.'},
    hex:{name:'Hex',body:'Critical |!critical| results grant no extra dice on attack, defense, or dodge rolls.'},
    incinerate:{name:'Incinerate',body:'Roll one fewer defense die.'},
    judgment:{name:'Judgment',body:'Damage from enemy attacks generates no |!power| for this character.'},
    poison:{name:'Poison',body:'During the Power Phase, lose 1 |!power|.'},
    root:{name:'Root',body:'Before using an Active |!active| or Reactive |!reactive| superpower, spend 1 additional |!power|.'},
    shock:{name:'Shock',body:'Roll one fewer attack die.'},
    slow:{name:'Slow',body:'Advances use only the short |!range_small| movement tool.'},
    stagger:{name:'Stagger',body:'Your first action when activating must be Shake, and that action must remove Stagger.'},
    stun:{name:'Stun',body:'Whenever a single effect would grant more than 1 |!power|, gain just 1 |!power| from that effect.'}
  });
  const api={definitions};root.MCPCardConditions=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
