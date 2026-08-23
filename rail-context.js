(() => {
  'use strict';
  const KEY='denshaKuruyoRailContextV1';
  const RAILS={tx:{id:'tx',label:'TX',defaultStation:'TX19'},keisei:{id:'keisei',label:'京成',defaultStation:'KS22'}};
  let saved={};
  try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{}
  const url=new URL(location.href);
  const stationParam=url.searchParams.get('station')||'';
  const requested=url.searchParams.get('rail');
  let rail=RAILS[requested]?requested:null;
  if(!rail&&stationParam.startsWith('KS'))rail='keisei';
  if(!rail&&stationParam.startsWith('TX'))rail='tx';
  if(!rail&&RAILS[saved.rail])rail=saved.rail;
  if(!rail)rail='tx';
  const lastStations={tx:'TX19',keisei:'KS22',...(saved.lastStations||{})};
  if(stationParam)lastStations[rail]=stationParam;

  function persist(next={}){
    const value={rail:next.rail||rail,lastStations:{...lastStations,...(next.lastStations||{})}};
    try{localStorage.setItem(KEY,JSON.stringify(value));}catch{}
  }
  function stationFor(id){return lastStations[id]||RAILS[id]?.defaultStation;}
  function hrefFor(id){
    const u=new URL(location.href);u.searchParams.set('rail',id);u.searchParams.set('station',stationFor(id));return u.href;
  }
  function switchRail(id){if(!RAILS[id]||id===rail)return;persist({rail:id});location.href=hrefFor(id);}
  function rememberStation(id){if(!id)return;lastStations[rail]=id;persist();}

  persist();
  document.documentElement.dataset.rail=rail;
  window.RailContext={rail,rails:RAILS,defaultStation:stationFor(rail),stationFor,hrefFor,switchRail,rememberStation,persist};
})();
