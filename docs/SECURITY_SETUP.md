# Cấu hình bảo mật Vua Tiếng Việt

## 1. Firebase Authentication

Trong Firebase Console của project `vuatiengviet-7a1cb`:

1. Mở Authentication -> Sign-in method.
2. Bật **Anonymous** để học sinh có UID riêng cho phiên trình duyệt.
3. Giữ phương thức Custom Token để tài khoản giáo viên đăng nhập từ API server.
4. Kiểm tra Authorized domains chứa domain Vercel đang sử dụng.

## 2. Firestore Security Rules

Repository có file `firestore.rules` giới hạn:
- Học sinh chỉ đọc/cập nhật/xóa phiên có `ownerUid` trùng UID Firebase của chính mình.
- Giáo viên có custom claim `teacher: true` mới được đọc và quản trị mọi phiên.
- Bảng xếp hạng cho phép đọc công khai; học sinh chỉ tạo bản ghi gắn với UID của mình; chỉ giáo viên được sửa/xóa.
- Cấu hình homework và teacher screen chỉ cho giáo viên ghi.

Cài Firebase CLI, đăng nhập đúng tài khoản có quyền quản trị Firebase, sau đó chạy:

```bash
firebase deploy --only firestore:rules --project vuatiengviet-7a1cb
```

Không deploy rules trước khi bật Anonymous Authentication và kiểm tra tài khoản giáo viên đã được cấu hình. Nếu rules chưa được triển khai, Firestore vẫn dùng rules đang có trên Firebase Console.

## 3. Đăng nhập giáo viên qua Vercel

API `/api/teacher-login` cần các Environment Variables:

- `TEACHER_USERNAME`
- `TEACHER_PASSWORD_SALT`
- `TEACHER_PASSWORD_HASH` (scrypt, 64-byte output dạng hex 128 ký tự)
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `TEACHER_FIREBASE_UID` (tùy chọn)

Tạo salt và hash mới bằng Node.js trên máy đáng tin cậy:

```bash
node -e "const c=require('node:crypto'); const salt=c.randomBytes(32).toString('hex'); const password=process.argv[1]; console.log('TEACHER_PASSWORD_SALT='+salt); console.log('TEACHER_PASSWORD_HASH='+c.scryptSync(password,salt,64).toString('hex'))" "MAT_KHAU_MOI"
```

Không dùng lại mật khẩu/hash từng xuất hiện trong mã nguồn công khai. Không commit service-account JSON; chỉ lưu trong Vercel Environment Variables. Sau khi thêm biến, redeploy Vercel.

## 4. Giới hạn chống sửa điểm

Rules hiện tại ngăn học sinh sửa/xóa bản ghi leaderboard của người khác và ngăn người chưa xác thực ghi dữ liệu. Tuy nhiên, học sinh vẫn có thể tạo bản ghi của chính mình với điểm tự khai báo, vì đáp án và cách tính điểm vẫn chạy trong trình duyệt.

Do đó **chống sửa điểm chưa hoàn tất**. Để bảo vệ điểm thật sự, cần chuyển ngân hàng câu hỏi/đáp án và xác minh từng câu sang backend, rồi để backend tự ghi leaderboard bằng Firebase Admin SDK. Không được cấp quyền client tự ghi điểm cuối cùng nếu cần chống gian lận.

## 5. Quyền riêng tư và giám sát học sinh

Chức năng phát trực tiếp màn hình giáo viên đã được gỡ bỏ. Hệ thống vẫn có cơ chế ghi nhận khi học sinh chuyển tab và có thể chụp ảnh màn hình rồi tải lên Cloudinary theo cấu hình hiện tại. Cần thông báo rõ cho học sinh/phụ huynh, chỉ thu thập khi được cho phép, giới hạn quyền truy cập và thời gian lưu ảnh. Firestore Rules không thay thế quyền riêng tư của Cloudinary.
