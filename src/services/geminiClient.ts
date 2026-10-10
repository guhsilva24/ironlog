/**
 * Gemini AI Client Service
 *
 * Segurança total:
 * - A chave de API NUNCA é exposta ou acessada no cliente (sem VITE_GEMINI_API_KEY).
 * - Todas as requisições passam exclusivamente pelos endpoints serverless /api/chat e /api/estimate-nutrition.
 * - Em caso de erro, o status HTTP e o corpo completo retornado pelo servidor/Google são preservados e exibidos sem cortes.
 */

/**
 * Lê com segurança o corpo de texto bruto da resposta HTTP sem quebrar o stream.
 */
async function readResponseBodySafe(response: Response): Promise<{ rawText: string; json: any | null }> {
  try {
    const rawText = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(rawText);
    } catch {}
    return { rawText, json };
  } catch (err: any) {
    return { rawText: `[Falha ao ler resposta da rede: ${err?.message || err}]`, json: null };
  }
}

/**
 * Envia mensagens do chat para o endpoint serverless /api/chat
 */
export async function sendChatMessage(
  messages: { role: string; content: string }[],
  context?: string
): Promise<{
  reply: string;
  modelUsed?: string;
  attempts?: string[];
}> {
  console.log('[Chat Client] Enviando mensagem para /api/chat...');

  let response: Response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, context }),
    });
  } catch (netErr: any) {
    console.error('[Chat Client] Erro de rede ao conectar com /api/chat:', netErr);
    throw new Error(
      `Sem conexão com o servidor (/api/chat).\n` +
      `Verifique sua conexão com a internet ou se o backend está em execução.`
    );
  }

  const { rawText, json: responseData } = await readResponseBodySafe(response);

  if (response.ok) {
    if (responseData?.reply) {
      return {
        reply: responseData.reply,
        modelUsed: responseData.modelUsed,
        attempts: responseData.attempts,
      };
    }
    throw new Error(`Resposta OK do servidor sem campo 'reply':\n${rawText}`);
  }

  // Tratamento completo do erro: status + corpo completo sem cortes
  const fullBodyDisplay =
    responseData?.message ||
    responseData?.error ||
    (responseData ? JSON.stringify(responseData, null, 2) : '') ||
    rawText ||
    `HTTP ${response.status} ${response.statusText || 'Erro sem mensagem'}`;

  const formattedError = `[Google Gemini API Error (Status ${response.status})]\n${fullBodyDisplay}`;
  console.error('[Chat Client Erro]', { status: response.status, rawText, responseData });

  throw new Error(formattedError);
}

/**
 * Envia descrição de alimento para o endpoint serverless /api/estimate-nutrition
 */
export async function estimateNutrition(params: {
  text: string;
  history?: { role: string; content: string }[];
}): Promise<any> {
  console.log('[Nutrition Client] Enviando alimento para /api/estimate-nutrition...');

  let response: Response;
  try {
    response = await fetch('/api/estimate-nutrition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (netErr: any) {
    console.error('[Nutrition Client] Erro de rede ao conectar com /api/estimate-nutrition:', netErr);
    throw new Error(
      `Sem conexão com o servidor (/api/estimate-nutrition).\n` +
      `Verifique sua conexão com a internet ou se o backend está em execução.`
    );
  }

  const { rawText, json: responseData } = await readResponseBodySafe(response);

  if (response.ok && responseData) {
    return responseData;
  }

  const fullBodyDisplay =
    responseData?.message ||
    responseData?.error ||
    (responseData ? JSON.stringify(responseData, null, 2) : '') ||
    rawText ||
    `HTTP ${response.status} ${response.statusText || 'Erro sem mensagem'}`;

  const formattedError = `[Google Gemini Nutrition Error (Status ${response.status})]\n${fullBodyDisplay}`;
  console.error('[Nutrition Client Erro]', { status: response.status, rawText, responseData });

  throw new Error(formattedError);
}
