import { AuroraBackground } from '@/components/AuroraBackground';
import { Spinner } from '@/components/feedback/Spinner';

/** Full-viewport loader shown while the session is being restored, so route
 *  guards never flash the wrong screen. */
export function FullScreenLoader() {
  return (
    <div className="relative grid min-h-dvh place-items-center">
      <AuroraBackground />
      <Spinner size={40} />
    </div>
  );
}
