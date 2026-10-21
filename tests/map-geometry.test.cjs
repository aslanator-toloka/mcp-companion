'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../map-geometry.js'),data=JSON.parse(fs.readFileSync('data/map-layouts.json'));
const raw=JSON.parse(fs.readFileSync('data/roster-cards.json'));
const card=name=>raw.crises.find(c=>c.slug===name);
const catalog=new Map([['captain-america',{baseSize:35,name:'Captain America'}]]);
function match(){return {secure:card('gamma-wave-sweeps-across-midwest-ca09'),extract:card('alien-ship-crashes-in-downtown-ca09'),mine:{fighters:[{id:'cap',slug:'captain-america',name:'Captain America',status:'ready',form:0}]},opponent:{fighters:[]}};}
test('27 source layouts cover all crisis cards; E and C use verified center coordinates',()=>{
 assert.equal(Object.keys(data.layouts).length,27);
 for(const c of raw.crises)assert(data.layouts[c.setup],c.slug+' '+c.setup);
 assert.deepEqual(data.layouts.E,[{x:18,y:10},{x:18,y:18},{x:18,y:26}]);
 assert.deepEqual(data.layouts.C,[{x:6,y:18},{x:18,y:18},{x:30,y:18}]);
 for(const points of Object.values(data.layouts))for(const p of points)assert(p.x>=0&&p.x<=36&&p.y>=0&&p.y<=36);
});
test('coincident Secure and Extract goals remain independent with zero distance and distinct colors',()=>{
 const goals=G.points(match(),data.layouts,catalog);assert.equal(goals.length,6);
 const a=goals.find(p=>p.code==='S2'),b=goals.find(p=>p.code==='E2');assert.equal(G.distance(a,b),0);assert.notEqual(a.id,b.id);assert.notEqual(a.color,b.color);
 assert.equal(G.distance(goals.find(p=>p.code==='E1'),goals.find(p=>p.code==='E3')),24);
 assert.equal(G.distance(goals.find(p=>p.code==='S1'),goals.find(p=>p.code==='S3')),16);
});
test('models have no invented position; known bases use millimeters and distances between edges',()=>{
 const m=match();assert.equal(G.points(m,data.layouts,catalog).filter(p=>p.kind==='fighter').length,0);
 m.map={edge:'south',positions:{cap:{x:18,y:29.4}},objectives:{},pins:[]};const f=G.points(m,data.layouts,catalog).find(p=>p.kind==='fighter');
 assert.equal(f.radius,35/25.4/2);assert(G.zoneDistance(f,'south')>0);assert.equal(G.zoneDistance(f,'south','bases'),0);
 const d=G.distance(f,{x:18,y:26,radius:0},'bases');assert(Math.abs(d-(3.4-f.radius))<1e-9);
});
test('movement overlays apply only to the chosen goal and cannot override static role or colors',()=>{
 const m=match(),s=G.points(m,data.layouts,catalog).find(p=>p.code==='S2');
 m.map={edge:'east',positions:{},objectives:{[s.id]:{x:12,y:15,color:'evil',role:'evil'}},pins:[]};
 const goals=G.points(m,data.layouts,catalog);assert.equal(goals.find(p=>p.code==='S2').x,12);assert.equal(goals.find(p=>p.code==='E2').x,18);assert.equal(goals.find(p=>p.code==='S2').color,G.palette.secure);
 assert.equal(G.opposite.east,'west');assert.deepEqual(G.zone('east'),{x:30,y:0,w:6,h:36});
});
test('Research Station has separate researcher and evacuation roles; Terrigen clouds omit the center',()=>{
 const researcher=raw.crises.find(c=>c.cardFamily==='research-station-attacked'),cloud=raw.crises.find(c=>c.cardFamily==='terrigen-clouds-sweep-over-city');
 const points=G.missionPoints(researcher,'extract',data.layouts);assert.deepEqual(points.map(p=>p.role),['evac','researcher','evac']);
 assert.equal(G.missionPoints(cloud,'secure',data.layouts).length,2);
});
test('distance is Euclidean and symmetric, segments measure edges, and invalid saved coordinates are rejected',()=>{
 const a={x:2,y:2,radius:1},b={x:5,y:6,radius:.5};assert.equal(G.distance(a,b),5);assert.equal(G.distance(a,b,'bases'),3.5);assert.equal(G.distance(a,b),G.distance(b,a));
 const ends=G.segment(a,b,'bases');assert(Math.abs(G.distance(ends.a,ends.b)-3.5)<1e-9);
 const state={edge:'south',positions:{},objectives:{},pins:[{id:'p',name:'Corner',x:10,y:11}]};G.validate(state);state.pins[0].x=37;assert.throws(()=>G.validate(state));
});
test('edge and starting-zone references use perpendicular nearest points for either deployment orientation',()=>{
 const p={x:12,y:20,radius:0},refs=G.references(p,'south');
 assert.deepEqual(refs.map(r=>r.distance),[20,16,12,24,10,14]);
 for(const r of refs)assert.equal(G.distance(p,r.target),r.distance);
 const rotated=G.references(p,'east').filter(r=>r.kind==='zone');assert.deepEqual(rotated.map(r=>r.distance),[18,6]);assert.deepEqual(rotated.map(r=>r.target),[{x:30,y:20},{x:6,y:20}]);
});
