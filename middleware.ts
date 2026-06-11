import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function isProtectedPath(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/crew") ||
    pathname.startsWith("/onboarding")
  );
}

function isAuthEntryPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password"
  );
}

/**
 * The marketplace is served from its own reserved hostname (e.g.
 * rent.korent.app, set via NEXT_PUBLIC_MARKETPLACE_HOST). This check
 * MUST run before tenant resolution: the marketplace host is a
 * subdomain of the app domain and would otherwise be misread as an
 * operator-storefront tenant with slug "rent".
 */
function isMarketplaceHost(hostname: string): boolean {
  const marketHost = process.env.NEXT_PUBLIC_MARKETPLACE_HOST;
  if (!marketHost) return false;
  return hostname.split(":")[0] === marketHost.split(":")[0];
}

/**
 * Determine if this hostname is a tenant subdomain or custom domain.
 * This runs on the edge — no DB access, just string matching.
 */
function getTenantHost(hostname: string): string | null {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost:3000";
  const hostWithoutPort = hostname.split(":")[0];
  const appDomainWithoutPort = appDomain.split(":")[0];

  // Localhost, Vercel preview, or root domain → not a tenant subdomain
  if (
    hostWithoutPort === "localhost" ||
    hostWithoutPort === "127.0.0.1" ||
    hostWithoutPort.endsWith(".vercel.app") ||
    hostWithoutPort === appDomainWithoutPort ||
    hostWithoutPort === `www.${appDomainWithoutPort}`
  ) {
    return null;
  }

  // Subdomain of app domain
  if (hostWithoutPort.endsWith(`.${appDomainWithoutPort}`)) {
    const subdomain = hostWithoutPort.slice(
      0,
      hostWithoutPort.length - appDomainWithoutPort.length - 1
    );
    if (subdomain && subdomain !== "www") return hostname;
  }

  // Custom domain (anything else that's not the app domain)
  return hostname;
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const hostname = request.headers.get("host") ?? "localhost";

  // Marketplace host: serve everything from the /market route group.
  // Dashboard/auth paths still belong to the main app domain.
  if (isMarketplaceHost(hostname)) {
    if (isProtectedPath(pathname) || isAuthEntryPath(pathname)) {
      const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost:3000";
      const url = new URL(pathname, `${request.nextUrl.protocol}//${appDomain}`);
      url.search = request.nextUrl.search;
      return NextResponse.redirect(url);
    }
    if (!pathname.startsWith("/market") && !pathname.startsWith("/api")) {
      const url = request.nextUrl.clone();
      url.pathname = `/market${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // For tenant subdomains/custom domains, set a header so downstream pages
  // can resolve the org. Only allow public storefront routes — redirect
  // dashboard/auth paths to the main app domain.
  const tenantHost = getTenantHost(hostname);
  if (tenantHost) {
    // Tenant subdomains should not serve dashboard, auth, or onboarding routes
    if (
      isProtectedPath(pathname) ||
      isAuthEntryPath(pathname) ||
      pathname === "/auth/verify-email" ||
      pathname === "/auth/verified"
    ) {
      const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost:3000";
      const protocol = request.nextUrl.protocol;
      const url = new URL(pathname, `${protocol}//${appDomain}`);
      url.search = request.nextUrl.search;
      return NextResponse.redirect(url);
    }

    // Forward the tenant host on the REQUEST headers so downstream server
    // components (which read it via headers()) can resolve the org. Setting it
    // on the response headers was invisible to headers().
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-tenant-host", tenantHost);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── Standard auth flow (root domain / localhost / preview) ──

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase auth unavailable — treat as unauthenticated; protected routes will redirect to login
  }

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const isConfirmed = Boolean(user?.email_confirmed_at);
  // Renter accounts (marketplace signup) default-route to the
  // marketplace, never operator onboarding. Routing only — membership
  // RLS remains the permission source of truth.
  const isRenter = user?.user_metadata?.korent_role === "renter";
  const homePath = isRenter ? "/market/rentals" : "/dashboard";

  if (
    user &&
    !isConfirmed &&
    (pathname.startsWith("/dashboard") ||
      pathname.startsWith("/crew") ||
      pathname.startsWith("/onboarding"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/verify-email";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && isAuthEntryPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = isConfirmed ? homePath : "/auth/verify-email";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/auth/verify-email" && isConfirmed) {
    const url = request.nextUrl.clone();
    url.pathname = homePath;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/onboarding" && isConfirmed) {
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("id")
      .eq("profile_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (membership) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (user && pathname.startsWith("/dashboard") && isConfirmed) {
    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("id")
      .eq("profile_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!membership) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
