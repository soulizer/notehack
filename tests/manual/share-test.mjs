import { chromium } from '@playwright/test';
import { EMAIL, PASSWORD } from './config.mjs';
const browser = await chromium.launch({ headless:true });
const ctx = await browser.newContext({ viewport:{width:1440,height:980}, locale:'zh-CN' });
await ctx.addInitScript(()=>localStorage.setItem('nh-locale','zh-CN'));
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('401'))errs.push(m.text())});
await page.goto('http://127.0.0.1:8787/login',{waitUntil:'networkidle'});
await page.fill('#login-email',EMAIL); await page.fill('#login-password',PASSWORD); await page.click('button[type=submit]'); await page.waitForTimeout(1500);
await page.click('.note-item'); await page.waitForTimeout(1200);
await page.click('.topbar-actions .btn-soft'); await page.waitForTimeout(800);
await page.screenshot({path:'/tmp/share-dialog.png',fullPage:true});
await page.click('text=创建分享链接'); await page.waitForTimeout(1500);
const link = await page.locator('.share-link-box input').first().inputValue().catch(()=> 'NO');
console.log('link',link);
await page.screenshot({path:'/tmp/share-dialog2.png',fullPage:true});
if(link && link.startsWith('http')){
  const pub = await browser.newContext({ viewport:{width:1280,height:900}, locale:'zh-CN' });
  const p2 = await pub.newPage();
  p2.on('pageerror',e=>console.log('pub error',e.message));
  await p2.goto(link,{waitUntil:'networkidle'}); await p2.waitForTimeout(800);
  await p2.screenshot({path:'/tmp/share-public.png',fullPage:true});
  console.log('public text', (await p2.locator('body').innerText()).slice(0,500));
}
console.log('errors',errs.slice(0,10));
await browser.close();
