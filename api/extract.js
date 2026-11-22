export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY fehlt in Vercel" });
  }

  try {
    const { image } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: "Kein Bild übergeben" });
    }

    const prompt = `Lies aus diesem Foto eines Ergometer-Displays (z. B. Concept2) oder einer Rudersport-Ergebnisliste alle erkennbaren Leistungsdaten aus.
Gib AUSSCHLIESSLICH gültiges JSON im Format {"rows":[...]} zurück.
Jedes Element in "rows" soll diese Felder haben:
{"name": string|null, "time": string|null, "split": string|null, "watt": string|null, "spm": string|null, "distance_m": string|null, "date": string|null, "boat": string|null}
Regeln:
- "time" z. B. "6:12,4" oder "6:12.4".
- "split" als 500m-Schnitt z. B. "1:33,1".
- Wenn ein Feld nicht erkennbar ist, setze es auf null. Erfinde keine Werte.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: image
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1
          }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini API Fehler"
      });
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{"rows":[]}';
    const parsed = JSON.parse(rawText);
    return res.status(200).json({ rows: Array.isArray(parsed.rows) ? parsed.rows : [] });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Auswertung fehlgeschlagen" });
  }
}
