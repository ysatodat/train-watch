const UA={'user-agent':'train-watch-data-check/1.0'};
const decode=s=>s.replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
async function probe(group,index=0){
  const url=`https://keisei.ekitan.com/naritaacs-i/timetable/station/${group}-${index}/d1?dw=0`;
  try{
    const r=await fetch(url,{headers:UA,redirect:'follow'}); if(!r.ok)return null;
    const html=await r.text();
    const title=html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1];
    const heading=html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1];
    const stationNo=html.match(/station_numbering\.svg#icon-[^"']*-([A-Z]{1,3})["']/)?.[1]||null;
    if(!title||!heading||!html.includes('ekldeptime'))return null;
    return {group,index,title:decode(title),heading:decode(heading),stationNo,length:html.length};
  }catch{return null;}
}
const groups=[];
for(let g=245;g<=270;g++){
  const x=await probe(g,0); if(x)groups.push(x);
}
console.log('route-groups',JSON.stringify(groups,null,2));
const main=[];
for(let i=0;i<=48;i++){
  const x=await probe(254,i); if(x)main.push(x);
}
console.log('group254',JSON.stringify(main,null,2));
