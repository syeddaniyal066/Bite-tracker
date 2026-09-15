import os
import json
import base64
import re
import requests
from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "")
QWEN_MODEL = os.environ.get("QWEN_MODEL", "qwen-vl-plus")
QWEN_API_URL = os.environ.get(
    "QWEN_API_URL",
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions"
)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


def extract_json(text):
    text = text.strip()
    text = re.sub(r"^```(?:json)?\\s*", "", text, flags=re.I)
    text = re.sub(r"\\s*```$", "", text)

    try:
        return json.loads(text)
    except Exception:
        match = re.search(r"\\{.*\\}", text, flags=re.S)
        if not match:
            raise ValueError("Qwen did not return valid JSON.")
        return json.loads(match.group(0))


@app.route("/")
def home():
    return render_template("index.html")


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.post("/api/analyze")
def analyze():
    if not DASHSCOPE_API_KEY:
        return jsonify({"error": "DASHSCOPE_API_KEY is missing in .env"}), 500

    image = request.files.get("image")
    if not image:
        return jsonify({"error": "No image received."}), 400

    mime_type = image.mimetype or "image/jpeg"
    if mime_type not in ALLOWED_TYPES:
        return jsonify({"error": "Please use JPG, PNG, or WEBP."}), 400

    image_bytes = image.read()
    if not image_bytes:
        return jsonify({"error": "The image is empty."}), 400

    encoded = base64.b64encode(image_bytes).decode("utf-8")
    image_data = f"data:{mime_type};base64,{encoded}"

    prompt = """
You are Bite Tracker, a child-friendly food image evaluator for a student project.

Study the uploaded food image and return:
1. The main food or meal name.
2. A general health rating from 1 to 5.
3. One short reason.
4. One short improvement tip.
5. One category.

Rating:
1 = very unhealthy
2 = mostly unhealthy
3 = average / mixed
4 = healthy
5 = very healthy

Rules:
- Judge only what is reasonably visible.
- Do not invent exact calories, exact ingredients, allergies, weight, or serving size.
- If uncertain, make a cautious best estimate.
- Keep the reason and tip short and simple.
- Return ONLY valid JSON with no markdown or extra text.

Use exactly:
{
  "food": "food name",
  "rating": 4,
  "reason": "short reason",
  "tip": "short improvement tip",
  "category": "Fruit | Vegetable | Protein | Grain | Dairy | Snack | Fast Food | Mixed Meal | Drink | Other"
}
""".strip()

    payload = {
    "model": QWEN_MODEL,

    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_data
                    }
                },
                {
                    "type": "text",
                    "text": prompt
                }
            ]
        }
    ],

    "response_format": {
        "type": "json_object"
    },

    "temperature": 0.2
}

    try:
        response = requests.post(
            QWEN_API_URL,
            headers={
                "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
                "Content-Type": "application/json"
            },
            json=payload,
            timeout=60
        )

        if response.status_code != 200:
            try:
                details = response.json()
            except Exception:
                details = response.text[:500]

            return jsonify({
                "error": "Qwen API error.",
                "details": details
            }), 502

        data = response.json()
        content = data["choices"][0]["message"]["content"]

        if isinstance(content, list):
            text_parts = []
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    text_parts.append(part.get("text", ""))
            content = "\n".join(text_parts).strip()

        result = extract_json(content)

        try:
            score = int(round(float(result.get("rating", 3))))
        except Exception:
            score = 3

        result["rating"] = max(1, min(5, score))
        result["food"] = str(result.get("food", "Food"))
        result["reason"] = str(result.get("reason", "General estimate from the visible food."))
        result["tip"] = str(result.get("tip", "Try to make your meal balanced."))
        result["category"] = str(result.get("category", "Other"))

        return jsonify(result)

    except requests.exceptions.RequestException as exc:
        return jsonify({
            "error": "Could not connect to Qwen.",
            "details": str(exc)
        }), 502

    except Exception as exc:
        return jsonify({
            "error": "Could not analyze image.",
            "details": str(exc)
        }), 500


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=True
    )
