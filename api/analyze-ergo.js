export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY fehlt in Vercel" });
  }

  try {
    const { imageBase64, mimeType = "image/jpeg", expectedDistanceM = null } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: "Kein Bild übergeben" });
    }

    const prompt = [
      "Du bist ein präziser Assistent für Rudersport-Auswertungen (Concept2 Ergometer oder Ergebnislisten).",
      expectedDistanceM ? `Erwartete Distanz aus dem Trainingsfenster: ${expectedDistanceM} m.` : "",
      "Lies alle relevanten Leistungsdaten aus dem Bild aus und gib AUSSCHLIESSLICH gültiges JSON zurück:",
      '{"distance_m": number|null, "formatted_time": string|null, "total_time_ms": number|null, "pace_500m": string|null, "watts": number|null, "stroke_rate": number|null, "notes": string}',
      "Regeln:",
      '- "formatted_time" als "m:ss.d" oder "mm:ss.d" (z. B. "6:12.4").',
      '- "total_time_ms" als Gesamtzeit in Millisekunden (falls erkennbar, sonst null).',
      '- "pace_500m" als Schnitt pro 500 m (z. B. "1:33.1", falls erkennbar).',
      '- Wenn ein Wert unscharf oder unleserlich ist, setze ihn auf null und notiere den Grund kurz in "notes".'
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
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
                    mime_type: mimeType,
                    data: imageBase64
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

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(rawText);

    return res.status(200).json({
      distance_m: parsed.distance_m ?? null,
      formatted_time: parsed.formatted_time ?? null,
      total_time_ms: parsed.total_time_ms ?? null,
      pace_500m: parsed.pace_500m ?? null,
      watts: parsed.watts ?? null,
      stroke_rate: parsed.stroke_rate ?? null,
      notes: parsed.notes || ""
    });
  } catch (err) {
    return res.status(500).json({
      error: err?.message || "Auswertung fehlgeschlagen"
    });
  }
}
