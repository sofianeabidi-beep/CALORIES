import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configPublique, cleServiceRole } from '@/lib/supabase/env';

/**
 * Ce module a cassé une fois en production : une puce « • » (U+2022)
 * glissée dans une variable collée sur Vercel a fait échouer la
 * construction des en-têtes HTTP du client Supabase, avec une erreur
 * qui ne parle que de `ByteString` — rien qui pointe vers la cause.
 * Ces tests figent le nettoyage qui rend ce genre de faute sans
 * conséquence.
 */

const ENV_ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env = { ...ENV_ORIGINAL };
});

afterEach(() => {
  process.env = ENV_ORIGINAL;
});

describe('configPublique', () => {
  it('rend les variables telles quelles quand elles sont propres', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'une-cle-propre';

    expect(configPublique()).toEqual({
      url: 'https://exemple.supabase.co',
      cleAnon: 'une-cle-propre',
    });
  });

  it('retire un caractère hors ASCII glissé par erreur, sans rien casser', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemple.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '•une-cle-avec-une-puce';

    expect(configPublique().cleAnon).toBe('une-cle-avec-une-puce');
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
