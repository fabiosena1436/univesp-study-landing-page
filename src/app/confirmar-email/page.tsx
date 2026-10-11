import VerifyEmail from "@/components/VerifyEmail";

export const metadata = { title: "Confirmar e-mail — Aprova UNIVESP", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function ConfirmarEmail({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <VerifyEmail token={token ?? ""} />;
}
