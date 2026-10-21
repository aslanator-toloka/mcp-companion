'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Core=require('../battle-core.js');
const root=path.resolve(__dirname,'..'),catalog=JSON.parse(fs.readFileSync(path.join(root,'data/catalog.json')));
function fixture(slugs=['captain-america','hulk']) {
 const m={id:'test',status:'active',name:'Test',createdAt:'now',updatedAt:'now',threat:17,round:1,score:{mine:0,opponent:0},priority:'mine',references:{},mine:{fighters:[],tactics:[]},opponent:{fighters:[],tactics:[]},undo:[],log:[]};
 for(const slug of slugs){const c=catalog.characters.find(c=>c.slug===slug),detail=JSON.parse(fs.readFileSync(path.join(root,'data/cards',slug+'.json')));m.references[slug]=detail;m.mine.fighters.push(Core.fighter(c,detail,slug));}
 return m;
}
test('Dazed changes to real Injured stamina only at next round; ordinary conditions and power remain',()=>{
 const m=fixture(),cap=m.mine.fighters[0],hulk=m.mine.fighters[1];
 cap.hp=0;cap.status='dazed';cap.acted=true;cap.conditions=['Bleed'];cap.power=4;
 hulk.hp=9;hulk.power=6;hulk.conditions=['Shock'];hulk.acted=true;
 assert.equal(cap.face,'front');assert.deepEqual(Core.roundPlan(m).map(p=>p.action),['injured']);
 Core.nextRound(m);
 assert.equal(cap.face,'back');assert.equal(cap.maxHp,7);assert.equal(cap.hp,7);assert.equal(cap.status,'ready');assert.deepEqual(cap.conditions,[]);assert.equal(cap.power,4);
 assert.equal(hulk.hp,9);assert.equal(hulk.power,6);assert.deepEqual(hulk.conditions,['Shock']);assert.equal(hulk.acted,false);assert.equal(m.round,2);
});
test('healthy reverse side is not an Injured side, including Hulk and Phoenix',()=>{
 const m=fixture(['hulk','phoenix']);m.mine.fighters.forEach(f=>{f.status='dazed';f.hp=0;});
 assert.deepEqual(Core.roundPlan(m).map(p=>p.action),['ko','ko']);Core.nextRound(m);assert(m.mine.fighters.every(f=>f.status==='ko'));
});
test('undo restores round, all fighters, score, priority and played cards without duplicating references',()=>{
 const m=fixture();m.mine.fighters[0].status='dazed';m.mine.fighters[0].hp=0;m.mine.tactics=[{slug:'tactic',played:false}];
 const before=Core.snapshot(m),next=Core.update(m,'next',n=>{Core.nextRound(n);n.score.mine=3;n.priority='opponent';n.mine.tactics[0].played=true;},'later');
 assert.equal(m.round,1);assert.equal(next.round,2);assert.equal(next.undo[0].progress.references,undefined);
 const restored=Core.undo(next,'after');delete before.updatedAt;const actual=Core.snapshot(restored);delete actual.updatedAt;
 assert.deepEqual(actual,before);assert.equal(restored.references,next.references);
});
test('resources stay within bounds and form changes preserve damage',()=>{
 const m=fixture(['ant-man']),f=m.mine.fighters[0];Core.counter(f,'hp',-100);assert.equal(f.hp,0);Core.counter(f,'power',100);assert.equal(f.power,10);
 f.hp=f.maxHp-2;Core.changeFace(m,f,'front',1);assert.equal(f.maxHp-f.hp,2);
});
test('setup catches Threat overflow, repeated alter ego and too many tactics',()=>{
 const m=fixture(['captain-america','captain-america-first-avenger']);m.threat=5;m.mine.tactics=Array.from({length:6},(_,i)=>({slug:String(i),played:false}));
 const errors=Core.errors(m);assert(errors.some(e=>e.includes('Threat')));assert(errors.some(e=>e.includes('alter ego')));assert(errors.some(e=>e.includes('пяти')));
});
test('roundtrip includes battle state, rejects bad HP, and undo history stays bounded',()=>{
 let m=fixture();for(let i=0;i<40;i++)m=Core.update(m,'score',n=>n.score.mine++,'later');
 assert.equal(m.undo.length,30);const store=JSON.parse(JSON.stringify({version:1,matches:[m]}));assert.equal(Core.validate(store).matches[0].score.mine,40);
 store.matches[0].mine.fighters[0].hp=999;assert.throws(()=>Core.validate(store));
});
