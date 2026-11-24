import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Pencil, Search, Trash2 } from 'lucide-react';
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
import { formatDate, suggestNextCode } from '@/lib/format';

const EMPTY_FORM = {
  ma_nhan_vien: '',
  ten_nhan_vien: '',
  ngay_sinh: '1998-01-01',
  dia_chi: '',
  so_dien_thoai: '',
  ma_phong_ban: '',
  ma_chuc_vu: '',
  nam_vao_lam: new Date().getFullYear(),
  trang_thai: 'Đang làm việc',
};

export function EmployeesPage({ user }) {
  const isAdmin = user?.vai_tro === 'Admin';

  const [employees, setEmployees] = useState([]);
  const [allCodes, setAllCodes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [tenPhongBan, setTenPhongBan] = useState('');
  const [trangThai, setTrangThai] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchEmployees = useCallback(async (filters) => {
    const params = new URLSearchParams();
    if (filters.tenPhongBan) params.set('ten_phong_ban', filters.tenPhongBan);
    if (filters.trangThai) params.set('trang_thai', filters.trangThai);
    if (filters.search.trim()) params.set('q', filters.search.trim());
    const qs = params.toString();
    return apiFetch(`/api/v1/employees${qs ? `?${qs}` : ''}`);
  }, []);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [empData, fullEmp, depData, posData] = await Promise.all([
        fetchEmployees({ tenPhongBan, trangThai, search }),
        apiFetch('/api/v1/employees'),
        apiFetch('/api/v1/departments'),
        apiFetch('/api/v1/positions'),
      ]);
      setEmployees(empData);
      setAllCodes(fullEmp.map((e) => e.ma_nhan_vien));
      setDepartments(depData);
      setPositions(posData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchEmployees, tenPhongBan, trangThai, search]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [empData, fullEmp, depData, posData] = await Promise.all([
          fetchEmployees({ tenPhongBan, trangThai, search }),
          apiFetch('/api/v1/employees'),
          apiFetch('/api/v1/departments'),
          apiFetch('/api/v1/positions'),
        ]);
        if (!active) return;
        setEmployees(empData);
        setAllCodes(fullEmp.map((e) => e.ma_nhan_vien));
        setDepartments(depData);
        setPositions(posData);
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
  }, [fetchEmployees, tenPhongBan, trangThai, search]);

  function openCreate() {
    setEditing(null);
    setFormError('');
    setForm({
      ...EMPTY_FORM,
      ma_nhan_vien: suggestNextCode('NV', allCodes),
      ma_phong_ban: departments[0]?.ma_phong_ban || '',
      ma_chuc_vu: positions[0]?.ma_chuc_vu || '',
      nam_vao_lam: new Date().getFullYear(),
    });
    setModalOpen(true);
  }

  function openEdit(emp) {
    setEditing(emp);
    setFormError('');
    setForm({
      ma_nhan_vien: emp.ma_nhan_vien,
      ten_nhan_vien: emp.ten_nhan_vien,
      ngay_sinh: emp.ngay_sinh || '',
      dia_chi: emp.dia_chi || '',
      so_dien_thoai: emp.so_dien_thoai || '',
      ma_phong_ban: emp.ma_phong_ban,
      ma_chuc_vu: emp.ma_chuc_vu,
      nam_vao_lam: emp.nam_vao_lam,
      trang_thai: emp.trang_thai,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        ...form,
        nam_vao_lam: Number(form.nam_vao_lam),
      };
      if (editing) {
        await apiFetch(`/api/v1/employees/${encodeURIComponent(editing.ma_nhan_vien)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/v1/employees', {
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
      await apiFetch(`/api/v1/employees/${encodeURIComponent(deleteTarget.ma_nhan_vien)}`, {
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
      'danh-sach-nhan-vien.csv',
      [
        'Mã NV',
        'Họ và tên',
        'Ngày sinh',
        'Địa chỉ',
        'Số điện thoại',
        'Phòng ban',
        'Chức vụ',
        'Hệ số lương',
        'Năm vào làm',
        'Thâm niên (năm)',
        'Trạng thái',
      ],
      employees.map((nv) => [
        nv.ma_nhan_vien,
        nv.ten_nhan_vien,
        formatDate(nv.ngay_sinh),
        nv.dia_chi,
        nv.so_dien_thoai,
        nv.ten_phong_ban,
        nv.ten_chuc_vu,
        nv.he_so_luong,
        nv.nam_vao_lam,
        nv.so_nam_lam_viec,
        nv.trang_thai,
      ])
    );
  }

  const activeCount = employees.filter((e) => e.trang_thai === 'Đang làm việc').length;
  const resignedCount = employees.length - activeCount;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quản lý nhân viên"
        description="Hồ sơ nhân sự, phân bổ phòng ban - chức vụ và thâm niên làm việc"
        countLabel={`${employees.length} nhân viên`}
        onRefresh={reloadAll}
        onExportCsv={handleExportCsv}
        onPrint={() => window.print()}
        onAdd={openCreate}
        addLabel="Thêm nhân viên"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Đang hiển thị</CardDescription>
            <div className="text-2xl font-semibold">{employees.length}</div>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Đang làm việc</CardDescription>
            <div className="text-2xl font-semibold text-emerald-600">{activeCount}</div>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Nghỉ việc</CardDescription>
            <div className="text-2xl font-semibold text-rose-600">{resignedCount}</div>
          </CardHeader>
        </Card>
      </div>

      <Card size="sm" className="no-print">
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-55">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã NV, họ tên, SĐT, địa chỉ..."
              className="pl-8"
            />
          </div>

          <NativeSelect
            value={tenPhongBan}
            onChange={(e) => setTenPhongBan(e.target.value)}
            aria-label="Lọc theo phòng ban"
          >
            <NativeSelectOption value="">Tất cả phòng ban</NativeSelectOption>
            {departments.map((d) => (
              <NativeSelectOption key={d.ma_phong_ban} value={d.ten_phong_ban}>
                {d.ten_phong_ban} ({d.ma_phong_ban})
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect
            value={trangThai}
            onChange={(e) => setTrangThai(e.target.value)}
            aria-label="Lọc theo trạng thái"
          >
            <NativeSelectOption value="">Tất cả trạng thái</NativeSelectOption>
            <NativeSelectOption value="Đang làm việc">Đang làm việc</NativeSelectOption>
            <NativeSelectOption value="Nghỉ việc">Nghỉ việc</NativeSelectOption>
          </NativeSelect>

          {(search || tenPhongBan || trangThai) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setTenPhongBan('');
                setTrangThai('');
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
              <TableHead className="px-4">Mã NV</TableHead>
              <TableHead className="px-4">Họ và tên</TableHead>
              <TableHead className="px-4">Liên hệ</TableHead>
              <TableHead className="px-4">Phòng ban</TableHead>
              <TableHead className="px-4">Chức vụ</TableHead>
              <TableHead className="px-4">Thâm niên</TableHead>
              <TableHead className="px-4">Trạng thái</TableHead>
              <TableHead className="no-print px-4 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Đang tải danh sách nhân viên...
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Không có nhân viên nào khớp bộ lọc hiện tại.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((nv) => (
                <TableRow key={nv.ma_nhan_vien}>
                  <TableCell className="px-4 font-mono text-xs font-semibold">
                    {nv.ma_nhan_vien}
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="font-medium">{nv.ten_nhan_vien}</div>
                    <div className="text-xs text-muted-foreground">
                      NS: {formatDate(nv.ngay_sinh)}
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div>{nv.so_dien_thoai}</div>
                    <div className="text-xs text-muted-foreground">{nv.dia_chi}</div>
                  </TableCell>
                  <TableCell className="px-4">{nv.ten_phong_ban}</TableCell>
                  <TableCell className="px-4">
                    <div>{nv.ten_chuc_vu}</div>
                    <div className="text-xs text-muted-foreground">Hệ số x{nv.he_so_luong}</div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div>{nv.so_nam_lam_viec} năm</div>
                    <div className="text-xs text-muted-foreground">Từ {nv.nam_vao_lam}</div>
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge
                      variant={nv.trang_thai === 'Đang làm việc' ? 'secondary' : 'destructive'}
                      className={
                        nv.trang_thai === 'Đang làm việc'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : ''
                      }
                    >
                      {nv.trang_thai}
                    </Badge>
                  </TableCell>
                  <TableCell className="no-print px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Chỉnh sửa"
                        onClick={() => openEdit(nv)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {isAdmin && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Xóa nhân viên"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteError('');
                            setDeleteTarget(nv);
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
        </Table>
      </Card>

      <Dialog
        open={modalOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !saving) setModalOpen(false);
        }}
      >
        <DialogContent className="no-print sm:max-w-xl! max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Cập nhật nhân viên ${editing.ma_nhan_vien}` : 'Thêm nhân viên mới'}
            </DialogTitle>
            <DialogDescription>
              Điền đầy đủ thông tin hồ sơ nhân sự theo quy định công ty
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
              <div className="space-y-1.5">
                <Label htmlFor="emp-code">Mã nhân viên *</Label>
                <Input
                  id="emp-code"
                  type="text"
                  required
                  maxLength={20}
                  disabled={Boolean(editing)}
                  value={form.ma_nhan_vien}
                  onChange={(e) => setForm({ ...form, ma_nhan_vien: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-name">Họ và tên *</Label>
                <Input
                  id="emp-name"
                  type="text"
                  required
                  maxLength={100}
                  value={form.ten_nhan_vien}
                  onChange={(e) => setForm({ ...form, ten_nhan_vien: e.target.value })}
                  placeholder="Nguyễn Văn A"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-dob">Ngày sinh *</Label>
                <Input
                  id="emp-dob"
                  type="date"
                  required
                  value={form.ngay_sinh}
                  onChange={(e) => setForm({ ...form, ngay_sinh: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-phone">Số điện thoại (9–15 số) *</Label>
                <Input
                  id="emp-phone"
                  type="tel"
                  required
                  maxLength={15}
                  value={form.so_dien_thoai}
                  onChange={(e) => setForm({ ...form, so_dien_thoai: e.target.value })}
                  placeholder="0901234567"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="emp-address">Địa chỉ *</Label>
                <Input
                  id="emp-address"
                  type="text"
                  required
                  maxLength={255}
                  value={form.dia_chi}
                  onChange={(e) => setForm({ ...form, dia_chi: e.target.value })}
                  placeholder="Quận Ninh Kiều, TP. Cần Thơ"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-dep">Phòng ban *</Label>
                <NativeSelect
                  id="emp-dep"
                  required
                  className="w-full"
                  value={form.ma_phong_ban}
                  onChange={(e) => setForm({ ...form, ma_phong_ban: e.target.value })}
                >
                  <NativeSelectOption value="" disabled>
                    -- Chọn phòng ban --
                  </NativeSelectOption>
                  {departments.map((d) => (
                    <NativeSelectOption key={d.ma_phong_ban} value={d.ma_phong_ban}>
                      {d.ten_phong_ban} ({d.ma_phong_ban})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-pos">Chức vụ *</Label>
                <NativeSelect
                  id="emp-pos"
                  required
                  className="w-full"
                  value={form.ma_chuc_vu}
                  onChange={(e) => setForm({ ...form, ma_chuc_vu: e.target.value })}
                >
                  <NativeSelectOption value="" disabled>
                    -- Chọn chức vụ --
                  </NativeSelectOption>
                  {positions.map((p) => (
                    <NativeSelectOption key={p.ma_chuc_vu} value={p.ma_chuc_vu}>
                      {p.ten_chuc_vu} (x{p.he_so_luong})
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-year">Năm vào làm *</Label>
                <Input
                  id="emp-year"
                  type="number"
                  required
                  min={1970}
                  max={2100}
                  value={form.nam_vao_lam}
                  onChange={(e) => setForm({ ...form, nam_vao_lam: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-status">Trạng thái làm việc *</Label>
                <NativeSelect
                  id="emp-status"
                  className="w-full"
                  value={form.trang_thai}
                  onChange={(e) => setForm({ ...form, trang_thai: e.target.value })}
                >
                  <NativeSelectOption value="Đang làm việc">Đang làm việc</NativeSelectOption>
                  <NativeSelectOption value="Nghỉ việc">Nghỉ việc</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo nhân viên'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa hồ sơ nhân viên"
        message={
          deleteTarget
            ? `Bạn có chắc muốn xóa nhân viên "${deleteTarget.ten_nhan_vien}" (${deleteTarget.ma_nhan_vien})? Hợp đồng và chấm công chưa tính lương của nhân viên này cũng sẽ bị xóa theo.`
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
