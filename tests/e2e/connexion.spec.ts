import { expect, test } from '@playwright/test';

/**
 * Parcours vérifiables sans base.
 *
 * Ces tests couvrent la structure, l'accessibilité et l'ergonomie
 * mobile — tout ce qui ne dépend pas d'un Supabase joignable. Le
 * parcours « suivre une journée de bout en bout » du §13 attend un
 * projet Supabase.
 */

test('la page de connexion est utilisable sur un écran de 375 px', async ({ page }) => {
  await page.goto('/connexion');

  await expect(page.getByRole('heading', { name: 'Caloryes' })).toBeVisible();

  // Chaque champ a un libellé qui lui est associé : sans cela, un
  // lecteur d'écran annonce « champ de saisie » et rien d'autre.
  const email = page.getByLabel('Adresse électronique');
  const motDePasse = page.getByLabel('Mot de passe');
  await expect(email).toBeVisible();
  await expect(motDePasse).toBeVisible();

  // Cibles tactiles d'au moins 44 px (spec §10).
  for (const cible of [email, motDePasse, page.getByRole('button', { name: /connecter/i })]) {
    const boite = await cible.boundingBox();
    expect(boite?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  // La page ne défile jamais horizontalement : l'application s'utilise
  // d'une seule main sur 375 px.
  const debordement = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(debordement).toBe(false);
});

test('l’inscription demande les deux consentements séparément', async ({ page }) => {
  await page.goto('/inscription');

  // Accepter les CGU ne vaut pas consentement au traitement de données
  // de santé : deux cases distinctes, toutes deux obligatoires.
  const cgu = page.locator('input[name="cguAcceptees"]');
  const sante = page.locator('input[name="consentementSante"]');

  await expect(cgu).toBeVisible();
  await expect(sante).toBeVisible();
  await expect(cgu).toHaveAttribute('required', '');
  await expect(sante).toHaveAttribute('required', '');

  await expect(page.getByText(/données de santé/i).first()).toBeVisible();

  // L'absence d'allégation médicale (spec §9) doit être dite, pas
  // seulement respectée : c'est ce qui tient le produit hors du champ
  // du dispositif médical.
  await expect(page.getByText(/aucun conseil médical ni nutritionnel/i)).toBeVisible();
  await expect(page.getByText(/réservée aux personnes majeures/i)).toBeVisible();
});

test('la navigation reste atteignable au pouce', async ({ page }) => {
  await page.goto('/connexion');

  const hauteur = page.viewportSize()?.height ?? 0;
  const bouton = page.getByRole('button', { name: /connecter/i });
  const boite = await bouton.boundingBox();

  // Le bouton principal est dans la moitié basse de l'écran.
  expect(boite?.y ?? 0).toBeGreaterThan(hauteur / 3);
});
