import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
  cookiesToSet: {
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }[]
) {
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

  // IMPORTANT: getUser() revalidates the token; don't run logic between
  // createServerClient and getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Public routes: the sign-in page and the password-recovery flow. The
  // recovery token arrives in the URL (hash or ?code=) and is processed
  // client-side, so these must not be gated — otherwise the link would be
  // redirected to /login before the page can read the token.
  const PUBLIC = ["/login", "/forgot-password", "/reset-password", "/auth"];
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  // Only bounce a signed-in user off the sign-in page itself — never off the
  // reset page, where a (recovery) session is expected.
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
