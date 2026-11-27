import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BarChart3, Building2, FileSignature, Users, Wallet } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/PageHeader';
import { apiFetch } from '@/lib/api';
import { exportCsv } from '@/lib/export';
import { formatCurrency } from '@/lib/format';

export function StatisticsPage() {
  const [nam, setNam] = useState('');
  const [maPhongBan, setMaPhongBan] = useState('');
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState({
    years: [],
    summary: {
      tong_nhan_vien: 0,
      dang_lam_viec: 0,
      nghi_viec: 0,
      tong_phong_ban: 0,
      hop_dong_hieu_luc: 0,
      hop_dong_ket_thuc: 0,
      tong_quy_luong: 0,
      luong_trung_binh: 0,
    },
    byDepartment: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async (yearFilter, depFilter) => {
    const params = new URLSearchParams();
    if (yearFilter) params.set('nam', yearFilter);
    if (depFilter) params.set('ma_phong_ban', depFilter);
    const qs = params.toString();
    return apiFetch(`/api/v1/statistics${qs ? `?${qs}` : ''}`);
  }, []);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [statsData, depData] = await Promise.all([
        fetchStats(nam, maPhongBan),
        apiFetch('/api/v1/departments'),
      ]);
      setStats(statsData);
      setDepartments(depData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchStats, nam, maPhongBan]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [statsData, depData] = await Promise.all([
          fetchStats(nam, maPhongBan),
          apiFetch('/api/v1/departments'),
        ]);
        if (!active) return;
        setStats(statsData);
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
  }, [fetchStats, nam, maPhongBan]);

  function handleExportCsv() {
    exportCsv(
      `thong-ke-quy-luong${nam ? `-${nam}` : ''}.csv`,
      [
        'Mã phòng ban',
        'Tên phòng ban',
        'Số nhân viên',
        'Số kỳ lương',
        'Tổng quỹ lương',
        'Lương trung bình',
        'Lương cao nhất',
        'Lương thấp nhất',
      ],
      stats.byDepartment.map((r) => [
        r.ma_phong_ban,
        r.ten_phong_ban,
        r.so_nhan_vien,
        r.so_ky_luong,
        r.tong_quy_luong,
        r.luong_trung_binh,
        r.luong_cao_nhat,
        r.luong_thap_nhat,
      ])
    );
  }

  const { summary, byDepartment, years } = stats;
  const maxFund = Math.max(1, ...byDepartment.map((d) => d.tong_quy_luong));
  const maxAvg = Math.max(1, ...byDepartment.map((d) => d.luong_trung_binh));
  const totalEmployeesTable = byDepartment.reduce((s, d) => s + d.so_nhan_vien, 0);
  const totalPeriodsTable = byDepartment.reduce((s, d) => s + d.so_ky_luong, 0);
  const totalFundTable = byDepartment.reduce((s, d) => s + d.tong_quy_luong, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Thống kê & Báo cáo nhân sự"
        description={`Tổng hợp biến động nhân sự và phân tích quỹ lương theo phòng ban${
          nam ? ` (Năm ${nam})` : ' (Tất cả các năm)'
        }`}
        countLabel={`${byDepartment.length} phòng ban`}
        onRefresh={reloadAll}
        onExportCsv={handleExportCsv}
        onPrint={() => window.print()}
      />

      <Card size="sm" className="no-print">
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BarChart3 className="size-4" />
            Bộ lọc báo cáo:
          </div>

          <NativeSelect
            value={nam}
            onChange={(e) => setNam(e.target.value)}
            aria-label="Chọn năm thống kê"
          >
            <NativeSelectOption value="">Tất cả các năm</NativeSelectOption>
            {years.map((y) => (
              <NativeSelectOption key={y} value={String(y)}>
                Năm {y}
              </NativeSelectOption>
            ))}
          </NativeSelect>

          <NativeSelect
            value={maPhongBan}
            onChange={(e) => setMaPhongBan(e.target.value)}
            aria-label="Chọn phòng ban thống kê"
          >
            <NativeSelectOption value="">Tất cả phòng ban</NativeSelectOption>
            {departments.map((d) => (
              <NativeSelectOption key={d.ma_phong_ban} value={d.ma_phong_ban}>
                {d.ten_phong_ban} ({d.ma_phong_ban})
              </NativeSelectOption>
            ))}
          </NativeSelect>

          {(nam || maPhongBan) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setNam('');
                setMaPhongBan('');
              }}
            >
              Đặt lại
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

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>Tổng quy mô nhân sự</CardDescription>
              <Users className="size-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-semibold">{summary.tong_nhan_vien} NV</div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge
                variant="secondary"
                className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              >
                {summary.dang_lam_viec} đang làm
              </Badge>
              <Badge variant="destructive">{summary.nghi_viec} nghỉ việc</Badge>
            </div>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>Hợp đồng lao động</CardDescription>
              <FileSignature className="size-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-semibold">
              {summary.hop_dong_hieu_luc + summary.hop_dong_ket_thuc} HĐ
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="outline">{summary.hop_dong_hieu_luc} hiệu lực</Badge>
              <Badge variant="secondary">{summary.hop_dong_ket_thuc} kết thúc</Badge>
            </div>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>Tổng quỹ lương chi trả</CardDescription>
              <Wallet className="size-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-semibold text-emerald-600">
              {formatCurrency(summary.tong_quy_luong)}
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              {nam ? `Kỳ thống kê năm ${nam}` : 'Lũy kế tất cả các năm'}
            </div>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription>Thu nhập bình quân / kỳ</CardDescription>
              <Building2 className="size-4 text-muted-foreground" />
            </div>
            <div className="text-xl font-semibold">{formatCurrency(summary.luong_trung_binh)}</div>
            <div className="text-xs text-muted-foreground pt-1">
              Trên {summary.tong_phong_ban} phòng ban
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Biểu đồ so sánh trực quan bằng shadcn Tabs + Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Biểu đồ phân bổ lương theo phòng ban</CardTitle>
          <CardDescription>
            Biểu đồ trực quan so sánh tổng quỹ lương và lương trung bình của các phòng ban.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="fund" className="space-y-4">
            <TabsList className="no-print">
              <TabsTrigger value="fund">Tổng quỹ lương</TabsTrigger>
              <TabsTrigger value="average">Lương trung bình</TabsTrigger>
            </TabsList>

            <TabsContent value="fund" className="space-y-3">
              {loading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Đang tải biểu đồ...</p>
              ) : byDepartment.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Chưa có dữ liệu thống kê.
                </p>
              ) : (
                byDepartment.map((d) => {
                  const pct = Math.round((d.tong_quy_luong / maxFund) * 100);
                  return (
                    <div key={d.ma_phong_ban} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {d.ten_phong_ban}{' '}
                          <span className="text-xs text-muted-foreground">
                            ({d.so_nhan_vien} NV · {d.so_ky_luong} kỳ)
                          </span>
                        </span>
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(d.tong_quy_luong)}
                        </span>
                      </div>
                      <Progress value={pct} />
                    </div>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="average" className="space-y-3">
              {byDepartment.map((d) => {
                const pct = Math.round((d.luong_trung_binh / maxAvg) * 100);
                return (
                  <div key={d.ma_phong_ban} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{d.ten_phong_ban}</span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(d.luong_trung_binh)}
                      </span>
                    </div>
                    <Progress value={pct} />
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Bảng chi tiết sp_thong_ke_luong */}
      <Card className="py-0">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="px-4">Mã PB</TableHead>
              <TableHead className="px-4">Tên phòng ban</TableHead>
              <TableHead className="px-4 text-right">Số nhân viên</TableHead>
              <TableHead className="px-4 text-right">Số kỳ lương</TableHead>
              <TableHead className="px-4 text-right">Tổng quỹ lương</TableHead>
              <TableHead className="px-4 text-right">Lương trung bình</TableHead>
              <TableHead className="px-4 text-right">Cao nhất</TableHead>
              <TableHead className="px-4 text-right">Thấp nhất</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Đang tổng hợp báo cáo thống kê...
                </TableCell>
              </TableRow>
            ) : byDepartment.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Không có dữ liệu thống kê cho bộ lọc hiện tại.
                </TableCell>
              </TableRow>
            ) : (
              byDepartment.map((r) => (
                <TableRow key={r.ma_phong_ban}>
                  <TableCell className="px-4 font-mono text-xs font-semibold">
                    {r.ma_phong_ban}
                  </TableCell>
                  <TableCell className="px-4 font-medium">{r.ten_phong_ban}</TableCell>
                  <TableCell className="px-4 text-right tabular-nums">{r.so_nhan_vien}</TableCell>
                  <TableCell className="px-4 text-right tabular-nums">{r.so_ky_luong}</TableCell>
                  <TableCell className="px-4 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(r.tong_quy_luong)}
                  </TableCell>
                  <TableCell className="px-4 text-right tabular-nums">
                    {formatCurrency(r.luong_trung_binh)}
                  </TableCell>
                  <TableCell className="px-4 text-right tabular-nums">
                    {formatCurrency(r.luong_cao_nhat)}
                  </TableCell>
                  <TableCell className="px-4 text-right tabular-nums">
                    {formatCurrency(r.luong_thap_nhat)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {byDepartment.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="px-4 font-semibold">
                  Tổng cộng toàn báo cáo
                </TableCell>
                <TableCell className="px-4 text-right font-semibold tabular-nums">
                  {totalEmployeesTable}
                </TableCell>
                <TableCell className="px-4 text-right font-semibold tabular-nums">
                  {totalPeriodsTable}
                </TableCell>
                <TableCell className="px-4 text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(totalFundTable)}
                </TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </Card>
    </div>
  );
}
