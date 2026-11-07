import { chromium } from '@playwright/test';
import { EMAIL, PASSWORD } from './config.mjs';
import crypto from 'node:crypto';
function base32Decode(s){const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of s.toUpperCase().replace(/[^A-Z2-7]/g,''))bits+=A.indexOf(c).toString(2).padStart(5,'0');const b=[];for(let i=0;i+8<=bits.length;i+=8)b.push(parseInt(bits.slice(i,i+8),2));return Buffer.from(b)}
function totp(secret, offset=0){const step=Math.floor(Date.now()/30000)+offset;const buf=Buffer.alloc(8);buf.writeBigUInt64BE(BigInt(step));const d=crypto.createHmac('sha1',base32Decode(secret)).update(buf).digest();const o=d[d.length-1]&15;const n=((d[o]&127)<<24)|(d[o+1]<<16)|(d[o+2]<<8)|d[o+3];return String(n%1000000).padStart(6,'0')}
const secret='G42O7FCMODEZ4QGLSGKBWH5ATAFJZTKC';
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:980},locale:'zh-CN'});
await ctx.addInitScript(()=>localStorage.setItem('nh-locale','zh-CN'));
const page=await ctx.newPage();
await page.goto('http://127.0.0.1:8787/login',{waitUntil:'networkidle'});
await page.fill('#login-email',EMAIL); await page.fill('#login-password',PASSWORD); await page.click('button[type=submit]'); await page.waitForTimeout(1200);
console.log('code screen', await page.locator('#login-code').count());
if(await page.locator('#login-code').count()){
  const code=totp(secret,1);
  console.log('using',code);
  await page.fill('#login-code',code); await page.keyboard.press('Enter'); await page.waitForTimeout(2000);
  console.log('url1',page.url());
  if(page.url().includes('/login')){
    console.log('body', (await page.locator('body').innerText()).slice(0,300));
    // try backup code
    await page.fill('#login-code','2600-9013'); await page.keyboard.press('Enter'); await page.waitForTimeout(2000);
    console.log('url2',page.url());
  }
}
if(page.url().includes('/login')){
  console.log('BODY', (await page.locator('body').innerText()).slice(0,500));
  await browser.close(); process.exit(1);
}
await page.goto('http://127.0.0.1:8787/app/settings/security',{waitUntil:'networkidle'}); await page.waitForTimeout(1200);
console.log('has disable', await page.locator('text=关闭两步验证').count());
await page.click('text=关闭两步验证'); await page.waitForTimeout(500);
await page.fill('.modal input[type=password]',PASSWORD);
const code=totp(secret,0);
await page.fill('.modal input.mono',code);
await page.click('.modal-foot >> text=关闭'); await page.waitForTimeout(2000);
console.log('security text', (await page.locator('.settings-inner').innerText()).slice(0,300));
console.log('modal', await page.locator('.modal').count());
await page.screenshot({path:'/tmp/2fa-disabled.png',fullPage:true});
await browser.close();
