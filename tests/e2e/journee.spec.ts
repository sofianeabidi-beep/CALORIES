import { expect, test, type Page } from '@playwright/test';

/**
 * Une journée de bout en bout — le livrable de la phase 1.
 *
 * Ce parcours a besoin d'un compte existant, avec profil et programme
 * actif. Il ne les crée pas : l'inscription passe par Supabase, qui
 * refuse les domaines de test, et un test qui dépend d'un envoi de
 * courriel n'est pas un test.
 *
 * ```bash
 * CALORYES_E2E_EMAIL=… CALORYES_E2E_MOTDEPASSE=… npm run e2e
 * ```
 *
 * Sans ces variables il est ignoré, pour que `npm run e2e` reste vert
 * sur une machine sans compte de test.
 */

const EMAIL = process.env.CALORYES_E2E_EMAIL;
const MOT_DE_PASSE = process.env.CALORYES_E2E_MOTDEPASSE;

/** Apport déjà enregistré aujourd'hui, lu sur l'écran Aujourd'hui. */
async function apportDuJour(page: Page): Promise<number> {
  const ligne = await page
    .getByText(/kcal enregistrées sur un objectif de/)
    .textContent();
  const chiffres = /^([\d\s  ]+) kcal enregistrées/.exec(ligne ?? '');
  return Number((chiffres?.[1] ?? '0').replace(/[\s  ]/g, ''));
}

test.describe('journée complète', () => {
  // Les tests partagent un compte : en parallèle, celui qui lit tombe
  // sur ce que l'autre vient d'écrire.
  test.describe.configure({ mode: 'serial' });

  test.skip(
    EMAIL === undefined || MOT_DE_PASSE === undefined,
    'CALORYES_E2E_EMAIL et CALORYES_E2E_MOTDEPASSE ne sont pas définis.',
  );

  test.beforeEach(async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('Adresse électronique').fill(EMAIL as string);
    await page.getByLabel('Mot de passe').fill(MOT_DE_PASSE as string);
    await page.getByRole('button', { name: /connecter/i }).click();
    await page.waitForURL(/aujourdhui|reglages/);
  });

  test('la dépense retenue est celle de Mifflin-St Jeor', async ({ page }) => {
    await page.goto('/aujourdhui');

    // Homme de 36 ans, 180 cm, 80 kg de départ, niveau modéré :
    // (10×80 + 6,25×180 − 5×36 + 5) × 1,55 = 2 712,5 → 2 713
    await expect(page.getByText(/Dépense retenue\s*:/)).toContainText('2 713');
    await expect(page.getByText(/estimée par formule/)).toBeVisible();
  });

  test('un repas saisi se répercute exactement sur le restant', async ({ page }) => {
    await page.goto('/aujourdhui');
    const avant = await apportDuJour(page);

    await page.goto('/saisie?repas=dejeuner');
    await page.getByLabel('Aliment').fill('Riz complet cuit');
    await page.getByLabel('Quantité').fill('150');
    await page.getByLabel('Calories (kcal)').fill('600');

    // Attendre la fin de la Server Action : sans cela, la navigation
    // suivante peut précéder l'écriture et le test devient instable.
    await Promise.all([
      page.waitForResponse(
        (reponse) => reponse.url().includes('/saisie') && reponse.request().method() === 'POST',
      ),
      page.getByRole('button', { name: /^Enregistrer$/ }).click(),
    ]);

    await page.goto('/aujourdhui');
    expect(await apportDuJour(page)).toBe(avant + 600);
    await expect(page.getByText('Riz complet cuit').first()).toBeVisible();
  });

  test('aucun indicateur cumulé ne s’affiche sans sa complétude', async ({ page }) => {
    // Le critère d'acceptation le plus facile à perdre à l'intégration.
    await page.goto('/bilan');

    await expect(page.getByText(/déficit cumulé|surplus cumulé/i)).toBeVisible();
    await expect(page.getByText(/% de jours renseignés/)).toBeVisible();
  });
});
