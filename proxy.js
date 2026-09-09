import { NextResponse } from 'next/server'

export function proxy(request) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api')) {
    // <img src> navigations cannot send the `edgetoken` header that our APIs
    // expect, so for recipe image routes fall back to the token cookie (set at
    // login) or ?t= before forwarding.
    const headers = new Headers(request.headers)
    if (!headers.get('edgetoken')) {
      const cookieToken = request.cookies.get('edgetoken')?.value
      const queryToken = request.nextUrl.searchParams.get('t')
      if (cookieToken) {
        headers.set('edgetoken', cookieToken)
      } else if (queryToken) {
        headers.set('edgetoken', queryToken)
      }
    }

    // Proxy for Next.js 16 - rewriting API requests
    // Adjust target URL as needed for your backend environment
    return NextResponse.rewrite(new URL(request.url), { request: { headers } })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
