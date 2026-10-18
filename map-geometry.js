'use strict';

const MapGeometry=(()=>{
  // Jarvis Mission Previewer: 8.4444 units per inch, token radius 4.2222.
  const SIZE=36,DEPLOYMENT=6,OBJECTIVE_DIAMETER_MM=25.4;
  const palette={secure:'#7c3aed',extract:'#d97706',researcher:'#0d9488',evac:'#ea580c',herb:'#16a34a',vessel:'#4f46e5',cloud:'#db2777',zone:'#7c3aed',mine:'#0891b2',opponent:'#e11d48',pin:'#0284c7'};
  const roleNames={secure:'Secure',extract:'Extract',researcher:'Researcher',evac:'Evac Point',herb:'Herb',vessel:'Vessel',cloud:'Terrigen Cloud',zone:'Zone',mine:'Мой боец',opponent:'Противник',pin:'Доп. точка'};
  const opposite={north:'south',south:'north',east:'west',west:'east'};
  function missionPoints(card,kind,layouts){
    if(!card)return [];
    const coords=layouts[card.setup];if(!coords)return [];
    const name=String(card.setupDescription||'').match(/\|<[^>]+>([^|]+)\|/)?.[1]||card.shortName||card.name;
    const family=card.cardFamily||card.slug;
    return coords.flatMap((p,i)=>{
      if(kind==='secure'&&family==='terrigen-clouds-sweep-over-city'&&i===1)return [];
      let role=kind,label=name;
      if(family==='research-station-attacked'){role=i===1?'researcher':'evac';label=roleNames[role];}
      if(family==='mystic-wakandan-herb-fact-or-fiction'){role=i===1||i===2?'vessel':'herb';label=roleNames[role];}
      if(family==='terrigen-clouds-sweep-over-city'){role='cloud';label=roleNames[role];}
      if(/\(Zone\)/.test(card.setupDescription||''))role='zone';
      return [{id:kind+':'+card.slug+':'+i,code:(kind==='secure'?'S':'E')+(i+1),name:label,kind:'objective',role,color:palette[role],x:p.x,y:p.y,radius:OBJECTIVE_DIAMETER_MM/25.4/2,mission:card.name}];
    });
  }
  function points(match,layouts,catalog){
    const state=match.map||{},positions=state.positions||{};
    const goals=[...missionPoints(match.secure,'secure',layouts),...missionPoints(match.extract,'extract',layouts)].map(p=>({...p,x:state.objectives?.[p.id]?.x??p.x,y:state.objectives?.[p.id]?.y??p.y}));
    const fighters=['mine','opponent'].flatMap(side=>match[side].fighters.filter(f=>f.status!=='ko'&&positions[f.id]).map(f=>{
      const c=catalog.get(f.slug),base=Number(f.form===1?c?.secondFormBaseSize:c?.baseSize),p=positions[f.id];
      return {id:'fighter:'+f.id,fighterId:f.id,slug:f.slug,code:f.name,name:f.name,kind:'fighter',role:side,color:palette[side],x:p.x,y:p.y,radius:Number.isFinite(base)?base/25.4/2:0,baseSize:base||null};
    }));
    return [...goals,...fighters,...(state.pins||[]).map(p=>({...p,kind:'pin',role:'pin',color:palette.pin,radius:OBJECTIVE_DIAMETER_MM/25.4/2}))];
  }
  function distance(a,b,mode='centers'){const center=Math.hypot(a.x-b.x,a.y-b.y);return mode==='bases'?Math.max(0,center-(a.radius||0)-(b.radius||0)):center;}
  function segment(a,b,mode='centers'){
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(mode!=='bases'||!len)return {a,b};
    if(len<=(a.radius||0)+(b.radius||0)){const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};return {a:mid,b:mid};}
    return {a:{x:a.x+dx/len*(a.radius||0),y:a.y+dy/len*(a.radius||0)},b:{x:b.x-dx/len*(b.radius||0),y:b.y-dy/len*(b.radius||0)}};
  }
  function edgeDistance(p,edge,mode='centers'){
    const n={north:p.y,south:SIZE-p.y,west:p.x,east:SIZE-p.x}[edge];
    return Math.max(0,n-(mode==='bases'?p.radius||0:0));
  }
  function zoneDistance(p,edge,mode='centers'){return Math.max(0,edgeDistance(p,edge,mode)-DEPLOYMENT);}
  function zone(edge){return {north:{x:0,y:0,w:36,h:6},south:{x:0,y:30,w:36,h:6},west:{x:0,y:0,w:6,h:36},east:{x:30,y:0,w:6,h:36}}[edge];}
  function references(point,myEdge,mode='centers'){
    const edges={north:{x:point.x,y:0},south:{x:point.x,y:36},west:{x:0,y:point.y},east:{x:36,y:point.y}};
    const targets=Object.entries(edges).map(([edge,target])=>({kind:'edge',edge,target,distance:edgeDistance(point,edge,mode)}));
    for(const side of ['mine','opponent']){
      const edge=side==='mine'?myEdge:opposite[myEdge],rect=zone(edge);
      const target={x:Math.max(rect.x,Math.min(rect.x+rect.w,point.x)),y:Math.max(rect.y,Math.min(rect.y+rect.h,point.y))};
      targets.push({kind:'zone',side,edge,target,distance:zoneDistance(point,edge,mode)});
    }
    return targets;
  }
  function validate(state){
    if(state===undefined)return;
    const fail=()=>{throw new Error('Некорректная расстановка на карте.');};
    const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=36&&p.y>=0&&p.y<=36;
    if(!state||typeof state!=='object'||Array.isArray(state)||!['north','south','east','west'].includes(state.edge))fail();
    for(const field of ['positions','objectives']){if(!state[field]||typeof state[field]!=='object'||Array.isArray(state[field])||Object.values(state[field]).some(p=>!point(p)))fail();}
    const ids=new Set();if(!Array.isArray(state.pins))fail();
    for(const p of state.pins){if(!point(p)||typeof p.id!=='string'||typeof p.name!=='string'||ids.has(p.id))fail();ids.add(p.id);}
  }
  return {SIZE,DEPLOYMENT,OBJECTIVE_DIAMETER_MM,palette,roleNames,opposite,missionPoints,points,distance,segment,edgeDistance,zoneDistance,zone,references,validate};
})();
if(typeof module!=='undefined')module.exports=MapGeometry;
