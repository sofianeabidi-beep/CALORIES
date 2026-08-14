import { describe, expect, it } from 'vitest';
import { analyserReponseRecette } from '@/lib/ia/analyse-recette';

/**
 * Ne teste que la partie pure — extraction et validation de la réponse
 * de l'API Messages. Même raison que pour la recommandation et
 * l'estimation : pas de clé, pas de connexion en CI.
 */

function reponseAvecOutil(input: unknown) {
  return {
    content: [{ type: 'tool_use', name: 'proposer_recette', input }],
  };
}

const RECETTE_VALIDE = {
  portions: 1,
  ingredients: [
    { item: 'Lentilles cuites', quantite: '150 g' },
    { item: 'Thon au naturel', quantite: '1 boîte' },
  ],
  etapes: ['Égoutter le thon.', 'Mélanger avec les lentilles.'],
};

describe('analyserReponseRecette', () => {
  it('accepte une recette bien formée', () => {
    const resultat = analyserReponseRecette(reponseAvecOutil(RECETTE_VALIDE));

    expect(resultat).toEqual({ succes: true, donnees: RECETTE_VALIDE });
  });

  it('accepte une recette sans portions (champ optionnel)', () => {
    const { portions: _portions, ...sansPortions } = RECETTE_VALIDE;
    const resultat = analyserReponseRecette(reponseAvecOutil(sansPortions));

    expect(resultat.succes).toBe(true);
  });

  it('relaie le message d’erreur renvoyé par l’API', () => {
    const resultat = analyserReponseRecette({
      error: { message: 'overloaded_error' },
    });

    expect(resultat).toEqual({ succes: false, erreur: 'overloaded_error' });
  });

  it('échoue proprement quand aucun bloc tool_use n’est présent', () => {
    const resultat = analyserReponseRecette({
      content: [{ type: 'text', text: 'Désolé, je ne peux pas donner cette recette.' }],
    });

    expect(resultat.succes).toBe(false);
  });

  it('échoue proprement sur un contenu vide', () => {
    expect(analyserReponseRecette({ content: [] }).succes).toBe(false);
    expect(analyserReponseRecette({}).succes).toBe(false);
  });

  it('ignore un tool_use portant un autre nom', () => {
    const resultat = analyserReponseRecette({
      content: [{ type: 'tool_use', name: 'autre_outil', input: RECETTE_VALIDE }],
    });

    expect(resultat.succes).toBe(false);
  });

  it('rejette un tableau d’ingrédients vide', () => {
    const resultat = analyserReponseRecette(
      reponseAvecOutil({ ...RECETTE_VALIDE, ingredients: [] }),
    );

    expect(resultat.succes).toBe(false);
  });

  it('rejette un tableau d’étapes vide', () => {
    const resultat = analyserReponseRecette(reponseAvecOutil({ ...RECETTE_VALIDE, etapes: [] }));

    expect(resultat.succes).toBe(false);
  });

  it('rejette un champ manquant', () => {
    const resultat = analyserReponseRecette(
      reponseAvecOutil({ ingredients: RECETTE_VALIDE.ingredients }),
    );

    expect(resultat.succes).toBe(false);
  });
});
