'use strict';

// Read-only presentation of the actual battle face. No actions or resource spending.
const BattleCardSummary = (() => {
  const Core=typeof BattleCore==='undefined'?require('./battle-core.js'):BattleCore;
  function energy(cost,power){
    if(cost===null||cost===undefined||cost==='')return {kind:'none'};
    // Jarvis exports variable-cost powers as either X or the sentinel 100.
    if(String(cost).toUpperCase()==='X'||Number(cost)===100)return {kind:'variable',cost:'X',power};
    const amount=Number(cost);
    if(!Number.isFinite(amount)||amount<0)return {kind:'variable',cost:String(cost),power};
    return {kind:'fixed',cost:amount,power,missing:Math.max(0,amount-power)};
  }
  const sorted=rows=>[...(rows||[])].sort((a,b)=>(a.rank||0)-(b.rank||0));
  // Brief paraphrases of Core Rules, August 2026, Appendix E (p.21).
  // https://cdn.svc.asmodee.net/production-amgcom/uploads/2026/08/CP143en_RevisedCoreSet_Rulebook_08_2026.pdf
  function keywords(name){
    const definitions={
      'flight':'Counts as Size 5 when placing the movement tool for an Advance.',
      'wall crawler':'Counts as Size 5 when placing the movement tool for an Advance.',
      'stealth':'An attacker must be within |!range| 3 to target this character.',
      'peerless':'A Squad can include only one character with Peerless.',
      'reserve':'Cannot start in a Roster or deploy at game start. Only effects naming this character can put it into play.',
      'healing factor':'After its Activation, this character may remove the listed amount of damage from itself.',
      'immunity':'Cannot suffer the listed conditions. Gaining this immunity also removes those conditions.',
      'gem bearer':'May carry one of the listed Infinity Gems; its Threat increases by that Gem’s value.',
      'grunts':'Deploys with its named Parent. Cannot be selected for a Roster; special Grunt rules apply.',
    };
    return String(name).split(/,\s*(?![^\[]*\])/).map(title=>{
      title=title.trim();
      const key=title.replace(/\s*\[.*\]/,'').toLowerCase().replace('wallcrawler','wall crawler').replace(/^immune$/,'immunity');
      return {name:title,body:definitions[key]||null};
    });
  }
  function describe(match,fighter){
    const face=Core.face(match,fighter);
    if(!face)return null;
    return {
      face,
      stats:{move:face.speed,physical:face.physicalDefense,energy:face.energyDefense,mystic:face.mysticDefense},
      abilities:[
        ...sorted(face.attacks).map((ability,index)=>({...ability,kind:'attack',key:`${fighter.id}-${fighter.form}-${fighter.face}-attack-${index}`,energy:energy(ability.powerCost??0,fighter.power)})),
        ...sorted(face.superPowers).map((ability,index)=>({...ability,kind:'power',key:`${fighter.id}-${fighter.form}-${fighter.face}-power-${index}`,energy:energy(ability.powerCost,fighter.power)})),
      ],
    };
  }
  return {energy,describe,keywords};
})();
if(typeof module!=='undefined')module.exports=BattleCardSummary;
