import { WrapDesignerPage } from './editor/WrapDesignerPage';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <WrapDesignerPage />
    </AuthProvider>
  );
}

export default App;
