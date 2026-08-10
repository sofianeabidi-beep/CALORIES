import { describe, expect, it } from 'vitest';
import { schemaProgramme, type ContexteGardefous } from '@/lib/validations/programme';
import { schemaConsentements, schemaProfil } from '@/lib/validations/profil';
import { schemaEntree, schemaPesee } from '@/lib/validations/journal';

const AUJOURDHUI = '2026-08-10';

const HOMME: ContexteGardefous = { sexe: 'h', tailleCm: 180 };
const FEMME: ContexteGardefous = { sexe: 'f', tailleCm: 165 };

const PROGRAMME_VALIDE = {
  type: 'deficit' as const,
  dateDebut: '2026-08-10',
  poidsDepartKg: 80,
  poidsCibleKg: 75,
  allureCibleKgSemaine: -0.5,
  objectifKcal: 2000,
};

/** Messages des erreurs portant sur un champ donné. */
function erreursSur(resultat: { success: boolean; error?: { issues: readonly { path: PropertyKey[]; message: string }[] } }, champ: string): string[] {
  if (resultat.success || !resultat.error) return [];
  return resultat.error.issues
    .filter((issue) => issue.path[0] === champ)
    .map((issue) => issue.message);
}

describe('schemaProgramme — les garde-fous de la section 9', () => {
  it('accepte un programme conforme', () => {
    expect(schemaProgramme(HOMME).safeParse(PROGRAMME_VALIDE).success).toBe(true);
  });

  it('refuse un objectif sous le plancher, avec le plancher du bon sexe', () => {
    const homme = schemaProgramme(HOMME).safeParse({
      ...PROGRAMME_VALIDE,
      objectifKcal: 1400,
    });
    expect(homme.success).toBe(false);
    expect(erreursSur(homme, 'objectifKcal')[0]).toContain('1500');

    // 1 400 kcal passe pour une femme : le plancher est à 1 200.
    const femme = schemaProgramme(FEMME).safeParse({
      ...PROGRAMME_VALIDE,
      poidsDepartKg: 65,
      poidsCibleKg: 60,
      allureCibleKgSemaine: -0.4,
      objectifKcal: 1400,
    });
    expect(femme.success).toBe(true);
  });

  it('oriente vers un professionnel plutôt que de sermonner', () => {
    const resultat = schemaProgramme(FEMME).safeParse({
      ...PROGRAMME_VALIDE,
      poidsDepartKg: 65,
      poidsCibleKg: 60,
      allureCibleKgSemaine: -0.4,
      objectifKcal: 800,
    });

    const message = erreursSur(resultat, 'objectifKcal')[0] ?? '';
    expect(message).toContain('professionnel de santé');
    expect(message).not.toMatch(/dangereu|interdit|erreur/i);
  });

  it('refuse un poids cible sous un IMC de 18,5 et indique le plancher', () => {
    const resultat = schemaProgramme(HOMME).safeParse({
      ...PROGRAMME_VALIDE,
      poidsCibleKg: 55,
    });

    expect(resultat.success).toBe(false);
    // 18,5 × 1,8² = 59,9 kg
    expect(erreursSur(resultat, 'poidsCibleKg')[0]).toContain('59.9');
  });

  it('refuse une allure au-delà de 1 % du poids par semaine', () => {
    const resultat = schemaProgramme(HOMME).safeParse({
      ...PROGRAMME_VALIDE,
      allureCibleKgSemaine: -1.5,
    });

    expect(resultat.success).toBe(false);
    expect(erreursSur(resultat, 'allureCibleKgSemaine')[0]).toContain('0.80');
  });

  it('borne une prise de masse comme une perte', () => {
    const resultat = schemaProgramme(HOMME).safeParse({
      ...PROGRAMME_VALIDE,
      type: 'surplus',
      poidsCibleKg: 85,
      allureCibleKgSemaine: 1.5,
    });

    expect(resultat.success).toBe(false);
    expect(erreursSur(resultat, 'allureCibleKgSemaine')).toHaveLength(1);
  });

  it('refuse une date de fin antérieure au début', () => {
    const resultat = schemaProgramme(HOMME).safeParse({
      ...PROGRAMME_VALIDE,
      dateFin: '2026-08-09',
    });

    expect(resultat.success).toBe(false);
    expect(erreursSur(resultat, 'dateFin')).toHaveLength(1);
  });

  it('accepte un programme sans cible ni objectif', () => {
    const resultat = schemaProgramme(HOMME).safeParse({
      type: 'maintien',
      dateDebut: '2026-08-10',
      poidsDepartKg: 80,
    });

    expect(resultat.success).toBe(true);
  });

  it('refuse une date mal formée', () => {
    const resultat = schemaProgramme(HOMME).safeParse({
      ...PROGRAMME_VALIDE,
      dateDebut: '10/08/2026',
    });

    expect(resultat.success).toBe(false);
  });

  it('cumule les manquements plutôt que de s’arrêter au premier', () => {
    const resultat = schemaProgramme(HOMME).safeParse({
      ...PROGRAMME_VALIDE,
      objectifKcal: 900,
      poidsCibleKg: 50,
      allureCibleKgSemaine: -2,
    });

    expect(resultat.success).toBe(false);
    expect(resultat.error?.issues.length).toBe(3);
  });
});

describe('schemaProfil', () => {
  const PROFIL_VALIDE = {
    sexe: 'h' as const,
    dateNaissance: '1990-06-15',
    tailleCm: 180,
    niveauActivite: 'modere' as const,
  };

  it('accepte un majeur et applique les valeurs par défaut', () => {
    const resultat = schemaProfil(AUJOURDHUI).safeParse(PROFIL_VALIDE);

    expect(resultat.success).toBe(true);
    expect(resultat.data?.modeJoursManquants).toBe('neutre');
    expect(resultat.data?.modeDiscret).toBe(false);
    expect(resultat.data?.unitePoids).toBe('kg');
  });

  it('refuse un mineur', () => {
    const resultat = schemaProfil(AUJOURDHUI).safeParse({
      ...PROFIL_VALIDE,
      dateNaissance: '2010-06-15',
    });

    expect(resultat.success).toBe(false);
    expect(erreursSur(resultat, 'dateNaissance')[0]).toContain('18 ans');
  });

  it('accepte le jour des 18 ans, refuse la veille', () => {
    expect(
      schemaProfil(AUJOURDHUI).safeParse({
        ...PROFIL_VALIDE,
        dateNaissance: '2008-08-10',
      }).success,
    ).toBe(true);

    expect(
      schemaProfil(AUJOURDHUI).safeParse({
        ...PROFIL_VALIDE,
        dateNaissance: '2008-08-11',
      }).success,
    ).toBe(false);
  });

  it('refuse une taille hors bornes', () => {
    expect(
      schemaProfil(AUJOURDHUI).safeParse({ ...PROFIL_VALIDE, tailleCm: 80 }).success,
    ).toBe(false);
  });
});

describe('schemaConsentements', () => {
  it('exige les deux consentements séparément', () => {
    expect(
      schemaConsentements.safeParse({ cguAcceptees: true, consentementSante: true })
        .success,
    ).toBe(true);

    // Accepter les CGU ne vaut pas consentement au traitement de
    // données de santé (RGPD art. 9).
    const sansSante = schemaConsentements.safeParse({
      cguAcceptees: true,
      consentementSante: false,
    });
    expect(sansSante.success).toBe(false);
    expect(erreursSur(sansSante, 'consentementSante')[0]).toContain('données de santé');

    expect(
      schemaConsentements.safeParse({ cguAcceptees: false, consentementSante: true })
        .success,
    ).toBe(false);
  });
});

describe('schemaEntree', () => {
  const ENTREE_VALIDE = {
    id: '3f2a8c1e-5b7d-4e9a-8c2f-1d6b4a9e3c7f',
    date: '2026-08-10',
    libelle: 'Pain complet',
    repas: 'petit_dejeuner' as const,
    quantite: 60,
    kcal: 145,
  };

  it('accepte une saisie rapide minimale', () => {
    const resultat = schemaEntree.safeParse(ENTREE_VALIDE);

    expect(resultat.success).toBe(true);
    expect(resultat.data?.unite).toBe('g');
    expect(resultat.data?.source).toBe('rapide');
  });

  it('exige un identifiant client, pour que le rejeu soit idempotent', () => {
    const resultat = schemaEntree.safeParse({ ...ENTREE_VALIDE, id: 'pas-un-uuid' });

    expect(resultat.success).toBe(false);
  });

  it('refuse un libellé vide et une quantité nulle', () => {
    expect(schemaEntree.safeParse({ ...ENTREE_VALIDE, libelle: '   ' }).success).toBe(
      false,
    );
    expect(schemaEntree.safeParse({ ...ENTREE_VALIDE, quantite: 0 }).success).toBe(false);
  });

  it('accepte un apport nul mais refuse un apport négatif', () => {
    expect(schemaEntree.safeParse({ ...ENTREE_VALIDE, kcal: 0 }).success).toBe(true);
    expect(schemaEntree.safeParse({ ...ENTREE_VALIDE, kcal: -10 }).success).toBe(false);
  });

  it('refuse une entrée rattachée à deux référentiels à la fois', () => {
    const resultat = schemaEntree.safeParse({
      ...ENTREE_VALIDE,
      alimentId: '11111111-1111-4111-8111-111111111111',
      recetteId: '22222222-2222-4222-8222-222222222222',
    });

    expect(resultat.success).toBe(false);
  });
});

describe('schemaPesee', () => {
  const PESEE_VALIDE = {
    id: '3f2a8c1e-5b7d-4e9a-8c2f-1d6b4a9e3c7f',
    date: '2026-08-10',
    poidsKg: 79.4,
  };

  it('accepte une pesée ordinaire', () => {
    const resultat = schemaPesee.safeParse(PESEE_VALIDE);

    expect(resultat.success).toBe(true);
    expect(resultat.data?.confirmee).toBe(false);
    expect(resultat.data?.source).toBe('manuelle');
  });

  it('écarte une valeur manifestement saisie dans la mauvaise unité', () => {
    // 175 lb saisis comme des kg passeraient ; 175 kg reste plausible.
    // Ce sont les valeurs impossibles qu'on écarte, pas les surprenantes.
    expect(schemaPesee.safeParse({ ...PESEE_VALIDE, poidsKg: 7.9 }).success).toBe(false);
    expect(schemaPesee.safeParse({ ...PESEE_VALIDE, poidsKg: 794 }).success).toBe(false);
  });
});
