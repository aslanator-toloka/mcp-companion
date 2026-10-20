/* Native, responsive character cards built exclusively from structured card data. */
(function(root){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={stamina:'Stamina',speed:'Speed',size:'Size',threat:'Threat',physical:'Physical',energy:'Energy',mystic:'Mystic',power:'Power',damage:'Damage',range:'Range',strength:'Strength',wild:'Wild',critical:'Critical',failure:'Failure',hit:'Hit',block:'Block',active:'Active',reactive:'Reactive',innate:'Innate',leadership:'Leadership',range_small:'S',range_medium:'M',range_large:'L',movement_small:'S',movement_medium:'M',movement_large:'L'};
  function icon(key,badge=false){
    const name=key.replace(/^badge-(attack-)?/,''),label=labels[name]||name;
    return Object.hasOwn(labels,name)?`<img class="sc-icon${badge?' sc-badge-icon':''}" src="assets/card-icons/${escape(key)}.png" alt="${escape(label)}" title="${escape(label)}" width="24" height="24">`:`<span class="sc-token">${escape(label)}</span>`;
  }
  function rule(text,delimiter='|',depth=0){
    if(depth>4)return escape(text);
    const value=String(text??''),parts=value.split(delimiter);let out='';
    for(let i=0;i<parts.length;i++){
      const part=parts[i];
      if(i%2===0){out+=escape(part).replaceAll('\n','<br>');continue;}
      const nested=body=>rule(body,delimiter==='|'?'&':'|',depth+1);
      if(part==='\\')out+='<br>';
      else if(part[0]==='!')out+=icon(part.slice(1));
      else if(part[0]==='*')out+='<strong>'+nested(part.slice(1))+'</strong>';
      else if(part[0]==='~')out+='<span class="sc-rule-option">'+nested(part.slice(1))+'</span>';
      else if(part[0]==='§'||part[0]==='£'){
        const end=part.indexOf(part[0],1);
        if(end<0)out+=escape(part);
        else if(part[0]==='§')out+='<button type="button" class="sc-condition-reference" data-card-condition="'+escape(part.slice(1,end))+'" aria-haspopup="dialog" aria-controls="sc-condition-dialog" aria-expanded="false">'+nested(part.slice(end+1))+'</button>';
        else out+='<span class="sc-reference">'+nested(part.slice(end+1))+'</span>';
      }else if(part[0]==='<'){
        const end=part.indexOf('>');out+=end<0?escape(part):'<span class="sc-reference">'+nested(part.slice(end+1))+'</span>';
      }else out+=escape(delimiter+part+delimiter);
    }
    return out;
  }
  function pill(key,value,label,change){
    const shown=change?.value??value,reason=change?.changed?`${label}: ${change.base} → ${shown}. ${change.reason||''}`:'';
    return `<div class="sc-stat${change?.changed?' sc-stat-changed':''}" data-stat="${escape(key)}" aria-label="${escape(label)}: ${escape(shown??'—')}" ${reason?`title="${escape(reason)}"`:''}>${icon('badge-'+key,true)}<b>${escape(shown??'—')}</b></div>`;
  }
  const sorted=rows=>[...(rows||[])].sort((a,b)=>(a.rank||0)-(b.rank||0));
  function attack(a,change){return `<article class="sc-ability sc-attack"><header class="sc-attack-heading"><div class="sc-ability-heading">${icon('badge-attack-'+a.type,true)}<h4>${escape(a.name)}</h4></div><dl class="sc-attack-stats"><div><dt>${icon('badge-range')}</dt><dd>${escape(a.range)}</dd></div><div><dt>${icon('badge-strength')}</dt><dd ${change?.strength?.changed?`class="sc-live-changed" title="${escape(change.strength.reason)}"`:''}>${escape(change?.strength?.value??a.strength)}</dd></div><div><dt>${icon('badge-power')}</dt><dd>${escape(a.powerCost??0)}</dd></div></dl></header>${a.steps?.length?'<ul class="sc-rules">'+a.steps.map(s=>'<li>'+rule(s)+'</li>').join('')+'</ul>':''}</article>`;}
  function power(p,change){
    const raw=change?.cost?.value??p.powerCost,cost=Number(raw)===100?'X':raw;
    return `<article class="sc-ability sc-superpower sc-${escape(p.type)}"><header class="sc-power-heading"><div class="sc-ability-heading">${icon('badge-'+p.type,true)}<h4>${escape(p.name)}</h4></div>${cost!==null&&cost!==undefined?`<span class="sc-power-cost${change?.cost?.changed?' sc-cost-changed':''}" aria-label="Power: ${escape(cost)}" ${change?.cost?.changed?`title="${escape(change.cost.reason)}"`:''}>${icon('power')}<b>${escape(cost)}</b></span>`:''}</header>${p.body?'<div class="sc-power-body">'+rule(p.body)+'</div>':''}</article>`;
  }
  function safeArt(value){try{const url=new URL(value,String(value).startsWith('/artworks/')?'https://d15s9aja3f2wkq.cloudfront.net':'https://www.jarvis-protocol.com');return url.protocol==='https:'&&['www.jarvis-protocol.com','d15s9aja3f2wkq.cloudfront.net'].includes(url.hostname)?url.href:'';}catch{return '';}}
  function skinAsset(value){
    return typeof value==='string'&&/^assets\/card-skins\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:png|webp|jpe?g|svg)$/.test(value)?value:'';
  }
  function skinFor(slug,form=0,skins=root.MCP_CARD_SKINS||{}){
    const skin=skins[slug];return skin&&Number(skin.form||0)===form?skin:null;
  }
  function skinNameMarkup(name,skin){
    if(!skin)return `<h3 data-name-font="35">${escape(name)}</h3>`;
    const style=['noir','comic','classic'].includes(skin.style)?skin.style:'classic';
    const lines=Array.isArray(skin.lines)&&skin.lines.length?skin.lines:[skin.text||name];
    return `<h3 class="sc-name-styled sc-name-${style}" aria-label="${escape(skin.text||name)}">${lines.slice(0,3).map(line=>`<span>${escape(line)}</span>`).join('')}</h3>`;
  }
  function artMarkup(mode,image,fallback,name,settings={}){
    if(mode==='none'||!image)return '<div class="sc-art sc-art-none"></div>';
    const frame=settings.frame||{},dimensions=Object.entries(frame).filter(([key,value])=>['left','bottom','width','height','maxWidth'].includes(key)&&Number.isFinite(value)).map(([key,value])=>(key==='maxWidth'?'max-width':key)+':'+value+'px').join(';');
    const img=`<img src="${escape(image)}" ${fallback&&fallback!==image?`data-card-fallback="${escape(fallback)}"`:''} alt="${escape(name)}" decoding="async">`;
    return `<div class="sc-art sc-art-${mode}" style="${dimensions}"><div class="sc-art-illustration">${img}</div>${mode==='classic'?`<div class="sc-art-spacer" style="height:${Number.isFinite(settings.bottomSpacer)?settings.bottomSpacer:48}px"></div>`:''}<p class="sc-art-status" role="status" hidden>Иллюстрация недоступна в источнике.</p></div>`;
  }
  function render({slug,detail,form=0,side='front',character={},art={},layout=root.MCP_CARD_LAYOUT||{},battle=null,skins=root.MCP_CARD_SKINS||{},skinLayers={}}){
    const card=form===1?detail?.secondStatCard:detail?.statCard;
    const metrics=layout[slug]?.[form]?.[side]||{};
    const sourceFace=side==='back'?card?.backSide:card?.frontSide,artOnly=!sourceFace&&metrics.art?.mode==='grunt';
    const face=sourceFace||(artOnly?{type:'artwork'}:null);
    if(!card||!face)return '<div class="sc-unavailable" role="status">Эта сторона карточки недоступна.</div>';
    const skin=skinFor(slug,form,skins);
    const nameSkin=skinLayers.name!==false?skin?.name:null;
    const background=skinLayers.background!==false?skinAsset(skin?.background?.src):'';
    const characterSkin=skinLayers.character!==false?skin?.character?.[side]:null;
    const alternativeImage=skinAsset(characterSkin?.src);
    const name=face.nameOverride||card.name||character.name||slug;
    const image=safeArt(metrics.art?.url||art[slug]?.[form]?.[side]||face.artworkUrl||face.fallbackArtworkUrl||'');
    const fallback=safeArt(art[slug]?.[form]?.front||face.fallbackArtworkUrl||(artOnly?card.frontSide?.fallbackArtworkUrl:'')||'');
    const injured=face.type==='injured',powers=sorted(face.superPowers),attacks=sorted(face.attacks);
    const width=character.isGrunt?550:1200,height=character.isGrunt?950:800;
    const mode=metrics.art?.mode||(character.isGrunt?'none':card.template==='2023'?'canvas':'classic');
    const identity=nameSkin?skinNameMarkup(name,nameSkin):`<h3 data-name-font="${metrics.nameSize||35}">${escape(name)}</h3>`;
    const illustration=alternativeImage?artMarkup('alternative',alternativeImage,image,name,{frame:{left:0,bottom:24,width:313,height:500,...characterSkin.frame}}):artMarkup(mode,image,fallback,name,metrics.art);
    return `<div class="sc-card-stage" data-native-width="${width}" data-native-height="${height}"><article class="sc-card ${injured?'sc-injured':'sc-healthy'} ${character.isGrunt?'sc-grunt':''} ${artOnly?'sc-art-only':''}" aria-label="${escape(name)} · ${artOnly?'Artwork':injured?'Injured':'Healthy'}" lang="en" data-card-template="${character.isGrunt?'grunt':card.template==='2023'?'2023':'classic'}">${background?`<img class="sc-skin-background" src="${escape(background)}" alt="" aria-hidden="true" decoding="async">`:''}${illustration}<aside class="sc-character-panel"><div class="sc-identity${nameSkin?' sc-identity-alternative':''}">${identity}${card.alterEgo?'<p>'+escape(card.alterEgo)+'</p>':''}</div>${artOnly?'':`<div class="sc-stats"><div class="sc-defenses">${pill('physical',face.physicalDefense,'Physical',battle?.stats.physical)}${pill('energy',face.energyDefense,'Energy',battle?.stats.energy)}${pill('mystic',face.mysticDefense,'Mystic',battle?.stats.mystic)}</div><div class="sc-vitals">${pill('stamina',face.stamina,'Stamina',battle?.stats.stamina)}${!character.isGrunt?pill('threat',face.threatLevel,'Threat'):''}${pill('size',face.size,'Size')}${pill('speed',face.speed,'Speed',battle?.stats.speed)}</div></div>`}</aside>${artOnly?'':`<div class="sc-rules-panel"><div class="sc-rules-content" data-rule-leading="${metrics.lineHeight||20.8}">${attacks.map((a,i)=>attack(a,battle?.attacks[i])).join('')}${powers.map((p,i)=>power(p,battle?.powers[i])).join('')}</div></div>`}<footer class="sc-credit">© MARVEL © AMG · ${escape((side==='back'&&card.secondSideArtist)||card.artist||'')}</footer></article></div>${card.erratas?.length?'<details class="sc-errata"><summary>Обновления правил · '+card.erratas.length+'</summary>'+card.erratas.map(e=>'<div><time>'+escape(e.createdOn)+'</time><p>'+rule(e.body)+'</p></div>').join('')+'</details>':''}`;

  }
  const api={render,rule,icon,safeArt,artMarkup,attack,power,skinAsset,skinFor};if(typeof module==='object'&&module.exports)module.exports=api;root.MCPCardRenderer=api;
})(typeof window==='object'?window:globalThis);
