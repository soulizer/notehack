import { chromium } from '@playwright/test';
import { EMAIL, PASSWORD } from './config.mjs';
const browser = await chromium.launch({ headless:true });
const ctx = await browser.newContext({ viewport:{width:1440,height:980}, locale:'zh-CN', acceptDownloads:true });
await ctx.addInitScript(()=>localStorage.setItem('nh-locale','zh-CN'));
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push('PAGE:'+e.message)); page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('401'))errs.push('CONSOLE:'+m.text())});
await page.goto('http://127.0.0.1:8787/login',{waitUntil:'networkidle'});
await page.fill('#login-email',EMAIL); await page.fill('#login-password',PASSWORD); await page.click('button[type=submit]'); await page.waitForTimeout(1800);
for (const section of ['account','appearance','editor','security','data','team','api','ai','about']) {
  await page.goto(`http://127.0.0.1:8787/app/settings/${section}`,{waitUntil:'networkidle'});
  await page.waitForTimeout(700);
  const title = await page.locator('.settings-title').innerText().catch(()=>'NO TITLE');
  console.log(section, '=>', title);
  await page.screenshot({path:`/tmp/settings-${section}.png`,fullPage:true});
}
// data backup
await page.goto('http://127.0.0.1:8787/app/settings/data',{waitUntil:'networkidle'}); await page.waitForTimeout(800);
await page.click('text=立即备份');
console.log('backup clicked');
await page.waitForTimeout(8000);
console.log('backup text', (await page.locator('.settings-inner').innerText()).slice(-900));
await page.screenshot({path:'/tmp/settings-data-after.png',fullPage:true});
// export md
const dlPromise = page.waitForEvent('download',{timeout:20000}).catch(()=>null);
await page.click('text=Markdown + 附件');
const dl = await dlPromise; console.log('download', dl ? dl.suggestedFilename() : 'NONE');
console.log('errors',errs.slice(0,20));
await browser.close();
