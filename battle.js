'use strict';

let battleStorageKey='mcp-companion-battles-v1';
let battleStore={version:1,matches:[]},battleMatchId=null,battleView='home',battleTeam='mine';
let battlePicker=null,battleBusy=0,battleDialogContext=null,battleReadError=false;
const battleConditions=[['Bleed','Кровотечение'],['Hex','Проклятие'],['Incinerate','Горение'],['Judgment','Осуждение'],['Poison','Яд'],['Root','Корни'],['Shock','Шок'],['Slow','Замедление'],['Stagger','Потеря действия'],['Stun','Оглушение']];
const matchNow=()=>new Date().toISOString();
const currentMatch=()=> (typeof window!=='undefined'&&window.NetworkBattle?.current())||battleStore.matches.find(m=>m.id===battleMatchId);
const currentFighter=id=>BattleCore.allFighters(currentMatch()).find(f=>f.id===id);
const matchThreat=team=>team.fighters.reduce((total,f)=>total+f.threat,0);
const teamLabel=side=>typeof window!=='undefined'&&window.NetworkBattle?NetworkBattle.label(side):(side==='mine'?'Мои':'Противник');
function validateBattleData(value){
  BattleCore.validate(value);
  for(const m of value.matches){
    MapGeometry.validate(m.map);
    for(const u of m.undo)MapGeometry.validate(u.progress.map);
    if(BattleCore.allFighters(m).some(f=>!characters.has(f.slug)))throw new Error('В партии указан неизвестный персонаж.');
    for(const u of m.undo)if(BattleCore.allFighters(u.progress).some(f=>!characters.has(f.slug)))throw new Error('В истории партии указан неизвестный персонаж.');
  }
  return value;
}
function battleDataOnly(){return BattleCore.clone(battleStore);}
function loadBattleData(){
  try{const raw=localStorage.getItem(battleStorageKey);if(raw)battleStore=validateBattleData(JSON.parse(raw));battleReadError=false;}
  catch{battleReadError=true;toast('Сохранение партий не прочитано. Исходная запись сохранена.');}
}
function replaceBattleData(value){
  try{validateBattleData(value);localStorage.setItem(battleStorageKey,JSON.stringify(value));battleStore=BattleCore.clone(value);battleReadError=false;if(typeof window!=='undefined')window.Account?.save();return true;}
  catch(error){toast(error.message||'Не удалось сохранить партию.');return false;}
}
function writeMatch(next){
  if(battleReadError){toast('Восстановите данные партий из экспорта, прежде чем создавать новую.');return false;}
  const value={version:1,matches:battleStore.matches.some(m=>m.id===next.id)?battleStore.matches.map(m=>m.id===next.id?next:m):[next,...battleStore.matches]};
  return replaceBattleData(value);
}
function editMatch(label,mutate){
  const m=currentMatch();if(!m||m.status==='finished')return false;
  if(typeof window!=='undefined'&&window.NetworkBattle?.active())return NetworkBattle.edit(label,mutate);
  try{
    const next=m.status==='preparing'?BattleCore.clone(m):BattleCore.update(m,label,mutate,matchNow());
    if(m.status==='preparing'){mutate(next);next.updatedAt=matchNow();}
    if(!writeMatch(next))return false;
    renderBattle();if(battleDialogContext?.type==='fighter')renderBattleFighterCard();return true;
  }catch(error){toast(error.message);return false;}
}
function showBattleScreen(){
  screen='battle';$('#tournaments-screen').hidden=true;rosterDraft=null;$('#catalog-screen').hidden=true;$('#rosters-screen').hidden=true;$('#battle-screen').hidden=false;
  updateNavigation();renderBattle();window.scrollTo(0,0);
}
function navigateBattle(){requestLeave(()=>{battleView='home';battleMatchId=null;showBattleScreen();window.NetworkBattle?.list().catch(e=>toast(e.message));});}
function openMatch(id){
  const m=battleStore.matches.find(m=>m.id===id);if(!m)return;
  battleMatchId=id;battleTeam='mine';battleView=m.status==='preparing'?'setup':'play';showBattleScreen();
}
function prepareMatch(rosterId){
  if(!initialized||battleReadError)return;
  requestLeave(()=>{
    const roster=state.rosters.find(r=>r.id===rosterId);if(!roster){toast('Выберите сохранённый ростер.');return;}
    const now=matchNow(),m={id:crypto.randomUUID(),status:'preparing',name:roster.name,createdAt:now,updatedAt:now,
      sourceRoster:normalizeRosterRecord(roster),threat:17,round:1,score:{mine:0,opponent:0},priority:'unknown',
      mine:{name:'Я',affiliation:roster.affiliation,leader:null,fighters:[],tactics:[]},
      opponent:{name:'Противник',affiliation:'',leader:null,fighters:[],tactics:[]},
      secure:null,extract:null,references:{},undo:[],log:[]};
    if(writeMatch(m))openMatch(m.id);
  });
}
function matchTile(m){
  const done=m.status==='finished',preparing=m.status==='preparing';
  return `<article class="match-tile"><div class="roster-tile-top"><span class="eyebrow">${preparing?'Подготовка':done?'Завершён':'Идёт бой'}</span><span class="tag">Threat ${m.threat}</span></div><h3>${esc(m.name)}</h3><p>${esc(m.opponent.name)} · ${new Date(m.updatedAt).toLocaleDateString('ru-RU')}</p><div class="roster-portraits">${m.mine.fighters.slice(0,6).map(f=>avatar(characters.get(f.slug))).join('')}</div><div class="match-tile-bottom"><span>${preparing?`${m.mine.fighters.length} бойцов выбрано`:`Раунд ${m.round} · ${m.score.mine} : ${m.score.opponent}`}</span><button class="${done?'':'primary'}" data-bt="open" data-id="${esc(m.id)}">${preparing?'Продолжить подготовку':done?'Посмотреть':'Продолжить бой →'}</button></div></article>`;
}
function battleHome(){
  const pending=battleStore.matches.filter(m=>m.status!=='finished'&&!window.NetworkBattle?.isPeer?.(m.id)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const history=battleStore.matches.filter(m=>m.status==='finished'&&!window.NetworkBattle?.isPeer?.(m.id)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  return `${typeof window!=='undefined'&&(window.Account?.enabled||window.NetworkBattle?.available?.())?NetworkBattle.home():''}<div class="heading"><div><span class="eyebrow">08 / Бой</span><h1>За столом</h1><p>Продолжить партию или собрать отряд для новой.</p></div><button class="primary" data-bt="choose-roster" ${battleReadError?'disabled':''}>Новый бой +</button></div>${battleReadError?'<div class="notice">Сохранение партий не удалось прочитать. Исходная запись не перезаписывается; восстановите резервный JSON через «Данные».</div>':''}${pending.length?`<div class="match-grid">${pending.map(matchTile).join('')}</div>`:'<div class="empty roster-empty"><h3>Пока нет незавершённых партий</h3><p>Выберите свой ростер, отметьте бойцов и начните. Противника можно добавить позже.</p><button class="primary" data-bt="choose-roster">Выбрать ростер →</button></div>'}<div class="section-title battle-history-title"><h3>История партий</h3><span class="muted">${history.length}</span></div>${history.length?`<div class="match-grid">${history.map(matchTile).join('')}</div>`:'<p class="muted">Здесь появятся завершённые партии.</p>'}`;
}
function battleDialog(title,description,body,context=null){
  $('#battle-dialog').classList.remove('battle-character-dialog');
  battleDialogContext=context;
  $('#battle-dialog-content').innerHTML=`<div class="dialog-heading"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div><button class="quiet close" data-bt="close-dialog" aria-label="Закрыть окно партии">×</button></div>${body}`;
  if(!$('#battle-dialog').open)$('#battle-dialog').showModal();
}
function chooseBattleRoster(){
  requestLeave(()=>battleDialog('Мой ростер','Выберите сохранённый состав. Неполный ростер тоже подходит.',state.rosters.length?`<div class="battle-roster-choices">${state.rosters.map(r=>`<button data-bt="prepare" data-roster="${esc(r.id)}"><span><strong>${esc(r.name)}</strong><small>${esc(r.affiliation||'Без аффилиации')} · ${rosterCounts(r)}</small></span><span>→</span></button>`).join('')}</div>`:'<div class="empty"><h3>Сначала нужен ростер</h3><p>Создайте состав в разделе «Ростеры», затем выберите отряд на партию.</p><button class="primary" data-bt="make-roster">Создать ростер →</button></div>'));
}
function selectedSquad(team,side){
  return `<div class="setup-squad">${team.fighters.map(f=>`<div class="setup-fighter"><button class="selected-character" data-bt="fighter-card" data-id="${esc(f.id)}">${avatar(characters.get(f.slug))}<span><strong>${esc(f.name)}</strong><small>${esc(f.alterEgo)} · Threat ${f.threat}${f.affiliations.some(a=>a.name===team.affiliation)?' · Аффилирован':''}</small></span></button><button class="quiet" data-bt="remove-fighter" data-id="${esc(f.id)}" data-side="${side}" aria-label="Убрать ${esc(f.name)}">×</button></div>`).join('')||`<div class="empty"><p>${side==='mine'?'Выберите бойцов из своего ростера.':'Можно играть без учёта бойцов противника.'}</p></div>`}</div>`;
}
function battleTacticCards(team,side,readonly=false,scope='play'){
  return `<div class="battle-tactics battle-tactics-strip" role="region" aria-label="Тактики ${esc(teamLabel(side))} · горизонтальная лента" tabindex="0">${team.tactics.map(t=>{
    const card=t.card||rosterCard('tactics',canonicalCard('tactics',t.slug))||rosterCard('tactics',t.slug);
    const action=t.played?'Вернуть в руку':'Отметить сыгранной';
    const corner=`<button type="button" class="battle-tactic-flip" data-bt="flip-tactic" data-side="${side}" data-slug="${esc(t.slug)}" aria-label="${action}: ${esc(t.name)}" aria-pressed="${!!t.played}" title="${action}" ${readonly?'disabled':''}><span aria-hidden="true">${t.played?'↶':'↻'}</span></button>`;
    const face=card?MCPGameCardRenderer.render(card,'tactics',{side:t.played?'back':'front',cornerAction:corner}):`<div class="battle-tactic-unavailable"><strong>${esc(t.name)}</strong><p>Текст карты недоступен.</p>${corner}</div>`;
    return `<article id="battle-tactic-${esc(scope)}-${side}-${esc(t.slug)}" class="battle-tactic battle-tactic-card ${t.played?'played':''}" aria-label="${esc(t.name)} · ${t.played?'сыграна':'в руке'}"><div class="battle-tactic-card-top"><span class="battle-tactic-status">${t.played?'✓ Сыграна':'В руке'}</span><button type="button" class="quiet battle-tactic-enlarge" data-bt="tactic-card" data-side="${side}" data-slug="${esc(t.slug)}" aria-label="Открыть крупно: ${esc(t.name)}" title="Открыть крупно">↗</button></div><div class="gc-surface battle-tactic-surface">${face}</div></article>`;
  }).join('')}</div>`;
}
function tacticsList(team,side,playing=false,readonly=false,scope='play'){
  if(playing&&team.tactics.length)return battleTacticCards(team,side,readonly,scope);
  return team.tactics.length?`<div class="battle-tactics">${team.tactics.map(t=>`<div class="battle-tactic ${t.played?'played':''}">${playing?`<label class="check"><input type="checkbox" data-battle-played="${esc(t.slug)}" data-side="${side}" ${t.played?'checked':''} ${readonly?'disabled':''}>${t.played?'Сыграна':'В руке'}</label>`:''}<button class="quiet tactic-name" data-bt="tactic-card" data-side="${side}" data-slug="${esc(t.slug)}">${esc(t.name)} ↗</button>${!playing?`<button class="quiet" data-bt="remove-tactic" data-side="${side}" data-slug="${esc(t.slug)}" aria-label="Убрать тактику ${esc(t.name)}">×</button>`:''}</div>`).join('')}</div>`:'<p class="muted battle-small">Тактики не указаны.</p>';
}
function missionMarkup(m,setup=false){
  return `<div class="mission-grid">${[['secure','Secure'],['extract','Extract']].map(([key,label])=>`<div class="mission-choice" data-kind="${key}"><span class="eyebrow">${label}</span>${m[key]?`<button class="mission-title" data-bt="mission-card" data-kind="${key}">${esc(m[key].name)} ↗</button><small>Threat ${m[key].threatLevel} · карта ${esc(m[key].setup||'—')}</small>`:'<p class="muted">Не указан</p>'}${setup?`<div class="actions"><button data-bt="missions" data-kind="${key}">${m[key]?'Заменить':'Выбрать'}</button>${m[key]?`<button class="quiet" data-bt="clear-mission" data-kind="${key}">Убрать ×</button>`:''}</div>`:''}</div>`).join('')}</div>`;
}
function squadAffiliation(team){const n=team.fighters.filter(f=>f.affiliations.some(a=>a.name===team.affiliation)).length;return team.affiliation?`${n} из ${team.fighters.length} · ${n>team.fighters.length/2?'большинство есть':'нужно большинство'}`:'Без выбранной аффилиации';}
function leaderOptions(team){return '<option value="">Без лидерства</option>'+team.fighters.filter(f=>f.affiliations.some(a=>a.name===team.affiliation&&a.isLeader)).map(f=>`<option value="${esc(f.id)}" ${team.leader===f.id?'selected':''}>${esc(f.name)} · ${esc(f.alterEgo)}</option>`).join('');}
function battleSetup(m){
  if(typeof window!=='undefined'&&window.NetworkBattle?.active())return NetworkBattle.setup();
  const problems=BattleCore.errors(m);
  return `<div class="heading"><div><span class="eyebrow">09 / Подготовка боя</span><h1>Собрать отряд</h1><p>${esc(m.name)} · подготовка сохраняется автоматически.</p></div><div class="actions"><button data-bt="map">Карта и расстояния</button><button data-bt="home">← К партиям</button></div></div><div class="setup-fields"><label class="field">Название партии<input id="battle-name" maxlength="100" value="${esc(m.name)}"></label><label class="field">Противник<input id="battle-opponent-name" maxlength="60" placeholder="Имя или команда" value="${esc(m.opponent.name)}"></label><label class="field">Лимит Threat<input id="battle-threat" type="number" min="1" max="99" value="${m.threat}"></label><label class="field">Приоритет<select id="battle-priority">${priorityOptions(m.priority)}</select></label></div><div class="section-title"><h3>Миссия</h3></div>${missionMarkup(m,true)}<div class="setup-columns">${['mine','opponent'].map(side=>{
    const team=m[side];return `<section class="setup-team"><div class="section-title"><h2>${teamLabel(side)}</h2><span class="tag ${matchThreat(team)>m.threat?'missing-tag':''}">Threat ${matchThreat(team)} / ${m.threat}</span></div><button class="squad-add" data-bt="pick" data-side="${side}" data-kind="characters">${side==='mine'?'Выбрать из моего ростера':'Быстро выбрать бойцов и карты'} +</button>${selectedSquad(team,side)}<label class="field">Аффилиация отряда<select data-battle-aff="${side}">${affOptions(team.affiliation)}</select><small>${squadAffiliation(team)}</small></label><label class="field">Лидер<select data-battle-leader="${side}">${leaderOptions(team)}</select></label><div class="section-title"><h3>Тактики · ${team.tactics.length} / 5</h3><button data-bt="pick" data-side="${side}" data-kind="tactics">+ Выбрать</button></div>${tacticsList(team,side)}</section>`;
  }).join('')}</div>${problems.length?`<div class="notice" role="alert">${problems.map(p=>`<p>${esc(p)}</p>`).join('')}</div>`:''}<p class="battle-rule-note">Выберите бойцов и карты на эту партию. Энергия начнётся с 0; Power Phase рассчитает фиксированное начисление каждому бойцу. Прокси и неполный состав допустимы.</p><div class="editor-footer"><span class="battle-small">Подготовка сохранена</span><button class="primary" data-bt="start" ${problems.length||battleBusy?'disabled':''}>Начать бой →</button></div>`;
}
function priorityOptions(value){return [['unknown','Не указан'],['mine',teamLabel('mine')],['opponent',teamLabel('opponent')]].map(([id,label])=>`<option value="${id}" ${id===value?'selected':''}>${label}</option>`).join('');}
function battleCanUndo(match){return window.NetworkBattle?.active()?NetworkBattle.canUndo():!!match.undo.length;}
function miniCounter(value,label,action,attributes,minusDisabled=false,plusDisabled=false){
  return `<div class="battle-counter"><button data-bt="${action}" data-delta="-1" ${attributes} aria-label="Уменьшить ${esc(label)}" ${minusDisabled?'disabled':''}>−</button><strong aria-label="${esc(label)}">${value}</strong><button data-bt="${action}" data-delta="1" ${attributes} aria-label="Увеличить ${esc(label)}" ${plusDisabled?'disabled':''}>+</button></div>`;
}
function fighterStateControlMarkup(m,f,readonly=false,showNext=false){
  const plan=BattleCore.statusPlan(m,f),disabled=readonly||m.status!=='active';
  return `<button type="button" class="fighter-state-cycle state-${plan.current}" data-bt="cycle-status" data-id="${esc(f.id)}" data-next-status="${plan.next}" aria-label="Состояние ${esc(f.name)}: ${plan.label}. Переключить в ${plan.nextLabel}" title="${plan.label} → ${plan.nextLabel}. Отмена — кнопкой ↶" ${disabled?'disabled':''}><span>${plan.label}${showNext?' → '+plan.nextLabel:''}</span><span aria-hidden="true">↻</span></button>`;
}
function fighterFormControlsMarkup(m,f,readonly=false){
  const detail=m.references[f.slug],card=f.form===1?detail?.secondStatCard:detail?.statCard,disabled=readonly||m.status!=='active';
  const control=(label,attribute,options)=>`<label class="fighter-form-control"><span>${label}</span><select ${attribute}="${esc(f.id)}" aria-label="${label} в бою ${esc(f.name)}" ${disabled?'disabled':''}>${options}</select></label>`;
  const forms=detail?.secondStatCard?control('Форма','data-battle-fighter-form',[[0,detail.statCard],[1,detail.secondStatCard]].map(([form,card])=>`<option value="${form}" ${f.form===form?'selected':''}>${esc(card.frontSide?.nameOverride||(form===0?'Основная':'Другая'))}</option>`).join('')):'';
  const reverse=card?.backSide?.type==='healthy'&&Number(card.backSide.stamina)>0?control('Сторона','data-battle-fighter-face',['front','back'].map(side=>`<option value="${side}" ${f.face===side?'selected':''}>${esc(card[side+'Side']?.nameOverride||(side==='front'?'Основная':'Обратная'))}</option>`).join('')):'';
  return forms||reverse?`<span class="fighter-form-controls">${forms}${reverse}</span>`:'';
}
function cycleFighterStatus(id){
  const f=currentFighter(id);if(!f)return;
  editMatch(f.name+': смена состояния ↻',next=>BattleCore.cycleStatus(next,BattleCore.allFighters(next).find(item=>item.id===id)));
}
function fighterImmunitiesMarkup(match,fighter){
  const list=PowerPhase.immunities(match,fighter);
  return `<div class="fighter-immunities"><span>Иммунен:</span>${list.length?list.map(name=>`<span class="tag">${esc(name==='Special Conditions'?'Все особые состояния':name)}</span>`).join(''):'<small>Нет</small>'}</div>`;
}
function fighterCardStatsMarkup(m,f){
  const card=BattleCardSummary.describe(m,f);if(!card)return '';
  return `<dl class="fighter-card-stats" aria-label="Характеристики текущей стороны карты">${[['speed','move','Move'],['physical','physical','Физическая защита'],['energy','energy','Энергетическая защита'],['mystic','mystic','Мистическая защита']].map(([icon,key,label])=>`<div data-fighter-stat="${key}" aria-label="${label}: ${esc(card.stats[key]??'—')}"><dt>${MCPCardRenderer.icon('badge-'+icon,true)}<span>${key==='move'?'Move':label.split(' ')[0]}</span></dt><dd>${esc(card.stats[key]??'—')}</dd></div>`).join('')}</dl>`;
}
function fighterAbilityEnergyMarkup(energy){
  if(energy.kind==='none')return '';
  if(energy.kind==='variable')return `<span class="fighter-energy-badge variable" aria-label="Переменная стоимость энергии: ${esc(energy.cost)}" title="Переменная стоимость — см. описание">${MCPCardRenderer.icon('power')}<b>${esc(energy.cost)}</b></span>`;
  const missing=energy.missing>0,label=`Стоимость на карте: ${energy.cost} энергии. ${energy.cost===0?'Без затрат энергии.':missing?`Есть ${energy.power} из ${energy.cost}; не хватает энергии: ${energy.missing}.`:`Энергии хватает: есть ${energy.power}, нужно ${energy.cost}.`}`;
  return `<span class="fighter-energy-badge ${missing?'missing':energy.cost?'enough':'free'}" data-energy-missing="${energy.missing}" aria-label="${label}" title="${label}">${MCPCardRenderer.icon('power')}<b>${missing?`${energy.power}/${energy.cost}`:energy.cost}</b></span>`;
}
function fighterAbilitiesMarkup(m,f){
  const card=BattleCardSummary.describe(m,f);if(!card)return '';
  return `<div class="fighter-abilities">${[['attack','Атаки'],['power','Способности']].map(([kind,label])=>{
    const abilities=card.abilities.filter(a=>a.kind===kind);if(!abilities.length)return '';
    return `<section class="fighter-ability-group" aria-label="${label} ${esc(f.name)}"><h4>${label}</h4>${abilities.map(a=>{
      const body=a.kind==='attack'?(a.steps?.length?`<ul class="fighter-attack-rules">${a.steps.map(text=>`<li>${MCPCardRenderer.rule(text)}</li>`).join('')}</ul>`:''):a.body?`<p>${MCPCardRenderer.rule(a.body)}</p>`:fighterKeywordMarkup(a.name);
      const stats=a.kind==='attack'?`<span class="fighter-attack-stats"><span title="Дальность" aria-label="Дальность: ${esc(a.range)}">${MCPCardRenderer.icon('range')}<b>${esc(a.range)}</b></span><span title="Сила атаки" aria-label="Сила атаки: ${esc(a.strength)}">${MCPCardRenderer.icon('strength')}<b>${esc(a.strength)}</b></span></span>`:'';
      return `<details class="fighter-ability" id="ability-${esc(a.key)}" data-ability-name="${esc(a.name)}"><summary>${MCPCardRenderer.icon('badge-'+(a.kind==='attack'?'attack-':'')+a.type,true)}<span class="fighter-ability-name" lang="en" title="${esc(a.name)}">${esc(a.name)}</span>${stats}${fighterAbilityEnergyMarkup(a.energy)}</summary><div class="fighter-ability-description" lang="en">${body||'<p class="muted">У этой атаки нет дополнительных эффектов.</p>'}</div></details>`;
    }).join('')}</section>`;
  }).join('')}</div>`;
}
function fighterKeywordMarkup(name){
  return `${BattleCardSummary.keywords(name).map(item=>`<p><strong>${esc(item.name)}</strong>${item.body?` — ${MCPCardRenderer.rule(item.body)}`:''}</p>`).join('')}<a href="https://www.atomicmassgames.com/mcp-rules/" target="_blank" rel="noopener">Core Rules · keywords ↗</a>`;
}
function fighterMarkup(m,f,readonly){
  return `<article class="battle-fighter ${f.acted?'acted':''} ${f.status!=='ready'?'unavailable':''}" data-fighter="${esc(f.id)}" data-status="${esc(f.status)}"><div class="fighter-heading"><button class="fighter-portrait" data-bt="fighter-card" data-id="${esc(f.id)}" aria-label="Карточка ${esc(f.name)}">${avatar(characters.get(f.slug))}</button><div class="fighter-name"><h3>${esc(f.name)}</h3><small>${esc(f.alterEgo)} · Threat ${f.threat}</small>${fighterStateControlMarkup(m,f,readonly)}</div></div>${fighterCardStatsMarkup(m,f)}<div class="fighter-counters"><div><span>HP · осталось / ${f.maxHp}</span>${miniCounter(f.hp,'HP '+f.name,'counter',`data-id="${esc(f.id)}" data-field="hp"`,readonly||f.hp===0,readonly||f.hp===f.maxHp)}</div><div><span>Энергия</span>${miniCounter(f.power,'энергию '+f.name,'counter',`data-id="${esc(f.id)}" data-field="power"`,readonly||f.power===0,readonly||f.power===10)}</div></div><div class="hpbar" aria-hidden="true"><i style="width:${100*f.hp/f.maxHp}%"></i></div>${f.hp===0&&f.status==='ready'?`<div class="fighter-zero"><span>HP закончились</span>${fighterStateControlMarkup(m,f,readonly,true)}</div>`:''}<div class="fighter-conditions">${f.conditions.length?f.conditions.map(c=>`<span class="tag">${esc(c)}</span>`).join(''):'<small>Без состояний</small>'}<button class="quiet" data-bt="conditions" data-id="${esc(f.id)}" ${readonly?'disabled':''}>Состояния +</button></div>${fighterImmunitiesMarkup(m,f)}<button class="activation ${f.acted?'selected':''}" data-bt="activate" data-id="${esc(f.id)}" ${readonly||f.status!=='ready'?'disabled':''}>${f.status!=='ready'?'Не может активироваться':f.acted?'✓ Походил · отменить':'○ Ещё не походил'}</button>${fighterAbilitiesMarkup(m,f)}<div class="fighter-bottom"><button class="quiet" data-bt="fighter-card" data-id="${esc(f.id)}">Карточка ↗</button>${fighterFormControlsMarkup(m,f,readonly)}<span>Цели ${f.objectives}</span><button class="quiet" data-bt="objectives" data-id="${esc(f.id)}" ${readonly?'disabled':''}>Изменить</button></div></article>`;
}
function battleSideSwitchMarkup(){
  const ownSide=window.NetworkBattle?.ownSide()||'mine',showingMine=battleTeam===ownSide;
  const target=battleTeam==='mine'?'opponent':'mine';
  const label=showingMine?'Показать отряд противника':'Показать мой отряд';
  return `<button id="battle-side-switch" class="battle-side-switch" data-bt="team" data-side="${target}" aria-label="${label}" title="${label}"><span class="${showingMine?'current':''}">Я</span><span aria-hidden="true">⇄</span><span class="${!showingMine?'current':''}">Противник</span></button>`;
}
function battlePlay(m){
  const readonly=m.status==='finished',team=m[battleTeam],ready=team.fighters.filter(f=>f.status==='ready'&&!f.acted).length;
  return `${battleSideSwitchMarkup()}${typeof window!=='undefined'&&window.NetworkBattle?.active()?NetworkBattle.header():''}<div class="heading"><div><span class="eyebrow">11 / ${readonly?'Завершённая партия':'Бой'}</span><h1>${esc(m.name)}</h1><p>${esc(m[window.NetworkBattle?.active()&&NetworkBattle.ownSide()==='opponent'?'mine':'opponent'].name)} · Threat ${m.threat}${readonly?' · снимок на момент завершения':''}</p></div><button data-bt="home">← К партиям</button></div><div class="battle-dashboard"><div class="round-label"><span>Раунд</span><b>${m.round}</b></div><div class="score-box"><span>${teamLabel('mine')} VP</span>${miniCounter(m.score.mine,teamLabel('mine')+' VP','score','data-side="mine"',readonly||m.score.mine===0,readonly)}</div><div class="score-box"><span>${teamLabel('opponent')} VP</span>${miniCounter(m.score.opponent,teamLabel('opponent')+' VP','score','data-side="opponent"',readonly||m.score.opponent===0,readonly)}</div><label class="field">Приоритет<select id="battle-priority" ${readonly?'disabled':''}>${priorityOptions(m.priority)}</select></label><button class="quiet battle-undo" data-bt="undo" ${readonly||!battleCanUndo(m)?'disabled':''}>↶ Отмена</button></div><div class="battle-toolbar"><button class="primary" data-bt="round" ${readonly?'disabled':''}>Следующий раунд →</button><button data-bt="power" ${readonly?'disabled':''}>Power Phase</button><button data-bt="map">Карта и расстояния</button><button data-bt="missions">Миссии и карты</button><button data-bt="log">Журнал</button><button class="quiet" data-bt="finish" ${readonly?'disabled':''}>Завершить</button></div><div class="battle-side-tabs" role="tablist" aria-label="Сторона боя">${['mine','opponent'].map(side=>`<button role="tab" aria-selected="${battleTeam===side}" data-bt="team" data-side="${side}" class="${battleTeam===side?'selected':''}">${teamLabel(side)}<span>${m[side].fighters.length}</span></button>`).join('')}</div><div class="section-title"><div><h3>${teamLabel(battleTeam)==='Мои'?'Мой отряд':esc(team.name)}</h3><p class="battle-small">${ready} могут походить · ${esc(team.affiliation||'Без аффилиации')}${team.leader?` · лидер ${esc(team.fighters.find(f=>f.id===team.leader)?.name||'—')}`:''}</p></div>${(battleTeam==='opponent'||window.NetworkBattle?.active())&&!readonly?`<button data-bt="pick" data-side="${battleTeam}" data-kind="characters">Изменить состав +</button>`:''}</div><div class="fighter-grid">${team.fighters.map(f=>fighterMarkup(m,f,readonly)).join('')||`<div class="empty roster-empty"><h3>Противник не указан</h3><p>Его счёт уже можно вести. Бойцов и карты добавьте, когда они станут известны.</p>${!readonly?'<button class="primary" data-bt="pick" data-side="opponent" data-kind="characters">Выбрать бойцов и карты +</button>':''}</div>`}</div><div class="section-title battle-tactics-title"><h3>Тактики · ${team.tactics.filter(t=>!t.played).length} в руке</h3>${(battleTeam==='opponent'||window.NetworkBattle?.active())&&!readonly?`<button data-bt="pick" data-side="${battleTeam}" data-kind="tactics">Изменить карты +</button>`:''}</div>${tacticsList(team,battleTeam,true,readonly)}<p class="battle-rule-note">HP, энергию, цели и эффекты меняете вы. Повреждение не начисляет энергию автоматически. Изменения партии сохраняются сразу; ↶ отменяет последнюю правку.</p>`;
}
// Patch the existing tree so counters, portraits, focus and expanded details survive
// a shared-room update. Fighter IDs also keep cards stable when the squad changes.
function patchBattleDOM(parent, desired){
  const key=node=>node?.nodeType===1?(node.id?'id:'+node.id:node.hasAttribute('data-fighter')?'fighter:'+node.getAttribute('data-fighter'):null):null;
  let cursor=parent.firstChild;
  for(const next of [...desired.childNodes]){
    const nextKey=key(next);
    if(nextKey&&key(cursor)!==nextKey){
      const existing=[...parent.childNodes].find(node=>key(node)===nextKey);
      if(existing)parent.insertBefore(existing,cursor);
      else parent.insertBefore(next.cloneNode(true),cursor);
      cursor=cursor?.previousSibling||parent.lastChild;
    }
    if(!cursor){parent.append(next.cloneNode(true));continue;}
    if(cursor.nodeType!==next.nodeType||cursor.nodeName!==next.nodeName||key(cursor)!==nextKey){
      const replacement=next.cloneNode(true);parent.replaceChild(replacement,cursor);cursor=replacement;
    }else if(cursor.nodeType!==1){
      if(cursor.nodeValue!==next.nodeValue)cursor.nodeValue=next.nodeValue;
    }else{
      for(const attr of [...cursor.attributes])if(!next.hasAttribute(attr.name)&&!(cursor.nodeName==='DETAILS'&&attr.name==='open'))cursor.removeAttribute(attr.name);
      for(const attr of [...next.attributes])if(cursor.getAttribute(attr.name)!==attr.value)cursor.setAttribute(attr.name,attr.value);
      patchBattleDOM(cursor,next);
      if(cursor instanceof HTMLInputElement){
        if(cursor.type==='checkbox'||cursor.type==='radio')cursor.checked=next.checked;
        else if(cursor!==document.activeElement&&cursor.value!==next.value)cursor.value=next.value;
      }else if(cursor instanceof HTMLSelectElement)cursor.value=next.value;
    }
    cursor=cursor.nextSibling;
  }
  while(cursor){const next=cursor.nextSibling;cursor.remove();cursor=next;}
}
function renderBattle(){
  if(screen!=='battle')return;
  const focused=typeof document!=='undefined'?document.activeElement:null;
  const editing=focused&&['battle-name','battle-threat'].includes(focused.id)?{id:focused.id,value:focused.value,start:focused.selectionStart,end:focused.selectionEnd}:null;
  const m=currentMatch(),html=battleView==='home'||!m?battleHome():battleView==='map'?renderBattleMap(m):m.status==='preparing'?battleSetup(m):battlePlay(m);
  if(m&&m.status!=='preparing'&&battleView!=='home'){
    const template=document.createElement('template');template.innerHTML=html;patchBattleDOM($('#battle-screen'),template.content);
  }else $('#battle-screen').innerHTML=html;
  if(editing){const input=document.getElementById(editing.id);if(input){input.value=editing.value;input.focus();if(editing.start!==null)input.setSelectionRange(editing.start,editing.end);}}
}
async function battleDetail(slug){
  if(cards.has(slug))return cards.get(slug);
  const response=await fetch('data/cards/'+encodeURIComponent(slug)+'.json');if(!response.ok)throw new Error('Не загрузилась карта персонажа. Попробуйте ещё раз.');
  const detail=await response.json();cards.set(slug,detail);return detail;
}
function openBattlePicker(side,kind='characters',mission=null){battlePicker={side,kind,mission,query:'',affiliation:'',owned:false,available:false};renderBattlePicker();$('#battle-picker-dialog').showModal();}
function renderBattlePicker(){
  const p=battlePicker,m=currentMatch();if(!p||!m)return;
  let rows=p.kind==='characters'?catalog.characters.filter(c=>!c.isGrunt):rosterCards[p.kind];
  const networkRoster=typeof window!=='undefined'?window.NetworkBattle?.roster(p.side):null;
  if((networkRoster||p.side==='mine')&&p.kind!=='crises')rows=rows.filter(c=>(networkRoster||m.sourceRoster)[p.kind].some(s=>p.kind==='characters'?s===c.slug:canonicalCard(p.kind,s)===c.slug));
  if(p.mission)rows=rows.filter(c=>c.type===(p.mission==='secure'?'Secure':'Extraction'));
  rows=rows.filter(c=>searchWords(p.query).every(q=>searchWords(c.name+' '+(c.alterEgo||'')).some(w=>w.startsWith(q)))&&(!p.affiliation||(p.kind==='characters'?c.affiliations.some(a=>a.name===p.affiliation):c.affiliation?.name===p.affiliation))&&(!p.owned||isOwned(c.slug))&&(!p.available||['legal','restricted'].includes(c.standardTimelineStatus)));
  const title=p.mission?`Выбрать ${p.mission==='secure'?'Secure':'Extract'}`:teamLabel(p.side)==='Мои'?'Из моего ростера':'Бойцы и карты противника';
  $('#battle-picker-content').innerHTML=`<div class="dialog-heading"><div><h2>${title}</h2><p>${p.mission?'Укажите реальную миссию партии. Можно выбрать карту любого игрока.':'Отмечайте несколько позиций подряд. Состав сохраняется сразу.'}</p></div><button class="quiet close" data-bt="close-picker" aria-label="Закрыть выбор для партии">×</button></div>${!p.mission?`<div class="editor-tabs">${[['characters','Персонажи'],['tactics','Тактики']].map(([id,label])=>`<button data-bt="picker-tab" data-kind="${id}" class="${p.kind===id?'selected':''}">${label}</button>`).join('')}</div>`:''}<div class="picker-tools"><input id="battle-picker-search" class="picker-search" type="search" placeholder="Поиск по началу слова…" aria-label="Поиск для партии" value="${esc(p.query)}"><div class="picker-filters">${p.kind!=='crises'?`<select id="battle-picker-aff" aria-label="Аффилиация для партии">${affOptions(p.affiliation,'Все аффилиации')}</select>`:''}${p.kind==='characters'?`<label class="check"><input id="battle-picker-owned" type="checkbox" ${p.owned?'checked':''}>Есть у меня</label>`:`<label class="check"><input id="battle-picker-available" type="checkbox" ${p.available?'checked':''}>Доступные в Standard</label>`}</div></div><div class="picker-summary"><span>${rows.length} найдено</span><span>${p.mission?'':`Threat ${matchThreat(m[p.side])} / ${m.threat} · тактики ${m[p.side].tactics.length} / 5`}</span></div><div class="picker-results">${rows.map(c=>{
    const checked=p.mission?m[p.mission]?.slug===c.slug:p.kind==='characters'?m[p.side].fighters.some(f=>f.slug===c.slug):m[p.side].tactics.some(t=>t.slug===c.slug);
    return `<div class="picker-result ${checked?'chosen':''}"><label class="check picker-check"><input type="${p.mission?'radio':'checkbox'}" name="battle-mission" data-battle-pick="${esc(c.slug)}" ${checked?'checked':''} ${battleBusy?'disabled':''}>${p.kind==='characters'?avatar(c):`<span class="card-symbol">${p.kind==='tactics'?'TT':p.mission==='secure'?'S':'E'}</span>`}<span><strong>${esc(c.name)}</strong><small>${p.kind==='characters'?`${esc(c.alterEgo)} · Threat ${c.threatLevel} · ${isOwned(c.slug)?'Есть у меня':'Нет в коллекции'}`:p.kind==='tactics'?esc(c.affiliation?.name||'Без аффилиации'): `Threat ${c.threatLevel} · карта ${esc(c.setup||'—')}`}</small></span></label><button class="quiet" data-bt="picker-card" data-slug="${esc(c.slug)}" aria-label="Посмотреть ${esc(c.name)}">↗</button></div>`;
  }).join('')||`<div class="empty"><p>${p.side==='mine'&&!p.query?'В ростере нет подходящих позиций. Добавьте их в редакторе ростера перед подготовкой новой партии.':'Ничего не найдено. Измените запрос или фильтры.'}</p></div>`}</div><div class="picker-footer"><span>${battleBusy?'Загружаем карту…':'Выбор сохраняется в этой партии.'}</span><button class="primary" data-bt="close-picker" ${battleBusy?'disabled':''}>Готово</button></div>`;
}
async function pickForBattle(slug,include){
  const p={...battlePicker},id=battleMatchId;if(!p||!currentMatch())return;
  if(!include&&p.kind==='characters'&&currentMatch().status==='active'){const f=currentMatch()[p.side].fighters.find(f=>f.slug===slug);confirmRemoveFighter(f,p.side);return;}
  let detail;
  try{
    if(include&&p.kind==='characters'){battleBusy++;renderBattlePicker();detail=await battleDetail(slug);}
    if(battleMatchId!==id||currentMatch()?.status==='finished')return;
    editMatch(`${teamLabel(p.side)}: ${include?'добавлено':'убрано'} ${characters.get(slug)?.name||rosterCard(p.kind,slug)?.name||slug}`,m=>{
      const team=m[p.side];
      if(p.kind==='characters'){
        if(include){m.references[slug]=BattleCore.clone({statCard:{frontSide:detail.statCard.frontSide,backSide:detail.statCard.backSide},secondStatCard:detail.secondStatCard?{frontSide:detail.secondStatCard.frontSide,backSide:detail.secondStatCard.backSide}:null});if(!team.fighters.some(f=>f.slug===slug))team.fighters.push(BattleCore.fighter(characters.get(slug),detail,crypto.randomUUID()));}
        else{const removed=team.fighters.find(f=>f.slug===slug);team.fighters=team.fighters.filter(f=>f.slug!==slug);if(team.leader===removed?.id)team.leader=null;}
      }else if(p.mission){m[p.mission]=BattleCore.clone(rosterCard('crises',slug));}
      else if(include){const c=rosterCard('tactics',slug);if(!team.tactics.some(t=>t.slug===slug))team.tactics.push({slug,name:c.name,played:false,card:BattleCore.clone(c)});}
      else team.tactics=team.tactics.filter(t=>t.slug!==slug);
    });
  }catch(error){toast(error.message);}
  finally{
    if(include&&p.kind==='characters')battleBusy--;
    renderBattle();
    if(battlePicker)renderBattlePicker();
  }
}
function showSnapshotCard(c,kind){
  if(!c)return;
  showNativeGameCard(c,kind,'Снимок для партии');
}
function showFighterCard(id){
  const m=currentMatch(),f=currentFighter(id);if(!m||!f)return;
  battleDialogContext={type:'fighter',id,matchId:m.id,followActual:true,form:f.form,side:f.face};
  renderBattleFighterCard();
}
function showBattleFighterPreview(form,side){
  const context=battleDialogContext,f=context?.type==='fighter'&&currentFighter(context.id);
  if(!f||![0,1].includes(form)||!['front','back'].includes(side))return;
  Object.assign(context,{form,side,followActual:form===f.form&&side===f.face,signature:null});
  renderBattleFighterCard();
}
function battleFighterPortraits(m,selected){
  const own=window.NetworkBattle?.active()?NetworkBattle.ownSide():'mine',sides=[own,own==='mine'?'opponent':'mine'];
  return `<nav class="battle-fighter-strip" aria-label="Персонажи боя"><div class="battle-fighter-strip-scroll">${sides.map(side=>`<section class="battle-portrait-team" data-side="${side}" data-own="${side===own}" aria-label="${esc(teamLabel(side))}"><h3>${esc(teamLabel(side))}</h3><div class="battle-portrait-row">${m[side].fighters.map(f=>`<button type="button" id="battle-portrait-${esc(f.id)}" class="battle-character-portrait ${selected===f.id?'selected':''}" data-bt="fighter-card" data-id="${esc(f.id)}" aria-pressed="${selected===f.id}" aria-label="${esc(teamLabel(side)+': '+f.name)}" title="${esc(f.name+' · '+f.alterEgo+' · HP '+f.hp+'/'+f.maxHp)}">${avatar(characters.get(f.slug))}<span class="battle-portrait-name">${esc(f.name)}</span>${f.status!=='ready'?`<span class="battle-portrait-status ${esc(f.status)}">${f.status==='ko'?'KO':'D'}</span>`:''}</button>`).join('')||'<span class="battle-small">Нет бойцов</span>'}</div></section>`).join('')}</div></nav>`;
}
function battleFighterStatusMarkup(m,f,state){
  return `<section class="battle-character-state" aria-label="Текущее состояние персонажа"><div class="battle-character-resources"><span class="battle-resource ${f.hp!==f.maxHp?'changed':''}">HP <b>${f.hp}/${f.maxHp}</b></span><span class="battle-resource">${MCPCardRenderer.icon('power')}<b>${f.power}</b></span>${fighterStateControlMarkup(m,f,m.status!=='active')}${fighterFormControlsMarkup(m,f)}${f.acted?'<span class="tag">✓ Походил</span>':''}${m.status==='finished'?'<span class="tag">Бой завершён</span>':''}</div><div class="battle-character-conditions">${f.conditions.map(condition=>{
    const key=condition.toLowerCase(),immune=state.immuneConditions.includes(condition),known=Object.hasOwn(window.MCPCardConditions?.definitions||{},key);
    return known?`<button type="button" class="battle-condition-chip ${immune?'immune':''}" data-card-condition="${esc(key)}" title="${immune?'Иммунитет: эффект не применяется':'Описание состояния'}">${esc(condition)}${immune?' · иммунитет':''}</button>`:`<span class="battle-condition-chip">${esc(condition)}</span>`;
  }).join('')||'<span class="battle-small">Без особых состояний</span>'}</div></section>`;
}
function renderBattleFighterCard(){
  const context=battleDialogContext,dialog=$('#battle-dialog'),root=$('#battle-dialog-content'),m=currentMatch();
  if(context?.type!=='fighter')return;
  if(!m||m.id!==context.matchId){dialog.close();return;}
  let f=BattleCore.allFighters(m).find(f=>f.id===context.id);
  if(!f){
    f=BattleCore.allFighters(m)[0];
    if(!f){dialog.close();return;}
    Object.assign(context,{id:f.id,followActual:true,signature:null});
  }
  if(context.followActual){context.form=f.form;context.side=f.face;}
  const signature=JSON.stringify({fighter:f,view:[context.form,context.side],status:m.status,teams:['mine','opponent'].map(side=>({name:m[side].name,fighters:m[side].fighters.map(f=>[f.id,f.slug,f.name,f.alterEgo,f.hp,f.maxHp,f.power,f.status,f.acted,f.face,f.form])}))});
  if(context.signature===signature&&dialog.open)return;
  context.signature=signature;
  const sameFighter=root.querySelector('.battle-character-view')?.dataset.fighter===f.id;
  const scrollTop=sameFighter?(root.querySelector('.battle-character-scroll')?.scrollTop||0):0;
  const scrollLeft=sameFighter?(root.querySelector('.stat-card-surface')?.scrollLeft||0):0;
  const stripScroll=root.querySelector('.battle-fighter-strip-scroll')?.scrollLeft||0;
  const state=BattleCharacterState.describe(m,f),live=context.form===f.form&&context.side===f.face;
  const side=m.mine.fighters.some(item=>item.id===f.id)?'mine':'opponent';
  const html=`<div class="dialog-heading battle-character-heading"><div><h2>${esc(f.name)}</h2><p>${esc(f.alterEgo)} · ${esc(teamLabel(side))}</p></div><div class="battle-card-header-controls" data-card-view="battle">${statCardControlsMarkup({slug:f.slug,detail:m.references[f.slug],form:context.form,side:context.side})}</div><button class="quiet close" data-bt="close-dialog" aria-label="Закрыть окно партии">×</button></div>${battleFighterStatusMarkup(m,f,state)}<div class="battle-character-scroll"><div class="battle-character-view" data-fighter="${esc(f.id)}">${!live?'<div class="battle-card-preview-note"><span>Просмотр другой стороны или формы</span><button type="button" data-bt="fighter-current">К текущей карте</button></div>':''}${statCardViewerMarkup('battle',f.slug,m.references[f.slug],context.form,context.side,live?state:null,true)}<p class="stat-card-view-note">${live?'Красным — изменённые HP, характеристики и стоимость. Наведи на значение, чтобы увидеть причину.':'Здесь показаны печатные значения выбранной карты.'} Переворот для просмотра не меняет бойца.</p><div class="source-line"><a href="${esc(characters.get(f.slug).sourceUrl)}" target="_blank" rel="noopener">Карточка на Jarvis ↗</a></div></div></div>${battleFighterPortraits(m,f.id)}`;
  const template=document.createElement('template');template.innerHTML=html;
  dialog.classList.add('battle-character-dialog');
  patchBattleDOM(root,template.content);
  if(!dialog.open)dialog.showModal();
  fitNativeCards(root);
  root.querySelector('.battle-character-scroll').scrollTop=scrollTop;
  root.querySelector('.stat-card-surface').scrollLeft=scrollLeft;
  const strip=root.querySelector('.battle-fighter-strip-scroll');strip.scrollLeft=stripScroll;
  if(!sameFighter){
    const button=root.querySelector('.battle-character-portrait.selected'),bounds=button?.getBoundingClientRect(),view=strip.getBoundingClientRect();
    if(bounds&&bounds.left<view.left)strip.scrollLeft+=bounds.left-view.left;
    else if(bounds&&bounds.right>view.right)strip.scrollLeft+=bounds.right-view.right;
  }
}
function showFighterConditions(id){
  const f=currentFighter(id);
  battleDialog('Состояния',f.name+' · отметьте или снимите жетоны.',`<div class="condition-grid">${battleConditions.map(([name,label])=>`<button data-bt="condition" data-id="${esc(id)}" data-condition="${name}" aria-pressed="${f.conditions.includes(name)}" class="${f.conditions.includes(name)?'selected':''}">${f.conditions.includes(name)?'✓':'○'} ${name}<small>${label}</small></button>`).join('')}</div>${fighterImmunitiesMarkup(currentMatch(),f)}<form id="battle-condition-form" data-id="${esc(id)}"><label class="field">Другое состояние<input name="condition" maxlength="40" placeholder="Название жетона"></label><button type="submit">Добавить</button></form><div class="fighter-conditions">${f.conditions.filter(c=>!battleConditions.some(([n])=>n===c)).map(c=>`<button data-bt="condition" data-id="${esc(id)}" data-condition="${esc(c)}">${esc(c)} ×</button>`).join('')}</div><p class="battle-rule-note">В Power Phase Poison, Stun и иммунитеты учитываются автоматически. Остальные эффекты здесь отмечаются жетонами.</p><button class="primary" data-bt="close-dialog">Готово</button>`,{type:'conditions',id});
}
function powerPreviewMarkup(match){
  const result=PowerPhase.calculate(match);
  return `<div class="power-preview">${['mine','opponent'].map(side=>{
    const rows=result.rows.filter(row=>row.side===side);if(!rows.length)return '';
    return `<h3>${teamLabel(side)}</h3>${rows.map(row=>{
      const f=BattleCore.allFighters(match).find(f=>f.id===row.id);
      return `<div class="power-preview-row">${avatar(characters.get(f.slug))}<div class="power-preview-copy"><strong>${esc(row.name)}</strong><div class="power-reasons">${row.steps.map(step=>`<span>${esc(step.label)} <b>${step.amount>0?'+':''}${step.amount}</b></span>`).join('')}</div>${row.notes.map(note=>`<small>${esc(note)}</small>`).join('')}</div><span class="power-result" aria-label="Энергия ${esc(row.name)}">${row.before} → <b>${row.after}</b></span></div>`;
    }).join('')}`;
  }).join('')}</div>`;
}
function showRoundPreview(){
  const m=currentMatch(),plan=BattleCore.roundPlan(m),remaining=BattleCore.allFighters(m).filter(f=>f.status==='ready'&&!f.acted);
  const preview=BattleCore.clone(m);BattleCore.nextRound(preview);
  battleDialog(`Начать раунд ${m.round+1}?`,'Проверьте Cleanup и начисленные VP перед переходом.',`${remaining.length?`<div class="notice">Ещё могут активироваться: ${remaining.map(f=>esc(f.name)).join(', ')}.</div>`:''}<ul class="round-plan"><li>Снять отметки «Походил» у всех бойцов.</li>${plan.map(p=>`<li>${esc(p.name)}: ${p.action==='injured'?`Injured, HP ${p.hp}, убрать состояния`:'KO · нет доступной стороны Injured'}.</li>`).join('')}<li>Остальные HP, условия, цели и тактики сохранить.</li></ul><label class="field">Приоритет следующего раунда<select id="round-priority">${priorityOptions(m.priority)}</select></label><label class="check"><input id="round-power" type="checkbox" checked>Рассчитать Power Phase нового раунда</label><div id="round-power-preview">${powerPreviewMarkup(preview)}</div><p class="battle-rule-note">Фиксированные бонусы, Poison, Stun и иммунитеты учтены в расчёте. Не фиксированные эффекты не изменяются. Приоритет выбираете вы.</p><div class="actions"><button data-bt="close-dialog">Вернуться в бой</button><button class="primary" data-bt="confirm-round" data-round="${m.round}">Начать раунд ${m.round+1}</button></div>`);
}
function showFighterObjectives(id){const f=currentFighter(id);battleDialog('Цели у бойца',f.name,`<p class="battle-rule-note">Число жетонов, которые несёт персонаж. VP начисляются отдельно.</p>${miniCounter(f.objectives,'цели '+f.name,'objective-counter',`data-id="${esc(f.id)}"`,f.objectives===0,f.objectives===20)}<button class="primary" data-bt="close-dialog">Готово</button>`,{type:'objectives',id});}
function showBattleLog(){const m=currentMatch();battleDialog('Журнал партии','Последние 200 событий. ↶ отменяет последние 30 действий.',`<div class="battle-log">${m.log.slice().reverse().map(e=>`<p><small>Раунд ${e.round} · ${new Date(e.at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</small><span>${esc(e.text)}</span></p>`).join('')||'<p>Пока нет событий.</p>'}</div>`,{type:'log'});}
function showPowerPhase(){
  const m=currentMatch(),already=m.powerPhaseRound===m.round||m.basePowerRound===m.round;
  battleDialog('Power Phase · раунд '+m.round,'Энергия рассчитывается отдельно для каждого бойца.',`${already?'<div class="notice">В этом раунде энергия уже начислялась. Повторное применение начислит её ещё раз.</div>':''}${powerPreviewMarkup(m)}<p class="battle-rule-note">Учтены фиксированные бонусы текущей стороны карты, действующее фиксированное лидерство, Poison, Stun и иммунитеты. Не фиксированные эффекты не изменяются.</p>${already?'<label class="check"><input id="power-repeat" type="checkbox">Применить повторно в этом раунде</label>':''}<div class="actions"><button data-bt="close-dialog">Отмена</button><button class="primary" data-bt="confirm-power" data-round="${m.round}" ${already?'disabled':''}>Применить расчёт</button></div>`);
}
function confirmRemoveFighter(f,side){
  if(!f)return;
  if($('#battle-picker-dialog').open){battlePicker=null;$('#battle-picker-dialog').close();}
  battleDialog('Убрать бойца из партии?',f.name+' · его текущие HP, энергия и состояния исчезнут из состава.',`<div class="actions"><button data-bt="close-dialog">Отмена</button><button class="primary" data-bt="confirm-remove" data-id="${esc(f.id)}" data-side="${side}">Убрать бойца</button></div>`);
}
function showBattleMissions(){
  const m=currentMatch(),readonly=m.status==='finished';battleDialog('Миссии и карты','Карты и бойцы относятся только к этой партии.',`${missionMarkup(m,!readonly)}<h3>${teamLabel('mine')}: тактики</h3>${tacticsList(m.mine,'mine',true,readonly,'missions')}<h3>${teamLabel('opponent')}: тактики</h3>${tacticsList(m.opponent,'opponent',true,readonly,'missions')}${!readonly?'<button data-bt="pick" data-side="opponent" data-kind="tactics">Изменить карты противника +</button>':''}`,{type:'missions'});
}
function refreshBattleDialog(){if(battleDialogContext?.type==='fighter')renderBattleFighterCard();else if(battleDialogContext?.type==='conditions')showFighterConditions(battleDialogContext.id);else if(battleDialogContext?.type==='missions')showBattleMissions();else if(battleDialogContext?.type==='objectives')showFighterObjectives(battleDialogContext.id);else if(battleDialogContext?.type==='log')showBattleLog();}
function retainBattlePicker(el){const pos=el.selectionStart;renderBattlePicker();const input=$('#battle-picker-search');input.focus();if(pos!=null)input.setSelectionRange(pos,pos);}

document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-bt]');if(!button||button.disabled||!initialized)return;
  const d=button.dataset,a=d.bt,m=currentMatch();
  if(a==='prepare'){for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();prepareMatch(d.roster);}
  else if(a==='prepare-editor'){const id=rosterDraft?.id;if(id&&saveRoster())prepareMatch(id);}
  else if(a==='choose-roster')chooseBattleRoster();
  else if(a==='make-roster'){$('#battle-dialog').close();openRosterEditor();}
  else if(a==='home'){battleView='home';battleMatchId=null;showBattleScreen();window.NetworkBattle?.list().catch(e=>toast(e.message));}
  else if(a==='open')openMatch(d.id);
  else if(a==='close-dialog'){$('#battle-dialog').close();battleDialogContext=null;}
  else if(a==='close-picker'){$('#battle-picker-dialog').close();battlePicker=null;refreshBattleDialog();}
  else if(a==='pick')openBattlePicker(d.side,d.kind);
  else if(a==='map')openBattleMap();
  else if(a==='missions'){if(d.kind)openBattlePicker('opponent','crises',d.kind);else showBattleMissions();}
  else if(a==='clear-mission'){editMatch('Убрана миссия '+d.kind,next=>next[d.kind]=null);refreshBattleDialog();}
  else if(a==='picker-tab'){battlePicker.kind=d.kind;battlePicker.query='';battlePicker.affiliation='';battlePicker.owned=false;renderBattlePicker();}
  else if(a==='picker-card'){if(battlePicker.kind==='characters')openCharacter(d.slug);else showSnapshotCard(rosterCard(battlePicker.kind,d.slug),battlePicker.kind);}
  else if(a==='fighter-card')showFighterCard(d.id);
  else if(a==='fighter-current'&&battleDialogContext?.type==='fighter'){battleDialogContext.followActual=true;battleDialogContext.signature=null;renderBattleFighterCard();}
  else if(a==='mission-card')showSnapshotCard(m[d.kind],'crises');
  else if(a==='flip-tactic'){
    const tactic=m[d.side]?.tactics.find(t=>t.slug===d.slug);if(!tactic)return;
    const played=!tactic.played;
    editMatch(`${tactic.name}: ${played?'сыграна':'возвращена в руку'}`,next=>{
      const target=next[d.side].tactics.find(t=>t.slug===d.slug);
      if(!target)throw new Error('Карта уже убрана из партии.');
      target.played=played;
    });
    if(battleDialogContext?.type==='missions')refreshBattleDialog();
  }
  else if(a==='tactic-card'){const tactic=m[d.side].tactics.find(t=>t.slug===d.slug);showSnapshotCard(tactic?.card||rosterCard('tactics',canonicalCard('tactics',d.slug)),'tactics');}
  else if(a==='remove-fighter'){const f=currentFighter(d.id);if(m.status==='active')confirmRemoveFighter(f,d.side);else editMatch('Убран '+f.name,next=>{next[d.side].fighters=next[d.side].fighters.filter(f=>f.id!==d.id);if(next[d.side].leader===d.id)next[d.side].leader=null;});}
  else if(a==='confirm-remove'){if(editMatch('Убран боец '+currentFighter(d.id).name,next=>{next[d.side].fighters=next[d.side].fighters.filter(f=>f.id!==d.id);if(next[d.side].leader===d.id)next[d.side].leader=null;})){$('#battle-dialog').close();battleDialogContext=null;if(battlePicker)renderBattlePicker();}}
  else if(a==='remove-tactic')editMatch('Убрана тактика',next=>next[d.side].tactics=next[d.side].tactics.filter(t=>t.slug!==d.slug));
  else if(a==='start'){
    const errors=BattleCore.errors(m);if(errors.length){toast(errors[0]);return;}
    editMatch('Бой начат',next=>{next.status='active';next.startedAt=matchNow();next.log=[{at:matchNow(),round:1,text:'Бой начат'}];next.undo=[];});battleView='play';renderBattle();window.scrollTo(0,0);
  }
  else if(a==='team'){battleTeam=d.side;renderBattle();}
  else if(a==='counter'){const f=currentFighter(d.id);editMatch(`${f.name}: ${d.field==='hp'?'HP':'энергия'} ${Number(d.delta)>0?'+1':'−1'}`,next=>BattleCore.counter(BattleCore.allFighters(next).find(f=>f.id===d.id),d.field,Number(d.delta)));}
  else if(a==='score')editMatch(`${teamLabel(d.side)}: VP ${Number(d.delta)>0?'+1':'−1'}`,next=>next.score[d.side]=Math.max(0,next.score[d.side]+Number(d.delta)));
  else if(a==='activate'){const f=currentFighter(d.id);if(f.status==='ready')editMatch(`${f.name}: ${f.acted?'снята активация':'походил'}`,next=>{const f=BattleCore.allFighters(next).find(f=>f.id===d.id);f.acted=!f.acted;});}
  else if(a==='cycle-status'||a==='status')cycleFighterStatus(d.id);
  else if(a==='conditions')showFighterConditions(d.id);
  else if(a==='condition'){const f=currentFighter(d.id);editMatch(`${f.name}: ${f.conditions.includes(d.condition)?'снято':'добавлено'} ${d.condition}`,next=>{const f=BattleCore.allFighters(next).find(f=>f.id===d.id);f.conditions=f.conditions.includes(d.condition)?f.conditions.filter(c=>c!==d.condition):[...f.conditions,d.condition];});refreshBattleDialog();}
  else if(a==='objectives')showFighterObjectives(d.id);
  else if(a==='objective-counter'){const f=currentFighter(d.id);editMatch(`${f.name}: цели ${d.delta}`,next=>BattleCore.counter(BattleCore.allFighters(next).find(f=>f.id===d.id),'objectives',Number(d.delta)));button.closest('.battle-counter').querySelector('strong').textContent=currentFighter(d.id).objectives;const buttons=button.closest('.battle-counter').querySelectorAll('button');buttons[0].disabled=currentFighter(d.id).objectives===0;buttons[1].disabled=currentFighter(d.id).objectives===20;}
  else if(a==='round')showRoundPreview();
  else if(a==='confirm-round'){const power=$('#round-power').checked,priority=$('#round-priority').value;if(window.NetworkBattle?.active()){NetworkBattle.round(Number(d.round),priority,power);$('#battle-dialog').close();return;}if(editMatch(`Начат раунд ${m.round+1}`,next=>{BattleCore.nextRound(next);next.priority=priority;if(power)PowerPhase.apply(next);}))$('#battle-dialog').close();}
  else if(a==='power')showPowerPhase();
  else if(a==='confirm-power'){if(window.NetworkBattle?.active()){NetworkBattle.power(Number(d.round),!!$('#power-repeat')?.checked);$('#battle-dialog').close();return;}if(editMatch('Power Phase: фиксированные начисления по картам и состояниям',next=>PowerPhase.apply(next)))$('#battle-dialog').close();}
  else if(a==='undo'){if(window.NetworkBattle?.active()){NetworkBattle.undo();return;}if(writeMatch(BattleCore.undo(m,matchNow()))){renderBattle();toast('Последнее изменение отменено');}}
  else if(a==='log')showBattleLog();
  else if(a==='finish')battleDialog('Завершить партию?',`${m.name} · ${m.score.mine} : ${m.score.opponent} · раунд ${m.round}`,`<p class="battle-rule-note">Партия останется в истории вместе с бойцами, картами и журналом.</p><p id="battle-finish-error" role="alert"></p><div class="actions"><button data-bt="close-dialog">Продолжить бой</button><button class="primary" data-bt="confirm-finish">Завершить и сохранить</button></div>`);
  else if(a==='confirm-finish'){
    if(window.NetworkBattle?.active()){
      const controls=[...$('#battle-dialog').querySelectorAll('button')];controls.forEach(b=>b.disabled=true);
      try{await NetworkBattle.finish();if(battleMatchId===m.id){$('#battle-dialog').close();battleView='home';battleMatchId=null;renderBattle();}toast('Партия сохранена в истории');}
      catch(error){controls.forEach(b=>b.disabled=false);const message=$('#battle-finish-error');if(message)message.textContent=error.message;}
      return;
    }
    if(editMatch('Партия завершена',next=>{next.status='finished';next.finishedAt=matchNow();})){$('#battle-dialog').close();battleView='home';battleMatchId=null;renderBattle();toast('Партия сохранена в истории');}}
});
document.addEventListener('input',event=>{
  const el=event.target,m=currentMatch();
  if(el.id==='battle-picker-search'){battlePicker.query=el.value;retainBattlePicker(el);}
  else if(el.id==='battle-threat'&&m?.status==='preparing'){
    const value=Number(el.value);
    if(Number.isInteger(value)&&value>=1&&value<=99){editMatch('Лимит Threat изменён',next=>next.threat=value);$('#battle-threat').focus();}
  }
  else if(m&&m.status==='preparing'&&['battle-name','battle-opponent-name'].includes(el.id)){
    const value=el.value;if(window.NetworkBattle?.active())return;
    const next=BattleCore.clone(m);if(el.id==='battle-name')next.name=value;else next.opponent.name=value;next.updatedAt=matchNow();writeMatch(next);
  }
});
document.addEventListener('change',async event=>{
  const el=event.target,m=currentMatch();
  if(el.id==='battle-name'&&m?.status==='preparing'&&window.NetworkBattle?.active()){const value=el.value;editMatch('Название партии изменено',next=>next.name=value);}
  else if(el.id==='power-repeat')$('[data-bt="confirm-power"]').disabled=!el.checked;
  else if(el.id==='round-power')$('#round-power-preview').hidden=!el.checked;
  else if(el.dataset.battlePick)await pickForBattle(el.dataset.battlePick,el.checked);
  else if(el.id==='battle-threat'){const value=Number(el.value);if(!Number.isInteger(value)||value<1||value>99){toast('Threat должен быть целым числом от 1 до 99.');renderBattle();}else editMatch('Лимит Threat изменён',next=>next.threat=value);}
  else if(el.dataset.battleFighterForm||el.dataset.battleFighterFace){
    const id=el.dataset.battleFighterForm||el.dataset.battleFighterFace,f=currentFighter(id);if(!f)return;
    const form=el.dataset.battleFighterForm?Number(el.value):null,selectedFace=el.dataset.battleFighterFace?el.value:null;
    if(form!==null&&![0,1].includes(form)||selectedFace&&!['front','back'].includes(selectedFace))return;
    editMatch(f.name+': изменена форма или сторона',next=>{
      const fighter=BattleCore.allFighters(next).find(item=>item.id===id),detail=next.references[fighter.slug],actualForm=form??fighter.form,card=actualForm===1?detail.secondStatCard:detail.statCard;
      const which=selectedFace||(Number(card?.[fighter.face+'Side']?.stamina)>0?fighter.face:'front');
      BattleCore.changeFace(next,fighter,which,actualForm);if(fighter.status!=='ready')fighter.hp=0;
    });
  }
  else if(el.id==='battle-priority')editMatch('Приоритет: '+(el.value==='mine'?'у меня':el.value==='opponent'?'у противника':'не указан'),next=>next.priority=el.value);
  else if(el.dataset.battleAff)editMatch('Аффилиация отряда изменена',next=>{next[el.dataset.battleAff].affiliation=el.value;next[el.dataset.battleAff].leader=null;});
  else if(el.dataset.battleLeader)editMatch('Лидер выбран',next=>next[el.dataset.battleLeader].leader=el.value||null);
  else if(el.dataset.battlePlayed){const t=m[el.dataset.side].tactics.find(t=>t.slug===el.dataset.battlePlayed);editMatch(`${t.name}: ${el.checked?'сыграна':'возвращена в руку'}`,next=>next[el.dataset.side].tactics.find(t=>t.slug===el.dataset.battlePlayed).played=el.checked);refreshBattleDialog();}
  else if(el.id==='battle-picker-aff'){battlePicker.affiliation=el.value;renderBattlePicker();}
  else if(el.id==='battle-picker-owned'){battlePicker.owned=el.checked;renderBattlePicker();}
  else if(el.id==='battle-picker-available'){battlePicker.available=el.checked;renderBattlePicker();}
});
document.addEventListener('submit',event=>{
  if(event.target.id!=='battle-condition-form')return;event.preventDefault();const id=event.target.dataset.id,name=String(new FormData(event.target).get('condition')||'').trim();if(!name)return;
  editMatch(currentFighter(id).name+': '+name,next=>{const f=BattleCore.allFighters(next).find(f=>f.id===id);if(!f.conditions.includes(name))f.conditions.push(name);});showFighterConditions(id);
});
$('#battle-picker-dialog').addEventListener('close',()=>{battlePicker=null;refreshBattleDialog();});
$('#battle-dialog').addEventListener('close',()=>{battleDialogContext=null;$('#battle-dialog').classList.remove('battle-character-dialog');statCardViews.delete('battle');});
window.addEventListener('storage',event=>{
  if(event.key!==battleStorageKey||!event.newValue)return;
  try{battleStore=validateBattleData(JSON.parse(event.newValue));battleReadError=false;renderBattle();if(screen==='battle'){if(battleDialogContext?.type==='fighter'&&$('#battle-dialog').open)renderBattleFighterCard();else if($('#battle-dialog').open)$('#battle-dialog').close();if($('#battle-picker-dialog').open)$('#battle-picker-dialog').close();toast('Партия обновлена в другой вкладке');}}
  catch{toast('Из другой вкладки пришли некорректные данные партии.');}
});
boot();
