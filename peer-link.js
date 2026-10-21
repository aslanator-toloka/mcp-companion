/* Direct LAN data channel. Invitation/answer are exchanged manually, no signalling server. */
(function(root){
 'use strict';
 const PREFIX='MCP-LAN-1.',MAX_SIGNAL=32000,MAX_PACKET=8*1024*1024,CHUNK=4000;
 function encode(value){return PREFIX+btoa(JSON.stringify(value));}
 function decode(text,kind){
  const value=String(text||'').replace(/\s/g,'');
  if(value.length>MAX_SIGNAL||!value.startsWith(PREFIX))throw Error('Вставьте полный текст подключения MCP-LAN-1.');
  let packet;try{packet=JSON.parse(atob(value.slice(PREFIX.length)));}catch{throw Error('Текст подключения повреждён. Скопируйте его целиком.');}
  if(packet.v!==1||packet.kind!==kind||!/^[-a-f0-9]{36}$/i.test(packet.roomId||'')||!/^[-a-f0-9]{36}$/i.test(packet.session||'')||typeof packet.sdp!=='string'||packet.sdp.length>24000||!/^v=0\r?\n/.test(packet.sdp))throw Error(kind==='offer'?'Нужно приглашение хозяина.':'Нужен ответ второго игрока.');
  return packet;
 }
 class Link {
  constructor({onState=()=>{},onMessage=()=>{}}={}){
   if(!root.RTCPeerConnection)throw Error('Этот браузер не поддерживает WebRTC. Откройте сайт в Safari, Chrome или Firefox.');
   this.onState=onState;this.onMessage=onMessage;this.closed=false;this.parts=new Map();this.sending=Promise.resolve();this.signal=null;
   this.pc=new RTCPeerConnection({iceServers:[],bundlePolicy:'max-bundle'});
   this.pc.onconnectionstatechange=()=>{const s=this.pc.connectionState;if(['disconnected','failed','closed'].includes(s))this.onState(s);};
   this.pc.ondatachannel=e=>this.attach(e.channel);
  }
  attach(channel){
   if(this.channel){channel.close();return;}
   this.channel=channel;channel.bufferedAmountLowThreshold=65536;
   channel.onopen=()=>this.onState('connected');
   channel.onclose=()=>this.onState(this.closed?'closed':'disconnected');
   channel.onerror=()=>this.onState('failed');
   channel.onmessage=e=>{
    try{
     if(typeof e.data!=='string'||e.data.length>30000)throw Error('Некорректный пакет соединения.');
     const f=JSON.parse(e.data);
     if(!Array.isArray(f)||f.length!==5||typeof f[0]!=='string'||!Number.isInteger(f[1])||!Number.isInteger(f[2])||f[2]<1||f[2]>2100||f[1]<0||f[1]>=f[2]||typeof f[3]!=='string'||f[3].length>CHUNK||f[4]!==1)throw Error('Некорректная часть сообщения.');
     const now=Date.now();for(const [id,p]of this.parts)if(now-p.at>20000)this.parts.delete(id);
     let p=this.parts.get(f[0]);
     if(!p){if(f[1]!==0||this.parts.size>=4)throw Error('Нарушен порядок сообщений.');p={chunks:[],n:f[2],size:0,at:now};this.parts.set(f[0],p);}
     if(p.n!==f[2]||f[1]!==p.chunks.length)throw Error('Нарушен порядок частей.');
     p.chunks.push(f[3]);p.size+=f[3].length;if(p.size>MAX_PACKET)throw Error('Слишком большая партия.');
     if(p.chunks.length===p.n){this.parts.delete(f[0]);this.onMessage(JSON.parse(p.chunks.join('')));}
    }catch(error){this.onState('invalid');this.close();}
   };
  }
  async gathered(){
   if(this.pc.iceGatheringState!=='complete')await new Promise((resolve,reject)=>{
    const done=()=>{if(this.pc.iceGatheringState==='complete'){cleanup();resolve();}};
    const closed=()=>{if(this.pc.signalingState==='closed'){cleanup();reject(Error('Подключение закрыто. Создайте приглашение снова.'));}};
    const timer=setTimeout(()=>{cleanup();reject(Error('Не удалось собрать адреса локальной сети. Проверьте Wi-Fi и повторите.'));},10000);
    const cleanup=()=>{clearTimeout(timer);this.pc.removeEventListener('icegatheringstatechange',done);this.pc.removeEventListener('signalingstatechange',closed);};
    this.pc.addEventListener('icegatheringstatechange',done);this.pc.addEventListener('signalingstatechange',closed);done();
   });
   if(!this.pc.localDescription?.sdp.includes('a=candidate:'))throw Error('Браузер не предоставил адреса для прямой связи. Проверьте разрешение локальной сети; эта сеть или браузер может блокировать WebRTC.');
   return this.pc.localDescription.sdp;
  }
  async offer(roomId){
   this.attach(this.pc.createDataChannel('mcp-battle',{ordered:true}));
   this.signal={v:1,kind:'offer',roomId,session:crypto.randomUUID()};
   await this.pc.setLocalDescription(await this.pc.createOffer());
   const result=encode({...this.signal,sdp:await this.gathered()});this.onState('waiting');return result;
  }
  async answer(text){
   const offer=decode(text,'offer');this.signal=offer;
   await this.pc.setRemoteDescription({type:'offer',sdp:offer.sdp});
   await this.pc.setLocalDescription(await this.pc.createAnswer());
   const result=encode({v:1,kind:'answer',roomId:offer.roomId,session:offer.session,sdp:await this.gathered()});this.onState('connecting');return result;
  }
  async accept(text){
   const answer=decode(text,'answer');
   if(answer.roomId!==this.signal?.roomId||answer.session!==this.signal?.session)throw Error('Этот ответ относится к другому приглашению.');
   if(this.pc.signalingState!=='have-local-offer')throw Error('Ответ уже принят. Для повторного подключения создайте новое приглашение.');
   await this.pc.setRemoteDescription({type:'answer',sdp:answer.sdp});this.onState('connecting');
  }
  get connected(){return !this.closed&&this.channel?.readyState==='open';}
  async writable(){
   const channel=this.channel;if(!this.connected)throw Error('Нет прямого соединения.');
   if(channel.bufferedAmount<262144)return;
   await new Promise((resolve,reject)=>{
    const low=()=>{cleanup();resolve();},closed=()=>{cleanup();reject(Error('Соединение прервано.'));};
    const timer=setTimeout(()=>{cleanup();reject(Error('Передача задержалась. Переподключитесь.'));},10000);
    const cleanup=()=>{clearTimeout(timer);channel.removeEventListener('bufferedamountlow',low);channel.removeEventListener('close',closed);};
    channel.addEventListener('bufferedamountlow',low,{once:true});channel.addEventListener('close',closed,{once:true});
    if(channel.bufferedAmount<262144)low();
   });
  }
  send(value){
   const send=async()=>{
    const text=JSON.stringify(value);if(text.length>MAX_PACKET)throw Error('Партия слишком велика для прямой передачи.');
    const id=crypto.randomUUID(),n=Math.max(1,Math.ceil(text.length/CHUNK));
    for(let i=0;i<n;i++){await this.writable();this.channel.send(JSON.stringify([id,i,n,text.slice(i*CHUNK,(i+1)*CHUNK),1]));}
   };
   const result=this.sending.then(send);this.sending=result.catch(()=>{});return result;
  }
  async stats(){
   const report=await this.pc.getStats();let pair;
   report.forEach(s=>{if(s.type==='transport'&&s.selectedCandidatePairId)pair=report.get(s.selectedCandidatePairId);});
   if(!pair)report.forEach(s=>{if(s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated)pair=s;});
   if(!pair)return null;
   const local=report.get(pair.localCandidateId),remote=report.get(pair.remoteCandidateId);
   return {local:local?.candidateType,remote:remote?.candidateType,protocol:local?.protocol,rtt:pair.currentRoundTripTime};
  }
  close(){if(this.closed)return;this.closed=true;this.parts.clear();this.channel?.close();this.pc.close();this.onState('closed');}
 }
 root.MCPPeerLink={Link,decode};if(typeof module==='object'&&module.exports)module.exports=root.MCPPeerLink;
})(typeof window==='object'?window:globalThis);
