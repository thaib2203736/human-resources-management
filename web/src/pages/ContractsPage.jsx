import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Pencil, Search, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { formatDate, suggestNextCode, todayIsoDate } from '@/lib/format';

const PRESET_TYPES = ['Không thời hạn', 'Có thời hạn', 'Thử việc'];

export function ContractsPage({ user }) {
  const isAdmin = user?.vai_tro === 'Admin';

  const [contracts, setContracts] = useState([]);
  const [allCodes, setAllCodes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [loaiHopDong, setLoaiHopDong] = useState('');
  const [hieuLuc, setHieuLuc] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    ma_hop_dong: '',
    ma_nhan_vien: '',
    loai_hop_dong: 'Có thời hạn',
    ngay_ky: todayIsoDate(),
    ngay_ket_thuc: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchFiltered = useCallback(async (filters) => {
    const params = new URLSearchParams();
    if (filters.loaiHopDong) params.set('loai_hop_dong', filters.loaiHopDong);
    if (filters.hieuLuc) params.set('hieu_luc', filters.hieuLuc);
    if (filters.search.trim()) params.set('q', filters.search.trim());
    const qs = params.toString();
    return apiFetch(`/api/v1/contracts${qs ? `?${qs}` : ''}`);
  }, []);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [ctData, fullCt, empData] = await Promise.all([
        fetchFiltered({ loaiHopDong, hieuLuc, search }),
        apiFetch('/api/v1/contracts'),
        apiFetch('/api/v1/employees'),
      ]);
      setContracts(ctData);
      setAllCodes(fullCt.map((c) => c.ma_hop_dong));
      setEmployees(empData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchFiltered, loaiHopDong, hieuLuc, search]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [ctData, fullCt, empData] = await Promise.all([
          fetchFiltered({ loaiHopDong, hieuLuc, search }),
          apiFetch('/api/v1/contracts'),
          apiFetch('/api/v1/employees'),
        ]);
        if (!active) return;
        setContracts(ctData);
        setAllCodes(fullCt.map((c) => c.ma_hop_dong));
        setEmployees(empData);
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
  }, [fetchFiltered, loaiHopDong, hieuLuc, search]);

  function openCreate() {
    setEditing(null);
    setFormError('');
    setForm({
      ma_hop_dong: suggestNextCode('HD', allCodes),
      ma_nhan_vien: employees[0]?.ma_nhan_vien || '',
      loai_hop_dong: 'Có thời hạn',
      ngay_ky: todayIsoDate(),
      ngay_ket_thuc: '',
    });
    setModalOpen(true);
  }

  function openEdit(hd) {
    setEditing(hd);
    setFormError('');
    setForm({
      ma_hop_dong: hd.ma_hop_dong,
      ma_nhan_vien: hd.ma_nhan_vien,
      loai_hop_dong: hd.loai_hop_dong,
      ngay_ky: hd.ngay_ky || '',
      ngay_ket_thuc: hd.ngay_ket_thuc || '',
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
        ngay_ket_thuc: form.ngay_ket_thuc ? form.ngay_ket_thuc : null,
      };
      if (editing) {
        await apiFetch(`/api/v1/contracts/${encodeURIComponent(editing.ma_hop_dong)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/v1/contracts', {
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
      await apiFetch(`/api/v1/contracts/${encodeURIComponent(deleteTarget.ma_hop_dong)}`, {
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
      'danh-sach-hop-dong.csv',
      [
        'Mã hợp đồng',
        'Mã NV',
        'Họ tên nhân viên',
        'Phòng ban',
        'Loại hợp đồng',
        'Ngày ký',
        'Ngày kết thúc',
        'Tình trạng',
      ],
      contracts.map((hd) => [
        hd.ma_hop_dong,
        hd.ma_nhan_vien,
        hd.ten_nhan_vien,
        hd.ten_phong_ban,
        hd.loai_hop_dong,
        formatDate(hd.ngay_ky),
        hd.ngay_ket_thuc ? formatDate(hd.ngay_ket_thuc) : 'Đang hiệu lực',
        hd.ngay_ket_thuc ? 'Đã kết thúc' : 'Đang hiệu lực',
      ])
    );
  }

  const activeCount = contracts.filter((c) => !c.ngay_ket_thuc).length;
  const endedCount = contracts.length - activeCount;
  const contractTypes = Array.from(
    new Set([...PRESET_TYPES, ...contracts.map((c) => c.loai_hop_dong)])
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quản lý hợp đồng lao động"
        description="Theo dõi thời hạn ký kết, hiệu lực hợp đồng và trạng thái nghỉ việc tự động"
        countLabel={`${contracts.length} hợp đồng`}
        onRefresh={reloadAll}
        onExportCsv={handleExportCsv}
        onPrint={() => window.print()}
        onAdd={openCreate}
        addLabel="Lập hợp đồng"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Tổng hợp đồng hiển thị</CardDescription>
            <div className="text-2xl font-semibold">{contracts.length}</div>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Đang hiệu lực</CardDescription>
            <div className="text-2xl font-semibold text-emerald-600">{activeCount}</div>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Đã thanh lý / kết thúc</CardDescription>
            <div className="text-2xl font-semibold text-amber-600">{endedCount}</div>
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
              placeholder="Tìm theo mã HĐ, mã NV, tên nhân viên..."
              className="pl-8"
            />
          </div>

          <NativeSelect
            value={loaiHopDong}
            onChange={(e) => setLoaiHopDong(e.target.value)}
            aria-label="Lọc loại hợp đồng"
          >
            <NativeSelectOption value="">Tất cả loại hợp đồng</NativeSelectOption>
            {contractTypes.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {t}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect
            value={hieuLuc}
            onChange={(e) => setHieuLuc(e.target.value)}
            aria-label="Lọc tình trạng hiệu lực"
          >
            <NativeSelectOption value="">Tất cả tình trạng</NativeSelectOption>
            <NativeSelectOption value="active">Đang hiệu lực</NativeSelectOption>
            <NativeSelectOption value="ended">Đã kết thúc</NativeSelectOption>
          </NativeSelect>

          {(search || loaiHopDong || hieuLuc) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setLoaiHopDong('');
                setHieuLuc('');
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
              <TableHead className="px-4">Mã HĐ</TableHead>
              <TableHead className="px-4">Nhân viên</TableHead>
              <TableHead className="px-4">Phòng ban</TableHead>
              <TableHead className="px-4">Loại hợp đồng</TableHead>
              <TableHead className="px-4">Ngày ký</TableHead>
              <TableHead className="px-4">Ngày kết thúc</TableHead>
              <TableHead className="px-4">Tình trạng</TableHead>
              <TableHead className="no-print px-4 text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Đang tải danh sách hợp đồng...
                </TableCell>
              </TableRow>
            ) : contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Không có hợp đồng nào khớp bộ lọc.
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((hd) => (
                <TableRow key={hd.ma_hop_dong}>
                  <TableCell className="px-4 font-mono text-xs font-semibold">
                    {hd.ma_hop_dong}
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="font-medium">{hd.ten_nhan_vien}</div>
                    <div className="text-xs text-muted-foreground">
                      {hd.ma_nhan_vien} · {hd.trang_thai_nhan_vien}
                    </div>
                  </TableCell>
                  <TableCell className="px-4">{hd.ten_phong_ban}</TableCell>
                  <TableCell className="px-4">
                    <Badge variant="outline">{hd.loai_hop_dong}</Badge>
                  </TableCell>
                  <TableCell className="px-4">{formatDate(hd.ngay_ky)}</TableCell>
                  <TableCell className="px-4">
                    {hd.ngay_ket_thuc ? (
                      formatDate(hd.ngay_ket_thuc)
                    ) : (
                      <span className="text-xs text-muted-foreground">Chưa kết thúc</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge
                      variant="secondary"
                      className={
                        hd.ngay_ket_thuc
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      }
                    >
                      {hd.ngay_ket_thuc ? 'Đã kết thúc' : 'Đang hiệu lực'}
                    </Badge>
                  </TableCell>
                  <TableCell className="no-print px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Cập nhật hợp đồng"
                        onClick={() => openEdit(hd)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {isAdmin && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Xóa hợp đồng"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteError('');
                            setDeleteTarget(hd);
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
        <DialogContent className="no-print sm:max-w-lg! max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Cập nhật hợp đồng ${editing.ma_hop_dong}` : 'Lập hợp đồng lao động mới'}
            </DialogTitle>
            <DialogDescription>
              Gắn hợp đồng với nhân viên và ghi nhận ngày hiệu lực
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
                <Label htmlFor="ct-code">Mã hợp đồng *</Label>
                <Input
                  id="ct-code"
                  type="text"
                  required
                  maxLength={20}
                  disabled={Boolean(editing)}
                  value={form.ma_hop_dong}
                  onChange={(e) => setForm({ ...form, ma_hop_dong: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ct-type">Loại hợp đồng *</Label>
                <Input
                  id="ct-type"
                  type="text"
                  required
                  maxLength={50}
                  list="contract-type-presets"
                  value={form.loai_hop_dong}
                  onChange={(e) => setForm({ ...form, loai_hop_dong: e.target.value })}
                />
                <datalist id="contract-type-presets">
                  {PRESET_TYPES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ct-emp">Nhân viên *</Label>
                <NativeSelect
                  id="ct-emp"
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
                <Label htmlFor="ct-start">Ngày ký *</Label>
                <Input
                  id="ct-start"
                  type="date"
                  required
                  value={form.ngay_ky}
                  onChange={(e) => setForm({ ...form, ngay_ky: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ct-end">Ngày kết thúc (thanh lý)</Label>
                  {form.ngay_ket_thuc && (
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      className="h-auto p-0"
                      onClick={() => setForm({ ...form, ngay_ket_thuc: '' })}
                    >
                      Để trống
                    </Button>
                  )}
                </div>
                <Input
                  id="ct-end"
                  type="date"
                  min={form.ngay_ky || undefined}
                  value={form.ngay_ket_thuc}
                  onChange={(e) => setForm({ ...form, ngay_ket_thuc: e.target.value })}
                />
              </div>
            </div>

            {form.ngay_ket_thuc && (
              <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
                <AlertTriangle className="size-4 text-amber-600" />
                <AlertTitle>Cảnh báo Trigger CSDL</AlertTitle>
                <AlertDescription>
                  Khi điền Ngày kết thúc, trigger MySQL (<code>trg_hop_dong_nghi_viec</code>) sẽ tự
                  động chuyển trạng thái của nhân viên này sang <strong>Nghỉ việc</strong>. Hãy để
                  trống nếu hợp đồng vẫn đang hiệu lực.
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
              <Button type="submit" disabled={saving}>
                {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Tạo hợp đồng'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xóa hợp đồng lao động"
        message={
          deleteTarget
            ? `Bạn có chắc muốn xóa hợp đồng "${deleteTarget.ma_hop_dong}" của nhân viên ${deleteTarget.ten_nhan_vien}?`
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
