import Image from 'next/image';
import Link from 'next/link';
import heroRepas from '@/public/landing/hero-repas.jpg';
import legumesMarche from '@/public/landing/legumes-marche.jpg';

/**
 * Palette figée, comme sur `/connexion` : un monde visuel à part, assumé,
 * qui n'a pas vocation à s'inverser avec le thème système — une page de
 * présentation, pas un écran où l'utilisateur saisit ses données le soir.
 */
const CREME = '#f1ece1';
const ENCRE = '#2b2620';
const BRUN = '#5c4a30';
const BRUN_MUET = '#6b6255';
const TEAL = '#1f6f78';

type RouteAuth = '/inscription' | '/connexion';

function BoutonPrincipal({ href, children }: { href: RouteAuth; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center justify-center rounded-lg px-6 text-base font-medium text-white transition hover:opacity-90"
      style={{ background: TEAL }}
    >
      {children}
    </Link>
  );
}

function LienDiscret({ href, children }: { href: RouteAuth; children: string }) {
  return (
    <Link href={href} className="text-base underline underline-offset-2" style={{ color: ENCRE }}>
      {children}
    </Link>
  );
}

export default function Accueil() {
  return (
    <main style={{ background: CREME, color: ENCRE }}>
      {/*
        Colonne centrée à max-w-md, comme tout le reste de l'app : sans
        elle, une image en largeur 100 % suit la largeur du viewport, pas
        celle de son ratio — sur un écran large, une image en 4:3 devient
        démesurément haute et pousse tout le texte hors champ. C'est le
        bug qu'un utilisateur a signalé (« ya rien ») juste après la
        première mise en ligne.
      */}
      <div className="mx-auto max-w-md">
        <section className="relative">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={heroRepas}
              alt="Un dîner simple à la maison, deux bols et du pain sur une table en bois"
              fill
              priority
              className="object-cover"
              sizes="(min-width: 448px) 448px, 100vw"
            />
          </div>

          <div className="px-6 pt-8 pb-10">
            <p className="font-voice text-base italic" style={{ color: BRUN }}>
              Symbio
            </p>
            <h1 className="font-voice mt-4 text-3xl leading-[1.2] text-balance">
              Reprenez la main, sans compter chaque bouchée.
            </h1>
            <p className="mt-4 text-base" style={{ color: BRUN_MUET }}>
              Une vie normale, un poids qui bouge quand même. Ce qui compte vraiment se joue
              sur des semaines, jamais sur un seul repas.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <BoutonPrincipal href="/inscription">Créer un compte</BoutonPrincipal>
              <LienDiscret href="/connexion">J’ai déjà un compte</LienDiscret>
            </div>
          </div>
        </section>

        <section className="px-6 py-14">
          <p className="text-sm font-semibold tracking-[0.15em] uppercase" style={{ color: BRUN }}>
            La vision
          </p>
          <h2 className="font-voice mt-3 text-2xl leading-[1.3] text-balance">
            Une vie d’abord. Un chiffre ensuite.
          </h2>
          <p className="mt-4 text-base" style={{ color: BRUN_MUET }}>
            Vous n’avez pas à choisir entre vivre normalement et perdre du poids. La plupart
            des applis vous jugent sur votre journée ; Symbio regarde votre semaine, votre
            mois — jamais votre dîner d’hier soir. Un excès ne casse rien, il se fond dans le
            temps long. C’est le temps long qui compte, pas l’instant.
          </p>
        </section>

        <section className="relative">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={legumesMarche}
              alt="Étal de légumes frais et colorés sur un marché"
              fill
              className="object-cover"
              sizes="(min-width: 448px) 448px, 100vw"
            />
          </div>
          <div className="px-6 py-10">
            <p className="text-sm font-semibold tracking-[0.15em] uppercase" style={{ color: BRUN }}>
              Mangez librement
            </p>
            <h2 className="font-voice mt-3 text-2xl leading-[1.3] text-balance">
              Mangez ce que vous aimez. On s’occupe des chiffres.
            </h2>
            <p className="mt-4 text-base" style={{ color: BRUN_MUET }}>
              Décrivez un plat en une phrase, Symbio propose les valeurs — vous gardez la main
              pour les ajuster. Pas de liste d’aliments interdits, pas de programme figé :
              juste votre progression, semaine après semaine.
            </p>
          </div>
        </section>

        <section className="px-6 py-14">
          <p className="text-sm font-semibold tracking-[0.15em] uppercase" style={{ color: BRUN }}>
            Ce qui ne changera jamais
          </p>
          <h2 className="font-voice mt-3 text-2xl leading-[1.3] text-balance">
            Honnête, ou rien.
          </h2>
          <p className="mt-4 text-base" style={{ color: BRUN_MUET }}>
            Un chiffre qui cache sa fiabilité ne sert à rien : le vôtre dira toujours sur
            combien de jours il porte. Vos données réelles corrigent nos calculs, jamais
            l’inverse. Et personne d’autre ne verra jamais les vôtres — pas de classement, pas
            de comparaison. Juste vous, et le temps qui passe.
          </p>
        </section>

        <section className="px-6 pt-4 pb-16 text-center">
          <h2 className="font-voice text-2xl leading-[1.3] text-balance">
            Votre rythme. Vos règles.
          </h2>
          <p className="mt-3 text-base" style={{ color: BRUN_MUET }}>
            Prêt à voir votre poids autrement ?
          </p>
          <div className="mt-6 flex flex-col items-center gap-4">
            <BoutonPrincipal href="/inscription">Créer un compte</BoutonPrincipal>
            <LienDiscret href="/connexion">Se connecter</LienDiscret>
          </div>
        </section>
      </div>
    </main>
  );
}
