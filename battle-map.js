'use strict';

let battleMapData={layouts:{}},battleMapError='',mapDrag=null,mapSkipClick=false;
let mapUI={match:null,selected:'',distanceMode:'objects',unit:'in',mode:'bases',lines:true,zoom:1};
function mapZoneLabel(side){const own=typeof window==='undefined'||!window.NetworkBattle?.active()?side==='mine':NetworkBattle.ownSide()===side;return own?'Моя зона':'Зона противника';}
const mapEdgeNames={north:'Сверху',south:'Снизу',west:'Слева',east:'Справа'};
const mapPixels=p=>({x:40+p.x*10,y:40+p.y*10});
const mapNumber=value=>Number(value.toFixed(2));
function mapDistanceText(n){return (mapUI.unit==='cm'?n*2.54:n).toLocaleString('ru-RU',{maximumFractionDigits:2})+(mapUI.unit==='cm'?' см':'″');}
function mapPointName(p){return p.kind==='objective'?p.code+' · '+p.name:p.name;}
function mapState(match){return match.map||{edge:'south',positions:{},objectives:{},pins:[]};}
function ensureMapState(match){if(!match.map)match.map={edge:'south',positions:{},objectives:{},pins:[]};return match.map;}
async function initBattleMapData(){
  try{const response=await fetch('data/map-layouts.json');if(!response.ok)throw new Error('Не загрузились схемы кризисов.');battleMapData=await response.json();}
  catch(error){battleMapError=error.message;}
}
function resetMapUI(match){if(mapUI.match!==match.id){mapUI={match:match.id,selected:'',distanceMode:'objects',unit:'in',mode:'bases',lines:true,zoom:1};}}
function openBattleMap(){if(!currentMatch())return;resetMapUI(currentMatch());battleView='map';renderBattle();window.scrollTo(0,0);}
function mapAllPoints(match){return MapGeometry.points(match,battleMapData.layouts,characters).filter(p=>p.kind!=='fighter');}
function selectedMapPoint(points){return points.find(p=>p.id===mapUI.selected)||points.find(p=>p.kind==='objective');}
function mapGridMarkup(){
  return Array.from({length:37},(_,n)=>`<path d="M${40+n*10} 40V400 M40 ${40+n*10}H400" stroke="${n%6?'#e7edf4':'#cbd5e1'}" stroke-width="${n%6?'.6':'1.1'}"/>${n%6?'':`<text x="${40+n*10}" y="28" text-anchor="middle" class="map-axis">${n}″</text><text x="27" y="${44+n*10}" text-anchor="end" class="map-axis">${n}″</text>`}`).join('');
}
function mapZoneMarkup(edge,side){
  const z=MapGeometry.zone(edge),x=40+z.x*10,y=40+z.y*10;
  const label=mapZoneLabel(side);
  return `<g class="map-zone"><rect x="${x}" y="${y}" width="${z.w*10}" height="${z.h*10}" fill="${MapGeometry.palette[side]}" fill-opacity=".09" stroke="${MapGeometry.palette[side]}" stroke-width="1.8" stroke-dasharray="${side==='mine'?'':'5 4'}"/><text x="${x+z.w*5}" y="${y+z.h*5}" fill="${MapGeometry.palette[side]}" text-anchor="middle" class="map-zone-label" ${['east','west'].includes(edge)?`transform="rotate(-90 ${x+z.w*5} ${y+z.h*5})"`:''}>${label} · 6″</text></g>`;
}
function mapPointMarkup(group,selected){
  const p=group.find(p=>p.id===selected?.id)||group[0],v=mapPixels(p),chosen=group.some(p=>p.id===selected?.id);
  const title=group.map(mapPointName).join(' / '),code=group.map(p=>p.kind==='objective'?p.code:p.name).join(' / ');
  let shape='';
  const radius=Math.max(4,(p.radius||0)*10),glyphRadius=Math.min(3,radius);
  shape=group.map((item,i)=>{
    const r=glyphRadius-i*.5;
    return item.role==='extract'||['herb','evac'].includes(item.role)?`<path d="M0 ${-r}L${r} 0L0 ${r}L${-r} 0Z" fill="${item.color}" fill-opacity=".14" stroke="${item.color}" stroke-width="2.5"/>`:`<circle r="${r}" fill="${item.color}" fill-opacity=".14" stroke="${item.color}" stroke-width="2.5"/>`;
  }).join('');
  return `<g transform="translate(${v.x} ${v.y})" data-map-key="${esc(p.id)}" role="button" tabindex="0" aria-label="${esc('Точка '+title)}" class="map-point ${chosen?'map-point-selected':''}"><title>${esc(title)}</title><circle r="23" fill="transparent"/>${chosen?'<circle r="17" fill="none" stroke="#0f172a" stroke-width="1.6" stroke-dasharray="3 2"/>':''}${p.radius?`<circle r="${radius}" fill="${p.color}" fill-opacity=".12" stroke="${p.color}" stroke-width="1.3"/>`:""}${shape}<text y="25" text-anchor="middle" class="map-point-label">${esc(code)}</text></g>`;
}
function mapReferenceMarkup(match,selected){
  if(!selected||!mapUI.lines||mapUI.distanceMode!=='boundaries')return '';
  const origin=mapPixels(selected),arrows={north:'↑',south:'↓',west:'←',east:'→'};
  return MapGeometry.references(selected,mapState(match).edge,mapUI.mode).map(ref=>{
    const color=ref.kind==='zone'?MapGeometry.palette[ref.side]:'#64748b',ends=MapGeometry.segment(selected,{...ref.target,radius:0},mapUI.mode),a=mapPixels(ends.a),b=mapPixels(ends.b),target=mapPixels(ref.target);
    const text=ref.kind==='edge'?arrows[ref.edge]+' '+mapDistanceText(ref.distance):mapZoneLabel(ref.side)+' · '+mapDistanceText(ref.distance);
    const width=Math.max(45,text.length*5.5+12);let x=target.x,y=target.y;
    if(ref.kind==='edge'){
      if(ref.edge==='north')y=49;else if(ref.edge==='south')y=391;else if(ref.edge==='west')x=40+width/2;else x=400-width/2;
    }else if(['north','south'].includes(ref.edge)){x=origin.x+width/2+8;y=target.y+(ref.edge==='north'?10:-10);}
    else{x=target.x+(ref.edge==='west'?width/2+8:-width/2-8);y=origin.y+25;}
    x=Math.max(41+width/2,Math.min(399-width/2,x));y=Math.max(49,Math.min(391,y));
    return `<g class="map-reference-line"><path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="${color}" stroke-width="${ref.kind==='zone'?1.8:1}" stroke-dasharray="${ref.kind==='zone'?'5 3':'2 4'}"/><rect x="${x-width/2}" y="${y-9}" width="${width}" height="18" rx="4" fill="white" fill-opacity=".97" stroke="${color}" stroke-width=".7"/><text x="${x}" y="${y+3}" text-anchor="middle" fill="${color}" class="map-reference-label">${esc(text)}</text></g>`;
  }).join('');
}
function mapSvg(match,points,selected){
  const edge=mapState(match).edge,other=MapGeometry.opposite[edge],groups=[];
  for(const p of points){const group=groups.find(g=>Math.abs(g[0].x-p.x)<.01&&Math.abs(g[0].y-p.y)<.01);if(group&&p.kind==='objective'&&group[0].kind==='objective')group.push(p);else groups.push([p]);}
  let lines='';
  if(mapUI.lines&&selected&&mapUI.distanceMode==='objects'){
    const seen=new Set();
    lines=points.filter(p=>p.id!==selected.id).map(p=>{
      const d=MapGeometry.distance(selected,p,mapUI.mode),signature=p.x+':'+p.y;if(!d||seen.has(signature))return '';seen.add(signature);
      const ends=MapGeometry.segment(selected,p,mapUI.mode),a=mapPixels(ends.a),b=mapPixels(ends.b),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
      return `<g class="map-distance-line"><path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="#0284c7" stroke-width="1.1" stroke-dasharray="4 3"/><rect x="${mx-22}" y="${my-8}" width="44" height="16" rx="4" fill="white" fill-opacity=".94"/><text x="${mx}" y="${my+3}" text-anchor="middle" class="map-distance-label">${esc(mapDistanceText(d))}</text></g>`;
    }).join('');
  }
  return `<svg id="battle-map-svg" viewBox="0 0 440 440" style="width:${100*mapUI.zoom}%;max-width:${mapUI.zoom===1?'min(100%,65dvh)':'none'}" role="img" aria-label="Карта боя 36 на 36 дюймов, точки миссий и стартовые зоны"><rect x="40" y="40" width="360" height="360" rx="2" fill="#fff"/>${mapGridMarkup()}${mapZoneMarkup(edge,'mine')}${mapZoneMarkup(other,'opponent')}${lines}${mapReferenceMarkup(match,selected)}<rect x="40" y="40" width="360" height="360" fill="none" stroke="#475569" stroke-width="2"/>${groups.map(group=>mapPointMarkup(group,selected)).join('')}<text x="220" y="428" text-anchor="middle" class="map-axis">36″ × 36″ · 91,44 × 91,44 см</text></svg>`;
}
function mapDistancesPanel(match,points,selected){
  if(!selected)return '<div class="empty"><h3>Выберите точку на карте</h3><p>Выберите объект или добавьте дополнительную точку на карте.</p></div>';
  const others=points.filter(p=>p.id!==selected.id),edge=mapState(match).edge,readonly=match.status==='finished',factor=mapUI.unit==='cm'?2.54:1;
  return `<div class="map-origin-heading"><span class="eyebrow">От выбранной точки</span><h2>${esc(mapPointName(selected))}</h2></div><p class="map-size-note">Диаметр точки · 1″</p>${mapUI.distanceMode==='boundaries'?`<section class="map-reference-summary"><h3>До краёв поля</h3><div class="map-edge-cards">${[['west','Слева'],['east','Справа'],['north','Сверху'],['south','Снизу']].map(([key,label])=>`<div><span>${label}</span><b>${mapDistanceText(MapGeometry.edgeDistance(selected,key,mapUI.mode))}</b></div>`).join('')}</div><h3>До стартовых зон</h3><div class="map-zone-cards"><div class="mine"><span>${mapZoneLabel('mine')}</span><b>${mapDistanceText(MapGeometry.zoneDistance(selected,edge,mapUI.mode))}</b></div><div class="opponent"><span>${mapZoneLabel('opponent')}</span><b>${mapDistanceText(MapGeometry.zoneDistance(selected,MapGeometry.opposite[edge],mapUI.mode))}</b></div></div></section>`:`<h3>До объектов</h3><div class="map-distance-table">${others.map(p=>`<button data-ma="select" data-key="${esc(p.id)}"><span><i class="map-dot" style="background:${p.color}"></i>${esc(mapPointName(p))}</span><b>${mapDistanceText(MapGeometry.distance(selected,p,mapUI.mode))}</b></button>`).join('')}</div>`}<details class="map-coordinate-editor"><summary>Задать координаты точки</summary><div class="map-coordinates"><label class="field">X от левого края<input id="map-x" type="number" min="0" max="${36*factor}" step=".01" value="${mapNumber(selected.x*factor)}" ${readonly?'disabled':''}></label><label class="field">Y от верхнего края<input id="map-y" type="number" min="0" max="${36*factor}" step=".01" value="${mapNumber(selected.y*factor)}" ${readonly?'disabled':''}></label><small>Координаты в ${mapUI.unit==='cm'?'сантиметрах':'дюймах'}</small>${!readonly?'<button class="primary" data-ma="apply-coords">Применить координаты</button>':''}</div></details>${!readonly?`<div class="actions map-point-actions">${selected.kind==='objective'?'<button data-ma="reset-point">Вернуть цель на старт</button>':'<button data-ma="rename-pin">Название точки</button><button data-ma="remove-pin">Убрать точку</button>'}</div>`:''}`;
}
function mapMatrix(points){
  if(points.length<2)return '<p class="muted">Добавьте как минимум две точки.</p>';
  const title=p=>p.kind==='objective'?p.code:p.name;
  return `<div class="map-matrix-scroll"><table class="map-matrix"><thead><tr><th></th>${points.map(p=>`<th><button data-ma="select" data-key="${esc(p.id)}">${esc(title(p))}</button></th>`).join('')}</tr></thead><tbody>${points.map(a=>`<tr><th>${esc(title(a))}</th>${points.map(b=>`<td>${a.id===b.id?'—':mapDistanceText(MapGeometry.distance(a,b,mapUI.mode))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderBattleMap(match){
  resetMapUI(match);const readonly=match.status==='finished',points=mapAllPoints(match),selected=selectedMapPoint(points),state=mapState(match);
  const roles=[...new Set(points.map(p=>p.role))];
  return `${typeof window!=='undefined'&&window.NetworkBattle?.active()?NetworkBattle.header():''}<div class="heading"><div><span class="eyebrow">12 / Карта боя</span><h1>Карта и расстояния</h1><p>${esc(match.name)} · объекты и расстояния.</p></div><div class="actions"><button data-bt="undo" ${readonly||!battleCanUndo(match)?'disabled':''}>↶ Отмена</button><button data-ma="back">← ${match.status==='preparing'?'К подготовке':'В бой'}</button></div></div><div class="map-missions">${[['secure','Secure'],['extract','Extract']].map(([kind,name])=>`<div class="map-mission" data-kind="${kind}"><span class="eyebrow">${name}</span>${match[kind]?`<button class="quiet" data-bt="mission-card" data-kind="${kind}">${esc(match[kind].name)} ↗</button><small>Схема ${esc(match[kind].setup)}</small>`:'<span class="muted">Не выбрана</span>'}${!readonly?`<button data-bt="missions" data-kind="${kind}">${match[kind]?'Заменить':'Выбрать миссию'}</button>`:''}</div>`).join('')}</div>${battleMapError?`<div class="notice">${esc(battleMapError)} Точки миссий не построены.</div>`:''}${[match.secure,match.extract].filter(c=>c&&!battleMapData.layouts[c.setup]).map(c=>`<div class="notice">Для ${esc(c.name)} не найдена схема ${esc(c.setup)}.</div>`).join('')}<div class="map-toolbar"><div class="map-mode-bar"><div class="map-tools" role="tablist" aria-label="Режим расстояний">${[['objects','До объектов'],['boundaries','До краёв и стартовых зон']].map(([mode,label])=>`<button role="tab" data-ma="distance-mode" data-distance-mode="${mode}" aria-selected="${mapUI.distanceMode===mode}" class="${mapUI.distanceMode===mode?'selected':''}">${label}</button>`).join('')}</div>${mapUI.distanceMode==='objects'?`<button data-ma="add-point" ${readonly?'disabled':''}>+ Дополнительная точка</button>`:''}</div><div class="map-settings"><label>${typeof window!=='undefined'&&window.NetworkBattle?.active()?'Край '+esc(match.mine.name):'Мой край'}<select id="map-edge" ${readonly?'disabled':''}>${Object.entries(mapEdgeNames).map(([key,name])=>`<option value="${key}" ${state.edge===key?'selected':''}>${name}</option>`).join('')}</select></label><label>Измерять<select id="map-mode"><option value="bases" ${mapUI.mode==='bases'?'selected':''}>От краёв баз</option><option value="centers" ${mapUI.mode==='centers'?'selected':''}>Между центрами</option></select></label><label>Единицы<select id="map-unit"><option value="in" ${mapUI.unit==='in'?'selected':''}>Дюймы</option><option value="cm" ${mapUI.unit==='cm'?'selected':''}>Сантиметры</option></select></label><label class="check"><input id="map-lines" type="checkbox" ${mapUI.lines?'checked':''}>Расстояния на карте</label></div></div><p class="map-instruction">Выберите или перетащите точку. Дополнительная метка удаляется клавишей Backspace, когда выделена.</p><div class="battle-map-layout"><section class="map-canvas-section"><div class="map-canvas-scroll">${mapSvg(match,points,selected)}</div><div class="map-legend">${roles.map(role=>`<span><i class="map-dot" style="background:${MapGeometry.palette[role]}"></i>${MapGeometry.roleNames[role]}</span>`).join('')}<span><i class="map-dot" style="background:#0891b2"></i>${mapZoneLabel('mine')}</span><span><i class="map-dot" style="background:#e11d48"></i>${mapZoneLabel('opponent')}</span></div>${mapUI.distanceMode==='boundaries'?`<p class="map-zone-gap">Между стартовыми зонами: <b>${mapDistanceText(24)}</b></p>`:''}<div class="map-zoom"><button data-ma="zoom-out" aria-label="Уменьшить карту">−</button><span>${Math.round(mapUI.zoom*100)}%</span><button data-ma="zoom-in" aria-label="Увеличить карту">+</button><button data-ma="zoom-reset">Вписать</button></div><p class="battle-rule-note">36″ × 36″. Стартовая полоса — 6″ от края; при расстановке измеряют от края базы модели. Все точки имеют диаметр 1″. Координаты задают их центр. «От краёв баз» учитывает их размер; «Между центрами» — нет. Расстояния — по прямой.</p></section><aside class="map-details"><label class="field">Точка отсчёта<select id="map-origin"><option value="">Выбрать точку…</option>${points.map(p=>`<option value="${esc(p.id)}" ${selected?.id===p.id?'selected':''}>${esc(mapPointName(p))}</option>`).join('')}</select></label>${mapDistancesPanel(match,points,selected)}</aside></div>${mapUI.distanceMode==='objects'?`<details class="map-all-distances"><summary>Все расстояния между точками · ${points.length}</summary>${mapMatrix(points)}</details>`:''}<div class="source-line"><a href="https://www.jarvis-protocol.com/mission-previewer" target="_blank" rel="noopener">Раскладки · Jarvis Protocol ↗</a><a href="https://www.atomicmassgames.com/mcp-rules/" target="_blank" rel="noopener">Правила расстановки · AMG ↗</a></div>`;
}
function pointFromMapEvent(event,svg){
  const rect=svg.getBoundingClientRect();return {x:mapNumber(Math.max(0,Math.min(36,((event.clientX-rect.left)/rect.width*440-40)/10))),y:mapNumber(Math.max(0,Math.min(36,((event.clientY-rect.top)/rect.height*440-40)/10)))};
}
function moveMapPoint(id,position){
  const m=currentMatch(),p=mapAllPoints(m).find(p=>p.id===id);if(!p)return;
  if(m.status==='finished')return;
  editMatch('Карта: перемещена '+mapPointName(p),next=>{
    const state=ensureMapState(next);
    if(p.kind==='objective')state.objectives[p.id]=position;
    else Object.assign(state.pins.find(t=>t.id===p.id),position);
  });
}
function addMapPoint(){
  const m=currentMatch();if(!m||m.status==='finished'||mapUI.distanceMode!=='objects')return false;
  const id='pin:'+crypto.randomUUID(),names=new Set(mapState(m).pins.map(p=>p.name));let n=1;
  while(names.has('Доп. точка '+n))n++;
  const count=mapState(m).pins.length,position={x:Math.min(30,18+(count%4)*2),y:Math.min(30,18+Math.floor(count/4)%4*2)};
  if(editMatch('Карта: дополнительная точка добавлена',next=>ensureMapState(next).pins.push({id,name:'Доп. точка '+n,...position}))){mapUI.selected=id;renderBattle();return true;}
  return false;
}
function removeMapPoint(id){
  const m=currentMatch(),point=m&&mapAllPoints(m).find(p=>p.id===id);
  if(!point||point.kind!=='pin'||m.status==='finished')return false;
  if(editMatch('Карта: удалена '+point.name,next=>{const state=ensureMapState(next);state.pins=state.pins.filter(p=>p.id!==id);})){mapUI.selected='';renderBattle();return true;}
  return false;
}
function mapCanvasClick(event){
  const svg=event.target.closest('#battle-map-svg');if(!svg||screen!=='battle'||battleView!=='map'||mapSkipClick)return;
  const match=currentMatch(),points=mapAllPoints(match),target=event.target.closest('[data-map-key]'),point=target?points.find(p=>p.id===target.dataset.mapKey):null;
  if(point){mapUI.selected=point.id;renderBattle();}
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-ma]');if(!button){mapCanvasClick(event);return;}
  if(button.disabled)return;const d=button.dataset,m=currentMatch();if(!m)return;
  if(d.ma==='back'){battleView=m.status==='preparing'?'setup':'play';renderBattle();window.scrollTo(0,0);}
  else if(d.ma==='distance-mode'){mapUI.distanceMode=d.distanceMode;renderBattle();}
  else if(d.ma==='add-point')addMapPoint();
  else if(d.ma==='select'){mapUI.selected=d.key;renderBattle();}
  else if(d.ma==='zoom-in'||d.ma==='zoom-out'){mapUI.zoom=Math.max(1,Math.min(3,mapUI.zoom+(d.ma==='zoom-in'?.5:-.5)));renderBattle();}
  else if(d.ma==='zoom-reset'){mapUI.zoom=1;renderBattle();}
  else if(d.ma==='apply-coords'){
    const p=selectedMapPoint(mapAllPoints(m)),factor=mapUI.unit==='cm'?2.54:1,x=Number($('#map-x').value)/factor,y=Number($('#map-y').value)/factor;
    if(!p)return;
    if($('#map-x').value===''||$('#map-y').value===''||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>36||y>36){toast('Координаты должны находиться внутри поля 36″ × 36″.');return;}
    moveMapPoint(p.id,{x:mapNumber(x),y:mapNumber(y)});
  }
  else{
    const p=selectedMapPoint(mapAllPoints(m));if(!p||m.status==='finished')return;
    if(d.ma==='reset-point')editMatch('Карта: восстановлена цель '+p.code,next=>delete ensureMapState(next).objectives[p.id]);
    else if(d.ma==='remove-pin')removeMapPoint(p.id);
    else if(d.ma==='rename-pin')battleDialog('Название точки','Точка на карте для ваших измерений.',`<form id="map-pin-form" data-key="${esc(p.id)}"><label class="field">Название<input name="name" value="${esc(p.name)}" required maxlength="50"></label><button class="primary" type="submit">Сохранить название</button></form>`);
  }
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='map-edge')editMatch('Карта: выбран мой край',next=>ensureMapState(next).edge=el.value);
  else if(el.id==='map-unit'){mapUI.unit=el.value;renderBattle();}
  else if(el.id==='map-mode'){mapUI.mode=el.value;renderBattle();}
  else if(el.id==='map-lines'){mapUI.lines=el.checked;renderBattle();}
  else if(el.id==='map-origin'){mapUI.selected=el.value;renderBattle();}

});
document.addEventListener('submit',event=>{
  if(event.target.id!=='map-pin-form')return;event.preventDefault();const id=event.target.dataset.key,name=String(new FormData(event.target).get('name')||'').trim();if(!name)return;
  if(editMatch('Карта: название метки изменено',next=>ensureMapState(next).pins.find(p=>p.id===id).name=name))$('#battle-dialog').close();
});
document.addEventListener('keydown',event=>{
  if(screen!=='battle'||battleView!=='map')return;
  if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')||document.querySelector('dialog[open]'))return;
  if(event.key==='Backspace'){
    event.preventDefault();
    const m=currentMatch(),selected=m&&mapAllPoints(m).find(p=>p.id===mapUI.selected);
    if(selected?.kind==='pin')removeMapPoint(selected.id);
    return;
  }
  const target=event.target.closest('[data-map-key]');if(!target||!['Enter',' '].includes(event.key))return;event.preventDefault();mapUI.selected=target.dataset.mapKey;renderBattle();
});
document.addEventListener('pointerdown',event=>{
  const target=event.target.closest('#battle-map-svg [data-map-key]');if(!target||event.button!==0)return;
  const m=currentMatch(),p=mapAllPoints(m).find(p=>p.id===target.dataset.mapKey);if(!p||m.status==='finished')return;
  const svg=$('#battle-map-svg');mapDrag={id:p.id,start:{x:p.x,y:p.y},pointer:pointFromMapEvent(event,svg),client:{x:event.clientX,y:event.clientY},preview:null,svg,pointerId:event.pointerId};svg.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove',event=>{
  if(!mapDrag||event.pointerId!==mapDrag.pointerId)return;
  if(Math.hypot(event.clientX-mapDrag.client.x,event.clientY-mapDrag.client.y)<4&&!mapDrag.preview)return;
  const p=pointFromMapEvent(event,mapDrag.svg);mapDrag.preview={x:mapNumber(Math.max(0,Math.min(36,mapDrag.start.x+p.x-mapDrag.pointer.x))),y:mapNumber(Math.max(0,Math.min(36,mapDrag.start.y+p.y-mapDrag.pointer.y)))};
  const node=mapDrag.svg.querySelector(`[data-map-key="${CSS.escape(mapDrag.id)}"]`),v=mapPixels(mapDrag.preview);if(node)node.setAttribute('transform',`translate(${v.x} ${v.y})`);
});
document.addEventListener('pointerup',event=>{
  if(!mapDrag||event.pointerId!==mapDrag.pointerId)return;const drag=mapDrag;mapDrag=null;
  if(drag.preview){mapSkipClick=true;setTimeout(()=>mapSkipClick=false,0);mapUI.selected=drag.id;moveMapPoint(drag.id,drag.preview);}
  else{mapUI.selected=drag.id;renderBattle();}
});
document.addEventListener('pointercancel',()=>{if(mapDrag){mapDrag=null;renderBattle();}});
