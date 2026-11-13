# Hệ thống quản lý nhân sự

## 1. Cài đặt môi trường

- Node.js: [https://nodejs.org/en/download](https://nodejs.org/en/download)
- Git: [https://git-scm.com/install/](https://git-scm.com/install/)
- MySQL: [https://dev.mysql.com/downloads/](https://dev.mysql.com/downloads/) hoặc thông qua [Docker](https://docs.docker.com/desktop/setup/install/windows-install/)

Kiểm tra:

```sh
node -v
npm -v
git -v
```

## 2. Clone repo

```sh
git clone https://github.com/thaib2203736/human-resources-management.git
```

Khởi chạy backend dev server:

```sh
cd human-resources-management
npm install
npm run dev
```

Khởi chạy frontend dev server:
```sh
cd web
npm install
npm run dev
```

Preview: http://localhost:5173