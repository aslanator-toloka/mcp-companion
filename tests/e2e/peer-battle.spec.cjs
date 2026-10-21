'use strict';
const {test,expect}=require('@playwright/test');
const http=require('node:http'),path=require('node:path'),express=require('express');
test.setTimeout(90000);
// Two peers run on this one machine. Allow real UDP loopback without changing
// the user's VPN/firewall. The published client has no such browser flags.
const loopback=process.env.MCP_PEER_REAL_NETWORK!=='1';
if(loopback)test.use({launchOptions:{args:['--allow-loopback-in-peer-connection','--disable-features=WebRtcHideLocalIpsWithMdns']}});
let server,origin;
test.beforeAll(async()=>{if(process.env.MCP_PEER_TEST_ORIGIN){origin=process.env.MCP_PEER_TEST_ORIGIN;return;}const app=express();app.use('/mcp-companion',express.static(path.resolve(__dirname,'../..')));server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}/mcp-companion/`;});
test.afterAll(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}});
async function player(browser,name,slug){
 const context=await browser.newContext({viewport:{width:1280,height:900},...(loopback?{permissions:['camera','microphone']}:{})});
 const page=await context.newPage();const errors=[],api=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
 await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(origin).origin?r.continue():r.abort());
 await page.addInitScript(({name,slug})=>{
  if(!localStorage.getItem('mcp-companion-catalog-v1'))localStorage.setItem('mcp-companion-catalog-v1',JSON.stringify({version:1,owned:[slug],groups:[],rosters:[{id:name+'-roster',name:name+' roster',affiliation:'Avengers',characters:[slug],tactics:['fall-back'],crises:[],groups:[]}]}));
 },{name,slug});
 await page.goto(origin);await expect(page.locator('nav [data-action="battle"]')).toBeEnabled();await page.locator('nav [data-action="battle"]').click();
 return {context,page,name,slug,errors,api};
}
async function create(a){
 await a.page.locator('[data-peer="create"]').click();await a.page.locator('#peer-room-form [name="name"]').fill(a.name);await a.page.locator('#peer-room-form [name="roster"]').selectOption(a.name+'-roster');await a.page.locator('#peer-room-form [type="submit"]').click();
 await expect(a.page.locator('#peer-offer')).toBeVisible();return a.page.locator('#peer-offer').inputValue();
}
async function connect(a,b,offer,{resume=false}={}){
 if(resume)await b.page.locator('#battle-screen [data-peer="reconnect"]').click();else await b.page.locator('[data-peer="join"]').click();
 await b.page.locator('#peer-room-form [name="name"]').fill(b.name);if(!resume)await b.page.locator('#peer-room-form [name="roster"]').selectOption(b.name+'-roster');
 await b.page.locator('#peer-offer-input').fill(offer);await b.page.locator('#peer-room-form [type="submit"]').click();await expect(b.page.locator('#peer-answer')).toBeVisible();const answer=await b.page.locator('#peer-answer').inputValue();
 await a.page.locator('#peer-answer-input').fill(answer);await a.page.locator('#peer-answer-form [type="submit"]').click();
 try{await expect(a.page.locator('#peer-connect-dialog')).not.toBeVisible({timeout:15000});await expect(b.page.locator('#peer-connect-dialog')).not.toBeVisible({timeout:15000});}catch(e){for(const p of [a,b])console.log(p.name,await p.page.evaluate(()=>NetworkBattle.diagnostics()),await p.page.locator('#peer-form-error').innerText(),p.errors);throw e;}for(const p of [a,b])await expect(p.page.locator('.network-connection')).toHaveText('● Прямая связь');
}
async function pick(p,s,slug,kind='characters'){
 await p.page.locator(`#battle-screen [data-bt="pick"][data-side="${s}"][data-kind="${kind}"]`).click();const box=p.page.locator(`#battle-picker-dialog [data-battle-pick="${slug}"]`);await box.check();await expect(box).toBeChecked();await p.page.getByRole('button',{name:'Готово',exact:true}).click();
}
async function side(p,s){await p.page.locator(`.battle-side-tabs [data-bt="team"][data-side="${s}"]`).click();}
async function pair(browser){
 const a=await player(browser,'Alice','captain-america'),b=await player(browser,'Bob','hulk');await connect(a,b,await create(a));await Promise.all([pick(a,'mine',a.slug),pick(b,'opponent',b.slug)]);
 await a.page.locator('[data-peer="ready"]').click();await expect(a.page.locator('[data-peer="ready"]')).toHaveText('Отменить готовность');await b.page.locator('[data-peer="ready"]').click();for(const p of [a,b])await expect(p.page.locator('.battle-dashboard')).toBeVisible();return {a,b};
}
test('WebRTC: handshake, host authority, concurrent actions and reconnect',async({browser})=>{
 const {a,b}=await pair(browser);try{
 const diagnostics=await a.page.evaluate(()=>NetworkBattle.diagnostics());expect(diagnostics.connection.local).toBe('host');expect(diagnostics.connection.remote).toBe('host');await side(b,'mine');
 const hp=a.page.locator('strong[aria-label="HP Captain America"]'),initial=Number(await hp.innerText());await Promise.all([a.page.getByRole('button',{name:'Уменьшить HP Captain America',exact:true}).click(),b.page.getByRole('button',{name:'Уменьшить HP Captain America',exact:true}).click()]);
 for(const p of [a,b])await expect(p.page.locator('strong[aria-label="HP Captain America"]')).toHaveText(String(initial-2));
 const score=p=>p.page.locator('.score-box').filter({has:p.page.locator('[data-bt="score"][data-side="mine"]')}).locator('strong'),add=p=>p.page.locator('[data-bt="score"][data-side="mine"][data-delta="1"]').click();
 await Promise.all([(async()=>{for(let i=0;i<6;i++)await add(a);})(),(async()=>{for(let i=0;i<6;i++)await add(b);})()]);for(const p of [a,b])await expect(score(p)).toHaveText('12');await expect.poll(()=>b.page.evaluate(()=>NetworkBattle.diagnostics().then(x=>x.pending))).toBe(0);
 await a.page.locator('[data-bt="undo"]').click();for(const p of [a,b])await expect(score(p)).toHaveText('11');
 a.page.once('dialog',d=>d.accept());await a.page.reload();await expect(a.page.locator('nav [data-action="battle"]')).toBeEnabled();await a.page.locator('nav [data-action="battle"]').click();await a.page.locator('[data-peer="resume"]').click();await expect(a.page.locator('#peer-offer')).toBeVisible();await connect(a,b,await a.page.locator('#peer-offer').inputValue(),{resume:true});await side(b,'mine');
 for(const p of [a,b])await expect(p.page.locator('strong[aria-label="HP Captain America"]')).toHaveText(String(initial-2));await b.page.getByRole('button',{name:'Уменьшить HP Captain America',exact:true}).click();for(const p of [a,b])await expect(p.page.locator('strong[aria-label="HP Captain America"]')).toHaveText(String(initial-3));
 expect(a.errors).toEqual([]);expect(b.errors).toEqual([]);expect(a.api).toEqual([]);expect(b.api).toEqual([]);
 }finally{await a.context.close();await b.context.close();}
});

test('WebRTC: lost acknowledgement is deduplicated after reconnect; 10-second snapshots preserve DOM',async({browser})=>{
 const {a,b}=await pair(browser);try{
  const score=p=>p.page.locator('.score-box').filter({has:p.page.locator('[data-bt="score"][data-side="mine"]')}).locator('strong');
  // Drop one accepted response at the transport boundary. The next handshake
  // still uses real WebRTC and the retry must retain its operation ID.
  await a.page.evaluate(()=>{
   const send=MCPPeerLink.Link.prototype.send;let drop=true;
   MCPPeerLink.Link.prototype.send=function(message){if(drop&&message.type==='reply'){drop=false;this.close();return Promise.resolve();}return send.call(this,message);};
  });
  await b.page.locator('[data-bt="score"][data-side="mine"][data-delta="1"]').click();
  await expect(score(a)).toHaveText('1');await expect.poll(()=>b.page.evaluate(()=>NetworkBattle.diagnostics().then(d=>d.pending))).toBe(1);
  await expect(a.page.locator('.network-connection')).not.toHaveText('● Прямая связь');
  a.page.once('dialog',d=>d.accept());await a.page.reload();await expect(a.page.locator('nav [data-action="battle"]')).toBeEnabled();await a.page.locator('nav [data-action="battle"]').click();await a.page.locator('[data-peer="resume"]').click();await expect(a.page.locator('#peer-offer')).toBeVisible();
  await connect(a,b,await a.page.locator('#peer-offer').inputValue(),{resume:true});
  await expect.poll(()=>b.page.evaluate(()=>NetworkBattle.diagnostics().then(d=>d.pending))).toBe(0);
  for(const p of [a,b])await expect(score(p)).toHaveText('1');
  const before=await b.page.evaluate(()=>{window.__peerFighter=document.querySelector('[data-fighter]');return NetworkBattle.diagnostics();});
  await expect.poll(()=>b.page.evaluate(()=>NetworkBattle.diagnostics().then(d=>d.lastFullSyncAt)),{timeout:15000}).toBeGreaterThan(before.lastFullSyncAt);
  const after=await b.page.evaluate(()=>NetworkBattle.diagnostics());expect(after.revision).toBe(before.revision);expect(await b.page.evaluate(()=>__peerFighter.isConnected)).toBe(true);
  await b.page.locator('[data-bt="round"]').click();await b.page.locator('[data-bt="confirm-round"]').click();
  for(const p of [a,b])await expect(p.page.locator('.round-label b')).toHaveText('2');
  await b.page.locator('[data-bt="finish"]').click();
  // Finish control is a separate confirmation dialog.
  await b.page.locator('[data-bt="confirm-finish"]').click();
  await expect(a.page.locator('[data-bt="finish"]')).toBeDisabled();
  expect(a.errors).toEqual([]);expect(b.errors).toEqual([]);expect(a.api).toEqual([]);expect(b.api).toEqual([]);
 }finally{await a.context.close();await b.context.close();}
});
