import { useState } from 'react';
import { Headphones } from 'lucide-react';
import { AudioPlayer } from '@/components/audio';

interface ListeningAudioProps {
  src: string;
  /** Plays allowed for this recording; 0 or undefined = unlimited (editor previews). */
  maxPlays?: number;
  /** Plays already used, when the count is kept with the answer (survives a reload). */
  playsUsed?: number;
  onPlaysChange?: (plays: number) => void;
}

/**
 * Listening recording with a play limit, as in standard listening papers
 * (each recording heard twice). A "play" starts when the audio begins from
 * the start; pausing and resuming within the same play does not count. While
 * a limit applies, seeking and speed changes are off, so a play cannot be
 * stretched into several.
 */
export function ListeningAudio({ src, maxPlays, playsUsed, onPlaysChange }: ListeningAudioProps) {
  const [localPlays, setLocalPlays] = useState(0);
  const plays = playsUsed ?? localPlays;
  const [listening, setListening] = useState(false);
  const limited = typeof maxPlays === 'number' && maxPlays > 0;
  const remaining = limited ? Math.max(0, maxPlays - plays) : Infinity;
  const exhausted = limited && remaining === 0 && !listening;

  const handlePlay = () => {
    if (listening) return; // resuming the same play
    setListening(true);
    const next = plays + 1;
    setLocalPlays(next);
    onPlaysChange?.(next);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3">
      <span className="flex items-center justify-between gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Headphones className="size-3.5" />
          Audio
        </span>
        {limited && (
          <span data-testid="listening-plays" className="tabular-nums">
            {exhausted
              ? `Ya lo escuchaste ${maxPlays} ${maxPlays === 1 ? 'vez' : 'veces'}`
              : `Puedes escucharlo ${remaining} ${remaining === 1 ? 'vez' : 'veces'} más`}
          </span>
        )}
      </span>
      {exhausted ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-muted-foreground">
          Ya no quedan reproducciones para este audio. Responde con lo que recuerdes.
        </p>
      ) : (
        <AudioPlayer
          src={src}
          variant="compact"
          title="Audio de comprensión"
          showControls={limited ? { volume: true, speed: false, seek: false, time: true } : { volume: true, speed: true, seek: true, time: true }}
          onPlay={handlePlay}
          onEnd={() => setListening(false)}
        />
      )}
    </div>
  );
}
