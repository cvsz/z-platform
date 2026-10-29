import { AppUiProvider } from '@canva/app-ui-kit'
import '@canva/app-ui-kit/styles.css'
import { prepareDesignEditor, type DesignEditorIntent } from '@canva/intents/design'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

const designEditor: DesignEditorIntent = {
  render: async () => {
    const rootElement = document.getElementById('root')
    if (!(rootElement instanceof Element)) {
      throw new Error('Unable to find element with id of root')
    }

    createRoot(rootElement).render(
      <AppUiProvider>
        <App />
      </AppUiProvider>,
    )
  },
}

prepareDesignEditor(designEditor)
