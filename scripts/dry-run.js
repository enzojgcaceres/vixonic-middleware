require('dotenv').config();
const { getConversation } = require('../src/intercomClient');

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
  console.log('Total de participantes:', participants.length);
  console.log('Participantes:', participants);

  if (!originalAuthor) {
    console.log('\n⚠️  No se pudo identificar source.author. Revisar manualmente antes de correr el flujo real.');
    return;
  }

  const wouldRemove = participants.filter((p) => p.id !== originalAuthor.id);

  console.log('\nSe removerian estos contact_id si corrieramos el flujo real:');
  wouldRemove.forEach((p) => console.log(`  - ${p.id} (${p.type || 'sin tipo'})`));

  console.log(`\nQuedaria como unico participante: ${originalAuthor.id}`);
}

main().catch((err) => {
  console.error('Error en dry-run:', err.message);
  process.exit(1);
});
