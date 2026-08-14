import { describe, expect, it } from 'vitest';
import { analyserReponseEstimation } from '@/lib/ia/analyse';

/**
 * Ne teste que la partie pure — extraction et validation de la réponse
 * de l'API Messages. L'appel réseau lui-même (`estimerAliment`) n'est
 * pas testé ici : pas de clé, pas de connexion en CI, et un test qui
 * dépendrait d'un vrai appel coûterait à chaque exécution sans rien
 * garantir de plus que ce que ces cas couvrent déjà.
 */

function reponseAvecOutil(input: unknown) {
  return {
    content: [{ type: 'tool_use', name: 'enregistrer_estimation', input }],
  };
}

const SANDWICH = {
  libelle: 'Sandwich jambon-beurre',
  quantiteG: 180,
  kcal: 420,
  proteinesG: 18,
  glucidesG: 38,
  lipidesG: 20,
};

const POMME = {
  libelle: 'Pomme',
  quantiteG: 150,
  kcal: 80,
  proteinesG: 0.5,
  glucidesG: 20,
  lipidesG: 0.3,
};

describe('analyserReponseEstimation', () => {
  it('accepte un plat composé comme un seul aliment', () => {
    const resultat = analyserReponseEstimation(reponseAvecOutil({ aliments: [SANDWICH] }));

    expect(resultat).toEqual({ succes: true, donnees: [SANDWICH] });
  });

  it('accepte plusieurs aliments distincts, chacun avec ses propres valeurs', () => {
    const resultat = analyserReponseEstimation(
      reponseAvecOutil({ aliments: [SANDWICH, POMME] }),
    );

    expect(resultat).toEqual({ succes: true, donnees: [SANDWICH, POMME] });
  });

  it('relaie le message d’erreur renvoyé par l’API', () => {
    const resultat = analyserReponseEstimation({
      error: { message: 'overloaded_error' },
    });

    expect(resultat).toEqual({ succes: false, erreur: 'overloaded_error' });
  });

  it('échoue proprement quand aucun bloc tool_use n’est présent', () => {
    const resultat = analyserReponseEstimation({
      content: [{ type: 'text', text: 'Désolé, je ne peux pas estimer cela.' }],
    });

    expect(resultat.succes).toBe(false);
  });

  it('échoue proprement sur un contenu vide', () => {
    expect(analyserReponseEstimation({ content: [] }).succes).toBe(false);
    expect(analyserReponseEstimation({}).succes).toBe(false);
  });

  it('ignore un tool_use portant un autre nom', () => {
    const resultat = analyserReponseEstimation({
      content: [{ type: 'tool_use', name: 'autre_outil', input: { aliments: [SANDWICH] } }],
    });

    expect(resultat.succes).toBe(false);
  });

  it('rejette des valeurs hors bornes plutôt que de les propager', () => {
    const resultat = analyserReponseEstimation(
      reponseAvecOutil({ aliments: [{ ...SANDWICH, kcal: -50 }] }),
    );

    expect(resultat.succes).toBe(false);
  });

  it('rejette un libellé vide', () => {
    const resultat = analyserReponseEstimation(
      reponseAvecOutil({ aliments: [{ ...SANDWICH, libelle: '' }] }),
    );

    expect(resultat.succes).toBe(false);
  });

  it('rejette une quantité aberrante plutôt que de la propager', () => {
    // Personne ne mange 10 kg en un repas : mieux vaut refuser une
    // estimation absurde que de l'afficher comme si elle était fiable.
    const resultat = analyserReponseEstimation(
      reponseAvecOutil({ aliments: [{ ...SANDWICH, quantiteG: 10_000 }] }),
    );

    expect(resultat.succes).toBe(false);
  });

  it('rejette un champ manquant dans un aliment', () => {
    const { kcal: _kcal, ...sansKcal } = SANDWICH;
    const resultat = analyserReponseEstimation(reponseAvecOutil({ aliments: [sansKcal] }));

    expect(resultat.succes).toBe(false);
  });

  it('rejette un tableau d’aliments vide', () => {
    const resultat = analyserReponseEstimation(reponseAvecOutil({ aliments: [] }));

    expect(resultat.succes).toBe(false);
  });
});
