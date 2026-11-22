# Cấu hình đăng nhập giáo viên an toàn

Đăng nhập giáo viên đã được chuyển sang API serverless `/api/teacher-login`.
Không đặt mật khẩu, hash mật khẩu hoặc Firebase Admin service account trong mã nguồn công khai.

## Biến môi trường bắt buộc trên Vercel

- `TEACHER_USERNAME`: tên đăng nhập giáo viên.
- `TEACHER_PASSWORD_SALT`: chuỗi salt ngẫu nhiên riêng.
- `TEACHER_PASSWORD_HASH`: hash scrypt dạng hex 128 ký tự.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: toàn bộ JSON service account của đúng Firebase project.
- `TEACHER_FIREBASE_UID`: (tùy chọn) UID cố định cho tài khoản giáo viên; mặc định `vuatiengviet-teacher`.

Tạo salt và hash mật khẩu trên máy đáng tin cậy bằng Node.js:

```bash
node -e "const c=require('node:crypto'); const salt=c.randomBytes(32).toString('hex'); const password=process.argv[1]; console.log('TEACHER_PASSWORD_SALT='+salt); console.log('TEACHER_PASSWORD_HASH='+c.scryptSync(password,salt,64).toString('hex'))" "MAT_KHAU_MOI"
```

Không dùng lại mật khẩu đã từng xuất hiện trong mã nguồn công khai. Thêm các giá trị trên vào Vercel Project Settings -> Environment Variables, sau đó redeploy.

## Firebase

1. Tạo service account riêng cho backend từ Firebase Console / Google Cloud IAM; cấp quyền tối thiểu cần thiết để tạo Firebase custom token.
2. Đưa JSON service account vào biến môi trường Vercel `FIREBASE_SERVICE_ACCOUNT_JSON`; tuyệt đối không commit file JSON.
3. Đăng nhập bằng API sẽ tạo Firebase Custom Token có claim `teacher: true`.
4. Firestore Security Rules phải kiểm tra `request.auth.token.teacher == true` trước khi cho phép các thao tác quản trị.

## Giới hạn hiện tại

Việc chuyển đăng nhập sang server chưa tự động bảo vệ Firestore. Cần triển khai Security Rules phù hợp với luồng học sinh hiện tại trước khi bật chế độ từ chối truy cập mặc định. Điểm số hiện vẫn được tính và gửi từ trình duyệt; muốn chống sửa điểm thực sự phải xác minh câu trả lời ở backend và không phát hành đáp án cho client.
