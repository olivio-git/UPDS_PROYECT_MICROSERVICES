import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

// ─── Data ─────────────────────────────────────────────────────────────────────
const HOURS   = Array.from({ length: 12 }, (_, i) => i + 1);   // 1–12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);   // 0, 5, 10 … 55
const PERIODS = ['AM', 'PM'] as const;
type Period = typeof PERIODS[number];

// ─── Conversion helpers ───────────────────────────────────────────────────────
const to12h = (time: string) => {
  if (!time) return { hour: 12, minute: 0, period: 'AM' as Period };
  const [h, m] = time.split(':').map(Number);
  const period: Period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  const minute = Math.round(m / 5) * 5 % 60;
  return { hour, minute, period };
};

const to24h = (hour: number, minute: number, period: Period): string => {
  let h = hour % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

const formatDisplay = (time: string): string => {
  const { hour, minute, period } = to12h(time);
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
};

// ─── Drum Column ──────────────────────────────────────────────────────────────
const ITEM_H    = 44;
const VISIBLE   = 5;
const COL_H     = ITEM_H * VISIBLE;
const HALF_COL  = COL_H / 2;
const LERP_RATE = 0.22;   // fraction to close gap per frame — always moves toward target, never past it
const VEL_DECAY = 0.76;   // inertia friction during coast phase (before snap)
const VEL_SCALE = 3;      // how many frames ahead to project on release
const FADE_H    = ITEM_H * 1.1;

interface ColumnProps<T> {
  items: T[];
  selected: T;
  onSelect: (v: T) => void;
  format?: (v: T) => string;
  label: string;
}

function Column<T extends string | number>({
  items, selected, onSelect, format, label,
}: ColumnProps<T>) {
  const len = items.length;

  const offsetRef = useRef(items.indexOf(selected) >= 0 ? items.indexOf(selected) : 0);
  const [offset, setOffset] = useState(offsetRef.current);

  const dragRef = useRef({
    active: false,
    startY: 0,
    startOffset: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0,
  });
  const animRef = useRef<number | null>(null);

  const wrap = (idx: number) => ((Math.round(idx) % len) + len) % len;

  const animateTo = (target: number, initVel = 0) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);

    // The item we intend to land on is fixed at call time
    const snapped = Math.round(target);
    let vel = initVel / 60; // items per frame

    const tick = () => {
      let current = offsetRef.current;

      if (Math.abs(vel) > 0.06) {
        // ── Phase 1: coast with inertia, no spring ──────────────────────────
        // Velocity decays and we drift freely. No spring = no bounce.
        vel *= VEL_DECAY;
        current += vel;
      } else {
        // ── Phase 2: lerp snap ──────────────────────────────────────────────
        // Pure lerp: current = current + rate*(snapped-current)
        // Mathematically can NEVER overshoot: the gap halves each frame.
        vel = 0;
        const delta = snapped - current;
        if (Math.abs(delta) < 0.006) {
          offsetRef.current = snapped;
          setOffset(snapped);
          onSelect(items[wrap(snapped)]);
          animRef.current = null;
          return;
        }
        current += delta * LERP_RATE;
      }

      offsetRef.current = current;
      setOffset(current);
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
  };

  // Step up/down one item — for the arrow buttons
  const step = (delta: number) => {
    const target = Math.round(offsetRef.current) + delta;
    animateTo(target);
  };

  useEffect(() => {
    const idx = items.indexOf(selected);
    if (idx < 0) return;
    const cur = Math.round(offsetRef.current);
    const diff = ((idx - cur) % len + len) % len;
    const target = cur + (diff > len / 2 ? diff - len : diff);
    if (Math.abs(target - offsetRef.current) > 0.1) {
      offsetRef.current = target;
      setOffset(target);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, []);

  // ── Pointer handlers ───────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startY: e.clientY,
      startOffset: offsetRef.current,
      lastY: e.clientY,
      lastTime: performance.now(),
      velocity: 0,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dy = e.clientY - d.startY;
    const newOffset = d.startOffset - dy / ITEM_H;
    offsetRef.current = newOffset;
    setOffset(newOffset);

    const now = performance.now();
    const dt = (now - d.lastTime) / 1000;
    if (dt > 0.001) {
      d.velocity = (d.lastY - e.clientY) / ITEM_H / dt;
    }
    d.lastY = e.clientY;
    d.lastTime = now;
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    // Cap velocity to ±8 items/sec to prevent wild overshoots
    const cappedVel = Math.max(-8, Math.min(8, d.velocity));
    const projected = offsetRef.current + cappedVel * VEL_SCALE / 60;
    animateTo(projected, cappedVel);
  };

  // ── Build visible items ────────────────────────────────────────────────────
  const half = Math.floor(VISIBLE / 2);
  const slots = Array.from({ length: VISIBLE + 4 }, (_, i) => i - half - 2);
  const centerIdx = Math.round(offset);

  return (
    <div className="flex flex-col select-none">
      {/* Label */}
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest text-center py-2 border-b border-border">
        {label}
      </div>

      {/* Up arrow */}
      <button
        type="button"
        onClick={() => step(-1)}
        className="flex items-center justify-center py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <ChevronUp className="h-4 w-4" />
      </button>

      {/* Drum wheel */}
      <div
        className="relative overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ height: COL_H }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Centre selector highlight */}
        <div
          className="pointer-events-none absolute inset-x-0 z-10 border-y border-primary/30 bg-primary/8 rounded-sm"
          style={{ top: HALF_COL - ITEM_H / 2, height: ITEM_H }}
        />

        {/* Top & bottom fade — only covers ~1 item at each edge */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-popover to-transparent"
          style={{ height: FADE_H }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-popover to-transparent"
          style={{ height: FADE_H }}
        />

        {/* Items */}
        {slots.map((slotOffset) => {
          const virtualIdx = centerIdx + slotOffset;
          const itemIdx    = wrap(virtualIdx);
          const item       = items[itemIdx];
          const display    = format ? format(item) : String(item).padStart(2, '0');

          const dist    = virtualIdx - offset;
          const absDist = Math.abs(dist);
          // Gentler opacity curve: adjacent items ~75%, 2nd items ~52%
          const opacity = Math.max(0, 1 - absDist * 0.24);
          const scale   = Math.max(0.80, 1 - absDist * 0.07);
          const y       = dist * ITEM_H + HALF_COL - ITEM_H / 2;
          const isCenter = absDist < 0.5;

          return (
            <div
              key={`${slotOffset}`}
              className="absolute inset-x-0 flex items-center justify-center"
              style={{
                height: ITEM_H,
                top: 0,
                transform: `translateY(${y}px) scale(${scale})`,
                opacity,
                willChange: 'transform, opacity',
              }}
            >
              <span className={cn(
                'tabular-nums pointer-events-none transition-none',
                isCenter
                  ? 'text-base font-bold text-foreground'
                  : 'text-sm font-medium text-foreground/65',
              )}>
                {display}
              </span>
            </div>
          );
        })}
      </div>

      {/* Down arrow */}
      <button
        type="button"
        onClick={() => step(1)}
        className="flex items-center justify-center py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── TimePicker ───────────────────────────────────────────────────────────────
interface TimePickerProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function TimePicker({
  value,
  onChange,
  placeholder = 'Seleccionar hora',
  className,
  disabled,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const { hour, minute, period } = to12h(value);
  const update = (h: number, m: number, p: Period) => onChange(to24h(h, m, p));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border transition-colors text-left',
            'bg-muted/50 border-border text-foreground',
            'hover:border-primary/40 focus:outline-none focus:border-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 tabular-nums">
            {value ? formatDisplay(value) : placeholder}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-0 border-border bg-popover shadow-xl w-auto"
      >
        {/* Preview */}
        <div className="px-4 py-2.5 border-b border-border bg-muted/30">
          <span className="text-xl font-bold tabular-nums text-foreground tracking-tight">
            {value ? formatDisplay(value) : '—'}
          </span>
        </div>

        {/* 3 drum columns */}
        <div className="flex divide-x divide-border">
          <div className="w-16">
            <Column
              label="Hr"
              items={HOURS}
              selected={hour}
              format={(v) => String(v)}
              onSelect={(h) => update(h, minute, period)}
            />
          </div>
          <div className="w-16">
            <Column
              label="Min"
              items={MINUTES}
              selected={minute}
              format={(v) => String(v).padStart(2, '0')}
              onSelect={(m) => update(hour, m, period)}
            />
          </div>
          <div className="w-16">
            <Column
              label="—"
              items={[...PERIODS]}
              selected={period}
              format={(v) => v}
              onSelect={(p) => update(hour, minute, p)}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
