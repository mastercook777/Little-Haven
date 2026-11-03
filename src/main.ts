import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildVillage } from './graphics/village';
import { makePeople, updatePeople } from './graphics/people';
import { advanceWorld, chooseProject, createWorld, getClock, getDay, getDaylight, loadWorld, projectProgress, residentMotion, saveWorld, STORAGE_KEY, VILLAGERS, type Decision, type WorldState } from './simulation/world';
import './styles.css';

const $ = <T extends HTMLElement=HTMLElement>(id:string):T => {const node=document.getElementById(id);if(!node)throw Error(`Missing #${id}`);return node as T;};
const canvas=$<HTMLCanvasElement>('world');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.37;
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2('#cfe2de',.010);
const camera=new THREE.OrthographicCamera(-25,25,16,-16,.1,300);
const viewTarget=new THREE.Vector3(0,0,0);
camera.position.set(34,31,42);camera.lookAt(viewTarget);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.copy(viewTarget);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.065;
controls.minPolarAngle=.42;controls.maxPolarAngle=1.26;
controls.minAzimuthAngle=-Infinity;controls.maxAzimuthAngle=Infinity;
controls.minZoom=.7;controls.maxZoom=2.15;
controls.rotateSpeed=.62;controls.zoomSpeed=.86;
controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_ROTATE;
const hemi=new THREE.HemisphereLight('#e0f0ff','#9a9e7b',2.65);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0cb',3.7);
sun.position.set(-22,37,17);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-29;sun.shadow.camera.right=29;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;
sun.shadow.camera.near=.1;sun.shadow.camera.far=140;sun.shadow.bias=-.0001;scene.add(sun,sun.target);
const fill=new THREE.DirectionalLight('#b7d2df',.7);fill.position.set(15,7,-14);scene.add(fill);
const village=buildVillage(scene);
const people=makePeople(scene,VILLAGERS);
const raycaster=new THREE.Raycaster();
const mouse=new THREE.Vector2();
let world:WorldState;
try{world=loadWorld(window.localStorage);}catch{world=createWorld();}
let speed=1,paused=false,selected:number|null=null,elapsed=0,last=performance.now(),lastSave=performance.now();
let lastDaylight=-1,lastChronicleId=0,lastDecisionState='',lastTimeDisplayed=-1;
let activeToastTimer:number|undefined;
let audio:AudioContext|null=null;let audioOsc:OscillatorNode|null=null;let audioGain:GainNode|null=null;

function resize(){
 const width=window.innerWidth,height=window.innerHeight;
 const isMobile=width<760;
 const frustumHeight=isMobile?34:28.4;
 const aspect=width/height;
 camera.left=-frustumHeight*aspect/2;camera.right=frustumHeight*aspect/2;
 camera.top=frustumHeight/2;camera.bottom=-frustumHeight/2;
 camera.updateProjectionMatrix();renderer.setSize(width,height,false);
}
window.addEventListener('resize',resize);resize();
function toast(message:string){
 const el=$('toast');el.textContent=message;el.classList.add('show');
 window.clearTimeout(activeToastTimer);activeToastTimer=window.setTimeout(()=>el.classList.remove('show'),4200);
}
function formatDay(day:number){return `春 · 第 ${day} 日`;}
function renderJournal(){
 const entries=world.journal.slice(-2).reverse();
 $('journalEntries').innerHTML=entries.map(e=>`<p><span class="journal-bullet">✧</span>${e.text}</p>`).join('');
 $('dayLabel').textContent=formatDay(getDay(world));
 $('journalAll').innerHTML=[...world.journal].reverse().map(e=>`<div class="event-row"><div class="event-day">DAY ${String(e.day).padStart(2,'0')} <span>· ${String(Math.floor(e.time/60)).padStart(2,'0')}:${String(e.time%60).padStart(2,'0')}</span></div><h3>${e.title}</h3><p>${e.text}</p></div>`).join('');
}
function renderDecision(){
 const mode=world.projectState;
 const modeKey=world.decision+mode;
 if(modeKey===lastDecisionState && mode!=='building')return;
 lastDecisionState=modeKey;
 $('choices').hidden=mode!=='waiting';
 $('decisionProgress').hidden=mode!=='building';
 $('decisionResult').hidden=mode!=='complete';
 if(mode==='waiting'){
   $('decisionTag').textContent='来自村庄的一封信';
   $('decisionTitle').textContent='一条通往对岸的路';
   $('decisionBody').textContent='小河对岸有一片肥沃的草地。托马斯希望修建一座木桥，而米娅想先为广场种下一座花园。你愿意支持哪一项计划？';
 }else if(mode==='building'){
   $('decisionTag').textContent='村民们正在忙碌';
   $('decisionTitle').textContent=world.decision==='bridge'?'新木桥正在建造':'花园正在悄悄生长';
   $('decisionBody').textContent=world.decision==='bridge'?'托马斯带着伙伴们搬运木板。河岸上渐渐有了桥梁的雏形。':'米娅找来大家一起整理土地。花种、长椅和小路正在陆续出现。';
 }else{
   $('decisionTag').textContent='一个新的故事已经发生';
   $('decisionTitle').textContent=world.decision==='bridge'?'河两岸终于相连':'广场有了自己的花园';
   $('decisionBody').textContent=world.decision==='bridge'?'木桥完成了！河对岸有了新的脚步声，两位旅行者决定留在山谷。':'花园开放了！居民聚在鲜花旁聊天，两位新朋友被山谷吸引而来。';
   $('decisionResult').innerHTML='<div class="completed-mark">✓</div><div><b>心愿已实现</b><small>观察村庄，看看它带来了什么变化。</small></div>';
 }
}
function renderStats(){
 $('population').textContent=String(world.population);
 $('houses').textContent=String(world.houses);
 $('happiness').textContent=String(world.happiness);
}
function renderClock(){
 const c=getClock(world);const hrs=c.hour;
 $('clock').textContent=c.text;
 $('period').textContent=hrs<6?'夜深人静':hrs<10?'晨光正好':hrs<16?'温柔午后':hrs<19?'落日时分':'星光之夜';
 $('dayIcon').textContent=hrs<6||hrs>=19?'☾':hrs<10?'☼':'☀';
}
function renderProgress(){
 if(world.projectState!=='building')return;
 const n=Math.floor(projectProgress(world)*100);
 $('progressPercent').textContent=`${n}%`;
 $('progressFill').style.width=`${n}%`;
 $('progressText').textContent=world.decision==='bridge'?'木桥施工进度':'公共花园施工进度';
}
function renderResident(){
 const card=$('residentCard');
 const v=VILLAGERS.find(v=>v.id===selected);
 if(!v){card.hidden=true;return;}
 card.hidden=false;
 $('residentName').textContent=v.name;
 $('residentRole').textContent=`${v.occupation}  ·  ${v.personality}`;
 $('residentActivity').textContent='◌ '+residentMotion(v,world).activity;
 $('residentThought').textContent=v.thought;
}
function selectResident(id:number|null){selected=id;renderResident();if(id!==null)toast(`认识了 ${VILLAGERS[id-1].name} · ${VILLAGERS[id-1].occupation}`);}

for(const button of Array.from(document.querySelectorAll<HTMLButtonElement>('.choice'))){
 button.addEventListener('click',()=>{
   const choice=button.dataset.choice as Decision;
   if(chooseProject(world,choice)){
     renderDecision();renderJournal();renderStats();
     toast(choice==='bridge'?'托马斯已经开始准备木材。':'米娅正在召集邻居们整理花园。');
     try{saveWorld(world,localStorage);}catch{}
   }
 });
}
for(const button of Array.from(document.querySelectorAll<HTMLButtonElement>('.speed-btn'))){
 button.addEventListener('click',()=>{
   speed=Number(button.dataset.speed)||1;document.querySelectorAll('.speed-btn').forEach(b=>b.classList.toggle('active',b===button));
   toast(speed===1?'世界回到了悠闲的节奏。':`时间正在以 ${speed} 倍速度流动。`);
 });
}
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'▶':'Ⅱ';toast(paused?'时间暂停了。':'村庄又开始活动了。');});
$('resetCamera').addEventListener('click',()=>{controls.target.set(0,0,0);camera.position.set(34,31,42);camera.zoom=1;camera.updateProjectionMatrix();controls.update();});
$('zoomIn').addEventListener('click',()=>{camera.zoom=Math.min(2.15,camera.zoom*1.18);camera.updateProjectionMatrix();});
$('zoomOut').addEventListener('click',()=>{camera.zoom=Math.max(.7,camera.zoom/1.18);camera.updateProjectionMatrix();});
$('closeResident').addEventListener('click',()=>selectResident(null));
$('journalExpand').addEventListener('click',()=>{$('journalModal').hidden=false;renderJournal();});
$('closeJournal').addEventListener('click',()=>{$('journalModal').hidden=true;});
$('journalModal').addEventListener('click',e=>{if(e.target===$('journalModal'))$('journalModal').hidden=true;});
$('resetGame').addEventListener('click',()=>{
 if(!confirm('确定要重新开始？当前山谷的记录将被清空。'))return;
 world=createWorld();try{localStorage.removeItem(STORAGE_KEY);}catch{}
 selected=null;lastDecisionState='';renderResident();renderDecision();renderJournal();renderStats();$('journalModal').hidden=true;
 village.updateConstruction(world);toast('一个新的清晨开始了。');
});
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){$('journalModal').hidden=true;selectResident(null);}
 if(e.key===' '&&!(e.target instanceof HTMLButtonElement)){e.preventDefault();$('pause').click();}
});
// Web Audio is intentionally optional; the game does not autoplay sound.
$('sound').addEventListener('click',()=>{
 try{
  if(audio){audioOsc?.stop();audio.close();audio=null;audioOsc=null;audioGain=null;$('soundLabel').textContent='OFF';toast('环境音已关闭。');return;}
  audio=new AudioContext();audioOsc=audio.createOscillator();audioGain=audio.createGain();
  audioOsc.type='sine';audioOsc.frequency.setValueAtTime(174.6,audio.currentTime);audioGain.gain.setValueAtTime(.007,audio.currentTime);
  audioOsc.connect(audioGain);audioGain.connect(audio.destination);audioOsc.start();$('soundLabel').textContent='ON';toast('柔和的环境底音已开启。');
 }catch{toast('浏览器暂不支持环境音。');}
});
let downX=0,downY=0;
canvas.addEventListener('pointerdown',e=>{downX=e.clientX;downY=e.clientY;});
canvas.addEventListener('pointerup',e=>{
 if(Math.hypot(e.clientX-downX,e.clientY-downY)>8)return;
 mouse.x=e.clientX/innerWidth*2-1;mouse.y=-(e.clientY/innerHeight)*2+1;
 raycaster.setFromCamera(mouse,camera);
 const candidates=people.filter(p=>p.group.visible).flatMap(p=>{
  const arr:THREE.Object3D[]=[];p.group.traverse(o=>{if(o instanceof THREE.Mesh && o.geometry.type!=='CircleGeometry')arr.push(o);});return arr;
 });
 const hits=raycaster.intersectObjects(candidates,false);
 if(hits.length){let parent:THREE.Object3D|null=hits[0].object;
  while(parent && parent.userData.villagerId===undefined)parent=parent.parent;
  if(parent)selectResident(parent.userData.villagerId as number);
 }else selectResident(null);
});

function updateLighting(daylight:number){
 if(Math.abs(daylight-lastDaylight)<.012)return;lastDaylight=daylight;
 hemi.intensity=1.05+daylight*1.65;sun.intensity=.20+daylight*3.5;fill.intensity=.32+daylight*.35;
 sun.color.set(daylight<.4?'#f3ab8d':'#fff2d2');
 renderer.toneMappingExposure=.92+daylight*.52;
 const night=new THREE.Color('#202f50'),morning=new THREE.Color('#eec2a0'),day=new THREE.Color('#d9ede8');
 const skyColor=daylight<.35?night.clone().lerp(morning,daylight/.35):morning.clone().lerp(day,(daylight-.35)/.65);
 document.documentElement.style.setProperty('--sky-top',`#${skyColor.getHexString()}`);
 document.documentElement.style.setProperty('--sky-bottom',`#${skyColor.clone().lerp(new THREE.Color(daylight<.4?'#8f8ca0':'#f4ecd6'),.6).getHexString()}`);
 scene.fog!.color.copy(skyColor);
}
function tick(now:number){
 const delta=Math.min(.09,Math.max(0,(now-last)/1000));last=now;
 if(!paused){
  const result=advanceWorld(world,delta*speed);
  elapsed+=delta*speed;
  if(result.completed){toast('一项心愿实现了！新的居民来到了山谷。');renderDecision();renderStats();renderJournal();}
  if(result.newDay){toast('早安，山谷。新的一天开始了。');renderJournal();}
 }
 const daylight=getDaylight(world);
 updateLighting(daylight);
 village.updateConstruction(world);village.animate(elapsed,daylight);
 updatePeople(people,world,elapsed,selected);
 controls.update();
 renderer.render(scene,camera);
 if(now-lastTimeDisplayed>280){lastTimeDisplayed=now;renderClock();renderProgress();if(selected!==null)renderResident();}
 if(world.journal.at(-1)?.id!==lastChronicleId){lastChronicleId=world.journal.at(-1)?.id||0;renderJournal();}
 if(now-lastSave>5000){lastSave=now;try{saveWorld(world,localStorage);}catch{}}
 requestAnimationFrame(tick);
}
let hiddenSince:number|null=null;
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){hiddenSince=Date.now();try{saveWorld(world,localStorage);}catch{}}
 else if(hiddenSince!==null){
  // rAF is often suspended in background tabs. Catch up once, bounded to 2 real minutes.
  const away=Math.min(120,Math.max(0,(Date.now()-hiddenSince)/1000));hiddenSince=null;
  const result=advanceWorld(world,away);if(result.completed)toast('你不在时，村庄完成了一项建设！');
  lastDecisionState='';renderDecision();renderStats();renderJournal();village.updateConstruction(world);
  last=performance.now();
 }
});
window.addEventListener('pagehide',()=>{try{saveWorld(world,localStorage);}catch{}});
renderStats();renderDecision();renderJournal();renderClock();village.updateConstruction(world);
// Deterministic hooks make game state and input verifiable without relying on screenshots alone.
(window as typeof window & {__HAVEN_DEBUG__?:unknown}).__HAVEN_DEBUG__={
 getState:()=>structuredClone(world),
 choose:(choice:Decision)=>{const ok=chooseProject(world,choice);renderDecision();renderJournal();return ok;},
 advance:(seconds:number)=>{const result=advanceWorld(world,seconds);renderDecision();renderStats();renderJournal();village.updateConstruction(world);return result;},
 getRendererInfo:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),
 reset:()=>{world=createWorld();lastDecisionState='';renderDecision();renderJournal();return true;}
};
requestAnimationFrame(tick);
