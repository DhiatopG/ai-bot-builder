// src/components/onboarding/FirstLoginTour.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { driver } from 'driver.js'
import type { DriveStep, Driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const LS_KEY = 'in60_first_tour_done_v1'

export default function FirstLoginTour() {
  const [loading, setLoading] = useState(true)

  // Keep ONE instance + guard against double-start in React dev/strict mode
  const drv = useRef<Driver | null>(null)
  const started = useRef(false)

  // Copy for YOUR product
  const steps: DriveStep[] = useMemo(
    () => [
      {
        element: 'body',
        popover: {
          title: 'Welcome to In60second',
          description:
            'Quick tour: manage bots & working hours, upload PDFs, connect your calendar, see leads, then embed.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '[data-tour="nav-bots"]',
        popover: {
          title: 'Bots & Working Hours',
          description: 'Manage your bots and set your working hours here.',
          side: 'right',
          align: 'center',
        },
      },
      {
        element: '[data-tour="nav-upload"]',
        popover: {
          title: 'Knowledge (PDF only)',
          description: 'Upload your PDF files here to teach the bot.',
          side: 'right',
          align: 'center',
        },
      },
      {
        element: '[data-tour="nav-calendar"]',
        popover: {
          title: 'Calendar',
          description: 'Connect Google Calendar so the bot can book appointments.',
          side: 'right',
          align: 'center',
        },
      },
      {
        element: '[data-tour="nav-leads"]',
        popover: {
          title: 'Leads',
          description: 'All captured leads will appear here.',
          side: 'right',
          align: 'center',
        },
      },
      {
        element: '[data-tour="btn-create-bot"]',
        popover: {
          title: 'Create a bot (optional here)',
          description: 'You can create a new bot any time from this button.',
          side: 'bottom',
          align: 'center',
        },
      },
    ],
    []
  )

  const markSeen = () => {
    try {
      localStorage.setItem(LS_KEY, '1')
    } catch (e) {
      // swallow quota/SSO/private mode errors
      void e
    }
  }

  const startTour = () => {
    // destroy any previous (safety)
    drv.current?.destroy()

    drv.current = driver({
      showProgress: true,
      allowClose: true,
      overlayOpacity: 0.5,
      onDestroyed: () => {
        markSeen() // finish = mark seen
      },
      onCloseClick: () => {
        markSeen() // X = mark seen
      },
    })

    drv.current.setSteps(steps)
    drv.current.drive()
  }

  useEffect(() => {
    const seen =
      typeof window !== 'undefined' && localStorage.getItem(LS_KEY) === '1'

    // Prevent double-start in dev/strict mode
    if (!seen && !started.current) {
      started.current = true
      startTour()
    }

    setLoading(false)

    // Expose replay hook
    const w = window as any
    w.replayIn60Tour = () => {
      try {
        localStorage.removeItem(LS_KEY)
      } catch (e) {
        // ignore storage errors
        void e
      }
      startTour()
    }

    // Cleanup on unmount / route change
    return () => {
      drv.current?.destroy()
      drv.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null
  return null
}
