'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Types minimaux de la Web Speech API — absente de `lib.dom.d.ts`,
 * encore non standardisée. On ne déclare que ce qu'on utilise plutôt que
 * d'importer des types tiers pour une seule petite interface.
 */
interface AlternativeVocale {
  readonly transcript: string;
}
interface ResultatVocal {
  item(index: number): AlternativeVocale;
}
interface ListeResultatsVocaux {
  readonly length: number;
  item(index: number): ResultatVocal;
}
interface EvenementResultatVocal extends Event {
  readonly results: ListeResultatsVocaux;
}
interface ReconnaissanceVocale extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((evenement: EvenementResultatVocal) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type ConstructeurReconnaissanceVocale = new () => ReconnaissanceVocale;

declare global {
  interface Window {
    SpeechRecognition?: ConstructeurReconnaissanceVocale;
    webkitSpeechRecognition?: ConstructeurReconnaissanceVocale;
  }
}

/**
 * Bouton micro autonome — dictée d'une phrase, remplace le texte du
 * champ à chaque nouvelle prise de parole plutôt que de l'accumuler.
 *
 * Absent du rendu plutôt que désactivé si le navigateur ne supporte pas
 * la reconnaissance vocale (Firefox, une partie de Safari) : un bouton
 * visible qui échoue au clic serait exactement le genre de promesse non
 * tenue que l'application évite partout ailleurs.
 */
function detecterSupport(): boolean {
  return window.SpeechRecognition !== undefined || window.webkitSpeechRecognition !== undefined;
}

function sansAbonnement() {
  return () => {};
}

export function BoutonDictee({
  onTranscription,
}: {
  onTranscription: (texte: string) => void;
}) {
  // Ni SSR ni premier rendu client ne connaissent le support du
  // navigateur avant l'hydratation — `useSyncExternalStore` avec un
  // instantané serveur figé à `false` évite l'aller-retour setState-
  // dans-un-effet tout en laissant React réconcilier proprement après
  // coup, sans avertissement d'hydratation.
  const supporte = useSyncExternalStore(sansAbonnement, detecterSupport, () => false);
  const [enEcoute, setEnEcoute] = useState(false);
  const instance = useRef<ReconnaissanceVocale | null>(null);

  useEffect(() => {
    return () => {
      instance.current?.stop();
    };
  }, []);

  function basculer() {
    if (enEcoute) {
      instance.current?.stop();
      return;
    }

    const Constructeur = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (Constructeur === undefined) return;

    const reconnaissance = new Constructeur();
    reconnaissance.lang = 'fr-FR';
    reconnaissance.interimResults = true;
    reconnaissance.continuous = false;

    reconnaissance.onresult = (evenement) => {
      let texte = '';
      for (let i = 0; i < evenement.results.length; i += 1) {
        texte += evenement.results.item(i).item(0).transcript;
      }
      onTranscription(texte.trim());
    };
    reconnaissance.onerror = () => {
      setEnEcoute(false);
    };
    reconnaissance.onend = () => {
      setEnEcoute(false);
    };

    instance.current = reconnaissance;
    reconnaissance.start();
    setEnEcoute(true);
  }

  if (!supporte) return null;

  return (
    <button
      type="button"
      onClick={basculer}
      aria-label={enEcoute ? 'Arrêter la dictée' : 'Dicter à la voix'}
      aria-pressed={enEcoute}
      className={`flex size-11 shrink-0 items-center justify-center rounded-lg border transition duration-150 ${
        enEcoute
          ? 'border-signal text-signal'
          : 'border-trait text-ardoise hover:border-ardoise'
      }`}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
        <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
