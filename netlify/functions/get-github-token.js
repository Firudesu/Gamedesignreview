exports.handler = async function(event, context) {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Get the GitHub token from environment variables
  const githubToken = process.env.GITHUB_TOKEN;
  
  if (!githubToken) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GitHub token not configured' })
    };
  }

  // Return the token (in production, you might want to return a session token instead)
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Configure this properly for production
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify({ token: githubToken })
  };
};