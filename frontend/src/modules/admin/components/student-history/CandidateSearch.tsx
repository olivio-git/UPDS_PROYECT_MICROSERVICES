import { UserAvatar } from '@/components/atoms/UserAvatar';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { Candidate } from '@/services/candidateService';
import { Loader2, Search } from 'lucide-react';
import { useState, type FocusEvent } from 'react';
import { MIN_SEARCH_LENGTH, useCandidateSearch } from '../../hooks/useStudentHistoryQueries';

const MAX_RESULTS = 7;
const DEBOUNCE_MS = 350;

const candidateName = (c: Candidate) => `${c.personalInfo.firstName} ${c.personalInfo.lastName}`;

export function CandidateSearch({ onSelect }: { onSelect: (candidate: Candidate) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  // Enter / the search button skip the debounce for the current text only;
  // typing again falls back to the debounced value.
  const [forced, setForced] = useState<string | null>(null);
  const debounced = useDebouncedValue(query, DEBOUNCE_MS);
  const term = forced === query ? query : debounced;

  const { data: results = [], isFetching } = useCandidateSearch(term);
  const searchable = term.trim().length >= MIN_SEARCH_LENGTH;

  const searchNow = () => {
    setForced(query);
    setOpen(true);
  };

  // Close when focus leaves the whole widget, but not when moving into the list.
  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  };

  return (
    <div className="relative" onBlur={handleBlur}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Nombre o email del estudiante..."
            aria-label="Buscar estudiante"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === 'Enter') searchNow(); if (e.key === 'Escape') setOpen(false); }}
            className="pl-8 h-8 text-sm"
            autoComplete="off"
          />
        </div>
        <Button
          onClick={searchNow}
          disabled={isFetching || query.trim().length < MIN_SEARCH_LENGTH}
          size="sm"
          aria-label="Buscar"
          className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {open && searchable && !isFetching && (
        <div
          // Keep focus in the input while clicking a result. Safari does not
          // focus buttons on click, so without this the input's blur would
          // close the list before the click reached the button.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden"
        >
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center px-4 py-2.5">Sin resultados</p>
          ) : (
            results.slice(0, MAX_RESULTS).map((c) => (
              <button
                key={c._id}
                type="button"
                onClick={() => { setOpen(false); setQuery(''); onSelect(c); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/60 focus:bg-muted/60 focus:outline-none transition-colors text-left border-b border-border/40 last:border-0"
              >
                <UserAvatar avatarUrl={c.avatarUrl} firstName={c.personalInfo.firstName} lastName={c.personalInfo.lastName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{candidateName(c)}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.personalInfo.email}</p>
                </div>
                <span className="text-xs bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded-full shrink-0">
                  {c.academicInfo.currentLevel}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
