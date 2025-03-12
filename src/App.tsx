import { useState, useEffect } from 'react';
import { ModelViewer } from './components/ModelViewer';
import { ModelList } from './components/ModelList';
import { FileUpload } from './components/FileUpload';

interface Model {
  id: string;
  name: string;
  file: string;
  created_at: string;
}

function App() {
  const [designs, setDesigns] = useState<Model[]>([]);
  const [activeDesignId, setActiveDesignId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDesigns();
  }, []);

  const fetchDesigns = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/models/');
      if (!response.ok) throw new Error('Failed to fetch designs');
      const data = await response.json();
      setDesigns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch designs');
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      if (!file) throw new Error('No file selected');

      const allowedExtensions = ['.stl', '.obj'];
      const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      
      if (!allowedExtensions.includes(fileExtension)) {
        throw new Error('Only STL and OBJ files are supported');
      }

      if (file.size > 100 * 1024 * 1024) {
        throw new Error('File size must be less than 100MB');
      }

      const formData = new FormData();
      formData.append('name', file.name);
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/api/models/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload file');

      await fetchDesigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDesignDelete = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/models/${id}/`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete design');

      await fetchDesigns();
      if (activeDesignId === id) setActiveDesignId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete design');
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>3D Model Viewer</h1>
      </header>

      <main>
        <section className="upload-section">
          <FileUpload
            onUpload={handleFileUpload}
            isProcessing={isProcessing}
            accept=".stl,.obj"
            maxSize={100 * 1024 * 1024}
          />
          {error && <div className="error">{error}</div>}
        </section>

        {activeDesignId ? (
          <section className="model-viewer-section">
            <ModelViewer
              modelId={activeDesignId}
              onClose={() => setActiveDesignId(null)}
            />
          </section>
        ) : (
          <ModelList
            designs={designs}
            viewMode="grid"
            onModelSelect={setActiveDesignId}
            onModelDelete={handleDesignDelete}
          />
        )}
      </main>
    </div>
  );
}

export default App;