/* Character explorer. Data is embedded so the archive also works offline. */
(function(){
  'use strict';
  const initialRoute=location.hash;
  const data=window.ROSTER_ATLAS,core=window.AtlasCore,index=core.createIndex(data);
  const $=id=>document.getElementById(id==="screen"?"tournaments-screen":"at-"+id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?escape(u.href):'#';}catch{return '#';}};
  const initials=name=>name.replace(/[^\p{L}\p{N}\s-]/gu,'').split(/[\s-]+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('').toUpperCase();
  const date=value=>new Date(value+'T12:00:00').toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'});
  const plural=(n,one,few,many)=>n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;
  const countText=n=>`${n} ${plural(n,'ростер','ростера','ростеров')}`;
  const points=value=>Number(value||0).toLocaleString('ru-RU',{maximumFractionDigits:1});
  const mean=value=>value===null?'—':points(value);
  const affiliationNote=c=>escape(c.affiliations.length?c.affiliations.join(' · '):'Не указаны в каталоге');
  let selected=null,limit=20,toastTimer,collectionMode=false,selectedPlayer=null,playerMode=false,playerLimit=60;
  const selectedAffiliations=new Set();
  const allPlayers=core.playerList(index,'','name'),playersById=new Map(allPlayers.map(p=>[p.id,p]));
  const activeRows=rows=>core.scopeRows(rows,[...selectedAffiliations],selectedPlayer);
  const playerContext=()=>selectedPlayer?` · игрок <b>${escape(playersById.get(selectedPlayer).name)}</b>`:'';
  const collection=()=>initialized?{owned:state.owned,source:'Моя коллекция'}:null;
  const owned=()=>new Set(collection()?.owned||[]);
  const availability=r=>window.AtlasCollectionCore.availability(r,index.characters,owned());
  const readyRows=()=>data.rosters.filter(r=>availability(r).ready);


  function updateCollection(){
    const c=collection();
    $('available-rosters').disabled=!c;
    if(c)$('collection-status').textContent=`${c.source} · ${readyRows().length} ${plural(readyRows().length,'доступный ростер','доступных ростера','доступных ростеров')}${c.unknown?.length?` · не распознано отметок: ${c.unknown.length}`:''}`;
    renderOverview();renderRosters(true);
  }
  $('total-rosters').textContent=data.meta.rosters;
  $('total-events').textContent=data.meta.events;
  $('total-characters').textContent=data.characters.length;
  $('total-rosters').nextElementSibling.textContent=plural(data.meta.rosters,'ростер','ростера','ростеров');
  $('archive-summary').textContent=`${data.meta.results} сыгранных результатов со submitted list без ограничений по победам и поражениям. Рейтинговые офлайн-события; форматы singles, doubles и team. ${data.meta.rosters} вариантов ростеров, включая ${data.meta.zeroWinResults||0} результатов без побед и ${data.meta.fourPlusLossResults||0} с четырьмя или более поражениями. Несколько списков игрока за событие остаются одним выступлением. Записи без сыгранных игр и без опубликованного списка не включены.`;
  $('data-period').textContent=`Период: ${date(data.meta.start)} — ${date(data.meta.end)} включительно. Начальная дата округлена Longshanks до 5 августа, как и в прошлой выгрузке. Снимок: ${new Date(data.meta.snapshot).toLocaleString('ru-RU')}.`;
  $('source-results').href=`https://mcp.longshanks.org/events/history/?date_from=${encodeURIComponent(data.meta.start)}&date_to=${encodeURIComponent(data.meta.end)}`;
  $('scoring-coverage').textContent=`Места сопоставлены для ${data.meta.placesMatched} результатов. Баллы рассчитаны для ${data.meta.scoredResults} завершённых выступлений. ${data.meta.unrankedResults||0} результатов без опубликованного места не получают баллов. ${data.meta.provisionalResults} результатов относятся к продолжающимся событиям: их места отмечены как текущие, итоговые баллы появятся после завершения.`;
  $('coverage-note').textContent=`В архиве ${data.meta.encoded} кодированных и ${data.meta.text} текстовых листов. Текстовые листы включены по распознанным именам и отмечены в выдаче; оригинал доступен при раскрытии. ${data.meta.unindexed} лист содержит только название без состава. Prime Sentinel объединён в один пункт, поскольку в выгрузке его карты подписаны одинаково.`;
  const unindexed=data.rosters.filter(r=>!r.characterIds.length);
  const affiliationNames=[...new Set(data.rosters.flatMap(r=>r.affiliations))].sort((a,b)=>a.localeCompare(b));
  function renderAffiliations(){
    MCPReact.view($('affiliation-options'),'TournamentAffiliations',{rows:core.affiliationList(index,$('affiliation-sort').value),selected:[...selectedAffiliations]});
  }
  renderAffiliations();
  function updateAffiliationControls(){
    const names=affiliationNames.filter(a=>selectedAffiliations.has(a));
    $('affiliation-label').textContent=names.length===0?'Все аффилиации':names.length<=2?names.join(' · '):`${names.length} ${plural(names.length,'аффилиация','аффилиации','аффилиаций')}`;
    $('affiliation-clear').disabled=!names.length;
    $('affiliation-selected-count').textContent=names.length?`Выбрано: ${names.length}`:'Все аффилиации';
    $('affiliation-options').querySelectorAll('input').forEach(el=>{el.checked=selectedAffiliations.has(el.value);});
    $('affiliation-chips').hidden=!names.length;
    MCPReact.html($('affiliation-chips'),names.map(a=>`<button class="at-affiliation-chip" type="button" data-remove-affiliation="${escape(a)}" aria-label="Убрать аффилиацию ${escape(a)}">${escape(a)} <span aria-hidden="true">×</span></button>`).join(''));
  }
  MCPReact.append($('player-affiliation'),[...affiliationNames.map(a=>`<option value="${escape(a)}">${escape(a)}</option>`),'<option value="__none__">Без указанной аффилиации</option>'].join(''));
  const countryChoices=new Map();
  allPlayers.forEach(p=>{if(p.countryCode){const c=countryChoices.get(p.countryCode)||{name:p.country,count:0};c.count++;countryChoices.set(p.countryCode,c);}});
  MCPReact.append($('player-country'),[...[...countryChoices].sort((a,b)=>a[1].name.localeCompare(b[1].name)).map(([code,c])=>`<option value="${escape(code)}">${escape(c.name)} · ${c.count}</option>`),`<option value="__unknown__">Страна не указана · ${allPlayers.filter(p=>!p.countryCode).length}</option>`].join(''));
  function renderPlayers(preserveScroll=false){
    const panel=$('player-options'),top=preserveScroll?panel.scrollTop:0;
    const affiliation=$('player-affiliation').value;
    const rows=core.playerList(index,$('player-search').value,$('player-sort').value,affiliation,$('player-country').value);
    $('player-score-scope').textContent=`Баллы и выступления: ${affiliation?(affiliation==='__none__'?'без указанной аффилиации':affiliation):'весь архив игрока'}. Среднее сглажено; до 2 оценённых выступлений в этой выборке — 0.`;
    MCPReact.view(panel,'TournamentPlayers',{rows:rows.slice(0,playerLimit),selected:selectedPlayer});
    panel.scrollTop=top;
    $('player-more').hidden=rows.length<=playerLimit;
    $('player-more').textContent=`Показать ещё ${Math.min(60,rows.length-playerLimit)} игроков`;
    $('player-status').textContent=`${rows.length} / ${allPlayers.length} игроков${selectedPlayer?' · выбран: '+playersById.get(selectedPlayer).name:''}`;
  }
  function updatePlayerControls(){
    $('player-label').textContent=selectedPlayer?playersById.get(selectedPlayer).name:'Все игроки';
    $('player-clear').disabled=selectedPlayer===null;
    $('player-actions').hidden=selectedPlayer===null;
    $('player-all').hidden=selectedPlayer===null;
    $('player-options').querySelectorAll('input').forEach(el=>{el.checked=el.value===selectedPlayer;});
  }
  function currentRoute(){
    const p=new URLSearchParams();
    if(collectionMode)p.set('collection','ready');else if(!playerMode)p.set('character',selected);
    if(selectedPlayer!==null)p.set('player',selectedPlayer);
    return '#'+p.toString();
  }
  function updateRoute(){history.replaceState(null,'',currentRoute());}
  function choosePlayer(id,allRosters=false){
    selectedPlayer=id!==null&&playersById.has(String(id))?String(id):null;
    if(allRosters)collectionMode=false;
    playerMode=selectedPlayer!==null&&!collectionMode;limit=20;if(selectedPlayer!==null||allRosters)$('result-search').value='';
    updatePlayerControls();updateRoute();renderCharacters();renderOverview();renderRosters();
  }
  $('unindexed-lists').hidden=!unindexed.length;
  MCPReact.html($('unindexed-content'),unindexed.map(r=>`<p><b>${escape(r.player)}</b> · <a href="${safeUrl(r.eventUrl)}" target="_blank" rel="noopener noreferrer">${escape(r.event)} ↗</a><br>Лист #${r.listId}: ${escape(r.rawText)}</p>`).join(''));

  function notify(message){window.MCPNotify(message);}
  let characterScopeCache={key:null,rows:null};
  function renderCharacters(){
    const key=JSON.stringify([[...selectedAffiliations].sort(),selectedPlayer]);
    if(characterScopeCache.key!==key)characterScopeCache={key,rows:core.scopedCharacters(data,index,[...selectedAffiliations],selectedPlayer)};
    const scoped={characters:characterScopeCache.rows};
    const rows=core.characterList(scoped,$('character-search').value,$('only-used').checked,$('character-sort').value);
    $('character-total').textContent=`${rows.length} / ${data.characters.length}`;
    MCPReact.view($('character-list'),'TournamentCharacters',{rows,selected,collectionMode,playerMode});
  }
  function renderOverview(){
    const common={affiliations:[...selectedAffiliations],playerName:selectedPlayer?playersById.get(selectedPlayer).name:null};
    if(collectionMode){const rows=collection()?activeRows(readyRows()):[];MCPReact.view($('character-overview'),'TournamentOverview',{...common,mode:'collection',available:{count:rows.length,events:new Set(rows.map(r=>r.eventId)).size,players:new Set(rows.map(r=>r.playerId)).size}});return;}
    if(playerMode&&selectedPlayer!==null){const stats=core.playerStats(index,selectedPlayer,[...selectedAffiliations]);MCPReact.view($('character-overview'),'TournamentOverview',{...common,mode:'player',stats,profileAffiliations:playersById.get(selectedPlayer).affiliationCounts});return;}
    const scope=activeRows(data.rosters),c=index.characters.get(selected),stats=core.statistics(index,selected,scope.length,[...selectedAffiliations],selectedPlayer),ids=c.inventoryIds||[c.id];
    MCPReact.view($('character-overview'),'TournamentOverview',{...common,mode:'character',character:c,stats,inventorySlug:ids.find(id=>owned().has(id))||ids[0],ownership:collection()?characterCollectionStatus(ids):null,peers:stats.peers.map(([id,count])=>({id,count,name:index.characters.get(id).name}))});
  }


  function renderRosterBody(element,r){
    const entries=r.kind==='encoded'?r.characters:r.characterIds.map(id=>({id,gems:[]}));
    const statuses=collection()&&r.kind==='encoded'?availability(r).entries:null;
    MCPReact.view(element,'TournamentRosterBody',{row:r,selected,hasCollection:!!collection(),characters:entries.map((entry,i)=>{const info=index.characters.get(entry.id),ids=info?.inventoryIds||[entry.id];return {entry,info,inventorySlug:ids.find(id=>owned().has(id))||ids[0],status:collection()?characterCollectionStatus(ids,statuses?.[i]?.owned):null};})});
  }
  function renderRosters(preserve=false){
    const opened=preserve?new Set([...$('roster-list').querySelectorAll('details[open]')].map(d=>d.dataset.roster)):new Set();
    const filtered=!!($('result-search').value||selectedAffiliations.size);
    let rows=core.rosterList(index,(collectionMode||playerMode)?null:selected,$('result-search').value,$('result-sort').value,[...selectedAffiliations],selectedPlayer);
    if(collectionMode)rows=collection()?rows.filter(r=>availability(r).ready):[];
    const sourceRows=collectionMode?(collection()?readyRows():[]):playerMode?data.rosters:(index.byCharacter.get(selected)||[]);
    const total=core.scopeRows(sourceRows,[],selectedPlayer).length;
    $('result-count').textContent=filtered?`${countText(rows.length)} из ${total}`:countText(total);
    MCPReact.view($('roster-list'),'TournamentRosters',{items:rows.slice(0,limit).map(row=>({row,availability:collection()?availability(row):null})),total,selectedPlayer});
    $('show-more').hidden=rows.length<=limit;
    $('show-more').textContent=`Показать ещё ${Math.min(20,rows.length-limit)} · осталось ${rows.length-limit}`;
    $('roster-list').querySelectorAll('details').forEach(details=>MCPReact.listen(details,'toggle','roster-body',()=>{
      if(details.open){const r=data.rosters.find(r=>r.id===details.dataset.roster);renderRosterBody(details.querySelector('.at-roster-body'),r);details.dataset.loaded='true';}
    }));
    $('roster-list').querySelectorAll('details').forEach(d=>{if(opened.has(d.dataset.roster))d.open=true;if(d.open)renderRosterBody(d.querySelector('.at-roster-body'),data.rosters.find(r=>r.id===d.dataset.roster));});
    if(collectionMode&&!rows.length)MCPReact.html($('roster-list'),`<div class="at-empty-state"><strong>${collection()?(filtered?'По выбранным фильтрам ничего не найдено':'Пока нет полных совпадений'):'Подключи свою коллекцию'}</strong>${collection()?(total?'Измени поисковый запрос или сбрось выбранные аффилиации.':'Открой любой ростер персонажа: в составе будет видно, кто есть и кого не хватает.'):'Отметь свои модели в разделе «Моя коллекция».'}</div>`);
  }
  function selectCharacter(id,clearCharacterSearch=false,updateHash=true){
    if(!index.characters.has(id))return;
    selected=id;limit=20;$('result-search').value='';
    collectionMode=false;playerMode=false;
    if(clearCharacterSearch)$('character-search').value='';
    if(updateHash)updateRoute();
    renderCharacters();renderOverview();renderRosters();
  }
  $('screen').addEventListener('click',async event=>{
    const removeAffiliation=event.target.closest('[data-remove-affiliation]');
    if(removeAffiliation){selectedAffiliations.delete(removeAffiliation.dataset.removeAffiliation);affiliationsChanged();return;}
    const importer=event.target.closest('[data-tournament-import]');
    if(importer){openTournamentDraft(data.rosters.find(r=>r.id===importer.dataset.tournamentImport));return;}
    const button=event.target.closest('button[data-character]');
    if(button){const insideSidebar=button.closest('#at-character-list');selectCharacter(button.dataset.character,!insideSidebar);if(!insideSidebar&&innerWidth<760)$('character-overview').scrollIntoView({block:'start',behavior:'smooth'});return;}
    if(event.target.closest('#at-share-character')){
      try{await navigator.clipboard.writeText(location.href);notify('Ссылка на персонажа скопирована');}
      catch{notify('Ссылка на персонажа находится в адресной строке');}
    }
  });
  $('character-search').addEventListener('input',renderCharacters);
  $('only-used').addEventListener('change',renderCharacters);
  $('character-sort').addEventListener('change',renderCharacters);
  $('result-search').addEventListener('input',()=>{limit=20;renderRosters();});
  $('result-sort').addEventListener('change',()=>{limit=20;renderRosters();});
  $('player-picker').addEventListener('click',()=>{renderPlayers();$('player-dialog').showModal();});
  ['player-close','player-done'].forEach(id=>$(id).addEventListener('click',()=>{$('player-dialog').close();}));
  $('player-dialog').addEventListener('click',event=>{if(event.target===$('player-dialog')){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();}});
  $('player-options').addEventListener('change',event=>{if(event.target.type!=='radio')return;choosePlayer(event.target.value);$('player-status').textContent=`Выбран: ${playersById.get(selectedPlayer).name}`;});
  $('player-clear').addEventListener('click',()=>choosePlayer(null));
  $('player-all').addEventListener('click',()=>choosePlayer(selectedPlayer,true));
  ['player-search','player-sort','player-affiliation','player-country'].forEach(id=>$(id).addEventListener(id==='player-search'?'input':'change',()=>{playerLimit=60;renderPlayers();}));
  $('player-more').addEventListener('click',()=>{playerLimit+=60;renderPlayers(true);});
  function affiliationsChanged(){limit=20;updateAffiliationControls();renderCharacters();renderOverview();renderRosters();}
  $('affiliation-options').addEventListener('change',event=>{if(event.target.type!=='checkbox')return;event.target.checked?selectedAffiliations.add(event.target.value):selectedAffiliations.delete(event.target.value);affiliationsChanged();});
  $('affiliation-clear').addEventListener('click',()=>{selectedAffiliations.clear();affiliationsChanged();});
  $('affiliation-sort').addEventListener('change',renderAffiliations);
  $('affiliation-picker').addEventListener('click',()=>{$('affiliation-dialog').showModal();});
  ['affiliation-close','affiliation-done'].forEach(id=>$(id).addEventListener('click',()=>{$('affiliation-dialog').close();}));
  $('affiliation-dialog').addEventListener('click',event=>{if(event.target===$('affiliation-dialog')){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();}});
  $('show-more').addEventListener('click',()=>{limit+=20;renderRosters();});
  $('available-rosters').addEventListener('click',()=>{collectionMode=true;playerMode=false;limit=20;$('result-search').value='';updateRoute();renderCharacters();renderOverview();renderRosters();});
  window.addEventListener('atlas-collection-change',updateCollection);
  function fromHash(params=new URLSearchParams(location.hash.slice(1))){const id=params.get('character');return index.characters.has(id)?id:core.characterList(data)[0].id;}
  function applyRoute(params){
    selectedPlayer=playersById.has(params.get('player'))?params.get('player'):null;
    collectionMode=params.get('collection')==='ready';
    playerMode=selectedPlayer!==null&&!collectionMode&&!params.has('character');
    selected=fromHash(params);limit=20;
    updatePlayerControls();renderCharacters();renderOverview();renderRosters();
  }
  window.addEventListener('hashchange',()=>{if(!initialized)return;const params=new URLSearchParams(location.hash.slice(1));if(params.has('character')||params.has('collection')||params.has('player'))requestLeave(()=>{applyRoute(params);showTournaments();});});
  applyRoute(new URLSearchParams(initialRoute.slice(1)));
  window.Tournaments={refresh:updateCollection,activate:updateRoute,boot:()=>{updateCollection();const s=new URLSearchParams(initialRoute.slice(1)).get('screen');if(s==='catalog')showCatalog();else if(s==='mine')showCatalog(true);else if(s==='rosters')showRosterList();else if(s==='battle')showBattleScreen();else if(s==='purchases')showPurchases();else showTournaments();}};
})();
