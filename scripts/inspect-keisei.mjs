const UA={'user-agent':'train-watch-data-check/1.0'};
async function get(url){const r=await fetch(url,{headers:UA});const text=await r.text();console.log('\nURL',url,'status',r.status,'length',text.length,'acao',r.headers.get('access-control-allow-origin'));return text;}
const search=await get('https://keisei.ekitan.com/search/timetable');
for(const needle of ['Keisei Ueno','Oshiage','Matsudo','Keisei-Main','stationList','routeList','254-0','258-0']){
  const i=search.indexOf(needle); console.log(`search:${needle}`,i,i>=0?search.slice(Math.max(0,i-420),i+900).replace(/\s+/g,' '):'NOT_FOUND');
}
const hrefs=[...search.matchAll(/href=["']([^"']*(?:timetable\/station|station\/)[^"']*)["']/g)].map(m=>m[1]);
console.log('search station href count',hrefs.length,'sample',[...new Set(hrefs)].slice(0,80));
const options=[...search.matchAll(/<option[^>]*value=["']([^"']+)["'][^>]*>([^<]+)<\/option>/gi)].map(m=>({value:m[1],label:m[2].trim().replace(/\s+/g,' ')}));
console.log('options',options.length,options.slice(0,120));

const url='https://keisei.ekitan.com/naritaacs-i/timetable/station/254-0/d1?dw=0';
const html=await get(url);
for(const needle of ['Keisei Ueno','5:03','Revised','Weekday','Sat/Holiday','254-0','258-0','Keisei-Oshiage line','clickWeekend']){
  const i=html.indexOf(needle);
  console.log(`ueno:${needle}`,i, i>=0?html.slice(Math.max(0,i-360),i+760).replace(/\s+/g,' '):'NOT_FOUND');
}
