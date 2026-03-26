import { DashboardShell } from "@/components/layout/dashboard-shell";
import { HelpArticleView } from "@/components/help/help-article-view";

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <DashboardShell
      title="Help Center"
      description="Guides, articles, and answers for running your rental business."
    >
      <HelpArticleView slug={slug} />
    </DashboardShell>
  );
}
