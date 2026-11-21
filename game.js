import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, addDoc, onSnapshot, query, orderBy, limit }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️ THAY BẰNG CONFIG CỦA BẠN
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

// --- BẮT ĐẦU CODE CHỐNG GIAN LẬN ---
let isCheating = false;
document.addEventListener("visibilitychange", () => {
  // Chỉ chạy khi đang làm bài
  if (!window.sessionId) return;
  
  if (document.visibilityState === "hidden") {
    isCheating = true; // Rời tab -> Gian lận
  } else {
    isCheating = false; // Quay lại tab
  }
  updateProgress(); // Cập nhật ngay lên Firebase
});
// --- KẾT THÚC CODE CHỐNG GIAN LẬN ---

async function updateProgress() {
  if (!window.sessionId) return;
  try {
    await setDoc(doc(db, "active_sessions", window.sessionId), {
      studentName: name, currentQuestionIndex: i + 1, totalQuestions: Q.length,
      score: sc, lastUpdate: new Date(), status: "playing"
      cheating: isCheating 
    }, { merge: true });
  } catch (e) { console.error(e); }
}

async function saveScore() {
  try {
    await addDoc(collection(db, "leaderboard"), {
      name, score: sc, correct: ok, total: Q.length, timestamp: new Date()
    });
  } catch (e) { console.error(e); }
}

// ----- TRANG CHỦ -----
function home() {
  clearInterval(tm);
  let lb = [];
  try {
    const q = query(collection(db, "leaderboard"), orderBy("score", "desc"), limit(10));
    onSnapshot(q, (snap) => {
      lb = [];
      snap.forEach(d => lb.push(d.data()));
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
  } catch (e) { console.error(e); }
}

// ----- BẮT ĐẦU GAME -----
function go(n) {
  name = $('nm').value.trim() || 'Học sinh';
  window.sessionId = "s_" + Date.now();
  Q = [...QUIZ_DATA].sort(() => Math.random() - 0.5).slice(0, Math.min(n, QUIZ_DATA.length));
  i = 0; sc = 0; st = 0; ok = 0; wrong = [];
  show();
}

// ----- HIỂN THỊ CÂU HỎI -----
function show() {
  clearInterval(tm);
  if (i >= Q.length) return end();
  const q = Q[i];
  tl = 25; done = false;
  let body = '';

  if (q.t === 'mc') {
    body = q.o.map((o,k) => `<button class="o" data-idx="${k+1}">${'ABCD'[k]||k+1}. ${esc(o)}</button>`).join('');
  }
  if (q.t === 'tf') {
    body = `<button class="o" data-val="đúng">✅ Đúng</button><button class="o" data-val="sai">❌ Sai</button>`;
  }
  if (q.t === 'fill') {
    body = `<input id="fi" placeholder="Gõ đáp án..." autocomplete="off"><button class="b" style="margin-top:10px" id="btnSubmit">Trả lời</button>`;
  }
  if (q.t === 'find') {
    body = `<p style="color:var(--mut);margin:0 0 8px">Chạm vào từ viết sai chính tả:</p><div class="words">${q.q.split(/\s+/).map(w => `<button class="o" data-word="${esc(w)}">${esc(w)}</button>`).join('')}</div>`;
  }

  A.innerHTML = `
    <div class="top"><span>Câu ${i+1}/${Q.length}</span><span>⭐ ${sc} · 🔥 ${st}</span><span id="tt">⏱ ${tl}s</span></div>
    <div class="bar"><i id="br" style="width:100%"></i></div>
    <div class="c">
      <span class="chip">${esc(q.c)}${q.t==='fill'?' · Điền chữ':q.t==='find'?' · Tìm lỗi sai':q.t==='tf'?' · Đúng/Sai':''}</span>
      ${q.t==='find'?'':`<div class="q">${esc(q.q)}</div>`}
      ${body}
      <div id="fb"></div>
    </div>`;

  // Gắn sự kiện bằng JS (tránh lỗi onclick trong module)
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

// ----- XỬ LÝ ĐÁP ÁN -----
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

// ----- KẾT THÚC -----
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

// Khởi chạy
home();
