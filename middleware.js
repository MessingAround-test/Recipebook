import { NextResponse } from 'next/server'

export function middleware(request) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api')) {
    // Proxy for Next.js 16 - rewriting API requests
    // Adjust target URL as needed for your backend environment
    return NextResponse.rewrite(new URL(request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
