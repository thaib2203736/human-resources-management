try {
  process.loadEnvFile();
} catch {
  // Không bắt buộc có .env nếu biến môi trường đã được truyền từ shell/container
}
