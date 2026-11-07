import { chromium } from '@playwright/test';
import { EMAIL, PASSWORD } from './config.mjs';
import crypto from 'node:crypto';
function base32Decode(s){const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of s.toUpperCase().replace(/[^A-Z2-7]/g,''))bits+=A.indexOf(c).toString(2).padStart(5,'0');const b=[];for(let i=0;i+8<=bits.length;i+=8)b.push(parseInt(bits.slice(i,i+8),2));return Buffer.from(b)}
function totp(secret, offset=0){const step=Math.floor(Date.now()/30000)+offset;const buf=Buffer.alloc(8);buf.writeBigUInt64BE(BigInt(step));const d=crypto.createHmac('sha1',base32Decode(secret)).update(buf).digest();const o=d[d.length-1]&15;const n=((d[o]&127)<<24)|(d[o+1]<<16)|(d[o+2]<<8)|d[o+3];return String(n%1000000).padStart(6,'0')}
const browser = await chromium.launch({headless:true});
const ctx = await browser.newContext({viewport:{width:1440,height:980},locale:'zh-CN'});
await ctx.addInitScript(()=>localStorage.setItem('nh-locale','zh-CN'));
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push('PAGE:'+e.message)); page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('401'))errs.push('CONSOLE:'+m.text())});
await page.goto('http://127.0.0.1:8787/login',{waitUntil:'networkidle'});
await page.fill('#login-email',EMAIL); await page.fill('#login-password',PASSWORD); await page.click('button[type=submit]'); await page.waitForTimeout(1500);
await page.goto('http://127.0.0.1:8787/app/settings/security',{waitUntil:'networkidle'}); await page.waitForTimeout(800);
await page.click('text=开启两步验证'); await page.waitForTimeout(1500);
const secret = await page.locator('.modal .share-link-box input').inputValue();
console.log('secret',secret);
const code = totp(secret);
await page.fill('.modal .totp-code-input', code);
await page.screenshot({path:'/tmp/2fa-setup.png',fullPage:true});
await page.click('text=验证并开启'); await page.waitForTimeout(1500);
const codes = await page.locator('.backup-code').allInnerTexts();
console.log('backup codes', codes.length, codes.slice(0,2));
await page.screenshot({path:'/tmp/2fa-backup.png',fullPage:true});
await page.click('.modal-foot >> text=完成'); await page.waitForTimeout(800);
// logout
await page.goto('http://127.0.0.1:8787/app',{waitUntil:'networkidle'}); await page.waitForTimeout(800);
await page.click('.sidebar-user'); await page.waitForTimeout(300); await page.click('text=退出登录'); await page.waitForTimeout(1500);
// login with 2fa
await page.fill('#login-email',EMAIL); await page.fill('#login-password',PASSWORD); await page.click('button[type=submit]'); await page.waitForTimeout(1200);
console.log('2fa screen', await page.locator('#login-code').count());
const code2 = totp(secret);
await page.fill('#login-code', code2); await page.keyboard.press('Enter'); await page.waitForTimeout(2000);
console.log('after 2fa url', page.url());
// disable via settings using backup code
await page.goto('http://127.0.0.1:8787/app/settings/security',{waitUntil:'networkidle'}); await page.waitForTimeout(1000);
await page.click('text=关闭两步验证'); await page.waitForTimeout(400);
await page.fill('.modal input[type=password]',PASSWORD);
const code3=totp(secret); await page.fill('.modal input.mono', code3);
await page.click('.modal-foot >> text=关闭'); await page.waitForTimeout(1500);
console.log('2fa status text', (await page.locator('.settings-inner').innerText()).slice(0,350));
console.log('errors',errs.slice(0,15));
await browser.close();
