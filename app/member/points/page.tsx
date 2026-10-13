import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import PointsPageClient from './PointsPageClient'

export default async function PointsPage() {
  const t = await getTranslations('points')

  return (
    <div className="m8 m8-points">
      <main className="app wide">
        <header className="top">
        <a className="icon-btn" href="/member" aria-label={t('back')}>
          <svg className="i" aria-hidden="true">
            <use href="#i-back" />
          </svg>
        </a>
        <h1 className="t gt">Space Pts</h1>
        <span></span>
      </header>

      <Suspense fallback={<PointsPageSkeleton />}>
        <PointsPageClient />
      </Suspense>
      </main>
    </div>
  )
}

function PointsPageSkeleton() {
  return (
    <div className="grid">
      <section className="col-l">
        <div className="skel sk-card" style={{ height: '330px', borderRadius: '20px' }} />
        <div className="acts" style={{ marginTop: '14px' }}>
          <div className="skel" style={{ height: '52px', borderRadius: '14px' }} />
          <div className="skel" style={{ height: '52px', borderRadius: '14px' }} />
        </div>
      </section>
      <div className="col-r">
        <div className="skel" style={{ width: '88px', height: '20px', marginBottom: '12px' }} />
        <div className="skel" style={{ height: '44px', borderRadius: '999px', marginBottom: '12px' }} />
        <div className="group">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="row">
              <div className="skel" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
              <div>
                <div className="skel" style={{ width: '110px', height: '14px' }} />
                <div className="skel" style={{ width: '170px', height: '12px', marginTop: '8px' }} />
              </div>
              <div className="skel" style={{ width: '56px', height: '16px' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
