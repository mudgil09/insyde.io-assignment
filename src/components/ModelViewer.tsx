import React, { useState, useEffect, Suspense, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, PerspectiveCamera, Html } from '@react-three/drei'
import * as THREE from 'three'

// Direct imports with .js extension
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

// Import additional helpers for better OBJ loading
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface ModelViewerProps {
  modelId: string;
  onClose: () => void;
}

// Theme type definition
type Theme = 'dark' | 'light';

// View mode type definition
type ViewMode = 'normal' | 'wireframe' | 'x-ray';

interface ThemeColors {
  background: string;
  object: string;
  grid: string;
  text: string;
  surface: string;
  border: string;
  accent: string;
  textSecondary: string;
}

// Fallback component when loading models
function LoadingBox() {
  const mesh = useRef<THREE.Mesh>(null)
  
  useFrame(() => {
    if (mesh.current) {
      mesh.current.rotation.x += 0.01
      mesh.current.rotation.y += 0.01
    }
  })
  
  return (
    <mesh ref={mesh}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#00b8d4" wireframe />
    </mesh>
  )
}

// Memory management component
function MemoryStats() {
  const [memoryInfo, setMemoryInfo] = useState<{
    totalJSHeapSize: number;
    usedJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null>(null);
  
  useEffect(() => {
    // Check if performance.memory is available (Chrome only)
    if (window.performance && (performance as any).memory) {
      const updateMemoryStats = () => {
        setMemoryInfo((performance as any).memory);
      };
      
      // Update initially and then every second
      updateMemoryStats();
      const interval = setInterval(updateMemoryStats, 1000);
      
      return () => clearInterval(interval);
    }
  }, []);
  
  if (!memoryInfo) return null;
  
  const usedMB = Math.round(memoryInfo.usedJSHeapSize / (1024 * 1024));
  const totalMB = Math.round(memoryInfo.totalJSHeapSize / (1024 * 1024));
  const limitMB = Math.round(memoryInfo.jsHeapSizeLimit / (1024 * 1024));
  
  const usagePercentage = Math.round((usedMB / limitMB) * 100);
  const isHighUsage = usagePercentage > 70;
  
  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.7)',
      color: isHighUsage ? '#ff4d4d' : 'white',
      padding: '5px 10px',
      borderRadius: '4px',
      fontSize: '12px',
      zIndex: 1000,
      pointerEvents: 'none'
    }}>
      Memory: {usedMB}MB / {limitMB}MB
      {isHighUsage && ' (High usage!)'}
    </div>
  );
}

// Camera and scene setup component
function SceneSetup({ viewMode, backgroundColor }: { viewMode: ViewMode, backgroundColor: string }) {
  const { scene, camera, gl } = useThree();
  const controlsRef = useRef<any>();
  
  // Apply background color to scene
  useEffect(() => {
    if (gl && gl.setClearColor) {
      console.log('Setting renderer clear color to:', backgroundColor);
      gl.setClearColor(backgroundColor, 1);
    }
  }, [backgroundColor, gl]);
  
  // Auto-center camera on model
  useEffect(() => {
    if (!controlsRef.current) return;
    
    // Find all meshes in the scene
    const meshes: THREE.Mesh[] = [];
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        meshes.push(object);
      }
    });
    
    if (meshes.length === 0) return;
    
    // Calculate bounding box for all meshes
    const box = new THREE.Box3();
    for (const mesh of meshes) {
      box.expandByObject(mesh);
    }
    
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    
    // Set controls target to center
    controlsRef.current.target.copy(center);
    
    // Position camera to see the whole model with improved framing
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov * (Math.PI / 180) : 45 * (Math.PI / 180);
      // Reduce the distance to make models appear larger
      const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.5; // Reduced from 2.5 to 1.5
      
      const direction = new THREE.Vector3(1, 1, 1).normalize();
      camera.position.copy(center).add(direction.multiplyScalar(distance));
      camera.lookAt(center);
      
      // Update controls
      controlsRef.current.update();
    }
  }, [scene, camera]);
  
  return (
    <>
      <ambientLight intensity={0.8} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      
      {/* Add grid for better orientation */}
      <Grid 
        position={[0, -1, 0]} 
        args={[20, 20]} 
        cellSize={1} 
        cellThickness={0.5} 
        cellColor="#606060" 
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#808080"
        fadeDistance={30}
        fadeStrength={1}
        visible={viewMode !== 'x-ray'}
      />
      
      <OrbitControls 
        ref={controlsRef}
        enablePan 
        enableZoom 
        enableRotate 
        autoRotate={false}
        autoRotateSpeed={1}
        minDistance={0.5} // Reduced minimum zoom distance for closer inspection
        maxDistance={200} // Increased maximum zoom distance
        zoomSpeed={1.5} // Enhanced zoom speed
      />
    </>
  );
}

// Basic model component that loads STL or OBJ files
function Model({ url, fileFormat, viewMode, objectColor }: { url: string, fileFormat: string, viewMode: ViewMode, objectColor: string }) {
  const [model, setModel] = useState<THREE.Object3D | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null)
  const modelRef = useRef<THREE.Group>(new THREE.Group())
  
  useEffect(() => {
    console.log('Loading model:', url, 'Format:', fileFormat)
    let isActive = true
    
    const detectFileFormat = (url: string) => {
      // Try to determine format from URL
      const lowerUrl = url.toLowerCase();
      if (lowerUrl.endsWith('.stl')) return 'stl';
      if (lowerUrl.endsWith('.obj')) return 'obj';
      if (lowerUrl.endsWith('.gltf') || lowerUrl.endsWith('.glb')) return 'gltf';
      // Fall back to provided format
      return fileFormat;
    };
    
    // Detect format from URL or use provided format
    const detectedFileFormat = detectFileFormat(url);
    setDetectedFormat(detectedFileFormat);
    console.log('Detected file format:', detectedFileFormat);
    
    const loadModel = async () => {
      try {
        setIsProcessing(true)
        
        if (detectedFileFormat === 'stl') {
          console.log('Using STLLoader for STL format')
          const loader = new STLLoader()
          
          loader.load(
            url,
            (geometry) => {
              if (!isActive) return
              
              console.log('STL loaded successfully', geometry)
              
              try {
                // Optimize geometry for large models
                console.log('Optimizing geometry...')
                
                // Compute vertex normals if they don't exist
                if (!geometry.attributes.normal) {
                  geometry.computeVertexNormals();
                }
                
                // Create material based on view mode
                const material = createMaterial(viewMode);
                
                const mesh = new THREE.Mesh(geometry, material)
                
                // Center and scale the model
                geometry.computeBoundingBox();
                if (geometry.boundingBox) {
                  const box = geometry.boundingBox;
                  const center = new THREE.Vector3();
                  const size = new THREE.Vector3();
                  
                  box.getCenter(center);
                  box.getSize(size);
                  
                  // Center the geometry
                  mesh.position.set(-center.x, -center.y, -center.z);
                  
                  // Scale the model to a reasonable size with better scaling for STL
                  const maxDim = Math.max(size.x, size.y, size.z);
                  if (maxDim > 0) {
                    // Increase the default scale factor to make models appear larger
                    const scale = 4 / maxDim; // Increased from 2 to 4
                    mesh.scale.set(scale, scale, scale);
                  }
                  
                  console.log('Model dimensions:', size);
                  console.log('Model centered at:', center);
                }
                
                if (modelRef.current) {
                  modelRef.current.clear() // Remove any existing children
                  modelRef.current.add(mesh)
                }
                
                setModel(modelRef.current)
                console.log('STL model set')
              } catch (err) {
                console.error('Error processing STL geometry:', err)
                setError('Error processing model geometry. The file may be too large or complex.')
              } finally {
                setIsProcessing(false)
              }
            },
            (progress) => {
              const percent = Math.round((progress.loaded / progress.total) * 100)
              console.log(`Loading STL: ${percent}%`)
              setLoadingProgress(percent)
            },
            (err) => {
              console.error('STL load error:', err)
              setError('Failed to load STL model')
              setIsProcessing(false)
            }
          )
        } else if (detectedFileFormat === 'obj') {
          console.log('Using OBJLoader for OBJ format')
          
          // Create a new OBJLoader
          const loader = new OBJLoader()
          
          // Enhanced error logging
          console.log('Starting OBJ load from URL:', url.substring(0, 100) + '...')
          
          loader.load(
            url,
            (obj) => {
              if (!isActive) return
              
              console.log('OBJ loaded successfully', obj)
              console.log('OBJ children count:', obj.children.length)
              
              // Log more details about the loaded object
              let meshCount = 0
              obj.traverse(child => {
                if (child instanceof THREE.Mesh) {
                  meshCount++
                  console.log(`Mesh ${meshCount}:`, 
                    child.geometry ? `Vertices: ${child.geometry.attributes.position?.count || 0}` : 'No geometry')
                }
              })
              
              try {
                console.log('Optimizing OBJ model...')
                
                // Calculate bounding box for scaling
                const box = new THREE.Box3().setFromObject(obj);
                const center = new THREE.Vector3();
                const size = new THREE.Vector3();
                
                box.getCenter(center);
                box.getSize(size);
                
                console.log('Model dimensions:', size);
                console.log('Model centered at:', center);
                
                // Center the object
                obj.position.set(-center.x, -center.y, -center.z);
                
                // Scale the model to a reasonable size with better scaling for OBJ
                const maxDim = Math.max(size.x, size.y, size.z);
                if (maxDim > 0) {
                  // Increase the default scale factor to make models appear larger
                  const scale = 4 / maxDim; // Increased from 2 to 4
                  obj.scale.set(scale, scale, scale);
                }
                
                // Apply material to all meshes based on view mode
                let triangleCount = 0;
                obj.traverse((child) => {
                  if (child instanceof THREE.Mesh) {
                    child.material = createMaterial(viewMode);
                    
                    // Count triangles for debugging
                    if (child.geometry) {
                      const geometry = child.geometry;
                      if (geometry.index) {
                        triangleCount += geometry.index.count / 3;
                      } else if (geometry.attributes.position) {
                        triangleCount += geometry.attributes.position.count / 3;
                      }
                    }
                  }
                });
                
                console.log(`Model has approximately ${triangleCount} triangles`);
                
                // For very large models, consider simplifying the geometry
                if (triangleCount > 1000000) {
                  console.warn('Very large model detected. This may cause performance issues.');
                }
                
                if (modelRef.current) {
                  modelRef.current.clear() // Remove any existing children
                  modelRef.current.add(obj)
                }
                
                setModel(modelRef.current)
                console.log('OBJ model set successfully')
              } catch (err) {
                console.error('Error processing OBJ model:', err)
                setError('Error processing model. The file may be too large or complex.')
              } finally {
                setIsProcessing(false)
              }
            },
            (progress) => {
              const percent = Math.round((progress.loaded / progress.total) * 100)
              console.log(`Loading OBJ: ${percent}%`)
              setLoadingProgress(percent)
            },
            (err) => {
              console.error('OBJ load error:', err)
              setError(`Failed to load OBJ model: ${(err as Error).message || 'Unknown error'}`)
              setIsProcessing(false)
            }
          )
        } else {
          setError(`Unsupported file format: ${detectedFileFormat}`)
          setIsProcessing(false)
        }
      } catch (err) {
        console.error('Error in model loading process:', err)
        setError(`Loading error: ${err}`)
        setIsProcessing(false)
      }
    }
    
    loadModel()
    
    return () => {
      isActive = false
      
      // Clean up resources
      if (modelRef.current) {
        modelRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => material.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      }
    }
  }, [url, fileFormat, viewMode])
  
  // Create material based on view mode
  const createMaterial = (mode: ViewMode) => {
    switch (mode) {
      case 'wireframe':
        return new THREE.MeshStandardMaterial({
          color: objectColor,
          metalness: 0.3,
          roughness: 0.5,
          wireframe: true
        });
      case 'x-ray':
        return new THREE.MeshPhongMaterial({
          color: objectColor,
          opacity: 0.5,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide
        });
      case 'normal':
      default:
        return new THREE.MeshStandardMaterial({
          color: objectColor,
          metalness: 0.3,
          roughness: 0.5
        });
    }
  };
  
  // Ensure immediate color change
  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => {
                if (material.color) material.color.set(objectColor);
              });
            } else if (child.material.color) {
              child.material.color.set(objectColor);
            }
          }
        }
      });
    }
  }, [objectColor]);
  
  if (error) {
    // Log the error in useEffect, not in render to avoid ReactNode error
    useEffect(() => {
      console.error('Model viewer error:', error)
    }, [error])

    return (
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="red" />
        {detectedFormat && (
          <Html position={[0, 1.5, 0]} center>
            <div style={{ 
              background: 'rgba(255,0,0,0.7)', 
              color: 'white', 
              padding: '5px 10px', 
              borderRadius: '4px',
              fontSize: '10px',
              whiteSpace: 'nowrap'
            }}>
              Format: {detectedFormat}
            </div>
          </Html>
        )}
      </mesh>
    )
  }
  
  if (isProcessing || !model) {
    return (
      <>
        <LoadingBox />
        {loadingProgress > 0 && (
          <Html center>
            <div style={{ 
              background: 'rgba(0,0,0,0.7)', 
              color: 'white', 
              padding: '10px 15px', 
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              Loading: {loadingProgress}%
            </div>
          </Html>
        )}
      </>
    )
  }
  
  return <primitive object={model} />
}

export const ModelViewer: React.FC<ModelViewerProps> = ({ modelId, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Setup scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // Setup camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Setup controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Load model
    const loadModel = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/models/${modelId}/`);
        if (!response.ok) throw new Error('Failed to fetch model');
        const data = await response.json();
        
        const fileExtension = data.file.toLowerCase().slice(data.file.lastIndexOf('.'));
        const loader = fileExtension === '.stl' ? new STLLoader() : new OBJLoader();
        
        loader.load(
          data.file,
          (geometry) => {
            const material = new THREE.MeshPhongMaterial({
              color: 0x00ff00,
              specular: 0x111111,
              shininess: 200
            });

            let mesh;
            if (geometry instanceof THREE.BufferGeometry) {
              mesh = new THREE.Mesh(geometry, material);
            } else {
              // For OBJ files, geometry is already a mesh
              mesh = geometry;
              mesh.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  child.material = material;
                }
              });
            }

            // Center the model
            const box = new THREE.Box3().setFromObject(mesh);
            const center = box.getCenter(new THREE.Vector3());
            mesh.position.sub(center);

            // Scale to fit view
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 3 / maxDim;
            mesh.scale.multiplyScalar(scale);

            scene.add(mesh);
          },
          undefined,
          (error) => {
            console.error('Error loading model:', error);
          }
        );
      } catch (error) {
        console.error('Error fetching model:', error);
      }
    };

    loadModel();

    // Cleanup
    return () => {
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
      scene.clear();
    };
  }, [modelId]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="model-viewer">
      <button className="close-button" onClick={onClose}>×</button>
      <div ref={containerRef} className="viewer-container" />
    </div>
  );
};