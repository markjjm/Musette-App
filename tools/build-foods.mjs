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

  // ---- more poultry, meat, fish ----------------------------------------
  ['Chicken tenderloin, raw',              109, 0, 22.9, 1.3, 0, [['oz', OZ], ['tender', 30]], 'meat'],
  ['Chicken wing, raw',                    203, 0, 18.3, 14.0, 0, [['wing', 34], ['oz', OZ]], 'meat'],
  ['Rotisserie chicken, meat only',        190, 0, 28.0, 8.0, 0, [['cup', 140], ['oz', OZ]], 'meat'],
  ['Turkey breast, roasted',               135, 0, 30.1, 0.7, 0, [['oz', OZ], ['cup diced', 140]], 'meat'],
  ['Ground turkey, 85/15, raw',            213, 0, 17.3, 15.7, 0, [['oz', OZ], ['lb', LB]], 'meat'],
  ['Ground beef, 85/15, raw',              215, 0, 18.6, 15.0, 0, [['oz', OZ], ['lb', LB]], 'meat'],
  ['Sirloin steak, raw',                   201, 0, 21.0, 12.7, 0, [['oz', OZ], ['steak', 227]], 'meat'],
  ['Ribeye steak, raw',                    291, 0, 19.0, 23.0, 0, [['oz', OZ], ['steak', 280]], 'meat'],
  ['Pork chop, raw',                       196, 0, 20.9, 12.0, 0, [['chop', 150], ['oz', OZ]], 'meat'],
  ['Pork tenderloin, raw',                 120, 0, 20.9, 3.5, 0, [['oz', OZ], ['lb', LB]], 'meat'],
  ['Italian sausage, raw',                 290, 2.0, 16.0, 24.0, 0, [['link', 85], ['oz', OZ]], 'meat'],
  ['Breakfast sausage patty, raw',         320, 1.0, 14.0, 29.0, 0, [['patty', 45], ['oz', OZ]], 'meat'],
  ['Pepperoni',                            504, 1.2, 19.3, 46.3, 0, [['oz', OZ], ['slice', 5]], 'meat'],
  ['Ham steak',                            145, 1.5, 21.0, 5.5, 0, [['oz', OZ], ['steak', 170]], 'meat'],
  ['Hot dog, beef',                        290, 3.0, 11.0, 26.0, 0, [['hot dog', 45]], 'meat'],
  ['Ground chicken, raw',                  143, 0, 17.4, 8.1, 0, [['oz', OZ], ['lb', LB]], 'meat'],
  ['Tuna steak, raw',                      109, 0, 24.4, 0.5, 0, [['oz', OZ], ['steak', 170]], 'fish'],
  ['Salmon, canned',                       142, 0, 19.8, 6.2, 0, [['can', 142], ['oz', OZ]], 'fish'],
  ['Sardines, canned in oil',              208, 0, 24.6, 11.5, 0, [['can', 92], ['oz', OZ]], 'fish'],
  ['Scallops, raw',                         69, 3.2, 12.1, 0.5, 0, [['oz', OZ]], 'fish'],
  ['Crab meat, cooked',                     83, 0, 17.2, 1.1, 0, [['oz', OZ], ['cup', 135]], 'fish'],
  ['Tofu, firm',                           144, 4.3, 15.8, 8.7, 2.3, [['oz', OZ], ['block', 396]], 'legume'],

  // ---- more dairy and eggs ----------------------------------------------
  ['Greek yogurt, plain, 2%',               73, 4.0, 12.0, 1.9, 0, [['cup', 245], ['container', 170]], 'dairy'],
  ['Yogurt, plain, whole milk',             61, 4.7, 3.5, 3.3, 0, [['cup', 245]], 'dairy'],
  ['Cottage cheese, 4%',                    98, 3.4, 11.1, 4.3, 0, [['cup', 226], ['oz', OZ]], 'dairy'],
  ['Ricotta, part skim',                   138, 5.1, 11.4, 7.9, 0, [['cup', 246], ['oz', OZ]], 'dairy'],
  ['Swiss cheese',                         380, 5.4, 27.0, 27.8, 0, [['slice', 28], ['oz', OZ]], 'dairy'],
  ['Provolone',                            351, 2.1, 25.6, 26.6, 0, [['slice', 28], ['oz', OZ]], 'dairy'],
  ['American cheese',                      371, 5.8, 18.5, 30.6, 0, [['slice', 21], ['oz', OZ]], 'dairy'],
  ['Feta',                                 264, 4.1, 14.2, 21.3, 0, [['oz', OZ], ['cup crumbled', 150]], 'dairy'],
  ['Half and half',                        130, 4.3, 3.0, 11.5, 0, [['tbsp', 15], ['cup', 242]], 'dairy'],
  ['Almond milk, unsweetened',              15, 0.6, 0.6, 1.2, 0, [['cup', 240]], 'dairy'],
  ['Chocolate milk, 2%',                    76, 12.3, 3.2, 1.9, 0, [['cup', 250]], 'dairy'],
  ['Whipped cream',                        257, 12.5, 3.2, 22.2, 0, [['tbsp', 6], ['cup', 60]], 'dairy'],
  ['Egg, whole, extra large',              143, 0.7, 12.6, 9.5, 0, [['egg', 56]], 'dairy'],
  ['Ice cream, vanilla',                   207, 23.6, 3.5, 11.0, 0, [['cup', 132], ['scoop', 66]], 'dairy'],

  // ---- more grains, breads, cereals --------------------------------------
  ['Sourdough bread',                      289, 56.0, 11.7, 1.8, 2.4, [['slice', 50]], 'grain'],
  ['Rye bread',                            259, 48.3, 8.5, 3.3, 5.8, [['slice', 32]], 'grain'],
  ['English muffin',                       227, 44.0, 8.9, 1.7, 2.5, [['muffin', 57]], 'grain'],
  ['Pita bread, whole wheat',              266, 55.9, 9.8, 2.6, 7.4, [['pita', 64]], 'grain'],
  ['Naan',                                 310, 50.0, 9.0, 8.0, 2.0, [['naan', 90]], 'grain'],
  ['Hot dog bun',                          279, 50.0, 9.6, 4.2, 0, [['bun', 43]], 'grain'],
  ['Couscous, dry',                        376, 77.4, 12.8, 0.6, 5.0, [['cup', 173], ['oz', OZ]], 'grain'],
  ['Barley, pearled, dry',                 352, 77.7, 9.9, 1.2, 15.6, [['cup', 200], ['oz', OZ]], 'grain'],
  ['Farro, dry',                           340, 71.0, 13.0, 2.0, 10.0, [['cup', 190], ['oz', OZ]], 'grain'],
  ['Grits, dry',                           371, 79.6, 8.8, 1.2, 4.4, [['cup', 156], ['oz', OZ]], 'grain'],
  ['Cereal, bran flakes',                  330, 80.0, 10.0, 2.0, 18.0, [['cup', 40]], 'grain'],
  ['Cereal, granola',                      471, 64.0, 10.0, 20.0, 7.0, [['cup', 122], ['oz', OZ]], 'grain'],
  ['Cereal, corn flakes',                  357, 84.0, 7.5, 0.4, 3.0, [['cup', 28]], 'grain'],
  ['Crackers, saltine',                    418, 72.0, 9.0, 10.0, 2.8, [['cracker', 3], ['oz', OZ]], 'grain'],
  ['Tortilla chips',                       489, 63.0, 7.0, 23.0, 4.8, [['oz', OZ], ['cup', 30]], 'grain'],
  ['Pretzels',                             384, 80.0, 10.0, 3.0, 3.0, [['oz', OZ], ['cup', 30]], 'grain'],
  ['Popcorn, air popped',                  387, 77.9, 12.9, 4.5, 14.5, [['cup', 8], ['oz', OZ]], 'grain'],
  ['Rice cake',                            387, 81.5, 8.2, 2.8, 4.2, [['cake', 9]], 'grain'],
  ['Panko breadcrumbs',                    390, 74.0, 12.0, 3.0, 4.0, [['cup', 60], ['tbsp', 4]], 'grain'],
  ['Lasagna noodles, dry',                 371, 74.7, 13.0, 1.5, 3.2, [['noodle', 27], ['oz', OZ]], 'grain'],
  ['Ramen noodles, dry',                   436, 63.0, 9.0, 17.0, 2.5, [['pack', 85]], 'grain'],
  ['Gnocchi',                              152, 31.0, 3.6, 1.3, 1.9, [['cup', 150], ['oz', OZ]], 'grain'],
  ['Waffle, frozen',                       291, 43.0, 7.0, 10.0, 2.0, [['waffle', 35]], 'grain'],
  ['Biscuit, refrigerated dough',          330, 44.0, 6.0, 14.0, 1.5, [['biscuit', 57]], 'grain'],

  // ---- more vegetables ---------------------------------------------------
  ['Asparagus, raw',                        20, 3.9, 2.2, 0.1, 2.1, [['spear', 16], ['cup', 134]], 'veg'],
  ['Brussels sprouts, raw',                 43, 9.0, 3.4, 0.3, 3.8, [['cup', 88], ['oz', OZ]], 'veg'],
  ['Cauliflower, raw',                      25, 5.0, 1.9, 0.3, 2.0, [['cup', 107], ['head', 588]], 'veg'],
  ['Cabbage, raw',                          25, 5.8, 1.3, 0.1, 2.5, [['cup shredded', 89], ['head', 908]], 'veg'],
  ['Kale, raw',                             49, 8.8, 4.3, 0.9, 3.6, [['cup', 67], ['oz', OZ]], 'veg'],
  ['Green onion',                           32, 7.3, 1.8, 0.2, 2.6, [['onion', 15], ['cup', 100]], 'veg'],
  ['Garlic',                               149, 33.1, 6.4, 0.5, 2.1, [['clove', 3], ['head', 45]], 'veg'],
  ['Jalapeno',                              29, 6.5, 0.9, 0.4, 2.8, [['pepper', 14]], 'veg'],
  ['Sweet potato, cooked',                  90, 20.7, 2.0, 0.2, 3.3, [['cup', 200], ['potato', 151]], 'veg'],
  ['Butternut squash, raw',                 45, 11.7, 1.0, 0.1, 2.0, [['cup cubed', 140]], 'veg'],
  ['Eggplant, raw',                         25, 5.9, 1.0, 0.2, 3.0, [['cup cubed', 82], ['eggplant', 458]], 'veg'],
  ['Beets, raw',                            43, 9.6, 1.6, 0.2, 2.8, [['beet', 82], ['cup', 136]], 'veg'],
  ['Coleslaw mix',                          25, 5.8, 1.3, 0.1, 2.5, [['cup', 70], ['bag', 397]], 'veg'],
  ['Mixed salad greens',                    20, 3.5, 1.8, 0.3, 2.0, [['cup', 30], ['bag', 142]], 'veg'],
  ['Frozen mixed vegetables',               65, 13.1, 3.3, 0.5, 4.0, [['cup', 182]], 'veg'],
  ['Pickles, dill',                         12, 2.3, 0.6, 0.2, 1.2, [['spear', 35], ['cup', 143]], 'veg'],
  ['Olives, green',                        145, 3.8, 1.0, 15.3, 3.3, [['olive', 4], ['cup', 134]], 'fat'],
  ['Sauerkraut',                            19, 4.3, 0.9, 0.1, 2.9, [['cup', 142]], 'veg'],

  // ---- more fruit ---------------------------------------------------------
  ['Pineapple',                             50, 13.1, 0.5, 0.1, 1.4, [['cup chunks', 165]], 'fruit'],
  ['Mango',                                 60, 15.0, 0.8, 0.4, 1.6, [['mango', 336], ['cup', 165]], 'fruit'],
  ['Watermelon',                            30, 7.6, 0.6, 0.2, 0.4, [['cup', 152], ['wedge', 286]], 'fruit'],
  ['Cantaloupe',                            34, 8.2, 0.8, 0.2, 0.9, [['cup', 160]], 'fruit'],
  ['Peach',                                 39, 9.5, 0.9, 0.3, 1.5, [['peach', 150], ['cup', 154]], 'fruit'],
  ['Pear',                                  57, 15.2, 0.4, 0.1, 3.1, [['pear', 178]], 'fruit'],
  ['Cherries',                              63, 16.0, 1.1, 0.2, 2.1, [['cup', 154]], 'fruit'],
  ['Raspberries',                           52, 11.9, 1.2, 0.7, 6.5, [['cup', 123]], 'fruit'],
  ['Blackberries',                          43, 9.6, 1.4, 0.5, 5.3, [['cup', 144]], 'fruit'],
  ['Lemon juice',                            22, 6.9, 0.4, 0.2, 0.3, [['tbsp', 15], ['lemon', 48]], 'fruit'],
  ['Lime juice',                             25, 8.4, 0.4, 0.1, 0.4, [['tbsp', 15], ['lime', 44]], 'fruit'],
  ['Orange juice',                          45, 10.4, 0.7, 0.2, 0.2, [['cup', 248], ['fl oz', 31]], 'fruit'],
  ['Apple juice',                           46, 11.3, 0.1, 0.1, 0.2, [['cup', 248]], 'fruit'],
  ['Applesauce, unsweetened',               42, 11.3, 0.2, 0.1, 1.1, [['cup', 244], ['pouch', 90]], 'fruit'],
  ['Dried cranberries',                    308, 82.4, 0.1, 1.4, 5.7, [['cup', 120], ['oz', OZ]], 'fruit'],

  // ---- more nuts, fats, spreads -------------------------------------------
  ['Pecans',                               691, 13.9, 9.2, 72.0, 9.6, [['oz', OZ], ['cup', 99]], 'fat'],
  ['Pistachios',                           560, 27.2, 20.2, 45.3, 10.6, [['oz', OZ], ['cup', 123]], 'fat'],
  ['Peanuts',                              567, 16.1, 25.8, 49.2, 8.5, [['oz', OZ], ['cup', 146]], 'fat'],
  ['Sunflower seeds',                      584, 20.0, 20.8, 51.5, 8.6, [['oz', OZ], ['cup', 140]], 'fat'],
  ['Almond butter',                        614, 18.8, 21.0, 55.5, 10.3, [['tbsp', 16], ['cup', 250]], 'fat'],
  ['Coconut oil',                          862, 0, 0, 100, 0, [['tbsp', 13.6], ['tsp', 4.5]], 'fat'],
  ['Hummus',                               166, 14.3, 7.9, 9.6, 6.0, [['tbsp', 15], ['cup', 246]], 'fat'],
  ['Guacamole',                            155, 8.0, 2.0, 14.0, 6.0, [['tbsp', 15], ['cup', 230]], 'fat'],
  ['Tahini',                               595, 21.2, 17.0, 53.8, 9.3, [['tbsp', 15]], 'fat'],
  ['Cream of chicken soup, condensed',     100, 8.0, 2.4, 6.0, 0.4, [['can', 298], ['cup', 248]], 'condiment'],

  // ---- more condiments, sauces, baking -------------------------------------
  ['Worcestershire sauce',                  78, 19.5, 0, 0, 0, [['tbsp', 17], ['tsp', 5.7]], 'condiment'],
  ['Hot sauce',                             11, 1.8, 0.5, 0.4, 1.4, [['tsp', 5], ['tbsp', 15]], 'condiment'],
  ['Teriyaki sauce',                       89, 15.6, 5.9, 0, 0, [['tbsp', 18]], 'condiment'],
  ['Ranch seasoning, dry',                 300, 60.0, 5.0, 4.0, 5.0, [['packet', 28], ['tbsp', 7]], 'condiment'],
  ['Pesto',                                458, 6.0, 6.0, 46.0, 2.0, [['tbsp', 16], ['cup', 240]], 'fat'],
  ['Alfredo sauce',                        180, 6.0, 3.0, 16.0, 0, [['cup', 250], ['tbsp', 16]], 'condiment'],
  ['Enchilada sauce',                       40, 7.0, 1.0, 1.0, 1.5, [['cup', 250], ['can', 283]], 'condiment'],
  ['Coconut milk, canned',                 197, 2.8, 2.0, 21.3, 0, [['cup', 240], ['can', 400]], 'fat'],
  ['Cornstarch',                           381, 91.3, 0.3, 0.1, 0.9, [['tbsp', 8], ['cup', 128]], 'grain'],
  ['Cocoa powder, unsweetened',            228, 57.9, 19.6, 13.7, 45.0, [['tbsp', 5], ['cup', 86]], 'sugar'],
  ['Chocolate chips, semisweet',           480, 63.9, 4.2, 30.0, 5.9, [['cup', 170], ['tbsp', 11]], 'sugar'],
  ['Powdered sugar',                       389, 99.8, 0, 0, 0, [['cup', 120], ['tbsp', 8]], 'sugar'],
  ['Vanilla extract',                      288, 12.7, 0.1, 0.1, 0, [['tsp', 4.2], ['tbsp', 13]], 'sugar', 34.4],

  // ---- beverages -----------------------------------------------------------
  ['Coffee, black',                          1, 0, 0.1, 0, 0, [['cup', 237], ['fl oz', 30]], 'drink'],
  ['Beer, regular',                         43, 3.6, 0.5, 0, 0, [['bottle', 355], ['fl oz', 30]], 'drink', 3.9],
  ['Wine, red',                             85, 2.6, 0.1, 0, 0, [['glass', 148], ['fl oz', 30]], 'drink', 10.6],
  ['Soda, cola',                            41, 10.6, 0, 0, 0, [['can', 355], ['fl oz', 30]], 'drink'],
  ['Kombucha',                              13, 3.2, 0, 0, 0, [['bottle', 480], ['cup', 240]], 'drink'],
];

/* Foods where the general Atwater factors genuinely do not apply, each with the
   reason. An explicit, named exemption is honest; widening the tolerance to
   cover them would let a real typo through everywhere else. */
const ATWATER_EXEMPT = {
  'Lemon juice': 'citric acid sits in total carbohydrate but is barely metabolised',
  'Lime juice':  'citric acid sits in total carbohydrate but is barely metabolised',
  'Cocoa powder, unsweetened': 'USDA uses cocoa-specific factors; its fat is poorly absorbed',
};

const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const foods = [];
const problems = [];
const seen = new Set();

for (const [n, kc, c, p, f, fib, units, tag, alc = 0] of T) {
  const id = slug(n);
  if (seen.has(id)) problems.push(`duplicate id: ${id}`);
  seen.add(id);

  /* Atwater, with fibre priced properly. Fibre is inside "total carbohydrate"
     on every label but yields around 2 kcal a gram rather than 4, so checking
     4*carb against the stated energy fails every vegetable in the list — not
     because the numbers are wrong but because the model was. */
  const derived = 4 * (c - fib) + 2 * fib + 4 * p + 9 * f + 7 * alc;
  const off = kc > 0 ? Math.abs(derived - kc) / kc : 0;
  if (kc > 20 && off > 0.25 && !ATWATER_EXEMPT[n]) {
    problems.push(`${n}: ${kc} kcal stated, ${round(derived)} from macros (${round(off * 100)}% out)`);
  }
  if (!units.length) problems.push(`${n}: no units`);

  foods.push({
    id, n, tag,
    per100: { kc, c, p, f, fib, alc },
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

/* The app is one self-contained file under a CSP whose connect-src names
   exactly one origin — the sync Worker. Fetching foods.json from its own origin
   would mean adding 'self' to that list, so the table is inlined instead: 9 KB
   compact against a 226 KB page, which is cheaper than widening the policy.
   Written from the same source as the JSON, in the same run, so the two cannot
   drift apart. */
const compact = foods.map((f) => [f.n, f.tag, ...f.units.map((u) => [u.u, u.g, u.kc, u.c, u.p, u.f])]);
const INLINE = 'const FOODS = ' + JSON.stringify(compact) + ';';
const page = 'web/public/index.html';
if (existsSync(page)) {
  const html = readFileSync(page, 'utf8');
  const re = /const FOODS = \[.*?\];/s;
  const next = re.test(html) ? html.replace(re, INLINE)
    : html.replace('const RECIPES = {', INLINE + '\n\nconst RECIPES = {');
  if (process.argv.includes('--check')) {
    if (next !== html) { console.error('build-foods --check: the FOODS table in index.html is stale'); process.exit(1); }
  } else if (next !== html) {
    writeFileSync(page, next);
    console.log(`build-foods: refreshed the FOODS table in ${page} (${INLINE.length} bytes)`);
  }
}
