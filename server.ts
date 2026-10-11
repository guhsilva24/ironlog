import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  CHAT_SYSTEM_INSTRUCTION,
  NUTRITION_SYSTEM_INSTRUCTION,
  NUTRITION_RESPONSE_SCHEMA,
  generateContentWithRetry,
  getServerApiKey,
} from './api/_gemini';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

async function startServer() {
  const app = express();

  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Chat API endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, context } = req.body;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          error: 'Nenhuma mensagem informada.',
          statusCode: 400,
          message: 'O corpo da requisição deve conter um array "messages" não vazio.',
        });
      }

      const apiKey = getServerApiKey();
      if (!apiKey) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY não configurada no servidor',
          statusCode: 500,
          message: 'GEMINI_API_KEY não configurada no servidor',
        });
      }

      const rawTurns = messages
        .filter((m: any) => m && typeof m.content === 'string' && m.content.trim().length > 0 && !m.isError)
        .map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content.trim() }],
        }));

      const firstUserIdx = rawTurns.findIndex((t: any) => t.role === 'user');
      if (firstUserIdx === -1) {
        return res.status(400).json({
          error: 'Nenhuma mensagem de usuário encontrada.',
          statusCode: 400,
          message: 'O histórico deve conter pelo menos uma mensagem de usuário.',
        });
      }

      const validTurns = rawTurns.slice(firstUserIdx);
      const contents: { role: string; parts: { text: string }[] }[] = [];
      for (const turn of validTurns) {
        if (contents.length > 0 && contents[contents.length - 1].role === turn.role) {
          contents[contents.length - 1].parts[0].text += `\n\n${turn.parts[0].text}`;
        } else {
          contents.push({ role: turn.role, parts: [{ text: turn.parts[0].text }] });
        }
      }

      let effectiveSystemInstruction = CHAT_SYSTEM_INSTRUCTION;
      if (context && typeof context === 'string' && context.trim().length > 0) {
        effectiveSystemInstruction = `${CHAT_SYSTEM_INSTRUCTION}\n\nA seguir estão os dados reais do usuário registrados no app. Use-os para responder de forma personalizada. Se faltarem dados para concluir algo, diga isso em vez de supor. Dados do usuário: ${context.trim()}`;
      }

      const result = await generateContentWithRetry({
        apiKey,
        contents,
        systemInstruction: effectiveSystemInstruction,
      });

      return res.json({
        reply: result.text,
        modelUsed: result.modelUsed,
        attempts: result.attempts,
      });
    } catch (err: any) {
      const rawStatus = err?.status || err?.statusCode || err?.code;
      const statusCode = typeof rawStatus === 'number' && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
      const fullMessage =
        err?.error?.message ||
        err?.message ||
        (typeof err === 'object' ? JSON.stringify(err, null, 2) : String(err));

      console.error('[Express Chat Error]:', { statusCode, message: fullMessage });
      return res.status(statusCode).json({
        error: 'Erro na API do Google Gemini',
        statusCode,
        message: fullMessage,
      });
    }
  });

  // Nutrition estimation API endpoint
  app.post('/api/estimate-nutrition', async (req, res) => {
    try {
      const { text, history } = req.body;
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({
          error: 'Descrição do alimento não informada.',
          statusCode: 400,
          message: 'Por favor, descreva o que você comeu.',
        });
      }

      const apiKey = getServerApiKey();
      if (!apiKey) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY não configurada no servidor',
          statusCode: 500,
          message: 'GEMINI_API_KEY não configurada no servidor',
        });
      }

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
                : `Alimento ou refeição: "${text.trim()}". Estime os macronutrientes considerando a marca e tabela nutricional real se especificada, ou faça uma pergunta rápida de esclarecimento sobre a quantidade/ingredientes se não informado.`,
          },
        ],
      });

      const result = await generateContentWithRetry({
        apiKey,
        contents,
        systemInstruction: NUTRITION_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: NUTRITION_RESPONSE_SCHEMA,
        temperature: 0.1,
      });

      let cleanJson = result.text.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      }

      let parsed: any = null;
      try {
        parsed = JSON.parse(cleanJson);
      } catch {
        if (cleanJson.includes('?') && cleanJson.length < 350) {
          return res.json({
            type: 'clarification',
            question: cleanJson.replace(/^["']|["']$/g, '').trim(),
            modelUsed: result.modelUsed,
          });
        }

        try {
          const retryContents = [
            ...contents,
            { role: 'model', parts: [{ text: cleanJson }] },
            {
              role: 'user',
              parts: [
                {
                  text: 'A resposta anterior não é um JSON válido. Retorne EXCLUSIVAMENTE o objeto JSON válido correspondente ao schema especificado, sem formatação markdown ou texto adicional.',
                },
              ],
            },
          ];

          const retryResult = await generateContentWithRetry({
            apiKey,
            contents: retryContents,
            systemInstruction: NUTRITION_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: NUTRITION_RESPONSE_SCHEMA,
            temperature: 0.1,
          });

          let retryClean = retryResult.text.trim();
          if (retryClean.startsWith('```')) {
            retryClean = retryClean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
          }
          parsed = JSON.parse(retryClean);
        } catch {
          return res.status(400).json({
            error: 'Não foi possível interpretar a resposta nutricional.',
            statusCode: 400,
            message: 'Tente descrever o alimento de outra forma com mais detalhes (ex: "150g de frango grelhado e 1 concha de arroz").',
          });
        }
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
            modelUsed: result.modelUsed,
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
            modelUsed: result.modelUsed,
          });
        }

        return res.status(400).json({
          error: 'Nenhum alimento identificado.',
          statusCode: 400,
          message: 'Tente descrever o alimento de outra forma com mais detalhes.',
        });
      }

      const sanitizeNonNegative = (val: any): number | undefined => {
        if (val === null || val === undefined || val === '') return undefined;
        const num = Number(val);
        if (isNaN(num) || num < 0) return undefined;
        return num;
      };

      const isZeroCalorieBeverage = (name: string): boolean => {
        const lower = name.toLowerCase();
        return (
          lower.includes('água') ||
          lower.includes('agua') ||
          lower.includes('café sem açúcar') ||
          lower.includes('cafe sem acucar') ||
          lower.includes('chá sem açúcar') ||
          lower.includes('cha sem acucar')
        );
      };

      const items = rawItems.map((item: any) => {
        const nome = String(item.nome || item.name || 'Alimento').trim();
        const quantidade = String(item.quantidade || item.quantity || '1 porção').trim();

        const rawProt = sanitizeNonNegative(item.proteina_g ?? item.protein);
        const rawCarb = sanitizeNonNegative(item.carboidrato_g ?? item.carbs);
        const rawFat = sanitizeNonNegative(item.gordura_g ?? item.fat);

        const proteina_g = rawProt !== undefined ? Math.round(rawProt * 10) / 10 : 0;
        const carboidrato_g = rawCarb !== undefined ? Math.round(rawCarb * 10) / 10 : 0;
        const gordura_g = rawFat !== undefined ? Math.round(rawFat * 10) / 10 : 0;

        const kcal_macros = Math.round(4 * proteina_g + 4 * carboidrato_g + 9 * gordura_g);
        const rawCals = sanitizeNonNegative(item.calorias ?? item.calories);

        let calorias = rawCals !== undefined ? Math.round(rawCals) : kcal_macros;
        let observacao = item.observacao ? String(item.observacao).trim() : (item.notes ? String(item.notes).trim() : '');

        if (rawCals === undefined || Math.abs(calorias - kcal_macros) > kcal_macros * 0.12) {
          calorias = kcal_macros;
          const recalcNote = 'calorias recalculadas a partir dos macros';
          if (!observacao.toLowerCase().includes('calorias recalculadas')) {
            observacao = observacao ? `${observacao} (${recalcNote})` : recalcNote;
          }
        }

        const rawQtdG = sanitizeNonNegative(item.quantidade_g ?? item.weight_g ?? item.gramas);
        const quantidade_g = rawQtdG !== undefined ? Math.round(rawQtdG * 10) / 10 : undefined;

        const rawFibra = sanitizeNonNegative(item.fibra_g ?? item.fiber);
        const fibra_g = rawFibra !== undefined ? Math.round(rawFibra * 10) / 10 : undefined;

        const rawSodio = sanitizeNonNegative(item.sodio_mg ?? item.sodium);
        const sodio_mg = rawSodio !== undefined ? Math.round(rawSodio) : undefined;

        let confianca: 'alta' | 'media' | 'baixa' =
          item.confianca === 'alta' || item.confianca === 'media' || item.confianca === 'baixa'
            ? item.confianca
            : 'media';

        const base: 'taco' | 'rotulo' | 'estimativa' =
          item.base === 'taco' || item.base === 'rotulo' || item.base === 'estimativa'
            ? item.base
            : 'taco';

        const allZeros = proteina_g === 0 && carboidrato_g === 0 && gordura_g === 0 && calorias === 0;
        if (calorias > 2500 || (allZeros && !isZeroCalorieBeverage(nome))) {
          confianca = 'baixa';
          const reviewNote = 'valores atípicos, por favor revise';
          if (!observacao.toLowerCase().includes('revise')) {
            observacao = observacao ? `${observacao} (${reviewNote})` : reviewNote;
          }
        }

        let kcal100: number | undefined;
        let p100: number | undefined;
        let c100: number | undefined;
        let g100: number | undefined;

        if (quantidade_g && quantidade_g > 0) {
          const factor = 100 / quantidade_g;
          kcal100 = Math.round(calorias * factor);
          p100 = Math.round(proteina_g * factor * 10) / 10;
          c100 = Math.round(carboidrato_g * factor * 10) / 10;
          g100 = Math.round(gordura_g * factor * 10) / 10;
        }

        return {
          nome,
          quantidade,
          calorias,
          proteina_g,
          carboidrato_g,
          gordura_g,
          quantidade_g,
          fibra_g,
          sodio_mg,
          confianca,
          base,
          kcal100,
          p100,
          c100,
          g100,
          observacao: observacao || undefined,
        };
      });

      return res.json({
        type: 'estimate',
        items,
        modelUsed: result.modelUsed,
        attempts: result.attempts,
      });
    } catch (err: any) {
      const rawStatus = err?.status || err?.statusCode || err?.code;
      const statusCode = typeof rawStatus === 'number' && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
      const fullMessage =
        err?.error?.message ||
        err?.message ||
        (typeof err === 'object' ? JSON.stringify(err, null, 2) : String(err));

      console.error('[Express Nutrition Error]:', { statusCode, message: fullMessage });
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
