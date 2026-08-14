import { describe, expect, it } from 'vitest';
import { analyserReponseRecommandation } from '@/lib/ia/analyse-recommandation';

/**
 * Ne teste que la partie pure — extraction et validation de la réponse
 * de l'API Messages. L'appel réseau lui-même (`suggererRepas`) n'est pas
 * testé ici, même raison que pour l'estimation : pas de clé, pas de
 * connexion en CI, et un test qui dépendrait d'un vrai appel coûterait à
 * chaque exécution sans rien garantir de plus que ce que ces cas couvrent
 * déjà.
 */

function reponseAvecOutil(input: unknown) {
  return {
    content: [{ type: 'tool_use', name: 'proposer_repas', input }],
  };
}

const RECOMMANDATION_VALIDE = {
  suggestions: [
    {
      libelle: 'Salade de lentilles au thon',
      kcalEstime: 450,
      raison: 'Riche en protéines, tient dans le restant.',
    },
    { libelle: 'Yaourt et fruits', kcalEstime: 200, raison: 'Léger, complète sans dépasser.' },
  ],
};

describe('analyserReponseRecommandation', () => {
  it('accepte une recommandation bien formée', () => {
    const resultat = analyserReponseRecommandation(reponseAvecOutil(RECOMMANDATION_VALIDE));

    expect(resultat).toEqual({ succes: true, donnees: RECOMMANDATION_VALIDE });
  });

  it('relaie le message d’erreur renvoyé par l’API', () => {
    const resultat = analyserReponseRecommandation({
      error: { message: 'overloaded_error' },
    });

    expect(resultat).toEqual({ succes: false, erreur: 'overloaded_error' });
  });

  it('échoue proprement quand aucun bloc tool_use n’est présent', () => {
    const resultat = analyserReponseRecommandation({
      content: [{ type: 'text', text: 'Désolé, je ne peux pas suggérer cela.' }],
    });

    expect(resultat.succes).toBe(false);
  });

  it('échoue proprement sur un contenu vide', () => {
    expect(analyserReponseRecommandation({ content: [] }).succes).toBe(false);
    expect(analyserReponseRecommandation({}).succes).toBe(false);
  });

  it('ignore un tool_use portant un autre nom', () => {
    const resultat = analyserReponseRecommandation({
      content: [{ type: 'tool_use', name: 'autre_outil', input: RECOMMANDATION_VALIDE }],
    });

    expect(resultat.succes).toBe(false);
  });

  it('rejette des valeurs hors bornes plutôt que de les propager', () => {
    const resultat = analyserReponseRecommandation(
      reponseAvecOutil({
        suggestions: [{ libelle: 'Test', kcalEstime: -50, raison: 'Négatif, impossible.' }],
      }),
    );

    expect(resultat.succes).toBe(false);
  });

  it('rejette un tableau de suggestions vide', () => {
    const resultat = analyserReponseRecommandation(reponseAvecOutil({ suggestions: [] }));

    expect(resultat.succes).toBe(false);
  });

  it('rejette un libellé vide', () => {
    const resultat = analyserReponseRecommandation(
      reponseAvecOutil({
        suggestions: [{ libelle: '', kcalEstime: 300, raison: 'Une raison.' }],
      }),
    );

    expect(resultat.succes).toBe(false);
  });

  it('rejette un champ manquant', () => {
    const resultat = analyserReponseRecommandation(
      reponseAvecOutil({
        suggestions: [{ libelle: 'Test', kcalEstime: 300 }],
      }),
    );

    expect(resultat.succes).toBe(false);
  });
});
