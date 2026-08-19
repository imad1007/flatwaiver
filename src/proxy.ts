import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/checkin",
  "/waivers",
  "/signatures",
  "/settings",
  "/onboarding",
  // Requires a session; the /admin layout additionally enforces the
  // platform-admin allowlist (a logged-in non-admin is redirected away).
  "/admin",
];

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session if needed (must be called before any redirect logic).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if ((pathname === "/login" || pathname === "/signup") && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Skip static assets, public signing pages (/w, /kiosk), and crawl/SEO
     * files. robots.txt, sitemap.xml, and *.xml/*.txt must be served as plain
     * static files with NO auth-middleware dependency — routing them through
     * this Edge function (which inits a Supabase client + getUser) risks slow
     * or failed responses that make Googlebot report "robots.txt unreachable".
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|w/|kiosk/|api/sign/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
