import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ErrorState from '../common/ErrorState.jsx';
import LoadingState from '../common/LoadingState.jsx';
import { useContent } from '../../hooks/useSite.js';
import { formatDate } from '../../utils/format.js';
import { UNIVERSITY } from '../../utils/constants.js';
import './Hero.css';

export default function Hero({
  lede = '',
  images = [],
  imagesLoading = false,
  imagesError = null,
  onRetryImages = null,
  featuredLink = null
}) {
  const [term, setTerm] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const {
    items: notices,
    loading: noticesLoading,
    error: noticesError,
    reload: reloadNotices
  } = useContent({ category: ['announcement', 'event'], limit: 3 });
  const activeSlide = images.length ? currentSlide % images.length : 0;

  // Auto-play slider effect
  useEffect(() => {
    if (images.length < 2) return undefined;

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    }, 5000); // Changes image every 5 seconds

    return () => clearInterval(timer); // Cleanup on unmount
  }, [images.length]);

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
              placeholder="Search official programme pages"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              autoComplete="off"
            />
            <button className="gp-btn gp-btn--red gp-hero__submit" type="submit">
              Search
            </button>
          </form>

          <div className="gp-hero__notices">
            <p className="gp-hero__notices-label">Latest University notices</p>
            {noticesLoading && <LoadingState message="Loading notices" compact />}
            {!noticesLoading && noticesError && (
              <ErrorState error={noticesError} onRetry={reloadNotices} />
            )}
            {(notices.length > 0 || featuredLink) && (
              <ul className="gp-hero__notices-list">
                {featuredLink && (
                  <li className="gp-hero__notice">
                    <a
                      className="gp-hero__notice-link"
                      href={featuredLink.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <i className="bi bi-calendar-event" aria-hidden="true" />
                      <span>{featuredLink.title}</span>
                    </a>
                  </li>
                )}
                {notices.map((notice) => (
                  <li key={notice.id} className="gp-hero__notice">
                    <a
                      className="gp-hero__notice-link"
                      href={notice.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <i className="bi bi-megaphone" aria-hidden="true" />
                      <span>
                        {notice.title}
                        {notice.publishedDate && (
                          <time dateTime={notice.publishedDate}>
                            {' '}
                            · {formatDate(notice.publishedDate)}
                          </time>
                        )}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {!noticesLoading && !noticesError && notices.length === 0 && !featuredLink && (
              <p>No notices are currently available.</p>
            )}
          </div>
        </div>

        {(images.length > 0 || imagesLoading || imagesError) && (
          <div className="gp-hero__media">
            {images.length > 0 && (
              <div className="gp-slider">
                {images.map((image, index) => (
                  <div
                    key={image.imageUrl}
                    className={`gp-slide ${index === activeSlide ? 'active' : ''}`}
                  >
                    <img src={image.imageUrl} alt={image.alt} />
                  </div>
                ))}

                <div className="gp-slider-dots">
                  {images.map((image, index) => (
                    <button
                      key={image.imageUrl}
                      className={`gp-dot ${index === activeSlide ? 'active' : ''}`}
                      onClick={() => setCurrentSlide(index)}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}
            {images.length === 0 && imagesLoading && (
              <LoadingState message="Loading the official homepage gallery" compact />
            )}
            {images.length === 0 && imagesError && (
              <ErrorState error={imagesError} onRetry={onRetryImages} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}