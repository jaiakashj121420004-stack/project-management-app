/**
 * useMediaRecorder — wraps the browser MediaRecorder API for the canvas media
 * recorder (Pro P3.5). Handles the mic/camera permission flow, ticks a duration,
 * tracks the recorded byte size so the UI can show a meter against the per-type
 * cap, and auto-stops if the clip would exceed the cap. On stop it assembles the
 * chunks into a `File` (webm/opus for audio, webm/vp9 for video where supported)
 * ready for `uploadCanvasMedia`.
 *
 * Lives behind the lazily-imported AddMediaModal, so none of this code (or the
 * getUserMedia prompt machinery) ships in the main bundle.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { MEDIA_CAPS } from '@/lib/proFeatures';

export type RecorderStatus =
  | 'idle' // nothing started
  | 'requesting' // awaiting getUserMedia permission
  | 'recording'
  | 'stopped' // have a finished clip (mediaFile set)
  | 'denied' // permission refused
  | 'unsupported' // no MediaRecorder / getUserMedia
  | 'error';

/** Pick the best-supported mime type for a kind, with graceful fallbacks. */
function pickMimeType(kind: 'audio' | 'video'): { recorderType: string; fileType: string } {
  const candidates =
    kind === 'audio'
      ? ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  const supported =
    typeof MediaRecorder !== 'undefined'
      ? candidates.find((t) => MediaRecorder.isTypeSupported(t))
      : undefined;
  const recorderType = supported ?? '';
  // The File's type must match the MEDIA_CAPS allow-list, which lists base mimes
  // (no ;codecs=…). Strip the codec parameter for the File type.
  const base = (recorderType || (kind === 'audio' ? 'audio/webm' : 'video/webm')).split(';')[0]!;
  return { recorderType, fileType: base };
}

function extensionFor(fileType: string): string {
  if (fileType.includes('mp4')) return 'mp4';
  if (fileType.includes('webm')) return 'webm';
  if (fileType.includes('ogg')) return 'ogg';
  return 'bin';
}

export interface UseMediaRecorder {
  status: RecorderStatus;
  /** The live capture stream, for a <video>/level preview while recording. */
  stream: MediaStream | null;
  durationMs: number;
  recordedBytes: number;
  /** The cap for the active kind, so the UI can render a size meter. */
  capBytes: number;
  /** A user-facing error/permission message, when status is denied/error. */
  message: string | null;
  /** The finished clip (status === 'stopped'), ready to upload. */
  mediaFile: File | null;
  start: () => void;
  stop: () => void;
  /** Discard the current clip / stream and return to idle. */
  reset: () => void;
}

export function useMediaRecorder(kind: 'audio' | 'video'): UseMediaRecorder {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [recordedBytes, setRecordedBytes] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileTypeRef = useRef<string>('');
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const bytesRef = useRef(0);

  const capBytes = MEDIA_CAPS[kind].maxBytes;

  const stopTracks = useCallback((s: MediaStream | null) => {
    s?.getTracks().forEach((t) => t.stop());
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    clearTimer();
  }, [clearTimer]);

  const start = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      setMessage('Recording isn’t supported in this browser. Try uploading a file or pasting a link.');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setStatus('unsupported');
      setMessage('Recording isn’t supported in this browser. Try uploading a file or pasting a link.');
      return;
    }

    setStatus('requesting');
    setMessage(null);
    setMediaFile(null);
    setDurationMs(0);
    setRecordedBytes(0);
    bytesRef.current = 0;
    chunksRef.current = [];

    // Captured once per record session; `kind` is fixed for this start() closure.
    const cap = MEDIA_CAPS[kind].maxBytes;

    const constraints: MediaStreamConstraints =
      kind === 'audio' ? { audio: true } : { audio: true, video: true };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((mediaStream) => {
        setStream(mediaStream);
        const { recorderType, fileType } = pickMimeType(kind);
        fileTypeRef.current = fileType;
        const recorder = recorderType
          ? new MediaRecorder(mediaStream, { mimeType: recorderType })
          : new MediaRecorder(mediaStream);
        recorderRef.current = recorder;

        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
            bytesRef.current += event.data.size;
            setRecordedBytes(bytesRef.current);
            // Auto-stop the moment we exceed the cap (one extra ~1s chunk is
            // tolerated; the file is still validated again before upload).
            if (bytesRef.current > cap && recorder.state !== 'inactive') {
              recorder.stop();
            }
          }
        };

        recorder.onstop = () => {
          clearTimer();
          const blob = new Blob(chunksRef.current, { type: fileTypeRef.current });
          const file = new File(
            [blob],
            `recording-${Date.now()}.${extensionFor(fileTypeRef.current)}`,
            { type: fileTypeRef.current },
          );
          setMediaFile(file);
          setStatus('stopped');
          stopTracks(mediaStream);
          setStream(null);
        };

        recorder.onerror = () => {
          clearTimer();
          setStatus('error');
          setMessage('Recording failed. Please try again.');
          stopTracks(mediaStream);
          setStream(null);
        };

        // Timeslice so we get periodic size updates (and can enforce the cap).
        recorder.start(1000);
        startedAtRef.current = Date.now();
        setStatus('recording');
        timerRef.current = window.setInterval(() => {
          setDurationMs(Date.now() - startedAtRef.current);
        }, 200);
      })
      .catch((err: unknown) => {
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setStatus('denied');
          setMessage(
            kind === 'audio'
              ? 'Microphone access was blocked. Allow it in your browser’s site settings, then try again.'
              : 'Camera/microphone access was blocked. Allow it in your browser’s site settings, then try again.',
          );
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setStatus('error');
          setMessage(
            kind === 'audio'
              ? 'No microphone was found. Connect one, or upload a file instead.'
              : 'No camera was found. Connect one, or upload a file instead.',
          );
        } else {
          setStatus('error');
          setMessage('Couldn’t start recording. Please try again.');
        }
      });
  }, [kind, clearTimer, stopTracks]);

  const reset = useCallback(() => {
    stop();
    stopTracks(stream);
    setStream(null);
    setStatus('idle');
    setMessage(null);
    setMediaFile(null);
    setDurationMs(0);
    setRecordedBytes(0);
    bytesRef.current = 0;
    chunksRef.current = [];
  }, [stop, stopTracks, stream]);

  // Tear everything down on unmount (or when the kind changes).
  useEffect(
    () => () => {
      clearTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    },
    [clearTimer, kind],
  );

  return {
    status,
    stream,
    durationMs,
    recordedBytes,
    capBytes,
    message,
    mediaFile,
    start,
    stop,
    reset,
  };
}

/** Format milliseconds as M:SS for the recorder's duration readout. */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
