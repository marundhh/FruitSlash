const screens=document.querySelectorAll(".screen");const canvas=document.getElementById("gameCanvas");const ctx=canvas.getContext("2d");
let mode="fruit",difficulty=0,score=0,lives=5,objects=[],slashes=[],sliced=[],running=false,paused=false,spawnTimer=0,last=0,selectedSkin=0,raf,gameSettled=false,gameStartedAt=0,playedSeconds=0;
let watermelonHits=0,watermelonZoom=1,watermelonFlash=0,slashGestureHit=false;
let totalScore=Number(localStorage.getItem("fruitSlashPoints")||0);
let unlockedSkins=JSON.parse(localStorage.getItem("fruitSlashUnlocked")||"[true,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false]");
let blade={x:550,y:325,visible:true,life:999,angle:-Math.PI/4};

// ===== ÂM THANH + BACKGROUND TỰ ĐỘNG =====
// Audio được tạo bằng Web Audio API nên game không cần thêm file âm thanh.
// Trình duyệt chỉ cho phát sau một thao tác của người dùng (Start/Spin).
let audioCtx=null,audioMaster=null,musicTimer=null,musicStep=0;
let musicEnabled=localStorage.music!=="false";
let sfxEnabled=localStorage.sfx!=="false";
let masterVolume=Math.max(0,Math.min(1,Number(localStorage.volume??0.7)));
const BG_DURATION=120000; // 2 phút / background
let bgStartedAt=0,bgIndex=0,bgBaseIndex=0;
const outerDecorThemes=[
  {image:'outer-bg-1.svg', top:['🍉','🍓','🍍','🍊','🍎'], bottom:['🥝','🍒','🥭','🍋','🍇']},
  {image:'outer-bg-2.svg', top:['🍒','🍑','🫐','🍇','🍓'], bottom:['🍉','🍊','🍋','🍍','🥭']},
  {image:'outer-bg-3.svg', top:['🍏','🥝','🍈','🍐','🍋'], bottom:['🍎','🍉','🍍','🍊','🍒']},
  {image:'outer-bg-4.svg', top:['🍊','🥭','🍑','🍉','🍍'], bottom:['🍓','🍎','🍒','🍋','🥝']}
];
let outerThemeIndex=0;
function applyOuterDecorTheme(index){
  const game=document.getElementById('game');
  const photo=document.querySelector('#game .outer-photo');
  if(!game||!photo)return;
  const t=outerDecorThemes[index%outerDecorThemes.length];
  photo.classList.add('is-changing');
  setTimeout(()=>{
    photo.style.backgroundImage=`url("${t.image}")`;
    requestAnimationFrame(()=>photo.classList.remove('is-changing'));
  },350);
  const spans=document.querySelectorAll('.game-decor span');
  const fruit=[...t.top,...t.bottom];
  spans.forEach((el,i)=>{if(fruit[i])el.textContent=fruit[i];});
}
function startOuterThemeCycle(){
  clearInterval(window.__outerThemeTimer);
  outerThemeIndex=Math.floor(Math.random()*outerDecorThemes.length);
  const photo=document.querySelector('#game .outer-photo');
  const t=outerDecorThemes[outerThemeIndex];
  if(photo){photo.style.backgroundImage=`url("${t.image}")`;photo.classList.remove('is-changing');}
  applyOuterDecorTheme(outerThemeIndex);
  window.__outerThemeTimer=setInterval(()=>{
    outerThemeIndex=(outerThemeIndex+1)%outerDecorThemes.length;
    applyOuterDecorTheme(outerThemeIndex);
  },BG_DURATION);
}


const bgThemes=[
  {a:"#061a35",b:"#0b4662",c:"#25103d",g1:"rgba(40,210,255,.20)",g2:"rgba(210,80,255,.16)"},
  {a:"#1d092f",b:"#5a164d",c:"#071b3d",g1:"rgba(255,90,180,.18)",g2:"rgba(80,120,255,.17)"},
  {a:"#062b20",b:"#11624d",c:"#182d0a",g1:"rgba(70,255,170,.18)",g2:"rgba(220,255,80,.12)"},
  {a:"#2b1705",b:"#6b3510",c:"#17051e",g1:"rgba(255,190,60,.20)",g2:"rgba(255,70,100,.16)"}
];

// Nền menu sáng, nhiều màu và tự đổi nhẹ để màn hình chờ không bị đứng hình.
const menuThemes=[
  ["#fff7d6","#d8f8ff","#e9ddff"],
  ["#ffe3ef","#fff5c7","#dff7ff"],
  ["#dfffe9","#fff3bd","#dfe9ff"],
  ["#e8e0ff","#ffdff1","#d9fff7"]
];
let menuThemeIndex=0,menuThemeTimer=null,menuBgIndex=0;
function applyMenuTheme(){
  const m=document.getElementById("menu"); if(!m)return;
  const t=menuThemes[menuThemeIndex%menuThemes.length];
  m.style.setProperty("--menu-a",t[0]);m.style.setProperty("--menu-b",t[1]);m.style.setProperty("--menu-c",t[2]);
  menuThemeIndex++;
}
function applyMenuPhoto(index,instant=false){
  const m=document.getElementById("menu");
  const photo=m?.querySelector(".menu-photo");
  if(!photo)return;
  const t=outerDecorThemes[index%outerDecorThemes.length];
  if(instant){
    photo.style.backgroundImage=`url("${t.image}")`;
    photo.classList.remove("is-changing");
    return;
  }
  photo.classList.add("is-changing");
  setTimeout(()=>{
    photo.style.backgroundImage=`url("${t.image}")`;
    requestAnimationFrame(()=>photo.classList.remove("is-changing"));
  },350);
}
function startMenuBackground(){
  clearInterval(menuThemeTimer);
  applyMenuTheme();
  menuBgIndex=Math.floor(Math.random()*outerDecorThemes.length);
  applyMenuPhoto(menuBgIndex,true);
  menuThemeTimer=setInterval(()=>{
    menuBgIndex=(menuBgIndex+1)%outerDecorThemes.length;
    applyMenuPhoto(menuBgIndex);
  },BG_DURATION);
}

function ensureAudio(){
  if(!audioCtx){
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;
    audioCtx=new AC();
    audioMaster=audioCtx.createGain();
    audioMaster.gain.value=masterVolume;
    audioMaster.connect(audioCtx.destination);
  }
  if(audioCtx.state==="suspended")audioCtx.resume();
}
function tone(freq,duration=.12,type="sine",volume=.08,when=0){
  if(!audioCtx||!audioMaster)return;
  const t=audioCtx.currentTime+when;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(Math.max(.0001,volume),t+.012);
  g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  o.connect(g);g.connect(audioMaster);o.start(t);o.stop(t+duration+.03);
}
function noise(duration=.12,volume=.05,when=0,filterFreq=2200){
  if(!audioCtx||!audioMaster)return;
  const t=audioCtx.currentTime+when, buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*duration,audioCtx.sampleRate);
  const data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,.35);
  const src=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter(),g=audioCtx.createGain();
  filter.type="highpass";filter.frequency.setValueAtTime(filterFreq,t);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
  src.buffer=buffer;src.connect(filter);filter.connect(g);g.connect(audioMaster);src.start(t);src.stop(t+duration+.02);
}
function sfx(kind){
  if(!sfxEnabled)return;
  ensureAudio(); if(!audioCtx)return;
  if(kind==="slice"){
    // Tiếng kiếm "xẹc/xẹt": một cú noise ngắn + âm kim loại cao.
    noise(.085,.075,0,1500);tone(620,.075,"sawtooth",.045);tone(980,.10,"triangle",.04,.025);
  }
  else if(kind==="special"){tone(660,.10,"sine",.07);tone(990,.16,"sine",.045,.07);}
  else if(kind==="bomb"){
    // Bom: tiếng cầu chì cháy "xì xì" rồi bụp nhỏ.
    noise(.34,.09,0,3200);noise(.20,.055,.13,4200);tone(115,.18,"sawtooth",.065,.28);tone(65,.24,"square",.045,.31);
  }
  else if(kind==="start"){tone(440,.12,"sine",.06);tone(660,.18,"sine",.055,.10);}
  else if(kind==="gameover"){tone(260,.18,"sawtooth",.07);tone(170,.30,"sawtooth",.06,.15);}
}
function musicTick(){
  if(!musicEnabled||!audioCtx)return;
  // Nhạc nền nhẹ, lặp theo 8 nốt, không át hiệu ứng chém.
  const notes=[220,277.18,329.63,369.99,329.63,277.18,246.94,329.63];
  tone(notes[musicStep%notes.length],.30,"sine",.018);
  if(musicStep%4===0)tone(notes[musicStep%notes.length]/2,.42,"triangle",.012);
  musicStep++;
}
function startMusic(){
  ensureAudio();
  if(!audioCtx||musicTimer)return;
  musicStep=0;musicTick();
  musicTimer=setInterval(musicTick,430);
}
function stopMusic(){
  if(musicTimer){clearInterval(musicTimer);musicTimer=null;}
}
function applyAudioSettings(){
  musicEnabled=document.getElementById("musicToggle")?.checked ?? musicEnabled;
  sfxEnabled=document.getElementById("sfxToggle")?.checked ?? sfxEnabled;
  masterVolume=Math.max(0,Math.min(1,Number(document.getElementById("volume")?.value??masterVolume)));
  localStorage.music=musicEnabled;localStorage.sfx=sfxEnabled;localStorage.volume=masterVolume;
  if(audioMaster)audioMaster.gain.value=masterVolume;
  if(musicEnabled&&running&&!paused)startMusic(); else if(!musicEnabled)stopMusic();
}
function syncAudioControls(){
  const m=document.getElementById("musicToggle"),s=document.getElementById("sfxToggle"),v=document.getElementById("volume");
  if(m)m.checked=musicEnabled;if(s)s.checked=sfxEnabled;if(v)v.value=masterVolume;
  const gm=document.getElementById("gameMusic"),gs=document.getElementById("gameSfx");
  if(gm)gm.checked=musicEnabled;if(gs)gs.checked=sfxEnabled;
}
function resetBackground(){bgStartedAt=performance.now();bgBaseIndex=Math.floor(Math.random()*bgThemes.length);bgIndex=bgBaseIndex;}
function currentBackground(){
  if(!bgStartedAt)resetBackground();
  const elapsed=performance.now()-bgStartedAt;
  const cycle=Math.floor(elapsed/BG_DURATION);
  bgIndex=(bgBaseIndex+cycle)%bgThemes.length;
  const theme=bgThemes[bgIndex];
  const phase=(elapsed%BG_DURATION)/BG_DURATION;
  return {theme,phase,cycle};
}

const skins=[
  ["Classic","sword-classic.png","#55d9ff"],
  ["Fire","sword-fire.png","#ff5a1f"],
  ["Lightning","sword-lightning.png","#ffe34a"],
  ["Poison","sword-poison.png","#9cff3b"],
  ["Purple","sword-purple.png","#c875ff"],
  ["Rainbow","sword-rainbow.png","rainbow"],
  ["Cartoon Blue","sword-cartoon-blue.svg","#55d9ff"],
  ["Robot","sword-robot.svg","#dfe8ef"],
  ["Candy","sword-candy.svg","#ff9fcf"],
  ["Ninja","sword-ninja.svg","#d83b57"],
  ["Dragon","sword-dragon.svg","#7de35b"],
  ["Pixel","sword-pixel.svg","#6fe7ff"],
  ["Galaxy","sword-galaxy.svg","#ff65c3"],
  ["Ocean","sword-ocean.svg","#40e0d0"],
  ["Space","sword-space.svg","#8e7dff"],
  ["Comic","sword-comic.svg","#ff3d3d"],
  ["Flame Hero","sword-flame-hero.svg","#ff5b22"],
  ["Moon Ninja","sword-moon-ninja.svg","#9c7cff"],
  ["Spirit Blade","sword-spirit.svg","#62f5ff"],
  ["Mecha Star","sword-mecha.svg","#dbe8ff"],
  ["Demon Red","sword-demon.svg","#ff355d"],
  ["Pirate Wave","sword-pirate.svg","#35c8ff"],
  ["Magic Heart","sword-magic-heart.svg","#ff8ed1"],
  ["Cyber Samurai","sword-cyber-samurai.svg","#62ffb0"],
  ["Dragon Aura","sword-dragon-aura.svg","#8dff4f"],
  ["Shadow Reaper","sword-shadow-reaper.svg","#b58cff"]
];
const swordImages=skins.map(s=>{const im=new Image();im.src=s[1];return im});
unlockedSkins.length=skins.length; while(unlockedSkins.length<skins.length) unlockedSkins.push(false);
const fruitSet=["🍎","🍊","🍋","🍓","🍌","🍇","🥝","🍐","🍑","🍒","🥭","🍍","🥥","🫐","🍈"],vegSet=["🥕","🥦","🍅","🌽","🥒","🍆","🧅","🥬"];
function show(id){screens.forEach(s=>s.classList.remove("active"));document.getElementById(id).classList.add("active")}
function showMenu(){running=false;paused=false;cancelAnimationFrame(raf);stopMusic();updateOutsideScore();show("menu");startMenuBackground();syncAudioControls()}
function showStage(){show("stage")}
function chooseMode(m){mode=m;document.getElementById("modeTitle").textContent=m==="fruit"?"🍎 CHÉM TRÁI CÂY":"🥕 CHÉM RAU CỦ";show("difficulty")}
function showSettings(){show("settings")}
function showHelp(){show("help")}
function showAbout(){show("about")}
function showSkins(){renderSkins();show("skins")}
function updateOutsideScore(){const el=document.getElementById("outsideScore");if(el)el.textContent=totalScore}
function saveProgress(){localStorage.setItem("fruitSlashPoints",totalScore);localStorage.setItem("fruitSlashUnlocked",JSON.stringify(unlockedSkins));}
function renderSkins(){
  updateOutsideScore();
  const skinScore=document.getElementById("skinScore"); if(skinScore) skinScore.textContent=totalScore;
  document.getElementById("skinList").innerHTML=skins.map((s,i)=>{const unlocked=!!unlockedSkins[i];const action=unlocked?(i===selectedSkin?"✓ ĐÃ CHỌN":"CHỌN"):"🔒 MỞ KHÓA 500 ĐIỂM";return `<div class="skin ${i===selectedSkin?"selected":""} ${!unlocked?"locked":""}"><div class="knife-preview"><img src="${s[1]}" alt="${s[0]}" style="filter:${s[2]==="rainbow"?"none":"drop-shadow(0 0 10px "+s[2]+")"}"></div><b>${s[0]}</b><small>${unlocked?(i===selectedSkin?"Đang chọn":"Skin kiếm"):"Cần 500 điểm"}</small><button onclick="selectSkin(${i})" ${!unlocked&&totalScore<500?"disabled":""}>${action}</button></div>`}).join("");
}
function selectSkin(i){if(!unlockedSkins[i]){if(totalScore<500)return;totalScore-=500;unlockedSkins[i]=true;saveProgress();}selectedSkin=i;localStorage.skin=i;renderSkins();updateOutsideScore();}

// ===== VÒNG QUAY MAY MẮN: máy trượt ngang, mỗi lần mở lại sẽ reset =====
let wheelBusy=false;
let wheelTimer=null;
let wheelOpen=false;

function openLuckyWheel(){
  wheelOpen=true;
  const modal=document.getElementById("luckyWheel");
  modal.classList.add("show");
  updateWheelPoints();
  resetLuckyWheel();
}

function closeLuckyWheel(){
  if(wheelBusy)return;
  wheelOpen=false;
  document.getElementById("luckyWheel").classList.remove("show");
}

function updateWheelPoints(){
  ["skinScore","luckyScore","outsideScore"].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=totalScore});
}

function resetLuckyWheel(){
  const track=document.getElementById("rouletteTrack");
  track.style.transition="none";
  track.style.transform="translateX(0px)";
  void track.offsetWidth;
  document.getElementById("spinButton").disabled=totalScore<100;
  document.getElementById("spinButton").textContent="🎰 QUAY · 100 ĐIỂM";
  document.getElementById("luckyResult").textContent="🎁 Có thể nhận skin mới, +50 điểm hoặc “Chúc bạn may mắn lần sau”";
  buildRoulette([...Array(skins.length).keys(),"50","MISS",1,4,6,2,0,5,3,16,18,20,22,24]);
}

function buildRoulette(items){
  document.getElementById("rouletteTrack").innerHTML=items.map(v=>{
    if(v==="50")return `<div class="roulette-item reward"><div class="r-icon">💰</div><b>+50</b><small>ĐIỂM</small></div>`;
    if(v==="MISS")return `<div class="roulette-item miss"><div class="r-icon">😵</div><b>MAY MẮN</b><small>LẦN SAU</small></div>`;
    const s=skins[v];
    return `<div class="roulette-item"><img src="${s[1]}"><b>${s[0]}</b><small>SKIN</small></div>`;
  }).join("");
}

function spinLuckyWheel(){
  if(wheelBusy||!wheelOpen||totalScore<100)return;
  wheelBusy=true;
  totalScore-=100;
  saveProgress();
  updateWheelPoints();
  renderSkins();

  const button=document.getElementById("spinButton");
  button.disabled=true;
  button.textContent="⏳ ĐANG QUAY...";

  const pool=[...Array(skins.length).keys(),"50","MISS",1,4,6,2,0,5,3,"50",8,10,12,14,16,18,20,22,24];
  const result=pool[Math.floor(Math.random()*pool.length)];
  const sequence=[];
  for(let i=0;i<18;i++)sequence.push(pool[Math.floor(Math.random()*pool.length)]);
  const targetIndex=14;
  sequence[targetIndex]=result;

  const track=document.getElementById("rouletteTrack");
  // Luôn đưa track về đầu trước khi bắt đầu một lượt mới.
  track.style.transition="none";
  track.style.transform="translateX(0px)";
  buildRoulette(sequence);
  void track.offsetWidth; // ép trình duyệt nhận trạng thái 0px trước khi chạy animation

  const itemWidth=112;
  const targetCenter=targetIndex*itemWidth+52;
  const windowCenter=280;
  const finalX=windowCenter-targetCenter;
  track.style.transition="transform 4.8s cubic-bezier(.08,.72,.12,1)";
  requestAnimationFrame(()=>{track.style.transform=`translateX(${finalX}px)`;});

  const finish=()=>{
    track.removeEventListener("transitionend",finish);
    clearTimeout(wheelTimer);
    finishLuckyWheel(result);
  };
  track.addEventListener("transitionend",finish,{once:true});
  // Fallback nếu trình duyệt không phát transitionend.
  wheelTimer=setTimeout(finish,5600);
}

function finishLuckyWheel(result){
  if(!wheelBusy)return;
  wheelBusy=false;
  let message="";
  if(result==="50"){totalScore+=50;message="💰 TRÚNG +50 ĐIỂM!";}
  else if(result==="MISS"){message="😵 CHÚC BẠN MAY MẮN LẦN SAU!";}
  else if(unlockedSkins[result]){totalScore+=50;message=`🔁 TRÚNG LẠI ${skins[result][0]} — HOÀN 50 ĐIỂM!`;}
  else{unlockedSkins[result]=true;selectedSkin=result;localStorage.skin=result;message=`🎉 CHÚC MỪNG! BẠN NHẬN ĐƯỢC SKIN ${skins[result][0]}!`;}
  saveProgress();
  updateWheelPoints();
  renderSkins();
  document.getElementById("luckyResult").textContent=message;
  const button=document.getElementById("spinButton");
  button.disabled=totalScore<100;
  button.textContent="🎰 QUAY · 100 ĐIỂM";
}
const GAME_W=1100, GAME_H=650;
function resize(){canvas.width=GAME_W;canvas.height=GAME_H;ctx.setTransform(1,0,0,1,0,0)}
addEventListener("resize",resize);resize();startMenuBackground();selectedSkin=+localStorage.skin||0;if(!unlockedSkins[selectedSkin])selectedSkin=0;updateOutsideScore();
const cfg=[{l:5,interval:900,speed:760,bomb:.12},{l:4,interval:680,speed:820,bomb:.22},{l:3,interval:470,speed:1000,bomb:.34}];
function startGame(d){ensureAudio();resetBackground();startOuterThemeCycle();playedSeconds=0;gameStartedAt=0;document.getElementById("playedTime").textContent="0";document.getElementById("finalTime").textContent="0";if(musicEnabled)startMusic();sfx("start");difficulty=d;score=0;lives=cfg[d].l;gameSettled=false;objects=[];slashes=[];sliced=[];blade.x=85;blade.y=GAME_H-85;blade.angle=-Math.PI/4;blade.visible=true;blade.life=999;pointer.x=85;pointer.y=GAME_H-85;pointer.down=false;paused=false;running=false;document.getElementById("score").textContent=0;updateLives();document.getElementById("gameOver").classList.remove("show");document.getElementById("pausePanel").classList.remove("show");show("game");countdown()}
function countdown(){let n=3,c=document.getElementById("countdown");c.textContent=n;let t=setInterval(()=>{n--;if(n>0)c.textContent=n;else if(n===0){c.textContent="BẮT ĐẦU!";setTimeout(()=>{c.textContent="";running=true;paused=false;gameStartedAt=performance.now();last=gameStartedAt;if(musicEnabled)startMusic();raf=requestAnimationFrame(loop)},450)}else{clearInterval(t)}},700)}
function updateLives(){document.getElementById("lives").textContent="❤️".repeat(lives)+"🖤".repeat(cfg[difficulty].l-lives)}
const largeFruitSet=new Set(["🍉","🍍","🥥","🥭","🍈"]);
function spawn(){
  // Dưa hấu cực hiếm: xuất hiện một mình. Khi chém, xử lý như trái cây bình thường.
  const rareWatermelon=mode==="fruit" && Math.random()<.008 && objects.length===0;
  if(rareWatermelon){
    objects=[];
    sliced=[];
    const size=1.35+Math.random()*.12;
    objects.push({x:GAME_W/2,y:GAME_H+50,vx:(Math.random()-.5)*180,vy:-cfg[difficulty].speed*(.9+Math.random()*.2),g:900,r:34*size,type:"watermelonBoss",emoji:"🍉",rot:0,size,large:true,rareWatermelon:true,hits:0,maxHits:30});
    return;
  }
  const special=Math.random()<.025;
  const heal=Math.random()<.009&&!special;
  const bomb=Math.random()<cfg[difficulty].bomb&&!special&&!heal;
  const emoji=bomb?"💣":heal?"❤️":special?(mode==="fruit"?fruitSet[Math.floor(Math.random()*fruitSet.length)]:"🥕"):(mode==="fruit"?fruitSet[Math.floor(Math.random()*fruitSet.length)]:vegSet[Math.floor(Math.random()*vegSet.length)]);
  // Một số trái lớn hơn để tạo cảm giác đa dạng. Trái nhỏ được thưởng nhiều điểm hơn.
  const large=!bomb && !heal && (special || largeFruitSet.has(emoji));
  const size=large?(1.12+Math.random()*.10):(0.78+Math.random()*.12);
  const baseR=34*size;
  let x=60+Math.random()*(GAME_W-120),y=GAME_H+50;
  objects.push({x,y,vx:(Math.random()-.5)*260,vy:-cfg[difficulty].speed*(.85+Math.random()*.35),g:900,r:baseR,type:bomb?"bomb":heal?"heal":special?"special":"normal",emoji,rot:0,size,large});
}
function loop(now){if(!running||paused)return;const dt=Math.min(.032,(now-last)/1000);last=now;playedSeconds=Math.max(0,Math.floor((now-gameStartedAt)/1000));document.getElementById("playedTime").textContent=playedSeconds;spawnTimer+=dt*1000;if(spawnTimer>cfg[difficulty].interval){spawnTimer=0;const hadWatermelon=objects.some(o=>o.rareWatermelon);if(!hadWatermelon){spawn();if(!objects.some(o=>o.rareWatermelon)&&difficulty===2&&Math.random()<.25)spawn()}}update(dt);draw();raf=requestAnimationFrame(loop)}
function update(dt){for(let i=objects.length-1;i>=0;i--){let o=objects[i];
  if(o.type==="watermelonBoss"){
    o.x+=o.vx*dt; o.y+=o.vy*dt; o.vy+=o.g*dt; o.rot+=dt*1.2;
    if(o.x<140||o.x>GAME_W-140)o.vx*=-1;
    if(o.y<180){o.y=180;o.vy=Math.abs(o.vy)*.72;}
    if(o.y>GAME_H-150){o.y=GAME_H-150;o.vy=-Math.abs(o.vy)*.72;}
    watermelonFlash=Math.max(0,watermelonFlash-dt);
    continue;
  }
  o.x+=o.vx*dt;o.y+=o.vy*dt;o.vy+=o.g*dt;o.rot+=dt*2;if(o.x<30||o.x>GAME_W-30)o.vx*=-1;if(o.y>GAME_H+80){objects.splice(i,1)}}slashes.forEach(s=>s.life-=dt);slashes=slashes.filter(s=>s.life>0);
if(window.__scorePopups){window.__scorePopups.forEach(p=>{p.y+=p.vy*dt;p.vy+=35*dt;p.life-=dt});window.__scorePopups=window.__scorePopups.filter(p=>p.life>0)}
for(let i=sliced.length-1;i>=0;i--){let h=sliced[i];h.x+=h.vx*dt;h.y+=h.vy*dt;h.vy+=h.g*dt;h.rot+=h.vrot*dt;h.life-=dt;if(h.life<=0)sliced.splice(i,1)}
if(blade.visible&&blade.life<900){blade.life-=dt;if(blade.life<=0){blade.visible=true;blade.life=999}}
}
function draw(){ctx.clearRect(0,0,GAME_W,GAME_H);
  // Background trong khu vực chơi tự động đổi mỗi 2 phút, chuyển màu mượt theo từng theme.
  const {theme,phase}=currentBackground();
  const blend=phase<.12 ? phase/.12 : phase>.88 ? (1-phase)/.12 : 1;
  const grd=ctx.createLinearGradient(0,0,GAME_W,GAME_H);
  grd.addColorStop(0,theme.a);grd.addColorStop(.5,theme.b);grd.addColorStop(1,theme.c);
  ctx.fillStyle=grd;ctx.fillRect(0,0,GAME_W,GAME_H);
  const glow1=ctx.createRadialGradient(180+Math.sin(performance.now()/2600)*80,130,0,180,130,280);
  glow1.addColorStop(0,theme.g1);glow1.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=glow1;ctx.fillRect(0,0,GAME_W,GAME_H);
  const glow2=ctx.createRadialGradient(900+Math.cos(performance.now()/3100)*70,520,0,900,520,320);
  glow2.addColorStop(0,theme.g2);glow2.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=glow2;ctx.fillRect(0,0,GAME_W,GAME_H);
  // Hạt sáng chuyển động nhẹ để nền có chiều sâu.
  const t=performance.now()/1000;
  for(let i=0;i<38;i++){
    const x=(i*173+t*(8+(i%5)*2))%GAME_W;
    const y=(i*97+55+Math.sin(t*.7+i)*12)%GAME_H;
    ctx.globalAlpha=.045+(i%4)*.012;ctx.fillStyle="#fff";
    ctx.beginPath();ctx.arc(x,y,1.5+(i%3),0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
objects.forEach(o=>{ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rot);
  const drawSize=o.type==="watermelonBoss" ? o.size*watermelonZoom : o.size;
  ctx.font=`${58*drawSize}px Arial`;ctx.textAlign="center";ctx.textBaseline="middle";
  if(o.type==="special"){ctx.shadowBlur=25;ctx.shadowColor="#fff59a"}
  if(o.type==="watermelonBoss"){
    ctx.shadowBlur=watermelonFlash>0?40:28;ctx.shadowColor=watermelonFlash>0?"#fff":"#75ff8a";
    ctx.beginPath();ctx.arc(0,0,48*watermelonZoom,0,Math.PI*2);ctx.strokeStyle=`rgba(255,255,255,${.22+.12*Math.sin(performance.now()/120)})`;ctx.lineWidth=3;ctx.stroke();
  }
  ctx.fillText(o.emoji,0,0);
  if(o.type==="watermelonBoss"){ctx.rotate(-o.rot);ctx.font="bold 22px Arial";ctx.fillStyle="#fff";ctx.shadowBlur=7;ctx.shadowColor="#000";ctx.fillText(`${o.hits||0}/30`,0,88*watermelonZoom);}
  ctx.restore()});
// Hai nửa của trái cây/rau củ sau khi bị chém
sliced.forEach(h=>{drawFruitHalf(h)});
slashes.forEach(s=>{
  const a=Math.max(0,Math.min(1,s.life/.25));
  ctx.save();ctx.lineWidth=7;ctx.lineCap="round";
  if(s.skin==="rainbow"){
    const g=ctx.createLinearGradient(s.x1,s.y1,s.x2,s.y2);
    g.addColorStop(0,`rgba(255,70,70,${a})`);g.addColorStop(.25,`rgba(255,220,60,${a})`);g.addColorStop(.5,`rgba(70,255,150,${a})`);g.addColorStop(.75,`rgba(70,180,255,${a})`);g.addColorStop(1,`rgba(200,80,255,${a})`);ctx.strokeStyle=g;
  }else{ctx.strokeStyle=hexToRgba(s.skin||skinColor(),a)}
  ctx.shadowBlur=14;ctx.shadowColor=s.skin==="rainbow"?"#b96cff":s.skin||skinColor();
  ctx.beginPath();ctx.moveTo(s.x1,s.y1);ctx.lineTo(s.x2,s.y2);ctx.stroke();ctx.restore();
});
if(window.__scorePopups){
  window.__scorePopups.forEach(p=>{ctx.save();ctx.globalAlpha=Math.max(0,p.life/.65);ctx.font="bold 24px Arial";ctx.textAlign="center";ctx.fillStyle="#fff";ctx.shadowBlur=8;ctx.shadowColor="#000";ctx.fillText(p.text,p.x,p.y);ctx.restore()});
}
if(blade.visible) drawBlade(blade.x,blade.y,blade.angle,blade.life/.16);
}
let pointer={x:0,y:0,down:false};function pointerPos(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*GAME_W/r.width,y:(e.clientY-r.top)*GAME_H/r.height}}
canvas.addEventListener("pointerdown",e=>{const p=pointerPos(e);pointer.down=true;slashGestureHit=false;pointer.x=p.x;pointer.y=p.y;blade.x=p.x;blade.y=p.y;blade.visible=true;blade.life=999});
canvas.addEventListener("pointermove",e=>{if(paused||!running)return;const p=pointerPos(e),nx=p.x,ny=p.y;const moved=Math.hypot(nx-pointer.x,ny-pointer.y)>0.5;if(moved&&pointer.down){slashes.push({x1:pointer.x,y1:pointer.y,x2:nx,y2:ny,life:.25,skin:skinColor()});checkSlash(pointer.x,pointer.y,nx,ny)}if(moved){blade.angle=Math.atan2(ny-pointer.y,nx-pointer.x)+Math.PI/4;}blade.x=nx;blade.y=ny;blade.visible=true;blade.life=999;pointer.x=nx;pointer.y=ny});
canvas.addEventListener("pointerup",()=>pointer.down=false);canvas.addEventListener("pointercancel",()=>pointer.down=false);
function checkSlash(x1,y1,x2,y2){for(let i=objects.length-1;i>=0;i--){let o=objects[i];let hitRadius=o.type==="watermelonBoss"?o.r*watermelonZoom:o.r;let d=segDist(o.x,o.y,x1,y1,x2,y2);if(d<hitRadius){
  if(o.type==="bomb"){hitBomb();objects.splice(i,1);}
  else if(o.type==="heal"){
    const maxLives=cfg[difficulty].l;
    if(lives<maxLives){ lives=Math.min(maxLives,lives+1); updateLives(); sfx("special"); }
    else { score+=1; document.getElementById("score").textContent=score; sfx("special"); }
    healEffect(o); objects.splice(i,1);
  }
  else if(o.type==="watermelonBoss"){
    // Dưa hấu hiếm: mỗi nhát chém hợp lệ +3 điểm, không biến mất cho tới đủ 30 nhát.
    if(slashGestureHit) continue;
    slashGestureHit=true;
    o.hits=(o.hits||0)+1;watermelonHits=o.hits;watermelonZoom=Math.min(2.15,1+o.hits*.038);watermelonFlash=.16;
    score+=3;document.getElementById("score").textContent=score;
    bossHitEffect(o);
    if(o.hits>=o.maxHits){watermelonBurst(o);objects.splice(i,1);}
  }
  else{
    // Trái nhỏ = +2 điểm, trái lớn = +1 điểm. Trái đặc biệt thường = +10 điểm.
    const gained=o.type==="special"?10:(o.large?1:2);
    score+=gained;document.getElementById("score").textContent=score;
    splitObject(o);hitEffect(o,gained);objects.splice(i,1);
  }
}}}

function bossHitEffect(o){
  sfx("special");
  for(let i=0;i<12;i++){slashes.push({x1:o.x,y1:o.y,x2:o.x+(Math.random()-.5)*150,y2:o.y+(Math.random()-.5)*150,life:.22,skin:skinColor()})}
  if(!window.__scorePopups)window.__scorePopups=[];
  window.__scorePopups.push({x:o.x,y:o.y-65,vy:-38,life:.65,text:`+3  ·  ${o.hits}/30`});
}
function healEffect(o){
  for(let i=0;i<16;i++){const a=Math.random()*Math.PI*2,dist=18+Math.random()*70;slashes.push({x1:o.x,y1:o.y,x2:o.x+Math.cos(a)*dist,y2:o.y+Math.sin(a)*dist,life:.45,skin:i%2?"#ff6b81":"#ffffff"})}
  if(!window.__scorePopups)window.__scorePopups=[];
  window.__scorePopups.push({x:o.x,y:o.y-55,vy:-45,life:.8,text:lives<cfg[difficulty].l?"❤️ +1 MÁU":"❤️ ĐẦY MÁU"});
}
function watermelonBurst(o){
  sfx("special");
  for(let i=0;i<32;i++){const a=Math.random()*Math.PI*2,dist=30+Math.random()*150;slashes.push({x1:o.x,y1:o.y,x2:o.x+Math.cos(a)*dist,y2:o.y+Math.sin(a)*dist,life:.5,skin:i%2?"#7dff7d":"#ffffff"})}
  window.__scorePopups=window.__scorePopups||[];window.__scorePopups.push({x:o.x,y:o.y,vy:-55,life:1.0,text:"💥 DƯA HẤU NỔ! +90"});
  watermelonHits=0;watermelonZoom=1;slashGestureHit=false;
}
function skinColor(){return skins[selectedSkin]?.[2]||"#ffffff"}
function hexToRgba(hex,a){
  if(!hex||hex==="rainbow")return `rgba(185,108,255,${a})`;
  const h=hex.replace("#","");const n=parseInt(h,16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
function drawBlade(x,y,angle,alpha=1){
  const im=swordImages[selectedSkin]||swordImages[0];
  if(!im.complete||!im.naturalWidth)return;
  ctx.save();
  ctx.translate(x,y);
  // Ảnh kiếm gốc giữ nguyên hình dáng; chỉ thay ảnh màu theo skin.
  ctx.rotate(angle);
  ctx.globalAlpha=Math.max(0,Math.min(1,alpha));
  const glow=skins[selectedSkin]?.[2]==="rainbow"?"#b96cff":skins[selectedSkin]?.[2]||"#55d9ff";
  ctx.shadowBlur=16;
  ctx.shadowColor=glow;
  const size=104;
  ctx.drawImage(im,-size/2,-size/2,size,size);
  ctx.restore();
}
function splitObject(o){
  if(o.type==="special"||o.type==="normal"){
    sliced.push({x:o.x-5,y:o.y,vx:o.vx-120,vy:o.vy-40,g:o.g,rot:o.rot-.08,vrot:-4,emoji:o.emoji,side:-1,life:1.0,size:o.size||1});
    sliced.push({x:o.x+5,y:o.y,vx:o.vx+120,vy:o.vy-40,g:o.g,rot:o.rot+.08,vrot:4,emoji:o.emoji,side:1,life:1.0,size:o.size||1});
  }
}
function drawFruitHalf(h){
  ctx.save();ctx.translate(h.x,h.y);ctx.rotate(h.rot);ctx.font=`${58*(h.size||1)}px Arial`;ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.beginPath();if(h.side<0)ctx.rect(-34,-34,34,68);else ctx.rect(0,-34,34,68);ctx.clip();ctx.fillText(h.emoji,0,0);ctx.restore();
}
function segDist(px,py,x1,y1,x2,y2){let dx=x2-x1,dy=y2-y1,t=((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy||1);t=Math.max(0,Math.min(1,t));let x=x1+t*dx,y=y1+t*dy;return Math.hypot(px-x,py-y)}
function hitBomb(){sfx("bomb");lives--;updateLives();if(lives<=0){
  running=false;
  document.getElementById("finalScore").textContent=score;
  document.getElementById("finalTime").textContent=playedSeconds;
  if(!gameSettled){totalScore+=score;gameSettled=true;saveProgress();updateOutsideScore();}
  document.getElementById("gameOver").classList.add("show");stopMusic();sfx("gameover");
}}
function hitEffect(o,gained=1){
  sfx(o.type==="special"?"special":"slice");
  for(let i=0;i<8;i++){slashes.push({x1:o.x,y1:o.y,x2:o.x+(Math.random()-.5)*100,y2:o.y+(Math.random()-.5)*100,life:.25,skin:skinColor()})}
  // Hiện nhanh số điểm vừa nhận ngay tại trái cây.
  if(o.type!=="special"){
    if(!window.__scorePopups)window.__scorePopups=[];
    window.__scorePopups.push({x:o.x,y:o.y,vy:-42,life:.65,text:`+${gained}`});
  }
}
function togglePause(){
  if(!document.getElementById("gameOver").classList.contains("show")){
    paused=!paused;
    document.getElementById("pausePanel").classList.toggle("show",paused);
    if(paused)stopMusic();
    else{last=performance.now();if(musicEnabled)startMusic();raf=requestAnimationFrame(loop);}
    syncAudioControls();
  }
}
function restartGame(){startGame(difficulty)}
syncAudioControls();
document.getElementById("musicToggle").onchange=e=>{musicEnabled=e.target.checked;localStorage.music=musicEnabled;if(musicEnabled&&running&&!paused)startMusic();else stopMusic();syncAudioControls();};
document.getElementById("sfxToggle").onchange=e=>{sfxEnabled=e.target.checked;localStorage.sfx=sfxEnabled;syncAudioControls();};
document.getElementById("volume").oninput=e=>{masterVolume=Number(e.target.value);localStorage.volume=masterVolume;if(audioMaster)audioMaster.gain.value=masterVolume;};
document.getElementById("gameMusic").onchange=e=>{musicEnabled=e.target.checked;localStorage.music=musicEnabled;if(musicEnabled&&!paused)startMusic();else stopMusic();syncAudioControls();};
document.getElementById("gameSfx").onchange=e=>{sfxEnabled=e.target.checked;localStorage.sfx=sfxEnabled;syncAudioControls();};
