import { Download, Plus, Printer, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function PageHeader({
  title,
  description,
  countLabel,
  onRefresh,
  onExportCsv,
  onPrint,
  onAdd,
  addLabel = 'Thêm mới',
}) {
  return (
    <div className="space-y-2">
      <div className="print-only hidden border-b pb-3 mb-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Hệ thống quản lý nhân sự
        </div>
        <h1 className="text-xl font-bold">{title}</h1>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {countLabel && <Badge variant="secondary">{countLabel}</Badge>}
          </div>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <Button type="button" variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="size-3.5" />
              Làm mới
            </Button>
          )}
          {onExportCsv && (
            <Button type="button" variant="outline" size="sm" onClick={onExportCsv}>
              <Download className="size-3.5" />
              Xuất CSV
            </Button>
          )}
          {onPrint && (
            <Button type="button" variant="outline" size="sm" onClick={onPrint}>
              <Printer className="size-3.5" />
              In / PDF
            </Button>
          )}
          {onAdd && (
            <Button type="button" size="sm" onClick={onAdd}>
              <Plus className="size-3.5" />
              {addLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
