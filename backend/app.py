import os
import glob
import traceback
from flask import Flask, jsonify, request
from flask_cors import CORS

# Inner pipeline — room/window/gate detection (main/ project)
from turtle_test import get_wall_json
from t import detect_gates_robust, detect_windows_json

# Outer pipeline — structural classification and material analysis
# These modules come from the 3DFloorGenerator/backend side
from main import get_Cordinates as get_classified_walls
from material_analysis import MaterialAnalyser, StructuralElement, build_explainability_prompt

# Gemini AI
import google.generativeai as genai

# ── Configure Gemini ──────────────────────────────────────────────────────────
# Set your API key here or load from environment variable
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "Your_API_KEY_here")
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel("gemini-2.5-flash")

app = Flask(__name__)
CORS(app)

analyser = MaterialAnalyser()

TEST_DIR = os.path.join(os.path.dirname(__file__), 'test')


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_image_path(image_name):
    """Resolve and validate an image path inside the test directory."""
    if not image_name:
        pngs = sorted(glob.glob(os.path.join(TEST_DIR, '*.png')))
        if not pngs:
            raise FileNotFoundError("No PNG files found in test/ directory")
        return pngs[0]
    safe_name = os.path.basename(image_name)
    path = os.path.join(TEST_DIR, safe_name)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Image '{safe_name}' not found in test/ directory")
    return path


def _build_elements(walls: list[dict]) -> list[StructuralElement]:
    """Build StructuralElement list from classified wall data + inferred slab/columns."""
    elements = []

    for w in walls:
        elements.append(StructuralElement(
            element_id=   w["element_id"],
            element_type= w["element_type"],
            room_label=   "Outer Wall" if w["is_outer"] else
                          ("Spine Wall" if w["is_spine"] else "Interior Wall"),
            span_m=       w["span_m"],
            area_m2=      round(w["span_m"] * 3.0, 2),
            is_outer=     w["is_outer"],
            is_spine=     w["is_spine"],
        ))

    if walls:
        all_x = [w["start"]["x"] for w in walls] + [w["end"]["x"] for w in walls]
        all_y = [w["start"]["y"] for w in walls] + [w["end"]["y"] for w in walls]
        width_m  = (max(all_x) - min(all_x)) / 41.0
        depth_m  = (max(all_y) - min(all_y)) / 41.0
        area_m2  = round(width_m * depth_m, 1)
        max_span = round(max(width_m, depth_m), 2)

        elements.append(StructuralElement(
            element_id="SLAB-GF",
            element_type="slab",
            room_label="Ground Floor Slab",
            span_m=max_span,
            area_m2=area_m2,
        ))

        for i, (cx, cy) in enumerate([
            (min(all_x), min(all_y)), (max(all_x), min(all_y)),
            (min(all_x), max(all_y)), (max(all_x), max(all_y)),
        ]):
            elements.append(StructuralElement(
                element_id=f"COL-{i+1}",
                element_type="column",
                room_label=f"Corner Column {i+1}",
                span_m=0.0,
                area_m2=0.09,
            ))

    return elements


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/api/images')
def list_images():
    """Return the list of available floor plan PNGs."""
    try:
        pngs = sorted(glob.glob(os.path.join(TEST_DIR, '*.png')))
        names = [os.path.basename(p) for p in pngs]
        return jsonify({"status": "success", "images": names})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/data')
def get_data():
    """
    Inner pipeline — walls, windows, gates for 3D rendering.
    Optional query param: ?image=F3.png
    """
    try:
        image_name = request.args.get('image', '')
        image_path = get_image_path(image_name)

        walls_data = get_wall_json(image_path)
        windows    = detect_windows_json(image_path, headless=True)
        _, gates   = detect_gates_robust(image_path, headless=True)

        return jsonify({
            "status":  "success",
            "image":   os.path.basename(image_path),
            "data":    walls_data,
            "windows": windows,
            "gates":   gates,
        })
    except FileNotFoundError as e:
        return jsonify({"status": "error", "message": str(e)}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/material-analysis')
def material_analysis():
    """
    Full structural pipeline:
      1. Parse floor plan with structural classifier (main.py / OpenCV)
      2. Classify walls + infer slab/columns
      3. Run material tradeoff analysis
      4. Return enriched JSON for the frontend structural panel
    """
    try:
        walls    = get_classified_walls()
        elements = _build_elements(walls)
        analyser.analyse(elements)
        result   = analyser.to_dict(elements)

        # Merge wall coordinate data into analysis results
        wall_map = {w["element_id"]: w for w in walls}
        for r in result:
            wdata = wall_map.get(r["element_id"])
            if wdata:
                r["start"]     = wdata["start"]
                r["end"]       = wdata["end"]
                r["length_px"] = wdata["length_px"]

        # Attach LLM explainability prompt text
        for i, el in enumerate(elements):
            result[i]["prompt_text"] = build_explainability_prompt(el)

        load_bearing = [r for r in result if r["element_type"] == "load_bearing_wall"]
        partitions   = [r for r in result if r["element_type"] == "partition_wall"]

        return jsonify({
            "status": "success",
            "summary": {
                "total_elements":     len(result),
                "load_bearing_walls": len(load_bearing),
                "partition_walls":    len(partitions),
                "slabs":              len([r for r in result if r["element_type"] == "slab"]),
                "columns":            len([r for r in result if r["element_type"] == "column"]),
            },
            "analysis": result,
            "walls":    walls,
        })

    except Exception as e:
        return jsonify({
            "status":  "error",
            "message": str(e),
            "trace":   traceback.format_exc(),
        }), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    """
    AI chatbot endpoint — Gemini answers questions about a structural element.
    Body: { "question": "...", "element": { ...full element dict... } }
    """
    try:
        body     = request.get_json()
        question = body.get('question', '')
        el       = body.get('element', {})

        prompt = f"""
        You are a highly experienced Structural Engineer and Construction Expert with 20+ years of field expertise.
        Answer the user's question about the floor plan element below.

        ELEMENT CONTEXT:
        - Element ID      : {el.get('element_id')}
        - Type            : {el.get('element_type')}
        - Span            : {el.get('span_m')} meters
        - Current Material: {el.get('recommendations', [{}])[0].get('material', 'None')}

        USER QUESTION: {question}

        RESPONSE RULES (follow strictly):
        1. Always answer in clear, numbered bullet points — no paragraphs.
        2. Be direct and confident. Never use uncertain language like "it depends", "maybe", or "could be". State facts decisively.
        3. Dedicate at least one bullet point to a detailed "Why?" explanation — explain the structural or engineering reasoning.
        4. Where relevant, cite structural safety standards, material properties, or load-bearing principles.
        5. End with a one-line "Bottom Line:" summary giving a definitive recommendation.

        FORMAT EXAMPLE:
        • Point 1 — direct factual statement.
        • Point 2 — next key fact.
        • Why? — detailed engineering reason.
        • Safety Note — any critical safety consideration.
        • Bottom Line: Clear, confident final recommendation.
        """

        response = gemini_model.generate_content(prompt)
        return jsonify({"answer": response.text})

    except Exception as e:
        return jsonify({"answer": f"Gemini Error: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)