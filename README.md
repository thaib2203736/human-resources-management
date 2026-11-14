# Hệ thống quản lý nhân sự

## 1. Cài đặt môi trường

- Node.js (v20.12+): [https://nodejs.org/en/download](https://nodejs.org/en/download)
- Git: [https://git-scm.com/install/](https://git-scm.com/install/)
- MySQL: [https://dev.mysql.com/downloads/](https://dev.mysql.com/downloads/) hoặc thông qua [Docker](https://docs.docker.com/desktop/setup/install/windows-install/)

Kiểm tra:

```sh
node -v
npm -v
git -v
```

## 2. Cấu hình & Khởi tạo CSDL

1. Tạo file `.env` ở thư mục gốc từ mẫu `.env.example` và chỉnh thông số MySQL cho đúng máy bạn.
2. Nếu dùng Docker, chạy container MySQL ở cổng `3306`:

```sh
docker run -d --name hrm-mysql -p 3306:3306 -v hrm-mysql-data:/var/lib/mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=hrm -e MYSQL_USER=admin -e MYSQL_PASSWORD=password mysql:8 --log-bin-trust-function-creators=1
```

3. Nạp schema và dữ liệu mẫu vào MySQL (dùng Git Bash hoặc `cmd` trên Windows để giữ nguyên UTF-8):

```sh
# Nếu cài MySQL trực tiếp trên máy
mysql --default-character-set=utf8mb4 -u root -p < src/db/schema.sql
mysql --default-character-set=utf8mb4 -u root -p < src/db/seed.sql

# Hoặc nếu dùng container Docker ở trên
docker exec -i hrm-mysql mysql --default-character-set=utf8mb4 -uroot -proot < src/db/schema.sql
docker exec -i hrm-mysql mysql --default-character-set=utf8mb4 -uroot -proot < src/db/seed.sql
```

Tài khoản đăng nhập mặc định sau khi seed:
- Admin: `admin` / `admin123`
- HR: `hr` / `hr123`

## 3. Clone & Chạy dự án

```sh
git clone https://github.com/thaib2203736/human-resources-management.git
cd human-resources-management
```

Khởi chạy backend dev server (cổng `3000`):

```sh
npm install
npm run dev
```

Khởi chạy frontend dev server (cổng `5173`, tự proxy `/api` sang `:3000`):

```sh
cd web
npm install
npm run dev
```

Preview: http://localhost:5173

Kiểm tra unit test nền móng:

```sh
npm test
```

## 4. Quy ước ghép module (cho 3 thành viên)

- **Backend**:
  - Tạo router trong `src/routes/` và gắn vào `src/index.js`, bảo vệ API bằng middleware `requireAuth` từ `src/auth.js`.
  - Dùng `query(sql, params)` hoặc `withTransaction(async (q) => ...)` từ `src/db/index.js`. Lưu ý với `mysql2`, khi gọi `CALL sp_...`, kết quả bảng nằm ở `rows[0]`.
- **Frontend (`web/src/`)**:
  - Dùng `@/` cho mọi đường dẫn import (ví dụ `@/components/ui/button`, `@/lib/api`).
  - Gọi API qua `apiFetch(path, options)` trong `web/src/lib/api.js` (tự đính kèm token).
  - Xuất CSV qua `exportCsv(filename, headers, rows)` trong `web/src/lib/export.js`; in PDF dùng `window.print()` (đánh dấu class `no-print` cho phần cần ẩn khi in).
  - Thay phần placeholder trong `NAV_ITEMS` của `web/src/App.jsx` bằng component của từng thành viên.
