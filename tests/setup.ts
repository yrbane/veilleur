/**
 * Veilleur - Setup global des tests
 * Configuration et mocks partagés
 */

import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// ============================================================
// MOCKS GLOBAUX
// ============================================================

// Mock de console.error pour éviter le bruit dans les tests
const originalConsoleError = console.error;
vi.spyOn(console, 'error').mockImplementation((...args) => {
  // Filtrer les erreurs React attendues
  const message = args[0]?.toString?.() ?? '';
  if (
    message.includes('Warning:') ||
    message.includes('ReactDOM.render') ||
    message.includes('act()')
  ) {
    return;
  }
  originalConsoleError(...args);
});

// Mock de localStorage (fonctionne en Node aussi)
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

// Mocks spécifiques au navigateur - seulement si window existe (jsdom)
if (typeof window !== 'undefined') {
  // Mock de window.matchMedia pour les tests responsive
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock de ResizeObserver
  class ResizeObserverMock {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  window.ResizeObserver = ResizeObserverMock;

  // Mock de IntersectionObserver
  class IntersectionObserverMock {
    readonly root: Element | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];

    constructor(
      private callback: IntersectionObserverCallback,
      _options?: IntersectionObserverInit,
    ) {}

    observe = vi.fn((target: Element) => {
      // Simuler une intersection immédiate pour les tests
      const entries: IntersectionObserverEntry[] = [
        {
          target,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
          time: Date.now(),
        },
      ];
      this.callback(entries, this as unknown as IntersectionObserver);
    });

    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn().mockReturnValue([]);
  }
  window.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;

  // Mock de scrollTo
  window.scrollTo = vi.fn();

  // Mock de requestAnimationFrame
  window.requestAnimationFrame = vi.fn((callback) => {
    return setTimeout(callback, 0);
  });

  window.cancelAnimationFrame = vi.fn((id) => {
    clearTimeout(id);
  });

  Object.defineProperty(window, 'localStorage', { value: localStorageMock });
  Object.defineProperty(window, 'sessionStorage', { value: localStorageMock });
}

// Mock de fetch
const fetchMock = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  } as Response),
);
global.fetch = fetchMock;

// ============================================================
// VARIABLES D'ENVIRONNEMENT DE TEST
// ============================================================

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/veilleur_test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only';
process.env.LOG_LEVEL = 'error'; // Réduire le bruit des logs

// ============================================================
// HOOKS DE CYCLE DE VIE
// ============================================================

beforeAll(() => {
  // Setup avant tous les tests
});

afterAll(() => {
  // Cleanup après tous les tests
  vi.restoreAllMocks();
});

afterEach(() => {
  // Reset après chaque test
  vi.clearAllMocks();
  localStorageMock.clear();
});

// ============================================================
// HELPERS DE TEST GLOBAUX
// ============================================================

// Rendre disponible globalement pour les tests
declare global {
  // eslint-disable-next-line no-var
  var testHelpers: {
    waitFor: (condition: () => boolean, timeout?: number) => Promise<void>;
    sleep: (ms: number) => Promise<void>;
    mockFetch: typeof fetchMock;
    mockLocalStorage: typeof localStorageMock;
  };
}

global.testHelpers = {
  waitFor: async (condition: () => boolean, timeout = 5000) => {
    const start = Date.now();
    while (!condition()) {
      if (Date.now() - start > timeout) {
        throw new Error('waitFor timeout');
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  },

  sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  mockFetch: fetchMock,

  mockLocalStorage: localStorageMock,
};

// ============================================================
// EXTENSIONS EXPECT
// ============================================================

// Extend expect si nécessaire (via vitest-dom ou custom matchers)

export { fetchMock, localStorageMock };
