export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  if (!process.env.GITHUB_TOKEN) {
    return { statusCode: 500, body: "Missing GitHub token" };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `data/session-${timestamp}.json`;
    const content = Buffer.from(JSON.stringify(body, null, 2)).toString("base64");

    const response = await fetch(
      `https://api.github.com/repos/${process.env.GITHUB_REPO}/contents/${filename}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Add ${filename}`,
          content,
          branch: process.env.GITHUB_BRANCH || "main",
          committer: {
            name: process.env.GITHUB_COMMITTER_NAME || "Spider of Lore",
            email:
              process.env.GITHUB_COMMITTER_EMAIL || "spider@users.noreply.github.com",
          },
        }),
      }
    );

    const text = await response.text();
    return {
      statusCode: response.ok ? 200 : response.status || 500,
      body: text,
    };
  } catch (error) {
    return { statusCode: 500, body: error.message || "Unknown error" };
  }
};
