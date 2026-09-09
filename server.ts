import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const SYSTEM_INSTRUCTION =
  'Você é um especialista em musculação, treinamento de força e nutrição esportiva, com conhecimento equivalente a um educador físico e nutricionista experientes. Responda dúvidas sobre exercícios, técnica de execução, divisão de treino, volume, progressão de carga, macronutrientes, calorias, hipertrofia, emagrecimento e hábitos alimentares de forma clara, prática e baseada em evidências científicas atuais. Explique o raciocínio por trás das recomendações de forma acessível. Sempre que a pergunta envolver lesões, dores, condições de saúde pré-existentes, uso de medicamentos ou suplementos de risco (ex: anabolizantes, termogênicos fortes), oriente o usuário a procurar um médico ou profissional habilitado antes de agir, deixando claro que você não substitui uma avaliação profissional individualizada. Não invente informações; se não tiver certeza, diga isso.';

async function startServer() {
  const app = express();

  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Chat API endpoint using Gemini API
  app.post('/api/chat', async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          error: 'Nenhuma mensagem informada.',
          statusCode: 400,
          message: 'O corpo da requisição deve conter um array "messages" não vazio.',
        });
      }

      const apiKey =
        process.env.GEMINI_API_KEY ||
        process.env.VITE_GEMINI_API_KEY ||
        process.env.API_KEY;

      if (!apiKey || apiKey.trim() === '') {
        console.error('[Gemini API] Chave GEMINI_API_KEY / VITE_GEMINI_API_KEY não encontrada nas variáveis de ambiente.');
        return res.status(500).json({
          error: 'Chave de API não configurada',
          statusCode: 500,
          message:
            'A variável GEMINI_API_KEY ou VITE_GEMINI_API_KEY está ausente ou vazia no ambiente.',
          tip: 'No Vercel (Settings > Environment Variables), adicione VITE_GEMINI_API_KEY e GEMINI_API_KEY com a sua chave do Google AI Studio e faça um novo deploy.',
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

      // Format messages into Gemini format
      const rawTurns = messages
        .filter((m: any) => m && typeof m.content === 'string' && m.content.trim().length > 0 && !m.isError)
        .map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content.trim() }],
        }));

      // Find index of first user turn
      const firstUserIdx = rawTurns.findIndex((t: any) => t.role === 'user');
      if (firstUserIdx === -1) {
        return res.status(400).json({
          error: 'Nenhuma mensagem de usuário encontrada.',
          statusCode: 400,
          message: 'O histórico deve conter pelo menos uma mensagem de usuário.',
        });
      }

      const validTurns = rawTurns.slice(firstUserIdx);

      // Merge consecutive same-role turns
      const contents: { role: string; parts: { text: string }[] }[] = [];
      for (const turn of validTurns) {
        if (contents.length > 0 && contents[contents.length - 1].role === turn.role) {
          contents[contents.length - 1].parts[0].text += `\n\n${turn.parts[0].text}`;
        } else {
          contents.push({ role: turn.role, parts: [{ text: turn.parts[0].text }] });
        }
      }

      // Valid and active models list with fallback priority
      const candidateModels = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-flash-latest',
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
      ];

      let lastError: any = null;
      let reply: string | null | undefined = null;
      let successfulModel = '';

      for (const modelName of candidateModels) {
        try {
          console.log(`[Gemini API] Tentando gerar conteúdo com modelo: ${modelName}`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
            },
          });

          if (response && response.text) {
            reply = response.text;
            successfulModel = modelName;
            console.log(`[Gemini API] Sucesso com modelo: ${modelName}`);
            break;
          }
        } catch (modelErr: any) {
          lastError = modelErr;
          const status = modelErr?.status || modelErr?.statusCode || modelErr?.code || 'desconhecido';
          console.warn(`[Gemini API] Falha no modelo ${modelName} (status ${status}):`, modelErr?.message || modelErr);
          // Continue to next fallback model
        }
      }

      if (!reply) {
        const statusCode = lastError?.status || lastError?.statusCode || 500;
        const rawMessage = lastError?.message || 'Falha ao obter resposta dos modelos do Gemini.';
        console.error('[Gemini API Error] Todos os modelos falharam:', {
          statusCode,
          message: rawMessage,
          modelsAttempted: candidateModels,
        });

        return res.status(typeof statusCode === 'number' ? statusCode : 500).json({
          error: 'Não foi possível obter resposta, tente novamente',
          statusCode: typeof statusCode === 'number' ? statusCode : 500,
          message: rawMessage,
          modelsAttempted: candidateModels,
        });
      }

      return res.json({ reply, modelUsed: successfulModel });
    } catch (err: any) {
      const statusCode = err?.status || err?.statusCode || 500;
      const rawMessage = err?.message || 'Erro ao processar mensagem.';
      console.error('[Gemini API Unexpected Error]:', { statusCode, message: rawMessage, err });

      return res.status(typeof statusCode === 'number' ? statusCode : 500).json({
        error: 'Não foi possível obter resposta, tente novamente',
        statusCode: typeof statusCode === 'number' ? statusCode : 500,
        message: rawMessage,
      });
    }
  });

  // Nutrition estimation API endpoint using Gemini API
  app.post('/api/estimate-nutrition', async (req, res) => {
    try {
      const { text, history } = req.body;
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
          message:
            'A variável GEMINI_API_KEY ou VITE_GEMINI_API_KEY está ausente no ambiente.',
          tip: 'No Vercel (Settings > Environment Variables), adicione VITE_GEMINI_API_KEY com a sua chave.',
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

      // Build conversation contents for Gemini
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
            text: contents.length > 0
              ? text.trim()
              : `Alimento ou refeição: "${text.trim()}". Estime os macronutrientes considerando a marca e tabela nutricional real se especificada, ou faça uma pergunta rápida de esclarecimento sobre a quantidade/ingredientes se não informado. Retorne apenas o JSON.`,
          },
        ],
      });

      const candidateModels = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-flash-latest',
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
      ];

      let lastError: any = null;
      let rawText: string | null | undefined = null;
      let successfulModel = '';

      for (const modelName of candidateModels) {
        try {
          console.log(`[Gemini Nutrition API] Tentando modelo: ${modelName}`);
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
            console.log(`[Gemini Nutrition API] Sucesso com modelo: ${modelName}`);
            break;
          }
        } catch (modelErr: any) {
          lastError = modelErr;
          console.warn(`[Gemini Nutrition API] Falha no modelo ${modelName}:`, modelErr?.message || modelErr);
        }
      }

      if (!rawText) {
        return res.status(500).json({
          error: 'Não foi possível estimar os nutrientes deste alimento.',
          message: lastError?.message || 'Falha ao conectar com o serviço de IA.',
        });
      }

      let cleanJson = rawText.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.warn('[Gemini Nutrition API] Parse JSON falhou, avaliando texto:', cleanJson);
        // Fallback: If output is natural text question
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

      // Check if IA requested clarification
      let isClarification = false;
      let clarificationQuestion = '';

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (
          parsed.type === 'clarification' ||
          (parsed.question && !parsed.items && !parsed.nome) ||
          (parsed.pergunta && !parsed.items && !parsed.nome)
        ) {
          isClarification = true;
          clarificationQuestion = String(parsed.question || parsed.pergunta || '').trim();
        }
      }

      if (isClarification && clarificationQuestion) {
        return res.json({
          type: 'clarification',
          question: clarificationQuestion,
          modelUsed: successfulModel,
        });
      }

      // Parse food items
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
  });

  // Vite middleware in dev, static files in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer();
