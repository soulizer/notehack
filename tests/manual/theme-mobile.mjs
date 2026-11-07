import { chromium } from '@playwright/test';
import { EMAIL, PASSWORD } from './config.mjs';
const browser=await chromium.launch({headless:true});
// dark desktop
{
 const ctx=await browser.newContext({viewport:{width:1440,height:980},locale:'zh-CN'});
 await ctx.addInitScript(()=>{localStorage.setItem('nh-locale','zh-CN');localStorage.setItem('nh-theme','dark')});
 const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
 await page.goto('http://127.0.0.1:8787/login',{waitUntil:'networkidle'});
 await page.fill('#login-email',EMAIL); await page.fill('#login-password',PASSWORD); await page.click('button[type=submit]'); await page.waitForTimeout(1600);
 await page.click('.note-item'); await page.waitForTimeout(1200);
 await page.screenshot({path:'/tmp/dark-editor.png',fullPage:true});
 console.log('dark bg', await page.evaluate(()=>getComputedStyle(document.body).backgroundColor), 'errors',errs);
 await ctx.close();
}
// mobile
{
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'zh-CN'});
 await ctx.addInitScript(()=>localStorage.setItem('nh-locale','zh-CN'));
 const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(e.message));
 await page.goto('http://127.0.0.1:8787/login',{waitUntil:'networkidle'});
 await page.screenshot({path:'/tmp/mobile-login.png',fullPage:true});
 await page.fill('#login-email',EMAIL); await page.fill('#login-password',PASSWORD); await page.click('button[type=submit]'); await page.waitForTimeout(1800);
 await page.screenshot({path:'/tmp/mobile-list.png',fullPage:true});
 console.log('mobile list text', (await page.locator('body').innerText()).slice(0,400));
 await page.click('.note-item'); await page.waitForTimeout(1400);
 await page.screenshot({path:'/tmp/mobile-editor.png',fullPage:true});
 console.log('mobile editor url',page.url());
 await page.goto('http://127.0.0.1:8787/app/settings/account',{waitUntil:'networkidle'}); await page.waitForTimeout(800);
 await page.screenshot({path:'/tmp/mobile-settings.png',fullPage:true});
 console.log('errors',errs.slice(0,10));
 await ctx.close();
}
await browser.close();
