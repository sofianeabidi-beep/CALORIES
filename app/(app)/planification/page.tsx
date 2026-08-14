import { redirect } from 'next/navigation';
import { lireJournee } from '@/lib/donnees/journee';
import { lirePlanificationSemaine } from '@/lib/donnees/planification';
import { aujourdhuiIso, formaterDate } from '@/lib/dates-app';
import { lundiDeLaSemaine } from '@/lib/calcul';
import { Generateur } from '@/components/planification/generateur';
import { SemainePlanifiee, type JourPlanifie } from '@/components/planification/semaine-planifiee';
import { ListeCourses, type ArticleCourse } from '@/components/planification/liste-courses';

// La génération (Server Action déclenchée depuis cette page) appelle
// l'IA pour 7 jours de repas + une liste de courses consolidée : plus
// long qu'une suggestion isolée. Sans ce réglage, la limite par défaut
// de la plateforme d'hébergement risquerait de couper l'appel avant sa
// fin (voir la doc Next.js sur `maxDuration` : il se pose au niveau de
// la page, pas de l'action elle-même).
export const maxDuration = 60;

export default async function Planification() {
  const date = aujourdhuiIso();
  const vue = await lireJournee(date);
  if (vue === null) redirect('/reglages/programme');

  const objectifKcalJour = vue.objectifKcal ?? Math.round(vue.bilan.depenseRetenueKcal);
  const semaineDebut = lundiDeLaSemaine(date);
  const plan = await lirePlanificationSemaine(semaineDebut);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="font-voice text-xl text-graphite">Planification</h1>
        <p className="mt-1 text-sm text-ardoise">
          Semaine du {formaterDate(semaineDebut, { day: 'numeric', month: 'long' })}.
        </p>
      </header>

      {plan === null ? (
        <Generateur objectifKcalJour={objectifKcalJour} />
      ) : (
        <>
          <Generateur objectifKcalJour={objectifKcalJour} regeneration />
          <SemainePlanifiee
            jours={(plan.plan as unknown as { jours: JourPlanifie[] }).jours}
            contrainteTemps={plan.contrainte_temps}
          />
          <ListeCourses
            articles={plan.liste_courses as unknown as ArticleCourse[]}
            cochees={plan.courses_cochees as unknown as Record<string, true>}
            semaineDebut={semaineDebut}
          />
        </>
      )}
    </main>
  );
}
