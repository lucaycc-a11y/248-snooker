import Nav from './Nav'
import Footer from './Footer'

type PageShellProps = {
  children: React.ReactNode
  showNav?: boolean
  showFooter?: boolean
}

export function PageShell({ children, showNav = true, showFooter = true }: PageShellProps) {
  return (
    <>
      {showNav && <Nav />}
      <main
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 20px',
        }}
        className="md:px-12"
      >
        {children}
      </main>
      {showFooter && <Footer />}
    </>
  )
}
