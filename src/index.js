import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

// Route ví dụ lấy danh sách người dùng
app.get('/api/v1/users', (req, res) => {
  res.send('Hello World!');
});

// Middleware xử lý lỗi 404
app.use((req, res, next) => {
  res.status(404).send("Không tìm thấy trang");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});