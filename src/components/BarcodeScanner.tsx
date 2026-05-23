import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { BrowserMultiFormatReader } from '@zxing/library';
import { RepositoryProvider } from '../services/RepositoryProvider';
import { auth } from '../firebase';
import { CloudFunctionsGateway } from '../services/cloudFunctionsGateway';
import { 
  Scan, 
  Search, 
  AlertTriangle, 
  HelpCircle, 
  Check, 
  Heart, 
  Apple, 
  Plus, 
  Loader2, 
  Camera, 
  Info,
  Sliders,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductReviewScreen } from '../features/nutrition/ProductReviewScreen';

export function BarcodeScanner({ onAddMealItem }: { onAddMealItem: (item: any) => void }) {
  const store = useStore();
  const [barcode, setBarcode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [hasDetector, setHasDetector] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Favorite state configurations
  const [showFavConfig, setShowFavConfig] = useState(false);
  const [favPortion, setFavPortion] = useState(100);
  const [favMealType, setFavMealType] = useState('Déjeuner');
  const [favNotes, setFavNotes] = useState('');
  
  // Portion calculation state
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState('g');
  const [rawCooked, setRawCooked] = useState<'raw' | 'cooked'>('raw');

  // Corrections state
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedBrand, setEditedBrand] = useState('');
  const [editedCalories, setEditedCalories] = useState(0);
  const [editedProtein, setEditedProtein] = useState(0);
  const [editedCarbs, setEditedCarbs] = useState(0);
  const [editedFat, setEditedFat] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Check for experimental BarcodeDetector support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      setHasDetector(true);
    }
  }, []);

  const startScanner = async () => {
    setError(null);
    setScanning(true);
    setProduct(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.play();

        // If BarcodeDetector is available, set up detection interval loop
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e']
          });

          const detectLoop = async () => {
            if (!scanning || !streamRef.current) return;
            try {
              if (videoRef.current) {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  const detected = barcodes[0].rawValue;
                  console.log("Barcode detected:", detected);
                  setBarcode(detected);
                  stopScanner();
                  handleLookup(detected);
                  return;
                }
              }
              // Loop every 300ms
              setTimeout(detectLoop, 300);
            } catch (err) {
              console.warn("Barcode detection error:", err);
            }
          };
          setTimeout(detectLoop, 1000);
        } else {
          // Robust real-world web fallback with ZXing library!
          console.log("[Scanner] BarcodeDetector not supported. Initializing ZXing fallback...");
          const codeReader = new BrowserMultiFormatReader();
          zxingReaderRef.current = codeReader;
          codeReader.decodeFromVideoDevice(undefined, videoRef.current!, (result, err) => {
            if (result) {
              const detected = result.getText();
              console.log("[Scanner] Barcode detected via ZXing:", detected);
              setBarcode(detected);
              stopScanner();
              handleLookup(detected);
            }
          });
        }
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setError("Impossible d'accéder à la caméra. Veuillez saisir le code-barres manuellement.");
      setScanning(false);
    }
  };

  const stopScanner = () => {
    setScanning(false);
    if (zxingReaderRef.current) {
      zxingReaderRef.current.reset();
      zxingReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const handleLookup = async (codeToLookup = barcode) => {
    if (!codeToLookup) return;
    setLoading(true);
    setError(null);
    setProduct(null);
    setIsEditing(false);

    try {
      const data = await CloudFunctionsGateway.verifyBarcode(codeToLookup);
      if (data.found && data.product) {
        const prod = data.product;
        setProduct(prod);
        
        // Sync scanned master product to reusable foodProducts Firestore collection
        if (store.isMigratedToCloud) {
          RepositoryProvider.getRepository().saveFoodProduct(prod).catch(() => {});
        }
        
        // Initialize corrections states
        setEditedName(prod.productName);
        setEditedBrand(prod.brand);
        setEditedCalories(prod.nutrimentsPer100g.calories?.value ?? 0);
        setEditedProtein(prod.nutrimentsPer100g.protein?.value ?? 0);
        setEditedCarbs(prod.nutrimentsPer100g.carbs?.value ?? 0);
        setEditedFat(prod.nutrimentsPer100g.fat?.value ?? 0);

        // Check if favorite in store
        const isFav = store.favoriteFoods?.some(f => f.foodProductId === prod.id) || false;
        setIsFavorite(isFav);
        const existingFav = store.favoriteFoods?.find(f => f.foodProductId === prod.id);
        if (existingFav) {
          setFavPortion(existingFav.defaultPortion);
          setFavMealType(existingFav.defaultMealType);
          setFavNotes(existingFav.userNotes || '');
        } else {
          setFavPortion(100);
          setFavMealType('Déjeuner');
          setFavNotes('');
        }
      } else {
        setError(`Produit non enregistré ou introuvable pour : "${codeToLookup}". Veuillez le saisir manuellement ou tenter un OCR d'étiquette.`);
      }
    } catch (err) {
      console.error("Lookup error:", err);
      setError("Échec de connexion au service Open Food Facts. Vérifiez votre réseau.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = () => {
    if (!product) return;
    const isFav = !isFavorite;
    setIsFavorite(isFav);

    if (isFav) {
      setShowFavConfig(true);
    } else {
      // Delete favorite food document
      const existingFav = store.favoriteFoods?.find(f => f.foodProductId === product.id);
      if (existingFav) {
        store.deleteFavoriteFood(existingFav.id);
      }
      setShowFavConfig(false);
    }
  };

  // Calculate current item values
  const gramsSelected = unit === 'g' ? quantity : quantity * 50; // default piece is 50g approx
  
  const rawCalVal = isEditing ? editedCalories : product?.nutrimentsPer100g.calories?.value;
  const finalCals = (rawCalVal !== undefined && rawCalVal !== null) 
    ? Math.round((Number(rawCalVal) * gramsSelected) / 100) 
    : null;

  const rawProteinVal = isEditing ? editedProtein : product?.nutrimentsPer100g.protein?.value;
  const finalProtein = (rawProteinVal !== undefined && rawProteinVal !== null) 
    ? Number(((Number(rawProteinVal) * gramsSelected) / 100).toFixed(1)) 
    : null;

  const rawCarbsVal = isEditing ? editedCarbs : product?.nutrimentsPer100g.carbs?.value;
  const finalCarbs = (rawCarbsVal !== undefined && rawCarbsVal !== null) 
    ? Number(((Number(rawCarbsVal) * gramsSelected) / 100).toFixed(1)) 
    : null;

  const rawFatVal = isEditing ? editedFat : product?.nutrimentsPer100g.fat?.value;
  const finalFat = (rawFatVal !== undefined && rawFatVal !== null) 
    ? Number(((Number(rawFatVal) * gramsSelected) / 100).toFixed(1)) 
    : null;

  const handleAddProduct = () => {
    if (!product) return;

    if (isEditing) {
      const correctedProduct = {
        ...product,
        productName: editedName,
        brand: editedBrand,
        nutrimentsPer100g: {
          ...product.nutrimentsPer100g,
          calories: { ...product.nutrimentsPer100g.calories, value: editedCalories, isMissing: false },
          protein: { ...product.nutrimentsPer100g.protein, value: editedProtein, isMissing: false },
          carbs: { ...product.nutrimentsPer100g.carbs, value: editedCarbs, isMissing: false },
          fat: { ...product.nutrimentsPer100g.fat, value: editedFat, isMissing: false },
        }
      };
      if (store.isMigratedToCloud) {
        RepositoryProvider.getRepository().saveFoodProduct(correctedProduct).catch(() => {});
      }
    }

    onAddMealItem({
      foodId: product.id,
      foodName: `${isEditing ? editedName : product.productName} (${isEditing ? editedBrand : product.brand})`,
      quantity,
      unit,
      gramsSelected,
      rawCookedState: unit === 'g' ? rawCooked : undefined,
      conversionConfidence: 95,
      conversionAssumptions: `Directement issu de l'API Open Food Facts (${barcode}). Corrigé par l'utilisateur: ${isEditing ? 'Oui' : 'Non'}.`,
      sourceType: "open_food_facts",
      calories: finalCals,
      protein: finalProtein,
      carbs: finalCarbs,
      fat: finalFat
    });

    // Reset layout
    setProduct(null);
    setBarcode('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            pattern="\d*"
            placeholder="Saisir code-barres (EAN-13, UPC)..."
            value={barcode}
            onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))}
            className="w-full text-xs rounded-lg border border-border bg-background py-2 pl-9 pr-4 focus:ring-1 focus:outline-none"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleLookup()}
            disabled={!barcode || loading}
            className="text-xs h-[34px] px-3 font-semibold shrink-0"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1" />}
            Rechercher
          </Button>

          <Button
            type="button"
            variant={scanning ? "destructive" : "secondary"}
            onClick={scanning ? stopScanner : startScanner}
            className="text-xs h-[34px] px-3 font-semibold shrink-0"
          >
            <Camera className="w-3.5 h-3.5 mr-1" />
            {scanning ? "Arrêter" : "Scanner photo"}
          </Button>
        </div>
      </div>

      {/* Cloud Food Favorites list quick-add */}
      {store.favoriteFoods && store.favoriteFoods.length > 0 && !product && (
        <div className="p-3 border rounded-xl bg-orange-500/5 border-orange-200/20 space-y-2">
          <h6 className="font-bold text-[10px] uppercase text-orange-600 flex items-center gap-1.5">
            <Heart size={12} className="fill-current text-red-400" />
            Favoris alimentaires Cloud
          </h6>
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
            {store.favoriteFoods.map((fav) => (
              <button
                key={fav.id}
                type="button"
                onClick={() => {
                  setBarcode(fav.foodProductId);
                  handleLookup(fav.foodProductId);
                }}
                className="flex-shrink-0 text-left p-2 border border-border bg-background rounded-lg hover:border-orange-500/30 hover:shadow-sm transition-all max-w-[140px]"
              >
                <p className="font-semibold text-[11px] text-foreground truncate">{fav.displayName}</p>
                <p className="text-[9px] text-muted-foreground truncate">{fav.brand || "Marque inconnue"}</p>
                <div className="mt-1 flex items-center gap-1 text-[8px] text-muted-foreground font-mono">
                  <span>{fav.defaultPortion}g</span>
                  <span className="bg-secondary px-1 py-0.5 rounded text-[8px] truncate">{fav.defaultMealType}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {scanning && (
        <div className="relative border border-primary/20 rounded-2xl overflow-hidden bg-black max-w-sm mx-auto aspect-video flex flex-col justify-end">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-x-0 top-0 p-2 bg-gradient-to-b from-black/80 to-transparent text-[10px] text-white text-center">
            {hasDetector ? "Détection automatique active. Présentez le code-barres." : "Détection via fallback caméra active (ZXing). Présentez le code-barres."}
          </div>
          <div className="absolute inset-0 border-2 border-emerald-500/40 m-8 rounded-lg pointer-events-none flex items-center justify-center">
            <div className="w-full h-[1px] bg-red-500/80 animate-pulse shadow-sm" />
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-xs flex gap-2 items-start leading-relaxed">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Interrogation du registre central Open Food Facts...</span>
        </div>
      )}

      {product && (
        <ProductReviewScreen
          product={product}
          isFavorite={isFavorite}
          onToggleFavorite={handleToggleFavorite}
          onCancel={() => {
            setProduct(null);
            setBarcode('');
          }}
          onConfirm={(correctedProduct, portionGrams, selectedMealType, selectedRawCooked) => {
            const isCorrected = 
              correctedProduct.productName !== product.productName ||
              correctedProduct.brand !== product.brand ||
              correctedProduct.nutrimentsPer100g.calories.value !== product.nutrimentsPer100g.calories.value ||
              correctedProduct.nutrimentsPer100g.protein.value !== product.nutrimentsPer100g.protein.value ||
              correctedProduct.nutrimentsPer100g.carbs.value !== product.nutrimentsPer100g.carbs.value ||
              correctedProduct.nutrimentsPer100g.fat.value !== product.nutrimentsPer100g.fat.value;

            if (isCorrected && store.isMigratedToCloud) {
              RepositoryProvider.getRepository().saveFoodProduct(correctedProduct).catch(() => {});
            }

            const gramsSelected = portionGrams;
            const rawCalVal = correctedProduct.nutrimentsPer100g.calories.value;
            const finalCals = (rawCalVal !== undefined && rawCalVal !== null) 
              ? Math.round((Number(rawCalVal) * gramsSelected) / 100) 
              : null;

            const rawProteinVal = correctedProduct.nutrimentsPer100g.protein.value;
            const finalProtein = (rawProteinVal !== undefined && rawProteinVal !== null) 
              ? Number(((Number(rawProteinVal) * gramsSelected) / 100).toFixed(1)) 
              : null;

            const rawCarbsVal = correctedProduct.nutrimentsPer100g.carbs.value;
            const finalCarbs = (rawCarbsVal !== undefined && rawCarbsVal !== null) 
              ? Number(((Number(rawCarbsVal) * gramsSelected) / 100).toFixed(1)) 
              : null;

            const rawFatVal = correctedProduct.nutrimentsPer100g.fat.value;
            const finalFat = (rawFatVal !== undefined && rawFatVal !== null) 
              ? Number(((Number(rawFatVal) * gramsSelected) / 100).toFixed(1)) 
              : null;

            onAddMealItem({
              foodId: correctedProduct.id,
              foodName: `${correctedProduct.productName} (${correctedProduct.brand})`,
              quantity: portionGrams,
              unit: 'g',
              gramsSelected,
              rawCookedState: selectedRawCooked,
              conversionConfidence: correctedProduct.confidence || 90,
              conversionAssumptions: `Directement issu d'Open Food Facts (${barcode}). Corrigé par l'utilisateur: ${isCorrected ? 'Oui' : 'Non'}.`,
              sourceType: "open_food_facts",
              calories: finalCals,
              protein: finalProtein,
              carbs: finalCarbs,
              fat: finalFat
            });

            setProduct(null);
            setBarcode('');
          }}
        />
      )}
    </div>
  );
}
