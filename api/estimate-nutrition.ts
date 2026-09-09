import { GoogleGenAI } from '@google/genai';

const NUTRITION_SYSTEM_INSTRUCTION = `Você é um nutricionista especialista em tabela de composição de alimentos e cálculo de macronutrientes.
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

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // use raw body
      }
    }

    const { text, history } = body || {};
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Descrição do alimento não informada.',
        message: 'Por favor, descreva o que você comeu.',
      });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      process.env.API_KEY;

    if (!apiKey || apiKey.trim() === '') {
      return res.status(500).json({
        error: 'Chave de API não configurada',
        message: 'A variável GEMINI_API_KEY ou VITE_GEMINI_API_KEY está ausente no ambiente.',
        tip: 'No Vercel (Settings > Environment Variables), cadastre VITE_GEMINI_API_KEY com sua chave.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const contents: { role: string; parts: { text: string }[] }[] = [];
    if (Array.isArray(history) && history.length > 0) {
      for (const turn of history) {
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
              ? text.trim()
              : `Alimento ou refeição: "${text.trim()}". Estime os macronutrientes considerando a marca e tabela nutricional real se especificada, ou faça uma pergunta rápida de esclarecimento sobre a quantidade/ingredientes se não informado. Retorne apenas o JSON.`,
        },
      ],
    });

    let lastError: any = null;
    let rawText: string | null | undefined = null;
    let successfulModel = '';

    for (const modelName of CANDIDATE_MODELS) {
      try {
        console.log(`[Gemini Nutrition - Vercel] Tentando modelo: ${modelName}`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: NUTRITION_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
          },
        });

        if (response && response.text) {
          rawText = response.text;
          successfulModel = modelName;
          console.log(`[Gemini Nutrition - Vercel] Sucesso com modelo: ${modelName}`);
          break;
        }
      } catch (modelErr: any) {
        lastError = modelErr;
        console.warn(`[Gemini Nutrition - Vercel] Falha no modelo ${modelName}:`, modelErr?.message || modelErr);
      }
    }

    if (!rawText) {
      return res.status(500).json({
        error: 'Não foi possível estimar os nutrientes deste alimento.',
        message: lastError?.message || 'Falha ao conectar com o serviço de IA.',
        modelsAttempted: CANDIDATE_MODELS,
      });
    }

    let cleanJson = rawText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      if (cleanJson.includes('?') || cleanJson.length < 350) {
        return res.json({
          type: 'clarification',
          question: cleanJson.replace(/^["']|["']$/g, '').trim(),
          modelUsed: successfulModel,
        });
      }
      return res.status(500).json({
        error: 'Formato de resposta inválido retornado pela IA.',
        message: 'Tente descrever o alimento de outra forma.',
      });
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (
        parsed.type === 'clarification' ||
        (parsed.question && !parsed.items && !parsed.nome) ||
        (parsed.pergunta && !parsed.items && !parsed.nome)
      ) {
        return res.json({
          type: 'clarification',
          question: String(parsed.question || parsed.pergunta || '').trim(),
          modelUsed: successfulModel,
        });
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
        return res.json({
          type: 'clarification',
          question: String(parsed.question || parsed.pergunta).trim(),
          modelUsed: successfulModel,
        });
      }

      return res.status(400).json({
        error: 'Nenhum alimento identificado.',
        message: 'Tente descrever o alimento com mais detalhes (ex: "200g de frango grelhado").',
      });
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

    return res.json({
      type: 'estimate',
      items,
      modelUsed: successfulModel,
    });
  } catch (err: any) {
    console.error('[Gemini Nutrition API Unexpected Error]:', err);
    return res.status(500).json({
      error: 'Erro ao processar estimativa nutricional.',
      message: err?.message || 'Tente descrever o alimento de outra forma.',
    });
  }
}
