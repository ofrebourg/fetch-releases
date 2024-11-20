import fetch from 'node-fetch';

if (!process.env.TOKEN || !process.env.OWNER || !process.env.OWNER) {
  console.log(
    'You need to define the following variables:\n' +
    ' - TOKEN: token to access the repo\n' +
    ' - OWNER: github owner\n' +
    ' - REPO: github repository name\n' +
    ' - YEAR: set to 2024 by default\n'
  )
  process.exit(-1)
}

const GITHUB_TOKEN = process.env.TOKEN; // Replace with your token (if needed for private repos or rate limits)
const OWNER = process.env.OWNER;
const REPO = process.env.REPO;
const BASE_URL = `https://api.github.com/repos/${OWNER}/${REPO}/releases`;
const YEAR = parseInt(process.env.YEAR, 10) || 2024;

// categories:
//   - title: '🙋‍♂️ Customer Value'
//     labels:
//       - 'customer-facing 🙋‍♂️'
//   - title: '🚀 Features'
//     labels:
//       - 'enhancement'
//   - title: '🐛 Bug fixes'
//     labels:
//       - 'bug'
//   - title: '🧰 Maintenance, documentation and testing'
//     labels:
//       - 'chore'
//       - 'refactor'
//       - 'documentation'
//       - 'test'
//       - 'bump'

const categoriesToKeep = ['Customer Value', 'Features']

// Helper function to extract relevant categories from release body
function filterCategoriesFromMarkdown(markdown) {
  const lines = markdown.split("\n");
  let relevantContent = [];
  let keepSection = false;

  lines.forEach((line) => {
    // Check for category headings
    if (line.startsWith("## ")) {
      const category = line.replace("## ", "").trim();

      // Determine if the current section is relevant
      keepSection = categoriesToKeep.some((cat) =>
        category.toLowerCase().includes(cat.toLowerCase())
      );
    }

    // Collect content if in a relevant section
    if (keepSection) {
      relevantContent.push(line);
    }
  });

  return relevantContent.join("\n").trim();
}

// Helper function to fetch releases for a specific year
async function getReleasesForYear(year) {
  let releases = [];
  let page = 1;

  while (true) {
    const response = await fetch(`${BASE_URL}?page=${page}&per_page=100`, {
      headers: {
        Authorization: GITHUB_TOKEN ? `token ${GITHUB_TOKEN}` : undefined,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch releases: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();
    if (data.length === 0) break; // Break if no more releases

    // Filter releases by year
    for (const release of data) {
      const createdAt = new Date(release.created_at);
      if (createdAt.getFullYear() === year) {
        const filteredBody = filterCategoriesFromMarkdown(release.body || "");
        if (filteredBody) { // Only add releases with relevant content
          releases.push({
            created_at: release.created_at,
            name: release.name || "No name provided",
            html_url: release.html_url,
            body: filteredBody,
          });
        }
      } else if (createdAt.getFullYear() < year) {
        // Stop processing if we've passed the year (reverse chronological order)
        return releases;
      }
    }

    page++;
  }

  return releases;
}

// Main function to fetch and display the releases
(async () => {
  try {
    const releasesForTheYear = await getReleasesForYear(YEAR);

    console.log(
      `${REPO} Releases in ${YEAR}\n` +
      `\n--------------------\n`
    )

    // Display results
    releasesForTheYear.forEach((release) => {
      console.log(
        `Created At: ${release.created_at}\n` +
        `Tag: ${release.tag_name}\n` +
        `Name: ${release.name}\n` +
        `URL: ${release.html_url}\n` +
        `\n${release.body}\n` +
        `\n--------------------\n`
      );
    });
  } catch (error) {
    console.error("Error fetching releases:", error);
  }
})();
