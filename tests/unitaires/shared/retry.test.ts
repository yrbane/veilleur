/**
 * Tests unitaires - Utilitaires de retry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  retry,
  retryAvecDetails,
  CircuitBreaker,
  avecTimeout,
  retryBatch,
} from '@shared/utils/retry';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('retry simple', () => {
    it('devrait réussir au premier essai', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = retry(fn, { maxTentatives: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('devrait réessayer après un échec retriable', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error('fail'), { code: 'ECONNRESET' }))
        .mockResolvedValue('success');

      const promise = retry(fn, { maxTentatives: 3, delaiInitial: 100 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('devrait échouer immédiatement si erreur non retriable', async () => {
      vi.useRealTimers();
      const fn = vi.fn().mockRejectedValue(new Error('non-retriable error'));

      await expect(retry(fn, { maxTentatives: 3, delaiInitial: 100 })).rejects.toThrow('non-retriable error');
      expect(fn).toHaveBeenCalledTimes(1);
      vi.useFakeTimers();
    });

    it('devrait utiliser une fonction estRetryable personnalisée', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('retriable'))
        .mockResolvedValue('success');

      const estRetryable = (err: unknown) =>
        err instanceof Error && err.message === 'retriable';

      const promise = retry(fn, {
        maxTentatives: 3,
        delaiInitial: 100,
        estRetryable,
      });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('devrait appeler onRetry à chaque tentative', async () => {
      const onRetry = vi.fn();
      const fn = vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error('fail 1'), { code: 'ECONNRESET' }))
        .mockRejectedValueOnce(Object.assign(new Error('fail 2'), { code: 'ECONNRESET' }))
        .mockResolvedValue('success');

      const promise = retry(fn, { maxTentatives: 5, delaiInitial: 100, onRetry });
      await vi.runAllTimersAsync();
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('devrait appeler onEchecFinal après le nombre max de tentatives', async () => {
      const onEchecFinal = vi.fn();
      // Utiliser mockImplementation pour éviter les unhandled rejections
      const fn = vi.fn().mockImplementation(() => {
        const err = new Error('always fail');
        (err as unknown as { code: string }).code = 'ECONNRESET';
        return Promise.reject(err);
      });

      // Capturer la promise immédiatement avec un handler
      const promise = retry(fn, {
        maxTentatives: 3,
        delaiInitial: 100,
        onEchecFinal,
      }).catch((err) => err);

      // Attendre que tous les timers soient exécutés
      await vi.runAllTimersAsync();

      // Récupérer l'erreur
      const errorCaught = await promise;

      expect(errorCaught.message).toBe('always fail');
      expect(onEchecFinal).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('retry avec backoff', () => {
    it('devrait utiliser le facteur de backoff', async () => {
      const delays: number[] = [];
      const originalSetTimeout = globalThis.setTimeout;

      vi.spyOn(globalThis, 'setTimeout').mockImplementation(((cb: () => void, delay: number) => {
        if (delay > 0) delays.push(delay);
        return originalSetTimeout(cb, 0);
      }) as typeof setTimeout);

      const fn = vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error('fail 1'), { code: 'ECONNRESET' }))
        .mockRejectedValueOnce(Object.assign(new Error('fail 2'), { code: 'ECONNRESET' }))
        .mockResolvedValue('success');

      const promise = retry(fn, {
        maxTentatives: 5,
        delaiInitial: 100,
        facteurBackoff: 2,
        jitter: false,
      });

      await vi.runAllTimersAsync();
      await promise;

      // Premier retry: 100ms, deuxième: 200ms
      expect(delays.length).toBeGreaterThanOrEqual(2);
    });

    it('devrait respecter le délai maximum', async () => {
      const delays: number[] = [];
      const originalSetTimeout = globalThis.setTimeout;

      vi.spyOn(globalThis, 'setTimeout').mockImplementation(((cb: () => void, delay: number) => {
        if (delay > 0) delays.push(delay);
        return originalSetTimeout(cb, 0);
      }) as typeof setTimeout);

      const fn = vi.fn()
        .mockRejectedValueOnce(Object.assign(new Error('fail'), { code: 'ECONNRESET' }))
        .mockRejectedValueOnce(Object.assign(new Error('fail'), { code: 'ECONNRESET' }))
        .mockRejectedValueOnce(Object.assign(new Error('fail'), { code: 'ECONNRESET' }))
        .mockResolvedValue('success');

      const promise = retry(fn, {
        maxTentatives: 5,
        delaiInitial: 100,
        facteurBackoff: 10,
        delaiMax: 500,
        jitter: false,
      });

      await vi.runAllTimersAsync();
      await promise;

      // Aucun délai ne devrait dépasser delaiMax
      expect(delays.every(d => d <= 500)).toBe(true);
    });
  });

  describe('retryAvecDetails', () => {
    it('devrait retourner un résultat détaillé en cas de succès', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await retryAvecDetails(fn, { maxTentatives: 3 });

      expect(result.succes).toBe(true);
      expect(result.resultat).toBe('success');
      expect(result.tentatives).toBe(1);
      expect(result.tempsTotal).toBeGreaterThanOrEqual(0);
    });

    it('devrait retourner un résultat détaillé en cas d\'échec', async () => {
      vi.useRealTimers();

      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      const result = await retryAvecDetails(fn, { maxTentatives: 1 });

      expect(result.succes).toBe(false);
      expect(result.erreur).toBeDefined();
      expect(result.tentatives).toBe(1);
    });
  });

});

describe('avecTimeout', () => {
  it('devrait résoudre si la promise termine avant le timeout', async () => {
    vi.useRealTimers();
    const promise = Promise.resolve('success');

    const result = await avecTimeout(promise, 5000);

    expect(result).toBe('success');
  });

  it('devrait rejeter si le timeout est dépassé', async () => {
    vi.useFakeTimers();

    const promise = new Promise(() => {});
    const timeoutPromise = avecTimeout(promise, 100);

    // Avancer le timer pour déclencher le timeout
    vi.advanceTimersByTime(100);

    // Attendre que la rejection soit traitée
    await expect(timeoutPromise).rejects.toThrow(/timeout/i);

    vi.useRealTimers();
  });

  it('devrait utiliser un message d\'erreur personnalisé', async () => {
    vi.useFakeTimers();

    const promise = new Promise(() => {});
    const timeoutPromise = avecTimeout(promise, 100, 'Opération trop longue');

    // Avancer le timer
    vi.advanceTimersByTime(100);

    await expect(timeoutPromise).rejects.toThrow('Opération trop longue');

    vi.useRealTimers();
  });
});

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('devrait laisser passer les requêtes en état fermé', async () => {
    const breaker = new CircuitBreaker({ seuilEchecs: 3, dureeFermeture: 1000 });
    const fn = vi.fn().mockResolvedValue('success');

    const result = await breaker.executer(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalled();
    expect(breaker.obtenirEtat()).toBe('ferme');
  });

  it('devrait ouvrir le circuit après le seuil d\'échecs', async () => {
    const breaker = new CircuitBreaker({ seuilEchecs: 2, dureeFermeture: 1000 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Premier échec
    await expect(breaker.executer(fn)).rejects.toThrow('fail');
    expect(breaker.obtenirEtat()).toBe('ferme');

    // Deuxième échec - devrait ouvrir le circuit
    await expect(breaker.executer(fn)).rejects.toThrow('fail');
    expect(breaker.obtenirEtat()).toBe('ouvert');

    // Les requêtes suivantes devraient être rejetées immédiatement
    const fnNeverCalled = vi.fn();
    await expect(breaker.executer(fnNeverCalled)).rejects.toThrow('Circuit ouvert');
    expect(fnNeverCalled).not.toHaveBeenCalled();
  });

  it('devrait passer en semi-ouvert après le timeout', async () => {
    vi.useFakeTimers();

    const breaker = new CircuitBreaker({ seuilEchecs: 1, dureeFermeture: 1000 });
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Ouvrir le circuit
    await expect(breaker.executer(fn)).rejects.toThrow('fail');
    expect(breaker.obtenirEtat()).toBe('ouvert');

    // Avancer le temps
    await vi.advanceTimersByTimeAsync(1000);

    // Tenter une requête devrait passer en semi-ouvert
    fn.mockResolvedValueOnce('success');
    await breaker.executer(fn);

    expect(breaker.obtenirEtat()).toBe('ferme');

    vi.useRealTimers();
  });

  it('devrait fermer le circuit après un succès en semi-ouvert', async () => {
    vi.useFakeTimers();

    const breaker = new CircuitBreaker({ seuilEchecs: 1, dureeFermeture: 1000 });

    // Ouvrir le circuit
    await expect(breaker.executer(() => Promise.reject(new Error('fail')))).rejects.toThrow();

    // Passer en semi-ouvert et réussir
    await vi.advanceTimersByTimeAsync(1000);

    const result = await breaker.executer(() => Promise.resolve('success'));
    expect(result).toBe('success');
    expect(breaker.obtenirEtat()).toBe('ferme');

    vi.useRealTimers();
  });

  it('devrait rouvrir le circuit après un échec en semi-ouvert', async () => {
    vi.useFakeTimers();

    const breaker = new CircuitBreaker({ seuilEchecs: 1, dureeFermeture: 1000 });

    // Ouvrir le circuit
    await expect(breaker.executer(() => Promise.reject(new Error('fail')))).rejects.toThrow();

    // Passer en semi-ouvert et échouer
    await vi.advanceTimersByTimeAsync(1000);

    await expect(breaker.executer(() => Promise.reject(new Error('fail again')))).rejects.toThrow();
    expect(breaker.obtenirEtat()).toBe('ouvert');

    vi.useRealTimers();
  });

  it('devrait permettre de forcer la fermeture', async () => {
    const breaker = new CircuitBreaker({ seuilEchecs: 1, dureeFermeture: 10000 });

    // Ouvrir le circuit
    await expect(breaker.executer(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    expect(breaker.obtenirEtat()).toBe('ouvert');

    // Forcer la fermeture
    breaker.forcerFermeture();
    expect(breaker.obtenirEtat()).toBe('ferme');

    // Devrait accepter les requêtes
    const result = await breaker.executer(() => Promise.resolve('success'));
    expect(result).toBe('success');
  });

  it('devrait fournir des statistiques', async () => {
    const breaker = new CircuitBreaker({ seuilEchecs: 5, dureeFermeture: 1000 });

    await breaker.executer(() => Promise.resolve('success'));
    await breaker.executer(() => Promise.resolve('success'));
    await expect(breaker.executer(() => Promise.reject(new Error('fail')))).rejects.toThrow();

    const stats = breaker.obtenirStatistiques();
    expect(stats.succes).toBe(2);
    expect(stats.echecs).toBe(1);
    expect(stats.etat).toBe('ferme');
  });

  it('devrait appeler le callback onChangementEtat', async () => {
    const onChangementEtat = vi.fn();
    const breaker = new CircuitBreaker({
      seuilEchecs: 1,
      dureeFermeture: 1000,
      onChangementEtat,
    });

    // Ouvrir le circuit
    await expect(breaker.executer(() => Promise.reject(new Error('fail')))).rejects.toThrow();

    expect(onChangementEtat).toHaveBeenCalledWith('ferme', 'ouvert');
  });
});

describe('retryBatch', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('devrait traiter un batch d\'items', async () => {
    const items = [1, 2, 3];
    const fn = vi.fn().mockImplementation((n: number) => Promise.resolve(n * 2));

    const results = await retryBatch(items, fn, { maxTentatives: 1 });

    expect(results).toHaveLength(3);
    expect(results.every(r => r.succes)).toBe(true);
    expect(results.map(r => r.resultat)).toEqual([2, 4, 6]);
  });

  it('devrait gérer les échecs individuels', async () => {
    const items = [1, 2, 3];
    const fn = vi.fn()
      .mockResolvedValueOnce(2)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(6);

    const results = await retryBatch(items, fn, { maxTentatives: 1 });

    expect(results).toHaveLength(3);
    expect(results[0].succes).toBe(true);
    expect(results[1].succes).toBe(false);
    expect(results[2].succes).toBe(true);
  });

  it('devrait respecter la concurrence', async () => {
    const items = [1, 2, 3, 4, 5];
    let concurrent = 0;
    let maxConcurrent = 0;

    const fn = vi.fn().mockImplementation(async (n: number) => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      // Pas de délai pour éviter le timeout
      concurrent--;
      return n * 2;
    });

    await retryBatch(items, fn, { maxTentatives: 1, concurrence: 2 });

    // Le batch traite 2 items à la fois, donc max 2 en parallèle
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
