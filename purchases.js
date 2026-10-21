'use strict';
let boxSetData={sets:[]},boxSets=new Map(),boxSetLoadError='',selectedBoxSet=null,purchaseTab='wishlist',purchaseQuery='';
function wishlistCodes(value=state.wishlist){return [...new Set(value||[])];}
function validateWishlist(value){
  if(value!==undefined&&(!Array.isArray(value)||value.length>2000||value.some(code=>typeof code!=='string'||!/^[A-Z0-9]{1,32}$/.test(code))))throw new Error('Не удалось прочитать запланированные покупки.');
}
async function initBoxSetData(){
  try{const r=await fetch('data/box-sets.json');if(!r.ok)throw Error('Не удалось загрузить каталог наборов.');boxSetData=await r.json();boxSets=new Map(boxSetData.sets.map(s=>[s.code,s]));boxSetLoadError='';}
  catch(error){boxSetLoadError=error.message;boxSetData={sets:[...new Set(catalog.characters.flatMap(c=>c.boxSets||[]))].sort().map(code=>({code,name:code,characters:catalog.characters.filter(c=>c.boxSets?.includes(code)).map(c=>({slug:c.slug,name:c.name,amount:1})),image:null}))};boxSets=new Map(boxSetData.sets.map(s=>[s.code,s]));}
}
function planned(code){return wishlistCodes().includes(code);}
function wishlistButton(set){const yes=planned(set.code);return `<button type="button" class="purchase-wishlist-button${yes?' is-planned':''}" data-wishlist-code="${esc(set.code)}" aria-pressed="${yes}" aria-label="${yes?'Убрать из запланированных покупок':'Добавить в запланированные покупки'}: ${esc(set.name)}">${yes?'★ В планах':'☆ Запланировать'}</button>`;}
function boxSetImage(set,large=false){return set.image?`<img class="box-set-image${large?' large':''}" src="${esc(set.image)}" alt="Коробка ${esc(set.name)} · ${esc(set.code)}" ${large?'':'loading="lazy"'} decoding="async">`:'<span class="box-set-image-placeholder">Изображение набора недоступно</span>';}
function boxCharacterSummary(set){if(set.missing)return 'Нет данных о составе набора';return (set.characters||[]).map(c=>c.name+(c.amount>1?' ×'+c.amount:'')).join(' · ')||'Без миниатюр персонажей';}
function boxSetTile(set,compact=false){return `<article class="box-set-tile${compact?' compact':''}" data-box-set="${esc(set.code)}"><button class="box-set-open" type="button" data-box-code="${esc(set.code)}" aria-label="Посмотреть набор ${esc(set.code)}"><div class="box-set-cover">${boxSetImage(set)}</div><div class="box-set-copy"><small>${esc(set.code)}</small><strong>${esc(set.name)}</strong><p>${esc(boxCharacterSummary(set))}</p></div><span class="box-set-arrow" aria-hidden="true">↗</span></button>${wishlistButton(set)}</article>`;}
function characterBoxSetsMarkup(c){
  const sets=(c.boxSets||[]).map(code=>boxSets.get(code)).filter(Boolean);
  return `<section class="detail-section character-box-sets"><div class="section-title"><h3>В каких наборах</h3><button class="quiet" type="button" data-action="purchases">Запланированные покупки →</button></div>${boxSetLoadError?`<p class="purchase-data-note">${esc(boxSetLoadError)}</p>`:''}${sets.length?`<div class="character-box-set-list">${sets.map(s=>boxSetTile(s,true)).join('')}</div>`:'<p class="muted">В каталоге пока нет информации о наборах этого персонажа.</p>'}</section>`;
}
function openCatalogCharacter(slug){
  if(!initialized||!characters.has(slug)){toast('Этой версии персонажа пока нет в каталоге.');return;}
  requestLeave(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();showCatalog(false);$('#search').value=characters.get(slug).name;renderList();openCharacter(slug);});
}
function showPurchases(){
  screen='purchases';rosterDraft=null;
  for(const id of ['catalog-screen','rosters-screen','battle-screen','tournaments-screen'])$('#'+id).hidden=true;
  $('#purchases-screen').hidden=false;renderPurchases();updateNavigation();window.scrollTo(0,0);
}
function navigatePurchases(){requestLeave(()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();showPurchases();});}
function purchaseRows(){
  const all=purchaseTab==='all'?boxSetData.sets:wishlistCodes().map(code=>boxSets.get(code)||{code,name:'Набор '+code,characters:[],image:null,missing:true});
  const terms=searchWords(purchaseQuery);
  return all.filter(s=>{const words=searchWords(s.code+' '+s.name+' '+boxCharacterSummary(s));return terms.every(t=>words.some(w=>w.startsWith(t)));}).sort((a,b)=>a.name.localeCompare(b.name,'en')||a.code.localeCompare(b.code));
}
function renderPurchases(){
  const rows=purchaseRows(),count=wishlistCodes().length;
  $('#purchases-screen').innerHTML=`<div class="heading"><div><span class="eyebrow">09 / Вишлист наборов</span><h1>Запланированные покупки</h1><p>Наборы, которые хочется добавить в коллекцию.</p></div><span class="purchase-count">${count} в планах</span></div><div class="purchase-toolbar"><div class="purchase-tabs" role="group" aria-label="Список наборов"><button type="button" data-purchase-tab="wishlist" aria-pressed="${purchaseTab==='wishlist'}" class="${purchaseTab==='wishlist'?'selected':''}">Мой вишлист · ${count}</button><button type="button" data-purchase-tab="all" aria-pressed="${purchaseTab==='all'}" class="${purchaseTab==='all'?'selected':''}">Все наборы · ${boxSetData.sets.length}</button></div><label class="purchase-search"><span class="sr-only">Поиск наборов</span><input id="purchase-search" type="search" value="${esc(purchaseQuery)}" placeholder="Название, код набора или персонаж…"></label></div>${boxSetLoadError?`<p class="notice">${esc(boxSetLoadError)} <button type="button" data-box-retry>Повторить</button></p>`:''}<p class="purchase-results-count" role="status">Найдено: ${rows.length}</p>${rows.length?`<div class="purchase-grid">${rows.map(s=>boxSetTile(s)).join('')}</div>`:`<div class="empty purchase-empty"><h3>${purchaseQuery?'Ничего не найдено':'Пока нет запланированных покупок'}</h3><p>${purchaseQuery?'Попробуйте другое название, код или имя персонажа.':'Отмечайте наборы в карточках персонажей или откройте весь каталог наборов.'}</p>${purchaseQuery?'':'<button type="button" class="primary" data-purchase-tab="all">Выбрать наборы →</button>'}</div>`}`;
  updatePurchaseBadge();
}
function updatePurchaseBadge(){const badge=$('#purchase-nav-count');if(badge){badge.textContent=wishlistCodes().length;badge.hidden=!wishlistCodes().length;}}
function renderBoxSetDetail(){
  const set=boxSets.get(selectedBoxSet)||{code:selectedBoxSet,name:'Набор '+selectedBoxSet,characters:[],image:null,missing:true};
  $('#box-set-content').innerHTML=`<div class="dialog-heading"><div><span class="eyebrow">${esc(set.code)}</span><h2>${esc(set.name)}</h2></div><button type="button" class="quiet close" data-box-close aria-label="Закрыть набор">×</button></div><div class="box-set-detail"><div class="box-set-detail-cover">${boxSetImage(set,true)}${wishlistButton(set)}</div><section class="box-set-members"><h3>Персонажи в наборе</h3>${set.characters.length?set.characters.map(c=>{const known=characters.get(c.slug),body=`${known?avatar(known):'<span class="box-set-member-placeholder">◇</span>'}<span><strong>${esc(c.name)}${c.amount>1?' ×'+c.amount:''}</strong>${known?`<small>${esc(known.alterEgo||'')} · ${isOwned(c.slug)?'✓ Есть у меня':'Нет в коллекции'}</small>`:'<small>Карточки этой версии пока нет в каталоге</small>'}</span>${known?'<span aria-hidden="true">↗</span>':''}`;return known?`<button type="button" class="box-set-member" data-action="catalog-character" data-slug="${esc(c.slug)}">${body}</button>`:`<div class="box-set-member">${body}</div>`;}).join(''):`<p class="muted">${set.missing?'Нет данных о составе набора.':'В этом наборе нет миниатюр персонажей.'}</p>`}</section></div><p class="purchase-data-note">Состав набора — из каталога Jarvis. Добавление в планы не отмечает персонажей как имеющихся.</p>`;
}
function openBoxSet(code){if(!boxSets.has(code)&&!planned(code))return;selectedBoxSet=code;renderBoxSetDetail();if(!$('#box-set-dialog').open)$('#box-set-dialog').showModal();}
function refreshPurchases(){
  updatePurchaseBadge();
  for(const b of document.querySelectorAll('[data-wishlist-code]')){const yes=planned(b.dataset.wishlistCode),set=boxSets.get(b.dataset.wishlistCode);b.classList.toggle('is-planned',yes);b.setAttribute('aria-pressed',String(yes));b.setAttribute('aria-label',`${yes?'Убрать из запланированных покупок':'Добавить в запланированные покупки'}: ${set?.name||b.dataset.wishlistCode}`);b.textContent=yes?'★ В планах':'☆ Запланировать';}
  if(screen==='purchases')renderPurchases();
}
document.addEventListener('click',async event=>{
  const wish=event.target.closest('[data-wishlist-code]');
  if(wish){const code=wish.dataset.wishlistCode;if(!boxSets.has(code)&&!planned(code))return;const previous=state.wishlist;state.wishlist=planned(code)?wishlistCodes().filter(x=>x!==code):[...wishlistCodes(),code];if(!persist()){state.wishlist=previous;return;}refreshPurchases();if(wish.isConnected)wish.focus({preventScroll:true});else $('#purchase-search')?.focus({preventScroll:true});return;}
  const box=event.target.closest('[data-box-code]');if(box){openBoxSet(box.dataset.boxCode);return;}
  if(event.target.closest('[data-box-close]')){$('#box-set-dialog').close();return;}
  const tab=event.target.closest('[data-purchase-tab]');if(tab){purchaseTab=tab.dataset.purchaseTab;purchaseQuery='';renderPurchases();return;}
  if(event.target.closest('[data-box-retry]')){await initBoxSetData();refreshPurchases();if(selectedSlug)renderCharacter();}
});
document.addEventListener('input',event=>{if(event.target.id==='purchase-search'){purchaseQuery=event.target.value;const start=event.target.selectionStart;renderPurchases();const input=$('#purchase-search');input.focus();if(start!==null)try{input.setSelectionRange(start,start);}catch{}}});
document.addEventListener('error',event=>{if(event.target.matches?.('.box-set-image')){const label=document.createElement('span');label.className='box-set-image-placeholder';label.textContent='Изображение набора недоступно';event.target.replaceWith(label);}},true);
$('#box-set-dialog').addEventListener('close',()=>{if(!$('#box-set-dialog').open)selectedBoxSet=null;});
