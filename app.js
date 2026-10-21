'use strict';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let storageKey = 'mcp-companion-catalog-v1';
const normalize = value => String(value || '').normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
const searchWords = value => normalize(value).match(/[\p{L}\p{N}]+/gu) || [];
let catalog, characters, state = {version:1,owned:[],rosters:[],groups:[],wishlist:[]};
let screen='catalog';
let selectedSlug = null, selectedSide = 'healthy', selectedForm = 0, cardRequest = 0;
let rosterMode = null, rosterViewId = null, toastTimer, searchTimer, initialized=false;
const cards = new Map();
if('scrollRestoration' in history)history.scrollRestoration='manual';

function toast(message) {
  $('#toast').textContent=message;$('#toast').classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2800);
}
function persist() {
  if(!initialized)return false;
  try {localStorage.setItem(storageKey,JSON.stringify(dataOnly(state)));window.Tournaments?.refresh();window.Account?.save();return true;}
  catch {toast('Браузер не сохранил изменения. Экспортируйте данные.');return false;}
}
function dataOnly(value) {
  return {version:1,...purchaseCollectionData(value),rosters:value.rosters.map(normalizeRosterRecord),groups:value.groups||[],wishlist:wishlistCodes(value.wishlist||[])};
}
function isOwned(slug) {return state.owned.includes(slug);}
function avatar(c,large=false) {
  const initials=c.name.split(/[\s,-]+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('');
  return `<span class="avatar ${large?'large':''} ${c.portrait?'has-image':''}"><span class="initials" aria-hidden="true">${esc(initials)}</span>${c.portrait?`<img src="${esc(c.portrait)}" alt="Портрет ${esc(c.name)}" ${large?'':'loading="lazy"'} decoding="async">`:''}</span>`;
}
function ownLabel(slug,detail=false) {
  return `<label class="check"><input type="checkbox" id="${detail?'detail-owned':'owned-'+slug}" data-owned="${esc(slug)}" ${isOwned(slug)?'checked':''} ${isBoxOwned(slug)?'disabled title="Входит в купленный набор. Отметка управляется в карточке набора."':''} aria-label="Есть у меня: ${esc(characters.get(slug).name)}"><span>Есть у меня</span></label>`;
}
function resultCharacters() {
  const terms=searchWords($('#search').value),aff=$('#affiliation').value,threat=$('#threat').value,only=$('#only-owned').checked;
  return catalog.characters.filter(c=>{
    const words=searchWords(c.name+' '+(c.alterEgo||''));
    return terms.every(term=>words.some(word=>word.startsWith(term)))&&(!aff||c.affiliations.some(a=>a.name===aff))&&(!threat||String(c.threatLevel)===threat)&&(!only||isOwned(c.slug));
  });
}
function renderList() {
  if(!catalog)return;
  const rows=resultCharacters();
  $('#result').textContent=$('#only-owned').checked?'Модели с отметкой «Есть у меня»':`${rows.length} записей · по алфавиту`;
  $('#page-title').textContent=$('#only-owned').checked?'Моя коллекция':'Персонажи';
  updateNavigation();
  $('#characters').innerHTML=rows.length?rows.map(c=>`<div class="character-row"><button class="row-open" data-action="character" data-slug="${esc(c.slug)}" aria-label="Открыть карточку ${esc(c.name)}, ${esc(c.alterEgo)}">${avatar(c)}<span class="row-copy"><strong>${esc(c.name)}</strong><span class="alter-ego">${esc(c.alterEgo||'Без alter ego')}${c.isGrunt?' · Grunt':''}</span><span class="affiliations">${c.affiliations.map(a=>`<span class="affiliation">${esc(a.name)}${a.isLeader?' <span class="leader-mark">· лидер</span>':''}</span>`).join('')||'<span>Без аффилиации</span>'}</span></span><span class="row-threat"><b>${esc(c.threatLevel??'—')}</b><small>THREAT</small></span></button><div class="owned-control ${isOwned(c.slug)?'owned':''}">${ownLabel(c.slug)}</div></div>`).join(''):`<div class="empty"><h3>${$('#only-owned').checked?'Здесь пока пусто':'Ничего не найдено'}</h3><p>${$('#only-owned').checked?'Отметьте свои модели в каталоге или измените остальные фильтры.':'Попробуйте другое имя или снимите фильтры.'}</p><button data-action="reset">Показать всех персонажей</button></div>`;
}
function resetFilters(only=false) {
  $('#search').value='';$('#affiliation').value='';$('#threat').value='';$('#only-owned').checked=only;renderList();
}
function formatRule(text) {
  const tokens={power:'Power',damage:'Damage',wild:'Wild',critical:'Crit',crit:'Crit',failure:'Failure',hit:'Hit',block:'Block',blank:'Blank',size:'Size',range_small:'S',range_medium:'M',range_large:'L',physical:'Physical',energy:'Energy',mystic:'Mystic'};
  return esc(String(text).replace(/\|<[^>]+>([^|]+)\|/g,'$1').replace(/\|§[^§]+§([^|]+)\|/g,'$1').replace(/\|\\\|/g,'\n')).replace(/\|!([^|]+)\|/g,(_,token)=>`<span class="rules-icon">${esc(tokens[token]||token.replaceAll('_',' '))}</span>`).replace(/\|\*([^|]+)\|/g,'<strong>$1</strong>').replaceAll('\n','<br>');
}
function actionsMarkup(face) {
  return (face.attacks||[]).map(attack=>`<article class="ability"><div class="ability-head"><strong>${esc(attack.name)}</strong><small>${esc(attack.type)}</small></div><div class="ability-meta"><span class="tag">Range ${esc(attack.range)}</span><span class="tag">Strength ${esc(attack.strength)}</span><span class="tag">Power ${esc(attack.powerCost??0)}</span>${attack.form&&attack.form!=='normal'?`<span class="tag">${esc(attack.form)}</span>`:''}</div>${(attack.steps||[]).map(step=>`<p>${formatRule(step)}</p>`).join('')}</article>`).join('')||'<p class="muted">На этой стороне карты нет атак.</p>';
}
function powersMarkup(face) {
  return (face.superPowers||[]).map(power=>`<article class="ability"><div class="ability-head"><strong>${esc(power.name)}</strong><small>${esc(power.type)}</small></div>${power.powerCost!=null?`<div class="ability-meta"><span class="tag">Power ${esc(power.powerCost)}</span></div>`:''}${power.form&&power.form!=='normal'?`<span class="tag">${esc(power.form)}</span>`:''}<p>${formatRule(power.body||'')}</p></article>`).join('')||'<p class="muted">На этой стороне карты нет суперспособностей.</p>';
}
function myRostersMarkup(slug) {
  const list=state.rosters.filter(r=>r.characters.includes(slug));
  return list.length?list.map(r=>`<button class="roster-link" data-action="view-roster" data-id="${esc(r.id)}"><span><strong>${esc(r.name)}</strong><small>${esc(r.affiliation||'Без выбранной аффилиации')}</small></span><span aria-hidden="true">→</span></button>`).join(''):'<div class="no-rosters">Пока ни в одном ростере.</div>';
}
function distinctBack(card) {
  if(!card?.backSide)return false;
  const fields=['type','nameOverride','stamina','speed','size','physicalDefense','energyDefense','mysticDefense','attacks','superPowers'];
  return fields.some(key=>JSON.stringify(card.frontSide[key])!==JSON.stringify(card.backSide[key]));
}
function renderCharacter(error='') {
  if(!selectedSlug)return;
  const c=characters.get(selectedSlug),detail=cards.get(selectedSlug);
  const statCard=selectedForm===1?detail?.secondStatCard:detail?.statCard;
  const head=`<header class="detail-head"><div class="detail-top">${avatar(c,true)}<div class="detail-name"><span class="eyebrow">02 / Карточка персонажа</span><h2>${esc(c.name)}</h2><p>${esc(c.alterEgo)}</p><div class="tags">${c.affiliations.map(a=>`<span class="tag">${esc(a.name)}${a.isLeader?' · лидер':''}</span>`).join('')}${c.isGrunt?'<span class="tag">Grunt</span>':''}</div></div>${ownLabel(c.slug,true)}<button class="quiet close" data-action="close-character" aria-label="Закрыть карточку">×</button></div></header>`;
  let content='';
  if(!detail&&!error)content='<div class="loading">Загружаем полную карту…</div>';
  else if(error||!statCard)content=`<div class="empty"><h3>Карточка пока не загрузилась</h3><p>${esc(error||'Полной карты нет в источнике.')}</p><div class="actions"><button data-action="retry-card">Повторить</button><a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">Открыть Jarvis ↗</a></div></div>`;
  else {
    content=statCardViewerMarkup('catalog',c.slug,detail,selectedForm,selectedSide==='injured'?'back':'front');
  }
  $('#character-content').innerHTML=head+`<div class="detail-body">${content}${characterBoxSetsMarkup(c)}<section class="detail-section roster-memberships"><div class="section-title"><h3>В моих ростерах</h3><button data-action="pick-roster">Добавить в ростер +</button></div>${myRostersMarkup(c.slug)}</section><div class="source-line"><a href="${esc(c.sourceUrl)}" target="_blank" rel="noopener">Карточка на Jarvis ↗</a><span>Данные Jarvis · ${new Date(catalog.fetchedAt).toLocaleDateString('ru-RU')}</span></div></div>`;
}
async function openCharacter(slug,reset=true) {
  if(!characters.has(slug))return;
  selectedSlug=slug;if(reset){statCardViews.delete('catalog');selectedSide='healthy';selectedForm=0;$('#character-dialog').scrollTop=0;}
  if(cards.has(slug)){
    const cached=cards.get(slug);
    if(selectedForm===1&&!cached.secondStatCard)selectedForm=0;
    if(selectedSide==='injured'&&!distinctBack(selectedForm===1?cached.secondStatCard:cached.statCard))selectedSide='healthy';
  }
  const request=++cardRequest;renderCharacter();if(!$('#character-dialog').open)$('#character-dialog').showModal();
  if(cards.has(slug)){
    if(reset)$('#character-dialog').scrollTop=0;
    return;
  }
  try {
    const response=await fetch('data/cards/'+encodeURIComponent(slug)+'.json');if(!response.ok)throw new Error('Полная карта недоступна.');
    const detail=await response.json();cards.set(slug,detail);
    if(request===cardRequest&&selectedSlug===slug&&$('#character-dialog').open){
      if(selectedForm===1&&!detail.secondStatCard)selectedForm=0;
      const selected=selectedForm===1?detail.secondStatCard:detail.statCard;
      if(selectedSide==='injured'&&!distinctBack(selected))selectedSide='healthy';
      renderCharacter();if(reset)$('#character-dialog').scrollTop=0;
    }
  }catch(error){if(request===cardRequest&&selectedSlug===slug)renderCharacter(error.message);}
}
function showRosterPicker(draft='') {
  rosterMode='picker';rosterViewId=null;
  $('#roster-content').innerHTML=`<div class="dialog-heading"><div><h2>Добавить в ростер</h2><p>${esc(characters.get(selectedSlug).name)} · можно выбрать несколько.</p></div><button class="quiet close" data-action="close-roster" aria-label="Закрыть выбор ростеров">×</button></div>${state.rosters.length?state.rosters.map(r=>`<label class="check roster-pick"><input type="checkbox" data-roster="${esc(r.id)}" ${r.characters.includes(selectedSlug)?'checked':''}>${esc(r.name)}</label>`).join(''):'<p class="muted" style="font-size:12px">Сохранённых ростеров пока нет. Создайте первый.</p>'}<form id="create-roster" class="create-roster"><label class="field">Название нового ростера<input name="name" maxlength="100" placeholder="Например: Avengers · основной" required></label><div class="actions"><button class="primary" type="submit">Создать и добавить</button><button type="button" data-action="close-roster">Готово</button></div></form>`;
  if(!$('#roster-dialog').open)$('#roster-dialog').showModal();
  $('#create-roster input[name="name"]').value=draft;
}
function showRoster(id) {
  openRosterEditor(id);
}
function showData() {
  $('#data-content').innerHTML=`<div class="dialog-heading"><div><h2>Данные приложения</h2><p>${window.Account?.enabled?'Коллекция, ростеры, группы и локальные партии сохраняются в аккаунте на сервере. Сетевые партии хранятся отдельно и доступны обоим игрокам.':'Коллекция, ростеры, группы и партии хранятся в этом браузере.'}</p></div><button class="quiet close" data-action="close-data" aria-label="Закрыть данные">×</button></div><p style="font-size:12px">Полные карты и портреты загружены из Jarvis. Для переноса из локальной версии используйте её экспорт JSON и импорт здесь.</p><div class="actions" style="margin-top:20px"><button class="primary" data-action="export">Экспорт JSON</button><button data-action="import">Импорт JSON</button></div><input id="import-file" type="file" accept="application/json" hidden><p class="notice">Экспорт включает отметки наличия, ростеры, группы, запланированные и купленные наборы и партии. Несохранённые правки и состояние интерфейса не экспортируются.</p>`;
  $('#data-dialog').showModal();
}
function exportData() {
  persist();
  const url=URL.createObjectURL(new Blob([JSON.stringify({...dataOnly(state),battles:battleDataOnly()},null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='mcp-companion-catalog.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Данные экспортированы');
}
function validate(data) {
  if(data?.version!==1||!Array.isArray(data.owned)||!Array.isArray(data.rosters))throw new Error('Файл не подходит этому прототипу.');
  if(data.owned.some(slug=>!characters.has(slug)))throw new Error('В файле есть неизвестные персонажи.');
  const ids=new Set();
  data.rosters.forEach(r=>{if(typeof r.id!=='string'||ids.has(r.id)||typeof r.name!=='string'||(r.affiliation!==undefined&&typeof r.affiliation!=='string')||!Array.isArray(r.characters)||r.characters.some(slug=>!characters.has(slug)))throw new Error('Не удалось прочитать ростеры.');ids.add(r.id);});
  validateRosterPayload(data);
  validatePurchaseFields(data);
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;
  if(!initialized&&['all','mine','rosters','battle','tournaments','purchases','catalog-character'].includes(action))return;
  if(action==='character')openCharacter(button.dataset.slug);
  else if(action==='catalog-character')openCatalogCharacter(button.dataset.slug);
  else if(action==='purchases')navigatePurchases();
  else if(action==='all')navigateCatalog(false);
  else if(action==='mine')navigateCatalog(true);
  else if(action==='rosters')navigateRosters();
  else if(action==='battle')navigateBattle();
  else if(action==='tournaments')requestLeave(showTournaments);
  else if(action==='reset')resetFilters();
  else if(action==='close-character')$('#character-dialog').close();
  else if(action==='side'){selectedSide=button.dataset.side;renderCharacter();}
  else if(action==='form'){selectedForm=Number(button.dataset.form);selectedSide='healthy';renderCharacter();}
  else if(action==='retry-card'){cards.delete(selectedSlug);openCharacter(selectedSlug,false);}
  else if(action==='pick-roster')showRosterPicker();
  else if(action==='view-roster')showRoster(button.dataset.id);
  else if(action==='close-roster')$('#roster-dialog').close();
  else if(action==='roster-character'){$('#roster-dialog').close();openCharacter(button.dataset.slug);}
  else if(action==='data')showData();
  else if(action==='close-data')$('#data-dialog').close();
  else if(action==='export')exportData();
  else if(action==='import')$('#import-file').click();
});
document.addEventListener('change',async event=>{
  const input=event.target;
  if(input.dataset.owned){
    const slug=input.dataset.owned;if(isBoxOwned(slug)){input.checked=true;return;}const manual=state.manuallyOwned??state.owned;state=dataOnly({...state,manuallyOwned:input.checked?[...new Set([...manual,slug])]:manual.filter(s=>s!==slug)});persist();renderList();
    if($('#character-dialog').open){const scroll=$('#character-dialog').scrollTop;renderCharacter();$('#character-dialog').scrollTop=scroll;}
    if(!$('#character-dialog').open)document.getElementById('owned-'+slug)?.focus();
    refreshRosters();refreshPurchases();
  }
  else if(input.dataset.roster){const roster=state.rosters.find(r=>r.id===input.dataset.roster);roster.characters=input.checked?[...new Set([...roster.characters,selectedSlug])]:roster.characters.filter(s=>s!==selectedSlug);roster.updatedAt=new Date().toISOString();syncRosterMembership(roster.id,selectedSlug,input.checked);persist();renderCharacter();refreshRosters();}
  else if(['affiliation','threat','only-owned'].includes(input.id))renderList();
  else if(input.id==='import-file'){
    const file=input.files[0];if(!file)return;
    try{const imported=JSON.parse(await file.text());validate(imported);if(imported.battles)validateBattleData(imported.battles);$('#data-content').innerHTML=`<div class="dialog-heading"><h2>Восстановить данные?</h2></div><p style="font-size:12px">Коллекция, ростеры, группы, запланированные и купленные наборы будут заменены содержимым файла. В старых файлах без списков наборов эти списки будут пустыми. Если файл содержит партии, они тоже будут восстановлены.</p><div class="actions" style="margin-top:20px"><button id="confirm-import" class="primary">Восстановить</button><button data-action="close-data">Отмена</button></div>`;$('#confirm-import').onclick=()=>{
      if(imported.battles&&!replaceBattleData(imported.battles))return;
      state=dataOnly(imported);state.owned=[...new Set(state.owned)];
      persist();renderList();refreshPurchases();if(selectedSlug)renderCharacter();resetRosterWorkspace();refreshRosters();if(screen==='battle'){battleView='home';battleMatchId=null;renderBattle();}$('#data-dialog').close();toast('Данные восстановлены');
    };}
    catch(error){toast(error.message||'Не удалось прочитать файл.');}
  }
});
document.addEventListener('submit',event=>{
  if(event.target.id!=='create-roster')return;event.preventDefault();
  const name=new FormData(event.target).get('name').trim();if(!name)return;
  const id=crypto.randomUUID();state.rosters.push(normalizeRosterRecord({id,name,affiliation:characters.get(selectedSlug).affiliations[0]?.name||'',characters:[selectedSlug],updatedAt:new Date().toISOString()}));event.target.reset();persist();renderCharacter();refreshRosters();showRosterPicker();toast('Ростер создан, персонаж добавлен');
});
$('#search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(renderList,60);});
document.addEventListener('keydown',event=>{
  if(event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&screen==='catalog'&&!document.querySelector('dialog[open]')){event.preventDefault();$('#search').focus();}
});
document.addEventListener('error',event=>{
  if(event.target.tagName==='IMG'&&event.target.closest('.avatar')){event.target.closest('.avatar').classList.remove('has-image');event.target.hidden=true;}
},true);
$('#character-dialog').addEventListener('close',()=>{if($('#character-dialog').open)return;selectedSlug=null;cardRequest++;});
$('#roster-dialog').addEventListener('close',()=>{if($('#roster-dialog').open)return;rosterMode=null;rosterViewId=null;});
window.addEventListener('storage',event=>{
  if(!initialized||event.key!==storageKey||!event.newValue)return;
  try{
    const saved=JSON.parse(event.newValue);validate(saved);
    state=dataOnly(saved);
    renderList();
    window.Tournaments?.refresh();
    refreshRosters(true);refreshPurchases();
    if(selectedSlug&&$('#character-dialog').open){const scroll=$('#character-dialog').scrollTop;renderCharacter();$('#character-dialog').scrollTop=scroll;}
    if($('#roster-dialog').open&&rosterMode==='view'){
      if(state.rosters.some(r=>r.id===rosterViewId)){
        const scroll=$('#roster-dialog').scrollTop;showRoster(rosterViewId);$('#roster-dialog').scrollTop=scroll;
      }else $('#roster-dialog').close();
    }
    if($('#roster-dialog').open&&rosterMode==='picker'){
      const draft=$('#create-roster input[name="name"]').value;
      const scroll=$('#roster-dialog').scrollTop;showRosterPicker(draft);$('#roster-dialog').scrollTop=scroll;
    }
  }catch{ /* A malformed write from another tab must not discard the current data. */ }
});

async function boot() {
  try{
    const response=await fetch('data/catalog.json');if(!response.ok)throw new Error('Источник недоступен');catalog=await response.json();
    catalog.characters.sort((a,b)=>a.name.localeCompare(b.name,'en')||String(a.alterEgo||'').localeCompare(String(b.alterEgo||''),'en'));
    characters=new Map(catalog.characters.map(c=>[c.slug,c]));
    await Promise.all([initRosterData(),initBoxSetData()]);
    const serverAccount=await window.Account?.init();
    if(!serverAccount)loadBattleData();
    await initBattleMapData();
    const affiliations=[...new Set(catalog.characters.flatMap(c=>c.affiliations.map(a=>a.name)))].sort();
    $('#affiliation').innerHTML='<option value="">Все аффилиации</option>'+affiliations.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');
    $('#threat').innerHTML='<option value="">Любой Threat</option>'+[...new Set(catalog.characters.map(c=>c.threatLevel).filter(v=>v!=null))].sort((a,b)=>a-b).map(n=>`<option value="${n}">${n}</option>`).join('');
    $('#source-date').textContent='Снимок '+new Date(catalog.fetchedAt).toLocaleDateString('ru-RU');
    let pruneLegacy=false,migrateOwned=false;
    try{const raw=localStorage.getItem(storageKey);if(raw){const saved=JSON.parse(raw);validate(saved);state=dataOnly(saved);
      pruneLegacy=Object.prototype.hasOwnProperty.call(saved,'ui')||Object.prototype.hasOwnProperty.call(saved,'characterViews')||!Array.isArray(saved.groups)||saved.rosters.some(r=>!Array.isArray(r.tactics)||!Array.isArray(r.crises)||!Array.isArray(r.groups));
    }else if(!window.Account?.enabled){const old=localStorage.getItem('mcp-roster-atlas-collection-v1');if(old){const saved=JSON.parse(old);if(Array.isArray(saved.owned)&&saved.owned.every(id=>typeof id==='string')){state.owned=[...new Set(saved.owned.filter(id=>characters.has(id)))];migrateOwned=true;}}}}
    catch{toast('Сохранение не удалось прочитать. Исходная запись не изменена.');}
    initialized=true;updatePurchaseBadge();if(window.Account?.enabled){window.NetworkBattle.list().catch(e=>toast(e.message));window.Account.flush().catch(e=>toast(e.message));}if(pruneLegacy||migrateOwned)persist();resetFilters();document.querySelectorAll('.nav-item').forEach(button=>button.disabled=false);window.Tournaments?.boot();requestAnimationFrame(()=>window.scrollTo(0,0));
  }catch(error){$('#result').textContent='Каталог недоступен';$('#characters').innerHTML='<div class="empty"><h3>Не удалось загрузить каталог</h3><p>'+esc(error.message||'Проверьте локальный сервер и попробуйте ещё раз.')+'</p><button id="retry-load">Повторить</button></div>';$('#retry-load').onclick=boot;}
}

window.MCPNotify=toast;
function showTournaments(){screen="tournaments";rosterDraft=null;for(const id of ["catalog-screen","rosters-screen","battle-screen","purchases-screen"])$("#"+id).hidden=true;$("#tournaments-screen").hidden=false;window.Tournaments.activate();updateNavigation();window.Tournaments.refresh();window.scrollTo(0,0);}
function openTournamentDraft(roster){if(!roster||!initialized)return;requestLeave(()=>{for(const d of document.querySelectorAll("dialog[open]"))d.close();const draft=TournamentImport.draft(roster,AtlasCore.createIndex(ROSTER_ATLAS).characters,state.owned,catalog.characters,rosterCards);rosterDraft=normalizeRosterRecord({...draft,id:crypto.randomUUID()});rosterBase="";rosterWasSaved=false;rosterConflict=false;editorTab="characters";screen="rosters";for(const id of ["catalog-screen","battle-screen","tournaments-screen","purchases-screen"])$("#"+id).hidden=true;$("#rosters-screen").hidden=false;renderRosterEditor();updateNavigation();window.scrollTo(0,0);});}
