'use strict';
const {test,expect}=require('@playwright/test');
const http=require('node:http'),path=require('node:path'),express=require('express');
let server,origin;
test.beforeAll(async()=>{if(process.env.MCP_BACKGROUND_TEST_ORIGIN){origin=process.env.MCP_BACKGROUND_TEST_ORIGIN;return;}const app=express();app.use('/mcp-companion',express.static(path.resolve(__dirname,'../..')));server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}/mcp-companion/`;});
test.afterAll(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}});
test('Jarvis textures load for Healthy, Injured, classic and grunt cards; custom backgrounds remain independent',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const card=page.locator('.sc-card');
 async function open(slug){await page.locator('#search').fill('');await page.locator(`#characters [data-action="character"][data-slug="${slug}"]`).click();await expect(card).toBeVisible();}
 async function background(file,template){
  await expect(card).toHaveAttribute('data-card-template',template);
  await expect.poll(()=>card.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('/assets/card-backgrounds/'+file);
  expect(await card.evaluate(async el=>{const src=getComputedStyle(el).backgroundImage.match(/url\(["']?([^"')]+)/)[1],img=new Image();img.src=src;await img.decode();return img.naturalWidth>0;})).toBe(true);
 }
 try{
  await page.goto(origin+'#screen=catalog');await expect(page.locator('#search')).toBeEnabled();
  await open('moondragon');await background('healthy-2023.png','2023');
  await page.evaluate(()=>document.fonts.ready);await expect.poll(()=>page.locator('.sc-art img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await page.screenshot({path:path.resolve(__dirname,'../../previews/card-texture-healthy.png'),fullPage:false});
  await page.getByRole('button',{name:'Injured · ранен',exact:true}).click();await background('injured-2023.png','2023');await expect.poll(()=>page.locator('.sc-art img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await page.screenshot({path:path.resolve(__dirname,'../../previews/card-texture-injured.png'),fullPage:false});
  await page.getByRole('button',{name:'Закрыть карточку',exact:true}).click();await open('shuri');
  await background('healthy-classic.png','classic');await page.getByRole('button',{name:'Injured · ранен',exact:true}).click();await background('injured-classic.png','classic');
  await page.getByRole('button',{name:'Закрыть карточку',exact:true}).click();await open('hand-ninjas-grunts');await background('grunt.png','grunt');
  await page.getByRole('button',{name:'Обратная сторона',exact:true}).click();await background('grunt.png','grunt');
  await page.getByRole('button',{name:'Закрыть карточку',exact:true}).click();await open('spider-man-noir');
  await expect(page.locator('.sc-skin-background')).toBeVisible();
  await page.locator('[data-card-skin-layer="background"]').uncheck();await expect(page.locator('.sc-skin-background')).toHaveCount(0);await background('healthy-2023.png','2023');
  await page.locator('[data-card-skin-layer="background"]').check();await expect(page.locator('.sc-skin-background')).toBeVisible();
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
 }finally{await context.close();}
});
