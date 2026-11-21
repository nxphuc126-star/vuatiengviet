import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, addDoc, onSnapshot, query, orderBy, limit, getDoc }
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

const $ = id => document.getElementById(id), A = $('app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => String(s).toLowerCase().trim().replace(/[.,!?;:"“”()]/g,'');

let Q = [], i = 0, sc = 0, st = 0, ok = 0, tl = 25, tm = null, name = '', wrong = [], done = false;

// --- CẤU HÌNH CHỤP MÀN HÌNH & GIAN LẬN ---
let isCheating = false;
let displayStream = null;
let isKicked = false;

const CLOUDINARY_CLOUD_NAME = "YOUR_CLOUD_NAME"; // ⚠️ ĐIỀN CLOUD NAME CỦA BẠN
const CLOUDINARY_UPLOAD_PRESET = "hocsinh_cheat";

async function initScreenShare() {
  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    return true;
  } catch (err) { return false; }
}

async function captureScreenAndUpload() {
  if (!displayStream || isKicked) return;
  const videoTrack = displayStream.getVideoTracks()[0];
  const imageCapture = new ImageCapture(videoTrack);
  
  try {
    const bitmap = await imageCapture.grabFrame();
    const canvas = document.createElement('canvas');
    canvas.width = 480; 
    canvas.height = (480 / bitmap.width) * bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const formData = new FormData();
      formData.append('file', blob);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      
      try {
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.secure_url) {
          await setDoc(doc(db, "active_sessions", window.sessionId), { cheatingImageUrl: data.secure_url, lastUpdate: new Date() }, { merge: true });
        }
      } catch (e) {}
    }, 'image/jpeg', 0.6);
  } catch (err) {}
}

document.addEventListener("visibilitychange", async () => {
  if (!window.sessionId || isKicked) return;
  if (document.visibilityState === "hidden") {
    isCheating = true;
    await captureScreenAndUpload(); 
  } else {
    isCheating = false;
  }
  updateProgress();
});

window.addEventListener("beforeunload", () => {
  if (!window.sessionId) return;
  const payload = JSON.stringify({ status: "offline" });
  const url = `https://firestore.googleapis.com/v1/projects/vuatiengviet-7a1cb/databases/(default)/documents/active_sessions/${window.sessionId}?updateMask.fieldPaths=status`;
  navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
});

function listenForKick() {
  onSnapshot(doc(db, "active_sessions", window.sessionId), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.kicked === true && !isKicked) {
        isKicked = true;
        clearInterval(tm);
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
          if (kickTime <= 0) {
            window.close();
            window.location.href = "about:blank";
          }
        }, 1000);
      }
    }
  });
}

async function updateProgress() {
  if (!window.sessionId || isKicked) return;
  try {
    await setDoc(doc(db, "active_sessions", window.sessionId), {
      studentName: name, currentQuestionIndex: i + 1, totalQuestions: Q.length,
      score: sc, lastUpdate: new Date(), status: "playing", cheating: isCheating
    }, { merge: true });
  } catch (e) {}
}

async function saveScore() {
  try {
    await addDoc(collection(db, "leaderboard"), { name, score: sc, correct: ok, total: Q.length, timestamp: new Date() });
  } catch (e) {}
}

function home() {
  clearInterval(tm);
  let lb = [];
  try {
    const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(10));
    onSnapshot(q, (snap) => {
      lb = []; snap.forEach(d => lb.push(d.data()));
      A.innerHTML = `
        <h1>👑 VUA TIẾNG VIỆT</h1><p class="sub">Ngữ văn 7 · Kết nối tri thức · Tập 1</p>
        <div class="c">
          <label>Tên của bạn</label><input id="nm" placeholder="Nhập tên..." value="${esc(name)}">
          <p style="margin:14px 0 6px">Bộ đề gồm ${QUIZ_DATA.length} câu.</p>
          <button class="b" id="btnFull">▶ Chơi trọn bộ</button>
          <button class="b g" id="btnTen">⚡ Thử thách 10 câu</button>
        </div>
        <div class="c"><b>🏆 Bảng vàng (Trực tuyến)</b>${lb.length?'<table>'+lb.map((r,k)=>`<tr><td>${k+1}</td><td>${esc(r.name)}</td><td>${r.score} điểm</td><td>${r.correct}/${r.total}</td></tr>`).join('')+'</table>':'<p style="color:var(--mut)">Chưa có ai.</p>'}</div>`;
      $('btnFull').onclick = () => go(QUIZ_DATA.length);
      $('btnTen').onclick = () => go(10);
    });
  } catch (e) {}
}

async function go(n) {
  name = $('nm').value.trim() || 'Học sinh';
  A.innerHTML = `<div class="c ctr"><h2 style="color:var(--pri)">⏳ Đang kiểm tra màn hình...</h2><p>Vui lòng chọn <b>"Chia sẻ toàn bộ màn hình"</b> và bấm Cho phép để tiếp tục.</p></div>`;
  
  const screenOK = await initScreenShare();
  if (!screenOK) {
    A.innerHTML = `<div class="c ctr" style="border-color:var(--bad); background:#ffebee;">
        <h2 style="color:var(--bad)">🚫 TỪ CHỐI CHIA SẺ MÀN HÌNH</h2>
        <p>Hệ thống yêu cầu chia sẻ màn hình để đảm bảo tính công bằng. Bạn không thể làm bài.</p>
        <button class="b" onclick="location.reload()">🔄 Thử lại</button>
      </div>`;
    return;
  }

  window.sessionId = "s_" + Date.now();
  isCheating = false;
  isKicked = false;
  Q = [...QUIZ_DATA].sort(() => Math.random() - 0.5).slice(0, Math.min(n, QUIZ_DATA.length));
  i = 0; sc = 0; st = 0; ok = 0; wrong = [];
  
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
    
  $('btnNext').onclick = () => { i++; show(); };
}

async function end() {
  const p = ok/Q.length*100;
  const rk = p>=90?['👑','VUA TIẾNG VIỆT']:p>=75?['🛡️','Hiệp sĩ Ngôn từ']:p>=50?['📚','Học giả Chăm chỉ']:['🌱','Tập sự Tiếng Việt'];
  
  if (window.sessionId) {
    try { await setDoc(doc(db,"active_sessions",window.sessionId), { status: "finished", score: sc, lastUpdate: new Date() }, { merge: true }); } catch(e){}
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

home();
