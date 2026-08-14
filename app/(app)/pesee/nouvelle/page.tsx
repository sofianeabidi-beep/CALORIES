import { redirect } from 'next/navigation';
import { lireHistoriquePoids } from '@/lib/donnees/pesee';
import { FormulairePesee } from '@/components/saisie/formulaire-pesee';

export default async function NouvellePesee() {
  const historique = await lireHistoriquePoids();
  if (historique === null) redirect('/connexion');

  const derniere = historique.pesees[historique.pesees.length - 1];

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-4 text-xl font-light text-graphite">Je me pèse</h1>

      {/* Prérempli avec la dernière valeur : d'un jour à l'autre le
          poids bouge de quelques centaines de grammes, taper trois
          chiffres identiques chaque matin est une friction inutile. */}
      <FormulairePesee poidsPrecedentKg={derniere?.poidsKg} />
    </main>
  );
}
