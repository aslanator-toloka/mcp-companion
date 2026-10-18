(function(root){
  'use strict';
  const normalize = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-zа-яё0-9]/g,'');
  const scoring=Object.freeze({version:'signed-wld-5pct-v1',winBonus:.05,bonusCap:.5,fieldReference:16,placeInfluence:.25,priorWeight:1,minAppearances:4,scale:100});
  const playerMinAppearances=2;
  function performanceScore(r){
    const {wins:w,losses:l,draws:d=0,fieldSize:n,place:k,sharedPlaceCount:t=1}=r;
    if(r.provisional||![w,l,d,n,k,t].every(Number.isFinite)||![w,l,d,n,k,t].every(Number.isInteger)||w<0||l<0||d<0||w+l+d===0||n<1||k<1||t<1||k+t-1>n)return null;
    const base=w-l+Math.min(scoring.winBonus*w,scoring.bonusCap);
    const field=Math.sqrt(Math.log2(Math.max(2,n))/Math.log2(scoring.fieldReference));
    const midpoint=k+(t-1)/2;
    const position=n===1?0:(n+1-2*midpoint)/(n-1);
    const placeFactor=1+scoring.placeInfluence*Math.sign(base)*position;
    return {base,field,midpoint,position,placeFactor,points:scoring.scale*base*field*placeFactor};
  }
  function scoreData(data){
    const totals=new Map(data.characters.map(c=>[c.id,0]));
    const rosters=data.rosters.map(r=>{
      const parts=performanceScore(r),value=parts?.points??null;
      const pointsShare=value===null?null:value/r.variantCount;
      new Set(r.characterIds).forEach(id=>{if(totals.has(id)&&pointsShare!==null)totals.set(id,totals.get(id)+pointsShare);});
      return {...r,placementPoints:r.placementPoints??r.performancePoints,performancePoints:value,pointsShare,scoringComponents:parts};
    });
    return {...data,meta:{...data.meta,scoring:{...scoring}},characters:data.characters.map(c=>({...c,points:totals.get(c.id)})),rosters};
  }
  function createIndex(data){
    const characters = new Map(data.characters.map(c=>[c.id,c]));
    const byCharacter = new Map(data.characters.map(c=>[c.id,[]]));
    const byPlayer = new Map();
    const playerMetadata = new Map((data.players||[]).map(p=>[String(p.id),p]));
    data.rosters.forEach(r=>new Set(r.characterIds).forEach(id=>{if(byCharacter.has(id))byCharacter.get(id).push(r);}));
    data.rosters.forEach(r=>{if(r.playerId==null)return;const id=String(r.playerId);if(!byPlayer.has(id))byPlayer.set(id,[]);byPlayer.get(id).push(r);});
    return {characters,byCharacter,byPlayer,playerMetadata,rosters:data.rosters};
  }
  function affiliationRows(rows,affiliation=[]){
    const selected=new Set(Array.isArray(affiliation)?affiliation:(affiliation?[affiliation]:[]));
    return rows.filter(r=>!selected.size||r.affiliations.some(a=>selected.has(a))||(selected.has('__none__')&&!r.affiliations.length));
  }
  function scopeRows(rows,affiliation=[],playerId=null){
    return affiliationRows(rows,affiliation).filter(r=>playerId===null||String(r.playerId)===String(playerId));
  }
  function playerStats(index,playerId,affiliation=[]){
    const history=index.byPlayer.get(String(playerId));
    if(!history)return null;
    const rows=affiliationRows(history,affiliation),affiliations=new Map();
    rows.forEach(r=>new Set(r.affiliations).forEach(name=>{
      if(!affiliations.has(name))affiliations.set(name,new Set());
      affiliations.get(name).add(r.eventId+':'+r.playerId);
    }));
    const affiliationCounts=[...affiliations].map(([name,events])=>({name,appearances:events.size})).sort((a,b)=>b.appearances-a.appearances||a.name.localeCompare(b.name));
    const latest=history.reduce((a,b)=>b.date>a.date?b:a);
    const geo=index.playerMetadata.get(String(playerId));
    return {id:String(playerId),name:latest.player,aliases:[...new Set(history.map(r=>r.player))],
      countryCode:geo?.countryCode||null,country:geo?.country||null,
      affiliations:affiliationCounts.map(a=>a.name),affiliationCounts,primaryAffiliation:affiliationCounts[0]?.name||'',
      count:rows.length,resultsCount:new Set(rows.map(r=>r.eventId+':'+r.playerId)).size,events:new Set(rows.map(r=>r.eventId)).size,...scoreSummary(rows,playerMinAppearances)};
  }
  function playerList(index,query='',sort='points',affiliation='',country=''){
    const q=normalize(query),byName=(a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id);
    return [...index.byPlayer.keys()].map(id=>playerStats(index,id))
      .map(p=>{
        if(!affiliation)return p;
        const scoped=playerStats(index,p.id,[affiliation]);
        return scoped.count?{...p,count:scoped.count,resultsCount:scoped.resultsCount,events:scoped.events,points:scoped.points,average:scoped.average,weight:scoped.weight,scoredResults:scoped.scoredResults}:null;
      })
      .filter(p=>p&&(!country||(country==='__unknown__'?!p.countryCode:p.countryCode===country))&&(!q||normalize([p.id,...p.aliases,...p.affiliations,p.country||''].join(' ')).includes(q)))
      .sort((a,b)=>sort==='name'?byName(a,b):sort==='average'?(b.average-a.average||byName(a,b)):
        sort==='affiliation'?(Number(!a.primaryAffiliation)-Number(!b.primaryAffiliation)||a.primaryAffiliation.localeCompare(b.primaryAffiliation)||byName(a,b)):
        (b.points-a.points||byName(a,b)));
  }
  function scoreSummary(rows,minAppearances=scoring.minAppearances){
    let points=0,weight=0;
    const results=new Set();
    rows.forEach(r=>{
      if(r.provisional||!Number.isFinite(r.performancePoints)||!Number.isFinite(r.pointsShare))return;
      points+=r.pointsShare;
      weight+=1/(Number.isInteger(r.variantCount)&&r.variantCount>0?r.variantCount:1);
      results.add(r.eventId+':'+r.playerId);
    });
    return {points,average:results.size>=minAppearances&&weight?points/(weight+scoring.priorWeight):0,weight,scoredResults:results.size};
  }
  function scopedCharacters(data,index,affiliation=[],playerId=null){
    return data.characters.map(c=>{
      const rows=scopeRows(index.byCharacter.get(c.id)||[],affiliation,playerId);
      return {...c,count:rows.length,...scoreSummary(rows)};
    });
  }
  function affiliationList(index,sort='points'){
    const names=[...new Set(index.rosters.flatMap(r=>r.affiliations))];
    return names.map(name=>({name,...scoreSummary(affiliationRows(index.rosters,[name]))}))
      .sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):
        sort==='average'?((b.average??-Infinity)-(a.average??-Infinity)||a.name.localeCompare(b.name)):
        (b.points-a.points||a.name.localeCompare(b.name)));
  }
  function characterList(data,query='',onlyUsed=false,sort='points'){
    const q=normalize(query);
    return data.characters.filter(c=>(!onlyUsed||c.count>0)&&(!q||normalize(c.name+' '+c.alterEgo+' '+c.id).includes(q)))
      .sort((a,b)=>sort==='average'?((b.average??-Infinity)-(a.average??-Infinity)||a.name.localeCompare(b.name)):
        sort==='points'?((b.points||0)-(a.points||0)||a.name.localeCompare(b.name)):
        sort==='frequency'?(b.count-a.count||a.name.localeCompare(b.name)):(a.name.localeCompare(b.name)||a.alterEgo.localeCompare(b.alterEgo)));
  }
  function rosterList(index,id,query='',sort='recent',affiliation='',playerId=null){
    const q=normalize(query);
    const selectedAffiliations=new Set(Array.isArray(affiliation)?affiliation:(affiliation?[affiliation]:[]));
    return (id===null?index.rosters:(index.byCharacter.get(id)||[])).filter(r=>(playerId===null||String(r.playerId)===String(playerId))&&(!selectedAffiliations.size||r.affiliations.some(a=>selectedAffiliations.has(a)))&&(!q||normalize([r.player,r.event,r.location,...r.affiliations].join(' ')).includes(q)))
      .slice().sort((a,b)=>sort==='wins'?(b.wins-a.wins||a.losses-b.losses||b.date.localeCompare(a.date)||a.id.localeCompare(b.id)):
        sort==='player'?(a.player.localeCompare(b.player)||b.date.localeCompare(a.date)||a.id.localeCompare(b.id)):
        (b.date.localeCompare(a.date)||b.wins-a.wins||a.losses-b.losses||a.id.localeCompare(b.id)));
  }
  function statistics(index,id,total,affiliation=[],playerId=null){
    const rows=scopeRows(index.byCharacter.get(id)||[],affiliation,playerId);
    const peers=new Map();
    rows.forEach(r=>new Set(r.characterIds).forEach(other=>{if(other!==id)peers.set(other,(peers.get(other)||0)+1);}));
    return {count:rows.length,events:new Set(rows.map(r=>r.eventId)).size,players:new Set(rows.map(r=>r.playerId)).size,
      share:total?rows.length/total*100:0,...scoreSummary(rows),
      peers:[...peers].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,4)};
  }
  const api={normalize,createIndex,characterList,rosterList,statistics,affiliationRows,scopeRows,scoreSummary,scopedCharacters,affiliationList,playerStats,playerList,playerMinAppearances,scoring,performanceScore,scoreData};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasCore=api;
})(typeof window==='undefined'?globalThis:window);
