/**
 * Decide a cual contacto de la conversacion hay que quedarse para que
 * reciba el CSAT.
 *
 * Por que existe esto: durante bastante tiempo confiabamos ciegamente en
 * conversation.source.author.id. Eso funciona para conversaciones que
 * inicia el cliente, pero se rompe cuando la conversacion la inicia un
 * agente (mail saliente a varios destinatarios en To/Cc): ahi
 * source.author es el admin que escribio el mail, no matchea con ningun
 * contact_id de la conversacion, y el codigo terminaba marcando a TODOS
 * los contactos para remover -- el que sobrevivia era, por pura
 * casualidad, el ultimo del array (Intercom no deja borrar al ultimo
 * customer, error 422 "Last customer"), sin ninguna garantia de que
 * fuera el cliente real. Asi fue como en la conversacion "Diagnostico
 * Icafal" el CSAT le llego a Sergio Villavicencio (svillavicencio@vixonic.com,
 * dominio interno, solo estaba en Cc) en vez de a Constanza Santibanez
 * (csantibanezv@icafal.cl), que era la clienta real y quien de hecho
 * respondio la conversacion.
 */

function getInternalDomains() {
  return (process.env.INTERNAL_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

function emailDomain(email) {
  return email ? email.split('@')[1]?.toLowerCase() || null : null;
}

function isInternalEmail(email, internalDomains) {
  const domain = emailDomain(email);
  return !!domain && internalDomains.includes(domain);
}

/**
 * @param {Array<{id: string, type?: string, email?: string|null}>} participantsWithEmail
 * @param {string|undefined} originalAuthorId - conversation.source.author.id
 * @returns uno de:
 *   { keepId, keepReason: 'single_external_contact' | 'source_author_external' }
 *   { ambiguous: true, reason: 'multiple_external_contacts', candidates: [...] }
 *   { none: true, reason: 'no_external_contact' }
 */
function resolveCustomerToKeep(participantsWithEmail, originalAuthorId) {
  const internalDomains = getInternalDomains();

  const external = participantsWithEmail.filter(
    (p) => p.email !== undefined && !isInternalEmail(p.email, internalDomains)
  );

  if (external.length === 1) {
    return { keepId: external[0].id, keepReason: 'single_external_contact' };
  }

  if (external.length > 1) {
    const authorIsExternal = external.some((p) => p.id === originalAuthorId);
    if (authorIsExternal) {
      return { keepId: originalAuthorId, keepReason: 'source_author_external' };
    }
    return {
      ambiguous: true,
      reason: 'multiple_external_contacts',
      candidates: external.map((p) => p.id),
    };
  }

  return { none: true, reason: 'no_external_contact' };
}

module.exports = { getInternalDomains, isInternalEmail, resolveCustomerToKeep };
