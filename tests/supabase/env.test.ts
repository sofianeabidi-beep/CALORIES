import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configPublique, cleServiceRole } from '@/lib/supabase/env';

/**
 * Ce module a cassé deux fois en production le même jour (2026-08-12).
 *
 * D'abord une puce « • » (U+2022) glissée dans la valeur collée sur
 * Vercel a fait échouer la construction des en-têtes HTTP du client
 * Supabase — une erreur `ByteString` qui ne pointe vers aucune cause.
 * Un premier filtre (caractères hors ASCII) a corrigé ce cas précis,
 * mais aurait laissé passer une valeur non vide et pourtant fausse —
 * un tronçon de JWT perdu au copier-coller, par exemple — provoquant
 * cette fois une « Invalid API key » renvoyée par Supabase lui-même.
 *
 * Ces tests figent la validation de **forme**, pas seulement de
 * présence : une clé anonyme doit avoir la forme d'un JWT (trois
 * segments base64url séparés par un point), une URL doit pointer vers
 * `*.supabase.co`. Tout le reste retombe sur les vraies valeurs.
 */

const CLE_ANON_VALIDE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.LIJlCQQNVsbwNB-kR-nOxltLaNgPQECqCrxyA2J6x7M';

const ENV_ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env = { ...ENV_ORIGINAL };
});

afterEach(() => {
  process.env = ENV_ORIGINAL;
});

describe('configPublique', () => {
  it('rend les variables telles quelles quand elles sont propres et bien formées', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = CLE_ANON_VALIDE;

    expect(configPublique()).toEqual({
      url: 'https://exemple.supabase.co',
      cleAnon: CLE_ANON_VALIDE,
    });
  });

  it('retire un caractère hors ASCII glissé par erreur, sans rien casser', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = `•${CLE_ANON_VALIDE}`;

    expect(configPublique().cleAnon).toBe(CLE_ANON_VALIDE);
  });

  it('retombe sur la valeur par défaut si la variable ne contient plus que du bruit', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = '•••';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '•••';

    const config = configPublique();
    expect(config.url).toBe('https://mwwndxahugyloylsmdkw.supabase.co');
    expect(config.cleAnon).toMatch(/^eyJ/);
  });

  it('retombe sur la valeur par défaut si la variable est absente', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const config = configPublique();
    expect(config.url).toBe('https://mwwndxahugyloylsmdkw.supabase.co');
    expect(config.cleAnon).toMatch(/^eyJ/);
  });

  it('retombe sur la valeur par défaut face à un texte non vide mais mal formé', () => {
    // Le cas qui a échappé au premier correctif : ni vide, ni du bruit
    // évident, juste un tronçon de JWT perdu au copier-coller.
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'exemple.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = CLE_ANON_VALIDE.split('.').slice(0, 2).join('.');

    const config = configPublique();
    expect(config.url).toBe('https://mwwndxahugyloylsmdkw.supabase.co');
    expect(config.cleAnon).toBe(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13d25keGFodWd5bG95bHNtZGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNzM2NTYsImV4cCI6MjEwMTk0OTY1Nn0.LIJlCQQNVsbwNB-kR-nOxltLaNgPQECqCrxyA2J6x7M',
    );
  });
});

describe('cleServiceRole', () => {
  it('n’a aucun repli : une variable manquante doit bloquer, pas être devinée', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => cleServiceRole()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('rejette une valeur qui ne contient que du bruit', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = '•••';
    expect(() => cleServiceRole()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('nettoie une valeur autrement correcte', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = '•secret-de-service';
    expect(cleServiceRole()).toBe('secret-de-service');
  });
});
