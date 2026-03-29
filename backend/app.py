import os
import glob
from flask import Flask, jsonify, request
from flask_cors import CORS
from turtle_test import get_wall_json
from t import detect_gates_robust, detect_windows_json

app = Flask(__name__)
CORS(app)

TEST_DIR = os.path.join(os.path.dirname(__file__), 'test')

def get_image_path(image_name):
    """Resolve and validate an image path inside the test directory."""
    if not image_name:
        # Default to the first available PNG
        pngs = sorted(glob.glob(os.path.join(TEST_DIR, '*.png')))
        if not pngs:
            raise FileNotFoundError("No PNG files found in test/ directory")
        return pngs[0]
    # Security: strip any path separators so callers can't escape the folder
    safe_name = os.path.basename(image_name)
    path = os.path.join(TEST_DIR, safe_name)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Image '{safe_name}' not found in test/ directory")
    return path


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
    Analyse a floor plan PNG and return walls, windows, and gates.
    Optional query parameter: ?image=F3.png  (defaults to first PNG found)
    """
    try:
        image_name = request.args.get('image', '')
        image_path = get_image_path(image_name)

        walls_data  = get_wall_json(image_path)
        windows     = detect_windows_json(image_path, headless=True)
        _, gates    = detect_gates_robust(image_path, headless=True)

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


if __name__ == "__main__":
    app.run(debug=True, port=5000)