(function(root){
  'use strict';
  function decode(payload,characters){
    let raw=payload?.owned??payload?.characters??payload;
    if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
      if(Object.values(raw).some(v=>typeof v!=='boolean'&&(!Number.isInteger(v)||v<0)))throw Error('В коллекции некорректные отметки наличия');
      raw=Object.keys(raw).filter(k=>raw[k]===true||raw[k]>0);
    }
    if(!Array.isArray(raw)||raw.length>2000||raw.some(x=>typeof x!=='string'||x.length>150))throw Error('Нужен JSON-экспорт коллекции из ростер-билдера');
    const known=new Set(characters.flatMap(c=>c.inventoryIds||[c.id]));
    const unique=[...new Set(raw)];
    return {owned:unique.filter(x=>known.has(x)),unknown:unique.filter(x=>!known.has(x))};
  }
  function availability(roster,characters,owned){
    const entries=[],used=new Set();
    for(const c of roster.characters){
      const info=characters.get(c.id),ids=info?.inventoryIds||[c.id];
      const candidate=ids.find(id=>!used.has(id)&&owned.has(id))||ids.find(id=>!used.has(id));
      if(ids.length>1&&candidate)used.add(candidate);
      entries.push({id:c.id,inventoryId:candidate||null,owned:!!candidate&&owned.has(candidate),name:info?.name||c.name});
    }
    const have=entries.filter(e=>e.owned).length;
    const complete=!!roster.inventoryComplete&&entries.length>0&&entries.every(e=>e.inventoryId);
    return {entries,have,total:entries.length,missing:entries.filter(e=>!e.owned),complete,ready:complete&&have===entries.length};
  }
  const api={decode,availability};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AtlasCollectionCore=api;
})(typeof window==='undefined'?globalThis:window);
