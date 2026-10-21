'use strict';

let rosterCards={tactics:[],crises:[]},rosterCardIndex=new Map(),rosterCardsError='';
let rosterDraft=null,rosterBase='',rosterConflict=false,rosterWasSaved=false,editorTab='characters';
let rosterFilters={query:'',affiliation:'',group:'',owned:false};
let rosterPicker=null,leaveAction=null;

function normalizeRosterRecord(r) {
  return {...r,affiliation:r.affiliation||'',characters:[...r.characters],tactics:[...(r.tactics||[])],crises:[...(r.crises||[])],groups:[...(r.groups||[])]};
}
function validateRosterPayload(value) {
  if(value.groups!==undefined&&!Array.isArray(value.groups))throw new Error('Не удалось прочитать группы.');
  const groupIds=new Set();
  for(const g of value.groups||[]){if(typeof g.id!=='string'||groupIds.has(g.id)||typeof g.name!=='string')throw new Error('Некорректная группа ростеров.');groupIds.add(g.id);}
  for(const r of value.rosters){
    for(const field of ['tactics','crises','groups'])if(r[field]!==undefined&&(!Array.isArray(r[field])||r[field].some(id=>typeof id!=='string')))throw new Error('Некорректный состав ростера.');
    if((r.groups||[]).some(id=>!groupIds.has(id)))throw new Error('В ростере указана неизвестная группа.');
  }
}
function chooseLatestCards(rows) {
  const families=new Map();
  const rank=c=>Number(!c.updatedBy&&!c.replacedBy)*8+Number(!c.variantOf)*4+Number(c.setSymbol===c.latestSetSymbol);
  for(const c of rows){if(c.isInfinityGem)continue;const family=c.cardFamily||c.name,old=families.get(family);if(!old||rank(c)>rank(old))families.set(family,c);}
  return [...families.values()].sort((a,b)=>a.name.localeCompare(b.name,'en'));
}
async function initRosterData() {
  try{
    const response=await fetch('data/roster-cards.json');if(!response.ok)throw new Error('Не удалось загрузить тактики и кризисы.');
    const data=await response.json();
    for(const kind of ['tactics','crises']){
      rosterCards[kind]=chooseLatestCards(data[kind]);
      const latest=new Map(rosterCards[kind].map(c=>[c.cardFamily||c.name,c]));
      for(const c of data[kind])rosterCardIndex.set(kind+':'+c.slug,latest.get(c.cardFamily||c.name)||c);
    }
  }catch(error){rosterCardsError=error.message;}
}
function rosterCard(kind,slug){return rosterCardIndex.get(kind+':'+slug);}
function canonicalCard(kind,slug){return rosterCard(kind,slug)?.slug||slug;}
function affOptions(selected='',empty='Без основной аффилиации') {
  const names=[...new Set(catalog.characters.flatMap(c=>c.affiliations.map(a=>a.name)))].sort();
  return `<option value="">${esc(empty)}</option>`+names.map(name=>`<option value="${esc(name)}" ${selected===name?'selected':''}>${esc(name)}</option>`).join('');
}

function updateNavigation(){if(screen!=='tournaments')history.replaceState(null,'','#screen='+(screen==='catalog'&&$('#only-owned').checked?'mine':screen));document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('selected',button.dataset.action===(screen==='tournaments'?'tournaments':screen==='battle'?'battle':screen==='rosters'?'rosters':screen==='purchases'?'purchases':$('#only-owned').checked?'mine':'all')));}
function showCatalog(only=false){screen='catalog';$('#purchases-screen').hidden=true;$('#tournaments-screen').hidden=true;$('#battle-screen').hidden=true;$('#catalog-screen').hidden=false;$('#rosters-screen').hidden=true;rosterDraft=null;resetFilters(only);updateNavigation();window.scrollTo(0,0);}
function navigateCatalog(only=false){requestLeave(()=>showCatalog(only));}
function showRosterList(){screen='rosters';$('#purchases-screen').hidden=true;$('#tournaments-screen').hidden=true;$('#battle-screen').hidden=true;rosterDraft=null;$('#catalog-screen').hidden=true;$('#rosters-screen').hidden=false;renderRosterList();updateNavigation();window.scrollTo(0,0);}
function navigateRosters(){requestLeave(showRosterList);}
function isRosterDirty(){return rosterDraft&&JSON.stringify(rosterDraft)!==rosterBase;}
function requestLeave(next){
  if(!isRosterDirty()){next();return;}
  leaveAction=next;
  rosterAction('Есть несохранённые изменения','Сохраните ростер или выйдите без сохранения.',`<div class="actions"><button class="primary" data-rs="save-leave">Сохранить и выйти</button><button data-rs="discard-leave">Выйти без сохранения</button><button class="quiet" data-rs="close-action">Продолжить редактирование</button></div>`);
}
function rosterMissing(r){return [...new Set(r.characters)].filter(slug=>!isOwned(slug)).length;}
function crisisCount(r,type){return r.crises.filter(slug=>rosterCard('crises',slug)?.type===type).length;}
function counted(n,one,few,many){const last=n%10,tail=n%100;return `${n} ${tail>=11&&tail<=14?many:last===1?one:last>=2&&last<=4?few:many}`;}
function rosterCounts(r){return `${counted(r.characters.length,'персонаж','персонажа','персонажей')} · ${counted(r.tactics.length,'тактика','тактики','тактик')} · Secure ${crisisCount(r,'Secure')} / Extract ${crisisCount(r,'Extraction')}`;}
function rosterStatus(r){return r.characters.length===10&&r.tactics.length===10&&crisisCount(r,'Secure')===5&&crisisCount(r,'Extraction')===5?'Укомплектован':'Черновик';}

function rosterAffiliationNames(){return [...new Set(catalog.characters.flatMap(c=>c.affiliations.map(a=>a.name)))].sort();}
function renderRosterList(){
  const rows=state.rosters.filter(r=>{
    const words=searchWords(r.name);
    return searchWords(rosterFilters.query).every(q=>words.some(w=>w.startsWith(q)))&&(!rosterFilters.affiliation||r.affiliation===rosterFilters.affiliation)&&(!rosterFilters.group||(rosterFilters.group==='__none'?!r.groups.length:r.groups.includes(rosterFilters.group)))&&(!rosterFilters.owned||(r.characters.length>0&&!rosterMissing(r)));
  }).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))||a.name.localeCompare(b.name));
  MCPReact.view($('#rosters-screen'),'RosterList',{items:rows.map(r=>({roster:structuredClone(r),status:rosterStatus(r),subtitle:rosterCounts(r),missing:rosterMissing(r),portraits:r.characters.slice(0,6).map(slug=>characters.get(slug)),groups:r.groups.map(id=>state.groups.find(g=>g.id===id)||{id,name:'Группа'})})),filters:{...rosterFilters},affiliations:rosterAffiliationNames(),groups:state.groups.map(g=>({...g})),total:state.rosters.length});
}
function openRosterEditor(id){
  if(!initialized)return;
  requestLeave(()=>{
    for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
    const r=id?state.rosters.find(r=>r.id===id):null;
    if(id&&!r){toast('Ростер больше не существует.');return;}
    rosterDraft=r?normalizeRosterRecord(r):normalizeRosterRecord({id:crypto.randomUUID(),name:'',affiliation:'',characters:[]});
    rosterBase=JSON.stringify(rosterDraft);rosterWasSaved=!!r;rosterConflict=false;editorTab='characters';
    screen='rosters';$('#purchases-screen').hidden=true;$('#tournaments-screen').hidden=true;$('#battle-screen').hidden=true;$('#catalog-screen').hidden=true;$('#rosters-screen').hidden=false;renderRosterEditor();updateNavigation();window.scrollTo(0,0);
  });
}
function rosterNotes(r){
  const notes=[];
  if(r.tournamentSource){const s=r.tournamentSource;if(s.incomplete)notes.push("Оригинальный список распознан не полностью. Сверьте состав с источником.");if(s.unresolved?.length)notes.push("Не удалось перенести: "+s.unresolved.join("; ")+".");if(s.gems?.length)notes.push("Камни из оригинала: "+s.gems.map(c=>c.name+": "+c.gems.join(", ")).join("; ")+". Сохранены в данных источника.");}
  if(r.characters.length>10||r.tactics.length>10||crisisCount(r,'Secure')>5||crisisCount(r,'Extraction')>5)notes.push('В составе больше позиций, чем в обычном ростере.');
  const restricted=r.tactics.map(s=>rosterCard('tactics',s)).filter(c=>c?.standardTimelineStatus==='restricted');
  if(restricted.length)notes.push('Restricted тактики: '+restricted.map(c=>c.name).join(', ')+'. Проверьте ограничения выбранного формата.');
  for(const kind of ['tactics','crises']){
    const bad=r[kind].map(s=>rosterCard(kind,s)).filter(c=>c&&!['legal','restricted'].includes(c.standardTimelineStatus));
    if(bad.length)notes.push(`${kind==='tactics'?'Тактики':'Кризисы'} вне Standard: ${bad.map(c=>c.name).join(', ')}.`);
  }
  return notes;
}

function cardStatus(c){return ({legal:'Standard: доступна',restricted:'Standard: Restricted',banned:'Standard: запрещена',rotated:'Вне Standard'})[c?.standardTimelineStatus]||'Статус не указан';}
function renderRosterEditor(){
  if(!rosterDraft)return;const r=rosterDraft,notes=rosterNotes(r);
  MCPReact.view($('#rosters-screen'),'RosterEditor',{roster:structuredClone(r),saved:state.rosters.some(s=>s.id===r.id),conflict:rosterConflict,groups:state.groups.map(g=>({...g})),affiliations:rosterAffiliationNames(),tab:editorTab,items:r[editorTab].map(slug=>editorTab==='characters'?{slug,character:characters.get(slug),status:characterCollectionStatus(slug),affiliated:characters.get(slug).affiliations.some(a=>a.name===r.affiliation)}:{slug,card:rosterCard(editorTab,slug),status:cardStatus(rosterCard(editorTab,slug))}),notes,secure:crisisCount(r,'Secure'),extract:crisisCount(r,'Extraction')});
}
function saveRoster(force=false){
  const r=rosterDraft;if(!r)return false;
  if(!r.name.trim()){$('#editor-error').textContent='Дайте ростеру название.';$('#editor-name').focus();return false;}
  if(rosterConflict&&!force){rosterAction('Ростер изменён в другой вкладке','Можно открыть актуальную версию или сохранить ваши правки поверх неё.',`<div class="actions"><button data-rs="reload-editor">Открыть актуальный</button><button class="primary" data-rs="force-save">Сохранить мои правки</button><button class="quiet" data-rs="close-action">Отмена</button></div>`);return false;}
  const saved=normalizeRosterRecord({...r,name:r.name.trim(),updatedAt:new Date().toISOString()});
  const previous=state.rosters,index=state.rosters.findIndex(s=>s.id===r.id);
  state.rosters=[...previous];if(index<0)state.rosters.unshift(saved);else state.rosters[index]=saved;
  if(!persist()){state.rosters=previous;return false;}
  rosterDraft=null;rosterConflict=false;toast('Ростер сохранён');return true;
}
function refreshRosters(external=false){
  if(screen!=='rosters')return;
  if(rosterDraft){
    if(external){const saved=state.rosters.find(r=>r.id===rosterDraft.id);if((saved&&JSON.stringify(normalizeRosterRecord(saved))!==rosterBase)||(!saved&&rosterWasSaved))rosterConflict=true;}
    renderRosterEditor();
  }else renderRosterList();
}
function resetRosterWorkspace(){rosterDraft=null;rosterConflict=false;rosterFilters={query:'',affiliation:'',group:'',owned:false};}
function syncRosterMembership(id,slug,include){
  if(rosterDraft?.id!==id)return;
  rosterDraft.characters=include?[...new Set([...rosterDraft.characters,slug])]:rosterDraft.characters.filter(s=>s!==slug);
  const saved=state.rosters.find(r=>r.id===id);rosterDraft.updatedAt=saved.updatedAt;rosterBase=JSON.stringify(normalizeRosterRecord(saved));
}
function rosterAction(title,description,body){MCPReact.html($('#roster-action-content'),`<div class="dialog-heading"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div><button class="quiet close" data-rs="close-action" aria-label="Закрыть окно">×</button></div>${body}`);if(!$('#roster-action-dialog').open)$('#roster-action-dialog').showModal();}
function showGroups(){
  rosterAction('Группы ростеров','Один ростер может быть в нескольких группах.',`${state.groups.length?state.groups.map(g=>`<div class="group-row"><span><strong>${esc(g.name)}</strong><small>${counted(state.rosters.filter(r=>r.groups.includes(g.id)).length,'ростер','ростера','ростеров')}</small></span><div class="actions"><button data-rs="rename-group" data-id="${esc(g.id)}">Название</button><button class="quiet" data-rs="delete-group" data-id="${esc(g.id)}" aria-label="Удалить группу ${esc(g.name)}">×</button></div></div>`).join(''):'<p class="muted">Групп ещё нет.</p>'}<div class="actions" style="margin-top:20px"><button class="primary" data-rs="new-group">+ Новая группа</button></div>`);
}
function groupForm(id){const g=state.groups.find(g=>g.id===id);rosterAction(g?'Переименовать группу':'Новая группа','Например: турнир, тесты или любимые составы.',`<form id="roster-group-form" data-id="${esc(id||'')}"><label class="field">Название группы<input name="name" maxlength="60" required value="${esc(g?.name||'')}" placeholder="Название группы"></label><div class="actions" style="margin-top:16px"><button class="primary" type="submit">${g?'Сохранить название':'Создать группу'}</button><button type="button" data-rs="close-action">Отмена</button></div></form>`);}
let rosterCardInsights=null;
function cardInsights(){
  if(!rosterCardInsights&&window.RosterCardInsights&&window.ROSTER_ATLAS&&window.AtlasCore&&window.TournamentImport){
    rosterCardInsights=RosterCardInsights.create({archive:ROSTER_ATLAS,catalog:catalog.characters,cardLists:rosterCards,core:AtlasCore,resolveCard:TournamentImport.resolveCard});
  }
  return rosterCardInsights;
}
const cardMetricNumber=(value,digits=1)=>Number(value||0).toLocaleString('ru-RU',{maximumFractionDigits:digits});


function openRosterPicker(kind=editorTab,relatedTo=null){
  rosterPicker={kind,query:'',affiliation:'',owned:false,type:'',available:false,challenger:kind==='crises',sort:kind==='characters'?'name':'popularity',statsAffiliation:'',statsCharacter:relatedTo||'',relatedTo,relatedOnly:!!relatedTo};
  $('#roster-picker-dialog').classList.toggle('card-insights-dialog',kind!=='characters');renderRosterPicker();$('#roster-picker-dialog').showModal();
}
function renderRosterPicker(){
  if(!rosterDraft||!rosterPicker)return;const p=rosterPicker,kind=p.kind,isCard=kind!=='characters',insights=isCard?cardInsights():null;
  const coverage=insights?.statistics(kind,{affiliation:p.statsAffiliation,character:p.statsCharacter});
  let rows=kind==='characters'?catalog.characters.filter(c=>!c.isGrunt):rosterCards[kind];
  rows=rows.filter(c=>searchWords(p.query).every(q=>searchWords(c.name+' '+(c.alterEgo||'')).some(w=>w.startsWith(q)))&&(!p.affiliation||(kind==='characters'?c.affiliations.some(a=>a.name===p.affiliation):c.affiliation?.name===p.affiliation))&&(!p.owned||isOwned(c.slug))&&(!p.type||c.type===p.type)&&(!p.available||['legal','restricted'].includes(c.standardTimelineStatus))&&(!p.challenger||c.challengerStatus==='legal')&&(!p.relatedOnly||RosterCardInsights.related(c,characters.get(p.relatedTo))));
  if(isCard)rows=rows.slice().sort((a,b)=>{
    const av=coverage?.cards.get(a.slug),bv=coverage?.cards.get(b.slug);
    const metric=p.sort==='points'?'points':p.sort==='average'?'average':'share';
    return (p.sort==='name'?0:(bv?.[metric]||0)-(av?.[metric]||0))||a.name.localeCompare(b.name,'en')||a.slug.localeCompare(b.slug);
  });

  const title=p.relatedOnly?`Карты персонажа · ${characters.get(p.relatedTo)?.name||''}`:kind==='characters'?'Добавить персонажей':kind==='tactics'?'Добавить тактики':'Добавить кризисы';
  MCPReact.view($('#roster-picker-content'),'RosterPicker',{picker:{...p},items:rows.map(c=>({card:c,chosen:rosterDraft[kind].some(s=>kind==='characters'?s===c.slug:canonicalCard(kind,s)===c.slug),stats:coverage?.cards.get(c.slug),owners:kind==='tactics'?(insights?.owners(c.slug)||[]):[],status:kind==='characters'?characterCollectionStatus(c.slug):cardStatus(c)})),coverage:coverage?{covered:coverage.covered,total:coverage.total,excluded:coverage.excluded}:null,affiliations:rosterAffiliationNames(),archiveAffiliations:isCard?[...new Set(ROSTER_ATLAS.rosters.flatMap(r=>r.affiliations))].sort((a,b)=>a.localeCompare(b)):[],characters:catalog.characters.filter(c=>!c.isGrunt),relatedName:characters.get(p.relatedTo)?.name,title,selectedCount:rosterDraft[kind].length,error:rosterCardsError});
}
function showGameCard(kind,slug){
  const c=rosterCard(kind,slug);if(!c)return;
  showNativeGameCard(c,kind,`${cardStatus(c)}${c.threatLevel?' · Threat '+c.threatLevel:''}${c.setup?' · карта '+c.setup:''}`);
}
function retainRosterInput(render,el){const id=el.id,start=el.selectionStart;render();const next=document.getElementById(id);next?.focus();if(next&&start!=null)next.setSelectionRange(start,start);}

document.addEventListener('click',event=>{
  const button=event.target.closest('[data-rs]');if(!button)return;const a=button.dataset.rs,d=button.dataset;
  if(a==='new')openRosterEditor();
  else if(a==='edit')openRosterEditor(d.id);
  else if(a==='back')navigateRosters();
  else if(a==='tab'){editorTab=d.tab;renderRosterEditor();}
  else if(a==='pick')openRosterPicker();
  else if(a==='character-cards'&&rosterDraft?.characters.includes(d.slug))openRosterPicker('tactics',d.slug);
  else if(a==='close-picker'){$('#roster-picker-dialog').close();rosterPicker=null;renderRosterEditor();}
  else if(a==='remove-item'){rosterDraft[d.kind]=rosterDraft[d.kind].filter(slug=>slug!==d.slug);renderRosterEditor();}
  else if(a==='save'){if(saveRoster())showRosterList();}
  else if(a==='reset-filters'){rosterFilters={query:'',affiliation:'',group:'',owned:false};renderRosterList();}
  else if(a==='close-action'){$('#roster-action-dialog').close();leaveAction=null;}
  else if(a==='save-leave'){if(saveRoster()){$('#roster-action-dialog').close();leaveAction?.();leaveAction=null;}}
  else if(a==='discard-leave'){rosterDraft=null;$('#roster-action-dialog').close();leaveAction?.();leaveAction=null;}
  else if(a==='force-save'){if(saveRoster(true)){$('#roster-action-dialog').close();const next=leaveAction;leaveAction=null;if(next)next();else showRosterList();}}
  else if(a==='reload-editor'){const id=rosterDraft.id;rosterDraft=null;leaveAction=null;$('#roster-action-dialog').close();openRosterEditor(id);}
  else if(a==='duplicate'){
    const r=state.rosters.find(r=>r.id===d.id);if(!r)return;
    requestLeave(()=>{const copy=normalizeRosterRecord({...r,id:crypto.randomUUID(),name:r.name+' · копия',updatedAt:new Date().toISOString()});state.rosters.unshift(copy);persist();rosterDraft=null;toast('Копия ростера создана');openRosterEditor(copy.id);});
  }
  else if(a==='delete'){
    const r=state.rosters.find(r=>r.id===d.id);if(r)rosterAction('Удалить ростер?',r.name+' будет удалён. Коллекция и остальные ростеры останутся.',`<div class="actions"><button data-rs="close-action">Отмена</button><button class="primary" data-rs="confirm-delete" data-id="${esc(r.id)}">Удалить ростер</button></div>`);
  }
  else if(a==='confirm-delete'){state.rosters=state.rosters.filter(r=>r.id!==d.id);persist();rosterDraft=null;$('#roster-action-dialog').close();showRosterList();toast('Ростер удалён');}
  else if(a==='groups')showGroups();
  else if(a==='new-group')groupForm();
  else if(a==='rename-group')groupForm(d.id);
  else if(a==='delete-group'){const g=state.groups.find(g=>g.id===d.id);if(g)rosterAction('Удалить группу?',g.name+'. Ростеры останутся; у них исчезнет только эта метка.',`<div class="actions"><button data-rs="groups">Отмена</button><button class="primary" data-rs="confirm-delete-group" data-id="${esc(g.id)}">Удалить группу</button></div>`);}
  else if(a==='confirm-delete-group'){state.groups=state.groups.filter(g=>g.id!==d.id);state.rosters.forEach(r=>r.groups=r.groups.filter(id=>id!==d.id));if(rosterDraft)rosterDraft.groups=rosterDraft.groups.filter(id=>id!==d.id);if(rosterFilters.group===d.id)rosterFilters.group='';persist();refreshRosters();showGroups();}
  else if(a==='card')showGameCard(d.kind,d.slug);
  else if(a==='close-card')$('#game-card-dialog').close();
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.id==='roster-search'){rosterFilters.query=el.value;retainRosterInput(renderRosterList,el);}
  else if(el.id==='editor-name'){rosterDraft.name=el.value;$('#editor-error').textContent='';}
  else if(el.id==='roster-picker-search'){rosterPicker.query=el.value;retainRosterInput(renderRosterPicker,el);}
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='roster-affiliation'){rosterFilters.affiliation=el.value;renderRosterList();}
  else if(el.id==='roster-group'){rosterFilters.group=el.value;renderRosterList();}
  else if(el.id==='roster-owned'){rosterFilters.owned=el.checked;renderRosterList();}
  else if(el.id==='editor-affiliation'){rosterDraft.affiliation=el.value;renderRosterEditor();}
  else if(el.dataset.editorGroup){const id=el.dataset.editorGroup;rosterDraft.groups=el.checked?[...rosterDraft.groups,id]:rosterDraft.groups.filter(g=>g!==id);}
  else if(el.dataset.pickKind){
    const kind=el.dataset.pickKind,slug=el.value;
    rosterDraft[kind]=el.checked?[...new Set([...rosterDraft[kind],slug])]:rosterDraft[kind].filter(s=>kind==='characters'?s!==slug:canonicalCard(kind,s)!==slug);
    const scroll=$('.picker-results').scrollTop;renderRosterPicker();$('.picker-results').scrollTop=scroll;
    document.querySelector(`input[data-pick-kind="${kind}"][value="${CSS.escape(slug)}"]`)?.focus({preventScroll:true});
  }
  else if(el.id==='roster-picker-affiliation'){rosterPicker.affiliation=el.value;renderRosterPicker();}
  else if(el.id==='roster-picker-owned'){rosterPicker.owned=el.checked;renderRosterPicker();}
  else if(el.id==='roster-picker-type'){rosterPicker.type=el.value;renderRosterPicker();}
  else if(el.id==='roster-picker-challenger'){rosterPicker.challenger=el.checked;renderRosterPicker();}
  else if(el.id==='roster-picker-available'){rosterPicker.available=el.checked;renderRosterPicker();}
  else if(el.id==='roster-picker-character'){rosterPicker.relatedTo=el.value||null;rosterPicker.relatedOnly=!!el.value;renderRosterPicker();}
  else if(el.id==='roster-picker-stats-affiliation'){rosterPicker.statsAffiliation=el.value;renderRosterPicker();}
  else if(el.id==='roster-picker-stats-character'){rosterPicker.statsCharacter=el.value;renderRosterPicker();}
  else if(el.id==='roster-picker-sort'){rosterPicker.sort=el.value;renderRosterPicker();}
  else if(el.id==='roster-picker-related'){rosterPicker.relatedOnly=el.checked;renderRosterPicker();}
});
document.addEventListener('submit',event=>{
  if(event.target.id!=='roster-group-form')return;event.preventDefault();
  const form=event.target,name=new FormData(form).get('name').trim(),id=form.dataset.id;
  if(!name)return;
  if(state.groups.some(g=>g.id!==id&&normalize(g.name)===normalize(name))){toast('Группа с таким названием уже есть.');return;}
  if(id){state.groups.find(g=>g.id===id).name=name;}else{const group={id:crypto.randomUUID(),name};state.groups.push(group);if(rosterDraft)rosterDraft.groups.push(group.id);}
  persist();$('#roster-action-dialog').close();refreshRosters();toast(id?'Группа переименована':'Группа создана');
});
$('#roster-picker-dialog').addEventListener('close',()=>{rosterPicker=null;if(rosterDraft)renderRosterEditor();});
