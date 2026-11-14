import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UNIVERSITY, siteSearch } from '../../utils/constants.js';
import './Hero.css';

/**
 * The two notices the University currently publishes on its own site. Both
 * destinations point back to uswat.edu.pk (the admissions portal and the
 * university's own site search), never to an invented page.
 */
const NOTICES = [
  {
    icon: 'bi-clipboard-check',
    label: 'Final Merit List Fall 2026 (Self Finance)',
    href: 'https://cms1.uswat.edu.pk/admission/program/list/final'
  },
  {
    icon: 'bi-globe2',
    label: 'International Conference: One Planet One Health; Nature, Climate & Humanity',
    href: siteSearch('One Planet One Health')
  }
];

// Add your university image URLs here (place your images in the `public` folder)
const IMAGES = [
  '/public/images (1).jfif',
  '/public/images (2).jfif',
  '/public/images (3).jfif',
  '/public/images (4).jfif',
  
];

export default function Hero({ lede = '' }) {
  const [term, setTerm] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  // Auto-play slider effect
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === IMAGES.length - 1 ? 0 : prev + 1));
    }, 5000); // Changes image every 5 seconds

    return () => clearInterval(timer); // Cleanup on unmount
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = term.trim();
    navigate(trimmed ? `/programs?search=${encodeURIComponent(trimmed)}` : '/programs');
  }

  return (
    <section className="gp-hero">
      <div className="gp-container gp-hero__inner">
        <div className="gp-hero__content">
          <h1 className="gp-hero__title">{UNIVERSITY.name}</h1>
          <p className="gp-hero__motto">{UNIVERSITY.motto}</p>

          {lede && <p className="gp-hero__lede">{lede}</p>}

          <form className="gp-hero__search" onSubmit={handleSubmit} role="search">
            <label className="gp-sr-only" htmlFor="hero-search">
              Search programmes
            </label>
            <i className="bi bi-search gp-hero__search-icon" aria-hidden="true" />
            <input
              id="hero-search"
              className="gp-hero__input"
              type="search"
              placeholder="Search by programme, department or keyword"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              autoComplete="off"
            />
            <button className="gp-btn gp-btn--red gp-hero__submit" type="submit">
              Search
            </button>
          </form>

          <div className="gp-hero__notices">
            <p className="gp-hero__notices-label">University notices</p>
            <ul className="gp-hero__notices-list">
              {NOTICES.map((notice) => (
                <li key={notice.label} className="gp-hero__notice">
                  <a
                    className="gp-hero__notice-link"
                    href={notice.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <i className={`bi ${notice.icon}`} aria-hidden="true" />
                    <span>{notice.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* REPLACED CREST WITH IMAGE SLIDER */}
        <div className="gp-hero__media">
          <div className="gp-slider">
            {IMAGES.map((img, index) => (
              <div
                key={index}
                className={`gp-slide ${index === currentSlide ? 'active' : ''}`}
              >
                <img src={img} alt={`University Campus ${index + 1}`} />
              </div>
            ))}
            
            {/* Navigation Dots */}
            <div className="gp-slider-dots">
              {IMAGES.map((_, index) => (
                <button
                  key={index}
                  className={`gp-dot ${index === currentSlide ? 'active' : ''}`}
                  onClick={() => setCurrentSlide(index)}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}