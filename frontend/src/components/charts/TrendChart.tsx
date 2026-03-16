import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';

interface TrendPoint {
  period: string;
  averageScore: number;
  studentsEvaluated: number;
}

interface TrendChartProps {
  data: TrendPoint[];
  height?: number;
}

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
  boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2.5 min-w-[150px]">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold text-foreground">
            {p.dataKey === 'averageScore' ? `${p.value?.toFixed(1)}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const TrendChart: React.FC<TrendChartProps> = ({ data, height = 260 }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
        Sin datos de tendencias para el período seleccionado
      </div>
    );
  }

  // Mostrar últimos 6 por defecto en el brush, el resto se navega
  const defaultEnd = data.length - 1;
  const defaultStart = Math.max(0, defaultEnd - 5);

  return (
    <div className="trend-chart-wrapper">
      <p className="text-[10px] text-muted-foreground/60 text-right mb-1 pr-1">
        Arrastrá las handles del selector para hacer zoom · Mové la barra para navegar
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="gradScore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradStudents" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />

          <XAxis
            dataKey="period"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="score"
            orientation="right"
            domain={[0, 100]}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            yAxisId="students"
            orientation="left"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            formatter={(value) => (
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>{value}</span>
            )}
          />

          <Area
            yAxisId="score"
            type="monotone"
            dataKey="averageScore"
            name="Promedio %"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#gradScore)"
            dot={{ fill: '#3b82f6', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          <Area
            yAxisId="students"
            type="monotone"
            dataKey="studentsEvaluated"
            name="Estudiantes"
            stroke="#10b981"
            strokeWidth={2}
            strokeDasharray="5 3"
            fill="url(#gradStudents)"
            dot={{ fill: '#10b981', r: 2.5, strokeWidth: 0 }}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />

          {/* Brush — selector de rango arrastrable */}
          <Brush
            dataKey="period"
            height={28}
            startIndex={defaultStart}
            endIndex={defaultEnd}
            stroke="hsl(var(--border))"
            fill="hsl(var(--card))"
            travellerWidth={6}
            tickFormatter={(v) => v}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;
