import { webkit } from '@playwright/test';
import fs from 'node:fs';

fs.mkdirSync('preview-screenshots',{recursive:true});
const browser=await webkit.launch();
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
await context.addInitScript(()=>{
  try{localStorage.setItem('denshaKuruyoIntroV2','seen');}catch{}
});
const page=await context.newPage();

async function ready(url){
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.rail-switch',{timeout:15000});
  await page.waitForFunction(()=>document.querySelector('#countdown')?.textContent?.trim()!=='--:--',{timeout:15000}).catch(()=>{});
  await page.waitForTimeout(700);
}

await ready('http://127.0.0.1:4173/?rail=tx&station=TX19');
await page.screenshot({path:'preview-screenshots/01-tx-home.png',fullPage:false});

await ready('http://127.0.0.1:4173/?rail=keisei&station=KS22');
await page.screenshot({path:'preview-screenshots/02-keisei-home.png',fullPage:false});

await page.locator('#stationButton').click();
await page.waitForSelector('#stationDialog[open]');
await page.waitForTimeout(300);
await page.screenshot({path:'preview-screenshots/03-keisei-stations.png',fullPage:false});

await browser.close();
console.log('Preview screenshots captured');
