const url='https://keisei.ekitan.com/naritaacs-i/timetable/station/254-0/d1?dw=0';
const r=await fetch(url,{headers:{'user-agent':'train-watch-data-check/1.0'}});
console.log('status',r.status);
console.log('acao',r.headers.get('access-control-allow-origin'));
const html=await r.text();
console.log('length',html.length);
for(const needle of ['Keisei Ueno','5:03','Revised','Weekday','Sat/Holiday']){
  const i=html.indexOf(needle);
  console.log(`needle:${needle}`,i, i>=0?html.slice(Math.max(0,i-220),i+420).replace(/\s+/g,' '):'NOT_FOUND');
}
