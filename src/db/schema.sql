SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS hrm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hrm;

CREATE TABLE IF NOT EXISTS tai_khoan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  ho_ten VARCHAR(100) NOT NULL,
  vai_tro ENUM('Admin', 'HR') NOT NULL DEFAULT 'HR'
);

CREATE TABLE IF NOT EXISTS phong_ban (
  ma_phong_ban VARCHAR(20) PRIMARY KEY,
  ten_phong_ban VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS chuc_vu (
  ma_chuc_vu VARCHAR(20) PRIMARY KEY,
  ten_chuc_vu VARCHAR(100) NOT NULL UNIQUE,
  he_so_luong DECIMAL(5, 2) NOT NULL CHECK (he_so_luong > 0)
);

CREATE TABLE IF NOT EXISTS nhan_vien (
  ma_nhan_vien VARCHAR(20) PRIMARY KEY,
  ten_nhan_vien VARCHAR(100) NOT NULL,
  ngay_sinh DATE NOT NULL,
  dia_chi VARCHAR(255) NOT NULL,
  so_dien_thoai VARCHAR(11) NOT NULL CHECK (so_dien_thoai REGEXP '^[0-9]{10,11}$'),
  ma_phong_ban VARCHAR(20) NOT NULL,
  ma_chuc_vu VARCHAR(20) NOT NULL,
  nam_vao_lam SMALLINT NOT NULL,
  trang_thai ENUM('Đang làm việc', 'Nghỉ việc') NOT NULL DEFAULT 'Đang làm việc',
  CONSTRAINT fk_nv_phong_ban FOREIGN KEY (ma_phong_ban) REFERENCES phong_ban(ma_phong_ban)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_nv_chuc_vu FOREIGN KEY (ma_chuc_vu) REFERENCES chuc_vu(ma_chuc_vu)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS cham_cong (
  ma_cham_cong VARCHAR(20) PRIMARY KEY,
  ma_nhan_vien VARCHAR(20) NOT NULL,
  so_ngay_lam_viec TINYINT UNSIGNED NOT NULL CHECK (so_ngay_lam_viec <= 31),
  so_ngay_nghi TINYINT UNSIGNED NOT NULL DEFAULT 0 CHECK (so_ngay_nghi <= 31),
  CONSTRAINT fk_cc_nhan_vien FOREIGN KEY (ma_nhan_vien) REFERENCES nhan_vien(ma_nhan_vien)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS luong (
  ma_luong VARCHAR(20) PRIMARY KEY,
  ma_cham_cong VARCHAR(20) NOT NULL UNIQUE,
  thang_tinh_luong TINYINT UNSIGNED NOT NULL CHECK (thang_tinh_luong BETWEEN 1 AND 12),
  nam_tinh_luong SMALLINT NOT NULL,
  luong_can_ban DECIMAL(12, 2) NOT NULL CHECK (luong_can_ban >= 0),
  phu_cap DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (phu_cap >= 0),
  tong_luong DECIMAL(14, 2) NOT NULL CHECK (tong_luong >= 0),
  CONSTRAINT fk_luong_cham_cong FOREIGN KEY (ma_cham_cong) REFERENCES cham_cong(ma_cham_cong)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS hop_dong (
  ma_hop_dong VARCHAR(20) PRIMARY KEY,
  ma_nhan_vien VARCHAR(20) NOT NULL,
  loai_hop_dong VARCHAR(50) NOT NULL,
  ngay_ky DATE NOT NULL,
  ngay_ket_thuc DATE NULL,
  CONSTRAINT chk_hd_ngay CHECK (ngay_ket_thuc IS NULL OR ngay_ket_thuc >= ngay_ky),
  CONSTRAINT fk_hd_nhan_vien FOREIGN KEY (ma_nhan_vien) REFERENCES nhan_vien(ma_nhan_vien)
    ON UPDATE CASCADE ON DELETE CASCADE
);

-- 1. Function: Số năm làm việc của một nhân viên
DROP FUNCTION IF EXISTS fn_so_nam_lam_viec;
DELIMITER $$
CREATE FUNCTION fn_so_nam_lam_viec(p_ma_nv VARCHAR(20))
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE v_nam INT;
  SELECT nam_vao_lam INTO v_nam
  FROM nhan_vien
  WHERE ma_nhan_vien = p_ma_nv;

  IF v_nam IS NULL THEN
    RETURN 0;
  END IF;

  RETURN GREATEST(YEAR(CURDATE()) - v_nam, 0);
END$$
DELIMITER ;

-- 2. Trigger: Tự động cập nhật trạng thái thành 'Nghỉ việc' khi thêm ngày kết thúc hợp đồng
DROP TRIGGER IF EXISTS trg_hop_dong_nghi_viec_insert;
DROP TRIGGER IF EXISTS trg_hop_dong_nghi_viec_update;
DELIMITER $$
CREATE TRIGGER trg_hop_dong_nghi_viec_insert
AFTER INSERT ON hop_dong
FOR EACH ROW
BEGIN
  IF NEW.ngay_ket_thuc IS NOT NULL THEN
    UPDATE nhan_vien
    SET trang_thai = 'Nghỉ việc'
    WHERE ma_nhan_vien = NEW.ma_nhan_vien;
  END IF;
END$$

CREATE TRIGGER trg_hop_dong_nghi_viec_update
AFTER UPDATE ON hop_dong
FOR EACH ROW
BEGIN
  IF NEW.ngay_ket_thuc IS NOT NULL AND (OLD.ngay_ket_thuc IS NULL OR NEW.ngay_ket_thuc <> OLD.ngay_ket_thuc) THEN
    UPDATE nhan_vien
    SET trang_thai = 'Nghỉ việc'
    WHERE ma_nhan_vien = NEW.ma_nhan_vien;
  END IF;
END$$
DELIMITER ;

-- 3. Stored Procedure: Danh sách nhân viên theo tên phòng ban
DROP PROCEDURE IF EXISTS sp_nv_theo_phong_ban;
DELIMITER $$
CREATE PROCEDURE sp_nv_theo_phong_ban(IN p_ten_phong_ban VARCHAR(100))
BEGIN
  SELECT
    nv.ma_nhan_vien,
    nv.ten_nhan_vien,
    nv.ngay_sinh,
    nv.dia_chi,
    nv.so_dien_thoai,
    pb.ma_phong_ban,
    pb.ten_phong_ban,
    cv.ma_chuc_vu,
    cv.ten_chuc_vu,
    cv.he_so_luong,
    nv.nam_vao_lam,
    fn_so_nam_lam_viec(nv.ma_nhan_vien) AS so_nam_lam_viec,
    nv.trang_thai
  FROM nhan_vien nv
  JOIN phong_ban pb ON nv.ma_phong_ban = pb.ma_phong_ban
  JOIN chuc_vu cv ON nv.ma_chuc_vu = cv.ma_chuc_vu
  WHERE pb.ten_phong_ban = p_ten_phong_ban
  ORDER BY nv.ma_nhan_vien;
END$$
DELIMITER ;

-- 4. Stored Procedure: Thống kê tiền lương theo năm, theo phòng ban
DROP PROCEDURE IF EXISTS sp_thong_ke_luong;
DELIMITER $$
CREATE PROCEDURE sp_thong_ke_luong(IN p_nam INT, IN p_ma_phong_ban VARCHAR(20))
BEGIN
  SELECT
    pb.ma_phong_ban,
    pb.ten_phong_ban,
    COUNT(DISTINCT nv.ma_nhan_vien) AS so_nhan_vien,
    COUNT(l.ma_luong) AS so_ky_luong,
    COALESCE(SUM(l.tong_luong), 0) AS tong_quy_luong,
    COALESCE(ROUND(AVG(l.tong_luong), 0), 0) AS luong_trung_binh,
    COALESCE(MAX(l.tong_luong), 0) AS luong_cao_nhat,
    COALESCE(MIN(l.tong_luong), 0) AS luong_thap_nhat
  FROM phong_ban pb
  LEFT JOIN nhan_vien nv ON pb.ma_phong_ban = nv.ma_phong_ban
  LEFT JOIN cham_cong cc ON nv.ma_nhan_vien = cc.ma_nhan_vien
  LEFT JOIN luong l ON cc.ma_cham_cong = l.ma_cham_cong
    AND (p_nam IS NULL OR l.nam_tinh_luong = p_nam)
  WHERE (p_ma_phong_ban IS NULL OR p_ma_phong_ban = '' OR pb.ma_phong_ban = p_ma_phong_ban)
  GROUP BY pb.ma_phong_ban, pb.ten_phong_ban
  ORDER BY tong_quy_luong DESC, pb.ma_phong_ban;
END$$
DELIMITER ;

-- 5. Function: Tính tổng lương thực nhận từ mã chấm công, lương căn bản và phụ cấp
DROP FUNCTION IF EXISTS fn_tinh_tong_luong;
DELIMITER $$
CREATE FUNCTION fn_tinh_tong_luong(
  p_ma_cham_cong VARCHAR(20),
  p_luong_can_ban DECIMAL(12, 2),
  p_phu_cap DECIMAL(12, 2)
)
RETURNS DECIMAL(14, 2)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE v_so_ngay TINYINT UNSIGNED DEFAULT NULL;
  DECLARE v_he_so DECIMAL(5, 2) DEFAULT NULL;
  DECLARE CONTINUE HANDLER FOR NOT FOUND
  BEGIN
    SET v_so_ngay = NULL;
    SET v_he_so = NULL;
  END;

  SELECT cc.so_ngay_lam_viec, cv.he_so_luong
    INTO v_so_ngay, v_he_so
  FROM cham_cong cc
  JOIN nhan_vien nv ON cc.ma_nhan_vien = nv.ma_nhan_vien
  JOIN chuc_vu cv ON nv.ma_chuc_vu = cv.ma_chuc_vu
  WHERE cc.ma_cham_cong = p_ma_cham_cong
  LIMIT 1;

  IF v_so_ngay IS NULL OR v_he_so IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN ROUND((p_luong_can_ban * v_he_so * v_so_ngay) / 26 + COALESCE(p_phu_cap, 0), 0);
END$$
DELIMITER ;
