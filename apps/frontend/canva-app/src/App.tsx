import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  AppUiProvider,
  Badge,
  Button,
  FormField,
  Rows,
  Text,
  TextInput,
  Title,
} from '@canva/app-ui-kit'
import type { DesignEditorIntent } from '@canva/intents/design'
import { prepareDesignEditor } from '@canva/intents/design'

type Theme = 'light' | 'dark' | 'system'

type DashboardSettings = {
  title: string
  theme: Theme
  notifications: boolean
}

const STORAGE_KEY = 'z-platform.canva-app.settings.v1'
const DEFAULT_SETTINGS: DashboardSettings = {
  title: 'z-platform Dashboard',
  theme: 'system',
  notifications: true,
}

function readSettings(): DashboardSettings | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null

    const candidate = parsed as Partial<DashboardSettings>
    if (
      typeof candidate.title !== 'string' ||
      candidate.title.length < 1 ||
      candidate.title.length > 80 ||
      (candidate.theme !== 'light' && candidate.theme !== 'dark' && candidate.theme !== 'system') ||
      typeof candidate.notifications !== 'boolean'
    ) {
      return null
    }

    return {
      title: candidate.title,
      theme: candidate.theme,
      notifications: candidate.notifications,
    }
  } catch {
    return null
  }
}

function DesignEditor() {
  const [title, setTitle] = useState(DEFAULT_SETTINGS.title)
  const [theme, setTheme] = useState<Theme>(DEFAULT_SETTINGS.theme)
  const [notifications, setNotifications] = useState(DEFAULT_SETTINGS.notifications)
  const [saveStatus, setSaveStatus] = useState('Changes are not saved')

  useEffect(() => {
    const stored = readSettings()
    if (!stored) return

    setTitle(stored.title)
    setTheme(stored.theme)
    setNotifications(stored.notifications)
    setSaveStatus('Loaded local settings')
  }, [])

  function saveSettings() {
    const normalizedTitle = title.trim()
    if (!normalizedTitle || normalizedTitle.length > 80) {
      setSaveStatus('Title must contain 1–80 characters')
      return
    }

    const settings: DashboardSettings = {
      title: normalizedTitle,
      theme,
      notifications,
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      setTitle(normalizedTitle)
      setSaveStatus('Saved locally')
    } catch {
      setSaveStatus('Could not save settings in this browser')
    }
  }

  return (
    <div style={{ padding: '16px', maxWidth: '400px' }}>
      <Rows spacing="2u">
        <Title>z-platform Dashboard</Title>
        <Text>
          Configure dashboard preferences. These settings are saved in this browser;
          they are not synced to a server or Canva account.
        </Text>

        <FormField
          label="Dashboard title"
          value={title}
          control={(props) => (
            <TextInput
              {...props}
              onChange={(value) => {
                setTitle(value)
                setSaveStatus('Unsaved changes')
              }}
            />
          )}
        />

        <label style={{ display: 'grid', gap: '8px' }}>
          <span>Theme</span>
          <select
            aria-label="Theme"
            value={theme}
            onChange={(event) => {
              setTheme(event.target.value as Theme)
              setSaveStatus('Unsaved changes')
            }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={notifications}
            onChange={(event) => {
              setNotifications(event.target.checked)
              setSaveStatus('Unsaved changes')
            }}
          />
          Notifications
        </label>

        <Rows spacing="1u">
          <Text>Status</Text>
          {saveStatus === 'Saved locally' ? (
            <Badge tone="positive">Saved locally</Badge>
          ) : (
            <Text>{saveStatus}</Text>
          )}
        </Rows>

        <Button variant="primary" stretch onClick={saveSettings}>
          Save settings locally
        </Button>
      </Rows>
    </div>
  )
}

export function App() {
  return (
    <AppUiProvider>
      <DesignEditor />
    </AppUiProvider>
  )
}

const designEditor: DesignEditorIntent = {
  render: async () => {
    const rootElement = document.getElementById('root')
    if (!(rootElement instanceof Element)) {
      throw new Error('Unable to find element with id of root')
    }

    createRoot(rootElement).render(
      <AppUiProvider>
        <DesignEditor />
      </AppUiProvider>,
    )
  },
}

prepareDesignEditor(designEditor)
