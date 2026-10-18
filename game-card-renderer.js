/* Native tactics and crisis layouts, using frozen rules and Jarvis presentation metadata. */
(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rule=t=>root.MCPCardRenderer.rule(String(t??'').replace(/\r?\n/g,' '));
 const typeLabel={active:'Active',reactive:'Reactive',active_action:'Active / Action',both:'Active / Reactive',reactive_reactive:'Reactive'};
 let serial=0;
 function defaultData(){return root.MCP_GAME_CARD_DATA||{};}
 function extras(c,kind,data){return data[kind]?.[c.slug]||{};}
 function imageUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='d15s9aja3f2wkq.cloudfront.net'?u.href:'';}catch{return '';}}
 function tokenFor(description,data){
  const types=[['Source','source'],['Zone','zone'],['Point of Interest','poi'],['Target of Opportunity','target'],['Asset','asset'],['Assets','asset'],['Civilian','civilian'],['Civilians','civilian']];
  return data.tokens?.[types.find(([label])=>String(description).includes('('+label+')'))?.[1]]||null;
 }
 function diagram(c,data){
  const points=data.layouts?.[c.setup];if(!Array.isArray(points))return `<div class="gc-map-unavailable">Setup ${esc(c.setup||'—')}</div>`;
  const unit=304/36,sizes={2:3,3:6,4:8,5:10};
  const rulers=(data.rulers?.[c.setup]||[]).map(r=>{
   const h=r.direction==='horizontal',x=r.x*unit-(h?0:6),y=r.y*unit-(h?6:0),w=h?sizes[r.size]*unit:12,hh=h?12:sizes[r.size]*unit,tx=x+w/2,ty=y+hh/2;
   return `<g class="gc-range-ruler"><rect x="${x}" y="${y}" width="${w}" height="${hh}"/><text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" ${h?'':`transform="rotate(90 ${tx} ${ty})"`}>${r.size}⊕</text></g>`;
  }).join('');
  const base=tokenFor(c.setupDescription,data),family=c.cardFamily||c.slug;
  const markers=points.map((p,i)=>{
   let src=base,rotation=0;
   if(family==='research-station-attacked'&&i===1)src=data.tokens?.civilian;
   if(family==='mystic-wakandan-herb-fact-or-fiction'&&(i===1||i===2))src=data.tokens?.asset;
   if(family==='terrigen-clouds-sweep-over-city'&&i===1)src=null;
   if(family==='x-men-infiltrate-secret-weapons-facility')rotation=[315,225,135,45][i]||0;
   const x=p.x*unit,y=p.y*unit;
   return `<g data-objective="${i+1}" transform="translate(${x} ${y}) rotate(${rotation})"><circle r="9" fill="#6c6c6c"/>${src?`<image href="${esc(src)}" x="-9" y="-9" width="18" height="18"/>`:''}</g>`;
  }).join('');
  const special=family==='lockdown-security-systems-stymie-breakout'?[[43.5,100],[66.5,100],[210,100],[210.5,184],[233.5,184]].map(([x,y],i)=>`<image href="${esc(data.lockdownIcons?.[i]||'')}" x="${x}" y="${y}" width="20" height="20"/>`).join(''):'';
  return `<svg class="gc-map" viewBox="0 0 304 304" role="img" aria-label="Расстановка ${esc(c.setup)}: ${points.length} жетонов" data-setup="${esc(c.setup)}"><image href="${esc(data.assets?.board||'')}" width="304" height="304"/>${rulers}${markers}${special}<rect x="1" y="1" width="302" height="302" rx="10" class="gc-map-border"/></svg>`;
 }
 function blocks(c,visual,side){
  const face=side==='front'?'front':'back';
  const attacks=(c.attacks||visual.attacks||[]).filter(a=>!a.form||a.form==='normal'||a.form===face);
  const powers=(c.superPowers||visual.superPowers||[]).filter(p=>!p.form||p.form===face);
  return {attacks:attacks.map(a=>root.MCPCardRenderer.attack(a)).join(''),powers:powers.map(p=>root.MCPCardRenderer.power(p)).join('')};
 }
 function tactic(c,visual,side,data){
  const playSide=side==='front'||visual.doubleSided,parts=blocks(c,visual,side),art=imageUrl(visual.artUrl),affiliation=c.affiliation?.name||'Unaffiliated';
  const group=(label,text)=>text?`<div class="gc-tactic-rule-group">${label?`<h3>${esc(label)}</h3>`:''}<div class="gc-tactic-text">${rule(text)}</div></div>`:'';
  let rules='';
  if(visual.doubleSided)rules=group(typeLabel[c.type],side==='front'?c.body:c.secondaryBody);
  else if(c.type==='both'||c.type==='reactive_reactive')rules=group(c.type==='both'?'Active':'Reactive',c.body)+group('Reactive',c.secondaryBody);
  else rules=group(typeLabel[c.type]||c.type,c.body)+(c.intermediaryBody?`<div class="gc-tactic-text gc-intermediary">${rule(c.intermediaryBody)}</div>`:'')+(c.secondaryBody?group(visual.repeatType?typeLabel[c.type]:'',c.secondaryBody):'');
  return `<article class="gc-card gc-tactic ${playSide?'gc-rules-face':'gc-art-face'} ${visual.squished?'gc-squished':''}" lang="en" aria-label="${esc(c.name)} · ${playSide?'Rules':'Artwork'}">${art?`<img class="gc-tactic-art" src="${esc(art)}" data-game-art alt="">`:''}<div class="gc-tactic-title"><h2>${esc(c.name)}</h2></div>${playSide?`<div class="gc-tactic-art-space">${parts.attacks}</div><div class="gc-tactic-content">${c.threatLevel!=null?`<div class="gc-gem-threat">${root.MCPCardRenderer.icon('badge-threat',true)}<b>${esc(c.threatLevel)}</b></div>`:`<h3 class="gc-affiliation">${esc(affiliation)}</h3>`}${rules}${parts.powers}</div><div class="gc-tactic-bottom-space"></div><footer class="gc-tactic-credit"><span>© MARVEL © AMG</span><span>${esc(visual.artist||'')}</span>${data.symbols?.[c.setSymbol]?`<img src="${esc(data.symbols[c.setSymbol])}" alt="${esc(c.setSymbol)}">`:''}</footer>`:''}</article>`;
 }
 function threat(c){
  const id='gc-threat-'+(++serial),label=c.type==='Secure'?'SECURE':'EXTRACTION';
  return `<svg class="gc-threat" viewBox="0 0 72 72" role="img" aria-label="Threat ${esc(c.threatLevel)} · ${label}"><defs><path id="${id}" d="M36 5a31 31 0 1 1-.01 0"/></defs><circle cx="36" cy="36" r="34" class="gc-threat-ring"/><circle cx="36" cy="36" r="22" fill="#fff"/><text class="gc-threat-ring-text"><textPath href="#${id}" textLength="190" lengthAdjust="spacing">THREAT ${label} THREAT ${label}</textPath></text><text x="36" y="37" class="gc-threat-number" text-anchor="middle" dominant-baseline="central">${esc(c.threatLevel)}</text></svg>`;
 }
 function crisis(c,visual,side,data){
  const legacy=visual.template==='2019',secure=c.type==='Secure',width=legacy?384:459,height=legacy?640:750;
  const back=data.assets?.[(secure?'backSecure':'backExtraction')+(legacy?'2019':'2023')];
  if(side==='back')return `<article class="gc-card gc-crisis ${legacy?'gc-crisis-legacy':''}" style="width:${width}px;height:${height}px" aria-label="${esc(c.name)} · Back"><img class="gc-crisis-back" src="${esc(back||'')}" alt="${secure?'Secure':'Extraction'} crisis card back"></article>`;
  return `<article class="gc-card gc-crisis ${legacy?'gc-crisis-legacy':''}" style="width:${width}px;height:${height}px" lang="en" aria-label="${esc(c.name)}"><img class="gc-crisis-paper" src="${esc(data.assets?.[secure?'crisisSecure':'crisisExtraction']||'')}" alt=""><div class="gc-crisis-content">${legacy?`<div class="gc-newspaper"><span>DAILY</span>${threat(c)}<span>BUGLE</span></div><h2 class="gc-crisis-title">${esc(c.name)}</h2>`:`<header class="gc-crisis-heading">${threat(c)}<h2 class="gc-crisis-title">${esc(c.name)}</h2></header>`}<div class="gc-crisis-rules"><div class="gc-setup-scoring"><section><h3>SETUP</h3><div>${rule(c.setupDescription)}</div></section><section><h3>SCORING</h3><div>${rule(c.scoringDescription)}</div></section></div><div class="gc-crisis-paragraphs">${(c.paragraphs||[]).filter(p=>p!=='.').map(p=>`<p>${rule(p)}</p>`).join('')}${(c.attacks||visual.attacks||[]).map(a=>root.MCPCardRenderer.attack(a)).join('')}</div></div><div class="gc-crisis-space"></div>${legacy?'':diagram(c,data)}<footer class="gc-crisis-credit"><span>© MARVEL © AMG</span>${data.symbols?.[c.setSymbol]?`<img src="${esc(data.symbols[c.setSymbol])}" alt="${esc(c.setSymbol)}">`:''}</footer></div></article>`;
 }
 function render(c,kind,{side='front',data=defaultData(),cornerAction=''}={}){
  const visual=extras(c,kind,data),legacy=kind==='crises'&&visual.template==='2019',width=kind==='tactics'?446:legacy?384:459,height=kind==='tactics'?640:legacy?640:750;
  return `<div class="gc-stage" data-game-width="${width}" data-game-height="${height}" data-game-kind="${kind}">${kind==='tactics'?tactic(c,visual,side,data):crisis(c,visual,side,data)}${cornerAction}</div>`;
 }
 const api={render,diagram,imageUrl,typeLabel};root.MCPGameCardRenderer=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
