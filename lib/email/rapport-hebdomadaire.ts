import type { Completude, DateIso, TendancePoids } from '@/lib/calcul';
import type { AnalysePeriode } from '@/lib/ia/analyse-bilan-periode';

const entier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const deuxDecimales = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Sous ce taux, le cumul de la semaine ne veut plus dire grand-chose — même seuil que `IndicateurCumule`. */
const SEUIL_COMPLETUDE_FRAGILE = 0.6;

export interface DonneesRapportHebdomadaire {
  readonly prenom: string | null;
  readonly dateDebut: DateIso;
  readonly dateFin: DateIso;
  readonly completude: Completude;
  readonly deficitCumuleKcal: number;
  readonly kgTheoriques: number;
  readonly tendance: TendancePoids | null;
  readonly recit: AnalysePeriode | null;
  readonly lienBilan: string;
}

function formaterDateLongue(date: DateIso): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Génère le HTML du rapport hebdomadaire envoyé chaque lundi.
 *
 * Styles entièrement en ligne — les clients mail ignorent le CSS
 * externe. Même règle qu'ailleurs dans l'application : la complétude
 * s'affiche toujours à côté du cumul, jamais un chiffre cumulé isolé de
 * sa fiabilité.
 */
export function genererHtmlRapport(donnees: DonneesRapportHebdomadaire): string {
  const enDeficit = donnees.deficitCumuleKcal >= 0;
  const pourcentComplet = Math.round(donnees.completude.taux * 100);
  const fragile = donnees.completude.taux < SEUIL_COMPLETUDE_FRAGILE;

  const salutation = donnees.prenom !== null && donnees.prenom.length > 0 ? `Bonjour ${echapper(donnees.prenom)},` : 'Bonjour,';

  const ligneTendance =
    donnees.tendance === null
      ? 'Pas encore assez de pesées pour établir une tendance cette semaine.'
      : `Rythme : <strong>${deuxDecimales.format(donnees.tendance.kgParSemaine)} kg/semaine</strong>, de ${deuxDecimales.format(donnees.tendance.poidsDebutKg)} kg à ${deuxDecimales.format(donnees.tendance.poidsFinKg)} kg.`;

  const blocRecit =
    donnees.recit === null
      ? ''
      : `
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #ded5c2;">
      <p style="margin:0 0 12px;color:#2b2620;">${echapper(donnees.recit.resume)}</p>
      ${
        donnees.recit.constats.length > 0
          ? `<p style="margin:0 0 4px;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;color:#6b6255;">Constats</p>
             <ul style="margin:0 0 12px;padding-left:20px;color:#6b6255;">${donnees.recit.constats.map((c) => `<li>${echapper(c)}</li>`).join('')}</ul>`
          : ''
      }
      ${
        donnees.recit.axesAmelioration.length > 0
          ? `<p style="margin:0 0 4px;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;color:#6b6255;">Axes d’amélioration</p>
             <ul style="margin:0;padding-left:20px;color:#6b6255;">${donnees.recit.axesAmelioration.map((a) => `<li>${echapper(a)}</li>`).join('')}</ul>`
          : ''
      }
      <p style="margin:12px 0 0;font-size:13px;color:#6b6255;">Analyse générée par IA à partir de vos chiffres — une lecture parmi d’autres, pas un avis médical.</p>
    </div>`;

  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#f1ece1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
      <p style="margin:0 0 4px;font-style:italic;color:#5c4a30;">Symbio</p>
      <h1 style="margin:0 0 4px;font-size:22px;color:#2b2620;">Votre semaine du ${formaterDateLongue(donnees.dateDebut)} au ${formaterDateLongue(donnees.dateFin)}</h1>
      <p style="margin:16px 0 0;">${salutation}</p>

      <div style="margin-top:20px;padding:20px;background:#ffffff;border:1px solid #ded5c2;border-radius:12px;">
        <p style="margin:0;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;color:#6b6255;">${enDeficit ? 'Perte de poids cumulée' : 'Prise de poids cumulée'}</p>
        <p style="margin:4px 0 0;font-size:32px;font-weight:300;color:${enDeficit ? '#1f6f78' : '#c77b30'};">${deuxDecimales.format(Math.abs(donnees.kgTheoriques))} <span style="font-size:16px;color:#6b6255;">kg</span></p>
        <p style="margin:8px 0 0;color:#6b6255;">Soit ${entier.format(Math.abs(donnees.deficitCumuleKcal))} kcal de ${enDeficit ? 'déficit' : 'surplus'} cumulé.</p>
        <p style="margin:12px 0 0;padding-top:12px;border-top:1px solid #ded5c2;color:${fragile ? '#b3402f' : '#6b6255'};">
          <strong>${pourcentComplet} %</strong> des jours renseignés (${donnees.completude.joursRenseignes} sur ${donnees.completude.joursTotal})${fragile ? ' — trop de jours manquent pour que ce chiffre soit fiable.' : '.'}
        </p>
      </div>

      <p style="margin:20px 0 0;color:#2b2620;">${ligneTendance}</p>

      ${blocRecit}

      <div style="margin-top:28px;text-align:center;">
        <a href="${donnees.lienBilan}" style="display:inline-block;padding:12px 24px;background:#1f6f78;color:#ffffff;text-decoration:none;border-radius:8px;">Voir le détail sur Symbio</a>
      </div>

      <p style="margin:32px 0 0;text-align:center;font-size:12px;color:#6b6255;">Symbio mesure et restitue. Il ne donne aucun conseil médical ni nutritionnel.</p>
    </div>
  </body>
</html>`;
}
