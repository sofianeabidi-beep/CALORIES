import 'server-only';

import { NextResponse } from 'next/server';
import { creerClientAdmin } from '@/lib/supabase/server';
import {
  ajouterJours,
  calculerCompletude,
  cumulerDeficit,
  lisserPesees,
  lundiDeLaSemaine,
  plageDates,
  tendancePoids,
  type JourneeCalculee,
} from '@/lib/calcul';
import { aujourdhuiIso } from '@/lib/dates-app';
import { analyserPeriode } from '@/lib/ia/bilan-periode';
import { envoyerEmail } from '@/lib/email/resend';
import { genererHtmlRapport } from '@/lib/email/rapport-hebdomadaire';

export const maxDuration = 60;

/**
 * Reconstitue les journées de la semaine, jours sans saisie compris —
 * même raison que `lireHistoriquePoids` : un calcul de complétude sur
 * une plage éparse mentirait par omission si les trous n'étaient pas
 * comblés en `manquant`.
 */
function completerJournees(
  dateDebut: string,
  dateFin: string,
  lignes: readonly {
    date: string;
    statut: 'renseigne' | 'estime' | 'manquant';
    apport_kcal: number;
    depense_retenue_kcal: number | null;
    deficit_kcal: number | null;
  }[],
): JourneeCalculee[] {
  const parDate = new Map(lignes.map((l) => [l.date, l] as const));
  return plageDates(dateDebut, dateFin).map((date) => {
    const ligne = parDate.get(date);
    if (ligne === undefined) {
      return { date, statut: 'manquant', apportRetenuKcal: null, depenseRetenueKcal: 0, deficitKcal: null };
    }
    return {
      date,
      statut: ligne.statut,
      apportRetenuKcal: ligne.statut === 'manquant' ? null : Number(ligne.apport_kcal),
      depenseRetenueKcal: Number(ligne.depense_retenue_kcal ?? 0),
      deficitKcal: ligne.deficit_kcal === null ? null : Number(ligne.deficit_kcal),
    };
  });
}

/**
 * Déclenchée chaque lundi par le cron Vercel (`vercel.json`). Un envoi
 * en échec (mail ou récit IA) n'interrompt jamais les suivants — la
 * boucle continue, les échecs sont recensés dans la réponse plutôt que
 * de faire échouer tout le lot pour un seul utilisateur.
 */
export async function GET(request: Request) {
  const enTete = request.headers.get('authorization');
  if (enTete !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erreur: 'Non autorisé.' }, { status: 401 });
  }

  // Garde de premier niveau : une erreur de configuration (ex. clé de
  // service manquante) doit rendre une réponse JSON lisible, pas un 500
  // muet — utile pour diagnostiquer un cron qui échoue en silence.
  try {
    return await genererEtEnvoyerRapports();
  } catch (erreur) {
    return NextResponse.json({ erreur: (erreur as Error).message }, { status: 500 });
  }
}

async function genererEtEnvoyerRapports(): Promise<NextResponse> {
  const admin = creerClientAdmin();

  const lundiCourant = lundiDeLaSemaine(aujourdhuiIso());
  const dateDebut = ajouterJours(lundiCourant, -7);
  const dateFin = ajouterJours(lundiCourant, -1);
  // Fenêtre élargie en amont pour que la moyenne mobile des pesées soit
  // déjà stabilisée au tout début de la semaine du rapport.
  const dateDebutPesees = ajouterJours(dateDebut, -7);

  const { data: programmes } = await admin
    .from('programme')
    .select('user_id')
    .eq('actif', true);

  const resultats: { userId: string; ok: boolean; erreur?: string; ignore?: boolean }[] = [];

  for (const { user_id: userId } of programmes ?? []) {
    try {
      const [{ data: profil }, { data: journees }, { data: pesees }, { data: utilisateur }] = await Promise.all([
        admin.from('profil').select('prenom').eq('user_id', userId).maybeSingle(),
        admin
          .from('journee')
          .select('date, statut, apport_kcal, depense_retenue_kcal, deficit_kcal')
          .eq('user_id', userId)
          .gte('date', dateDebut)
          .lte('date', dateFin),
        admin
          .from('pesee')
          .select('date, poids_kg')
          .eq('user_id', userId)
          .is('supprime_le', null)
          .gte('date', dateDebutPesees)
          .lte('date', dateFin),
        admin.auth.admin.getUserById(userId),
      ]);

      const email = utilisateur.user?.email;
      if (email === undefined) {
        resultats.push({ userId, ok: false, erreur: 'Adresse introuvable.' });
        continue;
      }

      const journeesCompletes = completerJournees(dateDebut, dateFin, journees ?? []);
      const completude = calculerCompletude(journeesCompletes);

      if (completude.joursRenseignes === 0) {
        resultats.push({ userId, ok: true, ignore: true });
        continue;
      }

      const cumul = cumulerDeficit(journeesCompletes);
      const peseesLissees = lisserPesees(
        (pesees ?? []).map((p) => ({ date: p.date, poidsKg: Number(p.poids_kg) })),
      );
      const tendance = tendancePoids({ pesees: peseesLissees, dateFin, joursFenetre: 7 });

      const analyse = await analyserPeriode({
        dateDebut,
        dateFin,
        completudeTaux: completude.taux,
        joursRenseignes: completude.joursRenseignes,
        joursTotal: completude.joursTotal,
        deficitCumuleKcal: cumul.deficitCumuleKcal,
        kgTheoriques: cumul.kgTheoriques,
        tendanceKgSemaine: tendance?.kgParSemaine ?? null,
        poidsDebutKg: tendance?.poidsDebutKg ?? null,
        poidsFinKg: tendance?.poidsFinKg ?? null,
      });

      const html = genererHtmlRapport({
        prenom: profil?.prenom ?? null,
        dateDebut,
        dateFin,
        completude,
        deficitCumuleKcal: cumul.deficitCumuleKcal,
        kgTheoriques: cumul.kgTheoriques,
        tendance,
        recit: analyse.succes ? analyse.donnees : null,
        lienBilan: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/bilan`,
      });

      const envoi = await envoyerEmail({
        destinataire: email,
        sujet: `Votre semaine Symbio du ${dateDebut} au ${dateFin}`,
        html,
      });

      resultats.push(envoi.ok ? { userId, ok: true } : { userId, ok: false, erreur: envoi.erreur });
    } catch (erreur) {
      resultats.push({ userId, ok: false, erreur: (erreur as Error).message });
    }
  }

  return NextResponse.json({
    semaine: { dateDebut, dateFin },
    total: resultats.length,
    envoyes: resultats.filter((r) => r.ok && r.ignore !== true).length,
    ignores: resultats.filter((r) => r.ignore === true).length,
    echecs: resultats.filter((r) => !r.ok),
  });
}
