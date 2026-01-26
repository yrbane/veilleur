/**
 * Veilleur - Helpers de test
 * Utilitaires pour simplifier l'écriture des tests
 */

import { vi } from 'vitest';

// ============================================================
// ASYNC HELPERS
// ============================================================

/**
 * Attend qu'une condition soit vraie
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const start = Date.now();

  while (!(await condition())) {
    if (Date.now() - start > timeout) {
      throw new Error(`waitFor timeout après ${timeout}ms`);
    }
    await sleep(interval);
  }
}

/**
 * Attend qu'une valeur change
 */
export async function waitForValueChange<T>(
  getValue: () => T,
  options: { timeout?: number; interval?: number } = {},
): Promise<T> {
  const initialValue = getValue();
  const { timeout = 5000, interval = 50 } = options;
  const start = Date.now();

  while (getValue() === initialValue) {
    if (Date.now() - start > timeout) {
      throw new Error(`waitForValueChange timeout après ${timeout}ms`);
    }
    await sleep(interval);
  }

  return getValue();
}

/**
 * Pause asynchrone
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Attend le prochain tick de l'event loop
 */
export function nextTick(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Attend que toutes les promesses en attente soient résolues
 */
export async function flushPromises(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setImmediate(resolve));
}

/**
 * Attend les timers fake de vitest
 */
export async function flushTimers(): Promise<void> {
  await vi.runAllTimersAsync();
}

// ============================================================
// MOCK HELPERS
// ============================================================

/**
 * Crée un mock de fonction avec typage
 */
export function createMock<T extends (...args: unknown[]) => unknown>(): ReturnType<typeof vi.fn<T>> {
  return vi.fn<T>();
}

/**
 * Mock qui résout une promesse
 */
export function mockResolve<T>(value: T): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(value);
}

/**
 * Mock qui rejette une promesse
 */
export function mockReject(error: Error | string): ReturnType<typeof vi.fn> {
  const err = typeof error === 'string' ? new Error(error) : error;
  return vi.fn().mockRejectedValue(err);
}

/**
 * Mock qui alterne entre succès et erreur
 */
export function mockAlternate<T>(
  successValue: T,
  error: Error | string,
  pattern: boolean[] = [true, false],
): ReturnType<typeof vi.fn> {
  let callIndex = 0;
  const err = typeof error === 'string' ? new Error(error) : error;

  return vi.fn().mockImplementation(() => {
    const shouldSucceed = pattern[callIndex % pattern.length];
    callIndex++;
    return shouldSucceed ? Promise.resolve(successValue) : Promise.reject(err);
  });
}

/**
 * Mock avec délai
 */
export function mockWithDelay<T>(value: T, delayMs: number): ReturnType<typeof vi.fn> {
  return vi.fn().mockImplementation(async () => {
    await sleep(delayMs);
    return value;
  });
}

/**
 * Mock qui échoue N fois puis réussit
 */
export function mockFailThenSucceed<T>(
  successValue: T,
  error: Error | string,
  failCount: number,
): ReturnType<typeof vi.fn> {
  let calls = 0;
  const err = typeof error === 'string' ? new Error(error) : error;

  return vi.fn().mockImplementation(() => {
    calls++;
    if (calls <= failCount) {
      return Promise.reject(err);
    }
    return Promise.resolve(successValue);
  });
}

// ============================================================
// FETCH HELPERS
// ============================================================

interface FetchMockOptions {
  status?: number;
  headers?: Record<string, string>;
  delay?: number;
}

/**
 * Mock fetch avec réponse JSON
 */
export function mockFetchJson<T>(data: T, options: FetchMockOptions = {}): ReturnType<typeof vi.fn> {
  const { status = 200, headers = {}, delay = 0 } = options;

  return vi.fn().mockImplementation(async () => {
    if (delay > 0) {
      await sleep(delay);
    }

    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'content-type': 'application/json', ...headers }),
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      clone: function() { return this; },
    };
  });
}

/**
 * Mock fetch avec erreur
 */
export function mockFetchError(
  status: number,
  message: string,
  options: Omit<FetchMockOptions, 'status'> = {},
): ReturnType<typeof vi.fn> {
  const { headers = {}, delay = 0 } = options;

  return vi.fn().mockImplementation(async () => {
    if (delay > 0) {
      await sleep(delay);
    }

    return {
      ok: false,
      status,
      headers: new Headers({ 'content-type': 'application/json', ...headers }),
      json: () => Promise.resolve({ error: message }),
      text: () => Promise.resolve(JSON.stringify({ error: message })),
      clone: function() { return this; },
    };
  });
}

/**
 * Mock fetch avec network error
 */
export function mockFetchNetworkError(message = 'Network error'): ReturnType<typeof vi.fn> {
  return vi.fn().mockRejectedValue(new TypeError(message));
}

/**
 * Mock fetch avec plusieurs réponses séquentielles
 */
export function mockFetchSequence(
  responses: Array<{ data?: unknown; error?: string; status?: number }>,
): ReturnType<typeof vi.fn> {
  let callIndex = 0;

  return vi.fn().mockImplementation(async () => {
    const response = responses[callIndex % responses.length];
    callIndex++;

    const status = response.status ?? (response.error ? 500 : 200);

    return {
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(response.error ? { error: response.error } : response.data),
      text: () => Promise.resolve(JSON.stringify(response.error ? { error: response.error } : response.data)),
      clone: function() { return this; },
    };
  });
}

// ============================================================
// DATE/TIME HELPERS
// ============================================================

/**
 * Crée une date relative à maintenant
 */
export function relativeDate(offset: {
  years?: number;
  months?: number;
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}): Date {
  const date = new Date();
  if (offset.years) date.setFullYear(date.getFullYear() + offset.years);
  if (offset.months) date.setMonth(date.getMonth() + offset.months);
  if (offset.days) date.setDate(date.getDate() + offset.days);
  if (offset.hours) date.setHours(date.getHours() + offset.hours);
  if (offset.minutes) date.setMinutes(date.getMinutes() + offset.minutes);
  if (offset.seconds) date.setSeconds(date.getSeconds() + offset.seconds);
  return date;
}

/**
 * Mock Date.now() avec une valeur fixe
 */
export function mockDateNow(date: Date | number): () => void {
  const timestamp = typeof date === 'number' ? date : date.getTime();
  const originalNow = Date.now;
  vi.spyOn(Date, 'now').mockReturnValue(timestamp);

  return () => {
    vi.spyOn(Date, 'now').mockImplementation(originalNow);
  };
}

/**
 * Utilise les fake timers de vitest
 */
export function useFakeTimers(now?: Date | number): void {
  vi.useFakeTimers({
    now: now ? (typeof now === 'number' ? now : now.getTime()) : undefined,
  });
}

/**
 * Restaure les vrais timers
 */
export function useRealTimers(): void {
  vi.useRealTimers();
}

// ============================================================
// ERROR HELPERS
// ============================================================

/**
 * Capture les erreurs console.error
 */
export function captureConsoleErrors(): {
  errors: string[];
  restore: () => void;
} {
  const errors: string[] = [];
  const originalError = console.error;

  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  };

  return {
    errors,
    restore: () => {
      console.error = originalError;
    },
  };
}

/**
 * Vérifie qu'une fonction async throw une erreur spécifique
 */
export async function expectAsyncError(
  fn: () => Promise<unknown>,
  errorType?: new (...args: unknown[]) => Error,
  messagePattern?: RegExp | string,
): Promise<Error> {
  let error: Error | undefined;

  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }

  if (!error) {
    throw new Error('Expected function to throw an error');
  }

  if (errorType && !(error instanceof errorType)) {
    throw new Error(`Expected error of type ${errorType.name}, got ${error.constructor.name}`);
  }

  if (messagePattern) {
    const matches = typeof messagePattern === 'string'
      ? error.message.includes(messagePattern)
      : messagePattern.test(error.message);

    if (!matches) {
      throw new Error(`Error message "${error.message}" does not match pattern ${messagePattern}`);
    }
  }

  return error;
}

// ============================================================
// SNAPSHOT HELPERS
// ============================================================

/**
 * Supprime les propriétés dynamiques pour les snapshots
 */
export function sanitizeForSnapshot<T extends Record<string, unknown>>(
  obj: T,
  dynamicKeys: string[] = ['id', 'createdAt', 'updatedAt'],
): T {
  const result = { ...obj };

  for (const key of dynamicKeys) {
    if (key in result) {
      const value = result[key];
      if (typeof value === 'string') {
        result[key as keyof T] = `[${key}]` as T[keyof T];
      } else if (value instanceof Date) {
        result[key as keyof T] = '[Date]' as T[keyof T];
      }
    }
  }

  return result;
}

/**
 * Compare des objets en ignorant certaines clés
 */
export function compareIgnoringKeys<T extends Record<string, unknown>>(
  a: T,
  b: T,
  ignoredKeys: string[],
): boolean {
  const keysA = Object.keys(a).filter(k => !ignoredKeys.includes(k));
  const keysB = Object.keys(b).filter(k => !ignoredKeys.includes(k));

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }

  return true;
}

// ============================================================
// EVENT HELPERS
// ============================================================

/**
 * Crée un événement custom
 */
export function createCustomEvent<T>(type: string, detail?: T): CustomEvent<T> {
  return new CustomEvent(type, { detail, bubbles: true, cancelable: true });
}

/**
 * Simule une séquence de clavier
 */
export function simulateKeySequence(
  element: HTMLElement | Window,
  keys: string[],
  options: { delay?: number } = {},
): Promise<void> {
  const { delay = 0 } = options;

  return keys.reduce(async (promise, key) => {
    await promise;
    if (delay > 0) await sleep(delay);

    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
  }, Promise.resolve());
}

/**
 * Simule un clic
 */
export function simulateClick(element: HTMLElement): void {
  element.dispatchEvent(new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window,
  }));
}

/**
 * Simule un input change
 */
export function simulateChange(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

// ============================================================
// EXPORTS
// ============================================================

export const testHelpers = {
  // Async
  waitFor,
  waitForValueChange,
  sleep,
  nextTick,
  flushPromises,
  flushTimers,

  // Mocks
  createMock,
  mockResolve,
  mockReject,
  mockAlternate,
  mockWithDelay,
  mockFailThenSucceed,

  // Fetch
  mockFetchJson,
  mockFetchError,
  mockFetchNetworkError,
  mockFetchSequence,

  // Date/Time
  relativeDate,
  mockDateNow,
  useFakeTimers,
  useRealTimers,

  // Errors
  captureConsoleErrors,
  expectAsyncError,

  // Snapshots
  sanitizeForSnapshot,
  compareIgnoringKeys,

  // Events
  createCustomEvent,
  simulateKeySequence,
  simulateClick,
  simulateChange,
};

export default testHelpers;
