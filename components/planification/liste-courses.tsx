'use client';

import { useState } from 'react';
import { basculerArticleCourseAction } from '@/lib/actions/planification';
import { Carte, Libelle } from '@/components/ui/primitives';
import type { DateIso } from '@/lib/calcul';

export interface ArticleCourse {
  readonly categorie: string;
  readonly item: string;
  readonly quantite: string;
}

function cleArticle(article: ArticleCourse): string {
  return `${article.categorie}::${article.item}`;
}

/**
 * Liste de courses groupée par rayon, cases à cocher persistées.
 *
 * L'état coché est optimiste : la case change tout de suite, l'appel à
 * `basculerArticleCourseAction` confirme en base derrière. Une liste de
 * courses n'est pas une donnée critique (contrairement au journal ou au
 * poids) — un échec réseau silencieux ici n'a pas la même gravité qu'un
 * calcul faux, un simple retour visuel suffit sans bloquer l'écran.
 */
export function ListeCourses({
  articles,
  cochees,
  semaineDebut,
}: {
  articles: readonly ArticleCourse[];
  cochees: Readonly<Record<string, true>>;
  semaineDebut: DateIso;
}) {
  const [etatCoche, setEtatCoche] = useState<Readonly<Record<string, boolean>>>(() =>
    Object.fromEntries(articles.map((a) => [cleArticle(a), cochees[cleArticle(a)] === true])),
  );

  const groupes = new Map<string, ArticleCourse[]>();
  for (const article of articles) {
    const liste = groupes.get(article.categorie) ?? [];
    liste.push(article);
    groupes.set(article.categorie, liste);
  }

  function basculer(article: ArticleCourse) {
    const cle = cleArticle(article);
    const nouvelleValeur = !(etatCoche[cle] ?? false);
    setEtatCoche((prev) => ({ ...prev, [cle]: nouvelleValeur }));
    void basculerArticleCourseAction({ semaineDebut, cle, coche: nouvelleValeur });
  }

  return (
    <Carte>
      <Libelle>Liste de courses</Libelle>
      <div className="mt-2 flex flex-col gap-3">
        {[...groupes.entries()].map(([categorie, items]) => (
          <div key={categorie}>
            <p className="text-xs font-medium tracking-wide text-ardoise uppercase">
              {categorie}
            </p>
            <ul className="mt-1 flex flex-col gap-1.5">
              {items.map((article) => {
                const coche = etatCoche[cleArticle(article)] ?? false;
                return (
                  <li key={cleArticle(article)}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-5 shrink-0"
                        checked={coche}
                        onChange={() => {
                          basculer(article);
                        }}
                      />
                      <span className={coche ? 'text-ardoise line-through' : 'text-graphite'}>
                        {article.item}
                      </span>
                      <span className="chiffre ml-auto shrink-0 text-xs text-ardoise">
                        {article.quantite}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Carte>
  );
}
