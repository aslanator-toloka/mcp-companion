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
function groupOptions(selected=''){
  return '<option value="">Все группы</option><option value="__none" '+(selected==='__none'?'selected':'')+'>Без группы</option>'+(state.groups||[]).map(g=>`<option value="${esc(g.id)}" ${selected===g.id?'selected':''}>${esc(g.name)}</option>`).join('');
}
function updateNavigation(){if(screen!=='tournaments')history.replaceState(null,'','#screen='+(screen==='catalog'&&$('#only-owned').checked?'mine':screen));document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('selected',button.dataset.action===(screen==='tournaments'?'tournaments':screen==='battle'?'battle':screen==='rosters'?'rosters':$('#only-owned').checked?'mine':'all')));}
function showCatalog(only=false){screen='catalog';$('#tournaments-screen').hidden=true;$('#battle-screen').hidden=true;$('#catalog-screen').hidden=false;$('#rosters-screen').hidden=true;rosterDraft=null;resetFilters(only);updateNavigation();window.scrollTo(0,0);}
function navigateCatalog(only=false){requestLeave(()=>showCatalog(only));}
function showRosterList(){screen='rosters';$('#tournaments-screen').hidden=true;$('#battle-screen').hidden=true;rosterDraft=null;$('#catalog-screen').hidden=true;$('#rosters-screen').hidden=false;renderRosterList();updateNavigation();window.scrollTo(0,0);}
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
function rosterCardMarkup(r){
  const missing=rosterMissing(r);
  return `<article class="roster-tile"><div class="roster-tile-top"><span class="eyebrow">${esc(r.affiliation||'Без основной аффилиации')}</span><span class="tag">${rosterStatus(r)}</span></div><button class="roster-title" data-rs="edit" data-id="${esc(r.id)}">${esc(r.name)}</button><div class="roster-portraits">${r.characters.slice(0,6).map(slug=>avatar(characters.get(slug))).join('')}${r.characters.length>6?`<span class="portrait-overflow">+${r.characters.length-6}</span>`:''}${!r.characters.length?'<span class="muted">Персонажи ещё не выбраны</span>':''}</div><p class="roster-subtitle">${rosterCounts(r)}</p><div class="roster-tags">${r.groups.map(id=>`<span class="tag">${esc(state.groups.find(g=>g.id===id)?.name||'Группа')}</span>`).join('')}<span class="tag ${missing?'missing-tag':''}">${!r.characters.length?'Пустой состав':missing?`Нет ${counted(missing,'модели','моделей','моделей')}`:'Все модели есть'}</span></div><div class="actions roster-tile-actions"><button class="primary" data-rs="edit" data-id="${esc(r.id)}">Открыть ростер →</button><button data-bt="prepare" data-roster="${esc(r.id)}">Бой →</button><button data-rs="duplicate" data-id="${esc(r.id)}">Копия</button><button class="quiet" data-rs="delete" data-id="${esc(r.id)}" aria-label="Удалить ростер ${esc(r.name)}">×</button></div></article>`;
}
function renderRosterList(){
  const rows=state.rosters.filter(r=>{
    const words=searchWords(r.name);
    return searchWords(rosterFilters.query).every(q=>words.some(w=>w.startsWith(q)))&&(!rosterFilters.affiliation||r.affiliation===rosterFilters.affiliation)&&(!rosterFilters.group||(rosterFilters.group==='__none'?!r.groups.length:r.groups.includes(rosterFilters.group)))&&(!rosterFilters.owned||(r.characters.length>0&&!rosterMissing(r)));
  }).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))||a.name.localeCompare(b.name));
  $('#rosters-screen').innerHTML=`<div class="heading"><div><span class="eyebrow">04 / Ростеры</span><h1>Мои ростеры</h1><p>Сохранённые составы, карты и группы для разных планов игры.</p></div><div class="actions"><button data-rs="groups">Группы</button><button class="primary" data-rs="new">Новый ростер +</button></div></div><div class="catalog-tools"><label class="search-label"><span class="sr-only">Найти ростер</span><input id="roster-search" type="search" value="${esc(rosterFilters.query)}" placeholder="Найти ростер по названию…" autocomplete="off"></label><div class="filter-row roster-filters"><label>Аффилиация<select id="roster-affiliation" aria-label="Аффилиация ростера">${affOptions(rosterFilters.affiliation,'Все аффилиации')}</select></label><label>Группа<select id="roster-group" aria-label="Группа ростера">${groupOptions(rosterFilters.group)}</select></label><label class="check only-owned"><input id="roster-owned" type="checkbox" ${rosterFilters.owned?'checked':''}>Все модели есть</label><button class="quiet" data-rs="reset-filters">Сбросить</button></div></div><div class="list-heading"><span role="status" aria-live="polite">${counted(rows.length,'ростер','ростера','ростеров')}</span><span>Последние изменения сверху</span></div>${rows.length?`<div class="roster-grid">${rows.map(rosterCardMarkup).join('')}</div>`:`<div class="empty roster-empty"><h3>${state.rosters.length?'Ничего не найдено':'Создайте первый ростер'}</h3><p>${state.rosters.length?'Измените запрос или снимите фильтры.':'Выберите персонажей и карты, дайте составу название и сохраните его.'}</p><button class="primary" data-rs="${state.rosters.length?'reset-filters':'new'}">${state.rosters.length?'Сбросить фильтры':'Создать ростер +'}</button></div>`}`;
}
function openRosterEditor(id){
  if(!initialized)return;
  requestLeave(()=>{
    for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
    const r=id?state.rosters.find(r=>r.id===id):null;
    if(id&&!r){toast('Ростер больше не существует.');return;}
    rosterDraft=r?normalizeRosterRecord(r):normalizeRosterRecord({id:crypto.randomUUID(),name:'',affiliation:'',characters:[]});
    rosterBase=JSON.stringify(rosterDraft);rosterWasSaved=!!r;rosterConflict=false;editorTab='characters';
    screen='rosters';$('#tournaments-screen').hidden=true;$('#battle-screen').hidden=true;$('#catalog-screen').hidden=true;$('#rosters-screen').hidden=false;renderRosterEditor();updateNavigation();window.scrollTo(0,0);
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
function selectedItemsMarkup(){
  const items=rosterDraft[editorTab];
  if(!items.length)return `<div class="empty"><h3>${editorTab==='characters'?'Персонажи не выбраны':editorTab==='tactics'?'Тактики не выбраны':'Кризисы не выбраны'}</h3><p>Добавьте позиции из каталога. Неполный ростер тоже можно сохранить.</p><button data-rs="pick" class="primary">+ Добавить</button></div>`;
  return `<div class="selected-items">${items.map(slug=>{
    if(editorTab==='characters'){
      const c=characters.get(slug),aff=c.affiliations.some(a=>a.name===rosterDraft.affiliation);
      return `<div class="selected-row"><button class="selected-character" data-action="character" data-slug="${esc(slug)}">${avatar(c)}<span><strong>${esc(c.name)}</strong><small>${esc(c.alterEgo)}</small><span class="selected-meta">Threat ${c.threatLevel} · ${isOwned(slug)?'Есть у меня':'Нет в коллекции'}${aff?' · Аффилирован':''}</span></span></button><div class="selected-row-actions"><button class="quiet character-card-picker" data-rs="character-cards" data-slug="${esc(slug)}" aria-label="Добавить карты ${esc(c.name)}">Добавить карты</button><button class="quiet" data-rs="remove-item" data-kind="characters" data-slug="${esc(slug)}" aria-label="Убрать ${esc(c.name)} из ростера">Убрать ×</button></div></div>`;
    }
    const c=rosterCard(editorTab,slug),status=cardStatus(c);
    return `<div class="selected-row"><button class="selected-card" data-rs="card" data-kind="${editorTab}" data-slug="${esc(slug)}"><span class="card-symbol">${editorTab==='tactics'?'TT':c?.type==='Secure'?'S':'E'}</span><span><strong>${esc(c?.name||slug)}</strong><small>${editorTab==='crises'?`${c?.type==='Secure'?'Secure':'Extract'} · Threat ${c?.threatLevel??'—'} · карта ${c?.setup||'—'}`:c?.affiliation?.name||'Без аффилиации'} · ${esc(status)}</small></span></button><button class="quiet" data-rs="remove-item" data-kind="${editorTab}" data-slug="${esc(slug)}">Убрать ×</button></div>`;
  }).join('')}</div>`;
}
function cardStatus(c){return ({legal:'Standard: доступна',restricted:'Standard: Restricted',banned:'Standard: запрещена',rotated:'Вне Standard'})[c?.standardTimelineStatus]||'Статус не указан';}
function renderRosterEditor(){
  if(!rosterDraft)return;const r=rosterDraft,notes=rosterNotes(r);
  $('#rosters-screen').innerHTML=`<div class="heading"><div><span class="eyebrow">05 / Редактор ростера</span><h1>${state.rosters.some(s=>s.id===r.id)?'Редактировать ростер':'Новый ростер'}</h1><p>Правки применятся после нажатия «Сохранить ростер».</p></div><button data-rs="back">← К ростерам</button></div>${r.tournamentSource?`<div class="notice"><b>Из турнирного архива</b> · ${esc(r.tournamentSource.player)} · ${esc(r.tournamentSource.record)} · место ${esc(r.tournamentSource.place)} / ${esc(r.tournamentSource.fieldSize)}<br><a href="${esc(r.tournamentSource.url)}" target="_blank" rel="noopener">${esc(r.tournamentSource.event)} ↗</a></div>`:''}${rosterConflict?'<div class="notice">Сохранённый ростер изменился в другой вкладке. Проверьте актуальную версию перед сохранением.</div>':''}<div class="editor-info"><div class="editor-fields"><label class="field">Название ростера<input id="editor-name" value="${esc(r.name)}" maxlength="100" placeholder="Например: Web Warriors · контроль"></label><label class="field">Основная аффилиация<select id="editor-affiliation" aria-label="Основная аффилиация">${affOptions(r.affiliation)}</select></label></div><div id="editor-error" class="editor-error" role="alert"></div><div class="editor-groups"><span class="field-label">Группы</span><div class="group-checks">${state.groups.map(g=>`<label class="check"><input type="checkbox" data-editor-group="${esc(g.id)}" ${r.groups.includes(g.id)?'checked':''}>${esc(g.name)}</label>`).join('')}${!state.groups.length?'<span class="muted">Групп пока нет</span>':''}<button class="quiet" data-rs="new-group">+ Новая группа</button></div></div></div><div class="roster-summary"><span><b>${r.characters.length}</b> / 10 персонажей</span><span><b>${r.tactics.length}</b> / 10 тактик</span><span>Secure <b>${crisisCount(r,'Secure')}</b> / 5</span><span>Extract <b>${crisisCount(r,'Extraction')}</b> / 5</span></div><div class="editor-tabs" role="tablist" aria-label="Состав ростера">${[['characters','Персонажи'],['tactics','Тактики'],['crises','Кризисы']].map(([id,name])=>`<button role="tab" aria-selected="${editorTab===id}" data-rs="tab" data-tab="${id}" class="${editorTab===id?'selected':''}">${name}<span>${r[id].length}</span></button>`).join('')}</div><div class="section-title roster-section-title"><h3>${editorTab==='characters'?'Состав персонажей':editorTab==='tactics'?'Team Tactics':'Secure и Extract'}</h3><button data-rs="pick">+ Добавить</button></div>${selectedItemsMarkup()}${notes.length?`<div class="notice">${notes.map(n=>`<p>${esc(n)}</p>`).join('')}</div>`:''}<p class="roster-footnote">Счётчики — ориентир обычного ростера. Статусы карт взяты из Jarvis; это не полная проверка правил и турнирной легальности.</p><div class="editor-footer"><div class="actions">${state.rosters.some(s=>s.id===r.id)?`<button data-bt="prepare-editor">Начать бой →</button><button class="quiet" data-rs="duplicate" data-id="${esc(r.id)}">Копия</button><button class="quiet" data-rs="delete" data-id="${esc(r.id)}">Удалить</button>`:''}</div><div class="actions"><button data-rs="back">Отмена</button><button class="primary" data-rs="save">Сохранить ростер</button></div></div>`;
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
function rosterAction(title,description,body){$('#roster-action-content').innerHTML=`<div class="dialog-heading"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div><button class="quiet close" data-rs="close-action" aria-label="Закрыть окно">×</button></div>${body}`;if(!$('#roster-action-dialog').open)$('#roster-action-dialog').showModal();}
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
function cardStatsMarkup(stats,coverage){
  if(!stats||!coverage.covered)return '<span class="picker-card-stats muted">Нет полных данных в этом контексте</span>';
  return `<span class="picker-card-stats"><span class="card-pick-rate" title="Доля полностью распознанных списков в выбранном контексте; варианты выступления учтены с весом 1/M"><b>${cardMetricNumber(stats.share)}%</b> популярность</span><span>${counted(stats.count,'ростер','ростера','ростеров')}</span><span title="Сумма баллов выступлений с этой картой">Σ ${cardMetricNumber(stats.points)}</span><span title="Сглаженное среднее баллов; при менее 4 оценённых выступлениях — 0">ср. ${cardMetricNumber(stats.average)}</span></span>`;
}
function cardStatsTools(p,kind,coverage){
  const affiliations=[...new Set(ROSTER_ATLAS.rosters.flatMap(r=>r.affiliations))].sort((a,b)=>a.localeCompare(b));
  const chars=catalog.characters.filter(c=>!c.isGrunt);
  return `<section class="card-insight-tools" aria-label="Контекст популярности и баллов"><strong>Популярность и баллы</strong><div class="card-insight-controls"><label>Аффилиация ростеров<select id="roster-picker-stats-affiliation" aria-label="Аффилиация для статистики карт"><option value="">Все аффилиации</option>${affiliations.map(a=>`<option value="${esc(a)}" ${p.statsAffiliation===a?'selected':''}>${esc(a)}</option>`).join('')}</select></label><label>Персонаж в ростере<select id="roster-picker-stats-character" aria-label="Персонаж для статистики карт"><option value="">Любой персонаж</option>${chars.map(c=>`<option value="${esc(c.slug)}" ${p.statsCharacter===c.slug?'selected':''}>${esc(c.name)} · ${esc(c.alterEgo||'')}</option>`).join('')}</select></label><label>Сортировка<select id="roster-picker-sort" aria-label="Сортировка карт">${[['popularity','По популярности'],['points','По сумме баллов'],['average','По среднему баллу'],['name','По алфавиту']].map(([v,t])=>`<option value="${v}" ${p.sort===v?'selected':''}>${t}</option>`).join('')}</select></label></div>${p.relatedTo?`<label class="check related-card-switch"><input type="checkbox" id="roster-picker-related" ${p.relatedOnly?'checked':''}>Только связанные карты: ${esc(characters.get(p.relatedTo)?.name||'персонажа')}</label>`:''}<p class="card-insight-coverage" role="status">Статистика по ${coverage.covered} из ${coverage.total} списков в контексте${coverage.excluded?` · ${coverage.excluded} без полного разбора`:''}.</p><details class="card-insight-method"><summary>Как считаются показатели</summary><p>Популярность — доля списков с картой. Варианты одного выступления учитываются с весом 1/M; разные печатные версии карты объединены. В знаменатель входят только полностью разобранные списки соответствующего типа карт. Сумма и среднее — по оценённым завершённым выступлениям и прежней турнирной формуле, включая отрицательные результаты; среднее сглажено и равно 0 до 4 оценённых выступлений. Фильтры аффилиации и персонажа применяются вместе.</p></details></section>`;
}
function openRosterPicker(kind=editorTab,relatedTo=null){
  rosterPicker={kind,query:'',affiliation:'',owned:false,type:'',available:false,sort:kind==='characters'?'name':'popularity',statsAffiliation:'',statsCharacter:relatedTo||'',relatedTo,relatedOnly:!!relatedTo};
  $('#roster-picker-dialog').classList.toggle('card-insights-dialog',kind!=='characters');renderRosterPicker();$('#roster-picker-dialog').showModal();
}
function renderRosterPicker(){
  if(!rosterDraft||!rosterPicker)return;const p=rosterPicker,kind=p.kind,isCard=kind!=='characters',insights=isCard?cardInsights():null;
  const coverage=insights?.statistics(kind,{affiliation:p.statsAffiliation,character:p.statsCharacter});
  let rows=kind==='characters'?catalog.characters.filter(c=>!c.isGrunt):rosterCards[kind];
  rows=rows.filter(c=>searchWords(p.query).every(q=>searchWords(c.name+' '+(c.alterEgo||'')).some(w=>w.startsWith(q)))&&(!p.affiliation||(kind==='characters'?c.affiliations.some(a=>a.name===p.affiliation):c.affiliation?.name===p.affiliation))&&(!p.owned||isOwned(c.slug))&&(!p.type||c.type===p.type)&&(!p.available||['legal','restricted'].includes(c.standardTimelineStatus))&&(!p.relatedOnly||RosterCardInsights.related(c,characters.get(p.relatedTo))));
  if(isCard)rows=rows.slice().sort((a,b)=>{
    const av=coverage?.cards.get(a.slug),bv=coverage?.cards.get(b.slug);
    const metric=p.sort==='points'?'points':p.sort==='average'?'average':'share';
    return (p.sort==='name'?0:(bv?.[metric]||0)-(av?.[metric]||0))||a.name.localeCompare(b.name,'en')||a.slug.localeCompare(b.slug);
  });
  const characterFilter=kind==='tactics'?`<select id="roster-picker-character" aria-label="Персонаж карты"><option value="">Персонаж карты: любой</option>${catalog.characters.filter(c=>!c.isGrunt).slice().sort((a,b)=>a.name.localeCompare(b.name,'en')).map(c=>`<option value="${esc(c.slug)}" ${p.relatedOnly&&p.relatedTo===c.slug?'selected':''}>${esc(c.name)}${c.alterEgo?' · '+esc(c.alterEgo):''}</option>`).join('')}</select>`:'';
  const title=p.relatedOnly?`Карты персонажа · ${characters.get(p.relatedTo)?.name||''}`:kind==='characters'?'Добавить персонажей':kind==='tactics'?'Добавить тактики':'Добавить кризисы';
  $('#roster-picker-content').innerHTML=`<div class="dialog-heading"><div><h2>${esc(title)}</h2><p>Отметьте несколько позиций. Они попадут в редактируемый состав.</p></div><button class="quiet close" data-rs="close-picker" aria-label="Закрыть добавление">×</button></div><div class="picker-tools"><input class="picker-search" id="roster-picker-search" type="search" value="${esc(p.query)}" placeholder="Поиск по началу слова…" aria-label="Поиск для добавления"><div class="picker-filters">${kind!=='crises'?`<select id="roster-picker-affiliation" aria-label="${isCard?'Аффилиация карты':'Аффилиация для добавления'}">${affOptions(p.affiliation,isCard?'Любая аффилиация карты':'Все аффилиации')}</select>`:`<select id="roster-picker-type" aria-label="Тип кризиса"><option value="">Secure и Extract</option><option value="Secure" ${p.type==='Secure'?'selected':''}>Secure</option><option value="Extraction" ${p.type==='Extraction'?'selected':''}>Extract</option></select>`}${characterFilter}${kind==='characters'?`<label class="check"><input id="roster-picker-owned" type="checkbox" ${p.owned?'checked':''}>Есть у меня</label>`:`<label class="check"><input id="roster-picker-available" type="checkbox" ${p.available?'checked':''}>Доступные в Standard</label>`}</div>${coverage?cardStatsTools(p,kind,coverage):''}</div><div class="picker-summary"><span>${rows.length} найдено</span><span>В составе: ${rosterDraft[kind].length}</span></div><div class="picker-results">${rosterCardsError&&kind!=='characters'?`<div class="notice">${esc(rosterCardsError)}</div>`:''}${rows.map(c=>{
    const chosen=rosterDraft[kind].some(s=>kind==='characters'?s===c.slug:canonicalCard(kind,s)===c.slug),stats=coverage?.cards.get(c.slug);
    const owners=kind==='tactics'?(insights?.owners(c.slug)||[]):[];
    const metadata=kind==='characters'?`${esc(c.alterEgo)} · Threat ${c.threatLevel} · ${isOwned(c.slug)?'Есть у меня':'Нет в коллекции'}`:kind==='tactics'?`${esc(c.affiliation?.name||'Без аффилиации')} · ${esc(cardStatus(c))}`:`${c.type==='Secure'?'Secure':'Extract'} · Threat ${c.threatLevel} · ${esc(cardStatus(c))}`;
    return `<div class="picker-result ${chosen?'chosen':''}" ${isCard?`data-card-slug="${esc(c.slug)}" data-popularity="${stats?.share||0}" data-points="${stats?.points||0}"`:''}><label class="check picker-check"><input type="checkbox" data-pick-kind="${kind}" value="${esc(c.slug)}" ${chosen?'checked':''}>${kind==='characters'?avatar(c):`<span class="card-symbol">${kind==='tactics'?'TT':c.type==='Secure'?'S':'E'}</span>`}<span><strong>${esc(c.name)}</strong><small>${metadata}</small>${owners.length?`<span class="picker-card-owners">${owners.length===1?'Персонаж':'Персонажи'}: ${owners.map(esc).join(', ')}</span>`:''}${isCard?cardStatsMarkup(stats,coverage||{covered:0}):''}</span></label><button class="quiet" ${kind==='characters'?`data-action="character" data-slug="${esc(c.slug)}"`:`data-rs="card" data-kind="${kind}" data-slug="${esc(c.slug)}"`} aria-label="Посмотреть ${esc(c.name)}">↗</button></div>`;
  }).join('')||`<div class="empty"><p>${p.relatedOnly?'У этого персонажа нет связанных тактик в снимке Jarvis. Снимите отметку «Только связанные карты», чтобы посмотреть все тактики и их статистику с этим персонажем.':'Ничего не найдено. Измените запрос или фильтры.'}</p></div>`}</div><div class="picker-footer"><span>Правки сохранятся вместе с ростером.</span><button class="primary" data-rs="close-picker">Готово</button></div>`;
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
