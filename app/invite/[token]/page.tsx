import Link from "next/link";
import { acceptTeamInvite } from "@/lib/team/accept-invite";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await acceptTeamInvite(token);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="panel"
        style={{ maxWidth: 480, width: "100%", textAlign: "center" }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: result.ok
              ? "linear-gradient(135deg, #20b486, #17a276)"
              : "linear-gradient(135deg, #f5a623, #e8941a)",
            margin: "0 auto 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            color: "white",
          }}
        >
          {result.ok ? "\u2713" : "!"}
        </div>

        <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>
          {result.ok ? "You're in!" : "Invite issue"}
        </h1>

        <p className="muted" style={{ marginBottom: 24 }}>{result.message}</p>

        {result.ok ? (
          <Link href="/dashboard" className="primary-btn">
            Go to Dashboard
          </Link>
        ) : (
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link href="/login" className="primary-btn">
              Sign In
            </Link>
            <Link href="/signup" className="secondary-btn">
              Create Account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
