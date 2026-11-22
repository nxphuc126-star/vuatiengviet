import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, addDoc, onSnapshot, query, orderBy, limit, deleteDoc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsT89zdpQwALQ0kmYta7mtwCXaj_yJc8Q",
  authDomain: "vuatiengviet-7a1cb.firebaseapp.com",
  projectId: "vuatiengviet-7a1cb",
  storageBucket: "vuatiengviet-7a1cb.firebasestorage.app",
  messagingSenderId: "563648012328",
  appId: "1:563648012328:web:9b6bdc3e45179dd90ed51d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const $ = id => document.getElementById(id), A = $('app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => String(s).toLowerCase().trim().replace(/[.,!?;:"“”()]/g,'');

let Q = [], i = 0, sc = 0, st = 0, ok = 0, tl = 25, tm = null, name = '', wrong = [], done = false;
let studentClass = "";
let currentView = "home";
let unsubscribeLeaderboard = null;

let isCheating = false;
let isKicked = false;

// Phiên không được ghi bằng REST khi unload; trạng thái cũ sẽ tự hết hạn ở màn hình giáo viên.

function listenForKick() {
  onSnapshot(doc(db, "active_sessions", window.sessionId), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // 1. XỬ LÝ KHI BỊ ĐUỔI
      if (data.kicked === true && !isKicked) {
        isKicked = true;
        clearInterval(tm);
        deleteDoc(doc(db, "active_sessions", window.sessionId));

        A.innerHTML = `
          <div class="c ctr" style="border-color:var(--bad); background:#ffebee; margin-top:50px;">
            <h1 style="color:var(--bad); font-size:2rem;">🚫 BẠN ĐÃ BỊ ĐUỔI</h1>
            <p style="font-size:1.2rem;">Giáo viên đã kết thúc phiên làm bài của bạn do vi phạm.</p>
            <p style="font-weight:bold; color:var(--bad);">Trình duyệt sẽ tự động đóng sau <span id="kick-timer">9</span> giây...</p>
          </div>`;
        
        let kickTime = 9;
        setInterval(() => {
          kickTime--;
          if ($('kick-timer')) $('kick-timer').textContent = kickTime;
          if (kickTime <= 0) { window.close(); window.location.href = "about:blank"; }
        }, 1000);
      }

      // 2. XỬ LÝ KHI BỊ CẢNH BÁO
      if (data.warningTimestamp && data.warningTimestamp > (window.lastWarningTime || 0)) {
        window.lastWarningTime = data.warningTimestamp;
        sc = data.score; 
        
        if (document.querySelector('.top span:nth-child(2)')) {
          document.querySelector('.top span:nth-child(2)').textContent = `⭐ ${sc} · 🔥 ${st}`;
        }

        const toast = document.createElement('div');
        toast.style.cssText = "position:fixed; bottom:20px; right:20px; background:#b91c1c; color:#fff; padding:15px 20px; border-radius:10px; font-weight:bold; z-index:9999; box-shadow:0 4px 10px rgba(0,0,0,0.3); font-size:1rem; max-width:300px; animation: slideIn 0.3s ease-out;";
        toast.innerHTML = `⚠️ CẢNH CÁO TỪ GIÁO VIÊN!<br><span style="font-weight:normal; font-size:0.9rem;">${esc(data.warningMessage)}</span>`;
        document.body.appendChild(toast);
        
        setTimeout(() => { toast.remove(); }, 6000);
      }
    }
  });
}

async function updateProgress() {
  if (!window.sessionId || isKicked) return;
  try {
    await setDoc(doc(db, "active_sessions", window.sessionId), {
      ownerUid: auth.currentUser.uid, studentName: name, currentQuestionIndex: i + 1, totalQuestions: Q.length,
      score: sc, lastUpdate: new Date(), status: "playing", cheating: isCheating
    }, { merge: true });
  } catch (e) {}
}

async function saveScore() {
  try {
    await addDoc(collection(db, "leaderboard"), { ownerUid: auth.currentUser.uid, name, score: sc, correct: ok, total: Q.length, timestamp: new Date() });
  } catch (e) {}
}

async function home() {
  currentView = "home";
  clearInterval(tm);
  if (unsubscribeLeaderboard) {
    unsubscribeLeaderboard();
    unsubscribeLeaderboard = null;
  }
  let hwHtml = '';

  // 1. Kiểm tra BTVN
  try {
    const hwSnap = await getDoc(doc(db, "settings", "homework"));
    if (hwSnap.exists() && hwSnap.data().url) {
      const hw = hwSnap.data();
      hwHtml = `
        <div style="margin-top:15px; padding:10px; background:#e0f2fe; border:1px solid #bae6fd; border-radius:8px;">
          <p style="margin:0 0 8px 0; font-weight:bold; color:#0369a1;">📚 Bài tập về nhà: ${esc(hw.fileName)}</p>
          <a href="${hw.url}" target="_blank" style="display:inline-block; background:#0284c7; color:#fff; padding:8px 16px; border-radius:6px; text-decoration:none; font-weight:bold; font-size:0.9rem;">⬇ Tải File Về Máy</a>
        </div>`;
    } else {
      hwHtml = `
        <div style="margin-top:15px; padding:10px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px;">
          <p style="margin:0; color:#b91c1c; font-weight:bold; font-size:0.9rem;">⚠️ Cô giáo chưa đưa bài tập về nhà lên.</p>
        </div>`;
    }
  } catch(e) {}

  // 3. Lắng nghe bảng xếp hạng
  const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(10));
  unsubscribeLeaderboard = onSnapshot(q, (snap) => {
    let lb = []; snap.forEach(d => lb.push(d.data()));
    
    // Chỉ cập nhật giao diện khi người dùng vẫn đang ở trang chủ.
    if (currentView !== "home") return;

    A.innerHTML = `
      <h1>👑 VUA TIẾNG VIỆT</h1><p class="sub">Ngữ văn 7 · Kết nối tri thức · Tập 1</p>
      <div class="c">
        <label>Tên của bạn</label>
        <input id="nm" placeholder="Nhập tên..." value="${esc(name)}">
        
        <label style="margin-top:12px;">Chọn Lớp</label>
        <select id="cls" style="width:100%; padding:12px; border-radius:10px; border:2px solid var(--line); background:var(--bg); font-size:1rem; color:var(--ink);">
          <option value="">-- Chọn lớp của bạn --</option>
          <option value="7A1" ${studentClass === '7A1' ? 'selected' : ''}>Lớp 7A1</option>
          <option value="7A2" ${studentClass === '7A2' ? 'selected' : ''}>Lớp 7A2</option>
          <option value="7A3" ${studentClass === '7A3' ? 'selected' : ''}>Lớp 7A3</option>
          <option value="7A4" ${studentClass === '7A4' ? 'selected' : ''}>Lớp 7A4</option>
        </select>

        <p id="err-msg" style="color:var(--bad); font-weight:bold; display:none; margin-top:10px;">Vui lòng nhập tên và chọn lớp!</p>

        ${hwHtml}

        <p style="margin:14px 0 6px">Bộ đề gồm ${QUIZ_DATA.length} câu.</p>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <button class="b" id="btnFull">▶ Chơi trọn bộ</button>
            <button class="b g" id="btnTen" style="background:#fff; color:var(--pri); border:2px solid var(--pri);">⚡ Thử thách 10 câu</button>
        </div>

      </div>
      <div class="c"><b>🏆 Bảng vàng (Trực tuyến)</b>${lb.length?'<table>'+lb.map((r,k)=>`<tr><td>${k+1}</td><td>${esc(r.name)}</td><td>${r.score} điểm</td><td>${r.correct}/${r.total}</td></tr>`).join('')+'</table>':'<p style="color:var(--mut)">Chưa có ai.</p>'}</div>`;
    
    $('btnFull').onclick = () => checkInputAndGo(QUIZ_DATA.length);
    $('btnTen').onclick = () => checkInputAndGo(10);


  });
}

function checkInputAndGo(n) {
  const inputName = $('nm').value.trim();
  const inputClass = $('cls').value;

  if (!inputName || !inputClass) {
    $('err-msg').style.display = 'block';
    return;
  }
  
  $('err-msg').style.display = 'none';
  name = `${inputName} (${inputClass})`;
  studentClass = inputClass;
  
  go(n); 
}

async function go(n) {
  isKicked = false;
  Q = [...QUIZ_DATA].sort(() => Math.random() - 0.5).slice(0, Math.min(n, QUIZ_DATA.length));
  i = 0; sc = 0; st = 0; ok = 0; wrong = [];
  isCheating = false;
  window.sessionId = "s_" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "_" + Math.random().toString(36).slice(2));
  listenForKick();
  show();
}

function show() {
  clearInterval(tm);
  if (i >= Q.length) return end();
  const q = Q[i];
  tl = 25; done = false;
  let body = '';

  if (q.t === 'mc') body = q.o.map((o,k) => `<button class="o" data-idx="${k+1}">${'ABCD'[k]||k+1}. ${esc(o)}</button>`).join('');
  if (q.t === 'tf') body = `<button class="o" data-val="đúng">✅ Đúng</button><button class="o" data-val="sai">❌ Sai</button>`;
  if (q.t === 'fill') body = `<input id="fi" placeholder="Gõ đáp án..." autocomplete="off"><button class="b" style="margin-top:10px" id="btnSubmit">Trả lời</button>`;
  if (q.t === 'find') body = `<p style="color:var(--mut);margin:0 0 8px">Chạm vào từ viết sai chính tả:</p><div class="words">${q.q.split(/\s+/).map(w => `<button class="o" data-word="${esc(w)}">${esc(w)}</button>`).join('')}</div>`;

  A.innerHTML = `
    <div class="top"><span>Câu ${i+1}/${Q.length}</span><span>⭐ ${sc} · 🔥 ${st}</span><span id="tt">⏱ ${tl}s</span></div>
    <div class="bar"><i id="br" style="width:100%"></i></div>
    <div class="c">
      <span class="chip">${esc(q.c)}${q.t==='fill'?' · Điền chữ':q.t==='find'?' · Tìm lỗi sai':q.t==='tf'?' · Đúng/Sai':''}</span>
      ${q.t==='find'?'':`<div class="q">${esc(q.q)}</div>`}
      ${body}
      <div id="fb"></div>
    </div>`;

  document.querySelectorAll('.o').forEach(btn => {
    btn.onclick = function() {
      if (this.dataset.idx) ans(parseInt(this.dataset.idx));
      else if (this.dataset.val) ans(this.dataset.val);
      else if (this.dataset.word) ans(this.dataset.word);
    };
  });

  if (q.t === 'fill') {
    $('fi').focus();
    $('fi').onkeydown = (e) => { if (e.key === 'Enter') ans($('fi').value); };
    $('btnSubmit').onclick = () => ans($('fi').value);
  }

  updateProgress();

  tm = setInterval(() => {
    tl--;
    if($('tt')) $('tt').textContent = '⏱ ' + tl + 's';
    if($('br')) $('br').style.width = tl/25*100 + '%';
    if (tl <= 0) { clearInterval(tm); ans(null); }
  }, 1000);
}

function ans(v) {
  if (done) return;
  done = true; clearInterval(tm);
  const q = Q[i];
  let r = false;

  if (v !== null) {
    if (q.t === 'mc' || q.t === 'tf') r = norm(v) === norm(q.a);
    else r = String(q.a).split('|').map(norm).includes(norm(v));
  }

  if (r) { st++; ok++; sc += 100 + tl * 2 + Math.min(st, 5) * 10; }
  else { st = 0; wrong.push(q); }

  document.querySelectorAll('.o').forEach((b) => {
    b.disabled = true;
    if (q.t === 'mc') {
      const idx = parseInt(b.dataset.idx);
      if (idx == q.a) b.classList.add('ok');
      else if (v == idx) b.classList.add('bad');
    } else if (q.t === 'tf') {
      const m = b.dataset.val;
      if (m == q.a) b.classList.add('ok');
      else if (norm(v||'') == m) b.classList.add('bad');
    } else if (q.t === 'find') {
      const w = b.dataset.word;
      if (norm(w) === norm(q.a)) b.classList.add('ok');
      else if (v && norm(w) === norm(v)) b.classList.add('bad');
    }
  });
  
  if (q.t === 'fill' && $('fi')) $('fi').disabled = true;

  $('fb').innerHTML = `
    <div class="fb">
      <b style="color:var(--${r?'ok':'bad'})">${r?'🎉 Chính xác!':(v===null?'⏰ Hết giờ!':'😅 Chưa đúng.')}</b>
      ${r?'':' Đáp án: <b>'+esc(q.t==='mc'?q.o[q.a-1]:q.a)+'</b>.'}
      <br>${esc(q.e||'')}
    </div>
    <button class="b" style="margin-top:10px" id="btnNext">${i+1<Q.length?'Câu tiếp theo ➜':'Xem kết quả 🏁'}</button>`;
    
  $('btnNext').onclick = () => { i++; fishingRound(); };
}

function fishingRound() {
  clearInterval(tm);
  const fishTypes = [
    {name:"Cá rô",emoji:"🐟",points:20,rarity:"Thường"},
    {name:"Cá chép",emoji:"🐠",points:40,rarity:"Khá hiếm"},
    {name:"Cá vàng",emoji:"🐡",points:60,rarity:"Hiếm"},
    {name:"Cá kiếm",emoji:"🦈",points:100,rarity:"Siêu hiếm"},
    {name:"Cá thần tiên",emoji:"🐬",points:150,rarity:"Huyền thoại"}
  ];
  A.innerHTML = '<div class="top"><span>🎣 SĂN CÁ</span><span>⭐ '+sc+' điểm</span><span>'+i+'/'+Q.length+'</span></div>'+
    '<div class="c" style="padding:12px;background:#e0f2fe;border:2px solid #7dd3fc">'+
    '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;color:#075985;font-weight:bold"><span>⏱ <b id="fishTime">20</b>s</span><span>Điều khiển: A / D hoặc ← / →</span></div>'+
    '<canvas id="fishingCanvas" width="720" height="340" aria-label="Màn chơi câu cá" style="display:block;width:100%;max-width:720px;margin:10px auto;border:2px solid #38bdf8;border-radius:14px;background:#7dd3fc;touch-action:pan-y"></canvas>'+
    '<div style="display:flex;justify-content:center;gap:12px;margin:8px"><button class="b" id="fishLeft" style="background:#0369a1;color:white;min-width:90px">◀ A</button><button class="b" id="fishRight" style="background:#0369a1;color:white;min-width:90px">D ▶</button></div>'+
    '<p id="fishHint" style="text-align:center;color:#075985;font-weight:bold">Di chuyển móc câu để chạm vào cá đang bơi!</p>'+
    '<p style="text-align:center;color:#075985;font-size:.9rem">Cá càng hiếm, điểm thưởng càng cao. Bạn có 20 giây!</p></div>';
  const canvas=$('fishingCanvas'),ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;
  const hook={x:W/2,y:255},swimmers=Array.from({length:8},()=>({x:40+Math.random()*(W-80),y:155+Math.random()*125,speed:(.7+Math.random()*1.5)*(Math.random()<.5?-1:1),size:16+Math.random()*10,phase:Math.random()*6.28,caught:false}));
  let remaining=20,finished=false,frame=0,raf=0,timer=null;
  const keys={left:false,right:false},clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  function keyDown(e){if(["ArrowLeft","ArrowRight","a","A","d","D"].includes(e.key))e.preventDefault();if(e.key==="ArrowLeft"||e.key==="a"||e.key==="A")keys.left=true;if(e.key==="ArrowRight"||e.key==="d"||e.key==="D")keys.right=true;}
  function keyUp(e){if(e.key==="ArrowLeft"||e.key==="a"||e.key==="A")keys.left=false;if(e.key==="ArrowRight"||e.key==="d"||e.key==="D")keys.right=false;}
  function drawFish(f,t){ctx.save();ctx.translate(f.x,f.y+Math.sin(t/18+f.phase)*5);if(f.speed<0)ctx.scale(-1,1);ctx.font=(f.size*1.8)+'px serif';ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("🐟",0,0);ctx.restore();}
  function draw(){
    ctx.clearRect(0,0,W,H);const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,"#bae6fd");sky.addColorStop(.25,"#38bdf8");sky.addColorStop(1,"#075985");ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    ctx.fillStyle="rgba(255,255,255,.35)";for(let n=0;n<7;n++){ctx.beginPath();ctx.arc((n*127+frame*.4)%W,35+(n%3)*18,3,0,7);ctx.fill();}
    ctx.fillStyle="#d6a66b";ctx.fillRect(0,H-24,W,24);ctx.fillStyle="#166534";ctx.fillRect(0,H-30,W,7);
    swimmers.forEach(f=>{if(!f.caught)drawFish(f,frame);});
    ctx.strokeStyle="#78350f";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(W/2,0);ctx.quadraticCurveTo(hook.x-20,35,hook.x,65);ctx.stroke();
    ctx.strokeStyle="#f8fafc";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(hook.x,65);ctx.lineTo(hook.x,hook.y);ctx.stroke();
    ctx.lineWidth=4;ctx.beginPath();ctx.arc(hook.x+5,hook.y,8,Math.PI*.15,Math.PI*1.25);ctx.stroke();
    ctx.fillStyle="rgba(255,255,255,.8)";ctx.font="bold 15px sans-serif";ctx.fillText("A / ←",18,24);ctx.fillText("D / →",W-75,24);
  }
  function cleanup(){cancelAnimationFrame(raf);window.removeEventListener("keydown",keyDown);window.removeEventListener("keyup",keyUp);if(timer)clearInterval(timer);}
  function finish(award){
    if(finished)return;finished=true;cleanup();award=award||{name:"Chưa câu được cá",emoji:"🫧",points:0,rarity:"Hết lượt"};
    sc+=award.points;
    $('fishHint').innerHTML='<div style="font-size:3.5rem">'+award.emoji+'</div><b style="font-size:1.2rem;color:#075985">'+award.name+'</b><p>'+award.rarity+' · <b>+'+award.points+' điểm</b></p><p>Tổng điểm: <b>'+sc+'</b></p><button class="b" id="btnContinue">Tiếp tục ➜</button>';
    updateProgress();$('btnContinue').onclick=()=>{if(i>=Q.length)end();else show();};
  }
  function tick(){
    if(finished)return;frame++;if(keys.left)hook.x-=5;if(keys.right)hook.x+=5;hook.x=clamp(hook.x,28,W-28);
    swimmers.forEach(f=>{if(f.caught)return;f.x+=f.speed;if(f.x<-30)f.x=W+25;if(f.x>W+30)f.x=-25;if(Math.abs(f.x-hook.x)<25&&Math.abs((f.y+Math.sin(frame/18+f.phase)*5)-hook.y)<27){f.caught=true;finish(fishTypes[Math.floor(Math.random()*fishTypes.length)]);}});
    draw();raf=requestAnimationFrame(tick);
  }
  window.addEventListener("keydown",keyDown);window.addEventListener("keyup",keyUp);
  $('fishLeft').onpointerdown=()=>keys.left=true;$('fishLeft').onpointerup=$('fishLeft').onpointerleave=()=>keys.left=false;
  $('fishRight').onpointerdown=()=>keys.right=true;$('fishRight').onpointerup=$('fishRight').onpointerleave=()=>keys.right=false;
  timer=setInterval(()=>{if(finished){clearInterval(timer);return;}remaining--;if($('fishTime'))$('fishTime').textContent=remaining;if(remaining<=0)finish(null);},1000);
  draw();raf=requestAnimationFrame(tick);
}
async function end() {
  currentView = "result";
  const p = ok/Q.length*100;
  const rk = p>=90?['👑','VUA TIẾNG VIỆT']:p>=75?['🛡️','Hiệp sĩ Ngôn từ']:p>=50?['📚','Học giả Chăm chỉ']:['🌱','Tập sự Tiếng Việt'];
  
  if (window.sessionId) {
    try { await setDoc(doc(db,"active_sessions",window.sessionId), { ownerUid: auth.currentUser.uid, status: "finished", score: sc, lastUpdate: new Date() }, { merge: true }); } catch(e){}
  }
  await saveScore();

  A.innerHTML = `
    <div class="c ctr">
      <div class="big">${rk[0]}</div>
      <h1 style="font-size:1.7rem">${rk[1]}</h1>
      <p><b>${esc(name)}</b> · ${ok}/${Q.length} câu đúng · <b>${sc}</b> điểm</p>
      <button class="b" id="btnHome">Về trang chủ</button>
      <button class="b g" id="btnReplay">Chơi lại</button>
    </div>
    ${wrong.length ? `<div class="c"><b>Các câu cần ôn lại</b>${wrong.map(q=>`<p><span class="chip">${esc(q.c)}</span> ${esc(q.q)}<br>➜ <b>${esc(q.t==='mc'?q.o[q.a-1]:q.a)}</b> — ${esc(q.e||'')}</p>`).join('')}</div>` : ''}`;
    
  $('btnHome').onclick = home;
  $('btnReplay').onclick = () => go(Q.length);
}

signInAnonymously(auth)
  .then(() => home())
  .catch((error) => {
    console.error("Student authentication failed:", error);
    A.innerHTML = '<div class="c ctr"><h2>Không thể kết nối an toàn</h2><p>Vui lòng tải lại trang hoặc báo giáo viên kiểm tra cấu hình Firebase Authentication.</p></div>';
  });
