(async () => {
  'use strict';

  const E = await (window.TrainWatchEngineReady || Promise.resolve(window.TrainWatchEngine));
  if(!E) throw new Error('TrainWatchEngine is required');

  if(!document.querySelector('link[data-observation-v2]')){
    const link=document.createElement('link');
    link.rel='stylesheet';link.href='./observation-v2.css';link.dataset.observationV2='1';document.head.appendChild(link);
  }

  const DEFAULT_STATE={station:'TX19',includePass:true,dir:'both',favorites:['TX19'],sound:true,vibrate:true};
  const state={...DEFAULT_STATE};
  const OBSERVED_HOLD_MS=10*60_000,FEEDBACK_MS=3200;
  let alertsEnabled=false,audioCtx=null,toastTimer=null,lastHeroKey='';
  const notified=new Set();
  const $=id=>document.getElementById(id);

  const heroMomentAction=$('heroMomentAction');
  let heroDelayAction=$('heroDelayAction');
  if(!heroDelayAction&&heroMomentAction){
    heroDelayAction=document.createElement('button');
    heroDelayAction.id='heroDelayAction';heroDelayAction.type='button';heroDelayAction.className='hero-delay-action touchable';heroDelayAction.hidden=true;
    heroMomentAction.insertAdjacentElement('afterend',heroDelayAction);
  }

  const el={
    clock:$('clock'),date:$('date'),stationCode:$('stationCode'),stationName:$('stationName'),
    stationButton:$('stationButton'),favoriteToggle:$('favoriteToggle'),dataNotice:$('dataNotice'),modeBadge:$('modeBadge'),
    hero:$('hero'),heroLabel:$('heroLabel'),countdown:$('countdown'),heroMessage:$('heroMessage'),tenCount:$('tenCount'),
    serviceBadge:$('serviceBadge'),metaRow:$('metaRow'),trainWrap:$('trainWrap'),heroMomentAction,heroDelayAction,notifyButton:$('notifyButton'),
    notifyToggleButton:$('notifyToggleButton'),notifyStatusText:$('notifyStatusText'),sessionNote:$('sessionNote'),favoriteCards:$('favoriteCards'),timeline:$('timeline'),
    stationDialog:$('stationDialog'),stationSearch:$('stationSearch'),stationList:$('stationList'),
    settingsDialog:$('settingsDialog'),soundToggle:$('soundToggle'),vibrateToggle:$('vibrateToggle'),
    dataDialog:$('dataDialog'),toast:$('toast'),momentList:$('momentList'),rareBanner:$('rareBanner'),watchedCount:$('watchedCount'),
    dataVersionCopy:$('dataVersionCopy')
  };

  const todayKey=()=>{
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  let log={date:todayKey(),events:{}};

  function loadState(){
    try{Object.assign(state,JSON.parse(localStorage.getItem('denshaKuruyoV1')||'{}'));}catch{}
    const q=new URLSearchParams(location.search).get('station');
    if(E.STATIONS.some(s=>s.id===q)) state.station=q;
    if(!Array.isArray(state.favorites)) state.favorites=['TX19'];
    state.favorites=[...new Set(state.favorites)].filter(id=>E.STATIONS.some(s=>s.id===id));
    try{
      const saved=JSON.parse(localStorage.getItem('denshaKuruyoMomentsV1')||'{}');
      if(saved.date===todayKey()&&saved.events&&typeof saved.events==='object')log=saved;
    }catch{}
  }
  function saveState(){localStorage.setItem('denshaKuruyoV1',JSON.stringify(state));}
  function saveLog(){localStorage.setItem('denshaKuruyoMomentsV1',JSON.stringify(log));}
  function stationById(id=state.station){return E.stationById(id);}
  function getObs(id){return log.events[id]||{};}
  function patchObs(id,patch){log.events[id]={...getObs(id),...patch};saveLog();}
  function watchedCount(){return Object.values(log.events).filter(o=>o.departedAt||o.seenAt).length;}

  function showToast(text,urgent=false){
    clearTimeout(toastTimer);el.toast.textContent=text;el.toast.hidden=false;el.toast.classList.toggle('urgent',urgent);
    toastTimer=setTimeout(()=>el.toast.hidden=true,3600);
  }
  function beep(urgent=false){
    if(!state.sound)return;
    try{
      audioCtx=audioCtx||new(window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==='suspended')audioCtx.resume();
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);
      o.frequency.value=urgent?860:620;g.gain.setValueAtTime(.0001,audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(.09,audioCtx.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+.20);
      o.start();o.stop(audioCtx.currentTime+.22);
    }catch{}
  }
  function buzz(){if(state.vibrate&&navigator.vibrate)navigator.vibrate([90,55,90]);}
  function filters(){return{includePass:state.includePass,dir:state.dir};}

  function visitFromObservation(visitId,o){
    return {id:visitId,stationId:o.stationId||state.station,kind:o.kind||'local',dir:o.dir||'down',stop:true,approx:true,verified:false,time:o.time||'--:--',stationAt:new Date(o.stationAt||o.arrivedAt||o.waitingAt||Date.now())};
  }
  function isUnconfirmedDeparture(f,o=getObs(f.visit.id)){
    return !!(f&&f.type==='departure'&&f.visit.stop&&!E.isOrigin(f.visit)&&!o.arrivedAt&&!o.departedAt&&!o.seenAt);
  }

  // 時刻表はガイド。現地で押された観察事実は時刻表より優先する。
  // 押さない場合は従来どおり自動で進み、遅れている時だけ「まだ来てない」で最大10分追える。
  function getFocuses(now,stationId=state.station){
    let base=E.getFocuses(now,stationId,filters());
    if(stationId!==state.station)return base;

    base=base.filter(f=>{const o=getObs(f.visit.id);return !(o.departedAt||o.seenAt);});
    const overrides=[];
    Object.entries(log.events).forEach(([visitId,o])=>{
      if(o.stationId!==stationId||o.departedAt||o.seenAt)return;
      if(o.arrivedAt&&+now-o.arrivedAt<=OBSERVED_HOLD_MS){
        const visit=visitFromObservation(visitId,o);
        overrides.push({visit,key:`${visitId}:departure-observed`,type:'departure',typeLabel:'発車',target:visit.stationAt,status:'active',deltaMs:0,approximate:true,observed:true,activeUntil:new Date(o.arrivedAt+OBSERVED_HOLD_MS),observedAt:o.arrivedAt});
      }else if(o.waitingAt&&!o.arrivedAt&&+now-o.waitingAt<=OBSERVED_HOLD_MS){
        const visit=visitFromObservation(visitId,o);
        overrides.push({visit,key:`${visitId}:arrival-waiting`,type:'arrival',typeLabel:'到着',target:visit.stationAt,status:'active',deltaMs:0,approximate:true,waiting:true,activeUntil:new Date(o.waitingAt+OBSERVED_HOLD_MS),observedAt:o.waitingAt});
      }
    });
    if(overrides.length){
      const overrideIds=new Set(overrides.map(f=>f.visit.id));
      base=base.filter(f=>!overrideIds.has(f.visit.id));
      overrides.sort((a,b)=>b.observedAt-a.observedAt);
      base=[...overrides,...base];
    }
    return base;
  }

  function focusAction(f){
    const o=getObs(f.visit.id);
    if(f.visit.stop&&o.arrivedAt&&!o.departedAt)return{action:'departed',label:'動いた！'};
    if(f.type==='arrival'&&E.isTerminal(f.visit)&&(f.status==='active'||f.deltaMs<=20000))return{action:'arrivedDone',label:'着いた！'};
    if(f.type==='arrival'&&(f.status==='active'||f.deltaMs<=20000))return{action:'arrived',label:'停まった！'};
    if(f.type==='departure'&&f.status==='active'){
      if(E.isOrigin(f.visit))return{action:'departed',label:'動いた！'};
      if(!o.arrivedAt)return{action:'arrived',label:'停まった！'};
      return{action:'departed',label:'動いた！'};
    }
    if(f.type==='pass'&&f.status==='active')return{action:'seen',label:'見えた！'};
    return null;
  }
  function focusView(f){
    const o=getObs(f.visit.id);
    if(f.waiting)return{title:'まだかな？',message:'この電車を待っています',time:'来たら教えてね',className:'waiting-observed'};
    if(isUnconfirmedDeparture(f,o))return{title:'まだかな？',message:'時刻表の時間を少し過ぎています',time:'もう少し待ってみよう',className:'waiting-observed'};
    if(f.visit.stop&&o.arrivedAt&&!o.departedAt)return{title:'停車中',message:'次は動く瞬間',time:'発車を待とう',className:'confirmed-stop'};
    const time=f.status==='active'?'いま':(f.deltaMs>E.LONG_WAIT_MS?f.visit.time:E.fmtRemain(f.deltaMs));
    return{title:E.focusTitle(f),message:E.focusMessage(f),time,className:`${f.type}-${f.status}`};
  }
  function detectRare(focuses,now){
    const candidates=focuses.filter(f=>f.status==='active'||f.deltaMs<=75000),unique=[];
    candidates.forEach(f=>{if(!unique.some(x=>x.visit.id===f.visit.id))unique.push(f);});
    if(unique.length<2)return null;
    const anchor=unique[0].status==='active'?+now:+unique[0].target;
    const near=unique.filter(f=>f.status==='active'||Math.abs(+f.target-anchor)<=75000);
    return near.length>=2?near.slice(0,3):null;
  }

  function heroCopy(f){
    if(!f)return{label:'つぎの見どころ',countdown:'--:--',message:'今日はおしまい'};
    const o=getObs(f.visit.id);
    if(f.waiting)return{label:'この電車を待っています',countdown:'待ってる',message:'来たら「停まった！」'};
    if(isUnconfirmedDeparture(f,o))return{label:'到着予定を過ぎています',countdown:'まだかな？',message:'電車をもう少し待ってみよう'};
    if(f.visit.stop&&o.arrivedAt&&!o.departedAt)return{label:'いまホームでは',countdown:'停車中',message:'動く瞬間を待とう'};
    if(f.deltaMs>E.LONG_WAIT_MS)return{label:'つぎの見どころ',countdown:f.visit.time,message:`${E.dirText(f.visit)}・${f.typeLabel}`};
    return{
      label:f.type==='arrival'?'到着の目安まで':f.type==='departure'?'発車の時間まで':'通過の目安まで',
      countdown:E.focusCountdown(f,new Date()),
      message:f.type==='arrival'?(f.status==='active'?'きた！停まるところ':'電車が入ってくるよ'):
        f.type==='departure'?(f.status==='active'?'動く瞬間を見よう':'つぎは発車'):
        (f.status==='active'?'きた！通過中':'ビューンと通るよ')
    };
  }

  function syncHeroAction(f){
    if(!el.heroMomentAction)return;
    const action=f?focusAction(f):null;
    if(!action){el.heroMomentAction.hidden=true;delete el.heroMomentAction.dataset.action;delete el.heroMomentAction.dataset.visit;}
    else{
      el.heroMomentAction.textContent=action.label;
      el.heroMomentAction.dataset.action=action.action;
      el.heroMomentAction.dataset.visit=f.visit.id;
      el.heroMomentAction.setAttribute('aria-label',`${action.label}（任意。押さなくても自動で進みます）`);
      el.heroMomentAction.hidden=false;
    }

    if(el.heroDelayAction){
      const showDelay=!!(f&&isUnconfirmedDeparture(f)&&!f.waiting);
      el.heroDelayAction.hidden=!showDelay;
      if(showDelay){
        el.heroDelayAction.textContent='まだ来てない';
        el.heroDelayAction.dataset.action='waiting';
        el.heroDelayAction.dataset.visit=f.visit.id;
        el.heroDelayAction.setAttribute('aria-label','まだ電車が来ていないので、この電車を待ち続ける');
      }else{
        delete el.heroDelayAction.dataset.action;delete el.heroDelayAction.dataset.visit;
      }
    }
  }

  function recentFeedback(now){
    let best=null;
    Object.entries(log.events).forEach(([visitId,o])=>{
      if(o.stationId!==state.station||!o.feedbackAt||!o.feedbackAction||+now-o.feedbackAt>FEEDBACK_MS)return;
      if(!best||o.feedbackAt>best.at)best={visitId,o,at:o.feedbackAt,action:o.feedbackAction};
    });
    return best;
  }
  function renderCompletionHero(feedback){
    const o=feedback.o,service=E.SERVICE[o.kind]?.label||'電車';
    el.hero.classList.remove('overnight','soon','now','waiting-observed');el.hero.classList.add('observation-complete');el.hero.dataset.moment='complete';
    if(feedback.action==='departed'){
      el.heroLabel.textContent='見られた！';el.countdown.textContent='いってらっしゃい！';el.heroMessage.textContent='動く瞬間、見られたね';el.serviceBadge.textContent=`${service}・発車`;
    }else if(feedback.action==='seen'){
      el.heroLabel.textContent='見られた！';el.countdown.textContent='ビューン！';el.heroMessage.textContent='通過の瞬間、見られたね';el.serviceBadge.textContent=`${service}・通過`;
    }else{
      el.heroLabel.textContent='着いた！';el.countdown.textContent='とうちゃく！';el.heroMessage.textContent='到着の瞬間、見られたね';el.serviceBadge.textContent=`${service}・到着`;
    }
    el.tenCount.hidden=true;el.metaRow.textContent=o.dir?`${o.dir==='down'?'つくば方面':'秋葉原方面'} · ${o.time||'時刻表ベース'}`:'';syncHeroAction(null);
  }

  function renderOvernightHero(info){
    el.hero.classList.add('overnight');el.hero.classList.remove('soon','now','waiting-observed','observation-complete');el.hero.dataset.moment='overnight';
    el.heroLabel.textContent='きょうの電車はひと休み';el.countdown.textContent='おやすみ';el.heroMessage.textContent='朝になったら、また見よう';
    el.serviceBadge.textContent='終電後';el.tenCount.hidden=true;syncHeroAction(null);
    el.metaRow.textContent=info.next.map(n=>`${n.label} 始発 ${n.time}`).join(' ／ ');
  }

  function renderHero(now,focuses,overnight){
    const feedback=recentFeedback(now);
    if(feedback){renderCompletionHero(feedback);return;}
    if(overnight){renderOvernightHero(overnight);return;}
    el.hero.classList.remove('overnight','observation-complete');
    const f=focuses[0];
    if(!f){
      el.hero.classList.remove('waiting-observed');
      el.heroLabel.textContent='つぎの見どころ';el.countdown.textContent='--:--';el.heroMessage.textContent='今日はおしまい';
      el.serviceBadge.textContent='本日は終了';el.metaRow.textContent='';el.tenCount.hidden=true;el.hero.dataset.moment='none';syncHeroAction(null);return;
    }
    const c=heroCopy(f);el.heroLabel.textContent=c.label;el.countdown.textContent=c.countdown;el.heroMessage.textContent=c.message;
    el.serviceBadge.textContent=`${E.SERVICE[f.visit.kind]?.label||'電車'}・${f.typeLabel}`;
    const source=f.visit.verified?'確認時刻':f.approximate?'目安':'時刻表';
    el.metaRow.textContent=`${E.dirText(f.visit)} · ${f.visit.time}ごろ · ${source}`;
    const sec=Math.ceil(f.deltaMs/1000);el.tenCount.hidden=f.status==='active'||sec>10||sec<0;el.tenCount.textContent=!el.tenCount.hidden?`いっしょに数えよう！ ${sec}`:'';
    el.hero.dataset.moment=f.type;el.hero.dataset.dir=f.visit.dir;el.hero.classList.toggle('soon',f.status==='soon');el.hero.classList.toggle('now',f.status==='active');el.hero.classList.toggle('waiting-observed',!!(f.waiting||isUnconfirmedDeparture(f)));
    syncHeroAction(f);
    const key=`${f.key}:${f.status}:${getObs(f.visit.id).arrivedAt?'stopped':''}:${f.waiting?'waiting':''}`;
    if(key!==lastHeroKey){lastHeroKey=key;window.dispatchEvent(new CustomEvent('trainwatch:momentchange',{detail:{focus:f,observed:getObs(f.visit.id)}}));}
    maybeAlert(f);
  }

  function momentHTML(f,showAction=true){
    const v=focusView(f),a=showAction?focusAction(f):null,service=E.SERVICE[f.visit.kind]?.label||'電車';
    return `<article class="moment-card ${v.className}" data-visit="${f.visit.id}" data-type="${f.type}">
      <div class="moment-direction ${f.visit.dir}" aria-hidden="true">${f.visit.dir==='down'?'→':'←'}</div>
      <div class="moment-copy"><p>${E.dirText(f.visit)} · ${service}</p><strong>${v.title}</strong><span>${v.message}</span></div>
      <div class="moment-side"><b>${v.time}</b>${a?`<button type="button" class="moment-action touchable" data-action="${a.action}" data-visit="${f.visit.id}">${a.label}</button>`:''}</div>
    </article>`;
  }

  function renderOvernightMoments(info){
    el.rareBanner.hidden=true;
    el.momentList.innerHTML=info.next.map(n=>`<article class="moment-card overnight-moment"><div class="moment-direction ${n.dir}" aria-hidden="true">${n.dir==='down'?'→':'←'}</div><div class="moment-copy"><p>${n.label}</p><strong>朝の最初の電車</strong><span>いまは電車もひと休み</span></div><div class="moment-side"><b>${n.time}</b></div></article>`).join('');
  }

  function renderMoments(now,focuses,overnight){
    if(!el.momentList)return;
    if(overnight){renderOvernightMoments(overnight);if(el.watchedCount)el.watchedCount.textContent=`きょう ${watchedCount()}本見た`;return;}
    const useful=focuses.filter(f=>{const o=getObs(f.visit.id);return!(o.departedAt||o.seenAt);}).slice(0,3);
    el.momentList.innerHTML=useful.length?useful.map((f,i)=>momentHTML(f,i!==0)).join(''):'<div class="moment-empty">次の見どころを探しています。</div>';
    if(el.watchedCount)el.watchedCount.textContent=`きょう ${watchedCount()}本見た`;
    const rare=detectRare(useful,now);
    if(el.rareBanner){
      el.rareBanner.hidden=!rare;
      if(rare){const labels=rare.map(f=>`${E.dirText(f.visit).replace('方面','')} ${E.SERVICE[f.visit.kind]?.label||'電車'}`).join(' ＋ ');el.rareBanner.querySelector('.rare-copy').textContent=labels;}
    }
  }

  function renderFavorites(now){
    el.favoriteCards.innerHTML='';
    if(!state.favorites.length){el.favoriteCards.innerHTML='<div class="empty-favs">よく見る駅をお気に入りにすると、ここからすぐ切り替えられます。</div>';return;}
    state.favorites.forEach(id=>{
      const s=stationById(id),overnight=E.getOvernightState(now,id),f=overnight?null:E.getFocuses(now,id,filters())[0],b=document.createElement('button');
      b.type='button';b.className='favorite-card'+(id===state.station?' active':'');
      const next=overnight?`始発 ${overnight.next[0].time}`:f?`${f.typeLabel} · ${f.status==='active'?'いま':E.fmtRemain(f.deltaMs)}`:'今日はおしまい';
      b.innerHTML=`<span class="mini-code">${s.id}</span><strong>${s.name}</strong><span class="mini-next">${next}</span>`;b.addEventListener('click',()=>selectStation(id));el.favoriteCards.appendChild(b);
    });
  }

  function renderTimeline(now){
    const visits=E.filterVisits(E.buildVisits(now,state.station),filters()).filter(v=>v.stationAt-now>-60000).slice(0,7);
    if(!visits.length){el.timeline.innerHTML='<div class="event-row"><div class="event-main"><strong>次の電車を確認中</strong><small>現在のデータで確認できる時刻を表示します。</small></div></div>';return;}
    el.timeline.innerHTML=visits.map((v,i)=>{
      const f=E.focusForVisit(v,now),scene=v.stop?(E.isOrigin(v)?'発車':E.isTerminal(v)?'到着':'到着 → 発車'):'通過';
      let remain='';if(f)remain=f.status==='active'?'いま':E.fmtRemain(f.deltaMs);else if(v.stationAt>now)remain=E.fmtRemain(v.stationAt-now);
      const source=v.verified?'確認時刻':v.approx?'目安':'';
      return `<article class="event-row ${i===0?'next':''}"><div class="event-time">${v.time}</div><div class="event-main"><strong>${E.SERVICE[v.kind]?.label||'電車'} · ${E.dirText(v)}</strong><small>${scene}${source?` · ${source}`:''}</small></div><div class="event-remain">${remain}</div></article>`;
    }).join('');
  }

  function renderStationList(filter=''){
    const q=filter.trim().toLowerCase();el.stationList.innerHTML='';let count=0;
    E.STATIONS.forEach(s=>{
      const matches=!q||s.name.toLowerCase().includes(q)||s.en.toLowerCase().includes(q)||s.id.toLowerCase().includes(q);if(!matches)return;count++;
      const row=document.createElement('div'),fav=state.favorites.includes(s.id);row.className='station-row'+(s.id===state.station?' current':'');
      row.innerHTML=`<span class="station-code-mini">${s.id}</span><button type="button" class="station-select"><strong>${s.name}</strong><small>${s.en}</small></button><button type="button" class="star-btn ${fav?'on':''}" aria-label="${s.name}をお気に入り${fav?'から外す':'に追加'}">${fav?'★':'☆'}</button>`;
      row.querySelector('.station-select').addEventListener('click',()=>selectStation(s.id));row.querySelector('.star-btn').addEventListener('click',()=>{toggleFavorite(s.id);renderStationList(el.stationSearch.value);});el.stationList.appendChild(row);
    });
    if(!count)el.stationList.innerHTML='<p class="station-empty">該当する駅がありません。</p>';
  }

  function selectStation(id){state.station=id;saveState();const u=new URL(location.href);u.searchParams.set('station',id);history.replaceState(null,'',u);notified.clear();lastHeroKey='';renderAll();}
  function toggleFavorite(id=state.station){const i=state.favorites.indexOf(id);if(i>=0)state.favorites.splice(i,1);else state.favorites.push(id);saveState();renderAll();}

  function syncControls(){
    document.querySelectorAll('#trainFilter button').forEach(b=>{const active=(b.dataset.filter==='all')===state.includePass;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    document.querySelectorAll('#directionFilter button').forEach(b=>{const active=b.dataset.dir===state.dir;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    el.soundToggle.checked=state.sound!==false;el.vibrateToggle.checked=state.vibrate!==false;
    el.notifyButton.classList.toggle('enabled',alertsEnabled);el.notifyButton.setAttribute('aria-pressed',String(alertsEnabled));
    el.notifyButton.querySelector('b').textContent='お知らせ';
    el.notifyButton.setAttribute('aria-label',alertsEnabled?'お知らせ中。詳しく見る':'お知らせについて見る');
    if(el.notifyToggleButton){el.notifyToggleButton.textContent=alertsEnabled?'お知らせをOFFにする':'お知らせをONにする';el.notifyToggleButton.setAttribute('aria-pressed',String(alertsEnabled));}
    if(el.notifyStatusText)el.notifyStatusText.textContent=alertsEnabled?'お知らせ中':'いまはOFF';
    el.sessionNote.textContent=alertsEnabled?'到着・発車・通過を3分前と30秒前に知らせます。':'お知らせは、このページを開いている間だけ動きます。';
  }

  function alertText(f,t){if(f.type==='arrival')return t===30?'もうすぐ到着！':'そろそろ電車が来るよ';if(f.type==='departure')return t===30?'もうすぐ発車の時間！':'そろそろ発車だよ';return t===30?'もうすぐ通過！':'そろそろビューンと来るよ';}
  function maybeAlert(f){
    if(!alertsEnabled||!f||f.waiting||isUnconfirmedDeparture(f))return;const sec=Math.ceil(f.deltaMs/1000);
    [180,30].forEach(t=>{if(sec<=t&&sec>t-5&&sec>0){const key=`${f.key}:${t}`;if(notified.has(key))return;notified.add(key);showToast(alertText(f,t),t===30);beep(t===30);if(t===30)buzz();}});
    if(f.status==='active'){const key=`${f.key}:active`;if(!notified.has(key)){notified.add(key);if(f.type==='departure')showToast('動く瞬間を見よう',true);}}
  }
  async function toggleAlerts(){alertsEnabled=!alertsEnabled;if(alertsEnabled){beep(false);showToast('お知らせをONにしました');}else showToast('お知らせをOFFにしました');syncControls();}
  async function shareStation(){
    const s=stationById(),u=new URL(location.href);u.searchParams.set('station',s.id);const text=`${s.name}駅で電車を見よう！\n「でんしゃくるよ！」で、到着・発車・通過の見どころを追えるよ。`;
    try{if(navigator.share)await navigator.share({title:`${s.name}駅｜でんしゃくるよ！`,text,url:u.href});else{await navigator.clipboard.writeText(`${text}\n${u.href}`);showToast('URLをコピーしました');}}catch(e){if(e.name!=='AbortError')showToast('共有できませんでした');}
  }

  function handleMomentAction(button){
    const id=button.dataset.visit,action=button.dataset.action,now=Date.now(),focus=getFocuses(new Date()).find(f=>f.visit.id===id);if(!focus)return;
    const visitPatch={stationId:state.station,kind:focus.visit.kind,dir:focus.visit.dir,time:focus.visit.time,stationAt:+focus.visit.stationAt};
    if(action==='waiting'){
      patchObs(id,{...visitPatch,waitingAt:now});showToast('この電車を待ってるよ');window.dispatchEvent(new CustomEvent('trainwatch:observed',{detail:{action:'waiting',visitId:id}}));
    }else if(action==='arrived'){
      patchObs(id,{...visitPatch,waitingAt:null,arrivedAt:now});showToast('停まった！ 次は動く瞬間');window.dispatchEvent(new CustomEvent('trainwatch:observed',{detail:{action:'arrived',visitId:id}}));
    }else if(action==='departed'){
      patchObs(id,{...visitPatch,departedAt:now,feedbackAt:now,feedbackAction:'departed'});showToast('動いた！ いってらっしゃい！',true);window.dispatchEvent(new CustomEvent('trainwatch:observed',{detail:{action:'departed',visitId:id}}));
    }else{
      const feedbackAction=action==='seen'?'seen':'arrivedDone';
      patchObs(id,{...visitPatch,seenAt:now,feedbackAt:now,feedbackAction});showToast(action==='seen'?'見えた！':'着いた！',true);window.dispatchEvent(new CustomEvent('trainwatch:observed',{detail:{action,visitId:id}}));
    }
    renderAll();
  }

  function updateDataCopy(){
    const meta=E.DATA_META,checked=new Date(meta.checkedAt),checkedText=`${checked.getFullYear()}/${checked.getMonth()+1}/${checked.getDate()}`;
    const [ry,rm,rd]=String(meta.timetableRevision).split('-');
    const revisionText=`${ry}年${Number(rm)}月${Number(rd)}日改正`;
    if(el.modeBadge)el.modeBadge.textContent=`${checkedText} 確認`;
    if(el.dataVersionCopy)el.dataVersionCopy.textContent=`${revisionText}の時刻表をもとに、${checkedText}に内容を確認しています。`;
  }

  function renderAll(){
    const now=new Date(),s=stationById(),overnight=E.getOvernightState(now,state.station);
    if(log.date!==todayKey()){log={date:todayKey(),events:{}};saveLog();}
    document.title=`${s.name}駅｜でんしゃくるよ！`;el.stationCode.textContent=s.id;el.stationName.textContent=s.name;
    const fav=state.favorites.includes(s.id);el.favoriteToggle.textContent=fav?'★':'☆';el.favoriteToggle.classList.toggle('on',fav);el.favoriteToggle.setAttribute('aria-label',fav?'お気に入りから外す':'お気に入りに追加');
    el.dataNotice.classList.toggle('reference',true);
    const focuses=overnight?[]:getFocuses(now);renderHero(now,focuses,overnight);renderMoments(now,focuses,overnight);renderFavorites(now);renderTimeline(now);syncControls();
  }

  function bindEvents(){
    el.favoriteToggle.addEventListener('click',()=>toggleFavorite());
    if(el.notifyToggleButton)el.notifyToggleButton.addEventListener('click',toggleAlerts);
    $('shareButton').addEventListener('click',shareStation);
    el.stationSearch.addEventListener('input',()=>renderStationList(el.stationSearch.value));
    document.querySelectorAll('#trainFilter button').forEach(b=>b.addEventListener('click',()=>{state.includePass=b.dataset.filter==='all';saveState();renderAll();}));
    document.querySelectorAll('#directionFilter button').forEach(b=>b.addEventListener('click',()=>{state.dir=b.dataset.dir;saveState();renderAll();}));
    el.soundToggle.addEventListener('change',()=>{state.sound=el.soundToggle.checked;saveState();if(state.sound)beep(false);});el.vibrateToggle.addEventListener('change',()=>{state.vibrate=el.vibrateToggle.checked;saveState();});
    document.addEventListener('click',e=>{const b=e.target.closest?.('.moment-action,#heroMomentAction,#heroDelayAction');if(b&&!b.hidden)handleMomentAction(b);});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderAll();});
  }

  function tick(){const now=new Date();el.clock.textContent=now.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});el.date.textContent=now.toLocaleDateString('ja-JP',{month:'numeric',day:'numeric',weekday:'short'});renderAll();}
  function init(){loadState();bindEvents();renderStationList();updateDataCopy();syncControls();tick();setInterval(tick,1000);if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
  init();
})();