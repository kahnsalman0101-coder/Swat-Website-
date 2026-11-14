const express = require('express');
const cors = require('cors');
const path = require('path'); // Added path module

const app = express();
app.use(cors());
app.use(express.json());

// Log every request so we can see it working
app.use((req, res, next) => {
  console.log(`[BACKEND] ${req.method} ${req.url}`);
  next();
});

// 1. Faculties
app.get('/api/faculties', (req, res) => {
  res.json([
    { id: 1, name: "Faculty of Science", icon: "bi-thermometer" },
    { id: 2, name: "Faculty of Arts", icon: "bi-book" },
    { id: 3, name: "Faculty of Management Sciences", icon: "bi-briefcase" }
  ]);
});

// 2. Stats
app.get('/api/stats', (req, res) => {
  res.json({
    students: 15000,
    programs: 45,
    faculty: 300,
    established: 2010
  });
});

// 3. Program Filters
app.get('/api/programs/filters', (req, res) => {
  res.json({
    disciplines: ["Computer Science", "Botany", "Chemistry"],
    levels: ["Bachelor", "Master", "PhD"]
  });
});

// 4. Programs List
app.get('/api/programs', (req, res) => {
  res.json({
    data: [
      { id: 1, title: "BS Computer Science", level: "Bachelor", duration: "4 Years" },
      { id: 2, title: "BS Botany", level: "Bachelor", duration: "4 Years" },
      { id: 3, title: "MBA", level: "Master", duration: "2 Years" }
    ],
    total: 3,
    page: 1,
    limit: 6
  });
});

// 5. Dynamic Pages (VC Message, About, etc.)
app.get('/api/pages/:slug', (req, res) => {
  // Make sure the slugs match exactly what your frontend is requesting
  const slug = req.params.slug;
  
  if (slug === 'vice-chancellors-message') {
    res.json({
      title: "Message from the Vice Chancellor",
      content: "Welcome to the University of Swat. This is the official message from the Vice Chancellor. (Placeholder content)"
    });
  } else if (slug === 'about-university') {
    res.json({
      title: "About University of Swat",
      content: "The University of Swat is a public sector university located in the scenic valley of Swat, Khyber Pakhtunkhwa. (Placeholder content)"
    });
  } else {
    // Default fallback for any other page
    res.json({
      title: "Page Not Found",
      content: "The page you are looking for does not exist."
    });
  }
});

// 6. Content (News, Announcements, Events)
app.get('/api/content', (req, res) => {
  const category = req.query.category || 'news';
  res.json([
    { id: 1, title: `Mock ${category} item 1`, date: "2026-11-13" },
    { id: 2, title: `Mock ${category} item 2`, date: "2026-11-12" },
    { id: 3, title: `Mock ${category} item 3`, date: "2026-11-11" }
  ]);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Backend API successfully running on http://localhost:${PORT}`);
});