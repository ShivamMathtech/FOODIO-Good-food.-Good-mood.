import { createRoot } from 'react-dom/client';
import { Provider } from './context';
import { App } from './App';
import './styles.css';
createRoot(document.getElementById('root')!).render(
  <Provider>
    <App />
  </Provider>,
);
