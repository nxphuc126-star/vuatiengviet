import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
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

const $ = id => document.getElementById(id), A = $('app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => String(s).toLowerCase().trim().replace(/[.,!?;:"“”()]/g,'');

let Q = [], i = 0, sc = 0, st = 0, ok = 0, tl = 25, tm = null, name = '', wrong = [], done = false;
let studentClass = ""; 

// --- CẤU HÌNH CHỤP MÀN HÌNH & GIAN LẬN ---
let isCheating = false;
let displayStream = null;
let isKicked = false;

const CLOUDINARY_CLOUD_NAME = "w7xmgzco"; // ⚠️ ĐIỀN CLOUD NAME CỦA BẠN
const CLOUDINARY_UPLOAD_PRESET = "hocsinh_cheat";

async function initScreenShare() {
  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    
    // KIỂM TRA XEM HỌC SINH CHỌN "ENTIRE SCREEN" HAY KHÔNG
    const videoTrack = displayStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const displaySurface = settings.displaySurface; 
    // "monitor" = Entire Screen, "window" = Window, "browser" = Tab

    if (displaySurface !== "monitor") {
      displayStream.getTracks().forEach(track => track.stop());
      displayStream = null;
      return false; 
    }
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

async function home() {
  clearInterval(tm);
  let hwHtml = '';
  let shareBtnHtml = '';

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

  // 2. Kiểm tra Live Stream
  try {
    const screenSnap = await getDoc(doc(db, "settings", "teacher_screen"));
    if (screenSnap.exists() && screenSnap.data().isSharing === true) {
      window.currentTeacherPeerId = screenSnap.data().peerId;
      shareBtnHtml = `<button class="b" id="btnViewTeacher" style="background:#0284c7; color:#fff; margin-left:4px;">🖥️ Xem cô giảng bài (Live)</button>`;
    }
  } catch(e) {}

  // 3. Lắng nghe bảng xếp hạng
  const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(10));
  onSnapshot(q, (snap) => {
    let lb = []; snap.forEach(d => lb.push(d.data()));
    
    // Chỉ render lại giao diện nếu đang ở trang chủ (tránh việc bảng xếp hạng cập nhật làm hỏng giao diện đang chơi)
    if (document.querySelector('.q') || document.querySelector('.big')) return;

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
            ${shareBtnHtml}
        </div>

        <!-- Modal Live Stream -->
        <div id="teacherScreenModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:9999; flex-direction:column; justify-content:center; align-items:center;">
           <h2 style="color:white; margin-bottom:10px;">🖥️ Cô giáo đang giảng bài (Live)</h2>
           <video id="teacherVideo" autoplay playsinline style="max-width:90%; max-height:80%; border:3px solid #0284c7; border-radius:10px; background:#000;"></video>
           <button id="btnCloseScreen" style="margin-top:20px; background:#b91c1c; color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:1rem;">Đóng</button>
        </div>
      </div>
      <div class="c"><b>🏆 Bảng vàng (Trực tuyến)</b>${lb.length?'<table>'+lb.map((r,k)=>`<tr><td>${k+1}</td><td>${esc(r.name)}</td><td>${r.score} điểm</td><td>${r.correct}/${r.total}</td></tr>`).join('')+'</table>':'<p style="color:var(--mut)">Chưa có ai.</p>'}</div>`;
    
    $('btnFull').onclick = () => checkInputAndGo(QUIZ_DATA.length);
    $('btnTen').onclick = () => checkInputAndGo(10);

    // Xử lý nút Live Stream (Tách ra ngoài để luôn hoạt động)
    if ($('btnViewTeacher') && window.currentTeacherPeerId) {
      $('btnViewTeacher').onclick = () => {
        $('teacherScreenModal').style.display = 'flex';
        const videoElement = $('teacherVideo');
        
        // Kết nối PeerJS
        const callPeer = new Peer({ config: {'iceServers': [{ 'urls': 'stun:stun.l.google.com:19302' }]} });
        
        callPeer.on('open', () => {
          const call = callPeer.call(window.currentTeacherPeerId, new MediaStream());
          call.on('stream', (remoteStream) => {
            videoElement.srcObject = remoteStream; 
          });
        });

        $('btnCloseScreen').onclick = () => {
          $('teacherScreenModal').style.display = 'none';
          videoElement.srcObject = null;
          callPeer.destroy(); 
        };
      };
    }
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
  A.innerHTML = `<div class="c ctr"><h2 style="color:var(--pri)">⏳ Đang kiểm tra màn hình...</h2><p>Vui lòng chọn <b>"Toàn bộ màn hình" (Entire Screen)</b> và bấm Cho phép để tiếp tục.</p></div>`;
  
  const screenOK = await initScreenShare();
  
  if (!screenOK) {
    A.innerHTML = `
      <div class="c ctr" style="border-color:var(--bad); background:#ffebee;">
        <h2 style="color:var(--bad)">🚫 CHIA SẺ MÀN HÌNH KHÔNG HỢP LỆ</h2>
        <p>Hệ thống yêu cầu chia sẻ <b>Toàn bộ màn hình (Entire Screen)</b>.</p>
        <p>Bạn đã hủy hoặc chọn sai (Chọn Tab/Window). Vui lòng thử lại!</p>
        <button class="b" onclick="location.reload()">🔄 Thử lại (Bấm Entire Screen)</button>
      </div>`;
    return;
  }

  window.sessionId = "s_" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "_" + Math.random().toString(36).slice(2));
  isCheating = false;
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
