import { Button } from '@/components/atoms/button';
import { Calendar } from '@/components/atoms/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import { MainLayout } from '@/components/layout';
import { auditLogService, type AuditFilters, type AuditLogEntry } from '@/services/auditLogService';
import { cn } from '@/lib/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  RefreshCw,
  Shield,
  Loader2,
  CheckCircle,
  XCircle,
  Search,
  CalendarIcon,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';

const SERVICE_COLORS: Record<string, string> = {
  'user-management': 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  'exam-service':    'bg-purple-500/10 border-purple-500/20 text-purple-400',
  'auth-service':    'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  'auth':            'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
};

const ROLE_COLORS: Record<string, string> = {
  admin:   'bg-red-500/10 text-red-400 border-red-500/20',
  teacher: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  student: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  system:  'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

function todayStr() {
  return new Date().toISOString().split('T')[0]!;
}

function formatDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString('es-BO', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

function serviceBadge(service: string) {
  const cls = SERVICE_COLORS[service] ?? 'bg-muted/50 border-border text-muted-foreground';
  const label = service.replace(/-service$/, '').replace(/-/g, ' ');
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize whitespace-nowrap', cls)}>
      {label}
    </span>
  );
}

const PAGE_SIZE = 50;

const AuditLogsScreen: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [filters, setFilters] = useState<AuditFilters>({
    dateFrom: todayStr(), dateTo: '', service: '', action: '', actorEmail: '',
  });

  // Estado del rango de fechas para el picker
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: today, to: undefined });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchPage = useCallback(async (p: number, f: AuditFilters, replace: boolean) => {
    const setter = replace ? setLoading : setLoadingMore;
    try {
      setter(true);
      const clean: AuditFilters = Object.fromEntries(
        Object.entries(f).filter(([, v]) => v !== '' && v !== undefined)
      );
      const result = await auditLogService.getAuditLogs({ ...clean, page: p, limit: PAGE_SIZE });
      if (result.success && result.data) {
        const { logs: newLogs, total: t, totalPages } = result.data;
        setLogs(prev => replace ? newLogs : [...prev, ...newLogs]);
        setTotal(t);
        setPage(p);
        setHasMore(p < totalPages);
      } else {
        toast.error('Error cargando logs de auditoría');
      }
    } catch {
      toast.error('Error cargando logs de auditoría');
    } finally {
      setter(false);
    }
  }, []);

  // Carga inicial con filtro de hoy
  useEffect(() => { fetchPage(1, filters, true); }, []);

  // Infinite scroll — IntersectionObserver sobre el sentinel al fondo
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchPage(page + 1, filtersRef.current, false);
        }
      },
      { root: scrollRef.current, threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, page, fetchPage]);

  const handleFilterChange = (key: keyof AuditFilters, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    filtersRef.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPage(1, next, true), 400);
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    const dateFrom = range?.from ? format(range.from, 'yyyy-MM-dd') : '';
    const dateTo = range?.to ? format(range.to, 'yyyy-MM-dd') : '';
    const next = { ...filtersRef.current, dateFrom, dateTo };
    setFilters(next);
    filtersRef.current = next;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPage(1, next, true), 400);
  };

  const handleClear = () => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    setDateRange({ from: t, to: undefined });
    const reset: AuditFilters = { dateFrom: todayStr(), dateTo: '', service: '', action: '', actorEmail: '' };
    setFilters(reset);
    filtersRef.current = reset;
    fetchPage(1, reset, true);
  };

  // Virtualizer sobre la lista acumulada
  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <MainLayout>
      <div className="flex flex-col gap-3 p-4 h-[calc(100vh-4rem)]">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Logs de Auditoría</h1>
              <p className="text-xs text-muted-foreground">Registro de acciones del sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{total} registros</span>
            <Button
              onClick={() => fetchPage(1, filtersRef.current, true)}
              size="sm" variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-card border border-border rounded-lg px-3 py-2 flex flex-wrap items-center gap-2 shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <button className={cn(
                'h-7 flex items-center gap-1.5 px-2 text-xs rounded border border-border bg-muted/60 text-foreground hover:bg-muted transition-colors whitespace-nowrap',
                !dateRange?.from && 'text-muted-foreground'
              )}>
                <CalendarIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'd MMM', { locale: es })}
                      {' — '}
                      {format(dateRange.to, 'd MMM yyyy', { locale: es })}
                    </>
                  ) : (
                    format(dateRange.from, 'd MMM yyyy', { locale: es })
                  )
                ) : (
                  'Rango de fechas'
                )}
                {dateRange?.from && (
                  <span
                    role="button"
                    onClick={e => { e.stopPropagation(); handleDateRangeChange(undefined); }}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={handleDateRangeChange}
                numberOfMonths={2}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <div className="w-px h-5 bg-border shrink-0" />

          <select
            value={filters.service || ''}
            onChange={e => handleFilterChange('service', e.target.value)}
            className="h-7 text-xs bg-muted/60 border border-border rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Todos los servicios</option>
            <option value="user-management">User Management</option>
            <option value="exam-service">Exam Service</option>
            <option value="auth-service">Auth Service</option>
          </select>

          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input
              type="text" placeholder="Acción..." value={filters.action || ''}
              onChange={e => handleFilterChange('action', e.target.value)}
              className="h-7 pl-6 pr-2 text-xs bg-muted/60 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-36"
            />
          </div>

          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input
              type="text" placeholder="Email actor..." value={filters.actorEmail || ''}
              onChange={e => handleFilterChange('actorEmail', e.target.value)}
              className="h-7 pl-6 pr-2 text-xs bg-muted/60 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-40"
            />
          </div>

          <Button
            onClick={handleClear} variant="ghost" size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2 ml-auto"
          >
            Hoy
          </Button>
        </div>

        {/* Tabla virtualizada */}
        <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
          {/* Cabecera fija */}
          <div className="shrink-0 border-b border-border bg-muted/30">
            <table className="w-full text-xs table-fixed">
              <colgroup>
                <col style={{ width: '130px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '200px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '60px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">Fecha</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Servicio</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Acción</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Actor</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">Target</th>
                  <th className="text-left px-3 py-2 text-muted-foreground font-medium">IP</th>
                  <th className="text-center px-3 py-2 text-muted-foreground font-medium">Estado</th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Cuerpo con scroll + virtualización */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Shield className="h-8 w-8 opacity-30" />
              <p className="text-sm">Sin registros para el período seleccionado</p>
            </div>
          ) : (
            <div ref={scrollRef} className="flex-1 overflow-auto">
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                <table className="w-full text-xs table-fixed" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
                  <colgroup>
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '100px' }} />
                    <col style={{ width: '200px' }} />
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '60px' }} />
                  </colgroup>
                  <tbody>
                    {virtualItems.map(vRow => {
                      const log = logs[vRow.index]!;
                      return (
                        <tr
                          key={log._id ?? vRow.index}
                          data-index={vRow.index}
                          ref={virtualizer.measureElement}
                          style={{ transform: `translateY(${vRow.start}px)`, position: 'absolute', width: '100%', display: 'table' }}
                          className="border-b border-border/50 hover:bg-muted/20 transition-colors table-fixed w-full"
                        >
                          <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap font-mono text-[10px]" style={{ width: '130px' }}>
                            {formatDate(log.timestamp)}
                          </td>
                          <td className="px-3 py-2.5" style={{ width: '100px' }}>
                            {serviceBadge(log.service)}
                          </td>
                          <td className="px-3 py-2.5" style={{ width: '200px' }}>
                            <span className="font-mono text-foreground truncate block">{log.action}</span>
                          </td>
                          <td className="px-3 py-2.5" style={{ width: '160px' }}>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-foreground leading-tight truncate">{log.actor.email || '—'}</span>
                              {log.actor.role && (
                                <span className={cn(
                                  'text-[9px] px-1 rounded border w-fit font-medium capitalize',
                                  ROLE_COLORS[log.actor.role] ?? 'bg-muted text-muted-foreground border-border'
                                )}>
                                  {log.actor.role}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5" style={{ width: '180px' }}>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-muted-foreground text-[10px] capitalize">{log.target.type}</span>
                              {log.target.name && (
                                <span className="text-foreground leading-tight truncate" title={log.target.name}>
                                  {log.target.name}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[10px] text-muted-foreground whitespace-nowrap" style={{ width: '110px' }}>
                            {log.actor.ip || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-center" style={{ width: '60px' }}>
                            {log.status === 'success'
                              ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                              : <XCircle className="h-3.5 w-3.5 text-red-400 mx-auto" />
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Sentinel para infinite scroll */}
              <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-t border-border bg-muted/10">
            <span className="text-[10px] text-muted-foreground">
              Mostrando {logs.length} de {total} registros
            </span>
            {hasMore && !loadingMore && (
              <span className="text-[10px] text-muted-foreground">Desplázate para cargar más</span>
            )}
            {!hasMore && logs.length > 0 && (
              <span className="text-[10px] text-muted-foreground">Todos los registros cargados</span>
            )}
          </div>
        </div>

      </div>
    </MainLayout>
  );
};

export default AuditLogsScreen;
