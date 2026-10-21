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
  function descriptionMarkup(slug,format){
    if(!Object.hasOwn(definitions,slug))return '';
    const item=definitions[slug];
    return `<div class="sc-condition-description" lang="en"><button type="button" class="sc-condition-close" aria-label="Закрыть описание состояния">×</button><img class="sc-condition-token" src="assets/conditions/${slug}.png" alt="" width="160" height="160"><h2 id="sc-condition-title">${item.name}</h2><p id="sc-condition-body">${format(item.body)}</p></div>`;
  }
  const api={definitions,descriptionMarkup};root.MCPCardConditions=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof document==='undefined')return;
  const dialog=document.createElement('dialog');dialog.id='sc-condition-dialog';dialog.className='sc-condition-dialog';dialog.setAttribute('aria-labelledby','sc-condition-title');dialog.setAttribute('aria-describedby','sc-condition-body');
  document.body.append(dialog);
  let trigger=null;
  dialog.addEventListener('close',()=>{
    const previous=trigger;trigger=null;
    previous?.setAttribute('aria-expanded','false');
    if(previous?.isConnected&&!previous.closest('dialog:not([open])'))previous.focus({preventScroll:true});
  });
  dialog.addEventListener('click',event=>{
    if(event.target.closest('.sc-condition-close')||event.target===dialog)dialog.close();
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-card-condition]');if(!button)return;
    const slug=button.dataset.cardCondition;if(!Object.hasOwn(definitions,slug))return;
    event.preventDefault();
    trigger?.setAttribute('aria-expanded','false');trigger=button;
    MCPReact.html(dialog,descriptionMarkup(slug,root.MCPCardRenderer.rule));
    trigger.setAttribute('aria-expanded','true');
    if(!dialog.open)dialog.showModal();
  });
})(typeof window==='object'?window:globalThis);
