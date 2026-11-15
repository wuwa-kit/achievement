import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto grid min-h-dvh max-w-xl place-content-center justify-items-center gap-5 p-6 text-center">
      <div className="text-2xl">{t('notFound.title')}</div>
      <Link
        className="rounded-md bg-(--color-accent) px-4 py-2 text-sm text-(--color-on-accent) hover:opacity-90"
        to="/"
      >
        {t('notFound.home')}
      </Link>
    </div>
  )
}
