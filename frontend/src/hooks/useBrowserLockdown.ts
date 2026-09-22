import { examService } from '@/services/examService';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

/**
 * Soft browser lockdown for proctored exams (CBA students, 15-18, school
 * computers). This is deterrence + proctor visibility, NOT hard prevention —
 * a determined student with OS-level access can always defeat a browser-only
 * lockdown, so the goal is to make casual cheating annoying and visible to
 * the supervisor, not to build an unbreakable sandbox.
 *
 * Detects: fullscreen exit, tab switch (visibilitychange), window blur,
 * blocked shortcuts (F12, devtools combos, view-source/print/save), the
 * right-click context menu, and pasting into answer fields. Each accepted
 * infraction is reported to exam-service (fire-and-forget) and surfaces as a
 * toast warning; after 5 infractions a stronger persistent-style warning is
 * shown once. The proctor decides what to do — this hook never auto-submits
 * or auto-kicks.
 */

export type LockdownInfractionType =
  | 'fullscreen_exit'
  | 'tab_hidden'
  | 'window_blur'
  | 'blocked_shortcut'
  | 'context_menu'
  | 'paste_blocked';

interface UseBrowserLockdownOptions {
  /** Only arm the listeners when the session has lockdown on AND the
   * attempt is actually in progress. Everything is a no-op otherwise. */
  enabled: boolean;
  sessionId: string | null;
}

interface UseBrowserLockdownResult {
  infractionCount: number;
  /** True right after the candidate exits fullscreen — render a blocking
   * overlay with a button that calls `reenterFullscreen` (that click is a
   * fresh user gesture, which fullscreen APIs require). */
  showFullscreenPrompt: boolean;
  reenterFullscreen: () => void;
}

// Cross-tab-switch cooldown: a single Alt-Tab / tab switch usually fires
// both `blur` and `visibilitychange` within milliseconds of each other —
// this collapses them into a single infraction.
const AWAY_EVENT_COOLDOWN_MS = 3000;
// Skip counting a `blur` if it happens within this window of a recording
// having started — some browsers/OS combinations flicker window focus when
// the mic permission prompt appears or recording begins.
const RECORDING_BLUR_GRACE_MS = 1000;
// Per-type dedupe for high-frequency events (a held-down blocked key repeats
// `keydown` many times per second).
const PER_TYPE_THROTTLE_MS = 500;
const STRONG_WARNING_THRESHOLD = 5;

function isFullscreenActive(): boolean {
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).msFullscreenElement
  );
}

function requestElementFullscreen(el: HTMLElement): Promise<void> | undefined {
  const req =
    el.requestFullscreen ||
    (el as any).webkitRequestFullscreen ||
    (el as any).msRequestFullscreen;
  return req ? req.call(el) : undefined;
}

export function useBrowserLockdown({
  enabled,
  sessionId,
}: UseBrowserLockdownOptions): UseBrowserLockdownResult {
  const [infractionCount, setInfractionCount] = useState(0);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);

  const enabledRef = useRef(enabled);
  const sessionIdRef = useRef(sessionId);
  const countRef = useRef(0);
  const lastAwayEventRef = useRef(0);
  const lastTypeEventRef = useRef<Record<string, number>>({});
  const recordingStartedAtRef = useRef(0);
  const wasFullscreenRef = useRef(false);
  const strongWarningShownRef = useRef(false);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  const reportInfraction = useCallback((type: LockdownInfractionType, message: string) => {
    countRef.current += 1;
    const count = countRef.current;
    setInfractionCount(count);

    if (count >= STRONG_WARNING_THRESHOLD && !strongWarningShownRef.current) {
      strongWarningShownRef.current = true;
      toast.error('Se detectaron múltiples infracciones. El supervisor ha sido notificado.', {
        duration: 10000,
      });
    } else {
      toast.warning(message, { duration: 4000 });
    }

    const sid = sessionIdRef.current;
    if (sid) {
      examService
        .postInfraction(sid, type, new Date().toISOString())
        .catch(() => { /* fire-and-forget — offline/errors are not retried */ });
    }
  }, []);

  const throttledReport = useCallback((type: LockdownInfractionType, message: string) => {
    if (!enabledRef.current) return;
    const now = Date.now();
    const last = lastTypeEventRef.current[type] || 0;
    if (now - last < PER_TYPE_THROTTLE_MS) return;
    lastTypeEventRef.current[type] = now;
    reportInfraction(type, message);
  }, [reportInfraction]);

  // Shared 3s cooldown across blur + tab-hidden so one tab switch counts once.
  const registerAwayEvent = useCallback((type: LockdownInfractionType, message: string) => {
    if (!enabledRef.current) return;
    const now = Date.now();
    if (now - lastAwayEventRef.current < AWAY_EVENT_COOLDOWN_MS) return;
    lastAwayEventRef.current = now;
    reportInfraction(type, message);
  }, [reportInfraction]);

  const reenterFullscreen = useCallback(() => {
    const result = requestElementFullscreen(document.documentElement);

    // Degrade gracefully instead of trapping the student behind the overlay
    // forever. Two cases land here: the Fullscreen API isn't available at
    // all on this browser/element (`result` undefined), or the request was
    // rejected (unsupported context, or the browser/OS denied it). Either
    // way there's no working retry to offer — and we deliberately don't
    // tell the student to "press F11": that's the browser's own manual
    // fullscreen toggle, which the Fullscreen API can't detect or verify,
    // so guidance around it would be unverifiable and misleading. Instead:
    // record it as an infraction (the proctor sees it and can follow up)
    // and let the exam continue outside fullscreen — a small integrity gap
    // is preferable to a student being unable to take the exam at all.
    const degradeGracefully = () => {
      toast.error(
        'No se pudo activar la pantalla completa. El examen continuará sin ella; esto queda registrado para el supervisor.',
        { duration: 6000 }
      );
      throttledReport('fullscreen_exit', 'No se pudo activar la pantalla completa.');
      setShowFullscreenPrompt(false);
    };

    if (!result) {
      degradeGracefully();
      return;
    }

    result
      .then(() => setShowFullscreenPrompt(false))
      .catch(degradeGracefully);
  }, [throttledReport]);

  useEffect(() => {
    if (!enabled) {
      setShowFullscreenPrompt(false);
      return;
    }

    const startedFullscreen = isFullscreenActive();
    wasFullscreenRef.current = startedFullscreen;

    // Lockdown can arm while the page is already NOT in fullscreen — a
    // reload/F5 (browsers drop fullscreen on navigation), an auto-started
    // session with no user gesture yet, or a deep link straight into the
    // runner. Relying only on the true→false `fullscreenchange` transition
    // below misses all of these: nothing ever transitions, so the blocking
    // overlay never shows and the student can sit outside fullscreen
    // indefinitely. Show it immediately in that case instead — the button
    // inside it is itself the user gesture fullscreen APIs require. This is
    // the initial state, not an exit, so it does NOT count as an infraction.
    if (!startedFullscreen) {
      setShowFullscreenPrompt(true);
    }

    const handleFullscreenChange = () => {
      const isFs = isFullscreenActive();
      if (wasFullscreenRef.current && !isFs) {
        throttledReport('fullscreen_exit', 'Saliste de pantalla completa. El examen requiere pantalla completa.');
        setShowFullscreenPrompt(true);
      } else if (isFs) {
        setShowFullscreenPrompt(false);
      }
      wasFullscreenRef.current = isFs;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        registerAwayEvent('tab_hidden', 'Cambiaste de pestaña. Esto queda registrado.');
      }
    };

    const handleBlur = () => {
      if (Date.now() - recordingStartedAtRef.current < RECORDING_BLUR_GRACE_MS) return;
      registerAwayEvent('window_blur', 'Saliste de la ventana del examen. Esto queda registrado.');
    };

    const handleRecordingStart = () => {
      recordingStartedAtRef.current = Date.now();
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      throttledReport('context_menu', 'El menú contextual está deshabilitado durante el examen.');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      throttledReport('paste_blocked', 'Pegar contenido en las respuestas está deshabilitado.');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      let blocked = false;

      if (e.key === 'F12') blocked = true;
      else if (ctrlOrCmd && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) blocked = true;
      else if (ctrlOrCmd && ['u', 'p', 's'].includes(e.key.toLowerCase())) blocked = true;

      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        throttledReport('blocked_shortcut', 'Ese atajo de teclado está deshabilitado durante el examen.');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('lockdown:recording-start', handleRecordingStart);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange as EventListener);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('lockdown:recording-start', handleRecordingStart);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, registerAwayEvent, throttledReport]);

  // Reset local counters when disabled (e.g. exam finished/kicked) so a
  // stale count never leaks into a later session on the same page instance.
  useEffect(() => {
    if (!enabled) {
      countRef.current = 0;
      setInfractionCount(0);
      strongWarningShownRef.current = false;
      lastAwayEventRef.current = 0;
      lastTypeEventRef.current = {};
    }
  }, [enabled]);

  return { infractionCount, showFullscreenPrompt, reenterFullscreen };
}
