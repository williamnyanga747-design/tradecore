export const TANZANIA_REGIONS = [
  'Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Katavi', 'Kigoma', 'Kilimanjaro',
  'Lindi', 'Manyara', 'Mara', 'Mbeya', 'Morogoro', 'Mtwara', 'Mwanza', 'Njombe', 'Pemba North',
  'Pemba South', 'Pwani', 'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu', 'Singida', 'Songwe',
  'Tabora', 'Tanga', 'Unguja North', 'Unguja South', 'Unguja Urban West'
];

export const REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  'Arusha': { lat: -3.3869, lng: 36.683 },
  'Dar es Salaam': { lat: -6.7924, lng: 39.2083 },
  'Dodoma': { lat: -6.163, lng: 35.7516 },
  'Geita': { lat: -2.87, lng: 32.232 },
  'Iringa': { lat: -7.7681, lng: 35.692 },
  'Kagera': { lat: -1.993, lng: 31.766 },
  'Katavi': { lat: -6.089, lng: 31.066 },
  'Kigoma': { lat: -4.8769, lng: 29.6267 },
  'Kilimanjaro': { lat: -3.3346, lng: 37.3404 },
  'Lindi': { lat: -9.9972, lng: 39.7165 },
  'Manyara': { lat: -4.315, lng: 36.954 },
  'Mara': { lat: -1.783, lng: 33.6 },
  'Mbeya': { lat: -8.9067, lng: 33.455 },
  'Morogoro': { lat: -6.83, lng: 37.671 },
  'Mtwara': { lat: -10.272, lng: 40.186 },
  'Mwanza': { lat: -2.516, lng: 32.901 },
  'Njombe': { lat: -9.341, lng: 34.77 },
  'Pemba North': { lat: -5.031, lng: 39.774 },
  'Pemba South': { lat: -5.27, lng: 39.798 },
  'Pwani': { lat: -6.818, lng: 39.284 },
  'Rukwa': { lat: -7.997, lng: 31.617 },
  'Ruvuma': { lat: -10.88, lng: 35.65 },
  'Shinyanga': { lat: -3.661, lng: 33.426 },
  'Simiyu': { lat: -3.06, lng: 34.01 },
  'Singida': { lat: -4.8133, lng: 34.7435 },
  'Songwe': { lat: -8.828, lng: 33.293 },
  'Tabora': { lat: -5.0163, lng: 32.826 },
  'Tanga': { lat: -5.0892, lng: 39.0986 },
  'Unguja North': { lat: -5.955, lng: 39.266 },
  'Unguja South': { lat: -6.379, lng: 39.438 },
  'Unguja Urban West': { lat: -6.165, lng: 39.199 }
};

export function regionCenter(region?: string | null): { lat: number; lng: number } | null {
  if (!region) return null;
  const key = Object.keys(REGION_CENTERS).find(r => r.toLowerCase() === region.trim().toLowerCase());
  return key ? REGION_CENTERS[key] : null;
}

export const MARKETPLACE_CATEGORIES = [
  'Cereals', 'Oil', 'Household', 'Building', 'Electronics', 'Retail & Wholesale',
  'Fashion', 'Pharmacy', 'Furniture', 'Automotive', 'Agriculture', 'Other'
];

export const MARKETPLACE_PAYMENT_LABELS: Record<string, string> = {
  mpesa: 'M-Pesa',
  tigopesa: 'Tigo Pesa',
  airtelmoney: 'Airtel Money',
  halopesa: 'Halo Pesa',
  lipa_number: 'M-Pesa Lipa Namba',
  bank: 'Bank Transfer'
};
