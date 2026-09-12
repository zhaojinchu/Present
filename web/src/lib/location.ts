// One GPS fix, never blocking. Used to set the class pin on the first on-time post and to award
// the "Nearby" badge afterwards. Rooms cannot be told apart by GPS; the photo is the proof.

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number; // metres, as reported by the device
}

export function getPosition(timeoutMs = 6000): Promise<Fix | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: Fix | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        window.clearTimeout(timer);
        finish({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });
      },
      () => {
        window.clearTimeout(timer);
        finish(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}
