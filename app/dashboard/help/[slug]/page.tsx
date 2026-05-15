import { DashboardShell } from "@/components/layout/dashboard-shell";
import { HelpArticleView } from "@/components/help/help-article-view";
import { getMessages } from "@/lib/i18n/server";

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const m = await getMessages();

  return (
    <DashboardShell
      title={m.dashboard.help.title}
      description={m.dashboard.help.description}
    >
      <HelpArticleView slug={slug} />
    </DashboardShell>
  );
}
