import { useState } from 'react';
import { Search, Star, StarHalf, Download, Eye, BookOpen, TrendingUp } from 'lucide-react';

interface Book {
  id: number;
  title: string;
  author: string;
  cover: string;
  rating: number;
  downloads: number;
  category: string;
  url: string;
}

const books: Book[] = [
  {
    id: 1,
    title: "Cálculo - Volume 1",
    author: "James Stewart",
    cover: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=400",
    rating: 4.8,
    downloads: 12500,
    category: "ciencias-exatas",
    url: "https://www.baixelivros.com.br/calculo/calculo-1-james-stewart"
  },
  {
    id: 2,
    title: "O Príncipe",
    author: "Maquiavel",
    cover: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=400",
    rating: 4.9,
    downloads: 15800,
    category: "ciencias-humanas",
    url: "https://www.baixelivros.com.br/ciencias-humanas-e-sociais/o-principe"
  },
  {
    id: 3,
    title: "Biologia Molecular da Célula",
    author: "Bruce Alberts",
    cover: "https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&q=80&w=400",
    rating: 4.7,
    downloads: 9800,
    category: "ciencias-biologicas",
    url: "https://www.baixelivros.com.br/biologia/biologia-molecular-da-celula"
  },
  // Add more books for each category...
];

const categories = [
  { id: "ciencias-exatas", name: "Ciências Exatas", icon: <TrendingUp className="w-5 h-5" /> },
  { id: "ciencias-humanas", name: "Ciências Humanas", icon: <BookOpen className="w-5 h-5" /> },
  { id: "ciencias-biologicas", name: "Ciências Biológicas", icon: <Eye className="w-5 h-5" /> },
  { id: "literatura-brasileira", name: "Literatura Brasileira", icon: <BookOpen className="w-5 h-5" /> },
  { id: "literatura-estrangeira", name: "Literatura Estrangeira", icon: <BookOpen className="w-5 h-5" /> },
];

const BibliotecaVirtual = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredBooks = books.filter(book => {
    const matchesCategory = selectedCategory ? book.category === selectedCategory : true;
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         book.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={`full-${i}`} className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    }

    if (hasHalfStar) {
      stars.push(<StarHalf key="half" className="w-4 h-4 fill-yellow-400 text-yellow-400" />);
    }

    return stars;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-brand-primary mb-4">Biblioteca Virtual</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Explore nossa vasta coleção de livros digitais. Conhecimento ao seu alcance, 
            a qualquer hora e em qualquer lugar.
          </p>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-12">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Buscar por título ou autor..."
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id === selectedCategory ? "" : category.id)}
              className={`p-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${
                category.id === selectedCategory
                  ? "bg-brand-primary text-white shadow-lg transform scale-105"
                  : "bg-white text-brand-primary hover:bg-brand-primary hover:text-white shadow hover:shadow-lg"
              }`}
            >
              {category.icon}
              <span className="font-medium">{category.name}</span>
            </button>
          ))}
        </div>

        {/* Top Rated Books */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-brand-primary mb-8">Livros Mais Populares</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredBooks
              .sort((a, b) => b.downloads - a.downloads)
              .slice(0, 4)
              .map(book => (
                <a
                  href={book.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  key={book.id}
                  className="group bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
                >
                  <div className="relative h-64">
                    <img
                      src={book.cover}
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                      <button className="w-full bg-brand-secondary text-brand-primary py-2 rounded-lg font-semibold flex items-center justify-center gap-2">
                        <Download className="w-5 h-5" />
                        Download
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-2 group-hover:text-brand-primary transition-colors">
                      {book.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-2">{book.author}</p>
                    <div className="flex items-center gap-1 mb-2">
                      {renderStars(book.rating)}
                      <span className="text-sm text-gray-600 ml-1">{book.rating}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Download className="w-4 h-4 mr-1" />
                      {book.downloads.toLocaleString()} downloads
                    </div>
                  </div>
                </a>
              ))}
          </div>
        </div>

        {/* All Books */}
        <div>
          <h2 className="text-2xl font-bold text-brand-primary mb-8">Todos os Livros</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredBooks.map(book => (
              <a
                href={book.url}
                target="_blank"
                rel="noopener noreferrer"
                key={book.id}
                className="group bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
              >
                <div className="relative h-64">
                  <img
                    src={book.cover}
                    alt={book.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <button className="w-full bg-brand-secondary text-brand-primary py-2 rounded-lg font-semibold flex items-center justify-center gap-2">
                      <Download className="w-5 h-5" />
                      Download
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-2 group-hover:text-brand-primary transition-colors">
                    {book.title}
                  </h3>
                  <p className="text-gray-600 text-sm mb-2">{book.author}</p>
                  <div className="flex items-center gap-1 mb-2">
                    {renderStars(book.rating)}
                    <span className="text-sm text-gray-600 ml-1">{book.rating}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Download className="w-4 h-4 mr-1" />
                    {book.downloads.toLocaleString()} downloads
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BibliotecaVirtual;