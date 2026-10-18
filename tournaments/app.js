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
  function ownershipTag(id){
    if(!collection())return '<small class="at-ownership-unknown">Наличие не подключено</small>';
    const yes=(index.characters.get(id)?.inventoryIds||[id]).some(x=>owned().has(x));
    return `<small class="at-ownership-tag ${yes?'at-owned':'at-missing'}">${yes?'✓ Есть у меня':'Нет в коллекции'}</small>`;
  }
  function availabilityTag(r){
    if(!collection())return '';
    const a=availability(r);
    return `<span class="at-availability-tag ${a.ready?'at-ready':''}">${a.ready?'✓ Все персонажи есть':a.complete?`Есть ${a.have} / ${a.total} · не хватает ${a.missing.length}`:`Распознано ${a.total} персонажей · состав неполный`}</span>`;
  }
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
    $('affiliation-options').innerHTML=core.affiliationList(index,$('affiliation-sort').value).map((a,i)=>`<label class="at-affiliation-option"><span class="at-row-index" aria-hidden="true">${i+1}</span><input type="checkbox" value="${escape(a.name)}" ${selectedAffiliations.has(a.name)?'checked':''}><span class="at-affiliation-name"><strong>${escape(a.name)}</strong><small>${a.scoredResults} ${plural(a.scoredResults,'выступление','выступления','выступлений')}</small></span><span class="at-affiliation-score ${a.points<0?'at-negative':''}" aria-label="Всего ${points(a.points)} баллов">${points(a.points)}</span><span class="at-affiliation-score ${a.average<0?'at-negative':''}" aria-label="Сглаженное среднее ${mean(a.average)}">${mean(a.average)}</span></label>`).join('');
  }
  renderAffiliations();
  function updateAffiliationControls(){
    const names=affiliationNames.filter(a=>selectedAffiliations.has(a));
    $('affiliation-label').textContent=names.length===0?'Все аффилиации':names.length<=2?names.join(' · '):`${names.length} ${plural(names.length,'аффилиация','аффилиации','аффилиаций')}`;
    $('affiliation-clear').disabled=!names.length;
    $('affiliation-selected-count').textContent=names.length?`Выбрано: ${names.length}`:'Все аффилиации';
    $('affiliation-options').querySelectorAll('input').forEach(el=>{el.checked=selectedAffiliations.has(el.value);});
    $('affiliation-chips').hidden=!names.length;
    $('affiliation-chips').innerHTML=names.map(a=>`<button class="at-affiliation-chip" type="button" data-remove-affiliation="${escape(a)}" aria-label="Убрать аффилиацию ${escape(a)}">${escape(a)} <span aria-hidden="true">×</span></button>`).join('');
  }
  $('player-affiliation').innerHTML+=[...affiliationNames.map(a=>`<option value="${escape(a)}">${escape(a)}</option>`),'<option value="__none__">Без указанной аффилиации</option>'].join('');
  const countryChoices=new Map();
  allPlayers.forEach(p=>{if(p.countryCode){const c=countryChoices.get(p.countryCode)||{name:p.country,count:0};c.count++;countryChoices.set(p.countryCode,c);}});
  $('player-country').innerHTML+=[...[...countryChoices].sort((a,b)=>a[1].name.localeCompare(b[1].name)).map(([code,c])=>`<option value="${escape(code)}">${escape(c.name)} · ${c.count}</option>`),`<option value="__unknown__">Страна не указана · ${allPlayers.filter(p=>!p.countryCode).length}</option>`].join('');
  function renderPlayers(preserveScroll=false){
    const panel=$('player-options'),top=preserveScroll?panel.scrollTop:0;
    const affiliation=$('player-affiliation').value;
    const rows=core.playerList(index,$('player-search').value,$('player-sort').value,affiliation,$('player-country').value);
    $('player-score-scope').textContent=`Баллы и выступления: ${affiliation?(affiliation==='__none__'?'без указанной аффилиации':affiliation):'весь архив игрока'}. Среднее сглажено; до 2 оценённых выступлений в этой выборке — 0.`;
    panel.innerHTML=rows.length?rows.slice(0,playerLimit).map((p,i)=>`<label class="at-player-option"><span class="at-row-index" aria-hidden="true">${i+1}</span><input type="radio" name="at-player-choice" value="${escape(p.id)}" ${selectedPlayer===p.id?'checked':''}><span class="at-player-name"><strong>${escape(p.name)}</strong><small>#${escape(p.id)} · ${escape(p.country||'Страна не указана')} · ${p.resultsCount} ${plural(p.resultsCount,'выступление','выступления','выступлений')} · оценено: ${p.scoredResults}</small><span class="at-player-affiliations">${p.affiliationCounts.length?p.affiliationCounts.map(a=>`<span class="at-affiliation-tag">${escape(a.name)} · ${a.appearances}</span>`).join(''):'<span class="at-affiliation-empty">Без указанной аффилиации</span>'}</span></span><span class="at-player-score ${p.points<0?'at-negative':''}" aria-label="Всего ${points(p.points)} баллов">${points(p.points)}</span><span class="at-player-score ${p.average<0?'at-negative':''}" aria-label="Сглаженное среднее ${mean(p.average)}">${mean(p.average)}</span></label>`).join(''):'<div class="at-player-empty">Игроки не найдены. Измени поиск, страну или аффилиацию.</div>';
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
  $('unindexed-content').innerHTML=unindexed.map(r=>`<p><b>${escape(r.player)}</b> · <a href="${safeUrl(r.eventUrl)}" target="_blank" rel="noopener noreferrer">${escape(r.event)} ↗</a><br>Лист #${r.listId}: ${escape(r.rawText)}</p>`).join('');

  function notify(message){window.MCPNotify(message);}
  function renderCharacters(){
    const scoped={characters:core.scopedCharacters(data,index,[...selectedAffiliations],selectedPlayer)};
    const rows=core.characterList(scoped,$('character-search').value,$('only-used').checked,$('character-sort').value);
    $('character-total').textContent=`${rows.length} / ${data.characters.length}`;
    $('character-list').innerHTML=rows.length?rows.map((c,i)=>`<button class="at-character-button${c.count?'':' at-zero'}" type="button" data-character="${escape(c.id)}" aria-pressed="${!collectionMode&&!playerMode&&c.id===selected}" aria-label="${escape(c.name+' ('+c.alterEgo+')')}, всего ${points(c.points)} баллов, среднее ${mean(c.average)}, ${countText(c.count)}, аффилиейшены: ${escape(c.affiliations.join(', ')||'не указаны в каталоге')}"><span class="at-row-index" aria-hidden="true">${i+1}</span><span class="at-character-avatar" aria-hidden="true">${escape(initials(c.name))}</span><span class="at-character-name"><strong>${escape(c.name)}</strong><small>${escape(c.alterEgo)} · ${c.count}</small><span class="at-character-affiliations">${affiliationNote(c)}</span></span><span class="at-character-frequency"><span class="${c.points<0?'at-negative':''}" title="Общие баллы">Σ ${points(c.points)}</span><small class="${c.average<0?'at-negative':''}" title="Сглаженное среднее с одним нулевым выступлением; при менее 4 выступлениях — 0">Ø ${mean(c.average)}</small></span></button>`).join(''):'<div class="at-empty-character">Ничего не найдено.<br>Попробуй другое имя.</div>';
  }
  function renderOverview(){
    if(collectionMode){
      const rows=collection()?activeRows(readyRows()):[];
      $('character-overview').innerHTML=`<div class="at-overview-title"><span class="at-selected-icon" aria-hidden="true">✓</span><div><div class="at-version-label">МОЯ КОЛЛЕКЦИЯ</div><h2>Ростеры из моих персонажей</h2><p>Полные совпадения по персонажам. ${selectedAffiliations.size?`Аффилиации: ${escape([...selectedAffiliations].join(' · '))}.`:'Все аффилиации архива.'}${playerContext()}</p></div></div><div class="at-overview-stats"><div class="at-overview-stat"><strong>${rows.length}</strong><span>доступных ростеров</span></div><div class="at-overview-stat"><strong>${new Set(rows.map(r=>r.eventId)).size}</strong><span>событий</span></div><div class="at-overview-stat"><strong>${new Set(rows.map(r=>r.playerId)).size}</strong><span>игроков</span></div></div>`;
      return;
    }
    if(playerMode&&selectedPlayer!==null){
      const p=core.playerStats(index,selectedPlayer,[...selectedAffiliations]),global=playersById.get(selectedPlayer);
      $('character-overview').innerHTML=`<div class="at-overview-title"><span class="at-selected-icon" aria-hidden="true">${escape(initials(p.name))}</span><div><div class="at-version-label">ИГРОК · #${escape(p.id)} · ${escape(p.country||'Страна не указана')}</div><h2>${escape(p.name)}</h2><p>Все ростеры игрока. Выбери персонажа слева, чтобы сузить составы и его баллы.</p><div class="at-profile-affiliations" aria-label="Аффилиации игрока за весь архив">${global.affiliationCounts.map(a=>`<span class="at-affiliation-tag">${escape(a.name)} · ${a.appearances}</span>`).join('')||'<span class="at-affiliation-empty">Без указанной аффилиации</span>'}</div></div></div><p class="at-score-context">${selectedAffiliations.size?`Баллы в ростерах: <b>${escape([...selectedAffiliations].join(' · '))}</b>`:'Баллы по всем аффилиациям'} · все результаты игрока</p><div class="at-overview-stats at-scored-stats"><div class="at-overview-stat"><strong class="${p.points<0?'at-negative':''}">${points(p.points)}</strong><span>всего баллов</span></div><div class="at-overview-stat"><strong class="${p.average<0?'at-negative':''}">${mean(p.average)}</strong><span title="Для игрока — от 2 оценённых выступлений">сглаж. среднее · оценено: ${p.scoredResults}</span></div><div class="at-overview-stat"><strong>${p.resultsCount}</strong><span>выступлений</span></div><div class="at-overview-stat"><strong>${p.events}</strong><span>событий</span></div><div class="at-overview-stat"><strong>${p.count}</strong><span>вариантов ростера</span></div></div>`;
      return;
    }
    const scope=activeRows(data.rosters);
    const c=index.characters.get(selected),s=core.statistics(index,selected,scope.length,[...selectedAffiliations],selectedPlayer);
    $('character-overview').innerHTML=`<div class="at-overview-top"><div class="at-overview-title"><span class="at-selected-icon" aria-hidden="true">${escape(initials(c.name))}</span><div><div class="at-version-label">${c.grunt?'GRUNT':'ПЕРСОНАЖ'} · ${c.threat??'—'} THREAT</div><h2>${escape(c.name)}</h2><p>${escape(c.alterEgo)}</p>${ownershipTag(c.id)}<button class="at-co-chip" data-action="character" data-slug="${escape((c.inventoryIds||[c.id]).find(id=>owned().has(id))||(c.inventoryIds||[c.id])[0])}" type="button">Карточка и коллекция ↗</button><div class="at-profile-affiliations" aria-label="Аффилиейшены персонажа">${c.affiliations.length?c.affiliations.map(a=>`<span class="at-affiliation-tag">${escape(a)}</span>`).join(''):`<span class="at-affiliation-empty">Не указаны в каталоге</span>`}</div></div></div><button class="at-share-button" type="button" id="at-share-character" aria-label="Скопировать ссылку на персонажа"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 14 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0) scale(.9)"/></svg><span>Ссылка</span></button></div><p class="at-score-context">${selectedAffiliations.size?`Баллы в ростерах: <b>${escape([...selectedAffiliations].join(' · '))}</b>`:'Баллы по всем аффилиациям'}${playerContext()} · все результаты</p><div class="at-overview-stats at-scored-stats"><div class="at-overview-stat at-point-total" title="Сумма баллов за W/L/D, размер поля и место; варианты делят балл"><strong class="${s.points<0?'at-negative':''}">${points(s.points)}</strong><span>всего баллов</span></div><div class="at-overview-stat at-point-average" title="Сумма вкладов / (сумма весов + 1); при менее 4 выступлениях — 0"><strong class="${s.average<0?'at-negative':''}">${mean(s.average)}</strong><span>сглаж. среднее · ${s.scoredResults} ${plural(s.scoredResults,'выступление','выступления','выступлений')}</span></div><div class="at-overview-stat"><strong>${s.count}</strong> <small>${s.share.toFixed(1).replace('.',',')}%</small><span>ростеров в этой выборке</span></div><div class="at-overview-stat"><strong>${s.events}</strong><span>${plural(s.events,'событие','события','событий')}</span></div><div class="at-overview-stat"><strong>${s.players}</strong><span>${plural(s.players,'игрок','игрока','игроков')}</span></div></div>${s.peers.length?`<div class="at-cooccurrence"><span>Часто рядом</span>${s.peers.map(([id,n])=>`<button class="at-co-chip" type="button" data-character="${escape(id)}">${escape(index.characters.get(id).name)}<small>${n}</small></button>`).join('')}</div>`:''}`;
  }
  function record(r){return `<div class="at-record" aria-label="${r.wins} побед, ${r.losses} поражений, ${r.draws} ничьих"><span class="at-win">${r.wins}</span><span class="at-slash">/</span><span class="at-loss">${r.losses}</span><span class="at-slash">/</span><span class="at-draw">${r.draws}</span></div>`;}
  function placement(r){return `<div class="at-placement-line"><span>${r.place===null?'Место не опубликовано':`${r.provisional?'Текущее место':r.resultBasis==='doubles_pair'?'Место пары':'Место'} <b>${r.place} / ${r.fieldSize}</b>`}${r.sharedPlaceCount>1?` · разделено с ${r.sharedPlaceCount-1} ${plural(r.sharedPlaceCount-1,'игроком','игроками','игроками')}`:''}${r.stage==='main'?' · основной этап':''}</span>${r.performancePoints!==null?`<span class="at-points-badge ${r.performancePoints<0?'at-negative':''}">${points(r.performancePoints)} баллов</span>`:`<span class="at-provisional-badge">${r.provisional?'Событие продолжается':'Без итоговых баллов'}</span>`}</div>`;}
  function rosterBody(r){
    const heading=`${r.scoringComponents?`<p class="at-text-note">Баллы: 100 × ${r.scoringComponents.base.toLocaleString('ru-RU',{maximumFractionDigits:2})} за W/L × ${r.scoringComponents.field.toFixed(3)} за размер поля × ${r.scoringComponents.placeFactor.toFixed(3)} за место ≈ ${points(r.performancePoints)}. Ничьи нейтральны; бонус побед ограничен +0,5.</p>`:''}${r.resultBasis==='doubles_pair'?`<p class="at-text-note">Парный турнир: W/L/D и место относятся к паре ${escape(r.teamName||'')}; размер поля — число пар. Показан опубликованный ростер этого участника.</p>`:''}<div class="at-roster-actions"><button type="button" data-tournament-import="${escape(r.id)}">Открыть в моём билдере →</button></div><div class="at-detail-caption"><span>${escape(r.location)} · Лист #${r.listId}</span><a href="${safeUrl(r.eventUrl)}" target="_blank" rel="noopener noreferrer">Открыть турнир ↗</a></div>${r.topCutPlace?`<p class="at-text-note">Плейофф: место ${r.topCutPlace} / ${r.topCutFieldSize}; результат ${r.topCutRecord.wins}/${r.topCutRecord.losses}/${r.topCutRecord.draws}. Баллы этого ростера относятся к основному этапу, соответствующему результату W/L/D в выдаче.</p>`:''}${r.variantCount>1&&r.pointsShare!==null?`<p class="at-text-note">${points(r.performancePoints)} баллов за выступление поделены между ${r.variantCount} вариантами списка: вклад этого варианта — ${points(r.pointsShare)}.</p>`:''}`;
    if(r.kind!=='encoded')return `${heading}<p class="at-text-note">${r.kind==='restricted'?'Содержимое списка недоступно в публичном просмотре.':'Текстовый лист. В поиск включены распознанные имена персонажей; полный оригинал — ниже.'}</p><div class="at-text-characters">${r.characterIds.map(id=>`<button class="at-co-chip" data-character="${escape(id)}" type="button">${escape(index.characters.get(id).name)}</button>${ownershipTag(id)}`).join('')}</div><pre class="at-raw-text">${escape(r.rawText)}</pre>`;
    const characterRows=r.characters.map((c,i)=>{
      const info=index.characters.get(c.id);
      return `<li class="${c.id===selected?'at-selected':''}">${c.id?`<button class="at-roster-character-button" data-character="${escape(c.id)}" type="button">${escape(info.name)}</button><small>${escape(info.alterEgo)}</small><small class="at-roster-character-affiliations">${affiliationNote(info)}</small>`:escape(c.name)}${collection()?`<small class="at-ownership-tag ${availability(r).entries[i].owned?'at-owned':'at-missing'}">${availability(r).entries[i].owned?'✓ Есть у меня':'Нет в коллекции'}</small>`:''}${c.gems.length?`<small class="at-gems">${escape(c.gems.join(' · '))}</small>`:''}</li>`;
    }).join('');
    return `${heading}<div class="at-roster-columns"><div class="at-roster-column"><h4>Персонажи <span>${r.characters.length}</span></h4><ul>${characterRows}</ul></div><div class="at-roster-column"><h4>Team tactics <span>${r.tactics.length}</span></h4><ul>${r.tactics.map(t=>`<li>${escape(t)}</li>`).join('')}</ul></div><div class="at-roster-column"><h4>Crises <span>${r.crises.length}</span></h4><ul>${r.crises.map(t=>`<li>${escape(t)}</li>`).join('')}</ul></div></div>${r.jarvisUrl?`<div class="at-roster-actions"><a href="${safeUrl(r.jarvisUrl)}" target="_blank" rel="noopener noreferrer">Открыть в Jarvis Protocol ↗</a></div>`:''}`;
  }
  function renderRosters(preserve=false){
    const opened=preserve?new Set([...$('roster-list').querySelectorAll('details[open]')].map(d=>d.dataset.roster)):new Set();
    const filtered=!!($('result-search').value||selectedAffiliations.size);
    let rows=core.rosterList(index,(collectionMode||playerMode)?null:selected,$('result-search').value,$('result-sort').value,[...selectedAffiliations],selectedPlayer);
    if(collectionMode)rows=collection()?rows.filter(r=>availability(r).ready):[];
    const sourceRows=collectionMode?(collection()?readyRows():[]):playerMode?data.rosters:(index.byCharacter.get(selected)||[]);
    const total=core.scopeRows(sourceRows,[],selectedPlayer).length;
    $('result-count').textContent=filtered?`${countText(rows.length)} из ${total}`:countText(total);
    $('roster-list').innerHTML=rows.length?rows.slice(0,limit).map(r=>`<details class="at-roster-card" data-roster="${escape(r.id)}"><summary class="at-roster-summary"><span class="at-rank-mark" aria-hidden="true">${r.wins}W</span><div class="at-roster-info"><div class="at-player-line"><h3>${escape(r.player)}</h3>${r.kind==='text'?'<span class="at-text-badge">Текстовый лист</span>':r.kind==='restricted'?'<span class="at-text-badge">Состав недоступен</span>':''}${r.variantCount>1?`<span class="at-variant-badge">Вариант ${r.variant}</span>`:''}</div><div class="at-event-line"><time datetime="${r.date}">${date(r.date)}</time><span class="at-event-name">${escape(r.event)}</span></div><div class="at-roster-affiliations">${r.affiliations.map(a=>`<span class="at-affiliation-tag">${escape(a)}</span>`).join('')}</div>${r.resultBasis==='doubles_pair'?'<span class="at-text-badge">Результат пары</span>':''}${placement(r)}<div class="at-availability-line">${availabilityTag(r)}</div></div>${record(r)}<span class="at-chevron" aria-hidden="true">⌄</span></summary><div class="at-roster-body"></div></details>`).join(''):`<div class="at-empty-state"><strong>${total?'Ростеры не найдены':'Пока нет ростеров в этой выборке'}</strong>${total?'Попробуй другое имя игрока, событие или affiliation.':(selectedPlayer?'У этого игрока нет ростеров с выбранным персонажем. Выбери другого персонажа или нажми «Все ростеры игрока».':'Выбери другого персонажа. В архив входят сыгранные результаты с опубликованными ростерами.')}</div>`;
    $('show-more').hidden=rows.length<=limit;
    $('show-more').textContent=`Показать ещё ${Math.min(20,rows.length-limit)} · осталось ${rows.length-limit}`;
    $('roster-list').querySelectorAll('details').forEach(details=>details.addEventListener('toggle',()=>{
      if(details.open&&!details.dataset.loaded){const r=data.rosters.find(r=>r.id===details.dataset.roster);details.querySelector('.at-roster-body').innerHTML=rosterBody(r);details.dataset.loaded='true';}
    }));
    $('roster-list').querySelectorAll('details').forEach(d=>{if(opened.has(d.dataset.roster))d.open=true;});
    if(collectionMode&&!rows.length)$('roster-list').innerHTML=`<div class="at-empty-state"><strong>${collection()?(filtered?'По выбранным фильтрам ничего не найдено':'Пока нет полных совпадений'):'Подключи свою коллекцию'}</strong>${collection()?(total?'Измени поисковый запрос или сбрось выбранные аффилиации.':'Открой любой ростер персонажа: в составе будет видно, кто есть и кого не хватает.'):'Отметь свои модели в разделе «Моя коллекция».'}</div>`;
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
  window.Tournaments={refresh:updateCollection,activate:updateRoute,boot:()=>{updateCollection();const s=new URLSearchParams(initialRoute.slice(1)).get('screen');if(s==='catalog')showCatalog();else if(s==='mine')showCatalog(true);else if(s==='rosters')showRosterList();else if(s==='battle')showBattleScreen();else showTournaments();}};
})();
