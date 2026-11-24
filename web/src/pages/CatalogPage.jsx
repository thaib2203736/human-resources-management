import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Download, Pencil, Plus, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

export function CatalogPage({ user }) {
  const isAdmin = user?.vai_tro === 'Admin';

  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [depSearch, setDepSearch] = useState('');
  const [posSearch, setPosSearch] = useState('');

  const [depModal, setDepModal] = useState(null);
  const [depForm, setDepForm] = useState({ ma_phong_ban: '', ten_phong_ban: '' });
  const [depSaving, setDepSaving] = useState(false);
  const [depError, setDepError] = useState('');

  const [posModal, setPosModal] = useState(null);
  const [posForm, setPosForm] = useState({ ma_chuc_vu: '', ten_chuc_vu: '', he_so_luong: '1.00' });
  const [posSaving, setPosSaving] = useState(false);
  const [posError, setPosError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const reloadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [depData, posData] = await Promise.all([
        apiFetch('/api/v1/departments'),
        apiFetch('/api/v1/positions'),
      ]);
      setDepartments(depData);
      setPositions(posData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [depData, posData] = await Promise.all([
          apiFetch('/api/v1/departments'),
          apiFetch('/api/v1/positions'),
        ]);
        if (!active) return;
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
  }, []);

  const filteredDeps = departments.filter(
    (d) =>
      d.ma_phong_ban.toLowerCase().includes(depSearch.toLowerCase()) ||
      d.ten_phong_ban.toLowerCase().includes(depSearch.toLowerCase())
  );

  const filteredPositions = positions.filter(
    (p) =>
      p.ma_chuc_vu.toLowerCase().includes(posSearch.toLowerCase()) ||
      p.ten_chuc_vu.toLowerCase().includes(posSearch.toLowerCase())
  );

  function openCreateDep() {
    setDepError('');
    setDepForm({
      ma_phong_ban: suggestNextCode(
        'PB',
        departments.map((d) => d.ma_phong_ban)
      ),
      ten_phong_ban: '',
    });
    setDepModal({ mode: 'create' });
  }

  function openEditDep(dep) {
    setDepError('');
    setDepForm({ ma_phong_ban: dep.ma_phong_ban, ten_phong_ban: dep.ten_phong_ban });
    setDepModal({ mode: 'edit', data: dep });
  }

  async function handleDepSubmit(e) {
    e.preventDefault();
    setDepSaving(true);
    setDepError('');
    try {
      if (depModal?.mode === 'edit') {
        await apiFetch(`/api/v1/departments/${encodeURIComponent(depForm.ma_phong_ban)}`, {
          method: 'PUT',
          body: JSON.stringify({ ten_phong_ban: depForm.ten_phong_ban }),
        });
      } else {
        await apiFetch('/api/v1/departments', {
          method: 'POST',
          body: JSON.stringify(depForm),
        });
      }
      setDepModal(null);
      await reloadAll();
    } catch (err) {
      setDepError(err.message);
    } finally {
      setDepSaving(false);
    }
  }

  function openCreatePos() {
    setPosError('');
    setPosForm({
      ma_chuc_vu: suggestNextCode(
        'CV',
        positions.map((p) => p.ma_chuc_vu)
      ),
      ten_chuc_vu: '',
      he_so_luong: '1.20',
    });
    setPosModal({ mode: 'create' });
  }

  function openEditPos(pos) {
    setPosError('');
    setPosForm({
      ma_chuc_vu: pos.ma_chuc_vu,
      ten_chuc_vu: pos.ten_chuc_vu,
      he_so_luong: String(pos.he_so_luong),
    });
    setPosModal({ mode: 'edit', data: pos });
  }

  async function handlePosSubmit(e) {
    e.preventDefault();
    setPosSaving(true);
    setPosError('');
    try {
      const payload = {
        ma_chuc_vu: posForm.ma_chuc_vu,
        ten_chuc_vu: posForm.ten_chuc_vu,
        he_so_luong: Number(posForm.he_so_luong),
      };
      if (posModal?.mode === 'edit') {
        await apiFetch(`/api/v1/positions/${encodeURIComponent(posForm.ma_chuc_vu)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/v1/positions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setPosModal(null);
      await reloadAll();
    } catch (err) {
      setPosError(err.message);
    } finally {
      setPosSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const endpoint =
        deleteTarget.type === 'dep'
          ? `/api/v1/departments/${encodeURIComponent(deleteTarget.code)}`
          : `/api/v1/positions/${encodeURIComponent(deleteTarget.code)}`;
      await apiFetch(endpoint, { method: 'DELETE' });
      setDeleteTarget(null);
      await reloadAll();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Phòng ban & Chức vụ"
        description="Danh mục cơ cấu tổ chức và thang hệ số lương chức vụ"
        countLabel={`${departments.length} phòng ban · ${positions.length} chức vụ`}
        onRefresh={reloadAll}
        onPrint={() => window.print()}
      />

      {!isAdmin && (
        <Alert className="no-print">
          <ShieldAlert className="size-4 text-amber-600" />
          <AlertDescription>
            Tài khoản <strong>HR</strong> đang ở chế độ xem danh mục. Chỉ quản trị viên (
            <strong>Admin</strong>) mới có quyền thêm, sửa hoặc xóa phòng ban và chức vụ.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Cột Phòng ban */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Danh sách Phòng ban</CardTitle>
            <CardDescription>{filteredDeps.length} phòng ban</CardDescription>
            <CardAction className="no-print flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  exportCsv(
                    'danh-sach-phong-ban.csv',
                    ['Mã phòng ban', 'Tên phòng ban', 'Số nhân viên'],
                    filteredDeps.map((d) => [d.ma_phong_ban, d.ten_phong_ban, d.so_nhan_vien])
                  )
                }
              >
                <Download className="size-3.5" />
                CSV
              </Button>
              {isAdmin && (
                <Button type="button" size="sm" onClick={openCreateDep}>
                  <Plus className="size-3.5" />
                  Thêm phòng ban
                </Button>
              )}
            </CardAction>
          </CardHeader>

          <CardContent className="no-print">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={depSearch}
                onChange={(e) => setDepSearch(e.target.value)}
                placeholder="Tìm mã hoặc tên phòng ban..."
                className="pl-8"
              />
            </div>
          </CardContent>

          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="px-4">Mã PB</TableHead>
                <TableHead className="px-4">Tên phòng ban</TableHead>
                <TableHead className="px-4">Nhân sự</TableHead>
                {isAdmin && <TableHead className="no-print px-4 text-right">Thao tác</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : filteredDeps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Không có phòng ban phù hợp.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeps.map((d) => (
                  <TableRow key={d.ma_phong_ban}>
                    <TableCell className="px-4 font-mono text-xs font-semibold">
                      {d.ma_phong_ban}
                    </TableCell>
                    <TableCell className="px-4 font-medium">{d.ten_phong_ban}</TableCell>
                    <TableCell className="px-4">
                      <Badge variant="secondary">{d.so_nhan_vien} NV</Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="no-print px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Đổi tên phòng ban"
                            onClick={() => openEditDep(d)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Xóa phòng ban"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleteError('');
                              setDeleteTarget({
                                type: 'dep',
                                code: d.ma_phong_ban,
                                name: d.ten_phong_ban,
                              });
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Cột Chức vụ */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Danh sách Chức vụ</CardTitle>
            <CardDescription>{filteredPositions.length} chức vụ</CardDescription>
            <CardAction className="no-print flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  exportCsv(
                    'danh-sach-chuc-vu.csv',
                    ['Mã chức vụ', 'Tên chức vụ', 'Hệ số lương', 'Số nhân viên'],
                    filteredPositions.map((p) => [
                      p.ma_chuc_vu,
                      p.ten_chuc_vu,
                      p.he_so_luong,
                      p.so_nhan_vien,
                    ])
                  )
                }
              >
                <Download className="size-3.5" />
                CSV
              </Button>
              {isAdmin && (
                <Button type="button" size="sm" onClick={openCreatePos}>
                  <Plus className="size-3.5" />
                  Thêm chức vụ
                </Button>
              )}
            </CardAction>
          </CardHeader>

          <CardContent className="no-print">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={posSearch}
                onChange={(e) => setPosSearch(e.target.value)}
                placeholder="Tìm mã hoặc tên chức vụ..."
                className="pl-8"
              />
            </div>
          </CardContent>

          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="px-4">Mã CV</TableHead>
                <TableHead className="px-4">Tên chức vụ</TableHead>
                <TableHead className="px-4">Hệ số</TableHead>
                <TableHead className="px-4">Nhân sự</TableHead>
                {isAdmin && <TableHead className="no-print px-4 text-right">Thao tác</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Đang tải...
                  </TableCell>
                </TableRow>
              ) : filteredPositions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Không có chức vụ phù hợp.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPositions.map((p) => (
                  <TableRow key={p.ma_chuc_vu}>
                    <TableCell className="px-4 font-mono text-xs font-semibold">
                      {p.ma_chuc_vu}
                    </TableCell>
                    <TableCell className="px-4 font-medium">{p.ten_chuc_vu}</TableCell>
                    <TableCell className="px-4">
                      <Badge variant="outline">x{Number(p.he_so_luong).toFixed(2)}</Badge>
                    </TableCell>
                    <TableCell className="px-4">
                      <Badge variant="secondary">{p.so_nhan_vien} NV</Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="no-print px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Chỉnh sửa chức vụ"
                            onClick={() => openEditPos(p)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Xóa chức vụ"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeleteError('');
                              setDeleteTarget({
                                type: 'pos',
                                code: p.ma_chuc_vu,
                                name: p.ten_chuc_vu,
                              });
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Dialog Phòng ban */}
      <Dialog
        open={Boolean(depModal)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !depSaving) setDepModal(null);
        }}
      >
        <DialogContent className="no-print sm:max-w-md!">
          <DialogHeader>
            <DialogTitle>
              {depModal?.mode === 'edit'
                ? `Đổi tên phòng ban ${depForm.ma_phong_ban}`
                : 'Thêm phòng ban mới'}
            </DialogTitle>
            <DialogDescription>Nhập mã và tên phòng ban không trùng lặp</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDepSubmit} className="space-y-4">
            {depError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{depError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="dep-code">Mã phòng ban *</Label>
              <Input
                id="dep-code"
                type="text"
                required
                maxLength={20}
                disabled={depModal?.mode === 'edit'}
                value={depForm.ma_phong_ban}
                onChange={(e) => setDepForm({ ...depForm, ma_phong_ban: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dep-name">Tên phòng ban *</Label>
              <Input
                id="dep-name"
                type="text"
                required
                maxLength={100}
                value={depForm.ten_phong_ban}
                onChange={(e) => setDepForm({ ...depForm, ten_phong_ban: e.target.value })}
                placeholder="Phòng Hành chính"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDepModal(null)}
                disabled={depSaving}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={depSaving}>
                {depSaving ? 'Đang lưu...' : 'Lưu phòng ban'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Chức vụ */}
      <Dialog
        open={Boolean(posModal)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !posSaving) setPosModal(null);
        }}
      >
        <DialogContent className="no-print sm:max-w-md!">
          <DialogHeader>
            <DialogTitle>
              {posModal?.mode === 'edit'
                ? `Cập nhật chức vụ ${posForm.ma_chuc_vu}`
                : 'Thêm chức vụ mới'}
            </DialogTitle>
            <DialogDescription>Thiết lập tên chức vụ và hệ số tính lương</DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePosSubmit} className="space-y-4">
            {posError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{posError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pos-code">Mã chức vụ *</Label>
              <Input
                id="pos-code"
                type="text"
                required
                maxLength={20}
                disabled={posModal?.mode === 'edit'}
                value={posForm.ma_chuc_vu}
                onChange={(e) => setPosForm({ ...posForm, ma_chuc_vu: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-name">Tên chức vụ *</Label>
              <Input
                id="pos-name"
                type="text"
                required
                maxLength={100}
                value={posForm.ten_chuc_vu}
                onChange={(e) => setPosForm({ ...posForm, ten_chuc_vu: e.target.value })}
                placeholder="Phó trưởng phòng"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-coef">Hệ số lương (&gt; 0) *</Label>
              <Input
                id="pos-coef"
                type="number"
                required
                step="0.01"
                min="0.01"
                max="999.99"
                value={posForm.he_so_luong}
                onChange={(e) => setPosForm({ ...posForm, he_so_luong: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPosModal(null)}
                disabled={posSaving}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={posSaving}>
                {posSaving ? 'Đang lưu...' : 'Lưu chức vụ'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.type === 'dep' ? 'Xóa phòng ban' : 'Xóa chức vụ'}
        message={
          deleteTarget
            ? `Bạn có chắc muốn xóa "${deleteTarget.name}" (${deleteTarget.code})? Hệ thống sẽ từ chối nếu vẫn còn nhân viên thuộc danh mục này.`
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
