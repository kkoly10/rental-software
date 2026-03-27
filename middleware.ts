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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const isConfirmed = Boolean(user?.email_confirmed_at);

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
    url.pathname = isConfirmed ? "/dashboard" : "/auth/verify-email";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/auth/verify-email" && isConfirmed) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};