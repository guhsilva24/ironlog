// Diagnóstico: mostra qual commit está no ar e se o ambiente está certo.
// Não revela a chave, só se ela existe.
export default function handler(_req: any, res: any) {
  const chave = (process.env.GEMINI_API_KEY || '').trim();
  res.status(200).json({
    ok: true,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || 'desconhecido').slice(0, 7),
    mensagemDoCommit: process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
    ambiente: process.env.VERCEL_ENV || null,
    node: process.version,
    chaveGeminiDefinida: chave.length > 0,
    chaveComFormatoPadrao: chave.startsWith('AIza'),
  });
}
