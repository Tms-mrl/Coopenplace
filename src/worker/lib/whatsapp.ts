// WhatsApp click-to-chat (wa.me): sin API ni cuenta business. El publicante
// configura su número y el cliente abre el chat con un mensaje pre-armado.

/** Deja solo dígitos (formato que espera wa.me, con código de país). null si es muy corto. */
export function waDigits(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, '');
  return d.length >= 8 ? d : null;
}

/** Link wa.me con texto pre-armado. `number` ya debe venir normalizado (solo dígitos). */
export function waLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Resuelve el WhatsApp de contacto de una propiedad: agencia o propietario particular. */
export async function resolvePropertyWhatsapp(
  db: D1Database,
  prop: { agency_id?: number | null; owner_user_id?: number | null },
): Promise<string | null> {
  if (prop.agency_id) {
    const a = await db.prepare('SELECT whatsapp FROM agencies WHERE id = ?').bind(prop.agency_id).first<{ whatsapp: string | null }>();
    return waDigits(a?.whatsapp);
  }
  if (prop.owner_user_id) {
    const p = await db.prepare('SELECT whatsapp FROM places_profiles WHERE user_id = ?').bind(prop.owner_user_id).first<{ whatsapp: string | null }>();
    return waDigits(p?.whatsapp);
  }
  return null;
}
