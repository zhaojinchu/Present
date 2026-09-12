import * as Location from 'expo-location';
import type { Building } from './types';

const EARTH_R = 6_371_000;

export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

export type GeoFailure = 'denied' | 'unavailable';

export class GeoError extends Error {
  constructor(
    public kind: GeoFailure,
    message: string,
  ) {
    super(message);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new GeoError('unavailable', 'Location timed out')), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

export async function ensureLocationPermission(): Promise<boolean> {
  const cur = await Location.getForegroundPermissionsAsync();
  if (cur.granted) return true;
  const req = await Location.requestForegroundPermissionsAsync();
  return req.granted;
}

/** High accuracy with an 8 s cap, then one Balanced retry. Throws GeoError. */
export async function getPosition(): Promise<Location.LocationObject> {
  if (!(await ensureLocationPermission())) {
    throw new GeoError('denied', 'Location permission is off. Enable it in Settings to check in.');
  }
  try {
    return await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 8000);
  } catch {
    try {
      return await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 6000);
    } catch {
      const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
      if (last) return last;
      throw new GeoError('unavailable', 'Could not get a location fix. Step near a window and try again.');
    }
  }
}

export interface GeofenceResult {
  inside: boolean;
  distance: number; // metres from the building centre
  accuracy: number | null;
}

export function evaluate(pos: Location.LocationObject, b: Building): GeofenceResult {
  const distance = metersBetween({ lat: pos.coords.latitude, lng: pos.coords.longitude }, b);
  const accuracy = pos.coords.accuracy ?? null;
  const slack = Math.min(accuracy ?? 0, 50); // indoor GPS is 30–65 m on iPhone
  return { inside: distance <= b.radius_m + slack, distance: Math.round(distance), accuracy };
}

export async function checkGeofence(b: Building): Promise<GeofenceResult> {
  return evaluate(await getPosition(), b);
}
