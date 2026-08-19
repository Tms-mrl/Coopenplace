// Catálogo de comodidades (amenities). Se guardan como JSON array de keys en
// properties.amenities. Labels/íconos son estáticos (sin riesgo de inyección).

export const AMENITIES: { key: string; label: string; icon: string }[] = [
  { key: 'wifi', label: 'WiFi', icon: '📶' },
  { key: 'gas', label: 'Gas natural', icon: '🔥' },
  { key: 'gas_envasado', label: 'Gas envasado (a cargo del inquilino)', icon: '🛢️' },
  { key: 'tv', label: 'TV / Cable', icon: '📺' },
  { key: 'directv', label: 'TV por DirecTV prepago', icon: '📡' },
  { key: 'aire', label: 'Aire acond.', icon: '❄️' },
  { key: 'calefaccion', label: 'Calefacción', icon: '🌡️' },
  { key: 'cochera', label: 'Cochera', icon: '🚗' },
  { key: 'pileta', label: 'Pileta', icon: '🏊' },
  { key: 'parrilla', label: 'Parrilla', icon: '🍖' },
  { key: 'patio', label: 'Patio / Jardín', icon: '🌳' },
  { key: 'lavarropas', label: 'Lavarropas', icon: '🧺' },
  { key: 'amoblado', label: 'Amoblado', icon: '🛋️' },
  { key: 'mascotas', label: 'Acepta mascotas', icon: '🐾' },
  { key: 'seguridad', label: 'Seguridad', icon: '🛡️' },
  { key: 'heladera', label: 'Heladera/freezer', icon: '🧊' },
  { key: 'microondas', label: 'Microondas', icon: '⏲️' },
  { key: 'ventilador', label: 'Ventilador', icon: '🌀' },
];
const BY_KEY = new Map(AMENITIES.map((a) => [a.key, a]));

export function parseAmenities(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const a = JSON.parse(json);
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string' && BY_KEY.has(x)) : [];
  } catch { return []; }
}

/** Chips completos (ícono + label) para la ficha. */
export function amenityChips(json: string | null | undefined, cls = 'amen'): string {
  const keys = parseAmenities(json);
  if (!keys.length) return '';
  return `<div class="${cls}">${keys.map((k) => {
    const a = BY_KEY.get(k)!;
    return `<span class="amen-chip">${a.icon} ${a.label}</span>`;
  }).join('')}</div>`;
}

/** Solo íconos (compacto) para las cards. */
export function amenityIcons(json: string | null | undefined, max = 5): string {
  const keys = parseAmenities(json).slice(0, max);
  if (!keys.length) return '';
  return `<span class="amen-ic">${keys.map((k) => `<span title="${BY_KEY.get(k)!.label}">${BY_KEY.get(k)!.icon}</span>`).join('')}</span>`;
}
