export async function POST() {
  return Response.json({ error: "A confirmação por e-mail foi desativada. Entre com seu e-mail e senha." }, { status: 410 });
}
