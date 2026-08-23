import { webkit } from '@playwright/test';
import fs from 'node:fs';

fs.mkdirSync('preview-screenshots',{recursive:true});
const browser=await webkit.launch();
const FIXED_NOW=new Date('2026-08-23T18:40:00+09:00').valueOf();

async function makePage(){
  const context=await browser.newContext({
    viewport:{width:390,height:844},
    deviceScaleFactor:2,
    isMobile:true,
    hasTouch:true,
    timezoneId:'Asia/Tokyo'
  });
  await context.route('https://**/*',route=>route.abort());
  await context.addInitScript(initialNow=>{
    const RealDate=Date;
    class FixedDate extends RealDate{
      constructor(...args){super(...(args.length?args:[initialNow]));}
      static now(){return initialNow;}
    }
    window.Date=FixedDate;
    try{
      localStorage.clear();
      localStorage.setItem('denshaKuruyoIntroV2','seen');
      localStorage.setItem('denshaKuruyoLocationReadyV1','1');
    }catch{}
  },FIXED_NOW);
  return {context,page:await context.newPage()};
}

async function ready(page,url,{stationCode,stationName}){
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.location-context-button',{timeout:15000});
  await page.waitForFunction(({code,name})=>{
    return document.querySelector('#stationCode')?.textContent?.trim()===code &&
      document.querySelector('#stationName')?.textContent?.trim()===name &&
      document.querySelector('#countdown')?.textContent?.trim()!=='--:--';
  },{code:stationCode,name:stationName},{timeout:15000});
  await page.waitForTimeout(350);
}

{
  const {context,page}=await makePage();
  await ready(page,'http://127.0.0.1:4173/?rail=tx&station=TX19',{stationCode:'TX19',stationName:'研究学園'});
  await page.screenshot({path:'preview-screenshots/01-tx-home.png',fullPage:false});
  await context.close();
}

{
  const {context,page}=await makePage();
  await ready(page,'http://127.0.0.1:4173/?rail=keisei&station=KS22',{stationCode:'KS22',stationName:'京成船橋'});
  await page.screenshot({path:'preview-screenshots/02-keisei-home.png',fullPage:false});
  await page.locator('#stationButton').click();
  await page.waitForSelector('#stationDialog[open]');
  await page.waitForSelector('.location-picker');
  await page.waitForTimeout(250);
  await page.screenshot({path:'preview-screenshots/03-location-picker.png',fullPage:false});
  await context.close();
}

await browser.close();
console.log('Location-first preview screenshots captured');
