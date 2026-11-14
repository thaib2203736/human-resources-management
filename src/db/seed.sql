USE hrm;

-- Tài khoản mặc định: admin / admin123, hr / hr123
INSERT IGNORE INTO tai_khoan (username, password_hash, ho_ten, vai_tro) VALUES
  ('admin', '7eeb8dd4aab65f344e373075241a4291:31cd8fb621743e5df756131406d0c311e5be7edf587149864f79f1d19c48b10f635748f45ed8784555d365472ce8b94c003d44919906119f0735626224cdac10', 'Quản trị viên', 'Admin'),
  ('hr', '13e07b1fd7da3bc32010e801453c26b8:e3275552391673d96c11ff273ceb456fb1993a210ef117b2a794d87b820608bec3a93058d2c77f8b3d0f8c75edf14daabe2548c618f09e28dcfda0e1961d966b', 'Nhân sự', 'HR');

INSERT IGNORE INTO phong_ban (ma_phong_ban, ten_phong_ban) VALUES
  ('PB01', 'Kỹ thuật'),
  ('PB02', 'Nhân sự'),
  ('PB03', 'Kinh doanh'),
  ('PB04', 'Kế toán');

INSERT IGNORE INTO chuc_vu (ma_chuc_vu, ten_chuc_vu, he_so_luong) VALUES
  ('CV01', 'Trưởng phòng', 2.50),
  ('CV02', 'Chuyên viên', 1.60),
  ('CV03', 'Nhân viên', 1.20),
  ('CV04', 'Thực tập sinh', 0.80);

INSERT IGNORE INTO nhan_vien (ma_nhan_vien, ten_nhan_vien, ngay_sinh, dia_chi, so_dien_thoai, ma_phong_ban, ma_chuc_vu, nam_vao_lam, trang_thai) VALUES
  ('NV01', 'Nguyễn Văn An', '1994-05-12', 'Cần Thơ', '0901234561', 'PB01', 'CV01', 2020, 'Đang làm việc'),
  ('NV02', 'Trần Thị Bình', '1997-08-20', 'Vĩnh Long', '0901234562', 'PB01', 'CV02', 2022, 'Đang làm việc'),
  ('NV03', 'Lê Hoàng Cường', '1996-02-14', 'An Giang', '0901234563', 'PB02', 'CV01', 2021, 'Đang làm việc'),
  ('NV04', 'Phạm Minh Dung', '1999-11-03', 'Cần Thơ', '0901234564', 'PB03', 'CV03', 2023, 'Đang làm việc'),
  ('NV05', 'Võ Quốc Bảo', '1995-07-18', 'Hậu Giang', '0901234565', 'PB04', 'CV02', 2019, 'Đang làm việc'),
  ('NV06', 'Đặng Thu Hà', '2000-01-25', 'Sóc Trăng', '0901234566', 'PB03', 'CV03', 2024, 'Đang làm việc');

INSERT IGNORE INTO cham_cong (ma_cham_cong, ma_nhan_vien, so_ngay_lam_viec, so_ngay_nghi) VALUES
  ('CC01', 'NV01', 26, 0),
  ('CC02', 'NV02', 24, 2),
  ('CC03', 'NV03', 25, 1),
  ('CC04', 'NV04', 26, 0),
  ('CC05', 'NV05', 22, 4),
  ('CC06', 'NV06', 20, 6);

INSERT IGNORE INTO luong (ma_luong, ma_cham_cong, thang_tinh_luong, nam_tinh_luong, luong_can_ban, phu_cap, tong_luong) VALUES
  ('L01', 'CC01', 10, 2026, 10000000, 2000000, 27000000),
  ('L02', 'CC02', 10, 2026, 8000000, 1000000, 12815385),
  ('L03', 'CC03', 10, 2026, 9500000, 1500000, 24336538),
  ('L04', 'CC04', 10, 2026, 7000000, 800000, 9200000),
  ('L05', 'CC05', 10, 2026, 8000000, 1000000, 11830769),
  ('L06', 'CC06', 10, 2026, 7000000, 500000, 6961538);

-- HD06 có ngay_ket_thuc -> Trigger tự động chuyển NV06 thành 'Nghỉ việc'
INSERT IGNORE INTO hop_dong (ma_hop_dong, ma_nhan_vien, loai_hop_dong, ngay_ky, ngay_ket_thuc) VALUES
  ('HD01', 'NV01', 'Không thời hạn', '2020-03-01', NULL),
  ('HD02', 'NV02', 'Có thời hạn', '2022-06-15', NULL),
  ('HD03', 'NV03', 'Không thời hạn', '2021-01-10', NULL),
  ('HD04', 'NV04', 'Có thời hạn', '2023-09-01', NULL),
  ('HD05', 'NV05', 'Không thời hạn', '2019-04-01', NULL),
  ('HD06', 'NV06', 'Thử việc', '2024-02-01', '2026-10-31');
