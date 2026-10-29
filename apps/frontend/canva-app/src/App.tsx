import { useState } from 'react'
import { Button, FormField, Rows, Text, TextInput, Title } from '@canva/app-ui-kit'

export function App() {
  const [title, setTitle] = useState('z-platform Dashboard')
  const [theme, setTheme] = useState('light')
  const [notifications, setNotifications] = useState(true)
  const [saved, setSaved] = useState(false)

  return (
    <div style={{ padding: '16px', maxWidth: '400px' }}>
      <Rows spacing="2u">
        <Title>z-platform Dashboard</Title>
        <Text>
          Configure dashboard presentation settings. This demo stores state only in this session;
          remote synchronization is not configured.
        </Text>

        <FormField
          label="Dashboard Title"
          value={title}
          control={(props) => <TextInput {...props} onChange={setTitle} />}
        />

        <FormField
          label="Theme"
          value={theme}
          control={(props) => <TextInput {...props} onChange={setTheme} />}
        />

        <Rows spacing="1u">
          <Text>Notifications: {notifications ? 'On' : 'Off'}</Text>
          <Button
            variant="secondary"
            stretch
            onClick={() => setNotifications((enabled) => !enabled)}
          >
            {`Turn notifications ${notifications ? "off" : "on"}`}
          </Button>
        </Rows>

        <Button variant="secondary" stretch onClick={() => setSaved(true)}>
          Save settings locally
        </Button>
        {saved && (
          <Text>
            Settings saved in this session only; no backend persistence is configured.
          </Text>
        )}
      </Rows>
    </div>
  )
}
