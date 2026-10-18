'use strict';
let gameCardView=null;
function showNativeGameCard(c,kind,metadata=''){
  gameCardView={card:c,kind,metadata,side:'front'};renderNativeGameCard();
  const dialog=document.getElementById('game-card-dialog');if(!dialog.open)dialog.showModal();fitNativeGameCards();
}
function renderNativeGameCard(){
  const {card:c,kind,metadata,side}=gameCardView;
  const source='https://www.jarvis-protocol.com/'+(kind==='tactics'?'team-tactics-cards/':'crisis-cards/')+(kind==='tactics'?c.cardFamily:c.slug);
  document.getElementById('game-card-content').innerHTML=`<header class="gc-dialog-head"><div><strong>${esc(c.name)}</strong>${metadata?`<small>${esc(metadata)}</small>`:''}</div><button type="button" class="quiet close" data-rs="close-card" aria-label="Закрыть игровую карту">×</button></header><div class="gc-dialog-body"><div class="gc-controls side-switch" role="group" aria-label="Сторона игровой карты"><button type="button" data-game-side="front" aria-pressed="${side==='front'}" class="${side==='front'?'selected':''}">Лицевая сторона</button><button type="button" data-game-side="back" aria-pressed="${side==='back'}" class="${side==='back'?'selected':''}">Обратная сторона</button></div><div class="gc-surface">${MCPGameCardRenderer.render(c,kind,{side})}</div><div class="source-line"><a href="${esc(source)}" target="_blank" rel="noopener">Карта на Jarvis ↗</a></div></div>`;
}
function fitNativeGameCards(root=document){
 root.querySelectorAll('.gc-stage').forEach(stage=>{
  const card=stage.querySelector('.gc-card');if(!card)return;
  const width=Number(stage.dataset.gameWidth),height=Number(stage.dataset.gameHeight),available=stage.closest('.gc-surface')?.clientWidth||width;
  const heightLimit=stage.closest('.battle-tactic-card')?1:Math.max(240,innerHeight-155)/height;
  const scale=Math.min(1,available/width,heightLimit);stage.style.width=width*scale+'px';stage.style.height=height*scale+'px';card.style.transform=`scale(${scale})`;
  const title=card.querySelector('.gc-tactic-title h2,.gc-crisis-heading h2');
  if(title){const base=stage.dataset.gameKind==='crises'?28:30,maxHeight=stage.dataset.gameKind==='crises'?69:58;title.style.fontSize=base+'px';for(let size=base;size>=18&&(title.scrollHeight>maxHeight||title.scrollWidth>title.clientWidth+1);size--)title.style.fontSize=size+'px';}
  const text=card.querySelector('.gc-tactic-content,.gc-crisis-rules');if(!text)return;
  const initial=stage.dataset.gameKind==='tactics'?(card.classList.contains('gc-squished')?18:20):16;
  text.style.fontSize=initial+'px';text.style.lineHeight=initial*1.04+'px';
  const overflows=()=>{const bounds=card.getBoundingClientRect();return [...card.querySelectorAll('h2,h3,.gc-tactic-text,.gc-setup-scoring,.gc-crisis-paragraphs,.sc-ability,.gc-map,footer')].some(el=>el.getBoundingClientRect().bottom>bounds.bottom+1);};
  for(let size=initial;size>=12&&overflows();size--){text.style.fontSize=size+'px';text.style.lineHeight=size*1.04+'px';}
 });
}
let gameCardFrame=0;
function scheduleGameCards(){if(gameCardFrame)return;gameCardFrame=requestAnimationFrame(()=>{gameCardFrame=0;fitNativeGameCards();});}
new MutationObserver(scheduleGameCards).observe(document.documentElement,{childList:true,subtree:true});
addEventListener('resize',scheduleGameCards);document.fonts?.addEventListener('loadingdone',scheduleGameCards);
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-game-side]');if(!button||!gameCardView)return;
 gameCardView.side=button.dataset.gameSide;renderNativeGameCard();fitNativeGameCards();
 document.querySelector(`[data-game-side="${gameCardView.side}"]`)?.focus({preventScroll:true});
});
document.addEventListener('error',event=>{
 const img=event.target;if(!img.matches?.('[data-game-art]'))return;
 if(!img.dataset.gameFallback){img.dataset.gameFallback='true';img.src='assets/game-cards/question-mark.png';}else img.hidden=true;
},true);
