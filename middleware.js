import { NextResponse, NextRequest } from 'next/server'
 
// This function can be marked `async` if using `await` inside
export function middleware(request) {
    if (request.nextUrl.pathname === "profile2"){
        return NextResponse.redirect(new URL('/home', request.url))      
    }
  return NextResponse.redirect(new URL('/home', request.url))
}
 
export const config = {
    matcher: [
      {
        source: '/api/*',
        regexp: '^/api/(.*)',
        locale: false,
        has: [
          { type: 'header', key: 'Authorization', value: 'Bearer Token' }
        ],
        missing: [{ type: 'cookie', key: 'session', value: 'active' }],
      },
    ],
  }