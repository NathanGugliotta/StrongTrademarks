// USPTO / Nice International Classification, 45 classes.
// Classes 1-34 are goods, 35-45 are services. The shortTitle is what we show
// in the dropdown next to the class number; examples are a brief flavor line
// to help non-attorneys pick a sensible starting class. The attorney refines
// during review.

export type UsptoClass = {
  number: string;
  category: "goods" | "services";
  shortTitle: string;
  examples: string;
};

export const USPTO_CLASSES: UsptoClass[] = [
  { number: "1", category: "goods", shortTitle: "Chemicals", examples: "industrial chemicals, adhesives, fertilizers" },
  { number: "2", category: "goods", shortTitle: "Paints", examples: "paints, varnishes, dyes, anti-rust coatings" },
  { number: "3", category: "goods", shortTitle: "Cosmetics & cleaning", examples: "cosmetics, soap, perfumery, cleaning preparations" },
  { number: "4", category: "goods", shortTitle: "Lubricants & fuels", examples: "industrial oils, lubricants, candles, fuels" },
  { number: "5", category: "goods", shortTitle: "Pharmaceuticals", examples: "drugs, medicines, dietary supplements, sanitary products" },
  { number: "6", category: "goods", shortTitle: "Metal goods", examples: "common metals, ironmongery, metal containers, safes" },
  { number: "7", category: "goods", shortTitle: "Machinery", examples: "machines and machine tools, motors and engines (non-vehicle)" },
  { number: "8", category: "goods", shortTitle: "Hand tools", examples: "hand tools and implements, cutlery, razors" },
  { number: "9", category: "goods", shortTitle: "Electronics & software", examples: "computers, software, phones, cameras, eyewear, scientific instruments" },
  { number: "10", category: "goods", shortTitle: "Medical apparatus", examples: "surgical, medical, dental and veterinary instruments" },
  { number: "11", category: "goods", shortTitle: "Lighting & climate", examples: "lighting, heating, cooking, refrigerating, sanitary installations" },
  { number: "12", category: "goods", shortTitle: "Vehicles", examples: "vehicles, apparatus for locomotion by land, air or water" },
  { number: "13", category: "goods", shortTitle: "Firearms & explosives", examples: "firearms, ammunition, explosives, fireworks" },
  { number: "14", category: "goods", shortTitle: "Jewelry", examples: "jewelry, precious metals, watches, horological instruments" },
  { number: "15", category: "goods", shortTitle: "Musical instruments", examples: "musical instruments, music stands, conductors' batons" },
  { number: "16", category: "goods", shortTitle: "Paper & printed matter", examples: "paper goods, books, stationery, posters, photographs, packaging" },
  { number: "17", category: "goods", shortTitle: "Rubber & plastic goods", examples: "rubber, gutta-percha, plastics in semi-worked form, insulating materials" },
  { number: "18", category: "goods", shortTitle: "Leather goods", examples: "leather, luggage, handbags, wallets, umbrellas" },
  { number: "19", category: "goods", shortTitle: "Building materials", examples: "non-metallic building materials, lumber, glass, monuments" },
  { number: "20", category: "goods", shortTitle: "Furniture", examples: "furniture, mirrors, picture frames, non-metal containers" },
  { number: "21", category: "goods", shortTitle: "Housewares", examples: "household utensils, glassware, combs and sponges, brushes" },
  { number: "22", category: "goods", shortTitle: "Cordage & fibers", examples: "ropes, string, nets, tents, sacks, padding materials" },
  { number: "23", category: "goods", shortTitle: "Yarns & threads", examples: "yarns and threads for textile use" },
  { number: "24", category: "goods", shortTitle: "Fabrics & textiles", examples: "textiles, bed linens, table covers, towels" },
  { number: "25", category: "goods", shortTitle: "Clothing", examples: "clothing, footwear, headwear" },
  { number: "26", category: "goods", shortTitle: "Lace, ribbons, accessories", examples: "lace, embroidery, ribbons, buttons, hooks, false hair" },
  { number: "27", category: "goods", shortTitle: "Floor coverings", examples: "carpets, rugs, mats, linoleum, wall hangings" },
  { number: "28", category: "goods", shortTitle: "Toys & sporting goods", examples: "games, toys, sporting equipment, decorations for Christmas trees" },
  { number: "29", category: "goods", shortTitle: "Meats & processed foods", examples: "meat, fish, poultry, eggs, dairy, jams, oils, edible fats" },
  { number: "30", category: "goods", shortTitle: "Staple foods", examples: "coffee, tea, sugar, flour, bread, pastry, sauces, spices" },
  { number: "31", category: "goods", shortTitle: "Agricultural products", examples: "fresh produce, live animals, seeds, plants, animal feed" },
  { number: "32", category: "goods", shortTitle: "Light beverages", examples: "beer, mineral water, fruit drinks, juices, non-alcoholic drinks" },
  { number: "33", category: "goods", shortTitle: "Wines & spirits", examples: "alcoholic beverages (except beer)" },
  { number: "34", category: "goods", shortTitle: "Smokers' articles", examples: "tobacco, cigarettes, lighters, matches, vaping products" },
  { number: "35", category: "services", shortTitle: "Advertising & business", examples: "advertising, business management, retail and online store services" },
  { number: "36", category: "services", shortTitle: "Insurance & financial", examples: "insurance, banking, real estate, investment, financial services" },
  { number: "37", category: "services", shortTitle: "Construction & repair", examples: "building construction, repair, installation services" },
  { number: "38", category: "services", shortTitle: "Telecommunications", examples: "telecommunications, broadcasting, internet access services" },
  { number: "39", category: "services", shortTitle: "Transportation & storage", examples: "transport, packaging and storage of goods, travel arrangement" },
  { number: "40", category: "services", shortTitle: "Treatment of materials", examples: "custom manufacturing, treatment of materials, printing services" },
  { number: "41", category: "services", shortTitle: "Education & entertainment", examples: "education, training, entertainment, sporting and cultural activities" },
  { number: "42", category: "services", shortTitle: "Tech & scientific services", examples: "software development, hosting, SaaS, scientific and tech consulting, design" },
  { number: "43", category: "services", shortTitle: "Hotels & restaurants", examples: "food and drink services, temporary accommodations, hotels" },
  { number: "44", category: "services", shortTitle: "Medical & beauty services", examples: "medical, beauty, hygienic care, veterinary, agricultural services" },
  { number: "45", category: "services", shortTitle: "Legal & personal services", examples: "legal services, security, dating, personal services" },
];

export function getUsptoClass(number: string): UsptoClass | undefined {
  return USPTO_CLASSES.find((c) => c.number === number);
}

export function formatUsptoClass(number: string): string {
  const cls = getUsptoClass(number);
  if (!cls) return `Class ${number}`;
  return `Class ${cls.number} — ${cls.shortTitle}`;
}
