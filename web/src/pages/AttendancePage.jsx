import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Info, Pencil, Search, Trash2 } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { apiFetch } from '@/lib/api';
import { exportCsv } from '@/lib/export';
import { suggestNextCode } from '@/lib/format';

export function AttendancePage({ user }) {
  const isAdmin = user?.vai_tro === 'Admin';

  const [records, setRecords] = useState([]);
  const [allCodes, setAllCodes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [maPhongBan, setMaPhongBan] = useState('');
  const [chuaTinhLuong, setChuaTinhLuong] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    ma_cham_cong: '',
    ma_nhan_vien: '',
    so_ngay_lam_viec: 26,
    so_ngay_nghi: 0,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchFiltered = useCallback(async (filters) => {
    const params = new URLSearchParams();
    if (filters.maPhongBan) params.set('ma_phong_ban', filters.maPhongBan);
    if (filters.chuaTinhLuong) params.set('chua_tinh_luong', filters.chuaTinhLuong);
    if (filters.search.trim()) params.set('q', filters.search.trim());
    const qs = params.toString();
    return apiFetch(`/api/v1/attendance${qs ? `?${qs}` : ''}`);
  }, []);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [attData, fullAtt, empData, depData] = await Promise.all([
        fetchFiltered({ maPhongBan, chuaTinhLuong, search }),
        apiFetch('/api/v1/attendance'),
        apiFetch('/api/v1/employees'),
        apiFetch('/api/v1/departments'),
      ]);
      setRecords(attData);
      setAllCodes(fullAtt.map((a) => a.ma_cham_cong));
      setEmployees(empData);
      setDepartments(depData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchFiltered, maPhongBan, chuaTinhLuong, search]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [attData, fullAtt, empData, depData] = await Promise.all([
          fetchFiltered({ maPhongBan, chuaTinhLuong, search }),
          apiFetch('/api/v1/attendance'),
          apiFetch('/api/v1/employees'),
          apiFetch('/api/v1/departments'),
        ]);
        if (!active) return;
        setRecords(attData);
        setAllCodes(fullAtt.map((a) => a.ma_cham_cong));
        setEmployees(empData);
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
  }, [fetchFiltered, maPhongBan, chuaTinhLuong, search]);

  function openCreate() {
    setEditing(null);
    setFormError('');
    setForm({
      ma_cham_cong: suggestNextCode('CC', allCodes),
      ma_nhan_vien: employees[0]?.ma_nhan_vien || '',
      so_ngay_lam_viec: 26,
      so_ngay_nghi: 0,
    });
    setModalOpen(true);
  }

  function openEdit(cc) {
    setEditing(cc);
    setFormError('');
    setForm({
      ma_cham_cong: cc.ma_cham_cong,
      ma_nhan_vien: cc.ma_nhan_vien,
      so_ngay_lam_viec: cc.so_ngay_lam_viec,
      so_ngay_nghi: cc.so_ngay_nghi,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ma_cham_cong: form.ma_cham_cong,
        ma_nhan_vien: form.ma_nhan_vien,
        so_ngay_lam_viec: Number(form.so_ngay_lam_viec),
        so_ngay_nghi: Number(form.so_ngay_nghi),
      };
      if (editing) {
        await apiFetch(`/api/v1/attendance/${encodeURIComponent(editing.ma_cham_cong)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/v1/attendance', {
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
      await apiFetch(`/api/v1/attendance/${encodeURIComponent(deleteTarget.ma_cham_cong)}`, {
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
      'bang-cham-cong.csv',
      [
        'Mã chấm công',
        'Mã NV',
        'Họ và tên',
        'Phòng ban',
        'Chức vụ',
        'Số ngày làm việc',
        'Số ngày nghỉ',
        'Bảng lương liên kết',
      ],
      records.map((cc) => [
        cc.ma_cham_cong,
        cc.ma_nhan_vien,
        cc.ten_nhan_vien,
        cc.ten_phong_ban,
        cc.ten_chuc_vu,
        cc.so_ngay_lam_viec,
        cc.so_ngay_nghi,
        cc.ma_luong
          ? `${cc.ma_luong} (${cc.thang_tinh_luong}/${cc.nam_tinh_luong})`
          : 'Chưa tính lương',
      ])
    );
  }

  const unpaidCount = records.filter((r) => !r.ma_luong).length;
  const paidCount = records.length - unpaidCount;
  const avgWorkDays =
    records.length > 0
      ? (records.reduce((sum, r) => sum + r.so_ngay_lam_viec, 0) / records.length).toFixed(1)
      : '0.0';
  const totalDaysInput = Number(form.so_ngay_lam_viec || 0) + Number(form.so_ngay_nghi || 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quản lý chấm công"
        description="Ghi nhận số ngày công thực tế và theo dõi trạng thái tính lương (chuẩn 26 ngày/kỳ)"
        countLabel={`${records.length} bản ghi`}
        onRefresh={reloadAll}
        onExportCsv={handleExportCsv}
        onPrint={() => window.print()}
        onAdd={openCreate}
        addLabel="Thêm chấm công"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Tổng bản ghi</CardDescription>
            <div className="text-2xl font-semibold">{records.length}</div>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Chưa lập lương</CardDescription>
            <div className="text-2xl font-semibold text-amber-600">{unpaidCount}</div>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Đã lập lương</CardDescription>
            <div className="text-2xl font-semibold text-emerald-600">{paidCount}</div>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Ngày công bình quân</CardDescription>
            <div className="text-2xl font-semibold">{avgWorkDays} ngày</div>
          </CardHeader>
        </Card>
      </div>

      <Card size="sm" className="no-print">
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã chấm công, mã NV, tên nhân viên..."
              className="pl-8"
            />
          </div>

          <NativeSelect
            value={maPhongBan}
            onChange={(e) => setMaPhongBan(e.target.value)}
            aria-label="Lọc phòng ban"
          >
            <NativeSelectOption value="">Tất cả phòng ban</NativeSelectOption>
            {departments.map((d) => (
              <NativeSelectOption key={d.ma_phong_ban} value={d.ma_phong_ban}>
                {d.ten_phong_ban}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect
            value={chuaTinhLuong}
            onChange={(e) => setChuaTinhLuong(e.target.value)}
            aria-label="Lọc trạng thái tính lương"
          >
            <NativeSelectOption value="">Tất cả trạng thái lương</NativeSelectOption>
            <NativeSelectOption value="1">Chưa tính lương</NativeSelectOption>
            <NativeSelectOption value="0">Đã tính lương</NativeSelectOption>
          </NativeSelect>

          {(search || maPhongBan || chuaTinhLuong) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setMaPhongBan('');
                setChuaTinhLuong('');
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
              <TableHead className="px-4">Mã CC</TableHead>
              <TableHead className="px-4">Nhân viên</TableHead>
              <TableHead className="px-4">Phòng ban / Chức vụ</TableHead>
              <TableHead className="px-4">Số ngày làm việc</TableHead>
              <TableHead className="px-4">Số ngày nghỉ</TableHead>
              <TableHead className="px-4">Trạng thái lương</TableHead>
              <TableHead className="no-print px-4 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Đang tải bảng chấm công...
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Không có dữ liệu chấm công phù hợp.
                </TableCell>
              </TableRow>
            ) : (
              records.map((cc) => {
                const ratio = Math.min(100, Math.round((cc.so_ngay_lam_viec / 26) * 100));
                return (
                  <TableRow key={cc.ma_cham_cong}>
                    <TableCell className="px-4 font-mono text-xs font-semibold">
                      {cc.ma_cham_cong}
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="font-medium">{cc.ten_nhan_vien}</div>
                      <div className="text-xs text-muted-foreground">{cc.ma_nhan_vien}</div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div>{cc.ten_phong_ban}</div>
                      <div className="text-xs text-muted-foreground">
                        {cc.ten_chuc_vu} (x{cc.he_so_luong})
                      </div>
                    </TableCell>
                    <TableCell className="px-4 min-w-[160px]">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold">{cc.so_ngay_lam_viec} ngày</span>
                        <span className="text-muted-foreground">{ratio}% chuẩn</span>
                      </div>
                      <Progress value={ratio} className="no-print" />
                    </TableCell>
                    <TableCell className="px-4">
                      <Badge variant={cc.so_ngay_nghi > 0 ? 'outline' : 'secondary'}>
                        {cc.so_ngay_nghi} ngày
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4">
                      {cc.ma_luong ? (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        >
                          {cc.ma_luong} · T{cc.thang_tinh_luong}/{cc.nam_tinh_luong}
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        >
                          Chưa tính lương
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="no-print px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Chỉnh sửa chấm công"
                          onClick={() => openEdit(cc)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Xóa bản ghi chấm công"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleteError('');
                              setDeleteTarget(cc);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
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
              {editing ? `Cập nhật chấm công ${editing.ma_cham_cong}` : 'Thêm bản ghi chấm công mới'}
            </DialogTitle>
            <DialogDescription>
              Tổng số ngày làm việc và ngày nghỉ không vượt quá 31 ngày
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="att-code">Mã chấm công *</Label>
                <Input
                  id="att-code"
                  type="text"
                  required
                  maxLength={20}
                  disabled={Boolean(editing)}
                  value={form.ma_cham_cong}
                  onChange={(e) => setForm({ ...form, ma_cham_cong: e.target.value })}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="att-emp">Nhân viên *</Label>
                <NativeSelect
                  id="att-emp"
                  required
                  className="w-full"
                  value={form.ma_nhan_vien}
                  onChange={(e) => setForm({ ...form, ma_nhan_vien: e.target.value })}
                >
                  <NativeSelectOption value="" disabled>
                    -- Chọn nhân viên --
                  </NativeSelectOption>
                  {employees.map((nv) => (
                    <NativeSelectOption key={nv.ma_nhan_vien} value={nv.ma_nhan_vien}>
                      {nv.ma_nhan_vien} — {nv.ten_nhan_vien} ({nv.ten_phong_ban})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="att-work">Số ngày làm việc (0–31) *</Label>
                <Input
                  id="att-work"
                  type="number"
                  required
                  min={0}
                  max={31}
                  value={form.so_ngay_lam_viec}
                  onChange={(e) => setForm({ ...form, so_ngay_lam_viec: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="att-off">Số ngày nghỉ (0–31) *</Label>
                <Input
                  id="att-off"
                  type="number"
                  required
                  min={0}
                  max={31}
                  value={form.so_ngay_nghi}
                  onChange={(e) => setForm({ ...form, so_ngay_nghi: e.target.value })}
                />
              </div>
            </div>

            <Alert variant={totalDaysInput > 31 ? 'destructive' : 'default'}>
              <AlertDescription>
                Tổng số ngày ghi nhận: <strong>{totalDaysInput} / 31 ngày</strong> (công chuẩn tính
                lương: 26 ngày).
              </AlertDescription>
            </Alert>

            {editing?.ma_luong && (
              <Alert>
                <Info className="size-4 text-primary" />
                <AlertDescription>
                  Bản ghi này đã liên kết với bảng lương <strong>{editing.ma_luong}</strong>. Khi
                  cập nhật ngày công hoặc nhân viên, hệ thống sẽ tự động tính lại tổng lương trong
                  cùng transaction.
                </AlertDescription>
              </Alert>
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
              <Button type="submit" disabled={saving || totalDaysInput > 31}>
                {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo bản ghi công'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa bản ghi chấm công"
        message={
          deleteTarget
            ? `Bạn có chắc muốn xóa bản ghi chấm công "${deleteTarget.ma_cham_cong}" của ${deleteTarget.ten_nhan_vien}? Nếu đã lập bảng lương, bạn cần xóa bảng lương trước.`
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
