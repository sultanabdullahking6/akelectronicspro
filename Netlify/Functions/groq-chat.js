// =========================================================
// AKNexa AI — GROQ SERVER-SIDE PROXY (Netlify Function)
// Yeh function browser ki jagah Groq API ko call karta hai,
// taake asal Groq API key kabhi client-side JS mein na jaye.
//
// Key kahan se aati hai: Netlify Environment Variable "GROQ_API_KEY"
// (Site settings > Environment variables > Add a variable)
// =========================================================

exports.handler = async (event) => {
  // Sirf POST allow karo
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Groq API key not configured. Netlify me GROQ_API_KEY environment variable add karein aur redeploy karein."
      })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body" })
    };
  }

  const { messages, model, temperature, max_tokens } = payload;

  if (!messages || !Array.isArray(messages)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "messages array is required" })
    };
  }

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || "openai/gpt-oss-20b",
        messages: messages,
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens ?? 1024
      })
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      return {
        statusCode: groqResponse.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: data.error?.message || "Groq API error" })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Server error while calling Groq" })
    };
  }
};
