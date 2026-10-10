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
      });

      let cleanJson = result.text.trim();
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
            modelUsed: result.modelUsed,
          });
        }
        return res.status(500).json({
          error: 'Formato de resposta inválido retornado pela IA.',
          statusCode: 500,
          message: `A IA retornou um formato inesperado:\n${cleanJson}`,
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
          message: 'Tente descrever o alimento com mais detalhes.',
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
