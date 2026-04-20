import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
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

    let user = null;
    try {
        const { data } = await supabase.auth.getUser();
        user = data?.user ?? null;
    } catch (err) {
        console.error('[middleware] getUser() fetch failed, allowing request through:', err);
        // If Supabase is unreachable, let the request through
        // Page-level auth will handle unauthorized access
        return response;
    }

    // Guest-only routes (login, signup) — redirect to dashboard if already logged in
    const guestOnlyPaths = ['/login', '/signup'];
    const isGuestOnly = guestOnlyPaths.some((p) => request.nextUrl.pathname.startsWith(p));

    // Onboarding routes — require auth, but should NOT redirect to dashboard
    const onboardingPaths = ['/first-login', '/setup'];
    const isOnboarding = onboardingPaths.some((p) => request.nextUrl.pathname.startsWith(p));

    if (!user && !isGuestOnly) {
        // Not logged in + not on login/signup → redirect to login
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    if (user && isGuestOnly) {
        // Logged in + on login/signup → redirect to dashboard
        const url = request.nextUrl.clone();
        url.pathname = '/today';
        return NextResponse.redirect(url);
    }

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|logos|api/auth|api/skills/scheduler|api/skills/scheduler/execute|api/public).*)'],
};
