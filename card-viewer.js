'use strict';
const statCardViews=new Map();
const cardSkinPreferenceKey='mcp-companion-card-skin-layers-v1';
function cardSkinLayers(slug){
  try{return JSON.parse(localStorage.getItem(cardSkinPreferenceKey)||'{}')[slug]||{};}catch{return {};}
}
function cardSkinControls(v){
  const skin=MCPCardRenderer.skinFor(v.slug,v.form||0,window.MCP_CARD_SKINS||{});if(!skin)return '';
  const layers=cardSkinLayers(v.slug),available={name:!!skin.name,background:!!skin.background,character:!!skin.character?.[v.side||'front']};
  return `<fieldset class="stat-card-skin-controls"><legend>Оформление · ${esc(skin.label||'Альтернативное')}</legend>${[['name','Название'],['background','Фон'],['character','Изображение']].map(([key,label])=>`<label class="check" ${!available[key]?'title="Альтернативный слой пока не добавлен"':''}><input type="checkbox" data-card-skin-layer="${key}" ${available[key]&&layers[key]!==false?'checked':''} ${!available[key]?'disabled':''}>${label}</label>`).join('')}<button type="button" class="quiet" data-cv="skin-reset">Оригинал</button></fieldset>`;
}
function statCardViewerMarkup(key,slug,detail,form=0,side='front',battle=null,controlsOutside=false){
  const view={key,slug,detail,form,side,battle,controlsOutside};statCardViews.set(key,view);
  return `<section class="stat-card-viewer" data-card-view="${esc(key)}">${statCardViewContent(view)}</section>`;
}
function statCardControlsMarkup(v){
  const card=v.form===1?v.detail?.secondStatCard:v.detail?.statCard,reverseArt=window.MCP_CARD_LAYOUT?.[v.slug]?.[v.form]?.back?.art?.mode==='grunt';
  const formName=c=>c?.frontSide?.nameOverride||c?.name||'Другая форма';
  const control=(action,value,label,selected)=>`<button type="button" data-cv="${action}" data-${action}="${value}" class="${selected?'selected':''}" aria-pressed="${selected}">${esc(label)}</button>`;
  return `<div class="stat-card-controls">${v.detail?.secondStatCard?`<div class="side-switch" role="group" aria-label="Форма персонажа">${control('form',0,formName(v.detail.statCard),v.form===0)}${control('form',1,formName(v.detail.secondStatCard),v.form===1)}</div>`:''}<div class="side-switch" role="group" aria-label="Сторона карточки">${control('side','front',card?.frontSide?.type==='injured'?'Injured · ранен':'Healthy · здоров',v.side==='front')}${card?.backSide||reverseArt?control('side','back',card.backSide?.type==='injured'?'Injured · ранен':'Обратная сторона',v.side==='back'):''}</div>${cardSkinControls(v)}</div>`;
}
function statCardViewContent(v){
  return `${v.controlsOutside?'':statCardControlsMarkup(v)}<div class="stat-card-surface">${MCPCardRenderer.render({...v,character:characters.get(v.slug)||{},art:window.MCP_CARD_ART||{},skinLayers:cardSkinLayers(v.slug)})}</div>`;
}
function fitNativeCards(root=document){
  root.querySelectorAll('.sc-card-stage').forEach(stage=>{
    const card=stage.querySelector('.sc-card'),panel=stage.querySelector('.sc-rules-panel'),content=stage.querySelector('.sc-rules-content');
    if(!card)return;
    const width=Number(stage.dataset.nativeWidth),height=Number(stage.dataset.nativeHeight);
    const surface=stage.closest('.stat-card-surface'),available=surface?.clientWidth||width;
    const scale=Math.min(1,Math.min(1050,Math.max(available,width===1200?900:0))/width);
    stage.style.width=width*scale+'px';stage.style.height=height*scale+'px';card.style.transform=`scale(${scale})`;
    card.style.height=height+'px';
    for(const title of stage.querySelectorAll('.sc-identity h3,.sc-identity p')){
      if(title.classList.contains('sc-name-styled')||title.parentElement.classList.contains('sc-identity-alternative'))continue;
      const start=title.tagName==='H3'?Number(title.dataset.nameFont||35):24;title.style.whiteSpace='normal';title.style.lineHeight=title.tagName==='H3'?start+'px':'24px';title.style.fontSize=start+'px';
      for(let size=start;size>=12&&(title.scrollWidth>title.clientWidth+1||title.scrollHeight>(title.tagName==='H3'?50:26));size--){title.style.fontSize=size+'px';if(title.tagName==='H3')title.style.lineHeight=size+'px';}
    }
    if(!panel||!content)return;
    panel.style.height='';content.style.transform='';content.style.width='100%';content.style.minHeight='0';
    const budget=panel.clientHeight-parseFloat(getComputedStyle(panel).paddingTop)-parseFloat(getComputedStyle(panel).paddingBottom);
    const leading=Number(content.dataset.ruleLeading||20.8);
    content.style.gap='20px';content.style.fontSize='22px';content.style.lineHeight=leading+'px';
    for(const gap of [20,16,12,8,4,0]){content.style.gap=gap+'px';if(content.scrollHeight<=budget+1)break;}
    for(const size of [22,21,20,19,18]){content.style.fontSize=size+'px';content.style.lineHeight=(size*leading/22)+'px';if(content.scrollHeight<=budget+1)break;}
    content.querySelectorAll('.sc-ability-heading h4').forEach(title=>{
      title.style.fontSize='28px';
      for(let size=28;size>=16&&title.scrollWidth>title.clientWidth+1;size--)title.style.fontSize=size+'px';
    });
    // Preserve the original card ratio even for unusually dense rules.
    if(content.scrollHeight>budget+1){
      let low=.4,high=1;
      for(let i=0;i<12;i++){
        const ratio=(low+high)/2;content.style.width=100/ratio+'%';
        if(content.scrollHeight*ratio<=budget)low=ratio;else high=ratio;
      }
      content.style.width=100/low+'%';content.style.transform=`scale(${low})`;
    }
  });
}
let nativeCardFrame=0;
const nativeCardObserved=new Set(),nativeCardResize=new ResizeObserver(()=>scheduleNativeCards());
function scheduleNativeCards(){if(nativeCardFrame)return;nativeCardFrame=requestAnimationFrame(()=>{
  nativeCardFrame=0;
  for(const el of nativeCardObserved)if(!el.isConnected){nativeCardResize.unobserve(el);nativeCardObserved.delete(el);}
  document.querySelectorAll('.stat-card-viewer').forEach(el=>{if(!nativeCardObserved.has(el)){nativeCardObserved.add(el);nativeCardResize.observe(el);}});
  fitNativeCards();
});}
new MutationObserver(scheduleNativeCards).observe(document.documentElement,{childList:true,subtree:true});
addEventListener('resize',scheduleNativeCards);document.fonts?.ready.then(scheduleNativeCards);document.fonts?.addEventListener('loadingdone',scheduleNativeCards);
// An unavailable reverse-side illustration may use the known front illustration.
// Rules, stats and side state always remain those of the selected face.
document.addEventListener('error',event=>{
  const img=event.target;if(!img.matches?.('.sc-art img'))return;
  if(img.dataset.cardFallback){const fallback=img.dataset.cardFallback;delete img.dataset.cardFallback;img.src=fallback;}
  else {img.hidden=true;const frame=img.closest('.sc-art'),status=frame?.querySelector('.sc-art-status');if(status){status.hidden=false;frame.classList.add('sc-art-failed');}}
},true);
function setCardSkinLayers(v,el,values){
  try{const saved=JSON.parse(localStorage.getItem(cardSkinPreferenceKey)||'{}');saved[v.slug]={...cardSkinLayers(v.slug),...values};localStorage.setItem(cardSkinPreferenceKey,JSON.stringify(saved));}catch{return;}
  if(v.key==='battle'&&typeof showBattleFighterPreview==='function'&&battleDialogContext?.type==='fighter'){showBattleFighterPreview(v.form,v.side);return;}
  el.innerHTML=statCardViewContent(v);fitNativeCards(el);
}
document.addEventListener('change',event=>{
  const input=event.target,layer=input.dataset?.cardSkinLayer,el=input.closest?.('[data-card-view]');
  if(!['name','background','character'].includes(layer)||!el)return;
  const v=statCardViews.get(el.dataset.cardView);if(!v)return;
  setCardSkinLayers(v,el,{[layer]:input.checked});
  el.querySelector(`[data-card-skin-layer="${layer}"]`)?.focus({preventScroll:true});
});
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-cv]'),el=button?.closest('[data-card-view]');if(!el||button.disabled)return;
  const v=statCardViews.get(el.dataset.cardView);if(!v)return;
  if(button.dataset.cv==='skin-reset'){setCardSkinLayers(v,el,{name:false,background:false,character:false});return;}
  if(button.dataset.cv==='side')v.side=button.dataset.side;
  else if(button.dataset.cv==='form'){v.form=Number(button.dataset.form);v.side='front';}
  if(v.key==='battle'&&typeof showBattleFighterPreview==='function'&&battleDialogContext?.type==='fighter'){
    showBattleFighterPreview(v.form,v.side);return;
  }
  if(v.key==='catalog'){selectedForm=v.form;selectedSide=v.side==='back'?'injured':'healthy';}
  const action=button.dataset.cv,value=action==='side'?v.side:String(v.form);
  el.innerHTML=statCardViewContent(v);fitNativeCards(el);
  el.querySelector(`[data-cv="${action}"][data-${action}="${value}"]`)?.focus({preventScroll:true});
});
