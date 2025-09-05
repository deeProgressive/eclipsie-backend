import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  // Geliştirme/test için CORS serbest (ileride domain'e kısarız)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  try {
    const { birthJson, userPrompt } = req.body || {};
    if (!birthJson) return res.status(400).json({ error: "birthJson required" });

    const openaiResp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        input: [
          {
            role: "system",
            content: `You are “Eclipsie”, a warm, mystical yet grounded astrologer.
- Output language: Turkish.
- No medical/financial/legal advice.
- Don't echo raw birth details.
- Return STRICT JSON by the provided schema.`
          },
          {
            role: "user",
            content: JSON.stringify({
              birth: birthJson,
              question: userPrompt ?? "Genel yorum"
            })
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "AstroReading",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string" },
                love: { type: "string" },
                career: { type: "string" },
                health: { type: "string" },
                caution_notes: { type: "array", items: { type: "string" } }
              },
              required: ["summary","love","career"]
            },
            strict: true
          }
        }
      })
    });

    const data = await openaiResp.json();
    if (!openaiResp.ok) return res.status(openaiResp.status).json(data);

    // Structured outputs kullandığımız için genelde output_parsed gelir:
    const parsed = data.output_parsed ?? data;
    res.status(200).json(parsed);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
}
