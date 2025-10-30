import { getFunctions, httpsCallable } from 'firebase/functions';
import type { Functions } from 'firebase/functions';
import type { FirebaseError } from 'firebase/app';
import { firebaseApp } from './firebase';

type FunctionsCandidate = {
  id: string;
  client: Functions;
};

const DEFAULT_FALLBACK_REGIONS = [
  'asia-southeast1',
  'asia-east1',
  'asia-northeast1',
  'us-central1',
];

const configuredCustomDomain = import.meta.env.VITE_FIREBASE_FUNCTIONS_CUSTOM_DOMAIN?.trim();
const configuredRegion = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION?.trim();

const configuredFallbacks = (import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION_FALLBACKS || '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

const fallbackRegions = configuredFallbacks.length > 0 ? configuredFallbacks : DEFAULT_FALLBACK_REGIONS;

const callableCandidates: FunctionsCandidate[] = (() => {
  const seen = new Set<string>();
  const order: Array<{ key: string | undefined; id: string }> = [];

  if (configuredCustomDomain) {
    order.push({ key: configuredCustomDomain, id: `custom-domain:${configuredCustomDomain}` });
  }

  if (configuredRegion) {
    order.push({ key: configuredRegion, id: `region:${configuredRegion}` });
  }

  order.push({ key: undefined, id: 'default-region' });

  for (const region of fallbackRegions) {
    order.push({ key: region, id: `fallback:${region}` });
  }

  return order.reduce<FunctionsCandidate[]>((candidates, descriptor) => {
    const dedupeKey = descriptor.key ?? '__default__';
    if (seen.has(dedupeKey)) {
      return candidates;
    }
    seen.add(dedupeKey);

    const client = descriptor.key
      ? getFunctions(firebaseApp, descriptor.key)
      : getFunctions(firebaseApp);

    candidates.push({
      id: descriptor.id,
      client,
    });

    return candidates;
  }, []);
})();

const RETRYABLE_CODES = new Set([
  'functions/internal',
  'functions/unavailable',
  'functions/unknown',
  'functions/not-found',
]);

const shouldRetryCallableError = (error: unknown): error is FirebaseError => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const firebaseError = error as FirebaseError & { cause?: unknown };
  const code = typeof firebaseError.code === 'string' ? firebaseError.code : '';

  if (RETRYABLE_CODES.has(code)) {
    return true;
  }

  const message = typeof firebaseError.message === 'string' ? firebaseError.message : '';
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes('cors') ||
    lowerMessage.includes('networkerror') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('fetch failed')
  ) {
    return true;
  }

  if (firebaseError.cause) {
    return shouldRetryCallableError(firebaseError.cause);
  }

  return false;
};

export async function callCallableWithFallbacks<TPayload, TResult>(
  name: string,
  payload: TPayload
): Promise<TResult> {
  let lastError: FirebaseError | undefined;

  for (const candidate of callableCandidates) {
    try {
      const callable = httpsCallable<TPayload, TResult>(candidate.client, name);
      const response = await callable(payload);
      return response.data;
    } catch (error) {
      if (error && typeof error === 'object') {
        console.warn(`Callable ${name} failed via ${candidate.id}`, error);
      }

      if (!shouldRetryCallableError(error)) {
        throw error as FirebaseError;
      }

      lastError = error as FirebaseError;
    }
  }

  if (lastError) {
    const appendedMessage = lastError.message
      ? `${lastError.message} (Đã thử nhiều vùng triển khai Cloud Functions nhưng đều thất bại. Kiểm tra lại cấu hình vùng (VITE_FIREBASE_FUNCTIONS_REGION / VITE_FIREBASE_FUNCTIONS_REGION_FALLBACKS) và chắc chắn đã deploy Cloud Functions.)`
      : 'Không thể kết nối tới Cloud Functions sau khi thử nhiều vùng triển khai. Vui lòng kiểm tra lại cấu hình vùng và trạng thái deploy của Functions.';

    throw new Error(appendedMessage);
  }

  throw new Error('Không thể kết nối tới Cloud Functions.');
}