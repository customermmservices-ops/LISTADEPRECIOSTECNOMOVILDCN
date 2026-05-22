/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Smartphone,
  Check,
  Plus,
  Trash2,
  MessageCircle,
  MapPin,
  Phone,
  Search,
  RefreshCw,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  Info,
  SlidersHorizontal,
  X,
  Sparkles
} from "lucide-react";
import { Analytics } from "@vercel/analytics/react";

interface Product {
  marca: string;
  modelo: string;
  segmento: string;
  precio: string; // Price Divisas
  precioBcv?: string; // Price Dolares BCV
  estado: string;
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorString, setErrorString] = useState<string | null>(null);
  
  // Clean, permanent dynamic URL from Google Sheets
  const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vROTsoJQC2qyir20ZEg5AjfiEaDtd5qTBLYc-oyA0w6HICGUrnk3wnQ4HGeu594Sgc3-WL8gMCCmAWd/pub?gid=0&single=true&output=csv";
  
  // Interactive Cart for multiple selections
  const [cart, setCart] = useState<Product[]>([]);
  const [showCartDrawer, setShowCartDrawer] = useState<boolean>(false);
  
  // Filters & Searching
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Clean and parse the CSV string robustly
  const parseCSV = (csvText: string): Product[] => {
    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) return [];

    const cleanedLines = lines.map(line => line.trim()).filter(Boolean);
    if (cleanedLines.length === 0) return [];

    // Robust row split supporting quotes
    const parseCSVRow = (rowText: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < rowText.length; i++) {
        const char = rowText[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    // Header index lookups
    const headers = parseCSVRow(cleanedLines[0]).map((h) => h.toLowerCase().trim());
    
    const idxMarca = headers.indexOf("marca");
    const idxModelo = headers.indexOf("modelo");
    const idxSegmento = headers.indexOf("segmento");
    const idxEstado = headers.indexOf("estado");
    
    // Support plural/singular/spaced keywords for price
    const idxPrecioDivisas = headers.findIndex((h) => h.includes("divisa") || h.includes("precio divisas"));
    const idxPrecioDolaresBcv = headers.findIndex((h) => h.includes("bcv") || h.includes("bcv") || h.includes("bcv") || h.includes("dolares bcv") || h.includes("precio dolares bcv"));

    const parsedRows: Product[] = [];

    for (let i = 1; i < cleanedLines.length; i++) {
      const cols = parseCSVRow(cleanedLines[i]);
      if (cols.length < 2) continue;

      // Extract raw data
      const rawMarca = idxMarca !== -1 && cols[idxMarca] !== undefined ? cols[idxMarca] : (cols[0] || "");
      const rawModelo = idxModelo !== -1 && cols[idxModelo] !== undefined ? cols[idxModelo] : (cols[1] || "");
      const rawSegmento = idxSegmento !== -1 && cols[idxSegmento] !== undefined ? cols[idxSegmento] : (cols[2] || "");
      const rawEstado = idxEstado !== -1 && cols[idxEstado] !== undefined ? cols[idxEstado] : (cols[3] || "");

      const cleanCell = (val: string): string => {
        let s = val.trim();
        if (s.startsWith('"') && s.endsWith('"')) {
          s = s.slice(1, -1).trim();
        }
        return s;
      };

      const rowMarca = cleanCell(rawMarca);
      const rowModelo = cleanCell(rawModelo);
      const rowSegmento = cleanCell(rawSegmento);
      const rowEstado = cleanCell(rawEstado);

      // We only insert if row is valid
      if (!rowMarca && !rowModelo) continue;

      // 'Precio Divisas'
      let rowPrecio = "0";
      if (idxPrecioDivisas !== -1 && cols[idxPrecioDivisas] !== undefined) {
        rowPrecio = cols[idxPrecioDivisas];
      } else {
        rowPrecio = cols[4] || "0";
      }
      rowPrecio = cleanCell(rowPrecio).replace(/[\$\s]/g, "").trim();

      // 'Precio Dolares BCV'
      let rowPrecioBcv = "";
      if (idxPrecioDolaresBcv !== -1 && cols[idxPrecioDolaresBcv] !== undefined) {
        rowPrecioBcv = cols[idxPrecioDolaresBcv];
      } else {
        rowPrecioBcv = cols[5] || "";
      }
      rowPrecioBcv = cleanCell(rowPrecioBcv).replace(/[\$\s]/g, "").trim();

      parsedRows.push({
        marca: rowMarca || "Otros",
        modelo: rowModelo || `Modelo ${i}`,
        segmento: rowSegmento || "Otros",
        precio: rowPrecio || "0",
        precioBcv: rowPrecioBcv,
        estado: rowEstado || "Disponible"
      });
    }

    return parsedRows;
  };

  // Fetch catalogue data
  const fetchCatalogue = async (urlToFetch: string) => {
    setLoading(true);
    setErrorString(null);
    try {
      const response = await fetch(urlToFetch);
      if (!response.ok) {
        throw new Error(`Código ${response.status}: No se pudo descargar el inventario.`);
      }
      const text = await response.text();
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        throw new Error("El catálogo recibido no contiene filas de inventario válidas o está vacío.");
      }
      setProducts(parsed);
    } catch (err: any) {
      console.error(err);
      setErrorString(err.message || "Error al conectar con la base de datos de Google Sheets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogue(csvUrl);
  }, []);

  // Filter only items with estado === "DISPONIBLE" (case-insensitive)
  const availableProducts = products.filter(
    (p) => p.estado.toLowerCase().trim() === "disponible"
  );

  // Extract dynamic unique list of brands from actual available inventory
  const brandsList: string[] = ["Todos", ...Array.from<string>(new Set<string>(availableProducts.map((p) => p.marca)))];

  // Helper filter logic
  const filteredProducts = availableProducts.filter((p) => {
    const matchesBrand = selectedBrandFilter === "Todos" || p.marca.toLowerCase() === selectedBrandFilter.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = p.marca.toLowerCase().includes(query) || p.modelo.toLowerCase().includes(query) || p.segmento.toLowerCase().includes(query);
    return matchesBrand && matchesSearch;
  });

  // Unique segments discovered dynamically from the filtered available products
  const uniqueSegments: string[] = Array.from<string>(
    new Set<string>(filteredProducts.map((p) => p.segmento.trim()))
  ).filter(Boolean);

  // Add or remove item from the quote cart
  const toggleCartItem = (product: Product) => {
    const isAlreadyInCart = cart.some(
      (item) => item.marca === product.marca && item.modelo === product.modelo
    );

    if (isAlreadyInCart) {
      setCart((prev) =>
        prev.filter((item) => !(item.marca === product.marca && item.modelo === product.modelo))
      );
    } else {
      setCart((prev) => [...prev, product]);
    }
  };

  const isProductInCart = (product: Product): boolean => {
    return cart.some(
      (item) => item.marca === product.marca && item.modelo === product.modelo
    );
  };

  // Sum total USD in cart
  const calculateTotalUsd = () => {
    return cart.reduce((acc, item) => {
      const val = parseFloat(item.precio) || 0;
      return acc + val;
    }, 0);
  };

  // WhatsApp formatted string redirection
  const handleCheckoutWhatsApp = () => {
    if (cart.length === 0) return;

    const listText = cart
      .map(
        (item) =>
          `• *${item.marca}* - ${item.modelo}: $${item.precio} USD` +
          (item.precioBcv ? ` (Ref. BCV: $${item.precioBcv})` : "")
      )
      .join("\n");

    const total = calculateTotalUsd();

    const fullMessage = `Hola TECNOMOVIL DCN, me gustaría consultar la disponibilidad oficial en tienda para los siguientes equipos de mi cotización:\n\n${listText}\n\n*Resumen General:*\n➡ *Cantidad de equipos:* ${cart.length}\n➡ *Total estimado en divisas:* $${total.toFixed(2)} USD\n\n_Cotización generada desde la Plataforma Digital_`;

    const encodedText = encodeURIComponent(fullMessage);
    const whatsappUrl = `https://wa.me/584144273500?text=${encodedText}`;

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-[#FCFCFD] text-[#1e293b] font-sans antialiased relative selection:bg-blue-100 selection:text-blue-900">
      
      {/* 1. STICKY NAV HEADER */}
      <header className="sticky top-0 z-40 bg-[#FCFCFD]/90 backdrop-blur-md border-b border-gray-100/80 transition-shadow">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold font-display tracking-tight text-slate-950 uppercase">
                  TECNOMOVIL DCN
                </h1>
                <span className="text-[10px] bg-sky-50 text-sky-700 font-bold px-1.5 py-0.5 rounded border border-sky-150 uppercase tracking-widest leading-none">
                  Movistar
                </span>
              </div>
              <p className="text-xs text-slate-400">Tienda Oficial Movistar</p>
            </div>
          </div>

          {/* Contact Details and Cart Button on Header right */}
          <div className="flex items-center space-x-3">
            <div className="hidden md:flex flex-col text-right pr-3 border-r border-gray-100">
              <span className="text-[11px] font-mono text-slate-400">CC Parque los Aviadores</span>
              <span className="text-xs font-semibold text-slate-700">Telf: 0243-2019563</span>
            </div>

            {/* Micro Shopping Bag indicator */}
            <button
              onClick={() => cart.length > 0 && setShowCartDrawer(true)}
              className={`p-2.5 rounded-xl border text-xs font-semibold tracking-tight transition-all duration-300 flex items-center gap-2 cursor-pointer relative ${
                cart.length > 0
                  ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  : "bg-gray-50 border-gray-100 text-slate-400 pointer-events-none"
              }`}
              title="Ver cotización actual"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Mi Lista</span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">
                {cart.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO DESCRIPTION AND STORE INFO PANEL */}
      <section className="bg-slate-50 border-b border-gray-100 py-6">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-3xl">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 tracking-tight">
              Explora Nuestro Catálogo Digital
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
              Tienda Oficial Movistar ubicada en el <strong className="text-slate-700">CC Parque los Aviadores, Maracay (Telf: 0243-2019563)</strong>. 
              Selecciona los modelos de tu interés en la lista inferior y consulta su disponibilidad oficial 100% en vivo a nuestro equipo a través de un mensaje unificado de WhatsApp.
            </p>
          </div>

          {/* Quick info badges */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-6">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-start space-x-3.5 md:col-span-5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ubicación Física</h4>
                <p className="text-xs font-semibold text-slate-700 mt-0.5 leading-tight">CC Parque los Aviadores, Pasillo Cine, Local L-228. Maracay Venezuela.</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-start space-x-3.5 md:col-span-7">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contacto Oficial</h4>
                <p className="text-xs font-semibold text-slate-700 mt-0.5 leading-tight">
                  Tienda (0243-2019563), Whatsapp Clientes (0424-3116333), Whatsapp Empresas (0414-4273500)
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CORE CATALOG CONTAINER */}
      <main className="max-w-6xl mx-auto px-4 py-8 pb-32">
        <div className="space-y-8">
          
          {/* SEARCH & FILTER CONTROLLER ROW */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-2xs space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
              
              {/* Dynamic search bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por marca, modelo o segmento..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-slate-50 focus:bg-white text-xs text-slate-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Reset quickly if filters are set */}
              {(selectedBrandFilter !== "Todos" || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedBrandFilter("Todos");
                    setSearchQuery("");
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer underline self-end lg:self-center"
                >
                  Restablecer filtros
                </button>
              )}
            </div>

            {/* Dynamic Brands Horizontal Scrollbox */}
            <div className="space-y-1.5 border-t border-slate-50 pt-3">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">
                Filtrar por Marca
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {brandsList.map((brand) => {
                  const matchCount = brand === "Todos" 
                    ? availableProducts.length 
                    : availableProducts.filter((p) => p.marca.toLowerCase() === brand.toLowerCase()).length;

                  // Skip brand if it has no products
                  if (matchCount === 0) return null;

                  const isSelected = selectedBrandFilter === brand;

                  return (
                    <button
                      key={brand}
                      onClick={() => setSelectedBrandFilter(brand)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all whitespace-nowrap flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-650"
                      }`}
                    >
                      <span>{brand}</span>
                      <span className={`text-[10px] px-1 py-0.2 rounded-md ${isSelected ? "bg-white/20 text-white" : "bg-white text-slate-500"}`}>
                        {matchCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* BANNER DE NOTAS */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-start space-x-3 text-xs text-slate-650">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-slate-800">Nota sobre el pago:</span> El precio expresado en divisas aplica para pagos en moneda extranjera (efectivo o digital). Los valores reflejados en bolívares se calculan estrictamente a la tasa del <strong className="text-slate-800 font-bold">Banco Central de Venezuela (BCV)</strong>.
            </div>
          </div>

          {/* 4. DOCK LOADER STATE OR ERROR FALLBACK */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs text-slate-400 font-mono">Actualizando lista de precios con Google Sheets...</p>
            </div>
          )}

          {!loading && errorString && (
            <div className="p-8 bg-red-50 border border-red-100 rounded-2xl flex flex-col items-center text-center max-w-xl mx-auto space-y-4">
              <span className="text-red-500 font-bold font-mono">Error de Sincronización</span>
              <p className="text-xs text-red-700 leading-relaxed font-mono">{errorString}</p>
              <button
                onClick={() => fetchCatalogue(csvUrl)}
                className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Reintentar Conexión
              </button>
            </div>
          )}

          {/* 5. SUCCESS CATÁLOGO (LISTA DE PRECIOS ESPACIADA, SIN IMÁGENES) */}
          {!loading && !errorString && filteredProducts.length === 0 && (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-gray-100">
              <Smartphone className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-semibold">No se encontraron productos disponibles</p>
              <p className="text-xs text-slate-400 mt-1">Prueba a escribir otro modelo o selecciona otra marca.</p>
            </div>
          )}

          {!loading && !errorString && filteredProducts.length > 0 && (
            <div className="space-y-12">
              {uniqueSegments.map((segmentName) => {
                const segmentProducts = filteredProducts.filter(
                  (p) => p.segmento.trim().toLowerCase() === segmentName.trim().toLowerCase()
                );

                if (segmentProducts.length === 0) return null;

                return (
                  <div key={segmentName} className="space-y-4">
                    
                    {/* Segment header category label */}
                    <div className="flex items-center space-x-2 pb-2 border-b border-gray-100">
                      <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                      <h3 className="font-display font-bold text-lg text-slate-900 tracking-tight uppercase">
                        {segmentName}
                      </h3>
                      <span className="text-[11px] font-semibold text-slate-400 font-mono">
                        ({segmentProducts.length} disponibles)
                      </span>
                    </div>

                    {/* Encabezados de la Tabla */}
                    <div className="grid grid-cols-12 gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-gray-400 pb-2 border-b border-gray-200 px-4">
                      <div className="col-span-5">Modelo</div>
                      <div className="col-span-3 text-right">Divisas</div>
                      <div className="col-span-3 text-right">Ref. BCV</div>
                      <div className="col-span-1"></div>
                    </div>

                    {/* SPA LIST OF PRICES (GRID TABLE) */}
                    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-xs px-4 divide-y divide-gray-100">
                      
                      {/* Row listing mapped */}
                      {segmentProducts.map((p, idx) => {
                        const isInCart = isProductInCart(p);

                        return (
                          <div
                            key={`${p.marca}-${p.modelo}-${idx}`}
                            className={`grid grid-cols-12 gap-2 items-center py-3 transition-colors ${
                              isInCart ? "bg-blue-50/40 -mx-4 px-4 hover:bg-blue-50" : "hover:bg-slate-50/65 -mx-4 px-4"
                            }`}
                          >
                            {/* col-span-5: Marca y Modelo completo */}
                            <div className="col-span-5">
                              <span className="block text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider leading-none mb-0.5">
                                {p.marca}
                              </span>
                              <span className="text-xs font-bold text-gray-900 whitespace-normal break-words leading-tight block">
                                {p.modelo}
                              </span>
                            </div>

                            {/* col-span-3 text-right: Divisa */}
                            <div className="col-span-3 text-right">
                              <span className="font-mono text-sm font-black text-gray-950">
                                ${p.precio}
                              </span>
                            </div>

                            {/* col-span-3 text-right: Precio BCV */}
                            <div className="col-span-3 text-right">
                              <span className="text-xs font-semibold text-gray-500 font-mono">
                                {p.precioBcv ? `$${p.precioBcv}` : "—"}
                              </span>
                            </div>

                            {/* col-span-1 flex justify-center: Botón circular */}
                            <div className="col-span-1 flex justify-center">
                              <button
                                onClick={() => toggleCartItem(p)}
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all border cursor-pointer ${
                                  isInCart
                                    ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                                    : "bg-blue-600 border-blue-600 text-white hover:bg-blue-700 shadow-2xs"
                                }`}
                                title={isInCart ? "Quitar de cotización" : "Agregar a cotización"}
                              >
                                {isInCart ? "✕" : "+"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* 5. USER PERSISTED FLOATING CARRIAGE DRAWER (DETAILED VIEW) */}
      <AnimatePresence>
        {showCartDrawer && cart.length > 0 && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCartDrawer(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="w-screen max-w-md bg-white shadow-2xl flex flex-col"
              >
                {/* Drawer Header */}
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                    <h3 className="font-display font-bold text-base text-slate-900">
                      Mi Cotización ({cart.length})
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowCartDrawer(false)}
                    className="p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer List content */}
                <div className="flex-1 overflow-y-auto p-5 divide-y divide-gray-100">
                  {cart.map((item, index) => (
                    <div key={`${item.marca}-${item.modelo}-${index}`} className="py-3.5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 font-mono block">
                          {item.marca}
                        </span>
                        <h5 className="text-xs font-semibold text-slate-800">{item.modelo}</h5>
                        {item.precioBcv && (
                          <span className="text-[10px] text-slate-405 font-mono">
                            Ref: ${item.precioBcv}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-bold font-mono text-slate-900">
                          ${item.precio} USD
                        </span>
                        <button
                          onClick={() => toggleCartItem(item)}
                          className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="Quitar equipo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Drawer Footer summary and checkout action */}
                <div className="p-5 border-t border-gray-100 bg-slate-50 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Suma Total Estimada:</span>
                    <span className="text-base font-mono font-extrabold text-blue-600">
                      ${calculateTotalUsd().toFixed(2)} USD
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-550 leading-relaxed">
                    Al confirmar, se abrirá tu aplicación de WhatsApp con la lista de tus equipos seleccionados para consultar existencias directamente en la tienda.
                  </p>
                  <button
                    onClick={handleCheckoutWhatsApp}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold tracking-tight transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-500/10"
                  >
                    <MessageCircle className="w-4 h-4 fill-white text-blue-600" />
                    <span>Enviar Cotización a WhatsApp</span>
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. FLOATING ACTION WHATSAPP BACKBONE CHECKOUT PORT (FAB) */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            className="fixed bottom-6 right-6 z-40"
          >
            {/* Elegant pulse outer ring */}
            <div className="absolute inset-0 bg-blue-600 rounded-full animate-ping opacity-25"></div>

            <button
              onClick={handleCheckoutWhatsApp}
              className="relative flex items-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white px-5 py-4 rounded-full shadow-xl transition-all duration-300 hover:scale-[1.03] cursor-pointer"
              title="Presiona para consultar con un asesor de ventas por WhatsApp"
            >
              <div className="relative">
                <MessageCircle className="w-5 h-5 fill-white text-blue-600" />
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white font-bold text-[9px] flex items-center justify-center border border-white">
                  {cart.length}
                </span>
              </div>
              <span className="text-xs font-bold tracking-tight">
                Consultar {cart.length} {cart.length === 1 ? "equipo" : "equipos"}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-850">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-white font-bold font-display tracking-tight text-base uppercase">
                TECNOMOVIL DCN
              </span>
              <span className="bg-sky-500/10 text-sky-400 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest leading-none">
                Movistar
              </span>
            </div>
            <p className="text-xs text-slate-450 leading-relaxed">
              Tienda Oficial Movistar. CC Parque los Aviadores, Maracay, Aragua.<br />
              Venta de smartphones autorizados, accesorios premium y servicio de recarga oficial.
            </p>
          </div>
          
          <div className="flex flex-col md:items-end text-xs space-y-1.5">
            <span className="text-slate-300 font-semibold">Telf: 0243-2019563 &bull; CC Parque los Aviadores</span>
            <p className="text-[11px] text-slate-500">
              Esta lista de precios recupera información en tiempo real directamente de la base de datos de Google Sheets del sistema de inventarios oficiales.
            </p>
          </div>
        </div>
      </footer>

      <Analytics />
    </div>
  );
}
