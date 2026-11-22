# Vua Tiếng Việt

Website luyện tập trắc nghiệm Ngữ văn 7, gồm trang học sinh và trang quản lý dành cho giáo viên.

## Công nghệ

- HTML, CSS và JavaScript ES modules.
- Firebase Authentication: học sinh đăng nhập ẩn danh; giáo viên đăng nhập bằng Firebase Custom Token.
- Cloud Firestore: lưu phiên làm bài, tiến độ, bảng xếp hạng và bài tập về nhà.
- Vercel Functions: API xác thực giáo viên.
- Cloudinary: lưu ảnh giám sát tab theo cấu hình hiện tại.

## Cấu trúc thư mục

```text
.
├── index.html
├── teacher.html
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   └── teacher.css
│   └── js/
│       ├── data.js
│       └── game.js
├── api/
│   └── teacher-login.js
├── docs/
│   └── SECURITY_SETUP.md
├── firestore.rules
├── firebase.json
├── .firebaserc
├── package.json
└── vercel.json
```

Hai trang HTML, thư mục `api/` và các file cấu hình deploy được giữ ở thư mục gốc để giữ nguyên URL và cách Vercel hoạt động.

## Cách website hoạt động

### Học sinh

1. Mở trang chủ `/`.
2. Trình duyệt đăng nhập Firebase bằng Anonymous Authentication để có UID riêng.
3. Học sinh nhập tên, chọn lớp và bắt đầu làm bài.
4. Ngân hàng câu hỏi nằm trong `assets/js/data.js`; logic trò chơi nằm trong `assets/js/game.js`.
5. Tiến độ được ghi vào collection `active_sessions`.
6. Khi hoàn thành, kết quả được ghi vào collection `leaderboard`.

### Giáo viên

1. Mở `/teacher.html` và nhập tài khoản.
2. Trang gửi thông tin đến API `/api/teacher-login qua HTTPS.
3. API kiểm tra username và mật khẩu dựa trên salt/hash trong Vercel Environment Variables.
4. Nếu hợp lệ, API tạo Firebase Custom Token có claim `teacher: true`.
5. Trang giáo viên đăng nhập Firebase bằng token rồi đọc dữ liệu Firestore theo quyền giáo viên.
6. Dashboard theo dõi tiến độ và bảng xếp hạng theo thời gian thực; giáo viên có thể cảnh báo, kết thúc phiên hoặc xóa kết quả.

### Dữ liệu Firestore

- `active_sessions`: trạng thái, tiến độ và điểm tạm thời của từng phiên.
- `leaderboard`: kết quả đã nộp.
- `settings/homework`: thông tin bài tập về nhà.
- `firestore.rules`: quy tắc phân quyền; tài khoản giáo viên cần custom claim `teacher: true`.

### Chia sẻ màn hình

Tính năng giáo viên phát trực tiếp màn hình cho học sinh đã được gỡ bỏ khỏi cả hai trang. Website không còn sử dụng PeerJS/WebRTC cho chức năng này.

**Lưu ý riêng tư:** tính năng giám sát học sinh khi chuyển tab vẫn còn. Theo cấu hình hiện tại, trang có thể chụp ảnh màn hình khi tab bị ẩn và tải ảnh lên Cloudinary. Cần thông báo minh bạch, xin phép phù hợp và giới hạn quyền truy cập/thời gian lưu ảnh.

## Cấu hình và triển khai

Yêu cầu Node.js 20+, Firebase project bật Anonymous Authentication, Firestore Rules đã triển khai và Vercel đã cấu hình các biến môi trường:

- `TEACHER_USERNAME`
- `TEACHER_PASSWORD_SALT`
- `TEACHER_PASSWORD_HASH`
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `TEACHER_FIREBASE_UID` (tùy chọn)

Không commit mật khẩu, private key hoặc service-account JSON vào GitHub. Chỉ lưu bí mật trong Vercel Environment Variables. Xem [docs/SECURITY_SETUP.md](docs/SECURITY_SETUP.md).

1. Đẩy code lên nhánh được Vercel kết nối.
2. Vercel tự deploy website và API.
3. Khi thay đổi Firestore Rules, kiểm tra rồi triển khai riêng:
   ```bash
   firebase deploy --only firestore:rules --project vuatiengviet-7a1cb
   ```
4. Trang học sinh: `/`; trang giáo viên: `/teacher.html`.

## Giới hạn bảo mật

Điểm và logic trả lời vẫn được xử lý một phần trong trình duyệt. Firestore Rules hiện không đủ để ngăn học sinh tự tạo kết quả với điểm tự khai báo. Muốn chống sửa điểm nghiêm túc, cần chuyển xác minh đáp án và ghi điểm cuối cùng sang backend.
