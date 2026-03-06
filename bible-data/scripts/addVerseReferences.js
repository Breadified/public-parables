/**
 * Add verse references to apologetics questions
 */

const fs = require('fs');
const path = require('path');

// Read the current JSON
const jsonPath = path.join(__dirname, '../../frontend/assets/data/apologeticsQuestions.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Verse mappings based on question topics
const verseMap = {
  // Does God Even Exist?
  'creator': [
    { reference: 'Psalm 90:2', bookNumber: 19, chapter: 90, verseStart: 2, verseEnd: null },
    { reference: 'Isaiah 44:6', bookNumber: 23, chapter: 44, verseStart: 6, verseEnd: null },
  ],
  'hide': [
    { reference: 'Romans 1:20', bookNumber: 45, chapter: 1, verseStart: 20, verseEnd: null },
    { reference: 'Jeremiah 29:13', bookNumber: 24, chapter: 29, verseStart: 13, verseEnd: null },
  ],
  'proof': [
    { reference: 'Hebrews 11:1', bookNumber: 58, chapter: 11, verseStart: 1, verseEnd: null },
    { reference: 'Romans 1:19-20', bookNumber: 45, chapter: 1, verseStart: 19, verseEnd: 20 },
  ],
  'invented': [
    { reference: 'Acts 17:24-28', bookNumber: 44, chapter: 17, verseStart: 24, verseEnd: 28 },
    { reference: 'Ecclesiastes 3:11', bookNumber: 21, chapter: 3, verseStart: 11, verseEnd: null },
  ],

  // Problem of Evil
  'suffering': [
    { reference: 'Romans 8:28', bookNumber: 45, chapter: 8, verseStart: 28, verseEnd: null },
    { reference: 'James 1:2-4', bookNumber: 59, chapter: 1, verseStart: 2, verseEnd: 4 },
  ],
  'cancer': [
    { reference: 'John 9:1-3', bookNumber: 43, chapter: 9, verseStart: 1, verseEnd: 3 },
    { reference: 'Romans 8:18', bookNumber: 45, chapter: 8, verseStart: 18, verseEnd: null },
  ],
  'evil': [
    { reference: 'Genesis 3:1-7', bookNumber: 1, chapter: 3, verseStart: 1, verseEnd: 7 },
    { reference: 'Romans 5:12', bookNumber: 45, chapter: 5, verseStart: 12, verseEnd: null },
  ],
  'disaster': [
    { reference: 'Matthew 5:45', bookNumber: 40, chapter: 5, verseStart: 45, verseEnd: null },
    { reference: 'Job 38:1-4', bookNumber: 18, chapter: 38, verseStart: 1, verseEnd: 4 },
  ],

  // Jesus
  'ignorant': [
    { reference: 'Mark 13:32', bookNumber: 41, chapter: 13, verseStart: 32, verseEnd: null },
    { reference: 'Philippians 2:6-8', bookNumber: 50, chapter: 2, verseStart: 6, verseEnd: 8 },
  ],
  'resurrection': [
    { reference: '1 Corinthians 15:3-8', bookNumber: 46, chapter: 15, verseStart: 3, verseEnd: 8 },
    { reference: 'Romans 1:4', bookNumber: 45, chapter: 1, verseStart: 4, verseEnd: null },
  ],
  'decades': [
    { reference: 'Luke 1:1-4', bookNumber: 42, chapter: 1, verseStart: 1, verseEnd: 4 },
    { reference: '2 Peter 1:16', bookNumber: 61, chapter: 1, verseStart: 16, verseEnd: null },
  ],
  'legend': [
    { reference: '1 John 1:1-3', bookNumber: 62, chapter: 1, verseStart: 1, verseEnd: 3 },
    { reference: 'John 21:24', bookNumber: 43, chapter: 21, verseStart: 24, verseEnd: null },
  ],

  // Bible trustworthy
  'manuscripts': [
    { reference: '2 Timothy 3:16', bookNumber: 55, chapter: 3, verseStart: 16, verseEnd: null },
    { reference: '2 Peter 1:21', bookNumber: 61, chapter: 1, verseStart: 21, verseEnd: null },
  ],
  'errors': [
    { reference: 'Psalm 119:160', bookNumber: 19, chapter: 119, verseStart: 160, verseEnd: null },
    { reference: 'Matthew 5:18', bookNumber: 40, chapter: 5, verseStart: 18, verseEnd: null },
  ],
  'contradictions': [
    { reference: 'John 10:35', bookNumber: 43, chapter: 10, verseStart: 35, verseEnd: null },
    { reference: 'Isaiah 40:8', bookNumber: 23, chapter: 40, verseStart: 8, verseEnd: null },
  ],
  'translations': [
    { reference: 'Psalm 12:6-7', bookNumber: 19, chapter: 12, verseStart: 6, verseEnd: 7 },
    { reference: 'Matthew 24:35', bookNumber: 40, chapter: 24, verseStart: 35, verseEnd: null },
  ],

  // Science
  'miracles': [
    { reference: 'John 20:30-31', bookNumber: 43, chapter: 20, verseStart: 30, verseEnd: 31 },
    { reference: 'Hebrews 2:4', bookNumber: 58, chapter: 2, verseStart: 4, verseEnd: null },
  ],
  'evolution': [
    { reference: 'Genesis 1:1', bookNumber: 1, chapter: 1, verseStart: 1, verseEnd: null },
    { reference: 'Psalm 19:1', bookNumber: 19, chapter: 19, verseStart: 1, verseEnd: null },
  ],
  'scientific': [
    { reference: 'Colossians 1:16-17', bookNumber: 51, chapter: 1, verseStart: 16, verseEnd: 17 },
    { reference: 'Job 38:4-7', bookNumber: 18, chapter: 38, verseStart: 4, verseEnd: 7 },
  ],

  // Exclusive claims
  'hell': [
    { reference: 'John 14:6', bookNumber: 43, chapter: 14, verseStart: 6, verseEnd: null },
    { reference: 'Romans 6:23', bookNumber: 45, chapter: 6, verseStart: 23, verseEnd: null },
  ],
  'sincere': [
    { reference: 'Acts 4:12', bookNumber: 44, chapter: 4, verseStart: 12, verseEnd: null },
    { reference: '1 Timothy 2:5', bookNumber: 54, chapter: 2, verseStart: 5, verseEnd: null },
  ],
  'arrogant': [
    { reference: 'John 3:16-17', bookNumber: 43, chapter: 3, verseStart: 16, verseEnd: 17 },
    { reference: 'Matthew 28:19-20', bookNumber: 40, chapter: 28, verseStart: 19, verseEnd: 20 },
  ],

  // Character of God
  'torture': [
    { reference: 'Ezekiel 33:11', bookNumber: 26, chapter: 33, verseStart: 11, verseEnd: null },
    { reference: '2 Peter 3:9', bookNumber: 61, chapter: 3, verseStart: 9, verseEnd: null },
  ],
  'worship': [
    { reference: 'Revelation 4:11', bookNumber: 66, chapter: 4, verseStart: 11, verseEnd: null },
    { reference: 'Psalm 145:3', bookNumber: 19, chapter: 145, verseStart: 3, verseEnd: null },
  ],
  'jealous': [
    { reference: 'Exodus 20:5', bookNumber: 2, chapter: 20, verseStart: 5, verseEnd: null },
    { reference: 'Deuteronomy 4:24', bookNumber: 5, chapter: 4, verseStart: 24, verseEnd: null },
  ],
  'angry': [
    { reference: 'Psalm 103:8', bookNumber: 19, chapter: 103, verseStart: 8, verseEnd: null },
    { reference: 'Nahum 1:3', bookNumber: 34, chapter: 1, verseStart: 3, verseEnd: null },
  ],

  // Bible morality
  'morality': [
    { reference: 'Romans 2:14-15', bookNumber: 45, chapter: 2, verseStart: 14, verseEnd: 15 },
    { reference: 'Psalm 119:105', bookNumber: 19, chapter: 119, verseStart: 105, verseEnd: null },
  ],
  'slavery': [
    { reference: 'Galatians 3:28', bookNumber: 48, chapter: 3, verseStart: 28, verseEnd: null },
    { reference: 'Philemon 1:15-16', bookNumber: 57, chapter: 1, verseStart: 15, verseEnd: 16 },
  ],
  'genocide': [
    { reference: 'Deuteronomy 20:16-18', bookNumber: 5, chapter: 20, verseStart: 16, verseEnd: 18 },
    { reference: 'Genesis 15:16', bookNumber: 1, chapter: 15, verseStart: 16, verseEnd: null },
  ],
  'women': [
    { reference: 'Galatians 3:28', bookNumber: 48, chapter: 3, verseStart: 28, verseEnd: null },
    { reference: 'Proverbs 31:10-31', bookNumber: 20, chapter: 31, verseStart: 10, verseEnd: 31 },
  ],
  'ancient': [
    { reference: 'Hebrews 13:8', bookNumber: 58, chapter: 13, verseStart: 8, verseEnd: null },
    { reference: 'Isaiah 40:8', bookNumber: 23, chapter: 40, verseStart: 8, verseEnd: null },
  ],

  // Faith and doubt
  'doubt': [
    { reference: 'James 1:5-6', bookNumber: 59, chapter: 1, verseStart: 5, verseEnd: 6 },
    { reference: 'Mark 9:24', bookNumber: 41, chapter: 9, verseStart: 24, verseEnd: null },
  ],
  'faith': [
    { reference: 'Hebrews 11:6', bookNumber: 58, chapter: 11, verseStart: 6, verseEnd: null },
    { reference: 'Romans 10:17', bookNumber: 45, chapter: 10, verseStart: 17, verseEnd: null },
  ],
  'honest': [
    { reference: 'Psalm 145:18', bookNumber: 19, chapter: 145, verseStart: 18, verseEnd: null },
    { reference: 'John 7:17', bookNumber: 43, chapter: 7, verseStart: 17, verseEnd: null },
  ],

  // Default fallback
  'default': [
    { reference: 'Isaiah 55:8-9', bookNumber: 23, chapter: 55, verseStart: 8, verseEnd: 9 },
    { reference: 'Proverbs 3:5-6', bookNumber: 20, chapter: 3, verseStart: 5, verseEnd: 6 },
  ],
};

// Function to find matching verses for a question
function findVerses(questionText) {
  const text = questionText.toLowerCase();

  for (const [keyword, verses] of Object.entries(verseMap)) {
    if (keyword !== 'default' && text.includes(keyword)) {
      return verses;
    }
  }

  // Additional keyword checks
  if (text.includes('powerful') || text.includes('loving') || text.includes('children') || text.includes('suffer')) {
    return verseMap['suffering'];
  }
  if (text.includes('zeus') || text.includes('thor') || text.includes('deity')) {
    return verseMap['sincere'];
  }
  if (text.includes('science') || text.includes('natural laws')) {
    return verseMap['scientific'];
  }
  if (text.includes('trusted') || text.includes('reliable') || text.includes('trust')) {
    return verseMap['manuscripts'];
  }
  if (text.includes('believe') || text.includes('blind')) {
    return verseMap['faith'];
  }
  if (text.includes('violence') || text.includes('kill')) {
    return verseMap['evil'];
  }
  if (text.includes('lgbtq') || text.includes('outdated') || text.includes('sexuality')) {
    return verseMap['morality'];
  }
  if (text.includes('middle eastern')) {
    return verseMap['ancient'];
  }
  if (text.includes('free will')) {
    return verseMap['evil'];
  }
  if (text.includes('prayer')) {
    return [
      { reference: 'James 5:16', bookNumber: 59, chapter: 5, verseStart: 16, verseEnd: null },
      { reference: 'Matthew 7:7-8', bookNumber: 40, chapter: 7, verseStart: 7, verseEnd: 8 },
    ];
  }

  return verseMap['default'];
}

// Add verses to each question
let added = 0;
for (const q of data.questions) {
  if (!q.verseReferences || q.verseReferences.length === 0) {
    q.verseReferences = findVerses(q.questionText);
    added++;
  }
}

// Write back
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
console.log(`Added verse references to ${added} questions`);
