import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingBag, ChevronRight } from 'lucide-react';
import { useStoreProducts } from '../../hooks/useStoreProducts';
import ProductCard from '../../components/loja/ProductCard';
import { useBranding } from '../../contexts/BrandingContext';
import { useSettings } from '../../hooks/useSettings';
import HeroSlideshow from '../../components/HeroSlideshow';
import type { HeroScene, HeroSlideshowConfig } from '../../components/HeroSlideshow';

const DEFAULT_SLIDESHOW: HeroSlideshowConfig = {
  default_duration: 8,
  order: 'sequential',
  transition: 'crossfade',
  transition_duration: 1200,
};

export default function LojaPublicaPage() {
  const { identity } = useBranding();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const { products: featured, loading: loadingFeatured } = useStoreProducts({ featuredOnly: true, limit: 8 });
  const { products: searched, loading: loadingSearch } = useStoreProducts({ search: search || undefined, categoryId: selectedCategory || undefined });

  // Hero/slideshow config editável via /admin/configuracoes → Site → Aparência → Loja
  const { settings: appearanceSettings } = useSettings('appearance');
  const lojaConfig = (appearanceSettings.loja as Record<string, unknown> | undefined) ?? {};
  const heroBadge     = (lojaConfig.badge as string | undefined)    || '';
  const heroTitle     = (lojaConfig.title as string | undefined)    || '';
  const heroHL        = (lojaConfig.highlight as string | undefined) || '';
  const heroSubtitle  = (lojaConfig.subtitle as string | undefined) || '';
  const heroVideoUrl  = (lojaConfig.video_url as string | undefined) || '';
  const heroScenes    = (lojaConfig.scenes as HeroScene[] | undefined) ?? [];
  const heroSlideshow = (lojaConfig.slideshow as HeroSlideshowConfig | undefined) ?? DEFAULT_SLIDESHOW;

  // Fallback para hero simples quando nenhuma mídia/texto customizado foi
  // configurado (ex.: instalações antigas antes da migration 200).
  const hasCustomHero = heroScenes.length > 0 || !!heroVideoUrl || !!heroTitle;

  const showSearch = search || selectedCategory;
  const displayProducts = showSearch ? searched : featured;
  const loading = showSearch ? loadingSearch : loadingFeatured;

  // Collect unique categories from featured products
  const categoryMap = new Map<string, { id: string; name: string; slug: string | null }>();
  featured.forEach((p) => {
    if (p.category) {
      const cat = p.category as { id: string; name: string; slug: string | null };
      categoryMap.set(cat.id, cat);
    }
  });
  const categories = Array.from(categoryMap.values());

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero ── */}
      {hasCustomHero ? (
        <section className="relative min-h-[60vh] md:min-h-[70vh] overflow-hidden">
          <HeroSlideshow scenes={heroScenes} config={heroSlideshow} fallbackVideoUrl={heroVideoUrl} />

          {/* Decorative diagonal slice */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gray-50 [clip-path:polygon(0_100%,100%_0,100%_100%)] z-10" />

          <div className="relative z-[5] container mx-auto px-4 py-20 md:py-28">
            <div className="max-w-3xl">
              {heroBadge && (
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
                  <span className="w-2 h-2 bg-brand-secondary rounded-full animate-pulse" />
                  <span className="text-white/90 text-sm font-medium tracking-wide">{heroBadge}</span>
                </div>
              )}

              {heroTitle && (
                <h1 className="font-display text-4xl md:text-6xl font-bold text-white leading-[0.95] mb-5 tracking-tight">
                  {(() => {
                    if (!heroHL || !heroTitle.includes(heroHL)) return heroTitle;
                    const parts = heroTitle.split(heroHL);
                    return <>{parts[0]}<span className="italic text-brand-secondary">{heroHL}</span>{parts[1]}</>;
                  })()}
                </h1>
              )}

              <div className="h-[3px] w-24 bg-gradient-to-r from-brand-secondary to-brand-secondary-light rounded-full mb-6" />

              {heroSubtitle && (
                <p className="text-base md:text-lg text-white/85 max-w-xl leading-relaxed mb-8">
                  {heroSubtitle}
                </p>
              )}

              {/* Search sobre o hero */}
              <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produtos…"
                  className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                />
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Hero compacto (fallback) */
        <section className="bg-brand-primary text-white py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              {identity.school_short_name || 'Nossa Escola'}
            </h1>
            <p className="text-white/80 text-lg mb-8">Nossa Loja</p>
            <div className="relative max-w-md mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produtos…"
                className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/20 border border-white/30 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
              />
            </div>
          </div>
        </section>
      )}

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Category chips */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !selectedCategory ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-primary'
              }`}>
              Todos
            </button>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === cat.id ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-brand-primary'
                }`}>
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Products grid */}
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-5">
            {showSearch ? 'Resultados' : 'Produtos em Destaque'}
          </h2>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl h-56 animate-pulse" />
              ))}
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400">Nenhum produto encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>

        {/* Cart CTA */}
        <div className="text-center">
          <Link to="/loja/carrinho"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-2xl font-medium transition-colors">
            <ShoppingBag className="w-4 h-4" /> Ver Carrinho
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
