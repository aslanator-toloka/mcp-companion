'use strict';

// Presentation only: never writes to the match or the reference cards. Conditional
// bonuses needing a target, a roll or a player's choice stay in the printed rules.
const BattleCharacterState = (() => {
  const Core=typeof BattleCore==='undefined'?require('./battle-core.js'):BattleCore;
  const Phase=typeof PowerPhase==='undefined'?require('./power-phase.js'):PowerPhase;
  const Summary=typeof BattleCardSummary==='undefined'?require('./battle-card-summary.js'):BattleCardSummary;
  const sorted=rows=>[...(rows||[])].sort((a,b)=>(a.rank||0)-(b.rank||0));
  function value(base,current=base,reasons=[]){
    return {base,value:current,changed:String(base)!==String(current),reason:reasons.join(' · ')};
  }
  function numeric(base,delta,reasons){
    return /^\d+$/.test(String(base))?value(base,delta?Math.max(1,Number(base)+delta):base,reasons):value(base);
  }
  function describe(match,fighter){
    const face=Core.face(match,fighter);if(!face)return null;
    const affected=name=>fighter.conditions.some(c=>c.toLowerCase()===name.toLowerCase())&&!Phase.immune(match,fighter,name);
    const incinerate=affected('Incinerate'),slow=affected('Slow'),shock=affected('Shock'),root=affected('Root');
    const damage=Math.max(0,fighter.maxHp-fighter.hp),attackReasons=[];
    let attackDelta=shock?-1:0;
    if(shock)attackReasons.push('Shock: −1 кубик');
    for(const power of face.superPowers||[]){
      if(power.type!=='innate')continue;
      const text=Phase.plain(power.body).replace(/[’‘]/g,"'");
      const rule=text.match(/^Add (?:one|1) die to this character's attack rolls for (?:every (\d+)|each) damage it has\./i);
      if(!rule)continue;
      const bonus=Math.floor(damage/Number(rule[1]||1));
      if(bonus){attackDelta+=bonus;attackReasons.push(`${power.name}: +${bonus} (${damage} повреждений)`);}
    }
    const stats={
      physical:numeric(face.physicalDefense,incinerate?-1:0,incinerate?['Incinerate: −1 кубик']:[]),
      energy:numeric(face.energyDefense,incinerate?-1:0,incinerate?['Incinerate: −1 кубик']:[]),
      mystic:numeric(face.mysticDefense,incinerate?-1:0,incinerate?['Incinerate: −1 кубик']:[]),
      speed:value(face.speed,slow?'S':face.speed,slow?['Slow: только короткое перемещение']:[]),
      stamina:{...value(face.stamina,`${fighter.hp}/${fighter.maxHp}`,[`${damage} повреждений`]),changed:fighter.hp!==fighter.maxHp},
    };
    return {
      stats,
      attacks:sorted(face.attacks).map(attack=>({strength:numeric(attack.strength,attackDelta,attackReasons)})),
      powers:sorted(face.superPowers).map(power=>{
        const cost=Summary.energy(power.powerCost,fighter.power);
        const surcharge=root&&['active','reactive'].includes(power.type);
        if(!surcharge)return {cost:value(cost.kind==='variable'?cost.cost:power.powerCost)};
        const base=cost.kind==='variable'?cost.cost:Number(power.powerCost||0);
        return {cost:value(base,cost.kind==='variable'?`${base} + 1`:base+1,['Root: перед применением дополнительно 1 энергия'])};
      }),
      affected:fighter.conditions.filter(c=>!Phase.immune(match,fighter,c)),
      immuneConditions:fighter.conditions.filter(c=>Phase.immune(match,fighter,c)),
    };
  }
  return {describe};
})();
if(typeof module!=='undefined')module.exports=BattleCharacterState;
