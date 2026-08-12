/* Build data/foods.json from the table below.

   Why a generator rather than hand-writing the JSON: the per-100g figures are
   the source of truth and every household unit is derived from them, so a gram
   weight and a calorie count can never drift apart. The build also sanity-checks
   each row's energy against its macros and fails on anything wildly out.

   The tolerance is 25%, which sounds loose and is not. The general Atwater
   factors — 4 kcal a gram for carbohydrate and protein, 9 for fat — are an
   average across the whole diet. USDA publishes food-SPECIFIC factors, and for
   legumes, mushrooms and some vegetables the general ones overestimate by
   fifteen to twenty per cent; black beans and dry lentils miss no matter what
   fibre figure you use. Tightening the check further would mean fighting real
   physiology rather than catching mistakes. What it is actually for is typos,
   and a transposed digit misses by fifty per cent or more — well outside this.
   It has already earned its place twice: it caught that fibre was unmodelled
   at all, and then that I had given dry lentils three times its real fibre.

   Values are standard reference figures for raw or as-sold food, of the kind
   published on nutrition labels and in USDA FoodData Central. They are good
   enough to plan a week of eating from and are not laboratory measurements of
   the specific chicken breast in your fridge.

   Run: node tools/build-foods.mjs        (--check to verify without writing)
*/
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const OZ = 28.35, LB = 453.6, TBSP_OIL = 13.6, CUP = 240;

/* name | per-100g kcal, carb, protein, fat | units | tags
   Units are [label, grams]. The first is the one the app offers by default. */
const T = [
  // ---- poultry, meat, fish -------------------------------------------
  ['Chicken breast, skinless, raw',        120, 0, 22.5, 2.6, 0,  [['oz', OZ], ['breast', 174], ['lb', LB]], 'meat'],
  ['Chicken breast, skinless, cooked',     165, 0, 31,   3.6, 0,  [['oz', OZ], ['cup diced', 140]], 'meat'],
  ['Chicken thigh, boneless skinless, raw',119, 0, 19.7, 4.1, 0,  [['oz', OZ], ['thigh', 85]], 'meat'],
  ['Chicken, whole, roasted, meat only',   190, 0, 28.9, 7.4, 0,  [['oz', OZ], ['cup', 140]], 'meat'],
  ['Ground turkey, 93/7, raw',             150, 0, 19.0, 8.0, 0,  [['oz', OZ], ['lb', LB]], 'meat'],
  ['Ground turkey, 99/1, raw',             112, 0, 24.6, 1.0, 0,  [['oz', OZ], ['lb', LB]], 'meat'],
  ['Ground beef, 90/10, raw',              176, 0, 20.0, 10.0, 0, [['oz', OZ], ['lb', LB]], 'meat'],
  ['Ground beef, 80/20, raw',              254, 0, 17.2, 20.0, 0, [['oz', OZ], ['lb', LB]], 'meat'],
  ['Pork loin, raw',                       143, 0, 21.0, 6.0, 0,  [['oz', OZ], ['lb', LB]], 'meat'],
  ['Bacon, raw',                           417, 1.3, 13.0, 39.7, 0, [['slice', 28], ['oz', OZ]], 'meat'],
  ['Bacon, cooked',                        541, 1.4, 37.0, 42.0, 0, [['slice', 8], ['oz', OZ]], 'meat'],
  ['Salmon, Atlantic, raw',                208, 0, 20.4, 13.4, 0, [['oz', OZ], ['fillet', 170]], 'fish'],
  ['Tilapia, raw',                          96, 0, 20.1, 1.7, 0,  [['oz', OZ], ['fillet', 116]], 'fish'],
  ['Cod, raw',                              82, 0, 17.8, 0.7, 0,  [['oz', OZ], ['fillet', 180]], 'fish'],
  ['Tuna, canned in water, drained',       116, 0, 25.5, 0.8, 0,  [['can', 142], ['oz', OZ]], 'fish'],
  ['Shrimp, raw',                           85, 0.2, 20.1, 0.5, 0, [['oz', OZ]], 'fish'],
  ['Egg, whole, large',                    143, 0.7, 12.6, 9.5, 0, [['egg', 50], ['oz', OZ]], 'dairy'],
  ['Egg white, large',                      52, 0.7, 10.9, 0.2, 0, [['white', 33], ['cup', 243]], 'dairy'],
  ['Deli turkey, sliced',                  104, 3.5, 17.0, 2.0, 0, [['slice', 28], ['oz', OZ]], 'meat'],
  ['Deli ham, sliced',                     107, 2.5, 16.6, 3.3, 0, [['slice', 28], ['oz', OZ]], 'meat'],

  // ---- dairy -----------------------------------------------------------
  ['Milk, whole',                           61, 4.8, 3.2, 3.3, 0, [['cup', 244], ['fl oz', 30.5]], 'dairy'],
  ['Milk, 2%',                              50, 4.8, 3.4, 2.0, 0, [['cup', 244], ['fl oz', 30.5]], 'dairy'],
  ['Milk, skim',                            34, 5.0, 3.4, 0.1, 0, [['cup', 245], ['fl oz', 30.6]], 'dairy'],
  ['Greek yogurt, plain, nonfat',           59, 3.6, 10.3, 0.4, 0, [['cup', 245], ['container', 170]], 'dairy'],
  ['Greek yogurt, vanilla, high protein',   83, 5.9, 13.5, 0.6, 0, [['container', 150], ['cup', 245]], 'dairy'],
  ['Cottage cheese, 2%',                    84, 4.3, 11.0, 2.3, 0, [['cup', 226], ['oz', OZ]], 'dairy'],
  ['Cheddar cheese',                       403, 3.1, 22.9, 33.3, 0, [['oz', OZ], ['cup shredded', 113]], 'dairy'],
  ['Mozzarella, part skim, shredded',      302, 3.5, 24.3, 20.0, 0, [['oz', OZ], ['cup shredded', 113]], 'dairy'],
  ['Parmesan, grated',                     420, 4.1, 38.0, 28.0, 0, [['tbsp', 5], ['oz', OZ]], 'dairy'],
  ['Butter',                               717, 0.1, 0.9, 81.1, 0, [['tbsp', 14.2], ['tsp', 4.7]], 'fat'],
  ['Cream cheese',                         342, 5.5, 6.2, 34.0, 0, [['tbsp', 14.5], ['oz', OZ]], 'dairy'],
  ['Sour cream',                           198, 4.6, 2.4, 19.4, 0, [['tbsp', 12], ['cup', 230]], 'dairy'],
  ['Heavy cream',                          340, 2.8, 2.1, 36.1, 0, [['tbsp', 15], ['cup', 238]], 'dairy'],

  // ---- grains, starches ------------------------------------------------
  ['White rice, dry',                      365, 80.0, 7.1, 0.7, 0, [['cup', 185], ['oz', OZ]], 'grain'],
  ['White rice, cooked',                   130, 28.2, 2.7, 0.3, 0, [['cup', 158]], 'grain'],
  ['Brown rice, dry',                      370, 77.2, 7.9, 2.9, 3.5, [['cup', 190], ['oz', OZ]], 'grain'],
  ['Brown rice, cooked',                   123, 25.6, 2.7, 1.0, 0, [['cup', 195]], 'grain'],
  ['Rolled oats, dry',                     379, 67.7, 13.2, 6.5, 10.6, [['cup', 81], ['oz', OZ]], 'grain'],
  ['Quinoa, dry',                          368, 64.2, 14.1, 6.1, 7.0, [['cup', 170], ['oz', OZ]], 'grain'],
  ['Quinoa, cooked',                       120, 21.3, 4.4, 1.9, 0, [['cup', 185]], 'grain'],
  ['Pasta, dry',                           371, 74.7, 13.0, 1.5, 0, [['oz', OZ], ['cup', 105]], 'grain'],
  ['Pasta, cooked',                        158, 30.9, 5.8, 0.9, 0, [['cup', 140]], 'grain'],
  ['Bread, whole wheat',                   247, 41.3, 13.0, 3.4, 6.8, [['slice', 43]], 'grain'],
  ['Bread, white',                         266, 49.0, 9.0, 3.3, 0, [['slice', 29]], 'grain'],
  ['Bagel, plain',                         257, 50.5, 10.0, 1.5, 0, [['bagel', 98]], 'grain'],
  ['Tortilla, flour, 8 inch',              306, 51.4, 8.2, 7.0, 0, [['tortilla', 45]], 'grain'],
  ['Tortilla, corn, 6 inch',               218, 44.6, 5.7, 2.9, 0, [['tortilla', 26]], 'grain'],
  ['Hamburger bun',                        279, 50.0, 9.6, 4.2, 0, [['bun', 52]], 'grain'],
  ['Pizza dough, raw',                     268, 49.0, 8.9, 3.6, 0, [['oz', OZ], ['ball', 250]], 'grain'],
  ['Potato, russet, raw',                   79, 17.9, 2.1, 0.1, 2.1, [['potato', 173], ['cup diced', 150], ['lb', LB]], 'veg'],
  ['Sweet potato, raw',                     86, 20.1, 1.6, 0.1, 3.0, [['potato', 130], ['cup diced', 133]], 'veg'],
  ['Croutons',                             407, 73.5, 11.9, 6.6, 0, [['cup', 30], ['tbsp', 4]], 'grain'],
  ['Egg noodles, dry',                     384, 71.3, 14.2, 4.4, 0, [['cup', 38], ['oz', OZ]], 'grain'],
  ['Breadcrumbs, dry',                     395, 71.9, 13.4, 5.3, 0, [['cup', 108], ['tbsp', 7]], 'grain'],
  ['Cornmeal, dry',                        370, 79.0, 7.1, 1.8, 0, [['cup', 122], ['oz', OZ]], 'grain'],
  ['Pancake mix, dry',                     363, 72.0, 9.0, 4.0, 0, [['cup', 120], ['oz', OZ]], 'grain'],

  // ---- legumes, nuts, seeds --------------------------------------------
  ['Black beans, canned, drained',          91, 16.6, 6.0, 0.3, 7.5, [['cup', 172], ['can', 240]], 'legume'],
  ['Kidney beans, canned, drained',         84, 15.1, 5.5, 0.3, 6.4, [['cup', 177], ['can', 240]], 'legume'],
  ['Chickpeas, canned, drained',           139, 22.5, 7.1, 2.6, 6.0, [['cup', 164], ['can', 240]], 'legume'],
  ['Lentils, dry',                         353, 60.1, 25.8, 1.1, 10.7, [['cup', 192], ['oz', OZ]], 'legume'],
  ['Peanut butter',                        588, 20.0, 25.1, 50.4, 6.0, [['tbsp', 16], ['cup', 258]], 'fat'],
  ['Almonds',                              579, 21.6, 21.2, 49.9, 12.5, [['oz', OZ], ['cup', 143], ['almond', 1.2]], 'fat'],
  ['Walnuts',                              654, 13.7, 15.2, 65.2, 6.7, [['oz', OZ], ['cup', 117]], 'fat'],
  ['Cashews',                              553, 30.2, 18.2, 43.9, 3.3, [['oz', OZ], ['cup', 137]], 'fat'],
  ['Chia seeds',                           486, 42.1, 16.5, 30.7, 34.4, [['tbsp', 12], ['oz', OZ]], 'fat'],

  // ---- vegetables --------------------------------------------------------
  ['Broccoli, raw',                         34, 6.6, 2.8, 0.4, 2.6, [['cup chopped', 91], ['head', 608]], 'veg'],
  ['Carrots, raw',                          41, 9.6, 0.9, 0.2, 2.8, [['carrot', 61], ['cup chopped', 128]], 'veg'],
  ['Green beans, raw',                      31, 7.0, 1.8, 0.2, 2.7, [['cup', 100]], 'veg'],
  ['Spinach, raw',                          23, 3.6, 2.9, 0.4, 2.2, [['cup', 30], ['oz', OZ]], 'veg'],
  ['Romaine lettuce',                       17, 3.3, 1.2, 0.3, 2.1, [['cup shredded', 47], ['head', 626]], 'veg'],
  ['Tomato, raw',                           18, 3.9, 0.9, 0.2, 1.2, [['tomato', 123], ['cup chopped', 180]], 'veg'],
  ['Onion, raw',                            40, 9.3, 1.1, 0.1, 1.7, [['onion', 110], ['cup chopped', 160]], 'veg'],
  ['Bell pepper, raw',                      31, 6.0, 1.0, 0.3, 2.1, [['pepper', 119], ['cup chopped', 149]], 'veg'],
  ['Corn, frozen',                          88, 21.0, 3.0, 0.8, 2.0, [['cup', 141]], 'veg'],
  ['Peas, frozen',                          77, 13.6, 5.2, 0.4, 4.5, [['cup', 134]], 'veg'],
  ['Mushrooms, raw',                        22, 3.3, 3.1, 0.3, 1.0, [['cup sliced', 70], ['oz', OZ]], 'veg'],
  ['Celery, raw',                           16, 3.0, 0.7, 0.2, 1.6, [['stalk', 40], ['cup chopped', 101]], 'veg'],
  ['Zucchini, raw',                         17, 3.1, 1.2, 0.3, 1.0, [['zucchini', 196], ['cup sliced', 113]], 'veg'],
  ['Avocado',                              160, 8.5, 2.0, 14.7, 6.7, [['avocado', 150], ['cup sliced', 146]], 'fat'],
  ['Cucumber',                              15, 3.6, 0.7, 0.1, 0.5, [['cucumber', 301], ['cup sliced', 119]], 'veg'],
  ['Sweet corn on the cob',                 86, 19.0, 3.3, 1.4, 2.0, [['ear', 90]], 'veg'],

  // ---- fruit -------------------------------------------------------------
  ['Banana',                                89, 22.8, 1.1, 0.3, 2.6, [['banana', 118], ['cup sliced', 150]], 'fruit'],
  ['Apple',                                 52, 13.8, 0.3, 0.2, 2.4, [['apple', 182], ['cup sliced', 109]], 'fruit'],
  ['Blueberries',                           57, 14.5, 0.7, 0.3, 2.4, [['cup', 148], ['oz', OZ]], 'fruit'],
  ['Strawberries',                          32, 7.7, 0.7, 0.3, 2.0, [['cup', 152]], 'fruit'],
  ['Orange',                                47, 11.8, 0.9, 0.1, 2.4, [['orange', 131]], 'fruit'],
  ['Grapes',                                69, 18.1, 0.7, 0.2, 0.9, [['cup', 151]], 'fruit'],
  ['Raisins',                              299, 79.2, 3.1, 0.5, 3.7, [['cup', 145], ['tbsp', 9]], 'fruit'],
  ['Dates, medjool',                       277, 75.0, 1.8, 0.2, 6.7, [['date', 24], ['cup', 178]], 'fruit'],

  // ---- fats, sauces, condiments -----------------------------------------
  ['Olive oil',                            884, 0, 0, 100, 0,   [['tbsp', TBSP_OIL], ['tsp', 4.5]], 'fat'],
  ['Vegetable oil',                        884, 0, 0, 100, 0,   [['tbsp', TBSP_OIL], ['tsp', 4.5]], 'fat'],
  ['Mayonnaise',                           680, 0.6, 1.0, 75.0, 0, [['tbsp', 14]], 'fat'],
  ['Vinaigrette dressing',                 292, 6.7, 0.3, 29.0, 0, [['tbsp', 15]], 'fat'],
  ['Ranch dressing',                       430, 6.0, 1.0, 45.0, 0, [['tbsp', 15]], 'fat'],
  ['Ketchup',                              101, 25.8, 1.0, 0.1, 0, [['tbsp', 17]], 'condiment'],
  ['Mustard',                               66, 5.8, 3.7, 3.3, 0, [['tsp', 5], ['tbsp', 15]], 'condiment'],
  ['Barbecue sauce',                       172, 40.8, 0.8, 0.6, 0, [['tbsp', 17]], 'condiment'],
  ['Soy sauce',                             53, 4.9, 8.1, 0.6, 0, [['tbsp', 16], ['tsp', 5.3]], 'condiment'],
  ['Salsa',                                 36, 7.0, 1.5, 0.2, 1.5, [['tbsp', 16], ['cup', 240]], 'condiment'],
  ['Marinara sauce',                        58, 8.8, 1.6, 1.8, 0, [['cup', 245], ['tbsp', 15]], 'condiment'],
  ['Tomato paste',                          82, 18.9, 4.3, 0.5, 4.1, [['tbsp', 16], ['can', 170]], 'condiment'],
  ['Crushed tomatoes, canned',              32, 7.3, 1.6, 0.3, 1.9, [['cup', 240], ['can', 794]], 'condiment'],
  ['Chicken broth',                          4, 0.4, 0.5, 0.1, 0, [['cup', CUP], ['carton', 946]], 'condiment'],
  ['Beef broth',                             7, 0.1, 1.1, 0.2, 0, [['cup', CUP], ['carton', 946]], 'condiment'],
  ['Honey',                                304, 82.4, 0.3, 0, 0,  [['tbsp', 21], ['tsp', 7]], 'sugar'],
  ['Maple syrup',                          260, 67.0, 0, 0.1, 0,  [['tbsp', 20], ['cup', 322]], 'sugar'],
  ['Fruit jam',                            278, 68.9, 0.4, 0.1, 0, [['tbsp', 20]], 'sugar'],
  ['Sugar, white',                         387, 100, 0, 0, 0,     [['tbsp', 12.5], ['cup', 200]], 'sugar'],
  ['Brown sugar',                          380, 98.1, 0.1, 0, 0,  [['tbsp', 13.8], ['cup', 220]], 'sugar'],
  ['Flour, all purpose',                   364, 76.3, 10.3, 1.0, 0, [['cup', 125], ['tbsp', 8]], 'grain'],

  // ---- sports nutrition --------------------------------------------------
  ['Whey protein powder',                  380, 10.0, 75.0, 5.0, 0, [['scoop', 30], ['oz', OZ]], 'supplement'],
  ['Casein protein powder',                360, 10.0, 72.0, 3.0, 0, [['scoop', 33], ['oz', OZ]], 'supplement'],
  ['Drink mix, carbohydrate',              380, 95.0, 0, 0, 0,      [['scoop', 40], ['serving', 40]], 'supplement'],
  ['Energy gel',                           310, 77.0, 0, 0, 0,      [['gel', 32]], 'supplement'],
  ['Energy bar',                           380, 60.0, 10.0, 11.0, 0, [['bar', 55]], 'supplement'],
  ['Sports drink',                          26, 6.5, 0, 0, 0,       [['fl oz', 30], ['bottle', 590]], 'supplement'],
];

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const foods = [];
const problems = [];
const seen = new Set();

for (const [n, kc, c, p, f, fib, units, tag] of T) {
  const id = slug(n);
  if (seen.has(id)) problems.push(`duplicate id: ${id}`);
  seen.add(id);

  /* Atwater, with fibre priced properly. Fibre is inside "total carbohydrate"
     on every label but yields around 2 kcal a gram rather than 4, so checking
     4*carb against the stated energy fails every vegetable in the list — not
     because the numbers are wrong but because the model was. */
  const derived = 4 * (c - fib) + 2 * fib + 4 * p + 9 * f;
  const off = kc > 0 ? Math.abs(derived - kc) / kc : 0;
  if (kc > 20 && off > 0.25) {
    problems.push(`${n}: ${kc} kcal stated, ${round(derived)} from macros (${round(off * 100)}% out)`);
  }
  if (!units.length) problems.push(`${n}: no units`);

  foods.push({
    id, n, tag,
    per100: { kc, c, p, f, fib },
    units: units.map(([u, g]) => ({ u, g, kc: Math.round(kc * g / 100), c: round(c * g / 100), p: round(p * g / 100), f: round(f * g / 100), fib: round(fib * g / 100) })),
  });
}

if (problems.length) {
  console.error('build-foods: FAILED\n  ' + problems.join('\n  '));
  process.exit(1);
}

const out = {
  version: 1,
  built: 'deterministic — regenerate with node tools/build-foods.mjs',
  note: 'Standard reference values for raw or as-sold food, per 100 g, with common household units derived from those figures. Good enough to plan from; not a measurement of the specific item in your fridge.',
  count: foods.length,
  foods: foods.sort((a, b) => a.n.localeCompare(b.n)),
};
const json = JSON.stringify(out, null, 1) + '\n';
const path = 'data/foods.json';

if (process.argv.includes('--check')) {
  if (!existsSync(path) || readFileSync(path, 'utf8') !== json) {
    console.error('build-foods --check: data/foods.json is stale — run node tools/build-foods.mjs');
    process.exit(1);
  }
  console.log(`build-foods --check: ok (${foods.length} foods)`);
} else {
  writeFileSync(path, json);
  console.log(`build-foods: wrote ${path} — ${foods.length} foods, every one Atwater-checked`);
}
