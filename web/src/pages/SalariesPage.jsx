import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Calculator, Info, Pencil, Search, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { apiFetch } from '@/lib/api';
import { exportCsv } from '@/lib/export';
import { calculateSalaryTotal, formatCurrency, suggestNextCode } from '@/lib/format';

const MONTHS = Array.from({ length: 12 }, (_, idx) => idx + 1);

export function SalariesPage({ user }) {
  const isAdmin = user?.vai_tro === 'Admin';
  const now = new Date();

  const [salaries, setSalaries] = useState([]);
  const [allSalaries, setAllSalaries] = useState([]);
  const [attendanceList, setAttendanceList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [thang, setThang] = useState('');
  const [nam, setNam] = useState('');
  const [maPhongBan, setMaPhongBan] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    ma_luong: '',
    ma_cham_cong: '',
    thang_tinh_luong: now.getMonth() + 1,
    nam_tinh_luong: now.getFullYear(),
    luong_can_ban: '8000000',
    phu_cap: '1000000',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchFiltered = useCallback(async (filters) => {
    const params = new URLSearchParams();
    if (filters.thang) params.set('thang', filters.thang);
    if (filters.nam) params.set('nam', filters.nam);
    if (filters.maPhongBan) params.set('ma_phong_ban', filters.maPhongBan);
    if (filters.search.trim()) params.set('q', filters.search.trim());
    const qs = params.toString();
    return apiFetch(`/api/v1/salaries${qs ? `?${qs}` : ''}`);
  }, []);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [salData, fullSal, attData, depData] = await Promise.all([
        fetchFiltered({ thang, nam, maPhongBan, search }),
        apiFetch('/api/v1/salaries'),
        apiFetch('/api/v1/attendance'),
        apiFetch('/api/v1/departments'),
      ]);
      setSalaries(salData);
      setAllSalaries(fullSal);
      setAttendanceList(attData);
      setDepartments(depData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchFiltered, thang, nam, maPhongBan, search]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [salData, fullSal, attData, depData] = await Promise.all([
          fetchFiltered({ thang, nam, maPhongBan, search }),
          apiFetch('/api/v1/salaries'),
          apiFetch('/api/v1/attendance'),
          apiFetch('/api/v1/departments'),
        ]);
        if (!active) return;
        setSalaries(salData);
        setAllSalaries(fullSal);
        setAttendanceList(attData);
        setDepartments(depData);
        setError('');
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchFiltered, thang, nam, maPhongBan, search]);

  const availableAttendance = attendanceList.filter(
    (cc) => !cc.ma_luong || (editing && cc.ma_cham_cong === editing.ma_cham_cong)
  );

  function openCreate() {
    const unpaid = attendanceList.filter((cc) => !cc.ma_luong);
    setEditing(null);
    setFormError('');
    setForm({
      ma_luong: suggestNextCode(
        'L',
        allSalaries.map((s) => s.ma_luong)
      ),
      ma_cham_cong: unpaid[0]?.ma_cham_cong || '',
      thang_tinh_luong: now.getMonth() + 1,
      nam_tinh_luong: now.getFullYear(),
      luong_can_ban: '8000000',
      phu_cap: '1000000',
    });
    setModalOpen(true);
  }

  function openEdit(sal) {
    setEditing(sal);
    setFormError('');
    setForm({
      ma_luong: sal.ma_luong,
      ma_cham_cong: sal.ma_cham_cong,
      thang_tinh_luong: sal.thang_tinh_luong,
      nam_tinh_luong: sal.nam_tinh_luong,
      luong_can_ban: String(sal.luong_can_ban),
      phu_cap: String(sal.phu_cap),
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ma_luong: form.ma_luong,
        ma_cham_cong: form.ma_cham_cong,
        thang_tinh_luong: Number(form.thang_tinh_luong),
        nam_tinh_luong: Number(form.nam_tinh_luong),
        luong_can_ban: Number(form.luong_can_ban),
        phu_cap: Number(form.phu_cap || 0),
      };
      if (editing) {
        await apiFetch(`/api/v1/salaries/${encodeURIComponent(editing.ma_luong)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/v1/salaries', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await reloadAll();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await apiFetch(`/api/v1/salaries/${encodeURIComponent(deleteTarget.ma_luong)}`, {
        method: 'DELETE',
      });
      setDeleteTarget(null);
      await reloadAll();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function handleExportCsv() {
    exportCsv(
      'bang-luong-nhan-su.csv',
      [
        'Mã lương',
        'Kỳ lương',
        'Mã NV',
        'Họ và tên',
        'Phòng ban',
        'Chức vụ',
        'Hệ số lương',
        'Mã chấm công',
        'Ngày làm việc',
        'Lương căn bản',
        'Phụ cấp',
        'Tổng thực lĩnh',
      ],
      salaries.map((s) => [
        s.ma_luong,
        `${s.thang_tinh_luong}/${s.nam_tinh_luong}`,
        s.ma_nhan_vien,
        s.ten_nhan_vien,
        s.ten_phong_ban,
        s.ten_chuc_vu,
        s.he_so_luong,
        s.ma_cham_cong,
        s.so_ngay_lam_viec,
        s.luong_can_ban,
        s.phu_cap,
        s.tong_luong,
      ])
    );
  }

  const totalPayroll = salaries.reduce((sum, s) => sum + s.tong_luong, 0);
  const avgSalary = salaries.length > 0 ? Math.round(totalPayroll / salaries.length) : 0;
  const maxSalary = salaries.length > 0 ? Math.max(...salaries.map((s) => s.tong_luong)) : 0;
  const yearOptions = Array.from(
    new Set([now.getFullYear(), ...allSalaries.map((s) => s.nam_tinh_luong)])
  ).sort((a, b) => b - a);

  const selectedAttendance = attendanceList.find((cc) => cc.ma_cham_cong === form.ma_cham_cong);
  const previewTotal = selectedAttendance
    ? calculateSalaryTotal({
        luongCanBan: form.luong_can_ban,
        heSoLuong: selectedAttendance.he_so_luong,
        soNgayLamViec: selectedAttendance.so_ngay_lam_viec,
        phuCap: form.phu_cap,
      })
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quản lý tiền lương"
        description="Tính lương tự động theo hệ số chức vụ, ngày công thực tế (chuẩn 26 ngày) và phụ cấp"
        countLabel={`${salaries.length} phiếu lương`}
        onRefresh={reloadAll}
        onExportCsv={handleExportCsv}
        onPrint={() => window.print()}
        onAdd={openCreate}
        addLabel="Lập bảng lương"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Số phiếu hiển thị</CardDescription>
            <div className="text-2xl font-semibold">{salaries.length}</div>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Tổng quỹ lương</CardDescription>
            <div className="text-xl font-semibold text-emerald-600">
              {formatCurrency(totalPayroll)}
            </div>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Lương bình quân</CardDescription>
            <div className="text-xl font-semibold">{formatCurrency(avgSalary)}</div>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Mức lương cao nhất</CardDescription>
            <div className="text-xl font-semibold text-primary">{formatCurrency(maxSalary)}</div>
          </CardHeader>
        </Card>
      </div>

      <Card size="sm" className="no-print">
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã lương, mã CC, mã NV, họ tên..."
              className="pl-8"
            />
          </div>

          <NativeSelect
            value={thang}
            onChange={(e) => setThang(e.target.value)}
            aria-label="Lọc theo tháng"
          >
            <NativeSelectOption value="">Tất cả tháng</NativeSelectOption>
            {MONTHS.map((m) => (
              <NativeSelectOption key={m} value={String(m)}>
                Tháng {m}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect
            value={nam}
            onChange={(e) => setNam(e.target.value)}
            aria-label="Lọc theo năm"
          >
            <NativeSelectOption value="">Tất cả năm</NativeSelectOption>
            {yearOptions.map((y) => (
              <NativeSelectOption key={y} value={String(y)}>
                Năm {y}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect
            value={maPhongBan}
            onChange={(e) => setMaPhongBan(e.target.value)}
            aria-label="Lọc theo phòng ban"
          >
            <NativeSelectOption value="">Tất cả phòng ban</NativeSelectOption>
            {departments.map((d) => (
              <NativeSelectOption key={d.ma_phong_ban} value={d.ma_phong_ban}>
                {d.ten_phong_ban}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          {(search || thang || nam || maPhongBan) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setThang('');
                setNam('');
                setMaPhongBan('');
              }}
            >
              Xóa bộ lọc
            </Button>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="py-0">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="px-4">Mã lương</TableHead>
              <TableHead className="px-4">Kỳ lương</TableHead>
              <TableHead className="px-4">Nhân viên</TableHead>
              <TableHead className="px-4">Phòng ban / Chức vụ</TableHead>
              <TableHead className="px-4">Chấm công</TableHead>
              <TableHead className="px-4 text-right">Lương căn bản</TableHead>
              <TableHead className="px-4 text-right">Phụ cấp</TableHead>
              <TableHead className="px-4 text-right">Tổng thực lĩnh</TableHead>
              <TableHead className="no-print px-4 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  Đang tải bảng lương...
                </TableCell>
              </TableRow>
            ) : salaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  Không có bảng lương nào khớp bộ lọc.
                </TableCell>
              </TableRow>
            ) : (
              salaries.map((s) => (
                <TableRow key={s.ma_luong}>
                  <TableCell className="px-4 font-mono text-xs font-semibold">
                    {s.ma_luong}
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge variant="outline">
                      T{s.thang_tinh_luong}/{s.nam_tinh_luong}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="font-medium">{s.ten_nhan_vien}</div>
                    <div className="text-xs text-muted-foreground">{s.ma_nhan_vien}</div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div>{s.ten_phong_ban}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.ten_chuc_vu} (x{s.he_so_luong})
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="font-mono text-xs">{s.ma_cham_cong}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.so_ngay_lam_viec}/26 ngày công
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-right tabular-nums">
                    {formatCurrency(s.luong_can_ban)}
                  </TableCell>
                  <TableCell className="px-4 text-right tabular-nums">
                    {formatCurrency(s.phu_cap)}
                  </TableCell>
                  <TableCell className="px-4 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(s.tong_luong)}
                  </TableCell>
                  <TableCell className="no-print px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Cập nhật bảng lương"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {isAdmin && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Xóa bảng lương"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteError('');
                            setDeleteTarget(s);
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {salaries.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={7} className="px-4 text-right font-semibold">
                  Tổng quỹ lương danh sách đang hiển thị:
                </TableCell>
                <TableCell className="px-4 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(totalPayroll)}
                </TableCell>
                <TableCell className="no-print" />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </Card>

      <Dialog
        open={modalOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !saving) setModalOpen(false);
        }}
      >
        <DialogContent className="no-print sm:max-w-lg! max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Cập nhật phiếu lương ${editing.ma_luong}` : 'Lập phiếu lương mới'}
            </DialogTitle>
            <DialogDescription>
              Chọn bản ghi chấm công chưa lập lương, nhập lương căn bản và phụ cấp
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            {availableAttendance.length === 0 && !editing && (
              <Alert>
                <Info className="size-4" />
                <AlertDescription>
                  Tất cả bản ghi chấm công hiện có đều đã được tính lương. Vui lòng tạo thêm bản ghi
                  mới ở mục <strong>Chấm công</strong> trước khi lập lương.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sal-code">Mã lương *</Label>
                <Input
                  id="sal-code"
                  type="text"
                  required
                  maxLength={20}
                  disabled={Boolean(editing)}
                  value={form.ma_luong}
                  onChange={(e) => setForm({ ...form, ma_luong: e.target.value })}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sal-att">Bản ghi chấm công *</Label>
                <NativeSelect
                  id="sal-att"
                  required
                  className="w-full"
                  value={form.ma_cham_cong}
                  onChange={(e) => setForm({ ...form, ma_cham_cong: e.target.value })}
                >
                  <NativeSelectOption value="" disabled>
                    -- Chọn bản ghi chấm công --
                  </NativeSelectOption>
                  {availableAttendance.map((cc) => (
                    <NativeSelectOption key={cc.ma_cham_cong} value={cc.ma_cham_cong}>
                      {cc.ma_cham_cong} — {cc.ten_nhan_vien} ({cc.so_ngay_lam_viec} ngày · x
                      {cc.he_so_luong})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sal-month">Tháng tính lương *</Label>
                <NativeSelect
                  id="sal-month"
                  className="w-full"
                  value={String(form.thang_tinh_luong)}
                  onChange={(e) => setForm({ ...form, thang_tinh_luong: Number(e.target.value) })}
                >
                  {MONTHS.map((m) => (
                    <NativeSelectOption key={m} value={String(m)}>
                      Tháng {m}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sal-year">Năm tính lương *</Label>
                <Input
                  id="sal-year"
                  type="number"
                  required
                  min={2000}
                  max={2100}
                  value={form.nam_tinh_luong}
                  onChange={(e) => setForm({ ...form, nam_tinh_luong: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sal-base">Lương căn bản (VNĐ) *</Label>
                <Input
                  id="sal-base"
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={form.luong_can_ban}
                  onChange={(e) => setForm({ ...form, luong_can_ban: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sal-allowance">Phụ cấp (VNĐ) *</Label>
                <Input
                  id="sal-allowance"
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={form.phu_cap}
                  onChange={(e) => setForm({ ...form, phu_cap: e.target.value })}
                />
              </div>
            </div>

            {selectedAttendance && (
              <Card size="sm" className="bg-muted/40">
                <CardContent className="space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Calculator className="size-3.5 text-primary" />
                    Xem trước phép tính lương tự động
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                    <span>Nhân viên:</span>
                    <span className="text-right font-medium text-foreground">
                      {selectedAttendance.ten_nhan_vien} ({selectedAttendance.ma_nhan_vien})
                    </span>
                    <span>Chức vụ &amp; Hệ số:</span>
                    <span className="text-right font-medium text-foreground">
                      {selectedAttendance.ten_chuc_vu} · x{selectedAttendance.he_so_luong}
                    </span>
                    <span>Ngày công thực tế:</span>
                    <span className="text-right font-medium text-foreground">
                      {selectedAttendance.so_ngay_lam_viec} / 26 ngày
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between pt-0.5 text-sm">
                    <span className="font-medium">Tổng thực lĩnh dự kiến:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(previewTotal)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={saving || !form.ma_cham_cong}>
                {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Chốt bảng lương'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa phiếu lương"
        message={
          deleteTarget
            ? `Bạn có chắc muốn xóa phiếu lương "${deleteTarget.ma_luong}" của nhân viên ${deleteTarget.ten_nhan_vien}? Sau khi xóa, bản ghi chấm công ${deleteTarget.ma_cham_cong} sẽ trở về trạng thái chưa tính lương.`
            : ''
        }
        loading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
