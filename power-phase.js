'use strict';

// Only fixed Power Phase gains. Dice, tokens, positions and optional choices stay untouched.
const PowerPhase = (() => {
  const Core=typeof BattleCore==='undefined'?require('./battle-core.js'):BattleCore;
  function plain(text){return String(text||'').replace(/\|!([^|]+)\|/g,' $1 ').replace(/\|<[^>]+>([^|]+)\|/g,'$1').replace(/\|[\*§]/g,'').replace(/\|\\\|/g,' ').replaceAll('|','').replace(/\s+/g,' ').replace(/\s+([.,;:])/g,'$1').trim();}
  const isPhase=p=>/power phase/i.test(plain(p.body));
  function fixedBonus(power){
    if(power.type==='leadership')return 0;
    const match=plain(power.body).match(/during the power phase,? this character gains (\d+) additional power[.]/i);
    return match?Number(match[1]):0;
  }
  function immunities(match,fighter){
    const conditions=new Map();
    for(const power of Core.face(match,fighter)?.superPowers||[]){
      const rule=plain(power.name+' '+power.body),matches=[...rule.matchAll(/(?:immunity|immune)\s*\[([^\]]+)\]/gi)];
      for(const match of matches)for(const value of match[1].split(',')){const name=value.trim();if(name)conditions.set(name.toLowerCase(),name);}
    }
    return [...conditions.values()];
  }
  function immune(match,fighter,condition){
    return immunities(match,fighter).some(name=>name.toLowerCase()===condition.toLowerCase()||name.toLowerCase()==='special conditions');
  }
  function fixedLeadership(match,side){
    // Dormammu's printed leadership is compulsory when included in the squad.
    const team=match[side];
    const owner=team.fighters.find(f=>f.status!=='ko'&&(Core.face(match,f)?.superPowers||[]).some(p=>p.type==='leadership'&&p.name.startsWith('Flames of the Faltine')));
    return owner?(Core.face(match,owner)?.superPowers||[]).filter(p=>p.type==='leadership'&&p.name.startsWith('Flames of the Faltine')&&/each other character you control gains 1 additional power during the power phase/i.test(plain(p.body))):[];
  }
  function calculate(match){
    const rows=[];
    for(const side of ['mine','opponent'])for(const fighter of match[side].fighters){
      const row={id:fighter.id,side,name:fighter.name,before:fighter.power,after:fighter.power,steps:[],excluded:[],notes:[]};
      if(fighter.status!=='ready'){row.notes.push(fighter.status==='ko'?'KO: начисление пропущено':'Dazed: начисление пропущено');rows.push(row);continue;}
      const powers=(Core.face(match,fighter)?.superPowers||[]).filter(p=>p.type!=='leadership'&&isPhase(p));
      const bonuses=powers.map(p=>({name:p.name,amount:fixedBonus(p)})).filter(p=>p.amount>0);
      row.excluded=powers.filter(p=>!fixedBonus(p)).map(p=>p.name);
      const leadership=fixedLeadership(match,side);
      let gain=1+bonuses.reduce((n,p)=>n+p.amount,0)+leadership.length;
      row.steps.push({label:'Базовая энергия',amount:1});
      for(const bonus of bonuses)row.steps.push({label:bonus.name,amount:bonus.amount});
      for(const power of leadership)row.steps.push({label:power.name,amount:1});
      for(const condition of ['Stun','Poison'])if(fighter.conditions.includes(condition)&&immune(match,fighter,condition))row.notes.push(`Immunity: ${condition} не действует`);
      if(fighter.conditions.includes('Stun')&&!immune(match,fighter,'Stun')&&gain>1){row.steps.push({label:'Stun: всё фиксированное начисление ограничено до 1',amount:1-gain});gain=1;}
      const clamped=Math.min(10,fighter.power+gain);
      if(clamped<fighter.power+gain)row.steps.push({label:'Лимит 10 энергии',amount:clamped-(fighter.power+gain)});
      row.after=clamped;
      if(fighter.conditions.includes('Poison')&&!immune(match,fighter,'Poison')){
        const loss=Math.min(1,row.after);row.after-=loss;row.steps.push({label:'Poison',amount:-loss});
      }
      rows.push(row);
    }
    return {rows};
  }
  function apply(match){
    const result=calculate(match);
    for(const row of result.rows)Core.allFighters(match).find(f=>f.id===row.id).power=row.after;
    match.powerPhaseRound=match.round;match.basePowerRound=match.round;
    match.powerPhaseResult={round:match.round,rows:result.rows};
    return result;
  }
  return {plain,isPhase,fixedBonus,immunities,immune,calculate,apply};
})();
if(typeof module!=='undefined')module.exports=PowerPhase;
