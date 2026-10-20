// @vitest-environment jsdom
/**
 * Veilleur - Abonnement Web Push côté navigateur
 */

import { describe, it, expect, vi } from 'vitest';
import { decoderClePublique, pushSupporte, abonnerPush } from '@/client/utils/notificationsPush';

describe('decoderClePublique', () => {
  it('convertit une clé base64url (sans remplissage) en octets', () => {
    // "hello" → aGVsbG8 en base64url ; "-_" couvre les caractères remplacés
    expect(Array.from(decoderClePublique('aGVsbG8'))).toEqual([104, 101, 108, 108, 111]);
    expect(Array.from(decoderClePublique('-_8'))).toEqual([251, 255]);
  });
});

describe('pushSupporte', () => {
  it('exige serviceWorker, PushManager et Notification', () => {
    expect(pushSupporte()).toBe(false);
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { requestPermission: vi.fn() });
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    expect(pushSupporte()).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe('abonnerPush', () => {
  it('demande la permission, s\'abonne avec la clé serveur et renvoie le JSON de l\'abonnement', async () => {
    const subscribe = vi.fn().mockResolvedValue({ toJSON: () => ({ endpoint: 'https://push/x', keys: { p256dh: 'p', auth: 'a' } }) });
    const inscription = { pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe } };
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: vi.fn().mockResolvedValue(inscription), register: vi.fn(), ready: Promise.resolve(inscription) },
      configurable: true,
    });
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') });

    const json = await abonnerPush('aGVsbG8');

    expect(json).toEqual({ endpoint: 'https://push/x', keys: { p256dh: 'p', auth: 'a' } });
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(Array.from(subscribe.mock.calls[0]![0].applicationServerKey)).toEqual([104, 101, 108, 108, 111]);

    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied') });
    await expect(abonnerPush('aGVsbG8')).rejects.toThrow('Permission refusée');
    vi.unstubAllGlobals();
  });
});
