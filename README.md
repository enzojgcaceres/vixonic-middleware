# CSAT Single Participant

Middleware que remueve (detacha) a los participantes CC'eados de una
conversacion de Intercom, dejando unicamente al autor original, para que
el step nativo de "Send CSAT" en un Workflow pueda enviarle la encuesta
sin ambiguedad.

## Por que existe esto

Intercom no envia CSAT cuando una conversacion tiene mas de un
participante -- no tiene forma nativa de decidir a cual de todos
mandarle la encuesta. Este servicio resuelve eso quedandose solo con el
`source.author` original (quien escribio el mail que inicio la
conversacion) justo antes de que el Workflow dispare el CSAT.

## Endpoint principal

```
POST /intercom/prune-participants
Headers:
  x-webhook-secret: <WEBHOOK_SHARED_SECRET>
  idempotency-key: <lo que mande Intercom>
Body:
  { "data": { "conversation_id": "191212" } }
```

Devuelve:
```json
{ "status": "pruned", "participant_count_after": 1 }
```

`status` puede ser `pruned`, `skipped` (ya tenia 1 solo participante, o
no se pudo identificar al autor original), o hay error 4xx/5xx.

## Setup local

```bash
cp .env.example .env
# completar INTERCOM_ACCESS_TOKEN, INTERCOM_ADMIN_ID, WEBHOOK_SHARED_SECRET
npm install
npm run dev
```

## Deploy en Render

1. Repo nuevo (o subcarpeta) con este codigo.
2. Render > New > Web Service > conectar el repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Variables de entorno: copiar las de `.env.example` con los valores reales.
6. Confirmar `INTERCOM_ADMIN_ID` corresponde a un admin con el permiso
   **"Can manage conversation participants"** habilitado
   (Settings > Workspace > Teammates > [admin] > Permissions).

## Configuracion en el Workflow de Intercom

Requiere plan **Advanced o superior** (el step "Wait for Webhook" no
esta disponible en planes inferiores). Confirmar esto en la cuenta del
cliente antes de avanzar.

1. Editar el Workflow que hoy intenta enviar el CSAT.
2. Insertar un step **"Wait for Webhook"** *antes* del step de "Send CSAT
   Survey" (o antes del step de cierre que lo dispara).
3. Copiar la Webhook URL que te da Intercom en ese step (no la de tu
   servicio -- Intercom genera una URL propia que vos vas a llamar
   *desde* tu servidor para devolverle la respuesta).
4. Configurar el "Example request" con el shape:
   ```json
   { "status": "pruned", "participant_count_after": 1 }
   ```
   Este shape tiene que calzar exacto con lo que devuelve
   `src/index.js` o el Workflow no va a poder leer los campos.
5. En el payload que Intercom manda a tu endpoint (`data.conversation_id`),
   verificar el nombre real del campo una vez que hagas el primer test --
   puede variar levemente segun como armes el step.
6. Despues del step "Wait for Webhook", agregar una condicion:
   `participant_count_after es 1` -> continuar a "Send CSAT Survey".
   Si no es 1, rama alternativa (loguear / notificar a un humano) en vez
   de intentar el CSAT igual.

## Cosas a verificar antes de ir a produccion

- [ ] Confirmar plan del workspace soporta "Wait for Webhook".
- [ ] Confirmar `admin_id` tiene el permiso de gestionar participantes.
- [ ] Probar con una conversacion real de 2 y de 3+ participantes.
- [ ] Confirmar que remover a los CC'eados justo antes del cierre no
      genera reclamos (dejan de ver respuestas futuras si el cliente no
      los vuelve a CC'ear).
- [ ] Revisar logs (`console.log` en `pruneParticipants`) durante la
      primera semana para detectar `failed` inesperados (ej. 422 "Last
      customer" si el `source.author` no se identifico bien).
