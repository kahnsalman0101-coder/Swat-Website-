import { Link } from 'react-router-dom';

import Hero from '../components/home/Hero.jsx';
import StatsBand from '../components/home/StatsBand.jsx';
import DegreeExplorer from '../components/home/DegreeExplorer.jsx';
import FeaturedPrograms from '../components/home/FeaturedPrograms.jsx';
import LatestContent from '../components/home/LatestContent.jsx';
import CtaBand from '../components/home/CtaBand.jsx';
import SectionHeading from '../components/common/SectionHeading.jsx';
import LoadingState from '../components/common/LoadingState.jsx';
import ErrorState from '../components/common/ErrorState.jsx';
import { useFilterOptions } from '../hooks/useProgram.js';
import { usePrograms } from '../hooks/usePrograms.js';
import { usePage } from '../hooks/useSite.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { toParagraphs } from '../utils/format.js';
import './HomePage.css';

/**
 * The homepage keeps the app's section layout while loading official homepage
 * images, counters, links and editorial details from the University website.
 */
export default function HomePage() {
  useDocumentTitle('University of Swat');

  const {
    filters,
    loading: filtersLoading,
    error: filtersError,
    reload: reloadFilters
  } = useFilterOptions();

  const {
    programs,
    loading: programsLoading,
    error: programsError,
    reload: reloadPrograms
  } = usePrograms({ sort: 'title', limit: 6, page: 1 });

  const {
    page: officialHome,
    loading: officialHomeLoading,
    error: officialHomeError,
    reload: reloadOfficialHome
  } = usePage('home');

  const homepage = officialHome && officialHome.homepage ? officialHome.homepage : null;
  const vcDetails = homepage && homepage.viceChancellor ? homepage.viceChancellor : null;
  const aboutDetails = homepage && homepage.about ? homepage.about : null;
  const homepageImages =
    homepage && Array.isArray(homepage.carouselImages) ? homepage.carouselImages : [];
  const homepageCounters =
    homepage && Array.isArray(homepage.counters) ? homepage.counters : [];
  const homepageCards = homepage && Array.isArray(homepage.cards) ? homepage.cards : [];
  const vcParagraphs = vcDetails ? toParagraphs(vcDetails.message) : [];

  const degreeTypeCount =
    filters && Array.isArray(filters.degreeTypes) ? filters.degreeTypes.length : null;
  const facultyCounter = homepageCounters.find((counter) => counter.key === 'faculty');
  const facultyCount = facultyCounter ? facultyCounter.value : null;

  const degreeLede =
    degreeTypeCount && facultyCount
      ? `${degreeTypeCount} degree types appear in the official programme pages. The official homepage lists ${facultyCount} faculty.`
      : 'Choose a degree type to browse pages published on the University website.';

  return (
    <div className="gp-home">
      <Hero
        images={homepageImages}
        imagesLoading={officialHomeLoading}
        imagesError={officialHomeError}
        onRetryImages={reloadOfficialHome}
        featuredLink={homepage ? homepage.featuredLink : null}
      />

      <StatsBand
        stats={homepage ? { counters: homepageCounters } : null}
        loading={officialHomeLoading}
        error={officialHomeError}
        onRetry={reloadOfficialHome}
      />

      <section className="gp-section">
        <div className="gp-container">
          <SectionHeading
            eyebrow="Explore by degree type"
            title="Find a programme by the degree you want"
            lede={degreeLede}
          />
          <DegreeExplorer
            degreeTypes={filters ? filters.degreeTypes : []}
            loading={filtersLoading}
          />
          {!filtersLoading && filtersError && (
            <ErrorState error={filtersError} onRetry={reloadFilters} />
          )}
        </div>
      </section>

      <section className="gp-section gp-section--paper">
        <div className="gp-container">
          <SectionHeading
            eyebrow="Programme directory"
            title="Programme pages"
            lede="Degree pages published on the University of Swat website."
          />
          <FeaturedPrograms
            programs={programs}
            loading={programsLoading}
            error={programsError}
            onRetry={reloadPrograms}
          />
        </div>
      </section>

      <section className="gp-section gp-section--tinted">
        <div className="gp-container gp-home__page">
          <SectionHeading
            eyebrow="From the Vice Chancellor"
            title={vcDetails ? vcDetails.title : "Vice Chancellor's Message"}
          />
          {officialHomeLoading && (
            <LoadingState message="Loading the official Vice Chancellor's message" />
          )}
          {!officialHomeLoading && officialHomeError && (
            <ErrorState error={officialHomeError} onRetry={reloadOfficialHome} />
          )}
          {!officialHomeLoading && !officialHomeError && vcDetails && (
            <div className="gp-home__page-body">
              <div className="row g-4 align-items-center">
                {vcDetails.image && (
                  <div className="col-md-4">
                    <img
                      className="img-fluid rounded"
                      src={vcDetails.image.imageUrl}
                      alt={vcDetails.image.alt}
                      loading="lazy"
                    />
                    {vcDetails.caption && (
                      <p className="gp-home__attribution mt-2">{vcDetails.caption}</p>
                    )}
                  </div>
                )}
                <div className={vcDetails.image ? 'col-md-8' : 'col-12'}>
                  {vcParagraphs.map((paragraph, index) => (
                    <p className="gp-home__page-text" key={index}>
                      {paragraph}
                    </p>
                  ))}
                  <div className="gp-home__page-actions">
                    <Link className="gp-btn gp-btn--green" to="/vice-chancellor">
                      Read more
                      <i className="bi bi-arrow-right" aria-hidden="true" />
                    </Link>
                    {vcDetails.readMoreUrl && (
                      <a
                        className="gp-home__source"
                        href={vcDetails.readMoreUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Official page
                        <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="gp-section gp-section--paper">
        <div className="gp-container gp-home__page">
          <SectionHeading
            eyebrow="From the official homepage"
            title={aboutDetails ? aboutDetails.title : 'About University'}
          />
          {officialHomeLoading && <LoadingState message="Loading the University profile" />}
          {!officialHomeLoading && officialHomeError && (
            <ErrorState error={officialHomeError} onRetry={reloadOfficialHome} />
          )}
          {!officialHomeLoading && !officialHomeError && aboutDetails && (
            <div className="gp-home__page-body">
              <p className="gp-home__page-text">{aboutDetails.text}</p>
              <div className="gp-home__page-actions">
                <Link className="gp-btn gp-btn--green" to="/about">
                  Read more
                  <i className="bi bi-arrow-right" aria-hidden="true" />
                </Link>
                {aboutDetails.readMoreUrl && (
                  <a
                    className="gp-home__source"
                    href={aboutDetails.readMoreUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Official page
                    <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="gp-section">
        <div className="gp-container">
          <SectionHeading
            eyebrow="On the official homepage"
            title="University services and campuses"
            lede="Services and campus links shown on the University of Swat homepage."
          />
          {officialHomeLoading && <LoadingState message="Loading homepage links" />}
          {!officialHomeLoading && officialHomeError && (
            <ErrorState error={officialHomeError} onRetry={reloadOfficialHome} />
          )}
          {!officialHomeLoading && !officialHomeError && homepageCards.length > 0 && (
            <div className="row g-4">
              {homepageCards.map((card) => (
                <div className="col-sm-6 col-lg-4" key={card.url}>
                  <a
                    className="gp-card d-block h-100 overflow-hidden"
                    href={card.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      className="img-fluid w-100"
                      src={card.imageUrl}
                      alt={card.imageAlt}
                      loading="lazy"
                    />
                    <div className="p-3">
                      <h3 className="h5">{card.title}</h3>
                      <span className="gp-home__source">
                        Visit official page
                        <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                      </span>
                    </div>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="gp-section gp-section--tinted">
        <div className="gp-container">
          <SectionHeading
            eyebrow="Latest from the University"
            title="News, announcements and events"
            lede="The most recent items the University publishes under each section."
          />
          <LatestContent />
        </div>
      </section>

      <CtaBand />
    </div>
  );
}
