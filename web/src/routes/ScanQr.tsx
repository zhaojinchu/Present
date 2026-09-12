// /friends/scan — point the camera at a friend's code (the one on their Share screen) and the
// request goes out. No app switching. Uses the platform BarcodeDetector when there is one and a
// pure JS decoder otherwise.
import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';
import { IoClose, IoImagesOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { Button, Icon, IconButton, Spinner, Txt } from '@/ui';

type Stage = 'starting' | 'scanning' | 'found' | 'error';

/** The username inside a share link (any host), an @handle, or a bare username. */
export function usernameFromCode(text: string): string | null {
  const t = text.trim();
  const m = t.match(/\/add\/([a-z0-9_]{3,20})(?:[/?#]|$)/i) ?? t.match(/^@?([a-z0-9_]{3,20})$/i);
  return m ? m[1].toLowerCase() : null;
}

interface Detector {
  detect(source: HTMLVideoElement | ImageBitmap): Promise<{ rawValue: string }[]>;
}

export default function ScanQr() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<Stage>('starting');
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let stream: MediaStream | null = null;
    let raf = 0;
    let last = 0;
    let lastHint = '';
    const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = Ctor ? new Ctor({ formats: ['qr_code'] }) : null;

    const stop = () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    const handle = (text: string) => {
      const u = usernameFromCode(text);
      if (!u) {
        if (text !== lastHint) {
          lastHint = text;
          setHint('That is not a Present code.');
        }
        return;
      }
      setStage('found');
      stop();
      navigate(`/add/${u}`, { replace: true });
    };
    const tick = async (t: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      if (t - last < 120) return;
      last = t;
      const v = videoRef.current;
      if (!v || v.readyState < 2 || v.videoWidth === 0) return;
      if (detector) {
        try {
          const codes = await detector.detect(v);
          if (codes[0]?.rawValue) handle(codes[0].rawValue);
          return;
        } catch {
          // fall through to the JS decoder
        }
      }
      const c = canvasRef.current;
      if (!c) return;
      const w = 480;
      const h = Math.round((w * v.videoHeight) / v.videoWidth);
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
      if (code?.data) handle(code.data);
    };

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('No camera here');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play().catch(() => {});
        setStage('scanning');
        raf = requestAnimationFrame(tick);
      } catch (e) {
        const name = (e as { name?: string } | null)?.name;
        setError(name === 'NotAllowedError' ? 'Camera access is off for Present. Allow it in Settings.' : 'Could not start the camera.');
        setStage('error');
      }
    })();
    return stop;
  }, [navigate]);

  const close = () => (window.history.length > 1 ? navigate(-1) : navigate('/friends'));

  return (
    <div className="capture relative flex flex-col h-full">
      <div className="absolute inset-0">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        {/* viewfinder */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[68%] max-w-[300px] rounded-2xl ring-[3px] ring-capture-text/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" style={{ aspectRatio: '1 / 1' }} />
        </div>
      </div>

      <div className="safe-top relative z-10 flex items-center gap-3 px-4 pt-2">
        <IconButton icon={IoClose} label="Close" tone="scrim" onClick={close} />
        <Txt variant="headline" tone="capture" className="flex-1" style={{ textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>
          Scan a friend's code
        </Txt>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-end px-6 pb-[calc(env(safe-area-inset-bottom)+32px)] text-center gap-3">
        {stage === 'starting' ? <Spinner size={24} className="text-capture-text" /> : null}
        {stage === 'scanning' ? (
          <Txt variant="subhead" tone="capture" style={{ textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>
            {hint ?? 'Point at the code on their Share screen.'}
          </Txt>
        ) : null}
        {stage === 'found' ? (
          <Txt variant="subhead" tone="capture">
            Got it.
          </Txt>
        ) : null}
        {stage === 'error' ? (
          <div className="flex flex-col items-center gap-3 max-w-[320px]">
            <Txt variant="headline" tone="capture">
              Camera unavailable
            </Txt>
            <Txt variant="subhead" tone="captureSecondary">
              {error}
            </Txt>
            <Button title="Search by username instead" variant="tertiary" icon={IoImagesOutline} className="text-capture-text-secondary" onClick={() => navigate('/friends', { replace: true })} />
          </div>
        ) : null}
        <Txt variant="footnote" tone="captureSecondary">
          <Icon icon={IoImagesOutline} size={14} className="inline -mt-0.5 mr-1" />
          Their code is under Friends, then Share my link.
        </Txt>
      </div>
    </div>
  );
}
