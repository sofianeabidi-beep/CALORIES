'use client';

import type { ChangeEventHandler, CSSProperties, ReactNode } from 'react';

/**
 * Primitives d'interface.
 *
 * L'application est un **instrument de mesure**, pas un coach. Les
 * chiffres sont les héros, l'ornement est absent.
 */

export function Carte({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string | undefined;
  // Sert notamment à passer une variable CSS (ex. `--delai-entree`) sans
  // créer une classe utilitaire par valeur possible.
  style?: CSSProperties | undefined;
}) {
  return (
    <section
      className={`rounded-xl border border-trait bg-surface p-4 ${className}`.trim()}
      style={style}
    >
      {children}
    </section>
  );
}

export function Libelle({ children }: { children: ReactNode }) {
  return <p className="libelle">{children}</p>;
}

/**
 * Valeur mise en vedette : grande, en graisse légère, en chiffres à
 * chasse fixe. Le `tabular-nums` n'est pas cosmétique — sans lui, la
 * valeur se décale à chaque mise à jour et le regard perd sa cible.
 */
export function Chiffre({
  valeur,
  unite,
  ton = 'neutre',
  taille = 'grand',
}: {
  valeur: string;
  unite?: string | undefined;
  ton?: 'neutre' | 'deficit' | 'surplus' | 'signal';
  taille?: 'grand' | 'moyen';
}) {
  const couleurs = {
    neutre: 'text-graphite',
    // Déficit et surplus sont des directions, pas des verdicts moraux :
    // ni vert ni rouge. Le rouge est réservé aux garde-fous.
    deficit: 'text-deficit',
    surplus: 'text-surplus',
    signal: 'text-signal',
  } as const;

  return (
    <p
      className={`chiffre ${couleurs[ton]} ${
        taille === 'grand' ? 'text-5xl' : 'text-2xl'
      } leading-none font-light`}
    >
      {valeur}
      {unite !== undefined && (
        <span className="ml-1 text-base font-normal text-ardoise">{unite}</span>
      )}
    </p>
  );
}

export function Bouton({
  children,
  type = 'button',
  variante = 'principal',
  disabled = false,
  onClick,
  className = '',
}: {
  children: ReactNode;
  type?: 'button' | 'submit';
  variante?: 'principal' | 'discret';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const styles =
    variante === 'principal'
      ? 'bg-deficit text-white hover:opacity-90 active:opacity-80'
      : 'border border-trait bg-surface text-graphite hover:border-ardoise active:bg-trait';

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      // 44 px de haut au minimum : cible tactile utilisable d'une main.
      // `transition` (pas juste `-colors`) : le retour à la souris couvre
      // aussi bien la bordure que l'opacité selon la variante.
      className={`min-h-11 w-full rounded-lg px-4 py-3 text-base font-medium transition duration-150 disabled:pointer-events-none disabled:opacity-50 ${styles} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

/**
 * Bascule en pilules : un choix parmi quelques options, affiché comme des
 * boutons côte à côte plutôt qu'un menu déroulant — pour un choix qu'on
 * fait souvent et qu'on veut voir d'un coup d'œil (repas visé, contrainte
 * de temps, période). `pleineLargeur` répartit les options à parts
 * égales ; sans lui, les pilules gardent leur largeur naturelle et
 * défilent horizontalement si elles débordent.
 */
export function Bascule({
  options,
  valeur,
  onChange,
  pleineLargeur = false,
}: {
  options: readonly { valeur: string; texte: string }[];
  valeur: string;
  onChange: (valeur: string) => void;
  pleineLargeur?: boolean;
}) {
  return (
    <div className={`flex gap-2 ${pleineLargeur ? '' : 'overflow-x-auto'}`}>
      {options.map((option) => (
        <button
          key={option.valeur}
          type="button"
          onClick={() => {
            onChange(option.valeur);
          }}
          className={`${
            pleineLargeur ? 'flex-1' : 'shrink-0'
          } rounded-lg border px-3 py-2 text-sm transition duration-150 ${
            option.valeur === valeur
              ? 'border-deficit text-deficit'
              : 'border-trait text-ardoise hover:border-ardoise'
          }`}
        >
          {option.texte}
        </button>
      ))}
    </div>
  );
}

export function Champ({
  nom,
  libelle,
  type = 'text',
  defaultValue,
  value,
  onChange,
  required = false,
  erreurs,
  ...reste
}: {
  nom: string;
  libelle: string;
  type?: string;
  defaultValue?: string | number | undefined;
  // Champ contrôlé : pour préremplir depuis un état (ex. une estimation
  // IA) tout en restant modifiable. Ne jamais fournir en même temps que
  // `defaultValue` — React avertit si un champ change de statut en
  // cours de vie.
  value?: string | number | undefined;
  onChange?: ChangeEventHandler<HTMLInputElement> | undefined;
  required?: boolean;
  // `| undefined` explicite : sous `exactOptionalPropertyTypes`, un prop
  // simplement optionnel refuse qu'on lui passe `undefined`, ce que fait
  // pourtant tout accès du type `etat.champs?.libelle`.
  erreurs?: string[] | undefined;
  step?: string;
  min?: string;
  max?: string;
  autoComplete?: string;
  inputMode?: 'numeric' | 'decimal' | 'text' | 'email';
}) {
  const idErreur = `${nom}-erreur`;
  const enErreur = erreurs !== undefined && erreurs.length > 0;

  return (
    <div className="flex flex-col gap-1">
      {/* Libellé associé au champ : indispensable aux lecteurs d'écran. */}
      <label htmlFor={nom} className="libelle">
        {libelle}
      </label>
      <input
        id={nom}
        name={nom}
        type={type}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        required={required}
        aria-invalid={enErreur}
        aria-describedby={enErreur ? idErreur : undefined}
        className={`chiffre min-h-11 rounded-lg border bg-surface px-3 py-2 text-base text-graphite ${
          enErreur ? 'border-signal' : 'border-trait'
        }`}
        {...reste}
      />
      {enErreur && (
        <p id={idErreur} role="alert" className="text-sm text-signal">
          {erreurs.join(' ')}
        </p>
      )}
    </div>
  );
}

export function Selecteur({
  nom,
  libelle,
  options,
  defaultValue,
  value,
  onChange,
  erreurs,
}: {
  nom: string;
  libelle: string;
  options: readonly { valeur: string; texte: string }[];
  defaultValue?: string;
  // Même règle que `Champ` : mode contrôlé pour un sélecteur partagé hors
  // d'un `<form>` natif (ex. le repas commun à plusieurs aliments issus
  // d'une estimation IA). Ne jamais fournir en même temps que `defaultValue`.
  value?: string;
  onChange?: (valeur: string) => void;
  erreurs?: string[] | undefined;
}) {
  const idErreur = `${nom}-erreur`;
  const enErreur = erreurs !== undefined && erreurs.length > 0;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={nom} className="libelle">
        {libelle}
      </label>
      <select
        id={nom}
        name={nom}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={enErreur}
        aria-describedby={enErreur ? idErreur : undefined}
        className={`min-h-11 rounded-lg border bg-surface px-3 py-2 text-base text-graphite ${
          enErreur ? 'border-signal' : 'border-trait'
        }`}
      >
        {options.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.texte}
          </option>
        ))}
      </select>
      {enErreur && (
        <p id={idErreur} role="alert" className="text-sm text-signal">
          {erreurs.join(' ')}
        </p>
      )}
    </div>
  );
}

export function Alerte({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-signal/40 bg-signal/5 px-3 py-2 text-sm text-signal"
    >
      {children}
    </p>
  );
}
