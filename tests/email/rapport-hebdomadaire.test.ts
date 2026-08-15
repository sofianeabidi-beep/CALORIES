import { describe, expect, it } from 'vitest';
import { genererHtmlRapport, type DonneesRapportHebdomadaire } from '@/lib/email/rapport-hebdomadaire';

const BASE: DonneesRapportHebdomadaire = {
  prenom: 'Alex',
  dateDebut: '2026-08-10',
  dateFin: '2026-08-16',
  completude: { taux: 1, joursRenseignes: 7, joursEstimes: 0, joursManquants: 0, joursTotal: 7 },
  deficitCumuleKcal: 1500,
  kgTheoriques: 0.19,
  tendance: {
    kgParSemaine: -0.4,
    pourcentPoidsParSemaine: -0.5,
    joursObserves: 7,
    poidsDebutKg: 80,
    poidsFinKg: 79.6,
  },
  recit: null,
  lienBilan: 'https://exemple.fr/bilan',
};

describe('genererHtmlRapport', () => {
  it('inclut la salutation avec le prénom', () => {
    const html = genererHtmlRapport(BASE);
    expect(html).toContain('Bonjour Alex,');
  });

  it('retombe sur une salutation neutre sans prénom', () => {
    const html = genererHtmlRapport({ ...BASE, prenom: null });
    expect(html).toContain('Bonjour,');
    expect(html).not.toContain('Bonjour Vous');
  });

  it('affiche la perte de poids cumulée en kg, pas le déficit en avant', () => {
    const html = genererHtmlRapport(BASE);
    expect(html).toContain('Perte de poids cumulée');
    expect(html).toContain('0,19');
    expect(html).toContain('kcal de déficit cumulé');
    expect(html).toMatch(/1.500 kcal/);
  });

  it('bascule en « prise de poids » quand le déficit cumulé est négatif', () => {
    const html = genererHtmlRapport({ ...BASE, deficitCumuleKcal: -800, kgTheoriques: -0.1 });
    expect(html).toContain('Prise de poids cumulée');
  });

  it('affiche toujours la complétude, jamais un cumul isolé', () => {
    const html = genererHtmlRapport(BASE);
    expect(html).toContain('100 %');
    expect(html).toContain('7 sur 7');
  });

  it('signale un taux de complétude fragile', () => {
    const html = genererHtmlRapport({
      ...BASE,
      completude: { taux: 0.3, joursRenseignes: 2, joursEstimes: 0, joursManquants: 5, joursTotal: 7 },
    });
    expect(html).toContain('trop de jours manquent');
  });

  it('affiche la tendance quand elle est disponible', () => {
    const html = genererHtmlRapport(BASE);
    expect(html).toContain('-0,40 kg/semaine');
  });

  it('affiche un message honnête sans tendance', () => {
    const html = genererHtmlRapport({ ...BASE, tendance: null });
    expect(html).toContain('Pas encore assez de pesées');
  });

  it('inclut le récit IA quand il est fourni', () => {
    const html = genererHtmlRapport({
      ...BASE,
      recit: {
        resume: 'Une semaine régulière.',
        constats: ['Constat un'],
        axesAmelioration: ['Axe un'],
      },
    });
    expect(html).toContain('Une semaine régulière.');
    expect(html).toContain('Constat un');
    expect(html).toContain('Axe un');
    expect(html).toContain('pas un avis médical');
  });

  it('omet le bloc récit quand il est absent', () => {
    const html = genererHtmlRapport(BASE);
    expect(html).not.toContain('pas un avis médical');
  });

  it('échappe le HTML du prénom et du récit', () => {
    const html = genererHtmlRapport({
      ...BASE,
      prenom: '<script>alert(1)</script>',
      recit: { resume: '<b>gras</b>', constats: [], axesAmelioration: [] },
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>gras</b>');
  });

  it('inclut le lien vers le bilan', () => {
    const html = genererHtmlRapport(BASE);
    expect(html).toContain('https://exemple.fr/bilan');
  });
});
