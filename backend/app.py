from flask import Flask, jsonify
from flask_cors import CORS  # Import this
from main import get_Cordinates
from test import extract_coordinates
from turtle_test import get_wall_json
from window_test import get_windows_json
from t import detect_gates_robust, detect_windows_json
app = Flask(__name__)
CORS(app)  # This line enables CORS for all routes

@app.route('/api/data')
def get_data():
    try:
        raw_coords =  get_wall_json('test/F3.png') 
        windows= detect_windows_json('test/F3.png')
        mask, gates_data = detect_gates_robust('test/F3.png')

        # Call the function to get coordinates
        return jsonify({
            "status": "success",
            "data": raw_coords,
            "windows":windows,
            "gates": gates_data
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)