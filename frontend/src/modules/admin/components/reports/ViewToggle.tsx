import { BarChart3, Table2 } from 'lucide-react';
import { SegmentedControl } from './SegmentedControl';

export type ViewMode = 'chart' | 'table';

const OPTIONS = [
  { value: 'chart' as const, label: <BarChart3 className="h-3.5 w-3.5" />, hint: 'Ver gráfico' },
  { value: 'table' as const, label: <Table2 className="h-3.5 w-3.5" />, hint: 'Ver tabla' },
];

export function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (view: ViewMode) => void }) {
  return <SegmentedControl value={view} onChange={onChange} options={OPTIONS} size="icon" />;
}
