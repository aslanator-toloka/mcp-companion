'use strict';
let boxSetData={sets:[]},boxSets=new Map(),boxSetLoadError='',selectedBoxSet=null,purchaseTab='wishlist',purchaseQuery='';
function wishlistCodes(value=state.wishlist){return [...new Set(value||[])];}
function purchasedCodes(value=state.purchasedSets){return [...new Set(value||[])];}
let boxCharacterCache=new Map(),cachedBoxSets=null;
function boxCharacterSlugs(codes){
  if(cachedBoxSets!==boxSets){boxCharacterCache.clear();cachedBoxSets=boxSets;}
  const key=JSON.stringify([...codes].sort());if(!boxCharacterCache.has(key))boxCharacterCache.set(key,new Set(codes.flatMap(code=>(boxSets.get(code)?.characters||[]).map(c=>c.slug))));
  return boxCharacterCache.get(key);
}
function boxPurchased(code){return purchasedCodes().includes(code);}
function isBoxOwned(slug){return boxCharacterSlugs(purchasedCodes()).has(slug);}
function purchaseCollectionData(value){
  const purchasedSets=purchasedCodes(value.purchasedSets||[]),manuallyOwned=[...new Set(value.manuallyOwned??value.owned??[])];
  const owned=[...new Set([...manuallyOwned,...[...boxCharacterSlugs(purchasedSets)].filter(slug=>characters.has(slug))])];
  return {owned,manuallyOwned,purchasedSets};
}
function characterCollectionStatus(slugs,ownedOverride){
  const ids=Array.isArray(slugs)?slugs:[slugs];
  if(ownedOverride??ids.some(slug=>isOwned(slug)||isBoxOwned(slug)))return {kind:'owned',label:'Есть у меня'};
  if(ids.some(slug=>boxCharacterSlugs(wishlistCodes()).has(slug)))return {kind:'planned',label:'Запланирован'};
  return {kind:'missing',label:'Нет в коллекции'};
}
function collectionStatusMarkup(slug){const s=characterCollectionStatus(slug);return `<span class="character-collection-status is-${s.kind}">${esc(s.label)}</span>`;}
function validatePurchaseFields(data){
  validateWishlist(data.wishlist);validateWishlist(data.purchasedSets);
  if(data.manuallyOwned!==undefined&&(!Array.isArray(data.manuallyOwned)||data.manuallyOwned.length>2000||data.manuallyOwned.some(slug=>!characters.has(slug))))throw Error('Не удалось прочитать отметки коллекции.');
}
function togglePurchasedBox(code){
  if(!boxSets.has(code)&&!boxPurchased(code))return false;
  const previous=state,bought=boxPurchased(code),next={...state,purchasedSets:bought?purchasedCodes().filter(c=>c!==code):[...purchasedCodes(),code]};
  if(!bought)next.wishlist=wishlistCodes().filter(c=>c!==code);
  state=dataOnly(next);if(!persist()){state=previous;return false;}return true;
}
function validateWishlist(value){
  if(value!==undefined&&(!Array.isArray(value)||value.length>2000||value.some(code=>typeof code!=='string'||!/^[A-Z0-9]{1,32}$/.test(code))))throw new Error('Не удалось прочитать запланированные покупки.');
}
async function initBoxSetData(){
  try{const r=await fetch('data/box-sets.json');if(!r.ok)throw Error('Не удалось загрузить каталог наборов.');boxSetData=await r.json();boxSets=new Map(boxSetData.sets.map(s=>[s.code,s]));boxSetLoadError='';}
  catch(error){boxSetLoadError=error.message;boxSetData={sets:[...new Set(catalog.characters.flatMap(c=>c.boxSets||[]))].sort().map(code=>({code,name:code,characters:catalog.characters.filter(c=>c.boxSets?.includes(code)).map(c=>({slug:c.slug,name:c.name,amount:1})),image:null}))};boxSets=new Map(boxSetData.sets.map(s=>[s.code,s]));}
}
function planned(code){return !boxPurchased(code)&&wishlistCodes().includes(code);}
function wishlistButton(set){const yes=planned(set.code),bought=boxPurchased(set.code);return `<button type="button" class="purchase-wishlist-button${yes?' is-planned':''}" data-wishlist-code="${esc(set.code)}" ${bought?'disabled title="Набор уже куплен"':''} aria-pressed="${yes}" aria-label="${yes?'Убрать из запланированных покупок':'Добавить в запланированные покупки'}: ${esc(set.name)}">${yes?'★ В планах':'☆ Запланировать'}</button>`;}
function purchasedBoxButton(set){const yes=boxPurchased(set.code);return `<button type="button" class="purchase-bought-button${yes?' is-purchased':''}" data-purchased-code="${esc(set.code)}" aria-pressed="${yes}" aria-label="${yes?'Снять отметку купленного набора':'Отметить набор купленным'}: ${esc(set.name)}">${yes?'✓ Куплен':'Отметить купленным'}</button>`;}
function boxSetActions(set){return `<div class="box-set-actions">${wishlistButton(set)}${purchasedBoxButton(set)}</div>`;}
function boxSetImage(set,large=false){return set.image?`<img class="box-set-image${large?' large':''}" src="${esc(set.image)}" alt="Коробка ${esc(set.name)} · ${esc(set.code)}" ${large?'':'loading="lazy"'} decoding="async">`:'<span class="box-set-image-placeholder">Изображение набора недоступно</span>';}
function boxCharacterSummary(set){if(set.missing)return 'Нет данных о составе набора';return (set.characters||[]).map(c=>c.name+(c.amount>1?' ×'+c.amount:'')).join(' · ')||'Без миниатюр персонажей';}
function boxSetTile(set,compact=false){return `<article class="box-set-tile${compact?' compact':''}" data-box-set="${esc(set.code)}"><button class="box-set-open" type="button" data-box-code="${esc(set.code)}" aria-label="Посмотреть набор ${esc(set.code)}"><div class="box-set-cover">${boxSetImage(set)}</div><div class="box-set-copy"><small>${esc(set.code)}</small><strong>${esc(set.name)}</strong><p>${esc(boxCharacterSummary(set))}</p></div><span class="box-set-arrow" aria-hidden="true">↗</span></button>${boxSetActions(set)}</article>`;}
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
  const all=purchaseTab==='all'?boxSetData.sets:(purchaseTab==='purchased'?purchasedCodes():wishlistCodes()).map(code=>boxSets.get(code)||{code,name:'Набор '+code,characters:[],image:null,missing:true});
  const terms=searchWords(purchaseQuery);
  return all.filter(s=>{const words=searchWords(s.code+' '+s.name+' '+boxCharacterSummary(s));return terms.every(t=>words.some(w=>w.startsWith(t)));}).sort((a,b)=>a.name.localeCompare(b.name,'en')||a.code.localeCompare(b.code));
}
function renderPurchases(){
  const rows=purchaseRows(),count=wishlistCodes().length;
  $('#purchases-screen').innerHTML=`<div class="heading"><div><span class="eyebrow">09 / Вишлист наборов</span><h1>Запланированные покупки</h1><p>Наборы, которые хочется добавить в коллекцию.</p></div><span class="purchase-count">${count} в планах</span></div><div class="purchase-toolbar"><div class="purchase-tabs" role="group" aria-label="Список наборов"><button type="button" data-purchase-tab="wishlist" aria-pressed="${purchaseTab==='wishlist'}" class="${purchaseTab==='wishlist'?'selected':''}">Мой вишлист · ${count}</button><button type="button" data-purchase-tab="purchased" aria-pressed="${purchaseTab==='purchased'}" class="${purchaseTab==='purchased'?'selected':''}">Купленные · ${purchasedCodes().length}</button><button type="button" data-purchase-tab="all" aria-pressed="${purchaseTab==='all'}" class="${purchaseTab==='all'?'selected':''}">Все наборы · ${boxSetData.sets.length}</button></div><label class="purchase-search"><span class="sr-only">Поиск наборов</span><input id="purchase-search" type="search" value="${esc(purchaseQuery)}" placeholder="Название, код набора или персонаж…"></label></div>${boxSetLoadError?`<p class="notice">${esc(boxSetLoadError)} <button type="button" data-box-retry>Повторить</button></p>`:''}<p class="purchase-results-count" role="status">Найдено: ${rows.length}</p>${rows.length?`<div class="purchase-grid">${rows.map(s=>boxSetTile(s)).join('')}</div>`:`<div class="empty purchase-empty"><h3>${purchaseQuery?'Ничего не найдено':purchaseTab==='purchased'?'Пока нет купленных наборов':'Пока нет запланированных покупок'}</h3><p>${purchaseQuery?'Попробуйте другое название, код или имя персонажа.':'Отмечайте наборы в карточках персонажей или откройте весь каталог наборов.'}</p>${purchaseQuery?'':'<button type="button" class="primary" data-purchase-tab="all">Выбрать наборы →</button>'}</div>`}`;
  updatePurchaseBadge();
}
function updatePurchaseBadge(){const badge=$('#purchase-nav-count');if(badge){badge.textContent=wishlistCodes().length;badge.hidden=!wishlistCodes().length;}}
function renderBoxSetDetail(){
  const set=boxSets.get(selectedBoxSet)||{code:selectedBoxSet,name:'Набор '+selectedBoxSet,characters:[],image:null,missing:true};
  $('#box-set-content').innerHTML=`<div class="dialog-heading"><div><span class="eyebrow">${esc(set.code)}</span><h2>${esc(set.name)}</h2></div><button type="button" class="quiet close" data-box-close aria-label="Закрыть набор">×</button></div><div class="box-set-detail"><div class="box-set-detail-cover">${boxSetImage(set,true)}${boxSetActions(set)}</div><section class="box-set-members"><h3>Персонажи в наборе</h3>${set.characters.length?set.characters.map(c=>{const known=characters.get(c.slug),body=`${known?avatar(known):'<span class="box-set-member-placeholder">◇</span>'}<span><strong>${esc(c.name)}${c.amount>1?' ×'+c.amount:''}</strong>${known?`<small>${esc(known.alterEgo||'')} · ${collectionStatusMarkup(c.slug)}</small>`:`<small>Карточки этой версии пока нет в каталоге · ${collectionStatusMarkup(c.slug)}</small>`}</span>${known?'<span aria-hidden="true">↗</span>':''}`;return known?`<button type="button" class="box-set-member" data-action="catalog-character" data-slug="${esc(c.slug)}">${body}</button>`:`<div class="box-set-member">${body}</div>`;}).join(''):`<p class="muted">${set.missing?'Нет данных о составе набора.':'В этом наборе нет миниатюр персонажей.'}</p>`}</section></div><p class="purchase-data-note">Состав набора — из каталога Jarvis. «Куплен» отмечает всех персонажей набора в коллекции.</p>`;
}
function openBoxSet(code){if(!boxSets.has(code)&&!planned(code)&&!boxPurchased(code))return;selectedBoxSet=code;renderBoxSetDetail();if(!$('#box-set-dialog').open)$('#box-set-dialog').showModal();}
function refreshPurchases(){
  updatePurchaseBadge();
  for(const b of document.querySelectorAll('[data-wishlist-code]')){const yes=planned(b.dataset.wishlistCode),set=boxSets.get(b.dataset.wishlistCode);b.disabled=boxPurchased(b.dataset.wishlistCode);b.classList.toggle('is-planned',yes);b.setAttribute('aria-pressed',String(yes));b.setAttribute('aria-label',`${yes?'Убрать из запланированных покупок':'Добавить в запланированные покупки'}: ${set?.name||b.dataset.wishlistCode}`);b.textContent=yes?'★ В планах':'☆ Запланировать';}
  if(screen==='purchases')renderPurchases();
  if($('#box-set-dialog').open)renderBoxSetDetail();
}
document.addEventListener('click',async event=>{
  const bought=event.target.closest('[data-purchased-code]');
  if(bought){const code=bought.dataset.purchasedCode;if(!togglePurchasedBox(code))return;renderList();refreshRosters();if(selectedSlug&&$('#character-dialog').open){const scroll=$('#character-dialog').scrollTop;renderCharacter();$('#character-dialog').scrollTop=scroll;}refreshPurchases();document.querySelector(`#box-set-dialog[open] [data-purchased-code="${CSS.escape(code)}"]`)?.focus({preventScroll:true});return;}
  const wish=event.target.closest('[data-wishlist-code]');
  if(wish){const code=wish.dataset.wishlistCode;if(boxPurchased(code))return;if(!boxSets.has(code)&&!planned(code))return;const previous=state.wishlist;state.wishlist=planned(code)?wishlistCodes().filter(x=>x!==code):[...wishlistCodes(),code];if(!persist()){state.wishlist=previous;return;}refreshPurchases();refreshRosters();const focus=document.querySelector(`#box-set-dialog[open] [data-wishlist-code="${CSS.escape(code)}"]`)||(wish.isConnected?wish:$('#purchase-search'));focus?.focus({preventScroll:true});return;}
  const box=event.target.closest('[data-box-code]');if(box){openBoxSet(box.dataset.boxCode);return;}
  if(event.target.closest('[data-box-close]')){$('#box-set-dialog').close();return;}
  const tab=event.target.closest('[data-purchase-tab]');if(tab){purchaseTab=tab.dataset.purchaseTab;purchaseQuery='';renderPurchases();return;}
  if(event.target.closest('[data-box-retry]')){await initBoxSetData();refreshPurchases();if(selectedSlug)renderCharacter();}
});
document.addEventListener('input',event=>{if(event.target.id==='purchase-search'){purchaseQuery=event.target.value;const start=event.target.selectionStart;renderPurchases();const input=$('#purchase-search');input.focus();if(start!==null)try{input.setSelectionRange(start,start);}catch{}}});
document.addEventListener('error',event=>{if(event.target.matches?.('.box-set-image')){const label=document.createElement('span');label.className='box-set-image-placeholder';label.textContent='Изображение набора недоступно';event.target.replaceWith(label);}},true);
$('#box-set-dialog').addEventListener('close',()=>{if(!$('#box-set-dialog').open)selectedBoxSet=null;});
