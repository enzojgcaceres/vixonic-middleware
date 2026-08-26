require('dotenv').config();
const { getConversation, getContact } = require('../src/intercomClient');
const { resolveCustomerToKeep, getInternalDomains } = require('../src/customerResolver');

async function main() {
  const conversationId = process.argv[2];

  if (!conversationId) {
    console.error('Uso: node scripts/dry-run.js <conversation_id>');
    process.exit(1);
  }

  const conversation = await getConversation(conversationId);

  const originalAuthor = conversation?.source?.author;
  const participants =
    conversation?.contacts?.contacts || conversation?.customers || [];

  console.log('--- DRY RUN (no se ejecuta ningun DELETE) ---');
  console.log('Conversation ID:', conversationId);
  console.log('Autor original (source.author):', originalAuthor);
  console.log('Dominios internos configurados (INTERNAL_DOMAINS):', getInternalDomains());
  console.log('Total de participantes:', participants.length);

  if (participants.length <= 1) {
    console.log('\nUn solo participante, no hay nada para podar.');
    return;
  }

  const participantsWithEmail = await Promise.all(
    participants.map(async (p) => {
      try {
        const contact = await getContact(p.id);
        return { ...p, email: contact?.email || null };
      } catch (err) {
        console.error(`  ⚠️  no se pudo obtener el email de ${p.id}: ${err.message}`);
        return { ...p, email: undefined };
      }
    })
  );

  console.log('Participantes:');
  participantsWithEmail.forEach((p) =>
    console.log(`  - ${p.id} (${p.type || 'sin tipo'}) ${p.email || '(sin email)'}`)
  );

  const decision = resolveCustomerToKeep(participantsWithEmail, originalAuthor?.id);

  if (decision.none) {
    console.log(`\n⚠️  Ningun contacto externo (${decision.reason}). Revisar manualmente antes de correr el flujo real.`);
    return;
  }

  if (decision.ambiguous) {
    console.log(`\n⚠️  Ambiguo (${decision.reason}), hay mas de un contacto externo candidato:`);
    decision.candidates.forEach((id) => console.log(`  - ${id}`));
    console.log('Revisar manualmente antes de correr el flujo real.');
    return;
  }

  const wouldRemove = participantsWithEmail.filter((p) => p.id !== decision.keepId);

  console.log('\nSe removerian estos contact_id si corrieramos el flujo real:');
  wouldRemove.forEach((p) => console.log(`  - ${p.id} (${p.type || 'sin tipo'})`));

  console.log(`\nQuedaria como unico participante: ${decision.keepId} (motivo: ${decision.keepReason})`);
}

main().catch((err) => {
  console.error('Error en dry-run:', err.message);
  process.exit(1);
});
