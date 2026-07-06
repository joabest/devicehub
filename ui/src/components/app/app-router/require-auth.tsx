import { Outlet } from 'react-router'
import { observer } from 'mobx-react-lite'
import { useEffect } from 'react'

import { ConditionalRender } from '@/components/lib/conditional-render'

import { socket } from '@/api/socket'

import { authStore } from '@/store/auth-store'
import { variablesConfig } from '@/config/variables.config'

import { getAuthRoute } from '@/constants/route-paths'

export const RequireAuth = observer(() => {
  useEffect(() => {
    if (!authStore.isAuthed) {
      const params = new URLSearchParams(location.search)
      const jwt = params.get('jwt')

      if (!jwt) {
        // In mock mode there is no real backend to authenticate against,
        // so we log in automatically with a placeholder token to showcase the UI.
        if (import.meta.env.MODE === 'mock') {
          authStore.login('mock-jwt-token')

          return
        }

        window.location.assign(`${variablesConfig[import.meta.env.MODE].openStfApiHostUrl}${getAuthRoute()}`)

        return
      }

      authStore.login(jwt)
      window.history.replaceState({}, '', location.pathname + location.hash)
    }
  }, [authStore.isAuthed])

  useEffect(() => {
    if (authStore.isHydrated && authStore.isAuthed) {
      socket.connect()
    }
  }, [authStore.isHydrated, authStore.isAuthed])

  return (
    <ConditionalRender conditions={[authStore.isAuthed]}>
      <Outlet />
    </ConditionalRender>
  )
})
