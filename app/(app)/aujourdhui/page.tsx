/*
 * Écran d'accueil. Contenu réel construit au lot 11 de la phase 1 :
 * restant du jour, repas, bouton de saisie omniprésent.
 */
export default function Aujourdhui() {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <p className="libelle">Aujourd’hui</p>
      <p className="chiffre mt-2 text-5xl font-light">—</p>
    </main>
  );
}
