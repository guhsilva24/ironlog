/**
 * Gemini AI Client Service
 *
 * Suporta arquitetura híbrida:
 * 1. Tenta o endpoint de backend (/api/chat ou /api/estimate-nutrition).
 * 2. Se o endpoint retornar 404 (típico no Vercel quando rodando como SPA estático sem serverless),
 *    faz fallback automático para chamada direta à API REST do Google Gemini (v1beta)
 *    usando a chave VITE_GEMINI_API_KEY configurada nas variáveis de ambiente.
 */

export const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

export const CHAT_SYSTEM_INSTRUCTION =
  'Você é um especialista em musculação, treinamento de força e nutrição esportiva, com conhecimento equivalente a um educador físico e nutricionista experientes. Responda dúvidas sobre exercícios, técnica de execução, divisão de treino, volume, progressão de carga, macronutrientes, calorias, hipertrofia, emagrecimento e hábitos alimentares de forma clara, prática e baseada em evidências científicas atuais. Explique o raciocínio por trás das recomendações de forma acessível. Sempre que a pergunta envolver lesões, dores, condições de saúde pré-existentes, uso de medicamentos ou suplementos de risco (ex: anabolizantes, termogênicos fortes), oriente o usuário a procurar um médico ou profissional habilitado antes de agir, deixando claro que você não substitui uma avaliação profissional individualizada. Não invente informações; se não tiver certeza, diga isso.';

export const NUTRITION_SYSTEM_INSTRUCTION = `Você é um nutricionista especialista em tabela de composição de alimentos e cálculo de macronutrientes.
Você tem conhecimento amplo sobre culinária regional brasileira (Norte/Manaus, Nordeste, Centro-Oeste, Sudeste e Sul), pratos internacionais e produtos industrializados comuns no Brasil.

1. Pratos e Culinária Regional:
Ao receber o nome de um prato ou alimento regional (ex: caboquinho, tacacá, tambaqui assado, x-caboquinho, baião de dois, açaí com farinha, pamonha, vatapá, etc.), use seu conhecimento sobre os ingredientes típicos dessa preparação na região de origem para estimar os macronutrientes com a maior precisão possível, considerando o modo de preparo tradicional. Se o nome do prato for ambíguo, variar muito de preparo entre regiões, ou você não tiver certeza suficiente para estimar com confiança, faça uma pergunta rápida de esclarecimento ao usuário antes de gerar os valores. Sempre priorize precisão regional sobre suposições genéricas.

2. Marcas e Produtos Industrializados:
Quando o usuário mencionar uma marca específica de produto industrializado (ex: manteiga Deline, leite Itálac, iogurte Nestlé, pão Pullman, entre outras marcas comuns no Brasil), utilize seu conhecimento sobre a tabela nutricional real e a porção padrão informada na embalagem desse produto específico para estimar os macronutrientes, em vez de usar um valor genérico da categoria do alimento. Considere o tamanho de porção típico informado na embalagem (ex: 1 colher de sopa = 10g de manteiga, 1 copo = 200ml de leite) ao calcular, a menos que o usuário informe uma quantidade diferente. Se você não tiver certeza sobre os valores exatos de uma marca específica, informe isso claramente ao usuário nos itens gerados (por exemplo, adicionando no campo "observacao" o texto 'estimativa aproximada, marca não confirmada com certeza') em vez de apresentar os números como se fossem exatos. Se possível, pergunte a quantidade consumida (colheres, copos, gramas, unidades) quando o usuário não informar, antes de gerar os valores finais.

Regras de Formato da Resposta:
Retorne SEMPRE E OBRIGATORIAMENTE um JSON puro com uma das duas estruturas abaixo:

CASO 1: Se você tiver dados suficientes sobre o alimento e quantidade para estimar com boa precisão:
{
  "type": "estimate",
  "items": [
    {
      "nome": "string (nome claro do alimento com a marca informada se houver, ex: 'Manteiga Deline', 'Leite Integral Itálac')",
      "quantidade": "string (quantidade consumida ou porção com peso/volume aproximado, ex: '1 colher de sopa (10g)', '1 copo (200ml)', '2 fatias (50g)')",
      "calorias": number (número inteiro de calorias em kcal),
      "proteina_g": number (número em gramas),
      "carboidrato_g": number (número em gramas),
      "gordura_g": number (número em gramas),
      "observacao": "string opcional (ex: 'Tabela oficial Deline' ou 'estimativa aproximada, marca não confirmada com certeza')"
    }
  ]
}

CASO 2: Se o usuário não informou a quantidade consumida, se a marca ou prato necessitar de esclarecimento rápido sobre quantidade/ingredientes:
{
  "type": "clarification",
  "question": "string com a pergunta de esclarecimento rápida e amigável ao usuário (ex: 'Quantas colheres de sopa de manteiga Deline você consumiu?', 'Quantos copos ou ml de leite Itálac você tomou?')"
}

Importante:
- Se houver histórico anterior com o esclarecimento do usuário, use essas informações para gerar o CASO 1 ("estimate") com precisão.
- Retorne APENAS o JSON válido, sem texto introdutório, sem explicações fora do JSON e sem blocos markdown desnecessários.
- Os campos "calorias", "proteina_g", "carboidrato_g" e "gordura_g" devem ser números, nunca strings nem null.`;

/**
 * Obtém a chave do Gemini configurada no ambiente cliente (Vite)
 */
export function getClientGeminiApiKey(): string | null {
  const env = (import.meta as any).env || {};
  if (env.VITE_GEMINI_API_KEY && typeof env.VITE_GEMINI_API_KEY === 'string' && env.VITE_GEMINI_API_KEY.trim().length > 0) {
    return env.VITE_GEMINI_API_KEY.trim();
  }
  const genericKey = env.GEMINI_API_KEY;
  if (genericKey && typeof genericKey === 'string' && genericKey.trim().length > 0) {
    return genericKey.trim();
  }
  return null;
}

/**
 * Chama diretamente a API do Google Gemini (v1beta REST) no navegador
 */
async function callGeminiDirectRest(params: {
  contents: { role: string; parts: { text: string }[] }[];
  systemInstruction?: string;
  responseMimeType?: string;
}): Promise<{ text: string; modelUsed: string }> {
  const apiKey = getClientGeminiApiKey();

  if (!apiKey) {
    throw new Error(
      'Chave de API não configurada. Adicione a variável VITE_GEMINI_API_KEY no painel da Vercel (Settings > Environment Variables) e faça um novo deploy.'
    );
  }

  let lastError: any = null;
  const attemptedModels: string[] = [];

  for (const model of CANDIDATE_MODELS) {
    attemptedModels.push(model);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const bodyPayload: any = {
      contents: params.contents,
    };

    if (params.systemInstruction) {
      bodyPayload.systemInstruction = {
        parts: [{ text: params.systemInstruction }],
      };
    }

    if (params.responseMimeType) {
      bodyPayload.generationConfig = {
        responseMimeType: params.responseMimeType,
      };
    }

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!resp.ok) {
        let errJson: any = null;
        let errText = '';
        try {
          errJson = await resp.json();
        } catch {
          errText = await resp.text().catch(() => '');
        }

        const msg =
          errJson?.error?.message ||
          errJson?.message ||
          errText ||
          `HTTP ${resp.status} ${resp.statusText}`;

        lastError = new Error(`[Modelo ${model}]: Status ${resp.status} - ${msg}`);
        (lastError as any).status = resp.status;
        (lastError as any).googleError = errJson?.error;
        console.warn(`[Gemini Direct API] Falha no modelo ${model}:`, msg);
        continue; // Try next model
      }

      const data = await resp.json();
      const candidate = data?.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text;

      if (!text && text !== '') {
        throw new Error(`Resposta do modelo ${model} não continha texto válido.`);
      }

      return { text, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini Direct API] Erro ao chamar modelo ${model}:`, err?.message || err);
    }
  }

  const detailedMsg = lastError?.message || 'Todos os modelos falharam na API do Gemini.';
  throw new Error(
    `${detailedMsg}\n\nModelos testados: ${attemptedModels.join(
      ', '
    )}\nVerifique se sua chave da Vercel (VITE_GEMINI_API_KEY) está ativa e possui acesso à API do Gemini.`
  );
}

/**
 * Envia mensagens do chat para /api/chat ou fallback direto ao Gemini
 */
export async function sendChatMessage(messages: { role: string; content: string }[]): Promise<{
  reply: string;
  modelUsed?: string;
}> {
  // 1. Tentar primeiro o backend /api/chat
  let backend404 = false;
  let backendError: any = null;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.reply) {
        return { reply: data.reply, modelUsed: data.modelUsed };
      }
      throw new Error(data.error || 'Resposta vazia da API');
    }

    if (response.status === 404) {
      backend404 = true;
    }

    let errorData: any = null;
    try {
      errorData = await response.json();
    } catch {
      const txt = await response.text().catch(() => '');
      errorData = { message: txt };
    }

    backendError = {
      status: response.status,
      message: errorData?.message || errorData?.error || response.statusText,
      modelsAttempted: errorData?.modelsAttempted,
      tip: errorData?.tip,
    };
  } catch (netErr: any) {
    backendError = {
      status: 'Network',
      message: netErr?.message || 'Falha na conexão com o servidor local.',
    };
    backend404 = true;
  }

  // 2. Se o backend retornou 404 (Vercel SPA sem serverless) ou falhou por rede,
  // tenta a chamada direta do cliente ao Google Gemini
  if (backend404) {
    const clientKey = getClientGeminiApiKey();
    if (clientKey) {
      console.info(
        '[IronLog Gemini] Endpoint /api/chat indisponível (404). Executando via API direta do Google com VITE_GEMINI_API_KEY...'
      );

      // Formatar mensagens para o Gemini
      const rawTurns = messages
        .filter((m) => m && typeof m.content === 'string' && m.content.trim().length > 0)
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content.trim() }],
        }));

      const firstUserIdx = rawTurns.findIndex((t) => t.role === 'user');
      const validTurns = firstUserIdx !== -1 ? rawTurns.slice(firstUserIdx) : rawTurns;

      const contents: { role: string; parts: { text: string }[] }[] = [];
      for (const turn of validTurns) {
        if (contents.length > 0 && contents[contents.length - 1].role === turn.role) {
          contents[contents.length - 1].parts[0].text += `\n\n${turn.parts[0].text}`;
        } else {
          contents.push({ role: turn.role, parts: [{ text: turn.parts[0].text }] });
        }
      }

      const directRes = await callGeminiDirectRest({
        contents,
        systemInstruction: CHAT_SYSTEM_INSTRUCTION,
      });

      return { reply: directRes.text, modelUsed: directRes.modelUsed };
    } else {
      throw new Error(
        'O endpoint do servidor (/api/chat) retornou 404 e a variável VITE_GEMINI_API_KEY não foi encontrada nas variáveis de ambiente.\n\n' +
          '👉 Como resolver no Vercel:\n' +
          '1. Acesse o painel do seu projeto no Vercel (Settings > Environment Variables).\n' +
          '2. Adicione uma nova variável chamada exatamente: VITE_GEMINI_API_KEY\n' +
          '3. Cole sua chave obtida no Google AI Studio (começa com "AIzaSy...").\n' +
          '4. Selecione os ambientes Production, Preview e Development.\n' +
          '5. Vá em "Deployments" e faça um "Redeploy" para aplicar a variável.'
      );
    }
  }

  // Se o backend deu outro erro (não 404), lança com todos os detalhes
  const details = backendError?.modelsAttempted
    ? `\nModelos testados: ${backendError.modelsAttempted.join(', ')}`
    : '';
  const tip = backendError?.tip ? `\n💡 Dica: ${backendError.tip}` : '';
  throw new Error(`Erro na API Gemini (Status ${backendError?.status}): ${backendError?.message}${details}${tip}`);
}

/**
 * Envia descrição de alimento para estimativa nutricional com fallback
 */
export async function estimateNutrition(params: {
  text: string;
  history?: { role: string; content: string }[];
}): Promise<any> {
  let backend404 = false;
  let backendError: any = null;

  try {
    const response = await fetch('/api/estimate-nutrition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (response.ok) {
      return await response.json();
    }

    if (response.status === 404) {
      backend404 = true;
    }

    let errorData: any = null;
    try {
      errorData = await response.json();
    } catch {
      const txt = await response.text().catch(() => '');
      errorData = { message: txt };
    }

    backendError = {
      status: response.status,
      message: errorData?.message || errorData?.error || response.statusText,
      tip: errorData?.tip,
    };
  } catch (netErr: any) {
    backendError = {
      status: 'Network',
      message: netErr?.message || 'Falha na conexão com o servidor local.',
    };
    backend404 = true;
  }

  if (backend404) {
    const clientKey = getClientGeminiApiKey();
    if (clientKey) {
      console.info(
        '[IronLog Gemini] Endpoint /api/estimate-nutrition indisponível (404). Executando via API direta do Google com VITE_GEMINI_API_KEY...'
      );

      const contents: { role: string; parts: { text: string }[] }[] = [];
      if (Array.isArray(params.history) && params.history.length > 0) {
        for (const turn of params.history) {
          if (turn && typeof turn.content === 'string' && turn.content.trim().length > 0) {
            contents.push({
              role: turn.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: turn.content.trim() }],
            });
          }
        }
      }

      contents.push({
        role: 'user',
        parts: [
          {
            text:
              contents.length > 0
                ? params.text.trim()
                : `Alimento ou refeição: "${params.text.trim()}". Estime os macronutrientes considerando a marca e tabela nutricional real se especificada, ou faça uma pergunta rápida de esclarecimento sobre a quantidade/ingredientes se não informado. Retorne apenas o JSON.`,
          },
        ],
      });

      const directRes = await callGeminiDirectRest({
        contents,
        systemInstruction: NUTRITION_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
      });

      let cleanJson = directRes.text.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(cleanJson);
      } catch {
        if (cleanJson.includes('?') || cleanJson.length < 350) {
          return {
            type: 'clarification',
            question: cleanJson.replace(/^["']|["']$/g, '').trim(),
            modelUsed: directRes.modelUsed,
          };
        }
        throw new Error('Formato de resposta retornado pela IA não é um JSON válido.');
      }

      // Check clarification
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (
          parsed.type === 'clarification' ||
          (parsed.question && !parsed.items && !parsed.nome) ||
          (parsed.pergunta && !parsed.items && !parsed.nome)
        ) {
          return {
            type: 'clarification',
            question: String(parsed.question || parsed.pergunta || '').trim(),
            modelUsed: directRes.modelUsed,
          };
        }
      }

      let rawItems: any[] = [];
      if (Array.isArray(parsed)) {
        rawItems = parsed;
      } else if (Array.isArray(parsed.items)) {
        rawItems = parsed.items;
      } else if (parsed && typeof parsed === 'object' && (parsed.nome || parsed.name)) {
        rawItems = [parsed];
      }

      if (rawItems.length === 0) {
        if (parsed?.question || parsed?.pergunta) {
          return {
            type: 'clarification',
            question: String(parsed.question || parsed.pergunta).trim(),
            modelUsed: directRes.modelUsed,
          };
        }
        throw new Error('Nenhum alimento identificado. Tente detalhar melhor a porção ou marca.');
      }

      const items = rawItems.map((item: any) => ({
        nome: String(item.nome || item.name || 'Alimento').trim(),
        quantidade: String(item.quantidade || item.quantity || '1 porção').trim(),
        calorias: Math.max(0, Math.round(Number(item.calorias ?? item.calories) || 0)),
        proteina_g: Math.max(0, Math.round(Number(item.proteina_g ?? item.protein) || 0)),
        carboidrato_g: Math.max(0, Math.round(Number(item.carboidrato_g ?? item.carbs) || 0)),
        gordura_g: Math.max(0, Math.round(Number(item.gordura_g ?? item.fat) || 0)),
        observacao: item.observacao ? String(item.observacao).trim() : (item.notes ? String(item.notes).trim() : undefined),
      }));

      return {
        type: 'estimate',
        items,
        modelUsed: directRes.modelUsed,
      };
    } else {
      throw new Error(
        'O endpoint do servidor (/api/estimate-nutrition) retornou 404 e a variável VITE_GEMINI_API_KEY não foi encontrada nas variáveis de ambiente.\n\n' +
          '👉 Como resolver no Vercel:\n' +
          '1. Acesse o painel do seu projeto no Vercel (Settings > Environment Variables).\n' +
          '2. Adicione a variável: VITE_GEMINI_API_KEY com sua chave do Google AI Studio.\n' +
          '3. Faça um novo deploy ("Redeploy") para que o Vite compile a chave em produção.'
      );
    }
  }

  const tip = backendError?.tip ? `\n💡 Dica: ${backendError.tip}` : '';
  throw new Error(`Erro na API Gemini (Status ${backendError?.status}): ${backendError?.message}${tip}`);
}
