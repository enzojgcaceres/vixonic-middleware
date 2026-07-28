require('dotenv').config();
const { pruneParticipants } = require('../src/pruneParticipants');

async function main() {
  const conversationId = process.argv[2];
  const confirmFlag = process.argv[3];

  if (!conversationId) {
    console.error('Uso: node scripts/run-real.js <conversation_id> --confirm');
    process.exit(1);
  }

  if (confirmFlag !== '--confirm') {
    console.error(
      '\n⚠️  Esto va a ejecutar DELETE real contra la API de Intercom.\n' +
      'Si ya corriste el dry-run y confirmaste que el resultado es correcto,\n' +
      `volve a correr: node scripts/run-real.js ${conversationId} --confirm\n`
    );
    process.exit(1);
  }

  const adminId = process.env.INTERCOM_ADMIN_ID;
  if (!adminId) {
    console.error('Falta INTERCOM_ADMIN_ID en .env');
    process.exit(1);
  }

  const result = await pruneParticipants(conversationId, adminId);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});