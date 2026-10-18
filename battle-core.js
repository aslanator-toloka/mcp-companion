'use strict';

// Match state is independent of saved rosters and temporary interface state.
const BattleCore = (() => {
  const clone = value => JSON.parse(JSON.stringify(value));
  const allFighters = match => [...match.mine.fighters, ...match.opponent.fighters];
  const face = (match, fighter) => {
    const detail = match.references[fighter.slug];
    const card = fighter.form === 1 ? detail?.secondStatCard : detail?.statCard;
    return fighter.face === 'back' ? card?.backSide : card?.frontSide;
  };
  function fighter(info, detail, id) {
    const stamina = Number(detail.statCard?.frontSide?.stamina);
    if (!Number.isFinite(stamina) || stamina <= 0) throw new Error('Не удалось прочитать HP: ' + info.name);
    return {id, slug:info.slug, name:info.name, alterEgo:info.alterEgo||'', threat:Number(info.threatLevel),
      affiliations:info.affiliations, face:'front', form:0, maxHp:stamina, hp:stamina,
      power:0, acted:false, status:'ready', conditions:[], objectives:0};
  }
  function snapshot(match) {
    const {references, undo, log, ...progress} = match;
    return clone(progress);
  }
  function update(match, label, mutate, now) {
    const next = clone(match), before = snapshot(match);
    mutate(next);
    next.undo = [...(match.undo||[]), {label, progress:before}].slice(-30);
    next.log = [...(match.log||[]), {at:now, round:match.round, text:label}].slice(-200);
    next.updatedAt = now;
    return next;
  }
  function undo(match, now) {
    const last=match.undo?.at(-1); if (!last) return match;
    return {...clone(last.progress), references:match.references, undo:match.undo.slice(0,-1),
      log:[...match.log,{at:now, round:last.progress.round, text:'Отмена: '+last.label}].slice(-200), updatedAt:now};
  }
  function counter(fighter, field, delta) {
    const max = field === 'hp' ? fighter.maxHp : field === 'power' ? 10 : 20;
    fighter[field] = Math.min(max, Math.max(0, fighter[field]+delta));
  }
  function changeFace(match, fighter, which, form=fighter.form) {
    const card=form===1?match.references[fighter.slug]?.secondStatCard:match.references[fighter.slug]?.statCard;
    const selected=which==='back'?card?.backSide:card?.frontSide;
    const hp=Number(selected?.stamina);
    if (!selected || !Number.isFinite(hp) || hp<=0) throw new Error('У этой стороны не указано здоровье.');
    const damage=fighter.maxHp-fighter.hp;
    fighter.face=which;fighter.form=form;fighter.maxHp=hp;fighter.hp=Math.max(0,hp-damage);
  }
  function statusPlan(match, fighter) {
    const detail=match.references[fighter.slug],card=fighter.form===1?detail?.secondStatCard:detail?.statCard;
    const sides=['front','back'];
    const usable=side=>Number(card?.[side+'Side']?.stamina)>0;
    const injured=sides.find(side=>usable(side)&&card[side+'Side'].type==='injured');
    const healthy=sides.find(side=>usable(side)&&card[side+'Side'].type==='healthy');
    const current=fighter.status==='ko'?'ko':fighter.status==='dazed'?'dazed':face(match,fighter)?.type==='injured'?'injured':'healthy';
    const next=current==='ko'?'healthy':current==='injured'?'ko':current==='dazed'?(injured&&face(match,fighter)?.type!=='injured'?'injured':'ko'):injured?'dazed':'ko';
    const labels={healthy:'Healthy',dazed:'Dazed',injured:'Injured',ko:'KO'};
    return {current,next,label:labels[current],nextLabel:labels[next],injured,healthy};
  }
  function cycleStatus(match, fighter) {
    const plan=statusPlan(match,fighter);
    if(plan.next==='dazed'||plan.next==='ko'){
      fighter.status=plan.next;fighter.hp=0;return;
    }
    let form=fighter.form,which=plan.next==='injured'?plan.injured:plan.healthy;
    if(!which&&plan.next==='healthy'){
      form=0;which=['front','back'].find(side=>match.references[fighter.slug]?.statCard?.[side+'Side']?.type==='healthy');
    }
    if(!which)throw new Error('У персонажа нет подходящей стороны карты.');
    changeFace(match,fighter,which,form);
    fighter.status='ready';fighter.hp=fighter.maxHp;fighter.acted=false;fighter.conditions=[];
  }
  function roundPlan(match) {
    return allFighters(match).filter(f=>f.status==='dazed').map(f=>{
      const detail=match.references[f.slug],card=f.form===1?detail?.secondStatCard:detail?.statCard;
      const back=card?.backSide;
      const injured=f.face==='front'&&back?.type==='injured'&&Number(back.stamina)>0;
      return {id:f.id,name:f.name,action:injured?'injured':'ko',hp:injured?Number(back.stamina):0};
    });
  }
  function nextRound(match) {
    const plan=new Map(roundPlan(match).map(p=>[p.id,p]));
    for(const f of allFighters(match)) {
      f.acted=false;
      const p=plan.get(f.id);
      if(p?.action==='injured'){f.face='back';f.status='ready';f.maxHp=p.hp;f.hp=p.hp;f.conditions=[];}
      else if(p){f.status='ko';f.hp=0;}
    }
    match.round++;
  }
  function errors(match) {
    const errors=[];
    if(!match.mine.fighters.length)errors.push('Выберите хотя бы одного своего бойца.');
    for(const [side,label] of [['mine','Мой отряд'],['opponent','Противник']]){
      const team=match[side],sum=team.fighters.reduce((total,f)=>total+f.threat,0);
      if(sum>match.threat)errors.push(`${label}: Threat ${sum} превышает лимит ${match.threat}.`);
      const seen=new Set();
      for(const f of team.fighters){const alter=f.alterEgo.toLowerCase().trim();if(alter&&seen.has(alter))errors.push(`${label}: повторяется alter ego ${f.alterEgo}.`);seen.add(alter);}
      if(team.tactics.length>5)errors.push(`${label}: выбрано больше пяти тактик.`);
    }
    return errors;
  }
  function validate(store) {
    const bad=()=>{throw new Error('Не удалось прочитать данные партий.');};
    if(store?.version!==1||!Array.isArray(store.matches))bad();
    const ids=new Set();
    for(const m of store.matches){
      if(!m||typeof m.id!=='string'||ids.has(m.id)||!['preparing','active','finished'].includes(m.status)||!Number.isInteger(m.round)||m.round<1||!Number.isInteger(m.threat)||m.threat<1||!m.references||!Array.isArray(m.log)||!Array.isArray(m.undo)||!m.score||!Number.isInteger(m.score.mine)||m.score.mine<0||!Number.isInteger(m.score.opponent)||m.score.opponent<0||!['mine','opponent','unknown'].includes(m.priority))bad();
      ids.add(m.id);const fighters=new Set();
      for(const side of ['mine','opponent']){
        const team=m[side];if(!team||!Array.isArray(team.fighters)||!Array.isArray(team.tactics))bad();
        for(const f of team.fighters){if(!f||typeof f.id!=='string'||fighters.has(f.id)||typeof f.slug!=='string'||typeof f.name!=='string'||typeof f.alterEgo!=='string'||!Array.isArray(f.affiliations)||f.affiliations.some(a=>!a||typeof a.name!=='string')||!m.references[f.slug]||!['front','back'].includes(f.face)||![0,1].includes(f.form)||!['ready','dazed','ko'].includes(f.status)||!Number.isFinite(f.maxHp)||f.maxHp<=0||!Number.isFinite(f.hp)||f.hp<0||f.hp>f.maxHp||!Number.isInteger(f.power)||f.power<0||f.power>10||!Number.isInteger(f.objectives)||f.objectives<0||!Number.isFinite(f.threat)||typeof f.acted!=='boolean'||!Array.isArray(f.conditions)||f.conditions.some(c=>typeof c!=='string')||!face(m,f))bad();fighters.add(f.id);}
        if(team.tactics.some(t=>typeof t.slug!=='string'||typeof t.played!=='boolean'))bad();
      }
      if(m.undo.some(u=>!u||typeof u.label!=='string'||!u.progress))bad();
      for(const u of m.undo)validate({version:1,matches:[{...u.progress,references:m.references,undo:[],log:[]}]});
    }
    return store;
  }
  return {clone,allFighters,face,fighter,snapshot,update,undo,counter,changeFace,statusPlan,cycleStatus,roundPlan,nextRound,errors,validate};
})();
if(typeof module!=='undefined')module.exports=BattleCore;
