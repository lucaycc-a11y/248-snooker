'use client'

import { useTranslations } from 'next-intl'
import { Clock, Mail, MousePointerClick, ShieldCheck, Zap } from 'lucide-react'
import { Starfield } from '@/app/[locale]/Starfield'
import { AmbientGlow } from '@/components/shared/AmbientGlow'
import { Logo } from '@/components/brand/Logo'
import { NotifyForm } from '../MaintenanceContent'
import css from './KpayMaintenance.module.css'

const GREEN = '#22c55e'

type Feature = { key: 'f1' | 'f2' | 'f3'; icon: typeof Zap }
const FEATURES: readonly Feature[] = [
  { key: 'f1', icon: MousePointerClick },
  { key: 'f2', icon: Zap },
  { key: 'f3', icon: ShieldCheck },
]

export default function KpayMaintenanceContent() {
  const t = useTranslations('maintenanceKpay')
  const tm = useTranslations('maintenance')

  return (
    <main className={css.main}>
      <Starfield />
      <AmbientGlow variant="gemini" />
      <section className={`glass-panel ${css.panel}`}>
        <div className={css.left}>
          <div className={css.head}>
            <div className={css.logo}>
              <Logo variant="full" theme="dark" size={34} />
            </div>
            <p data-cms-key="maintenanceKpay.eyebrow" className={css.eyebrow}>
              {t('eyebrow')}
            </p>
            <h1 data-cms-key="maintenanceKpay.title" className={css.title}>
              {t('title')}
            </h1>
            <p data-cms-key="maintenanceKpay.subtitle" className={css.sub}>
              {t('subtitle')}
            </p>
          </div>

          <div className={css.eta}>
            <Clock size={16} color="#A1A1A6" />
            <span data-cms-key="maintenanceKpay.eta">{t('eta')}</span>
          </div>
        </div>

        <div className={css.right}>
          <ul className={css.list}>
            {FEATURES.map(({ key, icon: Icon }) => (
              <li key={key} className={css.item}>
                <span className={css.icon}>
                  <Icon size={18} color={GREEN} />
                </span>
                <div>
                  <h2 data-cms-key={`maintenanceKpay.${key}_title`} className={css.itemTitle}>
                    {t(`${key}_title`)}
                  </h2>
                  <p data-cms-key={`maintenanceKpay.${key}_desc`} className={css.itemDesc}>
                    {t(`${key}_desc`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div>
            <div className={css.notifyHead}>
              <Mail size={16} color="#fff" />
              <h2 data-cms-key="maintenanceKpay.notify_title" className={css.notifyTitle}>
                {t('notify_title')}
              </h2>
            </div>
            <p data-cms-key="maintenanceKpay.notify_desc" className={css.notifyDesc}>
              {t('notify_desc')}
            </p>
            <NotifyForm />
          </div>

          <div className={css.foot}>
            <p data-cms-key="maintenance.contact" className={css.contact}>
              {tm('contact')}
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
