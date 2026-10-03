export async function POST() {
  return Response.json({ error: "Não é necessário confirmar o cadastro por e-mail. Entre com seu e-mail e senha." }, { status: 410 });
}
