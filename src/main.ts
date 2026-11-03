import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildVillage} from './graphics/village';
import {makePeople,updatePeople} from './graphics/people';
import {advanceWorld,chapterProgress,chooseFate,createWorld,getClock,getDay,getDaylight,loadWorld,residentMotion,saveWorld,STORAGE_KEY,VILLAGERS,type Decision,type WorldState} from './simulation/world';
import './styles.css';

const $=<T extends HTMLElement=HTMLElement>(id:string):T=>{const el=document.getElementById(id);if(!el)throw Error(`Missing UI element #${id}`);return el as T;};
const canvas=$<HTMLCanvasElement>('world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.23;
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#d5dfd5',.010);
const camera=new THREE.OrthographicCamera(-25,25,16,-16,.1,300);
const homeView=new THREE.Vector3(32,30,42);camera.position.copy(homeView);camera.lookAt(0,0,0);
const controls=new OrbitControls(camera,canvas);controls.target.set(0,0,0);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.065;
controls.minPolarAngle=.42;controls.maxPolarAngle=1.28;controls.minZoom=.72;controls.maxZoom=2.22;controls.rotateSpeed=.64;controls.zoomSpeed=.86;
controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;
const hemi=new THREE.HemisphereLight('#e5eff0','#a8a68a',2.4);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0d9',3.35);sun.position.set(-26,39,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-30;sun.shadow.camera.right=30;sun.shadow.camera.top=26;sun.shadow.camera.bottom=-26;sun.shadow.camera.near=.1;sun.shadow.camera.far=140;sun.shadow.bias=-.00016;scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight('#b4c5cc',.60);fill.position.set(15,10,-17);scene.add(fill);
const village=buildVillage(scene);
const people=makePeople(scene,VILLAGERS);
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
let world:WorldState;try{world=loadWorld(window.localStorage);}catch{world=createWorld();}
let speed=1,paused=false,selected:number|null=null,elapsed=0,last=performance.now(),lastSave=performance.now();
let lastDaylight=-1,lastDecisionKey='',lastChronicleId=0,lastTimeShown=-1;
let toastTimer:number|undefined;let audio:AudioContext|null=null,oscillator:OscillatorNode|null=null;
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));
function resize(){
 const w=window.innerWidth,h=window.innerHeight,frustum=w<760?34:28.4,aspect=w/h;
 camera.left=-frustum*aspect/2;camera.right=frustum*aspect/2;camera.top=frustum/2;camera.bottom=-frustum/2;
 camera.updateProjectionMatrix();renderer.setSize(w,h,false);
}
window.addEventListener('resize',resize);resize();
function toast(message:string){const el=$('toast');el.textContent=message;el.classList.add('show');window.clearTimeout(toastTimer);toastTimer=window.setTimeout(()=>el.classList.remove('show'),4200);}
const formatDay=(day:number)=>`流年 · 第 ${day} 日`;
function renderJournal(){
 $('journalEntries').innerHTML=world.journal.slice(-2).reverse().map(e=>`<p><span class="journal-bullet">✦</span>${escapeHtml(e.text)}</p>`).join('');
 $('dayLabel').textContent=formatDay(getDay(world));
 $('journalAll').innerHTML=[...world.journal].reverse().map(e=>`<div class="event-row"><div class="event-day">DAY ${String(e.day).padStart(2,'0')} <span>· ${String(Math.floor(e.time/60)).padStart(2,'0')}:${String(e.time%60).padStart(2,'0')}</span></div><h3>${escapeHtml(e.title)}</h3><p>${escapeHtml(e.text)}</p></div>`).join('');
}
function renderDecision(){
 const stage=world.storyStage;const key=stage+'/'+world.choice;
 if(lastDecisionKey===key)return;lastDecisionKey=key;
 const invite=stage==='stranger'&&world.choice===null;
 $('choices').hidden=!invite;
 $('decisionProgress').hidden=world.choice===null||stage==='legacy';
 $('decisionResult').hidden=stage!=='legacy';
 $('letterCount').textContent=invite?'机缘 01 / 01':stage==='legacy'?'已成旧事':'流年有信';
 if(stage==='peace'){
   $('decisionTag').textContent='山中今日无事';$('decisionTitle').textContent='酒肆尚未有客';
   $('decisionBody').textContent='溪水照旧东流，阿青在练武坪挥动木剑。听闻近来有旅人要从山道经过，且看看会发生什么。';
 }else if(invite){
   $('decisionTag').textContent='一道新的江湖机缘';$('decisionTitle').textContent='佩剑客路过无名酒肆';
   $('decisionBody').textContent='沈问舟从山外而来。阿青在酒馆边练剑，眼神追随着他的剑鞘。你愿意为这次相遇留下一点机缘吗？';
 }else if(stage==='legacy'){
   $('decisionTag').textContent='一段江湖，终有归处';$('decisionTitle').textContent=world.choice==='host'?'竹隐剑庐已经落成':'行脚茶亭已经开张';
   $('decisionBody').textContent=world.choice==='host'?'当年少年已归乡传艺，山谷中开始有了习剑的人。':'阿青把江湖经历化作一壶热茶，山路上的旅人又多了一个归处。';
   $('decisionResult').innerHTML='<div class="completed-mark">✓</div><div><b>江湖有了回响</b><small>放大看看村庄的新建筑，并翻阅守望录。</small></div>';
 }else{
   const content:Record<string,[string,string,string]>={
    stranger:['一夜酒香','机缘已经种下',world.choice==='host'?'沈问舟在酒馆留宿。阿青正悄悄观察这位江湖客。':'旅人沿山道离开。少年望着远方，心里记住了那把剑。'],
    training:['练剑的清晨','少年的武学开始有了模样',world.choice==='host'?'练武坪上，沈问舟开始指点阿青的剑式。':'阿青得到一本残旧剑谱，独自练习每一个动作。'],
    departed:['遥远的江湖','阿青已经离村出游','山道上少了一位练剑少年，酒馆仍然每日开张。远方的消息或许会慢慢传来。'],
    rumor:['山外风闻','来自远方的消息',world.choice==='host'?'游商说南边渡口有位年轻剑客正在行侠仗义。':'行脚人捎回消息：阿青正在护送商旅，江湖路上见了许多人。'],
    returned:['故人归来','多年后，阿青回到了山谷','他站在少年时练剑的地方，似乎在想着这些年走过的路。']
   };
   const [tag,title,body]=content[stage]||content.stranger;
   $('decisionTag').textContent=tag;$('decisionTitle').textContent=title;$('decisionBody').textContent=body;
 }
}
function renderProgress(){
 if(world.choice===null||world.storyStage==='legacy')return;
 const p=Math.round(chapterProgress(world)*100);
 $('progressPercent').textContent=`${p}%`;$('progressFill').style.width=`${p}%`;
 const stage=world.storyStage;
 $('progressText').textContent=stage==='stranger'?'机缘正在萌芽':stage==='training'?'少年的剑路':stage==='departed'?'出游的日子':stage==='rumor'?'风闻传回故乡':'归乡后的打算';
}
function renderStats(){ $('population').textContent=String(world.population);$('houses').textContent=String(world.houses);$('renown').textContent=String(world.renown);}
function renderClock(){
 const c=getClock(world),h=c.hour;$('clock').textContent=c.text;
 $('period').textContent=h<6?'万籁俱寂':h<10?'山中晨光':h<16?'烟火人间':h<19?'竹影斜阳':'酒旗灯火';
 $('dayIcon').textContent=h<6||h>=19?'☾':h<10?'☼':'☀';
}
function renderResident(){
 const card=$('residentCard'),v=VILLAGERS.find(v=>v.id===selected);
 if(!v){card.hidden=true;return;}
 card.hidden=false;$('residentName').textContent=v.name;
 const hero=v.id===8;
 $('residentRole').textContent=`${hero&&['returned','legacy'].includes(world.storyStage)?'归乡剑客':v.occupation}  ·  ${v.personality}`;
 $('residentActivity').textContent='◌ '+residentMotion(v,world).activity;
 $('residentThought').textContent=hero&&['departed','rumor'].includes(world.storyStage)?'“江湖很远，但山谷一直在身后。”':v.thought;
}
function selectResident(id:number|null){
 selected=id;renderResident();const v=VILLAGERS.find(v=>v.id===id);if(v)toast(`认识了 ${v.name} · ${v.occupation}`);
}
for(const button of Array.from(document.querySelectorAll<HTMLButtonElement>('.choice'))){
 button.addEventListener('click',()=>{
  const choice=button.dataset.choice as Decision;
  if(chooseFate(world,choice)){
   lastDecisionKey='';renderDecision();renderJournal();renderStats();
   toast(choice==='host'?'你为旅人留下一盏灯。':'你将这次相遇交给江湖。');
   try{saveWorld(world,localStorage);}catch{}
  }
 });
}
for(const button of Array.from(document.querySelectorAll<HTMLButtonElement>('.speed-btn'))){
 button.addEventListener('click',()=>{
  speed=Number(button.dataset.speed)||1;
  document.querySelectorAll('.speed-btn').forEach(el=>el.classList.toggle('active',el===button));
  toast(speed===1?'山谷回到了悠闲的节奏。':speed===48?'流年加速，看看江湖如何走过。':`时间正在以 ${speed} 倍速度流动。`);
 });
}
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'▶':'Ⅱ';toast(paused?'时间暂停了。':'山谷又开始活动了。');});
$('resetCamera').addEventListener('click',()=>{controls.target.set(0,0,0);camera.position.copy(homeView);camera.zoom=1;camera.updateProjectionMatrix();controls.update();});
$('zoomIn').addEventListener('click',()=>{camera.zoom=Math.min(2.22,camera.zoom*1.18);camera.updateProjectionMatrix();});
$('zoomOut').addEventListener('click',()=>{camera.zoom=Math.max(.72,camera.zoom/1.18);camera.updateProjectionMatrix();});
$('closeResident').addEventListener('click',()=>selectResident(null));
$('journalExpand').addEventListener('click',()=>{$('journalModal').hidden=false;renderJournal();});
$('closeJournal').addEventListener('click',()=>{$('journalModal').hidden=true;});
$('journalModal').addEventListener('click',e=>{if(e.target===$('journalModal'))$('journalModal').hidden=true;});
$('resetGame').addEventListener('click',()=>{
 if(!confirm('重新开启一段江湖？当前《江湖初现》记录将被清空，旧版 v0.1 存档不会受影响。'))return;
 world=createWorld();try{localStorage.removeItem(STORAGE_KEY);}catch{}
 selected=null;lastDecisionKey='';renderResident();renderDecision();renderJournal();renderStats();$('journalModal').hidden=true;village.updateStory(world);
 toast('山中的故事，从一个清晨重新开始。');
});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){$('journalModal').hidden=true;selectResident(null);}if(e.key===' '&&!(e.target instanceof HTMLButtonElement)){e.preventDefault();$('pause').click();}});
// Gentle sine-tone ambience is opt-in; no external audio files.
$('sound').addEventListener('click',()=>{
 try{
  if(audio){oscillator?.stop();void audio.close();audio=null;oscillator=null;$('soundLabel').textContent='OFF';toast('环境音已关闭。');return;}
  audio=new AudioContext();oscillator=audio.createOscillator();const gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=174.6;gain.gain.value=.006;
  oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();$('soundLabel').textContent='ON';toast('柔和的底音已经开启。');
 }catch{toast('当前浏览器暂不支持环境音。');}
});
let downX=0,downY=0;
canvas.addEventListener('pointerdown',e=>{downX=e.clientX;downY=e.clientY;});
canvas.addEventListener('pointerup',e=>{
 if(Math.hypot(e.clientX-downX,e.clientY-downY)>8)return;
 mouse.set(e.clientX/window.innerWidth*2-1,-(e.clientY/window.innerHeight)*2+1);raycaster.setFromCamera(mouse,camera);
 const candidates:THREE.Object3D[]=[];
 for(const p of people)if(p.group.visible)p.group.traverse(o=>{if(o instanceof THREE.Mesh&&o.geometry.type!=='CircleGeometry')candidates.push(o);});
 const hits=raycaster.intersectObjects(candidates,false);
 if(hits.length){let target:THREE.Object3D|null=hits[0].object;while(target&&target.userData.villagerId===undefined)target=target.parent;
  if(target)selectResident(target.userData.villagerId as number);else selectResident(null);
 }else selectResident(null);
});
function lighting(daylight:number){
 if(Math.abs(daylight-lastDaylight)<.01)return;lastDaylight=daylight;
 hemi.intensity=.95+daylight*1.45;sun.intensity=.22+daylight*3.10;fill.intensity=.26+daylight*.38;
 sun.color.set(daylight<.40?'#edb890':'#fff1d5');renderer.toneMappingExposure=.92+daylight*.39;
 const night=new THREE.Color('#263449'),morning=new THREE.Color('#d9b79a'),day=new THREE.Color('#d8e5d7');
 const sky=daylight<.35?night.clone().lerp(morning,daylight/.35):morning.clone().lerp(day,(daylight-.35)/.65);
 document.documentElement.style.setProperty('--sky-top',`#${sky.getHexString()}`);
 document.documentElement.style.setProperty('--sky-bottom',`#${sky.clone().lerp(new THREE.Color(daylight<.4?'#8f8d97':'#f3e8d4'),.6).getHexString()}`);
 scene.fog!.color.copy(sky);
}
function tick(now:number){
 const dt=Math.min(.09,Math.max(0,(now-last)/1000));last=now;
 if(!paused){
  const events=advanceWorld(world,dt*speed);elapsed+=dt*speed;
  if(events.visitor)toast('山道上来了位佩剑客。');
  if(events.milestones.length){const last=events.milestones.at(-1);toast(last==='legacy'?'山谷里有了新的归处。':last==='returned'?'阿青归来了。':'谷中又传来一段江湖消息。');}
  if(events.newDay&&!events.visitor&&!events.milestones.length)toast('清晨又到了，山谷仍然安宁。');
  if(events.visitor||events.milestones.length||events.newDay){lastDecisionKey='';renderDecision();renderJournal();renderStats();}
 }
 const daylight=getDaylight(world);lighting(daylight);village.updateStory(world);village.animate(elapsed,daylight);updatePeople(people,world,elapsed,selected);
 controls.update();renderer.render(scene,camera);
 if(now-lastTimeShown>260){lastTimeShown=now;renderClock();renderProgress();if(selected!==null)renderResident();}
 if(world.journal.at(-1)?.id!==lastChronicleId){lastChronicleId=world.journal.at(-1)?.id||0;renderJournal();}
 if(now-lastSave>5000){lastSave=now;try{saveWorld(world,localStorage);}catch{}}
 requestAnimationFrame(tick);
}
let hiddenSince:number|null=null;
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){hiddenSince=Date.now();try{saveWorld(world,localStorage);}catch{}}
 else if(hiddenSince!==null){const away=Math.min(120,Math.max(0,(Date.now()-hiddenSince)/1000));hiddenSince=null;
  advanceWorld(world,away);lastDecisionKey='';renderDecision();renderStats();renderJournal();village.updateStory(world);last=performance.now();
 }
});
window.addEventListener('pagehide',()=>{try{saveWorld(world,localStorage);}catch{}});
renderStats();renderDecision();renderJournal();renderClock();village.updateStory(world);
// Browser-level tests can inspect deterministic state without controlling the render-loop clock.
(window as typeof window&{__HAVEN_DEBUG__?:unknown}).__HAVEN_DEBUG__={
 getState:()=>structuredClone(world),
 choose:(choice:Decision)=>{const ok=chooseFate(world,choice);lastDecisionKey='';renderDecision();renderJournal();return ok;},
 advance:(seconds:number)=>{const result=advanceWorld(world,seconds);lastDecisionKey='';renderDecision();renderStats();renderJournal();village.updateStory(world);return result;},
 reset:()=>{world=createWorld();lastDecisionKey='';renderDecision();renderJournal();renderStats();village.updateStory(world);return true;},
 getRendererInfo:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles})
};
requestAnimationFrame(tick);
