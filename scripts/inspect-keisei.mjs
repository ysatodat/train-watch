const url='https://keisei.ekitan.com/naritaacs-i/timetable/station/254-0/d1?dw=0';
const r=await fetch(url,{headers:{'user-agent':'train-watch-data-check/1.0'}});
console.log('status',r.status);
console.log('acao',r.headers.get('access-control-allow-origin'));
const html=await r.text();
console.log('length',html.length);
for(const needle of ['Keisei Ueno','5:03','Revised','Weekday','Sat/Holiday','254-0','258-0','Keisei-Oshiage line']){
  const i=html.indexOf(needle);
  console.log(`needle:${needle}`,i, i>=0?html.slice(Math.max(0,i-260),i+520).replace(/\s+/g,' '):'NOT_FOUND');
}
const ids=[...html.matchAll(/(?:station\/|value=["'])(\d{3})-(\d+)/g)].map(m=>`${m[1]}-${m[2]}`);
console.log('station-id-prefixes', [...new Set(ids.map(x=>x.split('-')[0]))]);
console.log('station-id-sample', [...new Set(ids)].slice(0,120));
