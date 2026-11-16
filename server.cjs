require('dotenv').config();

const express = require('express');

const app = express();
const port = Number(process.env.PORT) || 3000;
const wordpressApi = 'https://uswat.edu.pk/wp-json/wp/v2';
const cache = new Map();
const cacheDuration = 5 * 60 * 1000;

const contentCategories = {
  news: 'latestnews',
  announcement: 'announcements',
  event: 'events',
  tender: 'tender',
  job: 'jobs'
};

const pageSlugAliases = {
  'vice-chancellors-message': 'vice-chancellors-message-2'
};

const degreePrefixes = [
  { pattern: /^(BS)\b/i, code: 'BS', level: 'Undergraduate' },
  { pattern: /^(BBA)\b/i, code: 'BBA', level: 'Undergraduate' },
  { pattern: /^(BA\/LLB)\b/i, code: 'BA/LLB', level: 'Undergraduate' },
  { pattern: /^(B\.?Ed)\b/i, code: 'B.Ed', level: 'Undergraduate' },
  { pattern: /^(DPT|Doctor of Physical Therapy)\b/i, code: 'DPT', level: 'Undergraduate' },
  { pattern: /^(MS)\b/i, code: 'MS', level: 'MS/MPhil' },
  { pattern: /^(M\.?Phil)\b/i, code: 'MPhil', level: 'MS/MPhil' },
  { pattern: /^(PhD)\b/i, code: 'PhD', level: 'Doctorate' }
];

const entityMap = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '...',
  lt: '<',
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  quot: '"',
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"'
};

function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
      const codePoint = Number.parseInt(hex, 16);
      return codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    })
    .replace(/&#([0-9]+);/g, (match, decimal) => {
      const codePoint = Number.parseInt(decimal, 10);
      return codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    })
    .replace(/&([a-z]+);/gi, (match, entity) => entityMap[entity.toLowerCase()] || match);
}

function htmlToText(html) {
  return decodeEntities(String(html || ''))
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|div|section|tr|table|article|ul|ol)>/gi, '\n\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function readHtmlAttribute(tag, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(tag || '').match(
    new RegExp(`\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  );
  return match ? decodeEntities(match[1] || match[2] || match[3] || '').trim() : '';
}

function safeHomepageUrl(value, image = false) {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const url = new URL(value, 'https://uswat.edu.pk/');
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (image && url.origin !== 'https://uswat.edu.pk') return null;
    return url.href;
  } catch {
    return null;
  }
}

function extractHomepageImage(markup) {
  const imageTag = String(markup || '').match(/<img\b[^>]*>/i);
  if (!imageTag) return null;

  const imageUrl = safeHomepageUrl(readHtmlAttribute(imageTag[0], 'src'), true);
  if (!imageUrl) return null;

  return {
    imageUrl,
    alt:
      htmlToText(
        readHtmlAttribute(imageTag[0], 'alt') || readHtmlAttribute(imageTag[0], 'title')
      ) || 'University of Swat'
  };
}

function extractHomepageSection(html, headingPattern) {
  const source = String(html || '');
  const heading = headingPattern.exec(source);
  if (!heading) return null;

  const lowerSource = source.toLowerCase();
  const start = lowerSource.lastIndexOf('<section', heading.index);
  const end = lowerSource.indexOf('</section>', heading.index);
  if (start < 0 || end < 0) return null;

  return source.slice(start, end + '</section>'.length);
}

function extractHomepageParagraph(sectionHtml, headingPattern) {
  const heading = headingPattern.exec(sectionHtml);
  if (!heading) return '';

  const paragraph = sectionHtml
    .slice(heading.index + heading[0].length)
    .match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  if (!paragraph) return '';

  const paragraphMarkup = paragraph[1]
    .replace(/<br\s*\/?>/gi, '</p><p>')
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ' ');
  return htmlToText(paragraphMarkup);
}

function extractHomepageReadMore(sectionHtml) {
  const link = extractLinks(sectionHtml).find((item) => /read more/i.test(item.text));
  return link ? safeHomepageUrl(link.url) : null;
}

function extractHomepageCards(html) {
  return Array.from(String(html || '').matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/gi))
    .map((match) => {
      const markup = match[1];
      const image = extractHomepageImage(markup);
      const caption = markup.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
      const anchor = markup.match(/<a\b[^>]*>/i);
      const title = caption ? htmlToText(caption[1]) : '';
      const url = anchor ? safeHomepageUrl(readHtmlAttribute(anchor[0], 'href')) : null;

      if (!image || !title || !url) return null;

      return { title, imageUrl: image.imageUrl, imageAlt: image.alt, url };
    })
    .filter(Boolean);
}

function extractHomepageDetails(html) {
  const source = String(html || '');
  const carouselImages = Array.from(
    source.matchAll(
      /<div\b[^>]*class=(?:"[^"]*\bswiper-slide\b[^"]*"|'[^']*\bswiper-slide\b[^']*')[^>]*>([\s\S]*?)<\/div>/gi
    )
  )
    .map((match) => extractHomepageImage(match[1]))
    .filter(Boolean);

  const counterTitles = Array.from(
    source.matchAll(
      /<div\b[^>]*class=(?:"[^"]*\belementor-counter-title\b[^"]*"|'[^']*\belementor-counter-title\b[^']*')[^>]*>([\s\S]*?)<\/div>/gi
    )
  );
  const counters = counterTitles
    .map((match, index) => {
      const start = match.index + match[0].length;
      const next = counterTitles[index + 1];
      const valueMarkup = source.slice(start, next ? next.index : start + 2000);
      const valueMatch = valueMarkup.match(/\bdata-to-value=["']([\d,]+)["']/i);
      const label = htmlToText(match[1]).replace(/[\u200b-\u200d\ufeff]/g, '').trim();
      const value = valueMatch ? Number(valueMatch[1].replace(/,/g, '')) : NaN;

      return label && Number.isFinite(value) ? { key: slugify(label), label, value } : null;
    })
    .filter(Boolean);

  const aboutHeading = /<h[1-6]\b[^>]*>\s*About University\s*<\/h[1-6]>/i;
  const vcHeading =
    /<h[1-6]\b[^>]*>\s*Vice Chancellor(?:'|’|&#8217;|&rsquo;)s\s+Message[\s\S]*?<\/h[1-6]>/i;
  const aboutSection = extractHomepageSection(source, aboutHeading);
  const vcSection = extractHomepageSection(source, vcHeading);
  const featuredAnchor = Array.from(
    source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)
  ).find((match) => /\belementor-button-link\b/i.test(match[1]));
  const featuredUrl = featuredAnchor
    ? safeHomepageUrl(readHtmlAttribute(featuredAnchor[1], 'href'))
    : null;

  return {
    carouselImages,
    featuredLink:
      featuredAnchor && featuredUrl
        ? { title: htmlToText(featuredAnchor[2]), url: featuredUrl }
        : null,
    counters,
    viceChancellor: vcSection
      ? {
          title: 'Vice Chancellor’s Message',
          message: extractHomepageParagraph(vcSection, vcHeading),
          image: extractHomepageImage(vcSection),
          caption: (() => {
            const caption = vcSection.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
            return caption ? htmlToText(caption[1]) : '';
          })(),
          readMoreUrl: extractHomepageReadMore(vcSection)
        }
      : null,
    about: aboutSection
      ? {
          title: 'About University',
          text: extractHomepageParagraph(aboutSection, aboutHeading),
          readMoreUrl: extractHomepageReadMore(aboutSection)
        }
      : null,
    cards: extractHomepageCards(source)
  };
}

function cacheValue(key, loader) {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = Promise.resolve().then(loader);
  cache.set(key, { promise, expiresAt: Date.now() + cacheDuration });
  promise.catch(() => cache.delete(key));
  return promise;
}

async function wordpressRequest(endpoint, params = {}) {
  const url = new URL(`${wordpressApi}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    const error = new Error('Unable to reach the University of Swat website.');
    error.status = 502;
    throw error;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    const error = new Error('The University of Swat website returned invalid JSON.');
    error.status = 502;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      data && data.message ? data.message : `The University website returned ${response.status}.`
    );
    error.status = response.status;
    throw error;
  }

  return {
    data,
    total: Number(response.headers.get('x-wp-total')) || 0,
    totalPages: Number(response.headers.get('x-wp-totalpages')) || 0
  };
}

async function getAllPages() {
  return cacheValue('all-wp-pages', async () => {
    const fields = 'id,slug,link,title,date,excerpt';
    const firstPage = await wordpressRequest('pages', {
      per_page: 100,
      page: 1,
      _fields: fields
    });

    if (firstPage.totalPages <= 1) return firstPage.data;

    const remainingPages = await Promise.all(
      Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
        wordpressRequest('pages', {
          per_page: 100,
          page: index + 2,
          _fields: fields
        })
      )
    );

    return firstPage.data.concat(...remainingPages.map((result) => result.data));
  });
}

function pageTitle(page) {
  return htmlToText(page && page.title && page.title.rendered);
}

function pageSummary(page) {
  return htmlToText(page && page.excerpt && page.excerpt.rendered);
}

function toPageRecord(page) {
  return {
    id: page.id,
    slug: page.slug,
    title: pageTitle(page),
    url: page.link,
    excerpt: pageSummary(page)
  };
}

async function getPage(slug) {
  const resolvedSlug = pageSlugAliases[slug] || slug;
  const result = await wordpressRequest('pages', {
    slug: resolvedSlug,
    per_page: 1,
    _fields: 'id,slug,link,title,content,excerpt,date'
  });
  return result.data[0] || null;
}

function programType(title) {
  return degreePrefixes.find((degree) => degree.pattern.test(title)) || null;
}

function toProgramRecord(page) {
  const title = pageTitle(page);
  const degree = programType(title);
  if (!degree) return null;

  return {
    id: page.id,
    slug: page.slug,
    title,
    degreeType: degree.code,
    degreeTypeLabel: degree.code,
    badgeKey: 'muted',
    level: degree.level,
    sourceUrl: page.link,
    sourceExcerpt: pageSummary(page),
    publishedDate: page.date ? page.date.slice(0, 10) : null
  };
}

async function getPrograms() {
  return cacheValue('official-program-pages', async () => {
    const pages = await getAllPages();
    return pages.map(toProgramRecord).filter(Boolean);
  });
}

function buildProgramFacets(programs) {
  const degreeCounts = new Map();
  const levelCounts = new Map();

  programs.forEach((program) => {
    degreeCounts.set(program.degreeType, (degreeCounts.get(program.degreeType) || 0) + 1);
    levelCounts.set(program.level, (levelCounts.get(program.level) || 0) + 1);
  });

  return {
    degreeTypes: Array.from(degreeCounts, ([code, count]) => ({
      code,
      label: code,
      badgeKey: 'muted',
      count
    })),
    levels: Array.from(levelCounts, ([value, count]) => ({ value, count })),
    faculties: [],
    departments: [],
    campuses: [],
    keywords: []
  };
}

function matchesProgramFilters(program, query) {
  const selectedDegree = String(query.degree || '').split(',').filter(Boolean);
  const selectedLevel = String(query.level || '').split(',').filter(Boolean);

  if (selectedDegree.length && !selectedDegree.includes(program.degreeType)) return false;
  if (selectedLevel.length && !selectedLevel.includes(program.level)) return false;

  return !['faculty', 'department', 'campus', 'keyword'].some((key) =>
    String(query[key] || '').split(',').filter(Boolean).length
  );
}

function sortPrograms(programs, sort, search) {
  const sorted = [...programs];
  const collator = new Intl.Collator('en', { sensitivity: 'base' });

  if (sort === 'title_desc') return sorted.sort((a, b) => collator.compare(b.title, a.title));
  if (sort === 'degree') {
    return sorted.sort(
      (a, b) => collator.compare(a.degreeType, b.degreeType) || collator.compare(a.title, b.title)
    );
  }
  if (sort === 'newest') {
    return sorted.sort((a, b) => String(b.publishedDate).localeCompare(String(a.publishedDate)));
  }
  if (search && sort === 'relevance') {
    return sorted.sort((a, b) => {
      const aStarts = a.title.toLowerCase().startsWith(search.toLowerCase()) ? 0 : 1;
      const bStarts = b.title.toLowerCase().startsWith(search.toLowerCase()) ? 0 : 1;
      return aStarts - bStarts || collator.compare(a.title, b.title);
    });
  }

  return sorted.sort((a, b) => collator.compare(a.title, b.title));
}

function extractDepartments(html) {
  const departments = new Map();

  Array.from(String(html || '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)).forEach((match) => {
    const name = htmlToText(match[1]);
    if (!/^(Department|Institute|College)\b/i.test(name)) return;

    const slug = slugify(name);
    const linkMatch = match[1].match(/<a\b[^>]*href=["']([^"']+)["']/i);
    let url = null;
    if (linkMatch) {
      try {
        const parsedUrl = new URL(linkMatch[1], 'https://uswat.edu.pk');
        if (['http:', 'https:'].includes(parsedUrl.protocol)) url = parsedUrl.href;
      } catch {
        url = null;
      }
    }

    departments.set(slug, { id: slug, slug, name, url });
  });

  return Array.from(departments.values());
}

function extractLinks(html) {
  return Array.from(
    String(html || '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
  )
    .map((match) => ({ url: match[1], text: htmlToText(match[2]) }))
    .filter((link) => link.text && link.url);
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getFaculties() {
  return cacheValue('official-faculties', async () => {
    const pages = await getAllPages();
    const facultyPages = new Map(
      pages
        .filter((page) => /^Faculty of\b/i.test(pageTitle(page)))
        .map((page) => [page.slug, { page, name: pageTitle(page) }])
    );
    const deansPage = await getPage('office-of-the-deans');
    const officialFacultyLinks = extractLinks(
      deansPage && deansPage.content && deansPage.content.rendered
    ).filter((link) => /^Faculty of\b/i.test(link.text));

    officialFacultyLinks.forEach((link) => {
      try {
        const url = new URL(link.url, 'https://uswat.edu.pk');
        if (url.origin !== 'https://uswat.edu.pk') return;
        const slug = url.pathname.split('/').filter(Boolean).pop();
        const page = pages.find((item) => item.slug === slug);
        if (page) facultyPages.set(slug, { page, name: link.text });
      } catch {
        return;
      }
    });

    return Promise.all(
      Array.from(facultyPages.values()).map(async ({ page, name }) => {
        const detail = await getPage(page.slug);
        const departments = extractDepartments(
          detail && detail.content && detail.content.rendered
        );

        return {
          id: page.id,
          slug: page.slug,
          name,
          url: page.link,
          departments
        };
      })
    );
  });
}

async function getCampuses() {
  return cacheValue('official-campus-pages', async () => {
    const pages = await getAllPages();
    const campusPages = pages.filter((page) => /\bCampus$/i.test(pageTitle(page)));

    return Promise.all(
      campusPages.map(async (page) => {
        const detail = await getPage(page.slug);
        const body = htmlToText(detail && detail.content && detail.content.rendered);
        const overview = body.split(/\n{2,}/).find(Boolean) || '';

        return {
          id: page.id,
          slug: page.slug,
          name: pageTitle(page),
          overview,
          url: page.link
        };
      })
    );
  });
}

async function getCategories() {
  return cacheValue('wp-categories', async () => {
    const result = await wordpressRequest('categories', {
      per_page: 100,
      _fields: 'id,slug,name,count'
    });
    return result.data;
  });
}

function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

app.get(
  '/api/content',
  asyncRoute(async (req, res) => {
    const selectedKeys = String(req.query.category || 'news')
      .split(',')
      .filter(Boolean);
    const categoryMap = await getCategories();
    const selectedCategories = selectedKeys.map((key) => {
      const slug = contentCategories[key];
      const category = categoryMap.find((item) => item.slug === slug);
      if (!slug || !category) throw apiError(`Unknown content category: ${key}`);
      return category;
    });

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 9));
    const search = String(req.query.q || '').trim();
    const newsCategory = selectedKeys.includes('news');
    const excludedCategories = newsCategory
      ? categoryMap
          .filter((category) => Object.values(contentCategories).includes(category.slug))
          .filter((category) => category.slug !== contentCategories.news)
          .map((category) => category.id)
          .join(',')
      : '';
    const result = await wordpressRequest('posts', {
      categories: selectedCategories.map((category) => category.id).join(','),
      categories_exclude: excludedCategories,
      page,
      per_page: limit,
      search,
      _embed: 'wp:featuredmedia',
      _fields: 'id,date,link,title,excerpt,featured_media,categories,_embedded'
    });

    const counts = Object.fromEntries(
      Object.entries(contentCategories).map(([key, slug]) => [
        key,
        (categoryMap.find((category) => category.slug === slug) || {}).count || 0
      ])
    );

    res.json({
      data: result.data.map((post) => ({
        id: post.id,
        title: htmlToText(post.title && post.title.rendered),
        publishedDate: post.date ? post.date.slice(0, 10) : null,
        excerpt: htmlToText(post.excerpt && post.excerpt.rendered),
        imageUrl:
          post._embedded &&
          post._embedded['wp:featuredmedia'] &&
          post._embedded['wp:featuredmedia'][0] &&
          post._embedded['wp:featuredmedia'][0].source_url,
        url: post.link
      })),
      meta: {
        page,
        limit,
        total: result.total,
        totalPages: result.totalPages
      },
      counts,
      categories: categoryMap.map(({ id, name, slug, count }) => ({ id, name, slug, count }))
    });
  })
);

app.get(
  '/api/pages',
  asyncRoute(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 100));
    const search = String(req.query.search || '').trim();
    const result = await wordpressRequest('pages', {
      page,
      per_page: limit,
      search,
      _fields: 'id,slug,link,title,date,excerpt'
    });

    res.json({
      data: result.data.map(toPageRecord),
      meta: { page, limit, total: result.total, totalPages: result.totalPages }
    });
  })
);

app.get(
  '/api/pages/:slug',
  asyncRoute(async (req, res) => {
    const page = await getPage(req.params.slug);
    if (!page) throw apiError('Page not found on the University of Swat website.', 404);

    res.json({
      data: {
        id: page.id,
        slug: page.slug,
        title: pageTitle(page),
        body: htmlToText(page.content && page.content.rendered),
        sourceUrl: page.link,
        publishedDate: page.date ? page.date.slice(0, 10) : null,
        ...(page.slug === 'home'
          ? { homepage: extractHomepageDetails(page.content && page.content.rendered) }
          : {})
      }
    });
  })
);

app.get(
  '/api/campuses',
  asyncRoute(async (_req, res) => {
    res.json({ data: await getCampuses() });
  })
);

app.get(
  '/api/faculties',
  asyncRoute(async (_req, res) => {
    res.json({ data: await getFaculties() });
  })
);

app.get(
  '/api/programs/filters',
  asyncRoute(async (_req, res) => {
    const programs = await getPrograms();
    res.json({ data: buildProgramFacets(programs) });
  })
);

app.get(
  '/api/programs',
  asyncRoute(async (req, res) => {
    const allPrograms = await getPrograms();
    const search = String(req.query.search || '').trim();
    const queryText = search.toLowerCase();
    const matching = allPrograms.filter((program) => {
      const matchesSearch =
        !queryText ||
        program.title.toLowerCase().includes(queryText) ||
        program.sourceExcerpt.toLowerCase().includes(queryText);
      return matchesSearch && matchesProgramFilters(program, req.query);
    });
    const sorted = sortPrograms(matching, String(req.query.sort || 'relevance'), search);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 9));
    const start = (page - 1) * limit;

    res.json({
      data: sorted.slice(start, start + limit),
      meta: {
        page,
        limit,
        total: sorted.length,
        totalPages: Math.ceil(sorted.length / limit)
      },
      facets: buildProgramFacets(allPrograms)
    });
  })
);

app.get(
  '/api/programs/:slug',
  asyncRoute(async (req, res) => {
    const page = await getPage(req.params.slug);
    const program = page && toProgramRecord(page);
    if (!program) throw apiError('Programme page not found on the University of Swat website.', 404);

    const related = (await getPrograms())
      .filter(
        (item) => item.slug !== program.slug && item.degreeType === program.degreeType
      )
      .slice(0, 3);

    res.json({
      data: {
        ...program,
        description: htmlToText(page.content && page.content.rendered),
        related
      }
    });
  })
);

app.get(
  '/api/stats',
  asyncRoute(async (_req, res) => {
    const [programs, faculties] = await Promise.all([getPrograms(), getFaculties()]);
    res.json({
      data: {
        counters: [
          { key: 'program-pages', label: 'Programme pages listed', value: programs.length },
          { key: 'faculty-pages', label: 'Faculty pages listed', value: faculties.length }
        ],
        totals: { faculties: faculties.length }
      }
    });
  })
);

app.use((error, _req, res, _next) => {
  const status = Number(error.status) || 502;
  res.status(status).json({
    error: { status, message: error.message || 'Unable to load website data.' }
  });
});

app.listen(port, () => {
  console.log(`University of Swat data API listening on http://127.0.0.1:${port}`);
});
