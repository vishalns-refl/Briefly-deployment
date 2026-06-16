import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import LandingPage from './components/LandingPage/LandingPage';
import HomePage from './components/HomePage/HomePage';
import ManageFeedsPage from './components/ManageFeeds/ManageFeeds';

import './App.css';

// Separate Header component to use useLocation
const NavigationHeader = () => {
  const location = useLocation();
  
  const getLinkClass = (path, tagValue = null) => {
    const params = new URLSearchParams(location.search);
    const tag = params.get('tag');
    
    if (path === '/') {
      return location.pathname === '/' ? 'active' : '';
    }
    
    if (path === '/feeds') {
      return location.pathname === '/feeds' ? 'active' : '';
    }
    
    if (path === '/dashboard') {
      if (location.pathname !== '/dashboard') return '';
      if (tagValue === null) {
        return !tag ? 'active' : '';
      } else {
        return tag === tagValue ? 'active' : '';
      }
    }
    return '';
  };

  return (
    <header className="page-header">
      <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
        <h2>Briefly</h2>
      </Link>
      <nav>
        <Link to="/" className={getLinkClass('/')}>Welcome</Link>
        <Link to="/dashboard" className={getLinkClass('/dashboard')}>Dashboard</Link>
        <Link to="/dashboard?tag=AI" className={getLinkClass('/dashboard', 'AI')}>AI</Link>
        <Link to="/dashboard?tag=New%20in%20Tech" className={getLinkClass('/dashboard', 'New in Tech')}>New in Tech</Link>
        <Link to="/dashboard?tag=Business" className={getLinkClass('/dashboard', 'Business')}>Business</Link>
        <Link to="/dashboard?tag=Games%2FEntertainment" className={getLinkClass('/dashboard', 'Games/Entertainment')}>Games/Entertainment</Link>
        <Link to="/feeds" className={getLinkClass('/feeds')}>My Feeds</Link>
      </nav>
    </header>
  );
};

function App() {
  return (
    <Router>
      <NavigationHeader />
      <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<HomePage />} />
          <Route path="/feeds" element={<ManageFeedsPage />} />
      </Routes>
    </Router>
  );
}

export default App;