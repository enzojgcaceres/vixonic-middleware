const BASE_URLS = {
  us: 'https://api.intercom.io',
  eu: 'https://api.eu.intercom.io',
  au: 'https://api.au.intercom.io',
};

function getBaseUrl() {
  const region = (process.env.INTERCOM_REGION || 'us').toLowerCase();
  return BASE_URLS[region] || BASE_URLS.us;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.INTERCOM_ACCESS_TOKEN}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Intercom-Version': '2.10',
  };
}

/**
 * Trae la conversacion completa, incluyendo contacts (participantes) y source.author.
 */
async function getConversation(conversationId) {
  const res = await fetch(`${getBaseUrl()}/conversations/${conversationId}`, {
    method: 'GET',
    headers: headers(),
  });

  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(
      `Error al obtener la conversacion ${conversationId}: ${res.status} ${JSON.stringify(body)}`
    );
  }

  return res.json();
}

/**
 * Trae un contacto individual (necesitamos su email para poder filtrar
 * por dominio interno en customerResolver.js -- conversation.contacts.contacts
 * solo trae { type, id }, sin email).
 */
async function getContact(contactId) {
  const res = await fetch(`${getBaseUrl()}/contacts/${contactId}`, {
    method: 'GET',
    headers: headers(),
  });

  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(
      `Error al obtener el contacto ${contactId}: ${res.status} ${JSON.stringify(body)}`
    );
  }

  return res.json();
}

/**
 * Detacha un contacto (customer) de una conversacion grupal.
 * Devuelve la lista actualizada de customers, o null si Intercom
 * responde 422 "Last customer" (no se puede remover al ultimo).
 */
async function detachContact(conversationId, contactId, adminId) {
  const res = await fetch(
    `${getBaseUrl()}/conversations/${conversationId}/customers/${contactId}`,
    {
      method: 'DELETE',
      headers: headers(),
      body: JSON.stringify({ admin_id: adminId }),
    }
  );

  const body = await safeJson(res);

  if (res.status === 422) {
    // "Last customer" u otro conflicto -- no es un error fatal, lo maneja el caller
    return { ok: false, status: 422, body };
  }

  if (!res.ok) {
    throw new Error(
      `Error al detachar contacto ${contactId} de ${conversationId}: ${res.status} ${JSON.stringify(body)}`
    );
  }

  return { ok: true, status: res.status, body };
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

module.exports = { getConversation, getContact, detachContact };
