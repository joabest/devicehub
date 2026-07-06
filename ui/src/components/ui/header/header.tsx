import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button, Tappable } from '@vkontakte/vkui'
import {
  Icon16MailOutline,
  Icon16HelpOutline,
  Icon28DevicesOutline,
  Icon28SettingsOutline,
  Icon16DoorEnterArrowRightOutline,
  Icon56WebDeviceOutline,
} from '@vkontakte/icons'

import { WarningModal } from '@/components/ui/modals'
import { ConditionalRender } from '@/components/lib/conditional-render'

import DarthVaderIcon from '@/assets/darth-vader.svg?react'

import { useGetAuthUrl } from '@/lib/hooks/use-get-auth-url.hook'
import { useGetAuthDocs } from '@/lib/hooks/use-get-auth-docs.hook'
import { useGetAuthContact } from '@/lib/hooks/use-get-auth-contact.hook'
import { useGetAdditionalUrl } from '@/lib/hooks/use-get-additional-url.hook'
import { authStore } from '@/store/auth-store'

import { getAuthRoute, getDevicesRoute, getMainRoute, getSettingsRoute } from '@/constants/route-paths'

import styles from './header.module.css'

export const Header = () => {
  const { t } = useTranslation()
  const { data: authUrl } = useGetAuthUrl()
  const { data: authDocs } = useGetAuthDocs()
  const { data: additionalUrl } = useGetAdditionalUrl()
  const { data: authContact } = useGetAuthContact()
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)

  const onLogout = () => {
    if (authUrl?.includes('openid')) {
      setIsConfirmationOpen(true)
    }

    if (!authUrl?.includes('openid')) {
      authStore.logout()
      window.location.assign(getAuthRoute())
    }
  }

  return (
    <aside className={styles.header} id='mainPageHeader'>
      <div className={styles.leftSide}>
        <Link className={styles.logoLink} to={getMainRoute()}>
          <Tappable activeMode='opacity' focusVisibleMode='outside' hoverMode='opacity' onClick={() => {}}>
            <span className={styles.brand}>
              <DarthVaderIcon className={styles.brandIcon} height={32} width={32} />
              <span className={styles.brandName}>darthv</span>
            </span>
          </Tappable>
        </Link>
        <ConditionalRender conditions={[!!additionalUrl?.length]}>
          <Link className={styles.navLink} to={additionalUrl || ''}>
            <Button
              align='left'
              before={<Icon56WebDeviceOutline height={28} width={28} />}
              mode='tertiary'
              size='l'
              stretched
            >
              {t('Browsers')}
            </Button>
          </Link>
        </ConditionalRender>
        <Link className={styles.navLink} to={getDevicesRoute()}>
          <Button align='left' before={<Icon28DevicesOutline />} mode='tertiary' size='l' stretched>
            {t('Devices')}
          </Button>
        </Link>
        <Link className={styles.navLink} to={getSettingsRoute()}>
          <Button align='left' before={<Icon28SettingsOutline />} mode='tertiary' size='l' stretched>
            {t('Settings')}
          </Button>
        </Link>
      </div>
      <div className={styles.rightSide}>
        <Button
          align='left'
          before={<Icon16MailOutline />}
          Component='a'
          disabled={!authContact}
          href={authContact}
          mode='tertiary'
          size='m'
          stretched
          target='_blank'
        >
          {t('DeviceHub Support')}
        </Button>
        <Button
          align='left'
          before={<Icon16HelpOutline />}
          Component='a'
          disabled={!authDocs}
          href={authDocs}
          mode='tertiary'
          size='m'
          stretched
          target='_blank'
        >
          {t('Help')}
        </Button>
        <Button align='left' before={<Icon16DoorEnterArrowRightOutline />} mode='tertiary' size='m' stretched onClick={onLogout}>
          {t('Logout')}
        </Button>
      </div>
      <WarningModal
        description={t('You are authenticated via an automatic login method')}
        isCancelShown={false}
        isOpen={isConfirmationOpen}
        title={t('Warning')}
        onClose={() => setIsConfirmationOpen(false)}
        onOk={async () => {
          window.location.assign(getMainRoute())
        }}
      />
    </aside>
  )
}
