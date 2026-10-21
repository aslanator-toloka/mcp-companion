'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Core=require('../battle-core.js'),Phase=require('../power-phase.js');
const root=path.resolve(__dirname,'..'),catalog=JSON.parse(fs.readFileSync(path.join(root,'data/catalog.json')));
function fixture(slugs){
 const m={id:'power',status:'active',round:1,threat:30,name:'Power test',score:{mine:0,opponent:0},priority:'mine',references:{},mine:{fighters:[],tactics:[],leader:null},opponent:{fighters:[],tactics:[],leader:null},undo:[],log:[]};
 for(const slug of slugs){const detail=JSON.parse(fs.readFileSync(path.join(root,'data/cards',slug+'.json'))),info=catalog.characters.find(c=>c.slug===slug);m.references[slug]=detail;m.mine.fighters.push(Core.fighter(info,detail,slug));}
 return m;
}
const totals=m=>Phase.calculate(m).rows.map(r=>r.after);
test('printed immunity lists follow the current side and form without changing the match',()=>{
 const m=fixture(['abomination','phoenix','emma-frost','captain-america']),[abomination,phoenix,emma,cap]=m.mine.fighters,before=JSON.stringify(m);
 assert.deepEqual(Phase.immunities(m,abomination),['Poison']);
 assert.deepEqual(Phase.immunities(m,phoenix),['Incinerate','Poison']);
 assert.deepEqual(Phase.immunities(m,emma),[]);assert.deepEqual(Phase.immunities(m,cap),[]);
 assert.equal(JSON.stringify(m),before);
 phoenix.face='back';assert.deepEqual(Phase.immunities(m,phoenix),['Incinerate','Poison','Stagger','Stun']);
 emma.form=1;assert.deepEqual(Phase.immunities(m,emma),['Bleed','Incinerate','Poison','Stun']);
});
test('immunity to all special conditions also prevents Poison and Stun during Power Phase',()=>{
 const m=fixture(['apocalypse']),f=m.mine.fighters[0];f.face='back';
 assert.deepEqual(Phase.immunities(m,f),['Special Conditions']);
 const withoutConditions=Phase.calculate(m).rows[0].after;f.conditions=['Poison','Stun'];
 assert.equal(Phase.immune(m,f,'Poison'),true);assert.equal(Phase.immune(m,f,'Stun'),true);
 assert.equal(Phase.calculate(m).rows[0].after,withoutConditions);
});
test('fixed bonuses are read from real cards: Hulk 3, Thor 2, Jean 3, Captain America 1',()=>{
 assert.deepEqual(totals(fixture(['hulk','thor-prince-of-asgard','jean-grey','captain-america'])),[3,2,3,1]);
});
test('Poison is applied after fixed gains and the 10-power limit; previews do not mutate the battle',()=>{
 const m=fixture(['captain-america']),f=m.mine.fighters[0];f.conditions=['Poison'];assert.deepEqual(totals(m),[0]);
 f.power=10;assert.deepEqual(totals(m),[9]);assert.equal(f.power,10);Phase.apply(m);assert.equal(f.power,9);assert.equal(m.powerPhaseRound,1);
});
test('Stun caps the combined fixed gain, while actual immunity prevents Poison/Stun effects',()=>{
 const m=fixture(['jean-grey','hulk','thor-prince-of-asgard']);m.mine.fighters.forEach(f=>f.conditions=['Stun','Poison']);
 assert.deepEqual(totals(m),[0,3,1]);
 assert.equal(Phase.immune(m,m.mine.fighters[2],'Stun'),true);
});
test('current card side matters and non-fixed abilities never change power, tokens, HP or conditions',()=>{
 const m=fixture(['phoenix','green-goblin','mephisto-lord-of-temptation','magneto','sentinel-prime-mk4']);
 m.mine.fighters[0].face='back';m.mine.fighters[1].face='back';m.mine.fighters[4].face='back';
 m.mine.fighters.forEach(f=>f.powerState={phoenix:4,devilsDeal:3,metal:2});const before=Core.clone(m);
 assert.deepEqual(totals(m),[1,1,1,1,1]);Phase.apply(m);
 for(let i=0;i<m.mine.fighters.length;i++){const f=m.mine.fighters[i],old=before.mine.fighters[i];assert.deepEqual(f.powerState,old.powerState);assert.equal(f.hp,old.hp);assert.deepEqual(f.conditions,old.conditions);}
});
test('compulsory Dormammu leadership adds fixed power to the squad until KO; both teams are independent',()=>{
 const m=fixture(['dormammu','hulk','captain-america']);assert.deepEqual(totals(m),[2,4,2]);
 m.mine.fighters[0].status='dazed';assert.deepEqual(totals(m),[0,4,2]);
 m.mine.fighters[0].status='ko';assert.deepEqual(totals(m),[0,3,1]);
 const enemy=fixture(['thor-prince-of-asgard']);m.references={...m.references,...enemy.references};m.opponent.fighters=enemy.mine.fighters;assert.deepEqual(totals(m),[0,3,1,2]);
});
test('a combined next round applies the new Injured side and cleared conditions before power, and can undo as one action',()=>{
 const m=fixture(['captain-america','hulk']);m.mine.fighters[0].status='dazed';m.mine.fighters[0].hp=0;m.mine.fighters[0].conditions=['Poison'];
 const next=Core.update(m,'round',n=>{Core.nextRound(n);Phase.apply(n);},'later');
 assert.deepEqual(next.mine.fighters.map(f=>f.power),[1,3]);assert.equal(next.mine.fighters[0].face,'back');assert.equal(next.mine.fighters[0].hp,7);
 const reverted=Core.undo(next,'after');assert.equal(reverted.round,1);assert.equal(reverted.mine.fighters[0].status,'dazed');assert.deepEqual(reverted.mine.fighters[0].conditions,['Poison']);assert.deepEqual(reverted.mine.fighters.map(f=>f.power),[0,0]);
});
test('all real fixed bonus abilities in the catalog use the shared calculation on their printed side',()=>{
 let count=0;
 for(const p of fs.readdirSync(path.join(root,'data/cards'))){
  const detail=JSON.parse(fs.readFileSync(path.join(root,'data/cards',p)));
  for(const card of [detail.statCard,detail.secondStatCard].filter(Boolean))for(const face of [card.frontSide,card.backSide].filter(Boolean)){
   for(const power of face.superPowers||[]){
    const text=Phase.plain(power.body),n=text.match(/gains (\d+) additional power\./i);
    if(Phase.isPhase(power)&&power.type!=='leadership'&&n){assert.equal(Phase.fixedBonus(power),Number(n[1]),p+' '+power.name);count++;}
   }
  }
 }
 assert(count>70);
});
