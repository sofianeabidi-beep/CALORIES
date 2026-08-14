import { describe, expect, it } from 'vitest';
import { analyserReponsePeriode } from '@/lib/ia/analyse-bilan-periode';

/**
 * Ne teste que la partie pure — extraction et validation de la réponse
 * de l'API Messages. L'appel réseau lui-même (`analyserPeriode`) n'est
 * pas testé ici, même raison que pour l'estimation et la recommandation :
 * pas de clé, pas de connexion en CI.
 */

function reponseAvecOutil(input: unknown) {
  return {
    content: [{ type: 'tool_use', name: 'analyser_periode', input }],
  };
}

const ANALYSE_VALIDE = {
  resume: 'Période globalement stable, avec un relâchement sur la dernière semaine.',
  constats: [
    'Déficit régulier sur les six premières semaines.',
    'Trois jours non renseignés d’affilée en fin de période.',
  ],
  axesAmelioration: [
    'Reprendre une saisie quotidienne pour fiabiliser la tendance.',
    'Revenir à un apport plus proche de l’objectif après la pause récente.',
  ],
};

describe('analyserReponsePeriode', () => {
  it('accepte une analyse bien formée', () => {
    const resultat = analyserReponsePeriode(reponseAvecOutil(ANALYSE_VALIDE));

    expect(resultat).toEqual({ succes: true, donnees: ANALYSE_VALIDE });
  });

  it('relaie le message d’erreur renvoyé par l’API', () => {
    const resultat = analyserReponsePeriode({
      error: { message: 'overloaded_error' },
    });

    expect(resultat).toEqual({ succes: false, erreur: 'overloaded_error' });
  });

  it('échoue proprement quand aucun bloc tool_use n’est présent', () => {
    const resultat = analyserReponsePeriode({
      content: [{ type: 'text', text: 'Désolé, je ne peux pas analyser cela.' }],
    });

    expect(resultat.succes).toBe(false);
  });

  it('échoue proprement sur un contenu vide', () => {
    expect(analyserReponsePeriode({ content: [] }).succes).toBe(false);
    expect(analyserReponsePeriode({}).succes).toBe(false);
  });

  it('ignore un tool_use portant un autre nom', () => {
    const resultat = analyserReponsePeriode({
      content: [{ type: 'tool_use', name: 'autre_outil', input: ANALYSE_VALIDE }],
    });

    expect(resultat.succes).toBe(false);
  });

  it('rejette un résumé vide', () => {
    const resultat = analyserReponsePeriode(
      reponseAvecOutil({ ...ANALYSE_VALIDE, resume: '' }),
    );

    expect(resultat.succes).toBe(false);
  });

  it('rejette un tableau de constats vide', () => {
    const resultat = analyserReponsePeriode(
      reponseAvecOutil({ ...ANALYSE_VALIDE, constats: [] }),
    );

    expect(resultat.succes).toBe(false);
  });

  it('rejette un champ manquant', () => {
    const { axesAmelioration: _axes, ...sansAxes } = ANALYSE_VALIDE;
    const resultat = analyserReponsePeriode(reponseAvecOutil(sansAxes));

    expect(resultat.succes).toBe(false);
  });
});
