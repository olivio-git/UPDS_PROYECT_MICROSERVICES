import { toBrowserMediaUrl } from '@/lib/mediaUrl';
import type { ReviewQuestionData } from './types';

const inferType = (url: string): 'audio' | 'video' | 'image' =>
  /\.(mp3|wav|ogg|m4a|aac|opus)$/i.test(url) ? 'audio'
  : /\.(mp4|webm|mov|avi)$/i.test(url) ? 'video'
  : 'image';

/** The audio, video or image a question presents to the candidate (e.g. a listening track). */
export function QuestionMedia({ data }: { data?: ReviewQuestionData }) {
  if (!data?.mediaUrl) return null;
  const url = toBrowserMediaUrl(data.mediaUrl);
  const type = data.mediaType ?? inferType(url);

  if (type === 'audio') {
    return (
      <div className="bg-muted/40 border border-border rounded-lg p-2">
        <p className="text-xs text-muted-foreground mb-1.5">🔊 Audio</p>
        <audio controls className="w-full h-8 dark:[color-scheme:dark]">
          <source src={url} />
        </audio>
      </div>
    );
  }
  if (type === 'video') {
    return (
      <div className="bg-muted/40 border border-border rounded-lg p-2">
        <p className="text-xs text-muted-foreground mb-1.5">🎬 Video</p>
        <video controls className="w-full rounded max-h-48">
          <source src={url} />
        </video>
      </div>
    );
  }
  return (
    <div className="bg-muted/40 border border-border rounded-lg p-2">
      <img src={url} alt="Imagen de la pregunta" className="max-h-40 rounded object-contain" />
    </div>
  );
}
