import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import TopBar from './TopBar';
import Header from './Header';
import Navbar from './Navbar';
import Footer from './Footer';

export default function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <TopBar />
      <Header />
      <Navbar />
      <main className="flex-1">
        <div key={pathname} className="page-content">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}
