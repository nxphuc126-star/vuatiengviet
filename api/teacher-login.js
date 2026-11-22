import { scryptSync, timingSafeEqual } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function constantTimeTextEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    const dummy = Buffer.alloc(left.length);
    timingSafeEqual(left, dummy);
    return false;
  }
  return timingSafeEqual(left, right);
}

function verifyPassword(password) {
  const salt = process.env.TEACHER_PASSWORD_SALT;
  const expectedHex = process.env.TEACHER_PASSWORD_HASH;
  if (!salt || !expectedHex || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  return timingSafeEqual(actual, expected);
}

function adminAuth() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
  const serviceAccount = JSON.parse(raw);
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) });
  return getAuth(app);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const now = Date.now();
  const record = attempts.get(ip);
  if (record && now - record.startedAt < WINDOW_MS && record.count >= MAX_ATTEMPTS) {
    return res.status(429).json({ error: "Quá nhiều lần thử. Vui lòng thử lại sau." });
  }
  if (!record || now - record.startedAt >= WINDOW_MS) attempts.set(ip, { startedAt: now, count: 1 });
  else record.count += 1;

  try {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string" ||
        username.length > 128 || password.length > 1024 || !username || !password) {
      return res.status(400).json({ error: "Thông tin đăng nhập không hợp lệ." });
    }

    const configuredUser = process.env.TEACHER_USERNAME;
    const validUser = configuredUser && constantTimeTextEqual(username, configuredUser);
    const validPassword = verifyPassword(password);
    if (!validUser || !validPassword) {
      return res.status(401).json({ error: "Tài khoản hoặc mật khẩu không đúng." });
    }

    const uid = process.env.TEACHER_FIREBASE_UID || "vuatiengviet-teacher";
    const token = await adminAuth().createCustomToken(uid, { teacher: true });
    attempts.delete(ip);
    return res.status(200).json({ token });
  } catch (error) {
    console.error("Teacher login failed:", error.message);
    return res.status(500).json({ error: "Máy chủ chưa được cấu hình đăng nhập giáo viên." });
  }
}
