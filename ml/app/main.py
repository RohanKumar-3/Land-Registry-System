from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os

load_dotenv()

def create_app():
    """
    Flask application factory.
    Creates and configures the Flask app.
    """
    app = Flask(__name__)
    
    # Allow requests from frontend and backend
    CORS(app, resources={
        r"/*": {
            "origins": [
                "http://localhost:5173",   # Vite frontend
                "http://localhost:5000",   # Express backend
                "http://localhost:3000",   # Alternative frontend port
            ]
        }
    })

    # Register route blueprints
    from app.routes.verify import verify_bp
    app.register_blueprint(verify_bp)

    # Log startup info
    @app.before_request
    def log_request():
        pass  # Can add request logging here

    return app


if __name__ == '__main__':
    app = create_app()
    port = int(os.getenv('FLASK_PORT', 8000))
    debug = os.getenv('FLASK_DEBUG', 'true').lower() == 'true'

    print('\n╔══════════════════════════════════════════╗')
    print('║       LandChain ML Service 🛰️            ║')
    print('╠══════════════════════════════════════════╣')
    print(f'║  Port:      {port}                          ║')
    print(f'║  Mock Mode: {os.getenv("USE_MOCK_SATELLITE","true")}                       ║')
    print(f'║  Endpoints:                              ║')
    print(f'║    POST /verify                          ║')
    print(f'║    GET  /health                          ║')
    print(f'║    GET  /test-image                      ║')
    print('╚══════════════════════════════════════════╝\n')

    app.run(debug=debug, port=port, host='0.0.0.0')