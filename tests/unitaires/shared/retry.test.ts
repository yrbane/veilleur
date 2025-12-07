/**
 * Tests unitaires - Utilitaires de retry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  retry,
  retryWithBackoff,
  withTimeout,
  retryIf,
  circuit,
  CircuitBreakerError,
} from '@shared/utils/retry';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('retry', () => {
    it('devrait réussir au premier essai', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = retry(fn, { maxRetries: 3 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('devrait réessayer après un échec', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const promise = retry(fn, { maxRetries: 3, delay: 100 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('devrait échouer après le nombre max de tentatives', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fail'));

      const promise = retry(fn, { maxRetries: 3, delay: 100 });

      await expect(vi.runAllTimersAsync().then(() => promise)).rejects.toThrow('always fail');
      expect(fn).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('devrait appeler onRetry à chaque tentative', async () => {
      const onRetry = vi.fn();
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const promise = retry(fn, { maxRetries: 3, delay: 100, onRetry });
      await vi.runAllTimersAsync();
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 2);
    });

    it('devrait respecter le délai entre les tentatives', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const promise = retry(fn, { maxRetries: 3, delay: 1000 });

      // Premier appel immédiat
      await vi.advanceTimersByTimeAsync(0);
      expect(fn).toHaveBeenCalledTimes(1);

      // Pas encore de retry
      await vi.advanceTimersByTimeAsync(500);
      expect(fn).toHaveBeenCalledTimes(1);

      // Après le délai
      await vi.advanceTimersByTimeAsync(500);
      expect(fn).toHaveBeenCalledTimes(2);

      await promise;
    });
  });

  describe('retryWithBackoff', () => {
    it('devrait augmenter le délai exponentiellement', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockRejectedValueOnce(new Error('fail 3'))
        .mockResolvedValue('success');

      const delays: number[] = [];
      const originalSetTimeout = setTimeout;

      vi.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(cb, 0);
      }) as typeof setTimeout);

      const promise = retryWithBackoff(fn, {
        maxRetries: 5,
        initialDelay: 100,
        factor: 2,
      });

      await vi.runAllTimersAsync();
      await promise;

      // Le délai devrait doubler à chaque fois
      expect(delays).toContain(100);
      expect(delays).toContain(200);
      expect(delays).toContain(400);
    });

    it('devrait respecter le délai maximum', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const delays: number[] = [];
      const originalSetTimeout = setTimeout;

      vi.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(cb, 0);
      }) as typeof setTimeout);

      const promise = retryWithBackoff(fn, {
        maxRetries: 5,
        initialDelay: 100,
        factor: 10,
        maxDelay: 500,
      });

      await vi.runAllTimersAsync();
      await promise;

      // Aucun délai ne devrait dépasser maxDelay
      expect(delays.every(d => d <= 500)).toBe(true);
    });

    it('devrait ajouter du jitter si configuré', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      // Avec jitter, le délai devrait varier
      const promise = retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 1000,
        jitter: true,
      });

      await vi.runAllTimersAsync();
      await promise;

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('withTimeout', () => {
    it('devrait résoudre si la fonction termine avant le timeout', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = withTimeout(fn(), 5000);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
    });

    it('devrait rejeter si le timeout est dépassé', async () => {
      const fn = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('success'), 10000))
      );

      const promise = withTimeout(fn(), 5000);

      await vi.advanceTimersByTimeAsync(5000);

      await expect(promise).rejects.toThrow(/timeout/i);
    });

    it('devrait utiliser un message d\'erreur personnalisé', async () => {
      const fn = new Promise(resolve => setTimeout(() => resolve('success'), 10000));

      const promise = withTimeout(fn, 5000, 'Opération trop longue');

      await vi.advanceTimersByTimeAsync(5000);

      await expect(promise).rejects.toThrow('Opération trop longue');
    });
  });

  describe('retryIf', () => {
    it('devrait réessayer seulement si la condition est vraie', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('retriable'))
        .mockResolvedValue('success');

      const shouldRetry = (error: Error) => error.message === 'retriable';

      const promise = retryIf(fn, shouldRetry, { maxRetries: 3, delay: 100 });
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('ne devrait pas réessayer si la condition est fausse', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('non-retriable'));
      const shouldRetry = (error: Error) => error.message === 'retriable';

      const promise = retryIf(fn, shouldRetry, { maxRetries: 3, delay: 100 });

      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('non-retriable');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('circuit', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('devrait laisser passer les requêtes en état fermé', async () => {
      const breaker = circuit({ threshold: 3, resetTimeout: 1000 });
      const fn = vi.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
    });

    it('devrait ouvrir le circuit après le seuil d\'échecs', async () => {
      const breaker = circuit({ threshold: 2, resetTimeout: 1000 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Premier échec
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(breaker.state).toBe('closed');

      // Deuxième échec - devrait ouvrir le circuit
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(breaker.state).toBe('open');

      // Les requêtes suivantes devraient être rejetées immédiatement
      const fnNeverCalled = vi.fn();
      await expect(breaker.execute(fnNeverCalled)).rejects.toThrow(CircuitBreakerError);
      expect(fnNeverCalled).not.toHaveBeenCalled();
    });

    it('devrait passer en semi-ouvert après le timeout', async () => {
      vi.useFakeTimers();

      const breaker = circuit({ threshold: 1, resetTimeout: 1000 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));

      // Ouvrir le circuit
      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      expect(breaker.state).toBe('open');

      // Avancer le temps
      await vi.advanceTimersByTimeAsync(1000);

      expect(breaker.state).toBe('half-open');

      vi.useRealTimers();
    });

    it('devrait fermer le circuit après un succès en semi-ouvert', async () => {
      vi.useFakeTimers();

      const breaker = circuit({ threshold: 1, resetTimeout: 1000 });

      // Ouvrir le circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Passer en semi-ouvert
      await vi.advanceTimersByTimeAsync(1000);
      expect(breaker.state).toBe('half-open');

      // Succès en semi-ouvert
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
      expect(breaker.state).toBe('closed');

      vi.useRealTimers();
    });

    it('devrait rouvrir le circuit après un échec en semi-ouvert', async () => {
      vi.useFakeTimers();

      const breaker = circuit({ threshold: 1, resetTimeout: 1000 });

      // Ouvrir le circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      // Passer en semi-ouvert
      await vi.advanceTimersByTimeAsync(1000);

      // Échec en semi-ouvert
      await expect(breaker.execute(() => Promise.reject(new Error('fail again')))).rejects.toThrow();
      expect(breaker.state).toBe('open');

      vi.useRealTimers();
    });

    it('devrait permettre de réinitialiser manuellement', async () => {
      const breaker = circuit({ threshold: 1, resetTimeout: 10000 });

      // Ouvrir le circuit
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      expect(breaker.state).toBe('open');

      // Reset manuel
      breaker.reset();
      expect(breaker.state).toBe('closed');

      // Devrait accepter les requêtes
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
    });

    it('devrait fournir des statistiques', async () => {
      const breaker = circuit({ threshold: 3, resetTimeout: 1000 });

      await breaker.execute(() => Promise.resolve('success'));
      await breaker.execute(() => Promise.resolve('success'));
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();

      const stats = breaker.stats;
      expect(stats.successes).toBe(2);
      expect(stats.failures).toBe(1);
      expect(stats.total).toBe(3);
    });
  });
});
