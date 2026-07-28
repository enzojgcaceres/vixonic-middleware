const { getConversation, detachContact } = require('./intercomClient');

/**
 * Dada una conversationId, deja UNICAMENTE al autor original (source.author)
 * como customer de la conversacion, detachando via API a todos los demas
 * participantes (los CC'eados).
 *
 * Devuelve un resumen de lo que se hizo, pensado para loguear y para
 * devolver como respuesta al step "Wait for Webhook" del Workflow.
 */
async function pruneParticipants(conversationId, adminId) {
  const conversation = await getConversation(conversationId);

  const originalAuthorId = conversation?.source?.author?.id;
  const originalAuthorType = conversation?.source?.author?.type; // user | lead | contact

  if (!originalAuthorId) {
    return {
      status: 'skipped',
      reason: 'no_source_author',
      conversation_id: conversationId,
    };
  }

  // El campo puede llamarse "contacts" o "customers" segun la version de la API.
  const participants =
    conversation?.contacts?.contacts ||
    conversation?.customers ||
    [];

  if (participants.length <= 1) {
    return {
      status: 'skipped',
      reason: 'single_participant',
      conversation_id: conversationId,
      participant_count: participants.length,
    };
  }

  const toRemove = participants.filter((p) => p.id !== originalAuthorId);
  const removed = [];
  const failed = [];

  for (const contact of toRemove) {
    try {
      const result = await detachContact(conversationId, contact.id, adminId);

      if (result.ok) {
        removed.push(contact.id);
      } else {
        // Ej: 422 "Last customer" -- no deberia pasar si originalAuthorId
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
    removed,
    failed,
    participant_count_before: participants.length,
    participant_count_after: participants.length - removed.length,
  };
}

module.exports = { pruneParticipants };
