import { redirect } from 'next/navigation';

/** Pesée et Bilan ne font plus qu'un seul onglet — l'ancien lien reste valide. */
export default function Pesee() {
  redirect('/bilan');
}
