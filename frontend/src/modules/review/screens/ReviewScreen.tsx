import { EmptyState } from '@/components/common/EmptyState';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/keel/button';
import { Kbd } from '@/components/keel/kbd';
import { Skeleton } from '@/components/keel/skeleton';
import { Page, PageHeader } from '@/components/layout/PageLayout';
import { cn } from '@/lib/utils';
import { reviewService, type ReviewQueueItem, type ReviewStatus, type SubmitReviewInput } from '@/services/reviewService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { GradingPanel } from '../components/GradingPanel';
import { ReviewQueue } from '../components/ReviewQueue';
import { ReviewWorkspace } from '../components/ReviewWorkspace';
import { itemKey } from '../reviewFormat';

const STATUS_TABS: Array<{ id: ReviewStatus; label: string }> = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'reviewed', label: 'Revisadas' },
];

/**
 * Teacher's correction desk: the queue of open answers on the left, the prompt
 * and the student's answer in the middle, the rubric on the right.
 * J / K move through the queue; Ctrl+Enter saves and opens the next answer.
 */
export default function ReviewScreen() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const queue = useQuery({ queryKey: ['review', 'queue', status], queryFn: () => reviewService.getQueue(status) });
  const pendingCount = useQuery({ queryKey: ['review', 'queue', 'pending'], queryFn: () => reviewService.getQueue('pending') }).data?.length;
  const items = useMemo(() => queue.data ?? [], [queue.data]);

  // Keep a valid selection: the first item when nothing (or something gone) is selected.
  useEffect(() => {
    if (!items.length) return setActiveKey(null);
    if (!activeKey || !items.some((i) => itemKey(i) === activeKey)) setActiveKey(itemKey(items[0]));
  }, [items, activeKey]);

  const index = items.findIndex((i) => itemKey(i) === activeKey);
  const active: ReviewQueueItem | undefined = items[index];

  const task = useQuery({
    queryKey: ['review', 'task', active?.resultId, active?.questionId],
    queryFn: () => reviewService.getTask(active!.resultId, active!.questionId),
    enabled: Boolean(active),
  });

  const go = (delta: number) => {
    if (!items.length) return;
    const next = items[(index + delta + items.length) % items.length];
    setActiveKey(itemKey(next));
  };

  const save = useMutation({
    mutationFn: (input: SubmitReviewInput) => reviewService.submit(active!.resultId, active!.questionId, input),
    onSuccess: () => {
      toast.success(`Calificación guardada · ${active!.studentName}`);
      // Move on before the list refreshes so the next answer appears at once.
      const next = items[index + 1] ?? items[index - 1];
      setActiveKey(next ? itemKey(next) : null);
      queryClient.invalidateQueries({ queryKey: ['review'] });
    },
    onError: () => toast.error('No se pudo guardar la calificación'),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'j') go(1);
      if (e.key === 'k') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <MainLayout>
    <Page>
      <PageHeader
        title="Corrección"
        meta={
          pendingCount ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">{pendingCount}</span>
          ) : null
        }
        description="Respuestas abiertas que esperan tu calificación"
        actions={
          <div className="flex rounded-lg border border-border bg-card p-0.5" role="tablist">
            {STATUS_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={status === t.id}
                onClick={() => {
                  setStatus(t.id);
                  setActiveKey(null);
                }}
                className={cn(
                  'h-7 rounded-md px-3 text-xs font-medium transition-colors',
                  status === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[18rem_minmax(0,1fr)_22rem] lg:grid-rows-[minmax(0,1fr)]">
        {/* Queue */}
        <aside className="hidden min-h-0 border-r border-border lg:block">
          {queue.isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : (
            <ReviewQueue items={items} activeKey={activeKey} onSelect={(i) => setActiveKey(itemKey(i))} />
          )}
        </aside>

        {!queue.isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center lg:col-span-2">
            <EmptyState
              icon={CheckCheck}
              title={status === 'pending' ? 'Todo corregido' : 'Aún no revisaste respuestas'}
              description={status === 'pending' ? 'No quedan respuestas esperando calificación.' : 'Las respuestas que califiques aparecerán aquí.'}
            />
          </div>
        ) : (
          <>
            {/* Workspace */}
            <main className="flex min-h-0 flex-col">
              <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3 lg:px-8">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{active?.studentName ?? ' '}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {active ? `${active.examTitle} · ${active.sessionName}` : ' '}
                  </p>
                </div>
                <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                  <Kbd>K</Kbd>
                  <Kbd>J</Kbd>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {index + 1} de {items.length}
                </span>
                <div className="flex">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Anterior" onClick={() => go(-1)}>
                    <ChevronLeft />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Siguiente" onClick={() => go(1)}>
                    <ChevronRight />
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 lg:px-8">
                {task.data && !task.isFetching ? (
                  <ReviewWorkspace key={activeKey} task={task.data} />
                ) : (
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-40 w-full rounded-xl" />
                  </div>
                )}
              </div>
            </main>

            {/* Grading */}
            <aside className="min-h-0 border-t border-border bg-muted/20 lg:border-t-0 lg:border-l">
              {task.data && !task.isFetching ? (
                <GradingPanel
                  key={activeKey}
                  task={task.data}
                  submitting={save.isPending}
                  onSubmit={(input) => save.mutate(input)}
                  onSkip={() => go(1)}
                />
              ) : (
                <div className="space-y-4 p-5">
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-9 w-full" />
                </div>
              )}
            </aside>
          </>
        )}
      </div>
    </Page>
    </MainLayout>
  );
}
