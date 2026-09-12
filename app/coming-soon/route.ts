import { NextRequest, NextResponse } from 'next/server'

// Route handler that returns 503 Service Unavailable for the coming-soon page.
// The middleware redirects to /coming-soon when the site gate is enabled and
// the visitor doesn't have a valid bypass cookie or whitelisted IP, but
// NextResponse.redirect() forces a 3xx status. This route handler ensures the
// final response to the browser is a proper 503.
//
// Must be a route handler (not just metadata in page.tsx) because Next.js
// page components cannot set HTTP status codes — only route handlers can.

export async function GET(request: NextRequest) {
  // Import the page content dynamically to avoid duplication
  const { default: ComingSoonPage } = await import('./page')
  const pageContent = await ComingSoonPage()

  // Render the React component to HTML (simplified approach)
  // In production, this would use renderToString, but for maintenance pages
  // we can redirect to the page and let it render normally with 503 metadata

  // Actually, let's use a simpler approach: rewrite to the page with headers
  const url = request.nextUrl.clone()
  url.pathname = '/coming-soon'

  const response = NextResponse.rewrite(url)
  response.status = 503
  response.headers.set('Retry-After', '3600')
  response.headers.set('Cache-Control', 'no-store, must-revalidate')

  return response
}
