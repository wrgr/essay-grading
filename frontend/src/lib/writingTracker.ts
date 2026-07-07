// Writing-process tracker — TypeScript port of V5's WritingTracker (static/index.js).
// Captures per-turn behavioural metrics (typing speed, deletions, pauses, pastes) and,
// when onInput is wired (FR mode), a content-aware process_log: revision events,
// periodic full-text snapshots, located pauses and paste spans.
//
// This capture is enabled for testing — review data-handling and disclosure
// requirements (fields marked SENSITIVE_TESTING_ONLY) before any non-testing
// deployment.

// TUNABLE — revision sensitivity, adjust after testing
const REVISION_MIN_CHARS = 8;
const REVISION_MIN_LOOKBACK = 15;

// TUNABLE — snapshot cadence (finer = closer replay to actual typing)
const SNAPSHOT_INTERVAL_S = 1.5;
const SNAPSHOT_INTERVAL_CHARS = 40;

// TUNABLE — what counts as a significant pause
const PAUSE_THRESHOLD_S = 4;

// TUNABLE — payload caps
const MAX_REVISION_EVENTS = 40;
const MAX_SNAPSHOTS = 500;
const MAX_PAUSE_EVENTS = 30;
const MAX_PASTE_EVENTS = 20;
const MAX_REMOVED_TEXT_CHARS = 300;

interface KeyEvent {
  type: 'key' | 'delete' | 'paste';
  t: number;
}

interface RevisionEvent {
  timestamp_s: number;
  char_position: number;
  removed_text: string; // SENSITIVE_TESTING_ONLY
  inserted_text: string;
  context_before: string;
}

interface Snapshot {
  timestamp_s: number;
  text: string; // SENSITIVE_TESTING_ONLY
}

interface PauseEvent {
  timestamp_s: number;
  duration_s: number;
  char_position: number;
  preceding_context: string;
}

interface PasteEvent {
  timestamp_s: number;
  char_position: number;
  paste_length: number;
}

export interface ProcessLog {
  revision_events: RevisionEvent[];
  snapshots: Snapshot[];
  pause_events: PauseEvent[];
  paste_events: PasteEvent[];
  closing_nudge_used?: boolean;
}

export interface WritingMetrics {
  wpm: number | null;
  latency_s: number | null;
  deletion_count: number;
  revision_ratio: number;
  paste_count: number;
  pause_count: number;
  max_pause_s: number;
  total_time_s: number | null;
  process_log?: ProcessLog;
}

// Keep the `max` most informative entries (by scoreFn) but preserve chronological order.
function capByScore<T>(arr: T[], max: number, scoreFn: (item: T) => number): T[] {
  if (arr.length <= max) return arr;
  const indexed = arr.map((item, i) => ({ item, i, score: scoreFn(item) }));
  indexed.sort((a, b) => b.score - a.score);
  const kept = indexed.slice(0, max);
  kept.sort((a, b) => a.i - b.i);
  return kept.map((k) => k.item);
}

// Keep first, last, and an evenly-spaced sample of the middle.
function capSnapshots(snaps: Snapshot[], max: number): Snapshot[] {
  if (snaps.length <= max) return snaps;
  const first = snaps[0];
  const last = snaps[snaps.length - 1];
  const middle = snaps.slice(1, -1);
  const slots = max - 2;
  if (slots <= 0) return [first, last];
  const step = middle.length / slots;
  const sampled: Snapshot[] = [];
  for (let i = 0; i < slots; i++) {
    sampled.push(middle[Math.min(middle.length - 1, Math.floor(i * step))]);
  }
  return [first, ...sampled, last];
}

export class WritingTracker {
  private events: KeyEvent[] = [];
  private startTime = Date.now();
  private firstKeyTime: number | null = null;

  private revisionEvents: RevisionEvent[] = [];
  private snapshots: Snapshot[] = [];
  private pauseEvents: PauseEvent[] = [];
  private pasteEvents: PasteEvent[] = [];
  private pendingPaste: { t: number; pos: number; length: number } | null = null;
  private lastText = '';
  private lastPos = 0;
  private lastEventTime: number | null = null;
  private charsSinceSnapshot = 0;
  private lastSnapshotTime = 0;
  private captureActive = false;

  reset(): void {
    this.events = [];
    this.startTime = Date.now();
    this.firstKeyTime = null;
    this.revisionEvents = [];
    this.snapshots = [];
    this.pauseEvents = [];
    this.pasteEvents = [];
    this.pendingPaste = null;
    this.lastText = '';
    this.lastPos = 0;
    this.lastEventTime = null;
    this.charsSinceSnapshot = 0;
    this.lastSnapshotTime = 0;
    this.captureActive = false;
  }

  onKey(e: React.KeyboardEvent | KeyboardEvent): void {
    const now = Date.now();
    if (this.firstKeyTime === null) this.firstKeyTime = now;
    const type = e.key === 'Backspace' || e.key === 'Delete' ? 'delete' : 'key';
    this.events.push({ type, t: now });
  }

  // caretPos: selectionStart of the field *before* the paste lands
  onPaste(e: React.ClipboardEvent | ClipboardEvent, caretPos: number): void {
    const now = Date.now();
    if (this.firstKeyTime === null) this.firstKeyTime = now;
    this.events.push({ type: 'paste', t: now });
    let length = 0;
    try {
      length = e.clipboardData?.getData('text').length ?? 0;
    } catch {
      /* clipboard unreadable */
    }
    this.pendingPaste = { t: now, pos: caretPos, length };
  }

  // Called on every 'input' event of the FR textarea with the current value + caret.
  onInput(text: string, caretPos: number): void {
    const now = Date.now();
    if (this.firstKeyTime === null) this.firstKeyTime = now;
    const nowS = +((now - this.startTime) / 1000).toFixed(1);
    this.captureActive = true;

    this.recordPause(now);

    if (this.pendingPaste) {
      const p = this.pendingPaste;
      this.pasteEvents.push({
        timestamp_s: +((p.t - this.startTime) / 1000).toFixed(1),
        char_position: p.pos,
        paste_length: p.length,
      });
      this.pendingPaste = null;
    } else {
      this.recordRevision(this.lastText, text, nowS);
    }

    this.maybeSnapshot(text, now, nowS);

    this.lastText = text;
    this.lastPos = caretPos;
    this.lastEventTime = now;
  }

  private recordPause(now: number): void {
    if (this.lastEventTime === null) return;
    const gapMs = now - this.lastEventTime;
    if (gapMs <= PAUSE_THRESHOLD_S * 1000) return;
    const pos = this.lastPos;
    this.pauseEvents.push({
      timestamp_s: +((this.lastEventTime - this.startTime) / 1000).toFixed(1),
      duration_s: +(gapMs / 1000).toFixed(1),
      char_position: pos,
      preceding_context: this.lastText.slice(Math.max(0, pos - 80), pos),
    });
  }

  // An edit to already-committed text — not simple forward typing, and not backspacing
  // only the last few characters of the current word.
  private recordRevision(oldText: string, newText: string, nowS: number): void {
    let prefixLen = 0;
    const maxPrefix = Math.min(oldText.length, newText.length);
    while (prefixLen < maxPrefix && oldText[prefixLen] === newText[prefixLen]) prefixLen++;

    let suffixLen = 0;
    const maxSuffix = Math.min(oldText.length, newText.length) - prefixLen;
    while (
      suffixLen < maxSuffix &&
      oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
    ) {
      suffixLen++;
    }

    const removed = oldText.slice(prefixLen, oldText.length - suffixLen);
    const inserted = newText.slice(prefixLen, newText.length - suffixLen);
    if (!removed && !inserted) return;

    const lookback = oldText.length - prefixLen;
    if (removed.length < REVISION_MIN_CHARS && lookback < REVISION_MIN_LOOKBACK) return;

    this.revisionEvents.push({
      timestamp_s: nowS,
      char_position: prefixLen,
      removed_text: removed.slice(0, MAX_REMOVED_TEXT_CHARS),
      inserted_text: inserted.slice(0, MAX_REMOVED_TEXT_CHARS),
      context_before: oldText.slice(Math.max(0, prefixLen - 80), prefixLen),
    });
  }

  private maybeSnapshot(text: string, now: number, nowS: number): void {
    const charsDelta = text.length - this.lastText.length;
    if (charsDelta > 0) this.charsSinceSnapshot += charsDelta;
    const elapsed = now - this.lastSnapshotTime;
    if (
      this.snapshots.length === 0 ||
      elapsed >= SNAPSHOT_INTERVAL_S * 1000 ||
      this.charsSinceSnapshot >= SNAPSHOT_INTERVAL_CHARS
    ) {
      this.snapshots.push({ timestamp_s: nowS, text });
      this.lastSnapshotTime = now;
      this.charsSinceSnapshot = 0;
    }
  }

  collect(finalText: string): WritingMetrics {
    const now = Date.now();
    const words = finalText.trim() ? finalText.trim().split(/\s+/).length : 0;
    const keys = this.events.filter((e) => e.type === 'key').length;
    const dels = this.events.filter((e) => e.type === 'delete').length;
    const pastes = this.events.filter((e) => e.type === 'paste').length;

    // Active typing duration: inter-keystroke gaps ≤ 3 s; longer gaps are pauses
    const PAUSE_MS = 3000;
    let activeDuration = 0;
    let pauseCount = 0;
    let maxPauseMs = 0;
    for (let i = 1; i < this.events.length; i++) {
      const gap = this.events[i].t - this.events[i - 1].t;
      if (gap > PAUSE_MS) {
        pauseCount++;
        if (gap > maxPauseMs) maxPauseMs = gap;
      } else {
        activeDuration += gap;
      }
    }

    const activeMin = activeDuration / 60000;
    const wpm = activeMin > 0 && words > 0 ? Math.round(words / activeMin) : null;
    const totalKeys = keys + dels;
    const latencyS =
      this.firstKeyTime !== null ? +((this.firstKeyTime - this.startTime) / 1000).toFixed(1) : null;
    const totalTimeS =
      this.firstKeyTime !== null ? +((now - this.firstKeyTime) / 1000).toFixed(1) : null;

    const result: WritingMetrics = {
      wpm,
      latency_s: latencyS,
      deletion_count: dels,
      revision_ratio: totalKeys > 0 ? +(dels / totalKeys).toFixed(3) : 0,
      paste_count: pastes,
      pause_count: pauseCount,
      max_pause_s: maxPauseMs > 0 ? +(maxPauseMs / 1000).toFixed(1) : 0,
      total_time_s: totalTimeS,
    };

    // process_log only when onInput() was wired up (FR mode).
    if (this.captureActive) {
      const finalNowS = +((now - this.startTime) / 1000).toFixed(1);
      if (!this.snapshots.length || this.snapshots[this.snapshots.length - 1].text !== finalText) {
        this.snapshots.push({ timestamp_s: finalNowS, text: finalText });
      }
      result.process_log = {
        revision_events: capByScore(this.revisionEvents, MAX_REVISION_EVENTS, (r) =>
          Math.max(r.removed_text.length, r.inserted_text.length),
        ),
        snapshots: capSnapshots(this.snapshots, MAX_SNAPSHOTS),
        pause_events: capByScore(this.pauseEvents, MAX_PAUSE_EVENTS, (p) => p.duration_s),
        paste_events: capByScore(this.pasteEvents, MAX_PASTE_EVENTS, (p) => p.paste_length),
      };
    }

    return result;
  }
}
