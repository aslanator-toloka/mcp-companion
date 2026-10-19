/* Card relationships and tournament cohorts; no UI or browser storage. */
(function(root){
 'use strict';
 const key=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 function related(card,character){
  if(!character)return false;const req=card.requirementsItems||{};
  // Jarvis uses actAs; Hulkbuster additionally counts as Iron Man.
  const acts=character.slug==='hulkbuster'?['hulkbuster','iron-man']:[character.actAs||character.slug];
  return acts.some(id=>(req.mandatory_character||[]).includes(id)||(req.optional_character||[]).includes(id)||(req.mandatory_character_with_alter_ego||[]).includes(id+'|'+character.alterEgo))||(req.mandatory_alter_ego||[]).includes(character.alterEgo)||(req.optional_alter_ego||[]).includes(character.alterEgo);
 }
 function owners(card,catalog){
  return [...new Set(catalog.filter(c=>!c.isGrunt&&related(card,c)).map(c=>c.name))];
 }
 function textSections(text){
  const out={tactics:[],crises:[],known:{tactics:false,crises:false},expected:{tactics:null,crises:null}};let section=null;
  for(let line of String(text||'').split(/\r?\n/)){
   line=line.trim().replace(/^[\s*•`#|\-]+/,'').trim();if(!line)continue;
   const k=key(line),n=line.match(/\b(\d+)\s*[:)]?$/)?.[1];
   if(/^(?:teamtactics?|tactics?(?:cards?)?|tactiquesdequipe|tactiquesequipe)(?:\d+)?$/.test(k)){
    section='tactics';out.known.tactics=true;if(n!==undefined)out.expected.tactics=Number(n);continue;
   }
   if(/^(?:(?:secure|extract|extraction)(?:crisis|crises)?|crisis(?:secure|extract|extraction)?|crises|crisissecure|crisesecurisation|criseextraction|secures|extracts)(?:\d+)?$/.test(k)){
    section='crises';out.known.crises=true;continue;
   }
   if(/^(?:characters|personnages|infinitygems|total(?:threat|menace)?)(?:\d+)?$/.test(k)){section=null;continue;}
   if(section)out[section].push(line);
  }
  return out;
 }
 function variants(name){
  const base=String(name).replace(/^[\s*•`#|\-]+/,'').trim();
  return [...new Set([base,
   base.replace(/\s+(?:\(?R\)?|Restricted|Banned)\s*$/i,''),
   base.replace(/\s+(?:Legal\s+[\d/]+,?\s*)?\(?[A-Z]{0,2}\s*,?\s*\d{1,2}\)?\s*$/i,''),
   base.replace(/\s*\([^)]*\)\s*$/,'')
  ])];
 }
 function create({archive,catalog,cardLists,core,resolveCard}){
  const data=core.scoreData(archive),scopeCache=new Map(),inventory=new Map(),unresolved=new Map();
  const cardOwners=new Map(cardLists.tactics.map(c=>[c.slug,owners(c,catalog)]));
  for(const c of data.characters)for(const slug of c.inventoryIds||[c.id]){if(!inventory.has(slug))inventory.set(slug,new Set());inventory.get(slug).add(c.id);}
  for(const c of catalog)if(!inventory.has(c.slug))inventory.set(c.slug,new Set([c.slug]));
  const resolvedMaps={};
  for(const kind of ['tactics','crises']){
   const lookup=new Map();for(const c of cardLists[kind]){lookup.set(key(c.name),c);lookup.set(key(c.slug),c);lookup.set(key(c.cardFamily),c);}
   resolvedMaps[kind]=new Map();
   function resolve(name){
    if(resolvedMaps[kind].has(name))return resolvedMaps[kind].get(name);
    let card;for(const v of variants(name)){card=lookup.get(key(v))||resolveCard(v,cardLists[kind]);if(card)break;}
    resolvedMaps[kind].set(name,card||null);return card;
   }
   resolvedMaps[kind].resolve=resolve;
  }
  const indexed=data.rosters.map(row=>{
   let parsed;const resolved={};
   for(const kind of ['tactics','crises']){
    const provided=Array.isArray(row[kind])&&row[kind].length>0;
    if(!provided&&!parsed)parsed=textSections(row.rawText);
    const names=provided?row[kind]:parsed[kind],known=provided||parsed.known[kind],expected=provided?names.length:parsed.expected[kind];
    const found=new Set(),missing=[];
    for(const name of names){const c=resolvedMaps[kind].resolve(name);if(c)found.add(c.slug);else{missing.push(name);unresolved.set(kind+':'+name,(unresolved.get(kind+':'+name)||0)+1);}}
    const complete=known&&!missing.length&&(expected===null||expected===names.length);
    resolved[kind]={ids:found,complete,missing};
   }
   return {row,resolved};
  });
  function statistics(kind,{affiliation='',character=''}={}){
   const cacheKey=JSON.stringify([kind,affiliation,character]);if(scopeCache.has(cacheKey))return scopeCache.get(cacheKey);
   const ids=inventory.get(character)||new Set([character]);
   const cohort=indexed.filter(({row})=>(!affiliation||(affiliation==='__none__'?!row.affiliations.length:row.affiliations.includes(affiliation)))&&(!character||row.characterIds.some(id=>ids.has(id))));
   const usable=cohort.filter(r=>r.resolved[kind].complete),byCard=new Map(cardLists[kind].map(c=>[c.slug,[]]));
   let totalWeight=0;
   for(const {row,resolved}of usable){totalWeight+=1/(row.variantCount||1);for(const id of resolved[kind].ids)byCard.get(id)?.push(row);}
   const cards=new Map();
   for(const [slug,rows]of byCard){
    const weight=rows.reduce((n,r)=>n+1/(r.variantCount||1),0);
    cards.set(slug,{count:rows.length,pickWeight:weight,share:totalWeight?weight/totalWeight*100:0,...core.scoreSummary(rows)});
   }
   const result={cards,total:cohort.length,covered:usable.length,excluded:cohort.length-usable.length,totalWeight};scopeCache.set(cacheKey,result);return result;
  }
  return {statistics,related,owners:slug=>cardOwners.get(slug)||[],coverage:()=>({rosters:indexed.length,tactics:indexed.filter(r=>r.resolved.tactics.complete).length,crises:indexed.filter(r=>r.resolved.crises.complete).length,unresolved:[...unresolved].sort((a,b)=>b[1]-a[1])})};
 }
 const api={related,owners,textSections,variants,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.RosterCardInsights=api;
})(typeof window==='object'?window:globalThis);
