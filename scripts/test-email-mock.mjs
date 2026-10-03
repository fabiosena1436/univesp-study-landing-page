// Loaded only by test-server.mjs. No real email can leave integration tests.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = typeof input === 'string' ? input : input.url ?? String(input);
  if (url === 'https://api.resend.com/emails') {
    const body = JSON.parse(options.body);
    return body.to.includes('student@aluno.univesp.br')
      ? Response.json({ name: 'validation_error' }, { status: 422 })
      : Response.json({ id: '00000000-0000-4000-8000-000000000001' });
  }
  return originalFetch(input, options);
};
