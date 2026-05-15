import { getMessages } from "@/lib/i18n/server";

export default async function BillingLoading() {
  const m = await getMessages();
  return <div className="loading-spinner">{m.common.loading}</div>;
}
