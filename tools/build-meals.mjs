/*
 * Generates and validates the curated 100-meal catalog with tags, categories,
 * macros, pantry requirements, and culinary methods for endurance athletes.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const MEALS_CATALOG = [
  // =========================================================================
  // 1. ASIAN & STIR-FRY BOWLS (15)
  // =========================================================================
  {
    name: 'Teriyaki chicken rice bowls',
    category: 'Asian',
    tags: ['asian', 'carb-heavy', 'high-protein', 'quick-prep'],
    serves: 'High-glycogen recovery dinner. 30 minutes start to table. Doubles well for next-day lunch.',
    macros: { kc: 620, c: 84, p: 46, f: 10 },
    pantry: ['1/3 cup soy sauce', '3 tbsp honey', '1 tbsp grated ginger', '3 cloves garlic', '1 tbsp cornstarch', '1 tbsp neutral oil', 'sesame seeds', '1 lime'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'White rice, dry', q: '1.5 cups' },
      { n: 'Broccoli, raw', q: '1 head (florets)' },
      { n: 'Carrots, raw', q: '3 carrots (sliced)' }
    ],
    method: [
      'Start rice first: rinse 1.5 cups rice, add 2.25 cups water, bring to boil, cover and simmer 18 min on low, then rest 10 min off heat.',
      'Make the sauce: whisk soy sauce, honey, grated ginger, minced garlic, and 2 tbsp water in a small bowl. Mix 1 tbsp cornstarch with 2 tbsp cold water in a separate cup.',
      'Slice chicken thin across the grain into 1/4-inch strips.',
      'Heat 1 tbsp oil in a wide skillet over high heat until shimmering. Sear chicken in two batches — a single layer only. Crowding steams instead of searing. 2-3 min per side.',
      'Return all chicken to pan. Pour sauce over, bubble 1 minute. Add cornstarch slurry and stir until glossy and thick, about 30 seconds. Remove from heat.',
      'Steam broccoli florets and sliced carrots in a steamer basket or microwave with 2 tbsp water for 4-5 minutes until just tender with bite.',
      'Build bowls: rice first, then vegetables, then chicken and all the pan sauce. Finish with sesame seeds and a squeeze of fresh lime.'
    ]
  },
  {
    name: 'Beef and broccoli stir-fry',
    category: 'Asian',
    tags: ['asian', 'high-protein', 'quick-prep'],
    serves: 'High-protein, iron-rich dinner with steamed jasmine or brown rice.',
    macros: { kc: 580, c: 56, p: 48, f: 18 },
    pantry: ['1 lb lean flank or sirloin steak', '1 large head broccoli', '3 tbsp soy sauce', '1 tbsp oyster sauce or hoisin', '1 tbsp honey', '1 tbsp cornstarch', '1 tbsp ginger', '3 cloves garlic', '2 tbsp sesame oil'],
    ingredients: [
      { n: 'Sirloin steak, raw', q: '1 lb' },
      { n: 'Broccoli, raw', q: '1 head' },
      { n: 'White rice, dry', q: '1.5 cups' }
    ],
    method: [
      'Put rice on to cook first (wants 20 minutes).',
      'Slice beef thin against the grain. Whisk 1 tbsp soy sauce with cornstarch and toss with beef. Let sit 10 minutes.',
      'Sauce: Whisk remaining 2 tbsp soy sauce, oyster sauce, honey, ginger, garlic, and 3 tbsp water.',
      'Cut broccoli into bite-sized florets. Blanch in boiling water for 90 seconds, then drain.',
      'Heat oil in a wide wok or skillet over high heat. Add beef in a single layer and sear hard for 2 minutes without moving, then flip for 1 minute. Remove to a plate.',
      'Add broccoli and sauce to the hot pan. Bubble 1 minute until glossy and thickened.',
      'Return beef and resting juices to the wok, toss together for 30 seconds. Serve over rice.'
    ]
  },
  {
    name: 'Chicken and vegetable fried rice',
    category: 'Asian',
    tags: ['asian', 'carb-heavy', 'quick-prep'],
    serves: 'High-glycogen recovery dinner utilizing chilled leftover rice.',
    macros: { kc: 640, c: 78, p: 42, f: 16 },
    pantry: ['2 cups cold cooked white rice', '1 lb diced chicken breast', '2 eggs beaten', '1 cup frozen peas and carrots', '3 green onions', '2 tbsp soy sauce', '1 tbsp sesame oil', '2 cloves garlic', 'salt and pepper'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1 lb' },
      { n: 'White rice, dry', q: '1.5 cups' },
      { n: 'Egg, whole, large', q: '2 eggs' },
      { n: 'Peas, frozen', q: '1 cup' },
      { n: 'Carrots, raw', q: '2 carrots' }
    ],
    method: [
      'Heat 1 tbsp oil in a large skillet or wok over high heat. Season chicken with salt and pepper, stir-fry 5-6 minutes until cooked through. Remove to plate.',
      'Push heat to high, add 1 tbsp oil, and dump in chilled rice. Break up clumps and fry undisturbed for 2 minutes to get crispy bits.',
      'Push rice to the sides of the pan to create an open well in the center. Pour in beaten eggs and scramble quickly for 1 minute.',
      'Toss rice and eggs together, add frozen peas and carrots, minced garlic, and cooked chicken.',
      'Drizzle soy sauce and sesame oil around the edges of the pan so it sizzles into the rice.',
      'Toss everything vigorously for 2 minutes until steaming hot and fragrant. Fold in sliced green onions and serve.'
    ]
  },
  {
    name: 'Korean BBQ ground turkey bowls',
    category: 'Asian',
    tags: ['asian', 'spicy', 'high-protein', 'quick-prep'],
    serves: 'Fast 15-minute savory and spicy ground turkey bowls.',
    macros: { kc: 590, c: 62, p: 44, f: 17 },
    pantry: ['3 tbsp soy sauce', '2 tbsp brown sugar', '1 tbsp toasted sesame oil', '1 tsp sriracha', '1 tbsp ginger', '3 cloves garlic', 'green onions', 'sesame seeds'],
    ingredients: [
      { n: 'Ground turkey, 93/7, raw', q: '1 lb' },
      { n: 'White rice, dry', q: '1.5 cups' },
      { n: 'Cucumber', q: '1 cucumber' },
      { n: 'Carrots, raw', q: '2 carrots' }
    ],
    method: [
      'Rice on first.',
      'Whisk soy sauce, brown sugar, sesame oil, sriracha, ginger, and garlic.',
      'Brown ground turkey in a large skillet over medium-high heat, breaking into fine crumbles, 6-7 minutes.',
      'Pour sauce over turkey and simmer 2 minutes until glazed and sticky.',
      'Serve over warm rice with thinly sliced raw cucumbers, shredded carrots, and green onions.'
    ]
  },
  {
    name: 'Honey garlic chicken + jasmine rice',
    category: 'Asian',
    tags: ['asian', 'carb-heavy', 'high-protein'],
    serves: 'Sweet and savory glazed chicken breast with aromatic jasmine rice.',
    macros: { kc: 630, c: 86, p: 45, f: 9 },
    pantry: ['1/3 cup honey', '4 cloves garlic minced', '3 tbsp soy sauce', '1 tbsp apple cider vinegar', '1 tbsp cornstarch', 'olive oil'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'White rice, dry', q: '1.5 cups' },
      { n: 'Green beans, raw', q: '12 oz' }
    ],
    method: [
      'Cook jasmine rice.',
      'Cut chicken into bite-sized cubes. Toss with salt, pepper, and 1 tbsp cornstarch.',
      'Sear chicken in 1 tbsp hot oil for 5-6 minutes until golden.',
      'Stir in honey, minced garlic, soy sauce, and vinegar. Simmer 3 minutes until thickened into a glossy glaze.',
      'Steam green beans 5 minutes. Serve chicken over rice with green beans and extra sauce.'
    ]
  },
  {
    name: 'Tofu and soba vegetable stir-fry',
    category: 'Asian',
    tags: ['asian', 'plant-based', 'carb-heavy'],
    serves: 'Plant-based high-carb endurance meal. 30 minutes. Press tofu ahead of time to speed this up.',
    macros: { kc: 520, c: 74, p: 26, f: 14 },
    pantry: ['3 tbsp soy sauce', '1 tbsp toasted sesame oil', '1 tbsp maple syrup', '1 tbsp cornstarch', '2 cloves garlic minced', 'sesame seeds'],
    ingredients: [
      { n: 'Tofu, firm', q: '1 block (14 oz)' },
      { n: 'Soba noodles, dry', q: '8 oz' },
      { n: 'Bell pepper, raw', q: '1 pepper (sliced)' },
      { n: 'Carrots, raw', q: '2 carrots (julienned)' },
      { n: 'Green beans, raw', q: '8 oz (trimmed)' }
    ],
    method: [
      'Press tofu: wrap block in a clean towel, set a heavy pan on top for 15 minutes minimum. Then cut into 1-inch cubes and toss with 1 tbsp cornstarch and a pinch of salt.',
      'Whisk soy sauce, sesame oil, maple syrup, and minced garlic into sauce. Set aside.',
      'Boil soba noodles in plenty of water 4-5 minutes. Drain immediately and rinse under cold water to stop cooking and prevent clumping.',
      'Heat 1 tbsp neutral oil in a wide skillet over medium-high. Pan-fry tofu in a single layer 8-10 minutes, turning every 2-3 minutes until crisp and golden on multiple sides. Remove to a plate.',
      'In the same hot pan, stir-fry sliced peppers, carrots, and green beans with 2 tbsp water for 3-4 minutes until just tender.',
      'Add soba noodles, pour sauce over everything, return tofu to pan. Toss vigorously 1 minute until everything is hot and evenly coated. Garnish with sesame seeds.'
    ]
  },
  {
    name: 'Thai basil chicken (Pad Krapow)',
    category: 'Asian',
    tags: ['asian', 'spicy', 'quick-prep', 'high-protein'],
    serves: 'Aromatic spicy Thai street-style chicken with crispy fried egg.',
    macros: { kc: 610, c: 68, p: 46, f: 16 },
    pantry: ['2 tbsp oyster sauce', '1 tbsp soy sauce', '1 tsp fish sauce', '1 tsp sugar', '4 cloves garlic', '2 thai chilies or jalapeno', 'fresh basil'],
    ingredients: [
      { n: 'Ground chicken, raw', q: '1 lb' },
      { n: 'White rice, dry', q: '1.5 cups' },
      { n: 'Egg, whole, large', q: '2 eggs' },
      { n: 'Bell pepper, raw', q: '1 pepper' }
    ],
    method: [
      'Pound garlic and chilies in a mortar or chop finely.',
      'Sear ground chicken in high heat wok 4 minutes. Add garlic and chilies, stir 1 minute.',
      'Pour in oyster sauce, soy sauce, fish sauce, and sugar. Stir 2 minutes until glossy.',
      'Turn off heat and fold in fresh basil until wilted.',
      'Fry eggs in hot oil until edges are blistered and yolk is runny. Serve over rice.'
    ]
  },
  {
    name: 'Chicken Pad Thai',
    category: 'Asian',
    tags: ['asian', 'carb-heavy', 'comfort'],
    serves: 'Classic rice noodle stir-fry with tamarind sauce and crushed peanuts.',
    macros: { kc: 670, c: 92, p: 40, f: 15 },
    pantry: ['3 tbsp fish sauce', '2 tbsp tamarind paste or lime juice', '2 tbsp brown sugar', '2 cloves garlic', 'crushed peanuts', 'lime wedges'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1 lb' },
      { n: 'Egg, whole, large', q: '2 eggs' },
      { n: 'Peanuts', q: '1/4 cup' },
      { n: 'Green onion', q: '1 bunch' }
    ],
    method: [
      'Soak flat rice noodles in warm water 20 minutes until pliable.',
      'Whisk fish sauce, tamarind, brown sugar, and 2 tbsp water.',
      'Stir-fry sliced chicken in hot oil 4 minutes. Push aside, scramble eggs.',
      'Add soaked noodles and sauce, toss vigorously 2 minutes until noodles absorb sauce.',
      'Fold in green onions and crushed peanuts. Serve with fresh lime.'
    ]
  },
  {
    name: 'Honey sriracha glazed salmon + rice',
    category: 'Asian',
    tags: ['asian', 'spicy', 'high-protein'],
    serves: 'Omega-3 rich salmon with spicy honey sriracha glaze.',
    macros: { kc: 620, c: 60, p: 44, f: 21 },
    pantry: ['2 tbsp sriracha', '3 tbsp honey', '2 tbsp soy sauce', '1 tbsp lime juice', '2 cloves garlic'],
    ingredients: [
      { n: 'Salmon, Atlantic, raw', q: '1.25 lb' },
      { n: 'White rice, dry', q: '1.5 cups' },
      { n: 'Asparagus, raw', q: '1 bunch' }
    ],
    method: [
      'Preheat oven to 400°F.',
      'Whisk sriracha, honey, soy sauce, lime juice, and garlic.',
      'Place salmon fillets on foil-lined pan. Spoon half glaze over salmon.',
      'Bake 12-14 minutes, brushing remaining glaze in last 3 minutes.',
      'Serve over rice with steamed asparagus.'
    ]
  },
  {
    name: 'Sweet and sour chicken with pineapple',
    category: 'Asian',
    tags: ['asian', 'carb-heavy'],
    serves: 'Vibrant pineapple and bell pepper stir-fry with crispy chicken.',
    macros: { kc: 650, c: 94, p: 38, f: 12 },
    pantry: ['1/3 cup ketchup', '1/4 cup apple cider vinegar', '3 tbsp brown sugar', '1 tbsp soy sauce', '1 tbsp cornstarch'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'Pineapple', q: '1 cup chunks' },
      { n: 'Bell pepper, raw', q: '2 peppers' },
      { n: 'White rice, dry', q: '1.5 cups' }
    ],
    method: [
      'Cook rice.',
      'Toss cubed chicken in 2 tbsp cornstarch, salt, and pepper. Pan-fry in oil 6-8 minutes until golden.',
      'Add bell peppers and pineapple chunks, stir-fry 2 minutes.',
      'Whisk sauce ingredients, pour into pan, and bubble 2 minutes until glossy and thick.',
      'Serve piping hot over rice.'
    ]
  },
  {
    name: 'Miso glazed cod + brown rice',
    category: 'Asian',
    tags: ['asian', 'high-protein', 'quick-prep'],
    serves: 'Delicate flaky cod fillet in savory umami miso glaze.',
    macros: { kc: 490, c: 54, p: 42, f: 10 },
    pantry: ['2 tbsp white miso paste', '1 tbsp mirin or honey', '1 tbsp soy sauce', '1 tsp sesame oil'],
    ingredients: [
      { n: 'Cod, raw', q: '1.25 lb' },
      { n: 'Brown rice, dry', q: '1.25 cups' },
      { n: 'Mushrooms, raw', q: '8 oz' },
      { n: 'Spinach, raw', q: '1 bag' }
    ],
    method: [
      'Cook brown rice.',
      'Whisk miso, honey, soy sauce, and sesame oil into a smooth paste. Brush over cod fillets.',
      'Broil cod on high 6-8 inches from heat for 8-10 minutes until caramelized and flaky.',
      'Sauté mushrooms and spinach in 1 tsp oil for 3 minutes.',
      'Serve cod over brown rice alongside sautéed vegetables.'
    ]
  },
  {
    name: 'Vietnamese lemongrass chicken bowls',
    category: 'Asian',
    tags: ['asian', 'high-protein', 'quick-prep'],
    serves: 'Bright, citrusy grilled chicken with rice vermicelli and fresh herbs.',
    macros: { kc: 580, c: 68, p: 44, f: 14 },
    pantry: ['2 tbsp fish sauce', '1 tbsp brown sugar', '1 tbsp lime juice', '2 cloves garlic', '1 tbsp minced lemongrass or zest', 'olive oil'],
    ingredients: [
      { n: 'Chicken thigh, boneless skinless, raw', q: '1.25 lb' },
      { n: 'Cucumber', q: '1 cucumber' },
      { n: 'Carrots, raw', q: '2 carrots' },
      { n: 'White rice, dry', q: '1.5 cups' }
    ],
    method: [
      'Marinate chicken thighs with fish sauce, sugar, lime juice, garlic, and lemongrass for 20 minutes.',
      'Grill or pan-sear chicken over medium-high heat 5-6 minutes per side until charred and cooked to 165°F.',
      'Slice into strips.',
      'Assemble bowls with warm rice, sliced chicken, ribbons of carrot, cucumber, and fresh cilantro.'
    ]
  },
  {
    name: 'Mongolian ground beef + scallions',
    category: 'Asian',
    tags: ['asian', 'spicy', 'quick-prep'],
    serves: 'Rich brown sugar garlic soy ground beef with crisp scallions.',
    macros: { kc: 620, c: 66, p: 42, f: 20 },
    pantry: ['1/3 cup soy sauce', '3 tbsp brown sugar', '1 tbsp cornstarch', '4 cloves garlic', '1 tbsp ginger', '1/2 tsp red pepper flakes', '1 bunch scallions'],
    ingredients: [
      { n: 'Ground beef, 90/10, raw', q: '1 lb' },
      { n: 'White rice, dry', q: '1.5 cups' },
      { n: 'Green onion', q: '2 bunches' }
    ],
    method: [
      'Brown ground beef in a wide skillet, breaking fine. Drain excess fat.',
      'Add minced garlic, ginger, and red pepper flakes for 1 minute.',
      'Whisk soy sauce, brown sugar, cornstarch, and 1/4 cup water. Pour into skillet.',
      'Simmer 2 minutes until thick and glossy.',
      'Fold in 2-inch scallion pieces and remove from heat immediately so they stay crisp. Serve over rice.'
    ]
  },
  {
    name: 'Kung Pao chicken + peanuts',
    category: 'Asian',
    tags: ['asian', 'spicy', 'high-protein'],
    serves: 'Spicy Sichuan stir-fry with crunchy roasted peanuts and peppers.',
    macros: { kc: 630, c: 64, p: 46, f: 21 },
    pantry: ['2 tbsp soy sauce', '1 tbsp balsamic vinegar', '1 tbsp hoisin', '1 tbsp cornstarch', '1 tsp sriracha', '1/4 cup roasted peanuts', 'dried red chilis'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'Bell pepper, raw', q: '2 peppers' },
      { n: 'Zucchini, raw', q: '1 zucchini' },
      { n: 'Peanuts', q: '1/4 cup' }
    ],
    method: [
      'Toss diced chicken with 1 tbsp soy sauce and cornstarch. Sear in hot wok 4 minutes.',
      'Add diced bell peppers, zucchini, and dried chilies. Stir-fry 3 minutes.',
      'Pour over whisked Kung Pao sauce, bubble 1 minute until thick.',
      'Toss in roasted peanuts and serve over rice.'
    ]
  },
  {
    name: 'Thai red curry chicken + coconut rice',
    category: 'Asian',
    tags: ['asian', 'spicy', 'comfort', 'carb-heavy'],
    serves: 'Creamy coconut milk red curry with bamboo shoots and bell peppers.',
    macros: { kc: 680, c: 78, p: 42, f: 22 },
    pantry: ['2 tbsp Thai red curry paste', '1 can light coconut milk', '1 tbsp fish sauce', '1 tbsp brown sugar', 'fresh basil', 'lime'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'Coconut milk, canned', q: '1 can' },
      { n: 'Bell pepper, raw', q: '2 peppers' },
      { n: 'White rice, dry', q: '1.5 cups' }
    ],
    method: [
      'Fry red curry paste in 1 tbsp coconut cream from top of can for 2 minutes until fragrant.',
      'Add sliced chicken, stir 3 minutes.',
      'Pour in remaining coconut milk, bell peppers, fish sauce, and sugar. Simmer 12 minutes.',
      'Finish with fresh basil and a squeeze of lime. Serve over hot jasmine rice.'
    ]
  },

  // =========================================================================
  // 2. MEXICAN & SOUTHWEST (15)
  // =========================================================================
  {
    name: 'Taco night',
    category: 'Mexican',
    tags: ['mexican', 'high-protein', 'comfort'],
    serves: 'Family dinner, 30 minutes. Season the turkey well — it glazes down to something really good. Leftovers keep 3 days.',
    macros: { kc: 610, c: 64, p: 45, f: 18 },
    pantry: ['1 tbsp oil', '1 onion (diced)', '2 cloves garlic (minced)', '1/2 cup chicken stock', '2 tbsp chili powder', '2 tsp cumin', '1 tsp smoked paprika', '1 tsp dried oregano', 'salt and pepper', '1 lime'],
    ingredients: [
      { n: 'Ground turkey, 93/7, raw', q: '1.5 lb' },
      { n: 'Tortilla, corn, 6 inch', q: '12 tortillas' },
      { n: 'Black beans, canned, drained', q: '1 can' },
      { n: 'Salsa', q: '1 jar (16 oz)' },
      { n: 'Cheddar cheese', q: '4 oz shredded' }
    ],
    method: [
      'Drain and rinse black beans, warm in a small pot with a pinch of cumin on low. Keep warm.',
      'Heat oil in a wide pan over medium-high. Sauté diced onion 5 minutes until softened. Add garlic 30 seconds until fragrant.',
      'Add ground turkey. Break into small crumbles and cook 8-10 minutes until fully browned with some dark edges — don\'t rush this step.',
      'Add chili powder, cumin, paprika, and oregano. Stir into meat and cook 1 minute until fragrant.',
      'Pour in stock and 1/3 of the salsa. Simmer uncovered 8-10 minutes, stirring occasionally, until the liquid mostly evaporates and the meat starts to glaze. Season with salt and pepper.',
      'Warm corn tortillas: place in a dry hot pan 20 seconds per side, then stack and wrap in a clean towel to steam soft.',
      'Set out tortillas, spiced turkey, warm black beans, remaining salsa, shredded cheese, and lime wedges. Let everyone build their own.'
    ]
  },
  {
    name: 'Chicken fajitas',
    category: 'Mexican',
    tags: ['mexican', 'carb-heavy', 'sheet-pan'],
    serves: 'Double batch: dinner tonight, plus fajita wraps for tomorrow’s lunch.',
    macros: { kc: 630, c: 72, p: 48, f: 16 },
    pantry: ['2 tbsp olive oil', '2 bell peppers', '1 onion', '3 cloves garlic', 'chili powder, cumin, paprika, oregano', 'salt and pepper', 'lime'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.5 lb' },
      { n: 'Bell pepper, raw', q: '3 peppers' },
      { n: 'Onion, raw', q: '2 onions' },
      { n: 'Tortilla, flour, 8 inch', q: '8 tortillas' }
    ],
    method: [
      'Slice chicken into 1/2-inch strips. Toss with 1 tbsp oil, spices, garlic, salt, pepper, and lime juice.',
      'Slice peppers and onions into long strips.',
      'Heat heavy skillet over high heat until smoking. Add 1 tbsp oil.',
      'Sear chicken in single layer 3-4 minutes, flip, 2 minutes more. Plate.',
      'Drop peppers and onions into smoking skillet with salt. Cook 4-5 minutes until charred at edges.',
      'Return chicken and juices to pan, toss 1 minute with fresh lime juice.',
      'Warm tortillas dry in pan. Serve with salsa and Greek yogurt.'
    ]
  },
  {
    name: 'Slow-cooker chicken and black bean stew',
    category: 'Mexican',
    tags: ['mexican', 'slow-cooker', 'comfort', 'carb-heavy'],
    serves: 'Four large meal-prep portions with complex carbs and lean protein.',
    macros: { kc: 560, c: 68, p: 46, f: 11 },
    pantry: ['2 cans black beans', '1 can diced tomatoes', '1 cup frozen corn', '1 cup chicken broth', '1 onion', 'taco seasoning', 'salt and pepper', 'cilantro'],
    ingredients: [
      { n: 'Chicken thigh, boneless skinless, raw', q: '1.5 lb' },
      { n: 'Black beans, canned, drained', q: '2 cans' },
      { n: 'Corn, frozen', q: '1 cup' },
      { n: 'Onion, raw', q: '1 onion' }
    ],
    method: [
      'Place diced onion, black beans, tomatoes with juice, corn, and broth in slow cooker.',
      'Stir in taco seasoning, 1 tsp salt, and pepper.',
      'Nestle chicken thighs into liquid.',
      'Cover and cook on LOW 6-7 hours or HIGH 3.5-4 hours until tender.',
      'Shred chicken with two forks, return to stew.',
      'Serve over rice or with warm corn tortillas.'
    ]
  },
  {
    name: 'Ground beef enchilada skillet',
    category: 'Mexican',
    tags: ['mexican', 'comfort', 'high-protein'],
    serves: 'One-pan cheesy beef enchilada pasta bake.',
    macros: { kc: 660, c: 62, p: 48, f: 24 },
    pantry: ['1 can red enchilada sauce', '1 can black beans', '1 cup corn', '1 tsp cumin', '1 tsp chili powder', '1 cup shredded cheddar'],
    ingredients: [
      { n: 'Ground beef, 90/10, raw', q: '1.25 lb' },
      { n: 'Enchilada sauce', q: '1 can (10 oz)' },
      { n: 'Tortilla, corn, 6 inch', q: '6 tortillas (cut into strips)' },
      { n: 'Cheddar cheese', q: '1 cup shredded' }
    ],
    method: [
      'Brown ground beef with cumin and chili powder in a large oven-safe skillet. Drain fat.',
      'Add enchilada sauce, drained black beans, corn, and cut corn tortilla strips. Simmer 5 minutes.',
      'Top with shredded cheddar cheese.',
      'Broil on high 3 minutes until cheese is bubbly and golden. Top with cilantro and diced avocado.'
    ]
  },
  {
    name: 'Carne asada steak tacos',
    category: 'Mexican',
    tags: ['mexican', 'high-protein', 'quick-prep'],
    serves: 'Citrus-marinated grilled flank steak tacos with pico de gallo.',
    macros: { kc: 620, c: 54, p: 48, f: 21 },
    pantry: ['2 limes juiced', '1 orange juiced', '4 cloves garlic', '1 tbsp cumin', '1 tbsp chili powder', 'olive oil', 'fresh cilantro'],
    ingredients: [
      { n: 'Sirloin steak, raw', q: '1.25 lb' },
      { n: 'Tortilla, corn, 6 inch', q: '10 tortillas' },
      { n: 'Avocado', q: '1 avocado' },
      { n: 'Tomato, raw', q: '2 tomatoes' }
    ],
    method: [
      'Marinate steak in citrus juices, garlic, cumin, and olive oil for 30 minutes.',
      'Grill steak over high heat 4-5 minutes per side for medium-rare. Rest 10 minutes, then slice thin against grain.',
      'Dice tomatoes, onion, and cilantro for quick pico de gallo.',
      'Warm corn tortillas and build tacos with sliced steak, pico, and avocado.'
    ]
  },
  {
    name: 'Baja fish tacos + chipotle crema',
    category: 'Mexican',
    tags: ['mexican', 'high-protein', 'quick-prep'],
    serves: 'Pan-seared seasoned cod tacos with crunchy lime cabbage slaw.',
    macros: { kc: 540, c: 58, p: 44, f: 14 },
    pantry: ['1/2 cup Greek yogurt', '1 tbsp chipotle sauce or adobo', '1 lime', 'chili powder, cumin, garlic powder', 'salt and pepper'],
    ingredients: [
      { n: 'Cod, raw', q: '1.25 lb' },
      { n: 'Coleslaw mix', q: '1 bag' },
      { n: 'Tortilla, corn, 6 inch', q: '8 tortillas' },
      { n: 'Greek yogurt, plain, nonfat', q: '1/2 cup' }
    ],
    method: [
      'Toss shredded cabbage with lime juice, 1 tbsp olive oil, and salt.',
      'Whisk Greek yogurt with chipotle sauce, lime juice, and a pinch of salt.',
      'Season cod fillets with chili powder, cumin, and garlic powder. Pan-sear in oil 3-4 minutes per side until flaky.',
      'Flake fish into large chunks.',
      'Assemble warm tortillas with fish, crunchy slaw, and chipotle crema drizzle.'
    ]
  },
  {
    name: 'Turkey black bean quesadillas',
    category: 'Mexican',
    tags: ['mexican', 'quick-prep', 'carb-heavy'],
    serves: 'Crispy toasted golden tortillas packed with spiced turkey and black beans.',
    macros: { kc: 630, c: 68, p: 46, f: 18 },
    pantry: ['taco seasoning', 'olive oil', 'salsa', 'Greek yogurt or sour cream'],
    ingredients: [
      { n: 'Ground turkey, 93/7, raw', q: '1 lb' },
      { n: 'Black beans, canned, drained', q: '1 can' },
      { n: 'Tortilla, flour, 8 inch', q: '6 tortillas' },
      { n: 'Cheddar cheese', q: '1.5 cups shredded' }
    ],
    method: [
      'Brown turkey with taco seasoning and 1/4 cup water. Stir in drained black beans.',
      'Lay tortillas flat, top half of each with cheese, turkey bean mixture, and more cheese. Fold in half.',
      'Cook in a hot dry skillet over medium heat 3 minutes per side until golden brown and cheese is melted.',
      'Cut into wedges and serve with salsa.'
    ]
  },
  {
    name: 'Barbacoa beef rice bowls',
    category: 'Mexican',
    tags: ['mexican', 'slow-cooker', 'carb-heavy'],
    serves: 'Tender slow-cooked shredded beef with cilantro lime rice.',
    macros: { kc: 670, c: 74, p: 50, f: 19 },
    pantry: ['1/2 cup beef broth', '2 chipotle peppers in adobo', '4 cloves garlic', '1 tbsp cumin', '1 tbsp oregano', '1/4 cup lime juice', 'fresh cilantro'],
    ingredients: [
      { n: 'Ground beef, 90/10, raw', q: '1.5 lb' },
      { n: 'White rice, dry', q: '1.5 cups' },
      { n: 'Black beans, canned, drained', q: '1 can' },
      { n: 'Avocado', q: '1 avocado' }
    ],
    method: [
      'Blend broth, chipotles, garlic, cumin, oregano, and lime juice.',
      'Slow cook beef with sauce on LOW 7 hours until fall-apart tender.',
      'Cook rice, toss with lime juice, salt, and cilantro.',
      'Build bowls with cilantro rice, shredded barbacoa beef, black beans, and avocado.'
    ]
  },
  {
    name: 'Green chile chicken enchiladas',
    category: 'Mexican',
    tags: ['mexican', 'comfort', 'spicy'],
    serves: 'Baked enchiladas with green salsa verde and Monterey Jack cheese.',
    macros: { kc: 640, c: 58, p: 48, f: 22 },
    pantry: ['1 jar salsa verde (16 oz)', '1/2 cup sour cream or Greek yogurt', '1 tsp cumin', '1 tsp garlic powder'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'Tortilla, corn, 6 inch', q: '10 tortillas' },
      { n: 'Mozzarella, part skim, shredded', q: '1.5 cups' },
      { n: 'Salsa', q: '1 jar salsa verde' }
    ],
    method: [
      'Poach or sear chicken, then shred. Mix with 1/2 cup salsa verde and sour cream.',
      'Preheat oven to 375°F. Spread 1/2 cup salsa verde in bottom of baking dish.',
      'Warm corn tortillas, fill with shredded chicken and cheese, roll tightly and arrange in dish.',
      'Pour remaining salsa verde over top, sprinkle remaining cheese.',
      'Bake 20 minutes until bubbling and golden.'
    ]
  },
  {
    name: 'Mexican ground turkey rice skillet',
    category: 'Mexican',
    tags: ['mexican', 'one-pot', 'quick-prep', 'carb-heavy'],
    serves: 'Fast one-skillet dinner with rice, sweet corn, and spiced turkey.',
    macros: { kc: 610, c: 76, p: 44, f: 14 },
    pantry: ['1 tbsp oil', '2 cups chicken broth', '1 packet taco seasoning', '1 cup diced tomatoes', '1 cup shredded cheese'],
    ingredients: [
      { n: 'Ground turkey, 93/7, raw', q: '1.25 lb' },
      { n: 'White rice, dry', q: '1.25 cups' },
      { n: 'Corn, frozen', q: '1 cup' },
      { n: 'Cheddar cheese', q: '1 cup shredded' }
    ],
    method: [
      'Brown turkey in a deep skillet with taco seasoning for 6 minutes.',
      'Add dry rice, chicken broth, diced tomatoes, and corn. Stir and bring to a boil.',
      'Cover tightly, reduce heat to low, simmer 18 minutes until rice is tender.',
      'Sprinkle cheese over top, cover 2 minutes to melt. Serve with lime.'
    ]
  },
  {
    name: 'Chipotle grilled chicken burrito bowl',
    category: 'Mexican',
    tags: ['mexican', 'high-protein', 'carb-heavy'],
    serves: 'Loaded endurance bowl with brown rice, pinto beans, and guacamole.',
    macros: { kc: 670, c: 80, p: 52, f: 16 },
    pantry: ['1 tbsp chipotle paste', '2 cloves garlic', '1 lime', '1 tsp cumin', 'olive oil', 'salt and pepper'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'Brown rice, dry', q: '1.5 cups' },
      { n: 'Black beans, canned, drained', q: '1 can' },
      { n: 'Salsa', q: '1 cup' },
      { n: 'Guacamole', q: '1/2 cup' }
    ],
    method: [
      'Marinate chicken breast in chipotle paste, garlic, olive oil, cumin, and lime for 15 minutes.',
      'Grill or sear 6 minutes per side to 165°F. Rest and dice.',
      'Warm brown rice and black beans.',
      'Build bowls with brown rice base, black beans, diced chipotle chicken, salsa, and fresh guacamole.'
    ]
  },
  {
    name: 'Cheesy sweet potato & black bean bake',
    category: 'Mexican',
    tags: ['mexican', 'plant-based', 'carb-heavy', 'comfort'],
    serves: 'Nutrient-rich vegetarian casserole loaded with beta-carotene and fiber.',
    macros: { kc: 580, c: 88, p: 24, f: 14 },
    pantry: ['1 jar salsa (16 oz)', '1 tsp chili powder', '1 tsp cumin', '1 tsp garlic powder', 'olive oil'],
    ingredients: [
      { n: 'Sweet potato, raw', q: '3 potatoes' },
      { n: 'Black beans, canned, drained', q: '2 cans' },
      { n: 'Corn, frozen', q: '1 cup' },
      { n: 'Cheddar cheese', q: '1.5 cups shredded' }
    ],
    method: [
      'Preheat oven to 375°F. Peel and dice sweet potatoes into 1/2-inch cubes. Steam 10 minutes until slightly tender.',
      'In a large baking dish, mix steamed sweet potatoes, black beans, corn, salsa, and spices.',
      'Top with shredded cheddar cheese.',
      'Bake 25 minutes until bubbling and sweet potatoes are fork-tender.'
    ]
  },
  {
    name: 'Grilled chicken tostadas + refried beans',
    category: 'Mexican',
    tags: ['mexican', 'quick-prep', 'high-protein'],
    serves: 'Crunchy baked corn tostadas stacked high with beans, chicken, and slaw.',
    macros: { kc: 560, c: 56, p: 46, f: 16 },
    pantry: ['taco seasoning', 'lime juice', 'hot sauce', 'olive oil'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1 lb' },
      { n: 'Tortilla, corn, 6 inch', q: '6 tortillas' },
      { n: 'Black beans, canned, drained', q: '1 can (mashed with spices)' },
      { n: 'Romaine lettuce', q: '1 head shredded' }
    ],
    method: [
      'Brush corn tortillas lightly with oil, bake at 400°F 8-10 minutes until crispy and golden.',
      'Sear diced seasoned chicken breast 6 minutes.',
      'Warm mashed black beans with cumin and garlic.',
      'Spread beans onto crispy tostada shells, top with chicken, shredded lettuce, salsa, and hot sauce.'
    ]
  },
  {
    name: 'Southwest turkey chili + avocado',
    category: 'Mexican',
    tags: ['mexican', 'comfort', 'high-protein', 'spicy'],
    serves: 'Rich smoky turkey chili with kidney beans, corn, and fresh avocado.',
    macros: { kc: 590, c: 62, p: 48, f: 16 },
    pantry: ['2 tbsp chili powder', '1 tbsp cumin', '1 tsp smoked paprika', '2 cups chicken broth', '1 can diced tomatoes', 'olive oil'],
    ingredients: [
      { n: 'Ground turkey, 93/7, raw', q: '1.5 lb' },
      { n: 'Kidney beans, canned, drained', q: '2 cans' },
      { n: 'Corn, frozen', q: '1 cup' },
      { n: 'Avocado', q: '1 avocado' }
    ],
    method: [
      'Brown turkey in large Dutch oven 6 minutes.',
      'Add spices, diced tomatoes, drained kidney beans, corn, and broth.',
      'Simmer uncovered 35 minutes until rich and thick.',
      'Ladle into bowls and top with diced avocado and cilantro.'
    ]
  },
  {
    name: 'Spicy chorizo & sweet potato breakfast hash',
    category: 'Mexican',
    tags: ['mexican', 'spicy', 'breakfast-for-dinner'],
    serves: 'Skillet hash with roasted sweet potatoes, spicy sausage, and fried eggs.',
    macros: { kc: 640, c: 56, p: 38, f: 28 },
    pantry: ['olive oil', 'smoked paprika', 'salt and pepper', 'hot sauce'],
    ingredients: [
      { n: 'Italian sausage, raw', q: '12 oz' },
      { n: 'Sweet potato, raw', q: '2 large potatoes (cubed)' },
      { n: 'Bell pepper, raw', q: '1 pepper' },
      { n: 'Egg, whole, large', q: '4 eggs' }
    ],
    method: [
      'Sauté diced sweet potatoes in 1 tbsp oil over medium-high heat 12-14 minutes until tender and caramelized.',
      'Add crumbled sausage and diced peppers, cooking 6 minutes until browned.',
      'Make four wells in the hash, crack in eggs, cover and cook 3-4 minutes until whites are set.',
      'Drizzle with hot sauce and serve immediately.'
    ]
  },

  // =========================================================================
  // 3. ITALIAN & MEDITERRANEAN (15)
  // =========================================================================
  {
    name: 'Spaghetti and meatballs',
    category: 'Italian',
    tags: ['italian', 'carb-heavy', 'comfort', 'high-protein'],
    serves: 'Make a double batch of meatballs: dinner tonight, freeze the rest in sauce. Reheats perfectly for a future lazy night.',
    macros: { kc: 720, c: 92, p: 48, f: 18 },
    pantry: ['1 cup dry breadcrumbs', '2 eggs', '1/2 cup whole milk', '1/2 cup grated parmesan', '2 tbsp tomato paste', '2 tbsp olive oil', '4 cloves garlic (minced)', '1 tsp dried oregano', '1 handful fresh basil', 'salt and black pepper'],
    ingredients: [
      { n: 'Ground beef, 90/10, raw', q: '1 lb' },
      { n: 'Ground turkey, 93/7, raw', q: '1 lb' },
      { n: 'Pasta, dry', q: '1 lb spaghetti' },
      { n: 'Crushed tomatoes, canned', q: '2 cans (28 oz each)' },
      { n: 'Parmesan, grated', q: '1/2 cup' }
    ],
    method: [
      'Combine breadcrumbs and milk in a small bowl, stir and let sit 5 minutes until absorbed into a panade.',
      'In a large bowl, mix ground beef, ground turkey, soaked breadcrumbs, eggs, parmesan, half the garlic, oregano, 1.5 tsp salt, and plenty of black pepper. Mix with your hands until just combined — don\'t overwork or meatballs will be tough.',
      'Roll into 1.5-inch balls (golf ball size), about 36-40 total. Wet hands help prevent sticking.',
      'Heat oil in a large heavy pot over medium-high. Brown meatballs in batches of 10-12, turning to color all sides, 5-6 minutes per batch. They don\'t need to be cooked through. Remove to a plate.',
      'In the same pot, sauté remaining garlic 30 seconds. Add tomato paste, stir 1 minute. Pour in crushed tomatoes, 1/2 cup water, a handful of torn basil, and 1 tsp salt.',
      'Return meatballs to sauce. Cover, reduce heat to low, and simmer 25-30 minutes until meatballs are cooked through and sauce is rich. Stir gently occasionally.',
      'Boil spaghetti in well-salted water 1 minute less than package time. Toss pasta directly in sauce with a ladle of pasta water.',
      'Freeze remaining meatballs with their sauce in a sealed container — they\'re just as good on reheat.'
    ]
  },
  {
    name: 'Baked ziti with turkey',
    category: 'Italian',
    tags: ['italian', 'comfort', 'carb-heavy'],
    serves: 'Double batch: bake one tray now, freeze second unbaked.',
    macros: { kc: 680, c: 84, p: 46, f: 18 },
    pantry: ['2 tbsp olive oil', '1 onion', '3 cloves garlic', '2 tbsp tomato paste', 'dried oregano, chili flakes', 'salt and pepper'],
    ingredients: [
      { n: 'Ground turkey, 93/7, raw', q: '1.5 lb' },
      { n: 'Pasta, dry', q: '1 lb ziti or penne' },
      { n: 'Marinara sauce', q: '2 jars (24 oz)' },
      { n: 'Mozzarella, part skim, shredded', q: '2 cups' },
      { n: 'Parmesan, grated', q: '1/2 cup' }
    ],
    method: [
      'Oven to 375°F. Big pot of salted water on.',
      'Brown turkey in oil over medium-high. Onion 5 min, garlic 30s.',
      'Tomato paste 1 min, marinara plus half jar water, oregano. Simmer 20 min.',
      'Ziti 2 min UNDER packet time.',
      'Fold pasta through sauce.',
      'Layer into trays: half pasta, half mozzarella, rest pasta, remaining mozzarella and parmesan.',
      'Cover with foil 20 min. Uncover 8-10 min until bubbling and browned.',
      'Rest 10 minutes.'
    ]
  },
  {
    name: 'Homemade pizza',
    category: 'Italian',
    tags: ['italian', 'carb-heavy', 'comfort'],
    serves: 'Two 12-inch pizzas — dinner tonight, cold pizza for morning ride fuel.',
    macros: { kc: 690, c: 88, p: 36, f: 20 },
    pantry: ['2 tbsp oil', 'cornmeal for peel', '1 tbsp tomato paste', 'dried oregano, garlic, salt'],
    ingredients: [
      { n: 'Pizza dough, raw', q: '2 dough balls (1 lb each)' },
      { n: 'Crushed tomatoes, canned', q: '1 can (14 oz)' },
      { n: 'Mozzarella, part skim, shredded', q: '2 cups' },
      { n: 'Pepperoni', q: '4 oz' }
    ],
    method: [
      'Dough out of fridge 1 hour ahead.',
      'Oven as hot as it goes (500°F) with baking stone or upside-down sheet pan for 45 min.',
      'Sauce: crushed tomatoes, tomato paste, grated garlic, oregano, salt. No cooking.',
      'Stretch dough with knuckles leaving outer rim alone.',
      'Dust peel with cornmeal. Build with thin sauce, cheese, toppings.',
      'Bake 8-10 minutes until blistered and browned.',
      'Rest 2 minutes before slicing.'
    ]
  },
  {
    name: 'Penne all’Arrabbiata with grilled chicken',
    category: 'Italian',
    tags: ['italian', 'spicy', 'carb-heavy', 'high-protein'],
    serves: 'Fiery Roman tomato garlic pasta with sliced grilled chicken breast.',
    macros: { kc: 640, c: 82, p: 48, f: 12 },
    pantry: ['3 tbsp olive oil', '4 cloves garlic sliced', '1.5 tsp crushed red pepper flakes', '1 can crushed tomatoes (28 oz)', 'fresh parsley', 'salt'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'Pasta, dry', q: '1 lb penne' },
      { n: 'Crushed tomatoes, canned', q: '1 can' },
      { n: 'Parmesan, grated', q: '1/2 cup' }
    ],
    method: [
      'Grill seasoned chicken breasts 5-6 min per side to 165°F. Rest and slice.',
      'Heat olive oil over medium-low. Sizzle sliced garlic and red pepper flakes 2 minutes until fragrant without browning.',
      'Pour in crushed tomatoes and salt. Simmer 15 minutes.',
      'Boil penne in salted water until al dente. Toss pasta directly into spicy sauce with 1/4 cup pasta water.',
      'Serve topped with sliced grilled chicken and grated parmesan.'
    ]
  },
  {
    name: 'Creamy garlic chicken pasta with spinach',
    category: 'Italian',
    tags: ['italian', 'high-protein', 'comfort'],
    serves: 'Tender chicken and penne in light garlic cream sauce with baby spinach.',
    macros: { kc: 670, c: 76, p: 50, f: 19 },
    pantry: ['2 tbsp olive oil', '4 cloves garlic minced', '1 cup chicken broth', '1/2 cup half-and-half or cream cheese', '1/2 cup parmesan', 'salt and pepper'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'Pasta, dry', q: '1 lb penne or fettuccine' },
      { n: 'Spinach, raw', q: '1 bag (6 oz)' },
      { n: 'Parmesan, grated', q: '1/2 cup' }
    ],
    method: [
      'Sear seasoned chicken breast strips in olive oil 6 minutes until golden. Remove.',
      'Sauté garlic in pan 30 seconds. Add broth and half-and-half, simmer 4 minutes.',
      'Stir in parmesan until smooth, add baby spinach until wilted.',
      'Toss in cooked penne and chicken.',
      'Serve warm with cracked black pepper.'
    ]
  },
  {
    name: 'Mediterranean baked salmon + feta',
    category: 'Mediterranean',
    tags: ['mediterranean', 'high-protein', 'sheet-pan'],
    serves: 'Sheet pan salmon with cherry tomatoes, kalamata olives, and crumbled feta.',
    macros: { kc: 580, c: 38, p: 46, f: 26 },
    pantry: ['2 tbsp olive oil', '1 lemon', '2 cloves garlic', 'dried oregano', 'salt and pepper'],
    ingredients: [
      { n: 'Salmon, Atlantic, raw', q: '1.25 lb' },
      { n: 'Feta', q: '4 oz crumbled' },
      { n: 'Tomato, raw', q: '1 pint cherry tomatoes' },
      { n: 'Quinoa, dry', q: '1 cup' }
    ],
    method: [
      'Preheat oven to 400°F.',
      'Cook quinoa in broth 15 minutes.',
      'Toss cherry tomatoes and olives in olive oil, oregano, and garlic.',
      'Arrange salmon fillets and tomato mixture on sheet pan. Top salmon with crumbled feta.',
      'Bake 12-14 minutes until salmon flakes and tomatoes burst.',
      'Serve over fluffy quinoa with lemon wedges.'
    ]
  },
  {
    name: 'Chicken piccata + lemon butter pasta',
    category: 'Italian',
    tags: ['italian', 'high-protein', 'quick-prep'],
    serves: 'Pan-seared chicken cutlets in bright lemon caper sauce over angel hair.',
    macros: { kc: 610, c: 72, p: 48, f: 14 },
    pantry: ['2 tbsp olive oil', '2 tbsp butter', '1/3 cup lemon juice', '1/2 cup chicken broth', '2 tbsp capers', '2 tbsp flour', 'fresh parsley'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb (cut into thin cutlets)' },
      { n: 'Pasta, dry', q: '12 oz angel hair or spaghetti' }
    ],
    method: [
      'Dredge chicken cutlets lightly in flour seasoned with salt and pepper.',
      'Pan-sear in olive oil and 1 tbsp butter over medium-high 3 min per side until golden. Remove.',
      'Deglaze pan with lemon juice and chicken broth, simmer 2 min. Swirl in remaining butter and capers.',
      'Return chicken to sauce for 1 min.',
      'Serve over cooked pasta with fresh parsley and spoon sauce over top.'
    ]
  },
  {
    name: 'Mediterranean tuna and bean salad',
    category: 'Mediterranean',
    tags: ['mediterranean', 'quick-prep', 'high-protein'],
    serves: 'Fast no-cook dinner, 10 minutes. High protein and fiber. Tastes better after 20 minutes in the fridge.',
    macros: { kc: 480, c: 48, p: 44, f: 12 },
    pantry: ['2 tbsp extra virgin olive oil', '1 tbsp red wine vinegar', '1 tsp dried oregano', 'salt and black pepper'],
    ingredients: [
      { n: 'Tuna, canned in water, drained', q: '2 cans (5 oz)' },
      { n: 'Chickpeas, canned, drained', q: '1 can' },
      { n: 'Cucumber', q: '1 cucumber (diced)' },
      { n: 'Tomato, raw', q: '1 cup cherry tomatoes (halved)' },
      { n: 'Red onion, raw', q: '1/4 red onion (thinly sliced)' },
      { n: 'Pita bread, whole wheat', q: '2 pitas' }
    ],
    method: [
      'Whisk olive oil, red wine vinegar, oregano, salt, and pepper in a large bowl.',
      'Add drained chickpeas, diced cucumber, halved cherry tomatoes, and thinly sliced red onion. Toss to coat.',
      'Drain tuna well and break into large chunks over the salad. Fold in gently — big pieces are better than mush.',
      'Taste and adjust seasoning. Let sit 5-10 minutes for flavors to come together.',
      'Warm pitas in a dry skillet 30 seconds per side or microwave 20 seconds. Serve alongside.'
    ]
  },
  {
    name: 'Classic chicken parmesan + spaghetti',
    category: 'Italian',
    tags: ['italian', 'comfort', 'high-protein'],
    serves: 'Crispy breaded chicken baked with rich marinara and melted mozzarella.',
    macros: { kc: 710, c: 78, p: 54, f: 20 },
    pantry: ['1 cup breadcrumbs', '1 egg', '2 tbsp olive oil', '1 jar marinara (24 oz)', '1 cup mozzarella', '1/4 cup parmesan'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'Breadcrumbs, dry', q: '1 cup' },
      { n: 'Mozzarella, part skim, shredded', q: '1 cup' },
      { n: 'Pasta, dry', q: '12 oz spaghetti' }
    ],
    method: [
      'Dredge chicken cutlets in beaten egg, then seasoned breadcrumbs with parmesan.',
      'Pan-fry in olive oil 3 minutes per side until crisp and golden.',
      'Place in baking dish, top with marinara and shredded mozzarella.',
      'Bake at 400°F for 12 minutes until cheese is bubbly and browned.',
      'Serve with spaghetti tossed in marinara.'
    ]
  },
  {
    name: 'Tuscan white bean and sausage soup',
    category: 'Italian',
    tags: ['italian', 'comfort', 'high-protein'],
    serves: 'Hearty Italian soup with Italian sausage, cannellini beans, and kale.',
    macros: { kc: 580, c: 52, p: 38, f: 22 },
    pantry: ['1 onion', '3 cloves garlic', '6 cups chicken broth', '1 tsp rosemary, 1 tsp thyme', 'parmesan rind or grated parmesan', 'olive oil'],
    ingredients: [
      { n: 'Italian sausage, raw', q: '1 lb' },
      { n: 'Kidney beans, canned, drained', q: '2 cans cannellini beans' },
      { n: 'Kale, raw', q: '1 bunch' },
      { n: 'Carrots, raw', q: '2 carrots' }
    ],
    method: [
      'Brown sausage in Dutch oven, breaking fine. Remove excess fat.',
      'Add onion, carrots, and garlic, sauté 5 minutes.',
      'Add broth, drained white beans, rosemary, and thyme. Simmer 20 minutes.',
      'Stir in chopped kale and simmer 5 minutes until tender.',
      'Serve with grated parmesan and warm crusty bread.'
    ]
  },
  {
    name: 'Pesto chicken linguine + cherry tomatoes',
    category: 'Italian',
    tags: ['italian', 'carb-heavy', 'quick-prep'],
    serves: 'Vibrant basil pesto pasta with grilled chicken breast and blistered tomatoes.',
    macros: { kc: 660, c: 78, p: 46, f: 18 },
    pantry: ['1/3 cup basil pesto', '1 tbsp olive oil', '2 cloves garlic', 'salt and pepper'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'Pasta, dry', q: '1 lb linguine' },
      { n: 'Tomato, raw', q: '1 pint cherry tomatoes' },
      { n: 'Pesto', q: '1/3 cup' }
    ],
    method: [
      'Boil linguine in salted water until al dente. Reserve 1/2 cup pasta water.',
      'Sear seasoned chicken breast in olive oil 6 minutes. Slice.',
      'Blister cherry tomatoes in hot pan with garlic 3 minutes.',
      'Toss drained linguine with pesto, pasta water, blistered tomatoes, and sliced chicken.',
      'Garnish with grated parmesan.'
    ]
  },
  {
    name: 'Greek chicken gyro bowl + tzatziki',
    category: 'Mediterranean',
    tags: ['mediterranean', 'high-protein', 'carb-heavy'],
    serves: 'Oregano lemon chicken over yellow rice with cucumber tzatziki and pita.',
    macros: { kc: 630, c: 74, p: 48, f: 15 },
    pantry: ['3 tbsp olive oil', '2 tbsp lemon juice', '1 tbsp dried oregano', '3 cloves garlic', '1/2 cup Greek yogurt with grated cucumber (tzatziki)'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'White rice, dry', q: '1.5 cups' },
      { n: 'Cucumber', q: '1 cucumber' },
      { n: 'Pita bread, whole wheat', q: '2 pitas' }
    ],
    method: [
      'Marinate chicken in olive oil, lemon juice, oregano, garlic, salt, and pepper for 20 minutes.',
      'Grill or sear 6 minutes per side to 165°F. Rest and slice.',
      'Cook rice with a pinch of turmeric for golden yellow color.',
      'Assemble bowls with yellow rice, sliced gyro chicken, diced cucumbers, tomatoes, and cool tzatziki.',
      'Serve with warm pita.'
    ]
  },
  {
    name: 'Mediterranean quinoa power bowl',
    category: 'Mediterranean',
    tags: ['mediterranean', 'plant-based', 'carb-heavy'],
    serves: 'Nutrient-dense plant-powered recovery bowl with chickpeas, olives, and feta.',
    macros: { kc: 560, c: 78, p: 22, f: 18 },
    pantry: ['2 tbsp olive oil', '1 lemon', '1 tsp oregano', 'salt and pepper'],
    ingredients: [
      { n: 'Quinoa, dry', q: '1.5 cups' },
      { n: 'Chickpeas, canned, drained', q: '1 can' },
      { n: 'Cucumber', q: '1 cucumber' },
      { n: 'Tomato, raw', q: '1 cup cherry tomatoes' },
      { n: 'Feta', q: '1/2 cup crumbled' }
    ],
    method: [
      'Cook quinoa in salted water 15 minutes, fluff with fork.',
      'Roast chickpeas on a sheet pan with olive oil, oregano, and salt at 400°F for 20 minutes until crisp.',
      'Build bowls with fluffy quinoa, crispy chickpeas, cucumber, cherry tomatoes, and crumbled feta.',
      'Drizzle with olive oil and lemon juice.'
    ]
  },
  {
    name: 'Chicken marsala + fettuccine',
    category: 'Italian',
    tags: ['italian', 'comfort', 'high-protein'],
    serves: 'Pan-fried chicken cutlets with savory marsala wine mushroom reduction.',
    macros: { kc: 630, c: 72, p: 48, f: 16 },
    pantry: ['1/2 cup Marsala wine or beef stock', '1/2 cup chicken broth', '2 tbsp flour', '2 tbsp butter', '2 tbsp olive oil', 'fresh parsley'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'Mushrooms, raw', q: '8 oz cremini or button' },
      { n: 'Pasta, dry', q: '12 oz fettuccine' }
    ],
    method: [
      'Dredge chicken cutlets in seasoned flour. Sear in olive oil and 1 tbsp butter 3 min per side. Remove.',
      'Add sliced mushrooms to pan, sauté 5 minutes until browned.',
      'Pour in marsala wine and broth, scraping pan bottom. Simmer 4 minutes until reduced by half.',
      'Stir in remaining butter and return chicken to coat.',
      'Serve over cooked fettuccine.'
    ]
  },
  {
    name: 'Garlic shrimp scampi + linguine',
    category: 'Italian',
    tags: ['italian', 'quick-prep', 'high-protein'],
    serves: 'Fast 15-minute garlic lemon butter shrimp over linguine.',
    macros: { kc: 580, c: 74, p: 40, f: 13 },
    pantry: ['2 tbsp olive oil', '2 tbsp butter', '5 cloves garlic minced', '1/3 cup white wine or chicken broth', '1 lemon', 'red pepper flakes', 'fresh parsley'],
    ingredients: [
      { n: 'Shrimp, raw', q: '1.25 lb peeled & deveined' },
      { n: 'Pasta, dry', q: '12 oz linguine' }
    ],
    method: [
      'Boil linguine in salted water.',
      'Heat olive oil and 1 tbsp butter in large skillet over medium. Sizzle garlic and red pepper flakes 1 minute.',
      'Add shrimp in single layer, cook 1.5 minutes per side until pink and opaque. Remove to plate.',
      'Add wine/broth and lemon juice to pan, simmer 2 minutes. Stir in remaining butter.',
      'Toss linguine and shrimp in sauce with parsley. Serve hot.'
    ]
  },

  // =========================================================================
  // 4. AMERICAN CLASSICS & COMFORT (15)
  // =========================================================================
  {
    name: 'Turkey meatloaf',
    category: 'American',
    tags: ['american', 'comfort', 'high-protein'],
    serves: 'One large loaf: dinner tonight, cold sandwiches for two more lunches. Better the second day.',
    macros: { kc: 560, c: 38, p: 52, f: 20 },
    pantry: ['1 cup dry breadcrumbs', '1/2 cup milk', '2 tbsp tomato paste', '1 tbsp Worcestershire sauce', '2 tbsp ketchup', '1 tbsp brown sugar', '1 tsp garlic powder', '1 tsp dried thyme', 'salt and pepper', '1 tbsp olive oil'],
    ingredients: [
      { n: 'Ground turkey, 93/7, raw', q: '2 lb' },
      { n: 'Onion, raw', q: '1 medium onion (grated)' },
      { n: 'Carrots, raw', q: '2 medium carrots (grated)' },
      { n: 'Breadcrumbs, dry', q: '1 cup' },
      { n: 'Egg, whole, large', q: '2 eggs' }
    ],
    method: [
      'Preheat oven to 375°F. Line a rimmed baking sheet with foil and spray lightly with oil.',
      'Grate onion and carrots on the large holes of a box grater. Sauté in 1 tbsp oil over medium heat 6-8 minutes until softened and any liquid evaporates. Cool to room temperature.',
      'In a small bowl, combine breadcrumbs and milk. Let sit 5 minutes until absorbed into a paste.',
      'In a large bowl, combine ground turkey, soaked breadcrumbs, cooked vegetables, eggs, tomato paste, Worcestershire, garlic powder, thyme, salt, and pepper. Mix with your hands just until combined — overmixing makes it dense.',
      'Transfer to baking sheet and shape into a 9×5-inch loaf with gently rounded edges.',
      'Bake 40 minutes. Mix ketchup and brown sugar, brush evenly over the top. Bake 15 minutes more until a thermometer reads 165°F in the center.',
      'Rest 10 minutes before slicing — it will fall apart otherwise. Slice 1-inch thick.'
    ]
  },
  {
    name: 'Chicken noodle soup',
    category: 'American',
    tags: ['american', 'comfort'],
    serves: 'A big pot: dinner tonight, lunches for two or three days. Better on day two when flavors deepen.',
    macros: { kc: 510, c: 46, p: 44, f: 14 },
    pantry: ['2 tbsp olive oil', '8 cups good chicken stock', '1 bay leaf', '1 tsp dried thyme', 'salt and black pepper', '1/2 lemon for juice'],
    ingredients: [
      { n: 'Chicken thigh, boneless skinless, raw', q: '1.5 lb (whole)' },
      { n: 'Carrots, raw', q: '4 carrots (sliced into coins)' },
      { n: 'Celery, raw', q: '4 stalks (sliced)' },
      { n: 'Onion, raw', q: '1 large onion (diced)' },
      { n: 'Egg noodles, dry', q: '8 oz' }
    ],
    method: [
      'Heat oil in a large Dutch oven over medium heat. Add diced onion, sliced carrots, and celery. Season with 1 tsp salt and sauté 8-10 minutes until vegetables are soft and starting to turn golden.',
      'Pour in stock, add bay leaf, thyme, and drop in the whole chicken thighs. Bring to a gentle simmer.',
      'Simmer uncovered 20-25 minutes until chicken is fully cooked and tender. Remove chicken thighs to a board.',
      'Shred chicken with two forks into bite-sized pieces, removing any connective tissue. Return shredded meat to the pot.',
      'Cook egg noodles in a separate pot of salted boiling water per package directions. Keep them separate — adding to the soup means they\'ll absorb all the broth and turn soft in leftovers.',
      'Remove bay leaf. Add a squeeze of lemon juice and plenty of cracked black pepper. Taste and adjust salt.',
      'To serve: add a portion of noodles to each bowl and ladle hot soup over them.'
    ]
  },
  {
    name: 'Turkey chili + cornbread',
    category: 'American',
    tags: ['american', 'comfort', 'spicy', 'carb-heavy'],
    serves: 'Double batch: tonight, plus two reheats later in the week.',
    macros: { kc: 680, c: 84, p: 48, f: 16 },
    pantry: ['2 tbsp oil', '2 cups stock', '2 tbsp tomato paste', 'chili powder, cumin, smoked paprika, oregano', 'bay leaf', 'salt and pepper'],
    ingredients: [
      { n: 'Ground turkey, 93/7, raw', q: '2 lb' },
      { n: 'Kidney beans, canned, drained', q: '2 cans' },
      { n: 'Crushed tomatoes, canned', q: '1 can (28 oz)' },
      { n: 'Cornmeal, dry', q: '1 cup' },
      { n: 'Cheddar cheese', q: '1 cup shredded' }
    ],
    method: [
      'Brown turkey in heavy pot over medium-high, set aside.',
      'Sauté onion and bell peppers 6-8 min.',
      'Add tomato paste and spices (chili powder, cumin, paprika, oregano) for 1 min.',
      'Turkey back in with tomatoes, beans, stock, bay leaf. Simmer 45-60 min.',
      'Bake cornbread per box.',
      'Serve chili hot topped with grated cheddar and warm cornbread.'
    ]
  },
  {
    name: 'Shepherd\'s pie',
    category: 'American',
    tags: ['american', 'comfort', 'high-protein'],
    serves: 'Feeds 4-6. Classic cold-weather recovery meal. Reheats well for 3 days.',
    macros: { kc: 640, c: 62, p: 44, f: 22 },
    pantry: ['2 tbsp olive oil', '2 large onions (diced)', '3 cloves garlic (minced)', '2 tbsp tomato paste', '2 cups beef stock', '2 tbsp Worcestershire sauce', '2 tbsp flour', '1 tsp dried thyme', '1 bay leaf', '3 tbsp butter', '1/2 cup milk', 'salt and pepper'],
    ingredients: [
      { n: 'Ground beef, 90/10, raw', q: '1.5 lb' },
      { n: 'Potato, russet, raw', q: '2 lb (peeled and cubed)' },
      { n: 'Peas, frozen', q: '1 cup' },
      { n: 'Carrots, raw', q: '2 carrots (diced small)' }
    ],
    method: [
      'Preheat oven to 400°F. Start potatoes: boil peeled, cubed potatoes in salted water 15-20 minutes until very tender. Drain and mash thoroughly with 3 tbsp butter, 1/2 cup warm milk, 1 tsp salt until smooth and creamy. Set aside.',
      'Brown ground beef in 1 tbsp oil in a large oven-safe skillet over medium-high heat in two batches — don\'t crowd the pan. Drain off excess fat.',
      'In the same pan, sauté diced onion and carrots in remaining oil 5-6 minutes. Add garlic 30 seconds.',
      'Stir in tomato paste and cook 1 minute. Sprinkle flour over everything and stir 1 minute.',
      'Pour in beef stock and Worcestershire. Add thyme, bay leaf, and frozen peas. Return beef to pan. Simmer 12-15 minutes until gravy is thick enough to coat a spoon. Remove bay leaf. Season well with salt and pepper.',
      'Spread beef filling in a 9x13 baking dish (or leave in oven-safe skillet). Spoon mashed potatoes over top and spread evenly. Run a fork across the surface to create ridges — they\'ll brown nicely.',
      'Bake 25-30 minutes until the potato peaks are golden brown and filling is bubbling at the edges.'
    ]
  },
  {
    name: 'Burgers on the grill',
    category: 'American',
    tags: ['american', 'comfort', 'high-protein'],
    serves: 'Cook tonight. Four juicy grilled burgers with sweet corn.',
    macros: { kc: 650, c: 54, p: 46, f: 24 },
    pantry: ['salt and pepper', 'mayo, mustard, ketchup', 'cider vinegar, oil for slaw'],
    ingredients: [
      { n: 'Ground beef, 90/10, raw', q: '1.25 lb' },
      { n: 'Hamburger bun', q: '4 buns' },
      { n: 'Cheddar cheese', q: '4 slices' },
      { n: 'Sweet corn on the cob', q: '4 ears' },
      { n: 'Coleslaw mix', q: '1 bag' }
    ],
    method: [
      'Shape beef into 4 patties with center dimples. Season outside with salt and pepper.',
      'Grill hot 4 min per side. Add cheese for last minute.',
      'Grill corn on the cob 10 min turning frequently.',
      'Toast buttered buns 1 min.',
      'Assemble burgers with pickles, mustard, and enjoy with charred sweet corn.'
    ]
  },
  {
    name: 'Grilled chicken, corn, potatoes',
    category: 'American',
    tags: ['american', 'sheet-pan', 'high-protein'],
    serves: 'Clean summer BBQ dinner with roasted potato wedges.',
    macros: { kc: 590, c: 62, p: 48, f: 14 },
    pantry: ['olive oil', 'paprika, garlic powder, oregano', 'salt and pepper', 'butter'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'Potato, russet, raw', q: '2 lb potatoes' },
      { n: 'Sweet corn on the cob', q: '4 ears' }
    ],
    method: [
      'Roast potato wedges with olive oil, paprika, and salt at 425°F for 35 min.',
      'Butterfly chicken breasts, season with garlic powder, oregano, salt, and pepper.',
      'Grill chicken 5-6 min per side to 165°F. Rest 5 min.',
      'Grill corn 10 min.',
      'Serve grilled chicken with crispy potato wedges and sweet corn.'
    ]
  },
  {
    name: 'Roast chicken, potatoes, green beans',
    category: 'American',
    tags: ['american', 'comfort', 'high-protein'],
    serves: 'Sunday dinner, about 90 minutes. The pan drippings are the best part — spoon them over everything.',
    macros: { kc: 630, c: 52, p: 52, f: 22 },
    pantry: ['2 tbsp softened butter or olive oil', 'kosher salt and black pepper', '1 lemon (halved)', '4 cloves garlic (crushed)', '4 sprigs fresh thyme or rosemary'],
    ingredients: [
      { n: 'Chicken, whole', q: '1 whole chicken, 4 lb' },
      { n: 'Potato, russet, raw', q: '2 lb (cut into large wedges)' },
      { n: 'Green beans, raw', q: '1 lb (trimmed)' }
    ],
    method: [
      'Take chicken out of the fridge 30 minutes before cooking — a cold bird roasts unevenly.',
      'Preheat oven to 425°F with a rack in the lower-middle position.',
      'Pat chicken completely dry inside and out with paper towels — moisture is the enemy of crispy skin. Season cavity and all surfaces aggressively with kosher salt and pepper.',
      'Stuff cavity with lemon halves, crushed garlic, and thyme or rosemary. Rub all over skin with softened butter or olive oil.',
      'Place chicken breast-side up in a large roasting pan or oven-safe skillet. Arrange potato wedges around the bird. Season potatoes with salt and pepper and toss in any dripping butter.',
      'Roast at 425°F for 20 minutes to blister the skin. Reduce heat to 375°F. Continue roasting 45-55 minutes more until a thermometer in the thickest part of the thigh reads 175°F (not touching bone).',
      'Toss trimmed green beans in pan drippings around the chicken in the last 12 minutes of roasting.',
      'Rest chicken 15 minutes uncovered before carving — the juices redistribute and it\'ll stay moist much longer. Carve and serve with potatoes and beans, spooning pan juices over everything.'
    ]
  },
  {
    name: 'Turkey burger sliders + sweet potato fries',
    category: 'American',
    tags: ['american', 'high-protein'],
    serves: 'Four protein-packed sliders with baked sweet potato fries.',
    macros: { kc: 580, c: 64, p: 44, f: 16 },
    pantry: ['1 tbsp olive oil', 'garlic powder, onion powder, paprika', 'salt and pepper', 'mustard, pickles'],
    ingredients: [
      { n: 'Ground turkey, 93/7, raw', q: '1 lb' },
      { n: 'Sweet potato, raw', q: '2 potatoes' },
      { n: 'Hamburger bun', q: '4 slider buns' },
      { n: 'Cheddar cheese', q: '4 slices' }
    ],
    method: [
      'Bake sweet potato fries tossed in oil and paprika at 425°F for 25 min.',
      'Shape turkey into 4 slider patties, season with garlic powder, onion powder, salt, and pepper.',
      'Pan-sear 4-5 min per side to 165°F. Melt cheese over patties.',
      'Toast slider buns and assemble with pickles and mustard.'
    ]
  },
  {
    name: 'Slow-cooker beef stew + potatoes',
    category: 'American',
    tags: ['american', 'slow-cooker', 'comfort'],
    serves: 'Set it up in the morning and dinner is ready when you get back. Do the searing step — it\'s worth the extra 10 minutes.',
    macros: { kc: 620, c: 54, p: 48, f: 20 },
    pantry: ['2 cups beef broth', '2 tbsp tomato paste', '2 tbsp Worcestershire sauce', '3 tbsp flour', '1 tsp dried rosemary', '1 tsp dried thyme', '1 bay leaf', '1 tbsp olive oil', 'salt and black pepper'],
    ingredients: [
      { n: 'Sirloin steak, raw', q: '1.5 lb (cut into 1.5-inch cubes)' },
      { n: 'Potato, russet, raw', q: '2 lb (cut into large chunks)' },
      { n: 'Carrots, raw', q: '4 carrots (cut into 1-inch pieces)' },
      { n: 'Onion, raw', q: '1 large onion (roughly chopped)' }
    ],
    method: [
      'Cut beef into 1.5-inch cubes, pat completely dry, season with salt and pepper, and toss with 2 tbsp flour until lightly coated.',
      'Heat oil in a heavy skillet over high heat until almost smoking. Sear beef in one layer without moving for 3-4 minutes until deeply browned on one side. Flip, sear 2 minutes more. Do this in two batches — crowding prevents browning. This step builds the flavor base.',
      'Place carrots, potatoes, and onion in the bottom of the slow cooker. Add seared beef on top.',
      'Whisk together beef broth, tomato paste, Worcestershire, remaining flour, rosemary, and thyme. Pour over the beef and vegetables.',
      'Add bay leaf, press vegetables down slightly into liquid. Cover and cook on LOW 7-8 hours (or HIGH 4-5 hours) until beef is fork-tender and vegetables are soft.',
      'Remove bay leaf. Taste and adjust salt and pepper. The gravy should be thick and rich — if too thin, stir in 1 tbsp flour mixed with cold water and cook on HIGH uncovered 20 minutes.',
      'Ladle into deep bowls and serve with crusty bread for the gravy.'
    ]
  },
  {
    name: 'Pork tenderloin + apples + mash',
    category: 'American',
    tags: ['american', 'high-protein', 'comfort'],
    serves: 'Lean, glycogen-replenishing dinner with sweet sautéed apples.',
    macros: { kc: 580, c: 62, p: 48, f: 14 },
    pantry: ['2 tbsp butter', '1 tbsp olive oil', '1/2 cup milk', 'dried rosemary, thyme, cinnamon', 'salt and pepper'],
    ingredients: [
      { n: 'Pork tenderloin, raw', q: '1.25 lb' },
      { n: 'Apple', q: '2 apples (sliced)' },
      { n: 'Potato, russet, raw', q: '2 lb potatoes' }
    ],
    method: [
      'Boil potatoes 15 min, mash with butter, milk, salt.',
      'Rub pork tenderloin with olive oil, rosemary, thyme, salt, pepper. Sear in oven-safe skillet 2 min per side.',
      'Roast in 400°F oven 15-18 min to 145°F. Rest 10 min.',
      'Sauté sliced apples in 1 tbsp butter with cinnamon in skillet 6 min until golden.',
      'Slice pork and serve with mash and warm caramelized apples.'
    ]
  },
  {
    name: 'BBQ pulled chicken + baked potato',
    category: 'American',
    tags: ['american', 'slow-cooker', 'carb-heavy'],
    serves: 'Slow-cooked smoky BBQ chicken loaded into fluffy baked russet potatoes.',
    macros: { kc: 640, c: 78, p: 48, f: 12 },
    pantry: ['1 cup barbecue sauce', '2 tbsp apple cider vinegar', '1 tsp garlic powder', '1 tsp smoked paprika'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.5 lb' },
      { n: 'Potato, russet, raw', q: '4 large potatoes' },
      { n: 'Cheddar cheese', q: '1 cup shredded' }
    ],
    method: [
      'Place chicken breasts in slow cooker with BBQ sauce, vinegar, and spices. Cook on LOW 5 hours.',
      'Poke potatoes with fork, rub with oil and salt, bake at 400°F for 55 min until tender.',
      'Shred chicken with two forks and stir with BBQ sauce in slow cooker.',
      'Split baked potatoes open, fluff with fork, pile high with pulled BBQ chicken and shredded cheddar.'
    ]
  },
  {
    name: 'Turkey bacon BLT on toasted sourdough',
    category: 'American',
    tags: ['american', 'quick-prep', 'high-protein'],
    serves: 'Crispy turkey bacon, juicy ripe tomatoes, and avocado on sourdough.',
    macros: { kc: 540, c: 56, p: 36, f: 18 },
    pantry: ['2 tbsp mayonnaise', 'black pepper', 'olive oil'],
    ingredients: [
      { n: 'Bacon, cooked', q: '8 slices' },
      { n: 'Sourdough bread', q: '4 thick slices' },
      { n: 'Tomato, raw', q: '2 tomatoes (sliced)' },
      { n: 'Romaine lettuce', q: '4 leaves' },
      { n: 'Avocado', q: '1 avocado' }
    ],
    method: [
      'Cook bacon until crispy. Drain on paper towels.',
      'Toast sourdough slices until golden brown.',
      'Spread mayo and mashed avocado on toast.',
      'Layer with crisp lettuce, ripe tomato slices, and bacon.',
      'Season tomatoes with salt and pepper. Slice diagonally.'
    ]
  },
  {
    name: 'Crispy baked chicken tenders + honey mustard',
    category: 'American',
    tags: ['american', 'high-protein', 'quick-prep'],
    serves: 'Golden panko crusted chicken tenderloins with homemade honey mustard.',
    macros: { kc: 570, c: 58, p: 48, f: 14 },
    pantry: ['3 tbsp Dijon mustard', '2 tbsp honey', '1 tbsp mayo', '1 cup panko breadcrumbs', '1 egg', 'garlic powder, paprika, salt and pepper'],
    ingredients: [
      { n: 'Chicken tenderloin, raw', q: '1.25 lb' },
      { n: 'Panko breadcrumbs', q: '1.5 cups' },
      { n: 'Sweet potato, raw', q: '2 potatoes (fries)' }
    ],
    method: [
      'Preheat oven to 425°F.',
      'Dip chicken tenders in beaten egg, then press firmly into seasoned panko.',
      'Arrange tenders on wire rack on baking sheet. Spray lightly with oil.',
      'Bake 15-18 minutes until crunchy and golden.',
      'Whisk mustard, honey, and mayo for dipping sauce. Serve with baked sweet potato fries.'
    ]
  },
  {
    name: 'Grilled sirloin steak + asparagus + mash',
    category: 'American',
    tags: ['american', 'high-protein', 'comfort'],
    serves: 'Lean steakhouse dinner packed with creatine, iron, and potassium.',
    macros: { kc: 630, c: 48, p: 52, f: 22 },
    pantry: ['2 tbsp butter', '2 cloves garlic', 'rosemary', 'olive oil', 'salt and pepper'],
    ingredients: [
      { n: 'Sirloin steak, raw', q: '1.25 lb' },
      { n: 'Potato, russet, raw', q: '2 lb potatoes' },
      { n: 'Asparagus, raw', q: '1 bunch' }
    ],
    method: [
      'Boil potatoes 15 min, mash with butter, milk, and salt.',
      'Season sirloin steaks generously with salt and pepper.',
      'Grill or sear in cast iron skillet 4 min per side for medium-rare. Baste with garlic butter.',
      'Rest steak 8 minutes before slicing.',
      'Sauté or grill asparagus in olive oil 4 min.',
      'Serve steak slices over mashed potatoes with asparagus.'
    ]
  },
  {
    name: 'Smoked sausage & potato sheet pan hash',
    category: 'American',
    tags: ['american', 'sheet-pan', 'quick-prep'],
    serves: 'One-pan roasted sausage coins, crispy potatoes, and bell peppers.',
    macros: { kc: 590, c: 62, p: 34, f: 22 },
    pantry: ['2 tbsp olive oil', '1 tsp paprika, 1 tsp garlic powder, 1 tsp onion powder', 'salt and pepper'],
    ingredients: [
      { n: 'Italian sausage, raw', q: '12 oz (sliced into coins)' },
      { n: 'Potato, russet, raw', q: '2 lb potatoes (cubed)' },
      { n: 'Bell pepper, raw', q: '2 peppers (diced)' },
      { n: 'Onion, raw', q: '1 onion' }
    ],
    method: [
      'Preheat oven to 400°F. Line baking sheet with foil.',
      'Toss cubed potatoes with 1 tbsp oil, salt, and spices. Roast 20 min.',
      'Add sliced sausage coins, bell peppers, and onion to the pan.',
      'Roast 15 minutes more until sausage is browned and potatoes are crispy.',
      'Serve straight from the pan.'
    ]
  },

  // =========================================================================
  // 5. QUICK PREP (<20m) & FAST WEEKNIGHT (10)
  // =========================================================================
  {
    name: '15-minute tuna melt on sourdough',
    category: 'Quick Prep',
    tags: ['quick-prep', 'high-protein', 'american'],
    serves: 'Toasted golden sourdough loaded with albacore tuna salad and melted sharp cheddar.',
    macros: { kc: 580, c: 48, p: 48, f: 18 },
    pantry: ['2 tbsp mayo', '1 tsp Dijon mustard', '1 tbsp relish or chopped pickles', 'black pepper', 'butter for toast'],
    ingredients: [
      { n: 'Tuna, canned in water, drained', q: '2 cans (5 oz)' },
      { n: 'Sourdough bread', q: '4 slices' },
      { n: 'Cheddar cheese', q: '4 slices' },
      { n: 'Tomato, raw', q: '1 tomato (sliced)' }
    ],
    method: [
      'Drain tuna thoroughly. Mix with mayo, Dijon mustard, relish, and black pepper.',
      'Butter one side of sourdough slices. Place butter-side down in hot skillet.',
      'Top with tuna salad, ripe tomato slice, and cheddar cheese.',
      'Cover with top slice (buttered outside). Cook 3-4 min per side until golden brown and cheese melts.'
    ]
  },
  {
    name: '10-minute egg roll in a bowl',
    category: 'Quick Prep',
    tags: ['quick-prep', 'asian', 'high-protein'],
    serves: 'One-skillet deconstructed egg roll with crispy cabbage, seasoned pork, and sriracha.',
    macros: { kc: 490, c: 22, p: 42, f: 24 },
    pantry: ['3 tbsp soy sauce', '1 tbsp sesame oil', '1 tbsp ginger', '3 cloves garlic', 'sriracha', 'green onions'],
    ingredients: [
      { n: 'Ground turkey, 93/7, raw', q: '1.25 lb' },
      { n: 'Coleslaw mix', q: '1 bag (16 oz)' },
      { n: 'Green onion', q: '1 bunch' }
    ],
    method: [
      'Brown ground meat with garlic and ginger in large skillet 5 minutes.',
      'Dump entire bag of coleslaw mix directly into pan. Pour over soy sauce and sesame oil.',
      'Stir-fry 3-4 minutes until cabbage is wilted but retains satisfying crunch.',
      'Drizzle with sriracha and garnish with sliced green onions.'
    ]
  },
  {
    name: '15-minute chicken quesadillas',
    category: 'Quick Prep',
    tags: ['quick-prep', 'mexican', 'high-protein'],
    serves: 'Crispy pan-toasted tortillas stuffed with seasoned chicken and melted Monterey Jack.',
    macros: { kc: 590, c: 54, p: 48, f: 18 },
    pantry: ['1 tbsp taco seasoning', 'olive oil', 'salsa', 'sour cream or Greek yogurt'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1 lb (cooked/shredded)' },
      { n: 'Tortilla, flour, 8 inch', q: '4 tortillas' },
      { n: 'Mozzarella, part skim, shredded', q: '1.5 cups' },
      { n: 'Salsa', q: '1 cup' }
    ],
    method: [
      'Toss shredded chicken with taco seasoning and 2 tbsp salsa.',
      'Place tortilla in hot dry pan. Layer cheese, spiced chicken, and more cheese on half. Fold over.',
      'Cook 2-3 minutes per side until golden brown and cheese is fully melted.',
      'Cut into triangles and serve with salsa and Greek yogurt.'
    ]
  },
  {
    name: 'One-pot creamy tomato tortellini',
    category: 'Quick Prep',
    tags: ['quick-prep', 'italian', 'comfort', 'carb-heavy'],
    serves: 'Dinner on the table in 15 minutes, one pot to wash. Use refrigerated fresh tortellini for best results.',
    macros: { kc: 640, c: 78, p: 32, f: 20 },
    pantry: ['1 jar marinara sauce (24 oz)', '1/2 cup cream cheese (softened) or 1/2 cup half-and-half', '2 cups chicken or vegetable broth', '1 tsp garlic powder', 'salt and black pepper'],
    ingredients: [
      { n: 'Pasta, cooked', q: '1 lb fresh or frozen cheese tortellini' },
      { n: 'Spinach, raw', q: '1 bag (6 oz) baby spinach' },
      { n: 'Parmesan, grated', q: '1/2 cup' }
    ],
    method: [
      'Combine marinara sauce and broth in a large pot or Dutch oven. Stir together and bring to a boil over medium-high heat.',
      'Add tortellini directly to the boiling sauce. Cook according to package directions, usually 4-6 minutes for fresh or 8-10 minutes for frozen, stirring occasionally.',
      'Reduce heat to medium-low. Add cream cheese in small pieces, stirring until completely melted and the sauce is creamy and smooth. If using half-and-half, stir it in now.',
      'Add garlic powder and season with salt and pepper to taste.',
      'Fold in all the baby spinach — it will look like too much but wilts down in about 60 seconds. Stir until just wilted.',
      'Serve immediately in wide bowls, topped with grated parmesan and cracked black pepper.'
    ]
  },
  {
    name: '15-minute black bean avocado burritos',
    category: 'Quick Prep',
    tags: ['quick-prep', 'mexican', 'plant-based'],
    serves: 'Warm toasted burritos packed with seasoned beans, rice, and creamy avocado.',
    macros: { kc: 580, c: 84, p: 20, f: 16 },
    pantry: ['1 tsp cumin', '1 tsp chili powder', '1 lime', 'salsa', 'olive oil'],
    ingredients: [
      { n: 'Black beans, canned, drained', q: '2 cans' },
      { n: 'White rice, dry', q: '1 cup (cooked)' },
      { n: 'Avocado', q: '1 avocado' },
      { n: 'Tortilla, flour, 8 inch', q: '4 large tortillas' }
    ],
    method: [
      'Warm black beans with cumin, chili powder, and 2 tbsp salsa in small pot 3 min. Mash slightly.',
      'Warm tortillas in skillet 20 seconds.',
      'Fill tortillas with warm rice, seasoned black beans, avocado slices, and salsa.',
      'Roll tightly into burritos and toast in dry skillet 1 min per side for crispy exterior.'
    ]
  },
  {
    name: 'Sheet pan sausage, peppers & onion hoagies',
    category: 'Quick Prep',
    tags: ['quick-prep', 'sheet-pan', 'american'],
    serves: 'Italian sausage links roasted with peppers and onions on toasted hoagie rolls.',
    macros: { kc: 640, c: 56, p: 38, f: 26 },
    pantry: ['2 tbsp olive oil', '1 tsp Italian seasoning', 'salt and pepper', 'mustard'],
    ingredients: [
      { n: 'Italian sausage, raw', q: '1 lb links (4 links)' },
      { n: 'Bell pepper, raw', q: '3 peppers (sliced)' },
      { n: 'Onion, raw', q: '2 onions (sliced)' },
      { n: 'Hot dog bun', q: '4 hoagie / sub rolls' }
    ],
    method: [
      'Preheat oven to 400°F.',
      'Toss sliced peppers and onions with olive oil, Italian seasoning, and salt on baking sheet.',
      'Nestle sausage links between vegetables.',
      'Bake 25 minutes until sausages reach 160°F and peppers are charred.',
      'Stuff into toasted hoagie rolls with spicy brown mustard.'
    ]
  },
  {
    name: '15-minute teriyaki salmon bites',
    category: 'Quick Prep',
    tags: ['quick-prep', 'asian', 'high-protein'],
    serves: 'Crispy seared salmon cubes tossed in sticky sweet teriyaki over rice.',
    macros: { kc: 590, c: 58, p: 44, f: 18 },
    pantry: ['3 tbsp teriyaki sauce', '1 tbsp sesame oil', '1 tbsp honey', 'sesame seeds', 'green onions'],
    ingredients: [
      { n: 'Salmon, Atlantic, raw', q: '1.25 lb (cubed)' },
      { n: 'White rice, dry', q: '1.5 cups' },
      { n: 'Cucumber', q: '1 cucumber' }
    ],
    method: [
      'Cut salmon into 1-inch cubes, season with salt and pepper.',
      'Sear in hot skillet with sesame oil 2 minutes per side until crisp and golden.',
      'Pour in teriyaki sauce and honey, toss 1 minute until glazed.',
      'Serve immediately over rice with sliced cucumbers and sesame seeds.'
    ]
  },
  {
    name: 'Greek salad + albacore tuna + warm pita',
    category: 'Quick Prep',
    tags: ['quick-prep', 'mediterranean', 'high-protein'],
    serves: 'No-cook crisp Greek salad loaded with chunky albacore tuna and whole wheat pita.',
    macros: { kc: 520, c: 46, p: 46, f: 16 },
    pantry: ['2 tbsp olive oil', '1 tbsp red wine vinegar', 'oregano', 'salt and pepper'],
    ingredients: [
      { n: 'Tuna, canned in water, drained', q: '2 cans (5 oz)' },
      { n: 'Romaine lettuce', q: '1 head' },
      { n: 'Cucumber', q: '1 cucumber' },
      { n: 'Tomato, raw', q: '2 tomatoes' },
      { n: 'Feta', q: '1/2 cup crumbled' },
      { n: 'Pita bread, whole wheat', q: '2 pitas' }
    ],
    method: [
      'Chop romaine, cucumber, and tomatoes. Place in large bowl.',
      'Whisk olive oil, red wine vinegar, oregano, salt, and pepper. Toss with greens.',
      'Top with flaked albacore tuna and crumbled feta.',
      'Serve with warm whole-wheat pita.'
    ]
  },
  {
    name: '15-minute sriracha chicken rice bowls',
    category: 'Quick Prep',
    tags: ['quick-prep', 'spicy', 'asian', 'high-protein'],
    serves: 'Quick spicy seared chicken breast cubes with steamed rice and avocado.',
    macros: { kc: 610, c: 66, p: 48, f: 14 },
    pantry: ['2 tbsp sriracha', '1 tbsp soy sauce', '1 tbsp honey', '1 tbsp oil', 'sesame seeds'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb' },
      { n: 'White rice, dry', q: '1.5 cups' },
      { n: 'Avocado', q: '1 avocado' },
      { n: 'Green beans, raw', q: '8 oz' }
    ],
    method: [
      'Cut chicken into bite-sized cubes.',
      'Sear in hot pan with oil 5 minutes until browned. Add sriracha, soy sauce, and honey, tossing 2 minutes.',
      'Steam green beans 5 minutes.',
      'Assemble bowls with rice, spicy chicken, green beans, and sliced avocado.'
    ]
  },
  {
    name: '15-minute BBQ chicken wraps',
    category: 'Quick Prep',
    tags: ['quick-prep', 'american', 'high-protein'],
    serves: 'Warm flour tortillas wrapped around BBQ chicken, melted cheddar, and crisp romaine.',
    macros: { kc: 580, c: 62, p: 44, f: 16 },
    pantry: ['1/3 cup BBQ sauce', 'black pepper'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1 lb (cooked/diced)' },
      { n: 'Tortilla, flour, 8 inch', q: '4 tortillas' },
      { n: 'Cheddar cheese', q: '1 cup shredded' },
      { n: 'Romaine lettuce', q: '4 leaves' }
    ],
    method: [
      'Toss diced cooked chicken with BBQ sauce and warm in microwave or skillet 2 min.',
      'Place tortillas flat, sprinkle cheese, add warm BBQ chicken and crisp romaine.',
      'Roll tightly and slice in half.'
    ]
  },

  // =========================================================================
  // 6. SHEET PAN & ONE-POT ROASTS (10)
  // =========================================================================
  {
    name: 'Sheet pan lemon herb chicken + broccoli',
    category: 'Sheet Pan',
    tags: ['sheet-pan', 'high-protein', 'mediterranean'],
    serves: 'Easy one-pan dinner with roasted chicken, crisp broccoli, and baby carrots.',
    macros: { kc: 540, c: 42, p: 52, f: 16 },
    pantry: ['2 tbsp olive oil', '1 lemon', '1 tsp oregano, 1 tsp thyme, 1 tsp garlic powder', 'salt and pepper'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.5 lb' },
      { n: 'Broccoli, raw', q: '2 heads (florets)' },
      { n: 'Carrots, raw', q: '4 carrots (sliced)' }
    ],
    method: [
      'Preheat oven to 400°F. Line baking sheet with foil.',
      'Toss broccoli florets and sliced carrots with 1 tbsp olive oil, salt, and pepper.',
      'Place chicken breasts on sheet pan, rub with remaining oil, lemon juice, oregano, thyme, garlic powder, salt, and pepper.',
      'Roast 22-25 minutes until chicken reaches 165°F and vegetables are charred at edges.'
    ]
  },
  {
    name: 'Sheet pan salmon + sweet potatoes',
    category: 'Sheet Pan',
    tags: ['sheet-pan', 'high-protein', 'carb-heavy'],
    serves: 'Two hearty endurance dinners high in omega-3s and complex carbs.',
    macros: { kc: 620, c: 56, p: 46, f: 22 },
    pantry: ['2 tbsp olive oil', '2 sweet potatoes', '1 bunch asparagus', 'paprika, thyme, garlic powder', 'salt and pepper', 'lemon'],
    ingredients: [
      { n: 'Salmon, Atlantic, raw', q: '1.25 lb' },
      { n: 'Sweet potato, raw', q: '2 potatoes (cubed)' },
      { n: 'Asparagus, raw', q: '1 bunch' }
    ],
    method: [
      'Preheat oven to 400°F.',
      'Roast cubed sweet potatoes tossed in oil and paprika for 20 min.',
      'Add seasoned salmon fillets and asparagus to the pan.',
      'Bake 12-14 minutes more until salmon flakes and potatoes are tender.',
      'Squeeze fresh lemon over fish and asparagus.'
    ]
  },
  {
    name: 'One-pan lemon garlic tilapia + green beans',
    category: 'Sheet Pan',
    tags: ['sheet-pan', 'quick-prep', 'high-protein'],
    serves: 'Fast weeknight sheet pan fish dinner with tender green beans and lemon.',
    macros: { kc: 460, c: 28, p: 48, f: 12 },
    pantry: ['2 tbsp olive oil', '1 lemon', '3 cloves garlic minced', 'paprika, salt and pepper'],
    ingredients: [
      { n: 'Tilapia, raw', q: '1.25 lb (4 fillets)' },
      { n: 'Green beans, raw', q: '1 lb' },
      { n: 'Potato, russet, raw', q: '1 lb (wedges)' }
    ],
    method: [
      'Preheat oven to 400°F. Roast potato wedges with oil and salt 20 min.',
      'Add seasoned tilapia fillets and green beans to pan, drizzle with lemon garlic oil.',
      'Bake 10-12 minutes until fish is flaky and opaque.',
      'Serve hot with lemon wedges.'
    ]
  },
  {
    name: 'Sheet pan pork chops + sweet potato wedges',
    category: 'Sheet Pan',
    tags: ['sheet-pan', 'high-protein', 'american'],
    serves: 'Juicy roasted bone-in pork chops with caramelized sweet potato wedges.',
    macros: { kc: 580, c: 54, p: 46, f: 18 },
    pantry: ['2 tbsp olive oil', '1 tsp rosemary, 1 tsp thyme, 1 tsp smoked paprika', 'salt and pepper'],
    ingredients: [
      { n: 'Pork chop, raw', q: '4 chops (1.5 lb total)' },
      { n: 'Sweet potato, raw', q: '3 potatoes (wedges)' },
      { n: 'Green beans, raw', q: '12 oz' }
    ],
    method: [
      'Preheat oven to 400°F.',
      'Toss sweet potato wedges in oil, salt, and paprika. Roast 15 min.',
      'Season pork chops with rosemary, thyme, salt, and pepper. Place on sheet pan with green beans.',
      'Roast 18-20 minutes until pork reads 145°F and potatoes are golden.'
    ]
  },
  {
    name: 'One-pot chicken, rice and vegetable bake',
    category: 'Sheet Pan',
    tags: ['sheet-pan', 'comfort', 'carb-heavy'],
    serves: 'Double batch: assemble both dishes, bake one.',
    macros: { kc: 630, c: 76, p: 46, f: 14 },
    pantry: ['2 tbsp oil', '1 onion', '2 cloves garlic', '5 cups chicken stock', 'paprika, thyme, garlic powder', 'salt and pepper'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.5 lb (cubed)' },
      { n: 'White rice, dry', q: '2 cups' },
      { n: 'Frozen mixed vegetables', q: '2 cups' },
      { n: 'Cheddar cheese', q: '1 cup shredded' }
    ],
    method: [
      'Oven to 375°F. Brown chicken chunks in oil 4 min.',
      'Add onion 3 min, garlic 30s.',
      'Rice, vegetables, onion, chicken, seasonings into deep casserole dish. Pour hot stock over.',
      'Cover TIGHTLY with foil. Bake 40-45 min until rice is tender.',
      'Top with cheese, bake uncovered 10 min.'
    ]
  },
  {
    name: 'Sheet pan honey mustard chicken thighs',
    category: 'Sheet Pan',
    tags: ['sheet-pan', 'comfort', 'high-protein'],
    serves: 'Crispy skinless chicken thighs roasted with baby red potatoes and Brussels sprouts.',
    macros: { kc: 620, c: 52, p: 46, f: 20 },
    pantry: ['3 tbsp Dijon mustard', '2 tbsp honey', '1 tbsp olive oil', 'thyme', 'salt and pepper'],
    ingredients: [
      { n: 'Chicken thigh, boneless skinless, raw', q: '1.5 lb' },
      { n: 'Potato, russet, raw', q: '1.5 lb (cubed)' },
      { n: 'Brussels sprouts, raw', q: '1 lb (halved)' }
    ],
    method: [
      'Preheat oven to 400°F.',
      'Toss halved Brussels sprouts and cubed potatoes with oil, salt, and pepper on sheet pan. Roast 15 min.',
      'Whisk mustard, honey, olive oil, and thyme. Coat chicken thighs.',
      'Place chicken on sheet pan between vegetables. Roast 22-25 minutes to 165°F.'
    ]
  },
  {
    name: 'Sheet pan pesto salmon + zucchini',
    category: 'Sheet Pan',
    tags: ['sheet-pan', 'mediterranean', 'high-protein'],
    serves: 'Herbaceous baked pesto salmon with roasted zucchini and sweet cherry tomatoes.',
    macros: { kc: 560, c: 32, p: 44, f: 26 },
    pantry: ['1/3 cup basil pesto', '1 tbsp olive oil', 'salt and pepper', '1 lemon'],
    ingredients: [
      { n: 'Salmon, Atlantic, raw', q: '1.25 lb' },
      { n: 'Zucchini, raw', q: '2 zucchini (rounds)' },
      { n: 'Tomato, raw', q: '1 pint cherry tomatoes' }
    ],
    method: [
      'Preheat oven to 400°F. Line sheet pan with foil.',
      'Toss sliced zucchini and cherry tomatoes with olive oil, salt, and pepper.',
      'Place salmon fillets on pan. Spoon 1-2 tbsp pesto over top of each fillet.',
      'Bake 12-14 minutes until salmon flakes with fork.'
    ]
  },
  {
    name: 'Sheet pan chicken breast + sweet potatoes',
    category: 'Sheet Pan',
    tags: ['sheet-pan', 'carb-heavy', 'high-protein'],
    serves: 'Endurance fueling staple with roasted sweet potatoes and asparagus.',
    macros: { kc: 610, c: 68, p: 48, f: 12 },
    pantry: ['2 tbsp olive oil', 'garlic powder, paprika, rosemary', 'salt and pepper'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.5 lb' },
      { n: 'Sweet potato, raw', q: '3 potatoes (cubed)' },
      { n: 'Asparagus, raw', q: '1 bunch' }
    ],
    method: [
      'Preheat oven to 400°F.',
      'Toss sweet potato cubes in oil and paprika. Roast 20 min.',
      'Add seasoned chicken breasts and asparagus to pan.',
      'Bake 18-20 minutes until chicken reaches 165°F and potatoes are caramelized.'
    ]
  },
  {
    name: 'One-pot beef & shells in tomato sauce',
    category: 'Sheet Pan',
    tags: ['sheet-pan', 'italian', 'comfort', 'carb-heavy'],
    serves: 'Hearty one-pot pasta dinner cooked directly in rich meat sauce.',
    macros: { kc: 680, c: 82, p: 46, f: 18 },
    pantry: ['1 jar marinara (24 oz)', '3 cups beef broth', '1 onion', '3 cloves garlic', 'oregano, basil', '1 cup mozzarella'],
    ingredients: [
      { n: 'Ground beef, 90/10, raw', q: '1.25 lb' },
      { n: 'Pasta, dry', q: '1 lb medium pasta shells' },
      { n: 'Mozzarella, part skim, shredded', q: '1 cup' }
    ],
    method: [
      'Brown ground beef with onion and garlic in Dutch oven 6 min. Drain fat.',
      'Add dry pasta shells, marinara sauce, and beef broth. Bring to a boil.',
      'Cover, reduce heat, and simmer 12-14 minutes stirring occasionally until pasta is tender.',
      'Stir in cheese until melted and serve hot.'
    ]
  },
  {
    name: 'Sheet pan turkey sausage + roasted peppers',
    category: 'Sheet Pan',
    tags: ['sheet-pan', 'american', 'quick-prep'],
    serves: 'Roasted turkey sausage coins with sweet mini peppers and baby potatoes.',
    macros: { kc: 540, c: 56, p: 36, f: 18 },
    pantry: ['2 tbsp olive oil', '1 tsp garlic powder, 1 tsp oregano', 'salt and pepper'],
    ingredients: [
      { n: 'Italian sausage, raw', q: '12 oz turkey sausage' },
      { n: 'Potato, russet, raw', q: '1.5 lb (cubed)' },
      { n: 'Bell pepper, raw', q: '3 peppers' }
    ],
    method: [
      'Preheat oven to 400°F.',
      'Toss potatoes with 1 tbsp oil, garlic powder, salt, and pepper. Roast 15 min.',
      'Add sliced sausage and bell peppers to pan.',
      'Roast 15 minutes more until sausage is browned and vegetables are tender.'
    ]
  },

  // =========================================================================
  // 7. HIGH-CARB GLYCOGEN LOADERS (10)
  // =========================================================================
  {
    name: 'Potato gnocchi + turkey sausage marinara',
    category: 'Carb Heavy',
    tags: ['carb-heavy', 'italian', 'comfort', 'high-protein'],
    serves: 'Tender potato gnocchi tossed in hearty turkey sausage marinara.',
    macros: { kc: 690, c: 92, p: 44, f: 16 },
    pantry: ['1 jar marinara (24 oz)', '1 tbsp olive oil', '2 cloves garlic', 'parmesan', 'salt and pepper'],
    ingredients: [
      { n: 'Italian sausage, raw', q: '1 lb turkey sausage' },
      { n: 'Gnocchi', q: '1 lb potato gnocchi' },
      { n: 'Marinara sauce', q: '1 jar (24 oz)' },
      { n: 'Parmesan, grated', q: '1/2 cup' }
    ],
    method: [
      'Brown crumbled sausage in large skillet with garlic 6 min.',
      'Add marinara sauce and simmer 10 min.',
      'Boil gnocchi in salted water 3 minutes until they float to surface. Drain.',
      'Toss gnocchi directly into sauce. Top with parmesan and basil.'
    ]
  },
  {
    name: 'Cajun chicken & rice jambalaya',
    category: 'Carb Heavy',
    tags: ['carb-heavy', 'spicy', 'american'],
    serves: 'Spicy Creole jambalaya loaded with chicken breast, sausage, and long grain rice.',
    macros: { kc: 680, c: 88, p: 48, f: 14 },
    pantry: ['2 tbsp Cajun seasoning', '3 cups chicken broth', '1 can diced tomatoes', '1 onion', '1 green bell pepper', '2 celery stalks', 'olive oil'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.25 lb (diced)' },
      { n: 'Italian sausage, raw', q: '8 oz' },
      { n: 'White rice, dry', q: '1.5 cups' },
      { n: 'Bell pepper, raw', q: '1 pepper' }
    ],
    method: [
      'Brown sausage and chicken in large Dutch oven 6 min. Remove.',
      'Sauté diced onion, bell pepper, and celery 5 min.',
      'Add rice, Cajun seasoning, diced tomatoes, and broth. Bring to boil.',
      'Return meat to pot, cover, simmer on low 20 minutes until rice is tender.',
      'Fluff with fork and garnish with green onions.'
    ]
  },
  {
    name: 'Sesame beef udon noodles',
    category: 'Carb Heavy',
    tags: ['carb-heavy', 'asian', 'quick-prep'],
    serves: 'Thick chewy udon noodles stir-fried with thinly sliced flank steak and bok choy.',
    macros: { kc: 690, c: 94, p: 42, f: 16 },
    pantry: ['3 tbsp soy sauce', '2 tbsp oyster sauce', '1 tbsp sesame oil', '1 tbsp brown sugar', 'garlic, ginger'],
    ingredients: [
      { n: 'Sirloin steak, raw', q: '1 lb (sliced thin)' },
      { n: 'Ramen noodles, dry', q: '3 packs (or 1 lb udon)' },
      { n: 'Broccoli, raw', q: '1 head' },
      { n: 'Carrots, raw', q: '2 carrots' }
    ],
    method: [
      'Boil udon noodles per package 4 min. Drain.',
      'Sear sliced beef in hot oil 2 min. Remove.',
      'Stir-fry broccoli and carrots 3 min.',
      'Add noodles, beef, and whisked sauce. Toss vigorously 2 minutes until glossy and coated.'
    ]
  },
  {
    name: 'Maple dijon pork chops + sweet potato mash',
    category: 'Carb Heavy',
    tags: ['carb-heavy', 'american', 'high-protein'],
    serves: 'Seared pork chops glazed in pure maple syrup and Dijon with fluffy sweet potato mash.',
    macros: { kc: 640, c: 74, p: 48, f: 14 },
    pantry: ['3 tbsp maple syrup', '2 tbsp Dijon mustard', '1 tbsp apple cider vinegar', 'butter', 'salt and pepper'],
    ingredients: [
      { n: 'Pork chop, raw', q: '4 chops (1.5 lb)' },
      { n: 'Sweet potato, raw', q: '3 large potatoes' },
      { n: 'Green beans, raw', q: '1 lb' }
    ],
    method: [
      'Boil sweet potatoes 15 min, mash with butter and salt.',
      'Pan-sear seasoned pork chops in skillet 4 min per side.',
      'Whisk maple syrup, Dijon, and vinegar. Pour over chops, simmer 2 minutes until sticky.',
      'Serve chops with pan glaze over sweet potato mash and steamed green beans.'
    ]
  },
  {
    name: 'Sweet potato & black bean fajita bowl',
    category: 'Carb Heavy',
    tags: ['carb-heavy', 'mexican', 'plant-based'],
    serves: 'Loaded vegetarian fuel bowl with roasted sweet potatoes, black beans, and brown rice.',
    macros: { kc: 620, c: 98, p: 22, f: 12 },
    pantry: ['1 tbsp taco seasoning', 'olive oil', 'salsa', 'lime juice', 'guacamole'],
    ingredients: [
      { n: 'Sweet potato, raw', q: '3 potatoes (cubed)' },
      { n: 'Black beans, canned, drained', q: '2 cans' },
      { n: 'Brown rice, dry', q: '1.5 cups' },
      { n: 'Bell pepper, raw', q: '2 peppers' },
      { n: 'Guacamole', q: '1/2 cup' }
    ],
    method: [
      'Roast cubed sweet potatoes and sliced peppers with taco seasoning at 400°F for 25 min.',
      'Cook brown rice.',
      'Warm black beans with cumin and lime.',
      'Build bowls with brown rice base, black beans, roasted sweet potatoes, peppers, salsa, and guacamole.'
    ]
  },
  {
    name: 'Honey mustard salmon + quinoa + broccoli',
    category: 'Carb Heavy',
    tags: ['carb-heavy', 'high-protein'],
    serves: 'Glazed Atlantic salmon over hearty quinoa with steamed broccoli florets.',
    macros: { kc: 630, c: 68, p: 46, f: 18 },
    pantry: ['2 tbsp honey', '2 tbsp whole grain or Dijon mustard', '1 tbsp soy sauce', 'salt and pepper'],
    ingredients: [
      { n: 'Salmon, Atlantic, raw', q: '1.25 lb' },
      { n: 'Quinoa, dry', q: '1.5 cups' },
      { n: 'Broccoli, raw', q: '1 large head' }
    ],
    method: [
      'Cook quinoa in salted water 15 minutes.',
      'Whisk honey, mustard, and soy sauce. Spoon over salmon fillets on baking sheet.',
      'Bake at 400°F for 12-14 minutes.',
      'Steam broccoli florets 5 minutes.',
      'Serve salmon over warm quinoa with broccoli.'
    ]
  },
  {
    name: 'Lemon herb chicken farro bowls',
    category: 'Carb Heavy',
    tags: ['carb-heavy', 'mediterranean', 'high-protein'],
    serves: 'Chewy ancient grain farro base topped with grilled herb chicken and zucchini.',
    macros: { kc: 640, c: 78, p: 50, f: 14 },
    pantry: ['2 tbsp olive oil', '1 lemon', '1 tsp oregano, 1 tsp thyme', 'salt and pepper', 'feta'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.5 lb' },
      { n: 'Farro, dry', q: '1.5 cups' },
      { n: 'Zucchini, raw', q: '2 zucchini' },
      { n: 'Feta', q: '1/2 cup crumbled' }
    ],
    method: [
      'Boil farro in salted water 25-30 min until tender-chewy. Drain.',
      'Grill or sear seasoned chicken breasts 5-6 min per side. Slice.',
      'Sauté or grill sliced zucchini 4 min.',
      'Assemble bowls with warm farro, sliced chicken, zucchini, crumbled feta, and fresh lemon juice.'
    ]
  },
  {
    name: 'BBQ pulled chicken + roasted potatoes',
    category: 'Carb Heavy',
    tags: ['carb-heavy', 'american', 'comfort'],
    serves: 'Sweet and tangy pulled chicken served alongside crispy roasted potato wedges.',
    macros: { kc: 650, c: 82, p: 48, f: 12 },
    pantry: ['1 cup BBQ sauce', '1 tbsp apple cider vinegar', 'garlic powder, paprika', 'olive oil'],
    ingredients: [
      { n: 'Chicken breast, skinless, raw', q: '1.5 lb' },
      { n: 'Potato, russet, raw', q: '2.5 lb potatoes (wedges)' },
      { n: 'Sweet corn on the cob', q: '4 ears' }
    ],
    method: [
      'Roast potato wedges with olive oil, paprika, and salt at 425°F for 35 min.',
      'Poach or slow cook chicken with BBQ sauce until tender, then shred.',
      'Grill or boil sweet corn 10 min.',
      'Serve warm pulled BBQ chicken alongside crispy potatoes and corn.'
    ]
  },
  {
    name: 'Turkey pasta bake + ricotta & spinach',
    category: 'Carb Heavy',
    tags: ['carb-heavy', 'italian', 'comfort'],
    serves: 'Creamy high-carb recovery pasta bake layered with ground turkey and ricotta.',
    macros: { kc: 680, c: 84, p: 50, f: 16 },
    pantry: ['1 jar marinara (24 oz)', '1 cup ricotta cheese', '1 onion', '3 cloves garlic', 'oregano', '1 cup mozzarella'],
    ingredients: [
      { n: 'Ground turkey, 93/7, raw', q: '1.25 lb' },
      { n: 'Pasta, dry', q: '1 lb rigatoni or penne' },
      { n: 'Spinach, raw', q: '1 bag (6 oz)' },
      { n: 'Mozzarella, part skim, shredded', q: '1 cup' }
    ],
    method: [
      'Preheat oven to 375°F.',
      'Brown turkey with onion and garlic, stir in marinara and baby spinach until wilted.',
      'Cook pasta 2 min under package instructions.',
      'Fold pasta and meat sauce into baking dish, dollop spoonfuls of ricotta throughout, top with mozzarella.',
      'Bake 20 minutes until bubbling and golden.'
    ]
  },
  {
    name: 'Pasta with meat sauce',
    category: 'Carb Heavy',
    tags: ['carb-heavy', 'italian', 'comfort', 'high-protein'],
    serves: 'Double batch: half tonight, half in fridge for reheat.',
    macros: { kc: 690, c: 88, p: 48, f: 16 },
    pantry: ['2 tbsp olive oil', '2 tbsp tomato paste', '4 cloves garlic', '1 onion', 'dried oregano, basil', 'salt and pepper'],
    ingredients: [
      { n: 'Ground turkey, 93/7, raw', q: '1.5 lb' },
      { n: 'Pasta, dry', q: '1 lb spaghetti or penne' },
      { n: 'Marinara sauce', q: '2 jars (24 oz)' },
      { n: 'Parmesan, grated', q: '1/2 cup' }
    ],
    method: [
      'Brown turkey in olive oil over medium-high, break fine.',
      'Onion 5 min, garlic 30s. Tomato paste 1 min, marinara in plus water.',
      'Simmer 25-30 minutes.',
      'Boil pasta 1 min under box time. Toss in sauce with splash of pasta water.',
      'Serve with parmesan.'
    ]
  },

  // =========================================================================
  // 8. PLANT-BASED & MEDITERRANEAN BOWLS (10)
  // =========================================================================
  {
    name: 'Crispy tofu brown rice bowl + teriyaki',
    category: 'Plant-Based',
    tags: ['plant-based', 'asian', 'carb-heavy'],
    serves: 'Crispy pan-fried tofu cubes in sweet teriyaki glaze over nutty brown rice.',
    macros: { kc: 540, c: 78, p: 26, f: 14 },
    pantry: ['3 tbsp teriyaki sauce', '1 tbsp cornstarch', '1 tbsp sesame oil', 'sesame seeds'],
    ingredients: [
      { n: 'Tofu, firm', q: '1 block (14 oz)' },
      { n: 'Brown rice, dry', q: '1.5 cups' },
      { n: 'Broccoli, raw', q: '1 head' },
      { n: 'Carrots, raw', q: '2 carrots' }
    ],
    method: [
      'Press tofu, cut into cubes, toss in cornstarch and pinch of salt.',
      'Pan-fry in sesame oil 8-10 min until crisp on all sides.',
      'Pour over teriyaki sauce, bubble 1 min until sticky.',
      'Steam broccoli and carrots 5 min.',
      'Serve tofu over brown rice with steamed vegetables.'
    ]
  },
  {
    name: 'Mediterranean chickpea & farro bowl',
    category: 'Plant-Based',
    tags: ['plant-based', 'mediterranean', 'carb-heavy'],
    serves: 'Nutrient-dense ancient grain bowl with roasted spiced chickpeas and tahini.',
    macros: { kc: 580, c: 86, p: 24, f: 16 },
    pantry: ['2 tbsp olive oil', '1 tbsp tahini', '1 lemon', 'cumin, paprika, garlic powder', 'salt and pepper'],
    ingredients: [
      { n: 'Chickpeas, canned, drained', q: '2 cans' },
      { n: 'Farro, dry', q: '1.5 cups' },
      { n: 'Cucumber', q: '1 cucumber' },
      { n: 'Tomato, raw', q: '1 pint cherry tomatoes' }
    ],
    method: [
      'Cook farro in salted water 25 min until tender-chewy.',
      'Roast chickpeas with olive oil, cumin, paprika, and salt at 400°F for 20 min until crunchy.',
      'Whisk tahini, lemon juice, 2 tbsp warm water, and garlic for dressing.',
      'Build bowls with farro, crispy chickpeas, diced cucumber, tomatoes, and tahini drizzle.'
    ]
  },
  {
    name: 'Black bean sweet potato enchilada bowl',
    category: 'Plant-Based',
    tags: ['plant-based', 'mexican', 'carb-heavy'],
    serves: 'Deconstructed enchilada bowl with roasted sweet potatoes, black beans, and salsa.',
    macros: { kc: 560, c: 92, p: 20, f: 12 },
    pantry: ['1/2 cup enchilada sauce', '1 tsp cumin', '1 tsp chili powder', 'lime juice', 'guacamole'],
    ingredients: [
      { n: 'Black beans, canned, drained', q: '2 cans' },
      { n: 'Sweet potato, raw', q: '3 potatoes (cubed)' },
      { n: 'White rice, dry', q: '1.25 cups' },
      { n: 'Corn, frozen', q: '1 cup' }
    ],
    method: [
      'Roast sweet potato cubes with cumin and chili powder at 400°F for 25 min.',
      'Cook rice.',
      'Warm black beans and corn in enchilada sauce 5 min.',
      'Assemble bowls with rice, black beans, corn, roasted sweet potatoes, and guacamole.'
    ]
  },
  {
    name: 'Greek lentil & quinoa power salad',
    category: 'Plant-Based',
    tags: ['plant-based', 'mediterranean', 'high-protein'],
    serves: 'Hearty cold salad loaded with tender brown lentils, quinoa, and Mediterranean herbs.',
    macros: { kc: 520, c: 74, p: 26, f: 14 },
    pantry: ['2 tbsp olive oil', '1 tbsp red wine vinegar', '1 lemon', 'dried oregano', 'salt and pepper'],
    ingredients: [
      { n: 'Lentils, dry', q: '1 cup' },
      { n: 'Quinoa, dry', q: '1 cup' },
      { n: 'Cucumber', q: '1 cucumber' },
      { n: 'Tomato, raw', q: '2 tomatoes' },
      { n: 'Feta', q: '1/2 cup crumbled' }
    ],
    method: [
      'Simmer lentils in water 20 min until tender but not mushy. Drain and cool.',
      'Cook quinoa in salted water 15 min. Cool.',
      'Toss lentils, quinoa, diced cucumber, and tomatoes with olive oil, vinegar, lemon, and oregano.',
      'Top with crumbled feta and serve chilled or room temperature.'
    ]
  },
  {
    name: 'Creamy coconut lentil curry + jasmine rice',
    category: 'Plant-Based',
    tags: ['plant-based', 'comfort', 'carb-heavy', 'asian'],
    serves: 'Fragrant golden lentil dal simmered in coconut milk with turmeric and ginger.',
    macros: { kc: 620, c: 88, p: 26, f: 18 },
    pantry: ['1 can coconut milk', '1 tbsp yellow curry powder', '1 tsp turmeric', '1 tbsp ginger', '3 cloves garlic', '1 onion'],
    ingredients: [
      { n: 'Lentils, dry', q: '1.5 cups red or brown lentils' },
      { n: 'Coconut milk, canned', q: '1 can' },
      { n: 'Spinach, raw', q: '1 bag (6 oz)' },
      { n: 'White rice, dry', q: '1.5 cups' }
    ],
    method: [
      'Sauté diced onion, garlic, and ginger in 1 tbsp oil 5 min.',
      'Add curry powder and turmeric, stir 1 min.',
      'Add lentils, coconut milk, and 2 cups broth. Simmer 25 minutes until lentils are soft and creamy.',
      'Fold in baby spinach until wilted.',
      'Serve over hot jasmine rice.'
    ]
  },
  {
    name: 'Roasted chickpea & avocado Buddha bowl',
    category: 'Plant-Based',
    tags: ['plant-based', 'carb-heavy'],
    serves: 'Vibrant grain bowl with crispy chickpeas, sliced avocado, and shredded beets.',
    macros: { kc: 590, c: 82, p: 22, f: 20 },
    pantry: ['2 tbsp olive oil', '1 lemon', '1 tsp paprika, 1 tsp cumin', 'salt and pepper'],
    ingredients: [
      { n: 'Chickpeas, canned, drained', q: '2 cans' },
      { n: 'Brown rice, dry', q: '1.5 cups' },
      { n: 'Avocado', q: '1 avocado' },
      { n: 'Beets, raw', q: '2 beets (roasted/sliced)' },
      { n: 'Kale, raw', q: '1 bunch' }
    ],
    method: [
      'Roast spiced chickpeas at 400°F for 20 min until crunchy.',
      'Massage chopped kale with 1 tsp olive oil and lemon juice to tenderize.',
      'Build bowls with warm brown rice, massaged kale, roasted beets, crispy chickpeas, and sliced avocado.'
    ]
  },
  {
    name: 'Sesame peanut soba noodles + crispy tofu',
    category: 'Plant-Based',
    tags: ['plant-based', 'asian', 'carb-heavy'],
    serves: 'Excellent cold or at room temperature. Good for meal prep — keeps 2 days. Press tofu ahead of time.',
    macros: { kc: 640, c: 84, p: 30, f: 20 },
    pantry: ['1/3 cup natural peanut butter', '2 tbsp soy sauce', '1 tbsp maple syrup', '1 tbsp fresh lime juice', '1 tsp sriracha', '1 tbsp toasted sesame oil', '3 tbsp warm water', '1 tbsp neutral oil for frying'],
    ingredients: [
      { n: 'Tofu, firm', q: '1 block (14 oz)' },
      { n: 'Soba noodles, dry', q: '8 oz' },
      { n: 'Cucumber', q: '1 cucumber' },
      { n: 'Carrots, raw', q: '2 carrots' },
      { n: 'Peanuts', q: '1/4 cup crushed' }
    ],
    method: [
      'Press tofu: wrap in a clean towel, place a heavy pan or plate on top for at least 15 minutes. Cut into 1-inch cubes.',
      'Make peanut sauce: whisk peanut butter, soy sauce, maple syrup, lime juice, sriracha, sesame oil, and 3 tbsp warm water until completely smooth. Add more water 1 tsp at a time if too thick.',
      'Boil soba noodles in plenty of unsalted water 4-5 minutes (soba is already salty). Drain immediately and rinse thoroughly under cold water. Shake off excess water.',
      'Heat neutral oil in a wide non-stick skillet over medium-high. Add tofu in a single layer — don\'t stir for 3 minutes. Flip and cook 3 minutes more, then continue turning until golden and crisp on multiple sides, 8-10 minutes total.',
      'Use a vegetable peeler to ribbon the cucumber and carrots into long strips.',
      'In a large bowl, toss soba noodles and vegetable ribbons with peanut sauce until everything is coated.',
      'Divide into bowls, top with crispy tofu and crushed peanuts. Finish with extra sriracha and a squeeze of lime.'
    ]
  },
  {
    name: 'Mediterranean white bean bowl + herb dressing',
    category: 'Plant-Based',
    tags: ['plant-based', 'mediterranean', 'quick-prep'],
    serves: 'No-cook creamy cannellini bean salad with cherry tomatoes and kalamata olives.',
    macros: { kc: 510, c: 72, p: 22, f: 14 },
    pantry: ['3 tbsp extra virgin olive oil', '1 tbsp lemon juice', 'dried oregano, thyme', 'salt and pepper'],
    ingredients: [
      { n: 'Kidney beans, canned, drained', q: '2 cans cannellini beans' },
      { n: 'Tomato, raw', q: '1 pint cherry tomatoes' },
      { n: 'Cucumber', q: '1 cucumber' },
      { n: 'Pita bread, whole wheat', q: '2 pitas' }
    ],
    method: [
      'Whisk olive oil, lemon juice, oregano, salt, and pepper.',
      'Toss drained white beans, halved cherry tomatoes, and diced cucumbers in dressing.',
      'Let sit 10 minutes to absorb herbs.',
      'Serve with warm whole-wheat pita.'
    ]
  },
  {
    name: 'High-protein edamame & tofu fried rice',
    category: 'Plant-Based',
    tags: ['plant-based', 'asian', 'carb-heavy'],
    serves: 'Plant-based fried rice with crispy baked tofu and edamame.',
    macros: { kc: 580, c: 76, p: 28, f: 16 },
    pantry: ['2 tbsp soy sauce', '1 tbsp sesame oil', '2 cloves garlic', '1 tsp ginger', 'green onions'],
    ingredients: [
      { n: 'Tofu, firm', q: '1 block (14 oz)' },
      { n: 'White rice, dry', q: '1.5 cups (cooked & chilled)' },
      { n: 'Peas, frozen', q: '1 cup' },
      { n: 'Carrots, raw', q: '2 carrots' }
    ],
    method: [
      'Crumble tofu and pan-fry in oil 6 min until golden.',
      'Add chilled rice to hot skillet, fry 2 min.',
      'Add peas, carrots, garlic, and ginger.',
      'Drizzle with soy sauce and sesame oil, toss 2 minutes until hot and fragrant.'
    ]
  },
  {
    name: 'Falafel pita pockets + hummus & cucumber',
    category: 'Plant-Based',
    tags: ['plant-based', 'mediterranean', 'quick-prep'],
    serves: 'Crispy baked chickpea falafels stuffed into warm pitas with garlic hummus.',
    macros: { kc: 560, c: 82, p: 20, f: 16 },
    pantry: ['1/2 cup hummus', 'olive oil', 'lemon juice', 'cumin, garlic powder', 'salt and pepper'],
    ingredients: [
      { n: 'Chickpeas, canned, drained', q: '2 cans' },
      { n: 'Pita bread, whole wheat', q: '4 pitas' },
      { n: 'Cucumber', q: '1 cucumber' },
      { n: 'Tomato, raw', q: '2 tomatoes' },
      { n: 'Hummus', q: '1/2 cup' }
    ],
    method: [
      'Mash drained chickpeas with garlic, cumin, parsley, 2 tbsp flour, salt, and pepper. Shape into 12 small patties.',
      'Pan-fry or bake at 400°F for 18 minutes until golden brown.',
      'Warm pita pockets, spread generously with hummus.',
      'Stuff with crispy falafels, sliced cucumber, and diced tomatoes.'
    ]
  }
];

const out = {
  version: 1,
  built: 'deterministic — regenerate with node tools/build-meals.mjs',
  count: MEALS_CATALOG.length,
  meals: MEALS_CATALOG
};

const json = JSON.stringify(out, null, 1) + '\n';
const jsonPath = join(root, 'data/meals.json');

if (process.argv.includes('--check')) {
  if (!existsSync(jsonPath) || readFileSync(jsonPath, 'utf8') !== json) {
    console.error('build-meals --check: data/meals.json is stale — run node tools/build-meals.mjs');
    process.exit(1);
  }
  console.log(`build-meals --check: ok (${MEALS_CATALOG.length} meals)`);
} else {
  writeFileSync(jsonPath, json);
  console.log(`build-meals: wrote ${jsonPath} — ${MEALS_CATALOG.length} curated meals`);
}

const INLINE = 'const MEAL_CATALOG = ' + JSON.stringify(MEALS_CATALOG) + ';\n'
  + 'const RECIPES = {};\n'
  + 'for (const _m of MEAL_CATALOG) RECIPES[_m.name] = _m;';

const page = join(root, 'web/public/index.html');
if (existsSync(page)) {
  const html = readFileSync(page, 'utf8');
  const re = /const MEAL_CATALOG = \[.*?\];\s*const RECIPES = \{\};\s*for \(const _m of MEAL_CATALOG\) RECIPES\[_m\.name\] = _m;/s;
  let next = html;
  if (re.test(html)) {
    next = html.replace(re, INLINE);
  } else if (/const RECIPES = \{.*?\};/s.test(html)) {
    next = html.replace(/const RECIPES = \{.*?\};/s, INLINE);
  }
  if (process.argv.includes('--check')) {
    if (next !== html) { console.error('build-meals --check: the MEAL_CATALOG in index.html is stale'); process.exit(1); }
  } else if (next !== html) {
    writeFileSync(page, next);
    console.log(`build-meals: refreshed MEAL_CATALOG in ${page} (${INLINE.length} bytes)`);
  }
}


