const { getConversation, getContact, detachContact } = require('./intercomClient');
const { resolveCustomerToKeep } = require('./customerResolver');

/**
 * Dada una conversationId, deja UNICAMENTE al cliente real como customer
 * de la conversacion, detachando via API a todos los demas participantes
 * (los CC'eados y cualquier contacto interno).
 *
 * Ya NO asumimos que conversation.source.author sea siempre el cliente:
 * en conversaciones que inicia un agente (mail saliente a varios
 * destinatarios) source.author es el admin, no matchea con ningun
 * contacto, y confiar en el a ciegas termina dejando como "sobreviviente"
 * a quien haya quedado ultimo en el array (por el 422 "Last customer" de
 * Intercom), no al cliente real. Ver customerResolver.js.
 *
 * Devuelve un resumen de lo que se hizo, pensado para loguear y para
 * devolver como respuesta al step "Wait for Webhook" del Workflow.
 */
async function pruneParticipants(conversationId, adminId) {
  const conversation = await getConversation(conversationId);

  const originalAuthorId = conversation?.source?.author?.id;
  const originalAuthorType = conversation?.source?.author?.type; // user | lead | contact | admin

  // El campo puede llamarse "contacts" o "customers" segun la version de la API.
  const participants =
    conversation?.contacts?.contacts ||
    conversation?.customers ||
    [];

  if (participants.length === 0) {
    return {
      status: 'skipped',
      reason: 'no_participants',
      conversation_id: conversationId,
      participant_count: participants.length,
    };
  }

  // OJO: aunque ya haya un solo participante, igual hay que resolverlo via
  // customerResolver -- si ese unico participante es de dominio interno
  // (ej. un agente registrado como contact/user en vez de admin), NO es el
  // cliente real y no hay que dejar pasar el CSAT. Ver caso real:
  // conversacion con un solo participante, falvarez@vixonic.com, a quien
  // el Workflow le mandaba el CSAT porque este chequeo cortaba antes de
  // mirar el dominio.

  const participantsWithEmail = await Promise.all(
    participants.map(async (p) => {
      try {
        const contact = await getContact(p.id);
        return { ...p, email: contact?.email || null };
      } catch (err) {
        console.error(`[prune-participants] no se pudo obtener el email de ${p.id}`, err.message);
        return { ...p, email: undefined }; // undefined = desconocido, no se usa como candidato
      }
    })
  );

  const decision = resolveCustomerToKeep(participantsWithEmail, originalAuthorId);

  if (decision.ambiguous || decision.none) {
    return {
      status: decision.ambiguous ? 'ambiguous' : 'skipped',
      reason: decision.reason,
      conversation_id: conversationId,
      original_author: { id: originalAuthorId, type: originalAuthorType },
      candidates: decision.candidates,
      participant_count: participants.length,
    };
  }

  const { keepId, keepReason } = decision;

  const toRemove = participantsWithEmail.filter((p) => p.id !== keepId);
  const removed = [];
  const failed = [];

  for (const contact of toRemove) {
    try {
      const result = await detachContact(conversationId, contact.id, adminId);

      if (result.ok) {
        removed.push(contact.id);
      } else {
        // Ej: 422 "Last customer" -- no deberia pasar si keepId
        // se calculo bien, pero lo dejamos registrado por si acaso.
        failed.push({ id: contact.id, status: result.status, body: result.body });
      }
    } catch (err) {
      failed.push({ id: contact.id, error: err.message });
    }
  }

  return {
    status: 'pruned',
    conversation_id: conversationId,
    original_author: { id: originalAuthorId, type: originalAuthorType },
    kept: { id: keepId, reason: keepReason },
    removed,
    failed,
    participant_count_before: participants.length,
    participant_count_after: participants.length - removed.length,
  };
}

module.exports = { pruneParticipants };
