require('dotenv').config();
const express = require('express');
const { pruneParticipants } = require('./pruneParticipants');

const app = express();
app.use(express.json());

app.post('/intercom/prune-participants', async (req, res) => {
  const apiKey = req.header('x-api-key');
  if (apiKey !== process.env.DATA_CONNECTOR_API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // El body lo arma el Data connector via Attribute Inserter, ej:
  // { "conversation_id": "{{conversation.id}}" }
  const conversationId = req.body?.conversation_id;
  const adminId = process.env.INTERCOM_ADMIN_ID;

  if (!conversationId) {
    return res.status(400).json({ error: 'missing_conversation_id' });
  }

  try {
    const result = await pruneParticipants(conversationId, adminId);
    console.log('[prune-participants]', JSON.stringify(result));

    // Esta forma de respuesta la vas a "Restrict and shape" en el
    // Data connector (Phase 2: Data) para que el Workflow pueda leer
    // participant_count_after y branchear en el success path.
    return res.status(200).json({
      status: result.status,
      participant_count_after: result.participant_count_after ?? null,
      removed: result.removed ?? [],
      failed: result.failed ?? [],
    });
  } catch (err) {
    console.error('[prune-participants] error', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`csat-single-participant escuchando en puerto ${port}`);
});