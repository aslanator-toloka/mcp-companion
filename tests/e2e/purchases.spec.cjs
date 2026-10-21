'use strict';
const {test,expect}=require('@playwright/test');
const http=require('node:http'),path=require('node:path'),express=require('express');
let server,origin;
test.beforeAll(async()=>{if(process.env.MCP_PURCHASE_TEST_ORIGIN){origin=process.env.MCP_PURCHASE_TEST_ORIGIN;return;}const app=express();app.use('/mcp-companion',express.static(path.resolve(__dirname,'../..')));server=http.createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}/mcp-companion/`;});
test.afterAll(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}});
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('mcp-companion-catalog-v1')));
const seed={version:1,owned:['hulk'],rosters:[{id:'saved-roster',name:'Saved roster',characters:['hulk'],tactics:[],crises:[],groups:[],affiliation:'Avengers'}],groups:[]};
test('tournament arrow opens catalog; box contents, wishlist, reload, tabs and JSON migration work without shop links',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.addInitScript(value=>{if(!localStorage.getItem('mcp-companion-catalog-v1'))localStorage.setItem('mcp-companion-catalog-v1',JSON.stringify(value));},seed);
  await page.goto(origin+'#character=spider-man-noir');await expect(page.locator('nav [data-action="purchases"]')).toBeEnabled();
  await expect(page.locator('#tournaments-screen')).toBeVisible();
  const rosterId=await page.locator('#at-roster-list details').evaluateAll(rows=>rows.map(r=>r.dataset.roster).find(id=>ROSTER_ATLAS.rosters.find(r=>r.id===id)?.kind==='encoded'));
  const tournamentRoster=page.locator(`#at-roster-list details[data-roster="${rosterId}"]`);await tournamentRoster.locator('summary').click();
  const rosterArrow=tournamentRoster.locator('.at-roster-catalog-arrow[data-slug="spider-man-noir"]');await expect(rosterArrow).toBeVisible();
  await page.screenshot({path:path.resolve(__dirname,'../../previews/tournament-roster-character-arrows.png'),fullPage:false});
  await rosterArrow.click();
  await expect(page.locator('#catalog-screen')).toBeVisible();await expect(page.locator('nav [data-action="all"]')).toHaveClass(/selected/);await expect(page.locator('#character-dialog h2')).toHaveText('Spider-Man Noir');
  const set=page.locator('#character-dialog [data-box-set="CP170"]');await expect(set).toContainText('Silk, Spider-Man Noir & Spider-Ham');
  await set.locator('[data-box-code]').click();const box=page.locator('#box-set-dialog');await expect(box).toBeVisible();
  await expect(box.locator('.box-set-member')).toHaveCount(3);await expect(box).toContainText('Silk');await expect(box).toContainText('Spider-Ham');
  await expect.poll(()=>box.locator('.box-set-image').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await expect(box.locator('a[href*="asmodee"]')).toHaveCount(0);await expect(box.getByText('Купить',{exact:true})).toHaveCount(0);
  const plan=box.locator('[data-wishlist-code="CP170"]');await expect(plan).toHaveAttribute('aria-pressed','false');await plan.click();await expect(plan).toHaveAttribute('aria-pressed','true');
  expect((await saved(page)).wishlist).toEqual(['CP170']);expect((await saved(page)).owned).toEqual(seed.owned);expect((await saved(page)).rosters).toEqual(seed.rosters);
  await page.screenshot({path:path.resolve(__dirname,'../../previews/box-set-detail.png'),fullPage:false});
  await box.getByRole('button',{name:'Закрыть набор',exact:true}).click();await page.locator('#character-dialog [data-action="purchases"]').click();
  await expect(page.locator('#purchases-screen')).toBeVisible();await expect(page.locator('nav [data-action="purchases"]')).toHaveClass(/selected/);await expect(page.locator('#purchases-screen [data-box-set]')).toHaveCount(1);
  await page.reload();await expect(page.locator('#purchases-screen [data-box-set="CP170"]')).toBeVisible();
  // A second tab receives the same wishlist through the existing storage event.
  const other=await context.newPage();await other.goto(origin+'#screen=purchases');await expect(other.locator('#purchases-screen [data-box-set="CP170"]')).toBeVisible();
  await page.locator('[data-purchase-tab="all"]').click();await page.locator('#purchase-search').fill('Abomination');await expect(page.locator('#purchases-screen [data-box-set]')).toHaveCount(1);
  await page.locator('#purchases-screen [data-wishlist-code="CP162"]').click();expect((await saved(page)).wishlist.sort()).toEqual(['CP162','CP170']);await expect(other.locator('#purchases-screen [data-box-set]')).toHaveCount(2);await other.close();
  await page.locator('[data-purchase-tab="wishlist"]').click();await page.screenshot({path:path.resolve(__dirname,'../../previews/purchases-wishlist.png'),fullPage:false});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#purchases-screen [data-box-code="CP170"]').click();await box.locator('[data-action="catalog-character"][data-slug="silk"]').click();await expect(page.locator('#character-dialog h2')).toHaveText('Silk');await expect(box).not.toBeVisible();
  await page.getByRole('button',{name:'Закрыть карточку',exact:true}).click();await page.locator('nav [data-action="purchases"]').click();await page.locator('#purchases-screen [data-wishlist-code="CP162"]').click();await expect(page.locator('#purchases-screen [data-box-set="CP162"]')).toHaveCount(0);
  await page.locator('nav [data-action="data"]').click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Экспорт JSON',exact:true}).click();const file=await download;const fs=require('node:fs');const exported=JSON.parse(fs.readFileSync(await file.path(),'utf8'));expect(exported.wishlist).toEqual(['CP170']);expect(exported.owned).toEqual(['hulk']);
  await page.locator('#import-file').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(seed))});await page.getByRole('button',{name:'Восстановить',exact:true}).click();expect((await saved(page)).wishlist).toEqual([]);await expect(page.locator('#purchases-screen .purchase-empty')).toBeVisible();
  expect(errors).toEqual([]);
 }finally{await context.close();}
});
test('navigation to purchases preserves the unsaved-roster confirmation',async({browser})=>{
 const context=await browser.newContext(),page=await context.newPage();
 try{
  await page.addInitScript(value=>localStorage.setItem('mcp-companion-catalog-v1',JSON.stringify(value)),seed);await page.goto(origin+'#screen=rosters');await page.locator('[data-rs="edit"]').first().click();await page.locator('#editor-name').fill('Changed draft');
  await page.locator('nav [data-action="purchases"]').click();await expect(page.locator('#roster-action-dialog')).toBeVisible();await expect(page.locator('#purchases-screen')).not.toBeVisible();
  await page.locator('[data-rs="save-leave"]').click();await expect(page.locator('#purchases-screen')).toBeVisible();expect((await saved(page)).rosters[0].name).toBe('Changed draft');
 }finally{await context.close();}
});
test('planned labels are yellow, purchased boxes own their characters, and undo keeps manual ownership across tabs',async({browser})=>{
 const context=await browser.newContext({viewport:{width:1280,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  const initial={...seed,owned:['hulk','spider-man-noir'],wishlist:['CP170']};
  await page.addInitScript(value=>{if(!localStorage.getItem('mcp-companion-catalog-v1'))localStorage.setItem('mcp-companion-catalog-v1',JSON.stringify(value));},initial);
  await page.goto(origin+'#character=silk');await expect(page.locator('nav [data-action="purchases"]')).toBeEnabled();
  const status=page.locator('#at-character-overview .at-ownership-tag');await expect(status).toHaveText('Запланирован');await expect(status).toHaveCSS('background-color','rgb(255, 241, 184)');expect((await saved(page)).owned).not.toContain('silk');
  const rosterId=await page.locator('#at-roster-list details').evaluateAll(rows=>rows.map(r=>r.dataset.roster).find(id=>ROSTER_ATLAS.rosters.find(r=>r.id===id)?.kind==='encoded'));
  const roster=page.locator(`#at-roster-list details[data-roster="${rosterId}"]`);await roster.locator('summary').click();
  const silkRow=roster.locator('li').filter({has:page.locator('[data-character="silk"]')});await expect(silkRow.locator('.at-ownership-tag')).toHaveText('Запланирован');
  await silkRow.scrollIntoViewIfNeeded();await page.screenshot({path:path.resolve(__dirname,'../../previews/planned-character-status.png'),fullPage:false});
  await roster.locator('[data-action="catalog-character"][data-slug="silk"]').click();await page.locator('#character-dialog [data-box-code="CP170"]').click();
  const box=page.locator('#box-set-dialog'),member=slug=>box.locator(`.box-set-member[data-slug="${slug}"] .character-collection-status`);
  await expect(member('silk')).toHaveText('Запланирован');await expect(member('spider-man-noir')).toHaveText('Есть у меня');
  const bought=box.locator('[data-purchased-code="CP170"]');await bought.click();await expect(bought).toHaveAttribute('aria-pressed','true');await expect(box.locator('.character-collection-status.is-owned')).toHaveCount(3);await expect(page.locator('#detail-owned')).toBeChecked();await expect(page.locator('#detail-owned')).toBeDisabled();
  const value=await saved(page);expect(value.purchasedSets).toEqual(['CP170']);expect(value.wishlist).toEqual([]);expect(value.manuallyOwned).toEqual(initial.owned);expect(value.owned.sort()).toEqual(['hulk','silk','spider-ham','spider-man-noir']);
  await page.screenshot({path:path.resolve(__dirname,'../../previews/purchased-box.png'),fullPage:false});
  const other=await context.newPage();await other.goto(origin+'#screen=mine');await expect(other.locator('#characters .character-row')).toHaveCount(4);
  await box.getByRole('button',{name:'Закрыть набор',exact:true}).click();await page.getByRole('button',{name:'Закрыть карточку',exact:true}).click();await page.locator('nav [data-action="purchases"]').click();await page.locator('[data-purchase-tab="purchased"]').click();await expect(page.locator('#purchases-screen [data-box-set="CP170"]')).toBeVisible();
  await page.reload();await page.locator('[data-purchase-tab="purchased"]').click();await page.locator('#purchases-screen [data-box-code="CP170"]').click();await box.locator('[data-purchased-code="CP170"]').click();
  await expect(member('silk')).toHaveText('Нет в коллекции');await expect(member('spider-man-noir')).toHaveText('Есть у меня');expect((await saved(page)).owned).toEqual(initial.owned);await expect(other.locator('#characters .character-row')).toHaveCount(2);await other.close();
  await box.locator('[data-wishlist-code="CP170"]').click();await expect(member('silk')).toHaveText('Запланирован');await expect(member('spider-man-noir')).toHaveText('Есть у меня');expect((await saved(page)).owned).toEqual(initial.owned);
  expect(errors).toEqual([]);
 }finally{await context.close();}
});
