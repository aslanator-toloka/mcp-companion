/* Browser-hosted battles for the GitHub Pages edition. No account, signalling or relay service. */
'use strict';
window.NetworkBattle=(()=>{
 const KEY='mcp-companion-peer-rooms-v1',PROFILE='mcp-companion-peer-profile-v1';
 let books=[],storageError=false,profile,room=null,authority=null,role=null,link=null,connected=false,remoteUser=null,remoteReferences=[],offerText='',answerText='';
 let queue=[],sending=false,retry=null,hostChain=Promise.resolve(),domainPromise=null,seen=[],session=0;
 let snapshotsReceived=0,lastFullSyncAt=0;
 const requests=new Map(),clone=value=>BattleCore.clone(value);
 const active=()=>!!room&&battleMatchId===room.id;
 const current=()=>active()?room.match:null;
 const ownSide=()=>active()?room.side:'mine';
 const label=side=>side===ownSide()?'Мои':'Противник';
 const equal=(a,b)=>a===b||!!a&&!!b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));
 function error(text,status=400){const e=new Error(text);e.status=status;return e;}
 try{books=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(books)||books.some(b=>!b||typeof b.id!=='string'||!['mine','opponent'].includes(b.role)||!b.packet))throw Error();}
 catch{books=[];storageError=true;}
 try{profile=JSON.parse(localStorage.getItem(PROFILE)||'null');}catch{}
 if(!profile||!/^[-a-f0-9]{36}$/i.test(profile.id||''))profile={id:crypto.randomUUID(),name:''};
 function saveProfile(name){profile.name=String(name||'').trim().slice(0,60)||'Игрок';localStorage.setItem(PROFILE,JSON.stringify(profile));}
 function saveBook(entry){
  if(storageError)throw error('Сохранения сетевых партий не прочитаны. Исходная запись не перезаписана.');
  const next=[entry,...books.filter(b=>b.id!==entry.id)];
  try{localStorage.setItem(KEY,JSON.stringify(next));}catch{throw error('Не хватает места для партии. Экспортируйте данные и освободите место на устройстве.');}
  books=next;
 }
 function persistAuthority(next,nextSeen=seen){
  const p=domain.packet(next,profile.id,{live:true});
  saveBook({id:next.id,role:'mine',packet:p,authority:next,seen:nextSeen,at:new Date().toISOString()});
  authority=next;seen=nextSeen;
 }
 async function domainReady(slugs=[]){
  if(!domainPromise)domainPromise=(async()=>{
   const response=await fetch('data/roster-cards.json');if(!response.ok)throw error('Не загрузились карты ростеров.');const data=await response.json();
   domain=MCPRoomCore({Core:BattleCore,Geometry:MapGeometry,Power:PowerPhase,characters,tacticCards:new Map(data.tactics.map(c=>[c.slug,c])),crisisCards:new Map(data.crises.map(c=>[c.slug,c])),getDetail:slug=>{const d=cards.get(slug);if(!d)throw error('Сначала загрузите карточку '+slug);return d;},randomUUID:()=>crypto.randomUUID(),randomInt:n=>{const a=new Uint32Array(1),limit=Math.floor(0x100000000/n)*n;do{crypto.getRandomValues(a);}while(a[0]>=limit);return a[0]%n;},eq:equal});
  })().catch(e=>{domainPromise=null;throw e;});
  await domainPromise;
  await Promise.all([...new Set(slugs)].map(async slug=>{if(!characters.has(slug))throw error('Неизвестный персонаж.');await battleDetail(slug);}));
 }
 let domain;
 function shareRoster(roster){
  const r={id:roster.id,name:roster.name,affiliation:roster.affiliation||'',characters:[...roster.characters],tactics:[...(roster.tactics||[])],crises:[...(roster.crises||[])],groups:[]};
  domain.validateLibrary({collection:{version:1,owned:[],groups:[],rosters:[r]},battles:{version:1,matches:[]}});return r;
 }
 function apply(packet,{force=false}={}){
  if(!packet||packet.id!==link?.signal?.roomId&&packet.id!==room?.id&&packet.id!==battleMatchId)throw error('Пришла другая партия.');
  if(packet.side!==(role==='mine'?'mine':'opponent')||!Number.isInteger(packet.revision)||!packet.ready||!Array.isArray(packet.members)||packet.members.length>2)throw error('Некорректный снимок партии.');
  if(!force&&room?.id===packet.id&&packet.revision<=room.revision){refreshControls();return;}
  if(packet.referencesDelta)packet.match.references={...room?.match.references,...packet.match.references};
  validateBattleData({version:1,matches:[packet.match]});
  const started=room?.match.status==='preparing'&&packet.match.status==='active';
  if(role==='opponent'){
   try{saveBook({id:packet.id,role,packet:clone(packet),at:new Date().toISOString()});}catch(e){toast(e.message);}
  }
  room=packet;
  // Keep an ordinary local snapshot too: it participates in the existing JSON backup.
  writeMatch(clone(packet.match));
  if(battleMatchId===room.id){
   if(room.match.status!=='preparing'&&battleView==='setup')battleView='play';
   renderBattle();if(started)window.scrollTo(0,0);
   if(battlePicker)renderBattlePicker();
   if(['conditions','missions','objectives','log','fighter'].includes(battleDialogContext?.type)){
    try{refreshBattleDialog();}catch{$('#battle-dialog').close();}
   }
  }
 }
 function renderPacket(){apply(domain.packet(authority,profile.id,{live:true}));}
 async function broadcast(full=false){
  if(!connected||!remoteUser)return;
  const connection=link,target=authority,stamp=session;
  const packet=domain.packet(target,remoteUser,{live:true,...(!full?{knownReferences:remoteReferences}:{})});
  try{await connection.send({type:'state',packet});}
  catch(e){if(connection===link&&stamp===session)connectionError(e);return;}
  if(connection===link&&stamp===session)remoteReferences=Object.keys(target.match.references);
 }
 function serial(fn){const pending=hostChain.then(fn);hostChain=pending.catch(()=>{});return pending;}
 async function processCommand(userId,body){
  const target=authority,stamp=session;
  await domainReady([...(Object.keys(authority.match.references||{})),...['mine','opponent'].flatMap(s=>(body?.match?.[s]?.fighters||[]).map(f=>f.slug))]);
  if(authority!==target||session!==stamp)throw error('Соединение изменилось. Переподключитесь.',409);
  if(!body||typeof body.operationId!=='string'||!/^[-a-zA-Z0-9_]{16,100}$/.test(body.operationId))throw error('Нет идентификатора действия.');
  const key=userId+':'+body.operationId;
  if(seen.includes(key))return domain.packet(authority,userId,{live:true,knownReferences:body.knownReferences});
  if(body.revision!==authority.revision){const e=error('Партия обновилась.',409);e.data={room:domain.packet(authority,userId,{live:true,knownReferences:body.knownReferences})};throw e;}
  const candidate=clone(authority);
  switch(body.action){
   case 'edit':domain.editRoom(candidate,userId,body.match,body.label);break;
   case 'ready':domain.readyRoom(candidate,userId,body.ready);break;
   case 'round':domain.advanceRoom(candidate,userId,body);break;
   case 'power':domain.powerRoom(candidate,userId,body);break;
   case 'undo':domain.member(candidate,userId);if(candidate.match.status!=='active')throw error('Отмена доступна во время боя.');candidate.match=BattleCore.undo(candidate.match,new Date().toISOString());domain.validateMatch(candidate.match);break;
   default:throw error('Неизвестное действие.');
  }
  candidate.revision++;candidate.match.updatedAt=new Date().toISOString();
  persistAuthority(candidate,[...seen,key].slice(-1000));renderPacket();broadcast().catch(connectionError);
  return domain.packet(authority,userId,{live:true,knownReferences:body.knownReferences});
 }
 function connectionError(e){connected=false;link?.close();failRequests();refreshControls();if(e)console.warn('Direct battle: connection interrupted');}
 function failRequests(){for(const [,p]of requests){clearTimeout(p.timer);p.reject(Error('Соединение прервано.'));}requests.clear();}
 function stopLink(){session++;connected=false;remoteUser=null;remoteReferences=[];offerText=answerText='';const old=link;link=null;old?.close();failRequests();clearTimeout(retry);refreshControls();}
 function setLink(){
  stopLink();const token=session;
  link=new MCPPeerLink.Link({onState:state=>{
   if(token!==session)return;
   if(state==='connected'){
    connected=true;refreshControls();
    if(role==='opponent')joinHandshake().catch(e=>{connectionError(e);showPeerError(e.message);});
   }else if(['disconnected','failed','closed','invalid'].includes(state)){connected=false;failRequests();refreshControls();if(state==='invalid')toast('Получено некорректное сообщение. Соединение закрыто.');if(state==='failed')showPeerError('Прямая связь не установлена. Проверьте Wi-Fi, разрешения локальной сети и доступ устройств друг к другу. VPN может мешать прямому подключению. Создайте новое приглашение для повторной попытки.');}
   const status=$('#peer-connect-status');if(status)status.textContent=state==='connected'?'Прямая связь установлена':state==='waiting'?'Ждём ответ второго игрока':state==='connecting'?'Соединяем устройства…':connected?'В сети':'Нет соединения';
  },onMessage:message=>{if(token===session)receive(message).catch(e=>{connectionError(e);toast(e.message);});}});
  return link;
 }
 function rpc(type,body){
  if(!link?.connected)return Promise.reject(Error('Нет прямого соединения.'));
  const id=crypto.randomUUID();return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{requests.delete(id);reject(Error('Хозяин не ответил. Изменение ожидает подтверждения.'));},12000);
   requests.set(id,{resolve,reject,timer});link.send({type,id,body}).catch(e=>{clearTimeout(timer);requests.delete(id);reject(e);});
  });
 }
 async function receive(message){
  const connection=link,stamp=session,targetId=authority?.id;
  if(!message||typeof message.type!=='string')throw error('Некорректное сообщение.');
  if(message.type==='reply'){
   const p=requests.get(message.id);if(!p)return;requests.delete(message.id);clearTimeout(p.timer);
   if(message.ok)p.resolve(message.packet);else{const e=error(message.error||'Действие отклонено.',message.status||400);e.data=message.data;p.reject(e);}return;
  }
  if(role==='opponent'&&message.type==='state'){snapshotsReceived++;if(!message.packet?.referencesDelta)lastFullSyncAt=Date.now();apply(message.packet);return;}
  if(role!=='mine'||!['join','command'].includes(message.type))throw error('Неизвестное сообщение.');
  if(typeof message.id!=='string'||message.id.length>100)throw error('Некорректный запрос.');
  await serial(async()=>{
   if(connection!==link||stamp!==session||targetId!==authority?.id)return;
   try{
    let packet;
    if(message.type==='join'){
     const user=message.body?.user;
     if(!user||!/^[-a-f0-9]{36}$/i.test(user.id||'')||user.id===profile.id||typeof user.name!=='string'||!user.name.trim()||user.name.length>60)throw error('Некорректный игрок.');
     await domainReady();if(connection!==link||stamp!==session)return;const roster=shareRoster(message.body.roster);
     if(authority.members.length===2&&!authority.members.some(m=>m.userId===user.id&&m.side==='opponent'))throw error('В этой партии уже сохранён другой второй игрок.',403);
     const next=clone(authority);if(domain.joinRoom(next,user,roster)){next.revision++;next.match.updatedAt=new Date().toISOString();}
     persistAuthority(next);remoteUser=user.id;renderPacket();
     packet=domain.packet(authority,user.id,{live:true});remoteReferences=Object.keys(authority.match.references);
    }else{
     if(!remoteUser)throw error('Сначала подключитесь к партии.',403);
     packet=await processCommand(remoteUser,message.body);
    }
    if(connection!==link||stamp!==session)return;
    await connection.send({type:'reply',id:message.id,ok:true,packet});
    if(message.type==='join'){$('#peer-connect-dialog')?.close();drain();}
   }catch(e){if(connection===link&&stamp===session)await connection.send({type:'reply',id:message.id,ok:false,error:e.message,status:e.status||400,data:e.data});}
  });
 }
 let guestRoster=null;
 async function joinHandshake(){
  const packet=await rpc('join',{user:{id:profile.id,name:profile.name},roster:guestRoster});
  battleMatchId=packet.id;battleTeam='opponent';battleView=packet.match.status==='preparing'?'setup':'play';
  apply(packet,{force:true});showBattleScreen();$('#peer-connect-dialog')?.close();drain();
 }
 function home(){
  const supported=!!window.RTCPeerConnection;
  return `<section class="network-home"><div><span class="eyebrow">ПРЯМАЯ СВЯЗЬ · ОДНА WI-FI-СЕТЬ</span><h2>Один стол на двоих</h2><p>Хозяин создаёт приглашение, второй игрок присылает ответ. Дальше бой синхронизируется напрямую между устройствами.</p></div><div class="actions"><button class="primary" data-peer="create" ${!supported||storageError?'disabled':''}>Создать совместный бой</button><button data-peer="join" ${!supported||storageError?'disabled':''}>Подключиться к игроку</button></div>${!supported?'<p class="notice">Браузер не поддерживает WebRTC.</p>':''}${storageError?'<p class="notice">Сохранения совместных партий не прочитаны. Исходная запись сохранена.</p>':''}</section>${books.length?`<div class="section-title"><h3>Совместные партии</h3></div><div class="match-grid">${books.map(b=>`<article class="match-tile"><span class="eyebrow">${b.role==='mine'?'Вы — хозяин':'Вы — второй игрок'} · ${b.packet.match.status==='preparing'?'Подготовка':b.packet.match.status==='finished'?'Завершён':'Идёт бой'}</span><h3>${esc(b.packet.match.name)}</h3><p>${b.packet.members.map(m=>esc(m.name)).join(' · ')}</p><button data-peer="resume" data-id="${esc(b.id)}">${b.packet.match.status==='finished'?'Посмотреть':'Продолжить / подключиться'}</button></article>`).join('')}</div>`:''}`;
 }
 function header(){
  if(!active())return '';
  return `<div class="network-strip"><span class="network-connection ${connected?'':'offline'}">${connected?'● Прямая связь':role==='mine'?'◌ Ждём второго игрока':'◌ Нет связи с хозяином'}</span><span>${role==='mine'?'Вы — хозяин':'Вы — второй игрок'}</span><button class="quiet" data-peer="reconnect">${role==='mine'?'Подключить игрока':'Переподключиться'}</button><small>${queue.length?'Сохраняем изменения…':'Изменения сразу · контрольный снимок каждые 10 с'}</small></div>`;
 }
 function refreshControls(){
  if(active()&&screen==='battle'){
   const strip=$('#battle-screen .network-strip');if(strip){const indicator=strip.querySelector('.network-connection');indicator.classList.toggle('offline',!connected);indicator.textContent=connected?'● Прямая связь':role==='mine'?'◌ Ждём второго игрока':'◌ Нет связи с хозяином';strip.querySelector('small').textContent=queue.length?'Ждём подтверждения изменений…':'Изменения сразу · контрольный снимок каждые 10 с';}
   const ready=$('#battle-screen [data-peer="ready"]');if(ready)ready.disabled=!!(queue.length||battleBusy||role==='opponent'&&!connected);
  }
 }
  function setup() {
    const m = room.match,
      side = room.side,
      other = side === "mine" ? "opponent" : "mine",
      t = m[side],
      enemy = m[other],
      ready = room.ready[side];
    return `${header()}<div class="heading"><div><span class="eyebrow">ПОДГОТОВКА / ПРЯМАЯ СВЯЗЬ</span><h1>Собрать свой отряд</h1><p>${esc(m.name)} · вы играете за ${esc(t.name)}</p></div><button data-bt="home">← К партиям</button></div><div class="setup-fields"><label class="field">Название партии<input id="battle-name" maxlength="100" value="${esc(m.name)}"></label><label class="field">Лимит Threat<input id="battle-threat" type="number" min="1" max="99" value="${m.threat}"></label><label class="field">Приоритет<select id="battle-priority">${priorityOptions(m.priority)}</select></label></div><div class="section-title"><h3>Общая миссия</h3></div>${missionMarkup(m, true)}<div class="setup-columns"><section class="setup-team"><div class="section-title"><h2>Мой отряд</h2><span class="tag">Threat ${matchThreat(t)} / ${m.threat}</span></div><button class="squad-add" data-bt="pick" data-side="${side}" data-kind="characters">Выбрать из моего ростера +</button>${selectedSquad(t, side)}<label class="field">Аффилиация<select data-battle-aff="${side}">${affOptions(t.affiliation)}</select><small>${squadAffiliation(t)}</small></label><label class="field">Лидер<select data-battle-leader="${side}">${leaderOptions(t)}</select></label><div class="section-title"><h3>Тактики · ${t.tactics.length} / 5</h3><button data-bt="pick" data-side="${side}" data-kind="tactics">+ Выбрать</button></div>${tacticsList(t, side)}</section><section class="setup-team network-opponent"><span class="eyebrow">ВТОРОЙ ИГРОК</span><h2>${esc(enemy.name)}</h2><span class="tag">${room.members.length < 2 ? "Ждём подключения" : room.ready[other] ? "✓ Готов к бою" : "Выбирает отряд"}</span><div class="network-squad-preview">${enemy.fighters.map((f) => `<div>${avatar(characters.get(f.slug))}<span>${esc(f.name)}<small>Threat ${f.threat}</small></span></div>`).join("") || '<p class="muted">Отряд появится здесь после выбора.</p>'}</div><p class="battle-small">Отряд соперника выбирает второй игрок.</p></section></div><p class="battle-rule-note">Изменение своего отряда снимает вашу готовность. Изменение общих условий снимает готовность обоих. Когда оба готовы, бой начнётся автоматически.</p><div class="editor-footer"><span>${ready ? "✓ Вы готовы. Ждём второго игрока." : "Выберите бойцов и нажмите «Я готов»."}</span><button class="primary" data-peer="ready" ${queue.length || battleBusy ? "disabled" : ""}>${ready ? "Отменить готовность" : "Я готов →"}</button></div>`;
  }
 function peerDialog(title,body){
  let el=$('#peer-connect-dialog');if(!el){el=document.createElement('dialog');el.id='peer-connect-dialog';el.className='battle-dialog peer-connect-dialog';document.body.append(el);}
  el.innerHTML=`<div class="dialog-heading"><h2>${esc(title)}</h2><button class="quiet" data-peer="close" aria-label="Закрыть подключение">×</button></div>${body}<p id="peer-form-error" role="alert" class="peer-error"></p>`;
  if(!el.open)el.showModal();
 }
 function showPeerError(text){const el=$('#peer-form-error');if(el)el.textContent=text;else toast(text);}
 function rosterOptions(selected=''){return '<option value="">Выберите ростер</option>'+state.rosters.map(r=>`<option value="${esc(r.id)}" ${r.id===selected?'selected':''}>${esc(r.name)}</option>`).join('');}
 function showChoose(mode,existing=null){
  if(queue.length&&!existing){toast('Сначала дождитесь подтверждения изменений или переподключитесь к этой партии.');return;}
  const name=profile.name||(mode==='create'?'Игрок 1':'Игрок 2');
  peerDialog(mode==='create'?'Создать совместный бой':'Подключиться к игроку',`<p class="battle-small">Оба устройства должны быть в одной Wi-Fi-сети. Сначала хозяин передаёт приглашение, затем второй игрок возвращает ответ. Отдельный сервер не используется.</p><form id="peer-room-form" data-mode="${mode}" data-existing="${esc(existing?.id||'')}"><label class="field">Ваше имя<input name="name" required maxlength="60" value="${esc(name)}" autocomplete="nickname"></label>${existing?`<p class="battle-small">Ростер этой партии: ${esc(existing.packet.rosters[existing.role]?.name||'Сохранённый ростер')}</p>`:`<label class="field">Ваш ростер<select name="roster" required>${rosterOptions()}</select></label>`}${mode==='join'?'<label class="field">Приглашение хозяина<textarea name="offer" id="peer-offer-input" required rows="5" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="MCP-LAN-1.…"></textarea></label>':''}${!state.rosters.length&&!existing?'<p class="notice">Сначала создайте ростер.</p>':''}<button class="primary" type="submit" ${!state.rosters.length&&!existing?'disabled':''}>${mode==='create'?'Создать приглашение':'Подготовить ответ'}</button></form>`);
 }
 function showOffer(){
  peerDialog('Подключить второго игрока',`<ol class="peer-steps"><li>Передайте приглашение второму игроку.</li><li>Он откроет «Подключиться к игроку», вставит приглашение и пришлёт свой ответ.</li><li>Вставьте этот ответ ниже.</li></ol><label class="field">Приглашение<textarea id="peer-offer" rows="5" readonly spellcheck="false">${esc(offerText)}</textarea></label><button data-peer="copy" data-copy="peer-offer">Скопировать приглашение</button><form id="peer-answer-form"><label class="field">Ответ второго игрока<textarea id="peer-answer-input" name="answer" rows="5" required spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="MCP-LAN-1.…"></textarea></label><button class="primary" type="submit">Соединить устройства</button></form><p id="peer-connect-status" role="status">Ждём ответ второго игрока</p><p class="battle-small">Это приглашение действует, пока страница хозяина открыта. После перезагрузки создайте новое приглашение для сохранённой партии.</p>`);
 }
 function showAnswer(){
  peerDialog('Передайте ответ хозяину',`<p class="battle-small">Отправьте этот текст хозяину партии. Он вставит его в своё окно подключения. Когда связь установится, окно закроется автоматически.</p><label class="field">Ваш ответ<textarea id="peer-answer" rows="6" readonly spellcheck="false">${esc(answerText)}</textarea></label><button data-peer="copy" data-copy="peer-answer">Скопировать ответ</button><p id="peer-connect-status" role="status">Ждём, пока хозяин примет ответ…</p><p class="battle-small">Если связь не устанавливается: проверьте, что оба устройства в одной сети, а Wi-Fi разрешает связь устройств друг с другом. На iPad разрешите доступ к локальной сети, если Safari его запросит. Для нового приглашения откройте подключение заново.</p>`);
 }
 async function invite(){
  if(!authority)throw error('Откройте партию хозяина.');
  if(connected)throw error('Второй игрок уже подключён.');
  if(offerText&&link&&!link.closed&&['new','connecting'].includes(link.pc.connectionState)){showOffer();return;}
  const next=setLink();peerDialog('Готовим приглашение','<p class="battle-small">Собираем параметры локального соединения…</p>');
  try{const text=await next.offer(authority.id);if(link===next){offerText=text;showOffer();}}
  catch(e){if(link===next){stopLink();showPeerError(e.message);}throw e;}
 }
 function openSaved(id){
  const saved=books.find(b=>b.id===id);if(!saved)throw error('Сохранение партии не найдено.');
  if(queue.length&&room?.id!==id)throw error('Дождитесь подтверждения текущих изменений.');
  if(connected&&room?.id===id){battleMatchId=id;battleTeam=room.side;battleView=room.match.status==='preparing'?'setup':'play';showBattleScreen();return;}
  stopLink();role=saved.role;authority=saved.authority?clone(saved.authority):null;seen=saved.seen||[];room=clone(saved.packet);
  battleMatchId=id;battleTeam=role;battleView=room.match.status==='preparing'?'setup':'play';showBattleScreen();
 }
 async function reconnect(){
  if(!room)throw error('Сначала откройте сохранённую партию.');
  if(connected)throw error('Прямое соединение уже установлено.');
  if(room.match.status==='finished')return;
  await domainReady(Object.keys(room.match.references));
  if(role==='mine')await invite();else showChoose('join',books.find(b=>b.id===room.id));
 }
 document.addEventListener('submit',async event=>{
  if(!['peer-room-form','peer-answer-form'].includes(event.target.id))return;
  event.preventDefault();const form=event.target,button=form.querySelector('[type="submit"]');button.disabled=true;
  try{
   if(form.id==='peer-answer-form'){await link.accept(new FormData(form).get('answer'));return;}
   const data=new FormData(form),mode=form.dataset.mode;saveProfile(data.get('name'));await domainReady();
   if(mode==='create'){
    if(queue.length)throw error('Дождитесь подтверждения изменений.');
    const roster=state.rosters.find(r=>r.id===data.get('roster'));if(!roster)throw error('Выберите сохранённый ростер.');
    stopLink();role='mine';seen=[];const next=domain.createRoom({id:profile.id,name:profile.name},shareRoster(roster));persistAuthority(next);room=null;
    battleMatchId=next.id;battleTeam='mine';battleView='setup';apply(domain.packet(next,profile.id,{live:true}),{force:true});showBattleScreen();await invite();
   }else{
    const offer=MCPPeerLink.decode(data.get('offer'),'offer'),existing=form.dataset.existing?books.find(b=>b.id===form.dataset.existing):books.find(b=>b.id===offer.roomId);
    if(existing&&existing.id!==offer.roomId)throw error('Приглашение от другой партии. Откройте новое подключение.');
    if(existing?.role==='mine')throw error('На этом устройстве вы хозяин этой партии.');
    if(queue.length&&room?.id!==offer.roomId)throw error('Есть неподтверждённые изменения другой партии.');
    const roster=existing?.packet.rosters.opponent||state.rosters.find(r=>r.id===data.get('roster'));if(!roster)throw error('Выберите ростер.');
    guestRoster=shareRoster(roster);role='opponent';authority=null;room=existing?clone(existing.packet):null;
    const next=setLink();peerDialog('Готовим ответ','<p class="battle-small">Собираем параметры соединения…</p>');
    const text=await next.answer(data.get('offer'));if(link===next){answerText=text;showAnswer();}
   }
  }catch(e){showPeerError(e.message);}
  finally{button.disabled=false;}
 });
 document.addEventListener('click',async event=>{
  const b=event.target.closest('[data-peer]');if(!b||b.disabled)return;
  try{
   switch(b.dataset.peer){
    case 'create':showChoose('create');break;
    case 'join':showChoose('join');break;
    case 'close':$('#peer-connect-dialog').close();break;
    case 'copy':{
     const field=document.getElementById(b.dataset.copy);try{await navigator.clipboard.writeText(field.value);toast('Текст скопирован');}catch{field.focus();field.select();toast('Выделен весь текст — скопируйте его.');}break;
    }
    case 'resume':openSaved(b.dataset.id);if(!connected&&room.match.status!=='finished')await reconnect();break;
    case 'reconnect':await reconnect();break;
    case 'ready':enqueue('ready',null,'',{ready:!room.ready[room.side]});break;
   }
  }catch(e){toast(e.message);}
 });
 function enqueue(action,mutate,label,extra={},completion={}){
  if(!active())return false;
  if(role==='opponent'&&!connected){toast('Нет связи с хозяином. Переподключитесь, чтобы менять бой.');return false;}
  queue.push({action,mutate,label,extra,id:crypto.randomUUID(),...completion});refreshControls();drain();return true;
 }
 async function drain(){
  if(sending||!queue.length||!room||role==='opponent'&&!connected)return;
  sending=true;clearTimeout(retry);const job=queue[0];
  try{
   let complete=false;
   for(let attempt=0;attempt<12;attempt++){
    const body={action:job.action,operationId:job.id,revision:room.revision,knownReferences:Object.keys(room.match.references),...job.extra};
    if(job.action==='edit'){
     const {undo,log,...editable}=room.match;const next=clone(editable);
     try{job.mutate(next);}catch{throw error('Партия изменилась: повторите действие.');}
     delete next.references;body.match=next;body.label=job.label;
    }
    try{
     const packet=role==='mine'?await serial(()=>processCommand(profile.id,body)):await rpc('command',body);
     apply(packet);queue.shift();job.resolve?.();complete=true;break;
    }catch(e){if(e.status===409&&e.data?.room){apply(e.data.room);continue;}throw e;}
   }
   if(!complete)throw error('Много одновременных изменений. Повторите действие.',409);
  }catch(e){
   if(!e.status){toast('Нет подтверждения. Изменение ждёт переподключения.');retry=setTimeout(drain,2500);return;}
   queue.shift();job.reject?.(e);toast(e.message);
  }finally{sending=false;refreshControls();}
  if(queue.length)drain();
 }
 let heartbeat;function startHeartbeat(){clearInterval(heartbeat);heartbeat=setInterval(()=>{if(role==='mine'&&connected&&authority)broadcast(true).catch(connectionError);},10000);}startHeartbeat();
 window.addEventListener('beforeunload',e=>{if(queue.length||connected){e.preventDefault();e.returnValue='';}});
 window.addEventListener('pagehide',()=>{clearInterval(heartbeat);stopLink();});
 window.addEventListener('pageshow',startHeartbeat);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&role==='mine'&&connected)broadcast(true).catch(connectionError);});
 return {
  available:()=>true,active,current,ownSide,label,home,header,setup,
  list:async()=>{if(screen==='battle'&&battleView==='home')renderBattle();},
  isPeer:id=>books.some(b=>b.id===id),
  canUndo:()=>!!room?.undoCount,
  get pending(){return queue.length;},
  edit:(text,fn)=>enqueue('edit',fn,text),undo:()=>enqueue('undo'),
  finish:()=>new Promise((resolve,reject)=>{if(!enqueue('edit',next=>{next.status='finished';},'Партия завершена',{},{resolve,reject}))reject(Error('Нет соединения.'));}),
  round:(round,priority,power)=>enqueue('round',null,'',{round,priority,power}),
  power:(round,repeat)=>enqueue('power',null,'',{round,repeat}),
  roster:side=>active()?room.rosters[side]:null,
  // Read-only diagnostics, without ICE addresses or connection codes.
  diagnostics:async()=>({role,connected,snapshotsReceived,lastFullSyncAt,revision:room?.revision,pending:queue.length,connectionState:link?.pc.connectionState,iceState:link?.pc.iceConnectionState,signalingState:link?.pc.signalingState,connection:await link?.stats()})
 };
})();
