(function(root){
  'use strict';
  const key=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'').replace(/20\d\d$/,'');
  // Longshanks and Jarvis use different spellings for these same printed cards.
  const aliases=Object.fromEntries(Object.entries({
    'Survivors Search for Safe Shelter':'Survivors Search for Safe Shelters',
    'Wedding Party Targeted By Terrible Attack!':'Wedding Party Targeted in Terrible Attack!',
    'Assault Ships Makes Sweeping Search':'Assault Ships Make Sweeping Search!',
    'Mutant Madman Turns City Center Into Lethal Amusement Park':'Mutant Madman Turns City Into Lethal Amusement Park',
    'Deadly Meteors Mutate Citizens':'Deadly Meteors Mutate Civilians',
    'Daughter of Thanos':'Daughters of Thanos',
    'Heavy Ordnance':'Heavy Ordinance'
  }).map(([a,b])=>[key(a),key(b)]));
  function resolveCard(name,rows){
    const wanted=aliases[key(name)]||key(name);
    return rows.find(c=>key(c.name)===wanted||key(c.slug)===wanted);
  }
  function draft(roster,characterMap,owned,catalog,cardLists){
    const a=root.AtlasCollectionCore.availability(roster,characterMap,new Set(owned));
    const known=new Set(catalog.map(c=>c.slug)),unresolved=[];
    const characters=a.entries.map(e=>e.inventoryId).filter(id=>known.has(id));
    a.entries.forEach(e=>{if(!known.has(e.inventoryId))unresolved.push('Персонаж: '+e.name);});
    function cards(kind){return [...new Set(roster[kind].flatMap(name=>{
      const match=resolveCard(name,cardLists[kind]);
      if(!match){unresolved.push((kind==='tactics'?'Тактика: ':'Кризис: ')+name);return [];}
      return [match.slug];
    }))];}
    const tactics=cards('tactics'),crises=cards('crises');
    return {name:`${roster.player} · ${roster.wins}/${roster.losses} · ${roster.event}`.slice(0,100),
      affiliation:roster.affiliations.length===1?roster.affiliations[0]:'',characters,tactics,crises,groups:[],
      tournamentSource:{id:roster.id,player:roster.player,event:roster.event,url:roster.eventUrl,date:roster.date,
        record:`${roster.wins}/${roster.losses}/${roster.draws}`,place:roster.place,fieldSize:roster.fieldSize,
        unresolved,incomplete:!roster.inventoryComplete,rawText:roster.rawText||'',
        gems:roster.characters.filter(c=>c.gems?.length).map(c=>({name:c.name,gems:c.gems}))}};
  }
  const api={key,draft,resolveCard};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TournamentImport=api;
})(typeof window==='undefined'?globalThis:window);
