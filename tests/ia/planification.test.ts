import { describe, expect, it } from 'vitest';
import { analyserReponsePlanification } from '@/lib/ia/analyse-planification';

/**
 * Ne teste que la partie pure — extraction et validation de la réponse
 * de l'API Messages. Même raison que pour la recette et la
 * recommandation : pas de clé, pas de connexion en CI.
 */

function reponseAvecOutil(input: unknown) {
  return {
    content: [{ type: 'tool_use', name: 'planifier_semaine', input }],
  };
}

function jourValide(jour: string) {
  return {
    jour,
    repas: [
      { repas: 'petit_dejeuner', libelle: 'Porridge et fruits', kcalEstime: 400 },
      { repas: 'dejeuner', libelle: 'Poulet, riz, légumes', kcalEstime: 700 },
      { repas: 'diner', libelle: 'Soupe et pain complet', kcalEstime: 500 },
    ],
  };
}

const PLANIFICATION_VALIDE = {
  jours: [
    jourValide('Lundi'),
    jourValide('Mardi'),
    jourValide('Mercredi'),
    jourValide('Jeudi'),
    jourValide('Vendredi'),
    jourValide('Samedi'),
    jourValide('Dimanche'),
  ],
  listeCourses: [
    { categorie: 'Fruits et légumes', item: 'Carottes', quantite: '1 kg' },
    { categorie: 'Épicerie', item: 'Riz complet', quantite: '500 g' },
  ],
};

describe('analyserReponsePlanification', () => {
  it('accepte une planification bien formée', () => {
    const resultat = analyserReponsePlanification(reponseAvecOutil(PLANIFICATION_VALIDE));

    expect(resultat).toEqual({ succes: true, donnees: PLANIFICATION_VALIDE });
  });

  it('accepte un nombre de jours légèrement différent de 7', () => {
    const sixJours = { ...PLANIFICATION_VALIDE, jours: PLANIFICATION_VALIDE.jours.slice(0, 6) };
    expect(analyserReponsePlanification(reponseAvecOutil(sixJours)).succes).toBe(true);
  });

  it('relaie le message d’erreur renvoyé par l’API', () => {
    const resultat = analyserReponsePlanification({
      error: { message: 'overloaded_error' },
    });

    expect(resultat).toEqual({ succes: false, erreur: 'overloaded_error' });
  });

  it('échoue proprement quand aucun bloc tool_use n’est présent', () => {
    const resultat = analyserReponsePlanification({
      content: [{ type: 'text', text: 'Désolé, je ne peux pas planifier cela.' }],
    });

    expect(resultat.succes).toBe(false);
  });

  it('échoue proprement sur un contenu vide', () => {
    expect(analyserReponsePlanification({ content: [] }).succes).toBe(false);
    expect(analyserReponsePlanification({}).succes).toBe(false);
  });

  it('ignore un tool_use portant un autre nom', () => {
    const resultat = analyserReponsePlanification({
      content: [{ type: 'tool_use', name: 'autre_outil', input: PLANIFICATION_VALIDE }],
    });

    expect(resultat.succes).toBe(false);
  });

  it('rejette trop peu de jours', () => {
    const troisJours = { ...PLANIFICATION_VALIDE, jours: PLANIFICATION_VALIDE.jours.slice(0, 3) };
    expect(analyserReponsePlanification(reponseAvecOutil(troisJours)).succes).toBe(false);
  });

  it('rejette une liste de courses vide', () => {
    const resultat = analyserReponsePlanification(
      reponseAvecOutil({ ...PLANIFICATION_VALIDE, listeCourses: [] }),
    );

    expect(resultat.succes).toBe(false);
  });

  it('rejette un repas hors énumération', () => {
    const jourInvalide = {
      jour: 'Lundi',
      repas: [{ repas: 'brunch', libelle: 'Test', kcalEstime: 400 }],
    };
    const resultat = analyserReponsePlanification(
      reponseAvecOutil({ ...PLANIFICATION_VALIDE, jours: [jourInvalide] }),
    );

    expect(resultat.succes).toBe(false);
  });

  it('rejette un champ manquant', () => {
    const resultat = analyserReponsePlanification(
      reponseAvecOutil({ jours: PLANIFICATION_VALIDE.jours }),
    );

    expect(resultat.succes).toBe(false);
  });
});
