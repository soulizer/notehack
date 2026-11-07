import { chromium } from '@playwright/test';
import { EMAIL, PASSWORD } from './config.mjs';
const browser = await chromium.launch({ headless:true });
const ctx = await browser.newContext({ viewport:{width:1440,height:980}, locale:'zh-CN' });
await ctx.addInitScript(()=>localStorage.setItem('nh-locale','zh-CN'));
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push('PAGE:'+e.message)); page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('401'))errs.push('CONSOLE:'+m.text())});
await page.goto('http://127.0.0.1:8787/login',{waitUntil:'networkidle'});
await page.fill('#login-email',EMAIL); await page.fill('#login-password',PASSWORD); await page.click('button[type=submit]'); await page.waitForTimeout(1800);
// create note
await page.click('.new-note-btn'); await page.waitForTimeout(1200);
const title = page.locator('.note-title-input');
await title.fill('E2E 测试笔记');
const pm = page.locator('.ProseMirror');
await pm.click();
await page.keyboard.type('这是 E2E 测试正文。');
await page.waitForTimeout(1600);
console.log('created url', page.url());
// info panel
await page.click('.topbar-actions button[title="显示信息面板"]');
await page.waitForTimeout(700);
console.log('context open', await page.locator('.context-panel').count());
await page.screenshot({path:'/tmp/core-info.png',fullPage:true});
// add tag
await page.click('.context-add-tag');
await page.fill('.context-section input', 'e2e');
await page.keyboard.press('Enter');
await page.waitForTimeout(1000);
console.log('tag text', (await page.locator('.context-panel').innerText()).slice(0,200));
// comments
await page.click('.context-tab:has-text("评论")'); await page.waitForTimeout(500);
await page.fill('.comment-compose textarea','这是一条 E2E 评论');
await page.click('.comment-compose .btn-primary');
await page.waitForTimeout(800);
console.log('comment count', await page.locator('.context-panel .comment-item').count());
// history
await page.click('.context-tab:has-text("历史")'); await page.waitForTimeout(800);
await page.screenshot({path:'/tmp/core-history.png',fullPage:true});
console.log('history text', (await page.locator('.context-panel').innerText()).slice(0,200));
// command palette
await page.keyboard.press('Control+k'); await page.waitForTimeout(500);
console.log('cmdk', await page.locator('.cmdk').count());
await page.screenshot({path:'/tmp/core-cmdk.png',fullPage:true});
await page.keyboard.press('Escape');
// search
const search = page.locator('.list-search-row input');
await search.fill('E2E'); await page.waitForTimeout(1000);
console.log('search results', await page.locator('.note-item').count());
await search.fill(''); await page.waitForTimeout(700);
console.log('errors', errs.slice(0,15));
await browser.close();
