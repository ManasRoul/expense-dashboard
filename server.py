"""App entrypoint: creates the Flask app, registers each feature area's
Blueprint (see routes_*.py), and runs startup schema setup. All route logic
lives in the routes_*.py modules; shared DB/validation/auth helpers live in
helpers.py; schema setup lives in db_init.py."""

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from datetime import timedelta
import os
import secrets

from config import USE_MYSQL, MYSQL_CONFIG
from helpers import limiter, check_session_timeout
from db_init import init_db
import helpers as _helpers  # for load_known_category_keys at startup

from routes_auth import auth_bp
from routes_transactions import transactions_bp
from routes_reports import reports_bp
from routes_recurring import recurring_bp
from routes_salary import salary_bp
from routes_settings import settings_bp
from routes_audit import audit_bp


def _get_or_create_secret_key():
    """Use SECRET_KEY env var if set; otherwise persist a generated key to disk
    so it survives process restarts/multiple workers instead of regenerating
    (and silently invalidating every session) each time the app starts."""
    env_key = os.environ.get('SECRET_KEY')
    if env_key:
        return env_key
    key_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.secret_key')
    try:
        if os.path.exists(key_file):
            with open(key_file, 'r') as f:
                existing = f.read().strip()
                if existing:
                    return existing
        key = secrets.token_hex(32)
        with open(key_file, 'w') as f:
            f.write(key)
        return key
    except OSError:
        return secrets.token_hex(32)


app = Flask(__name__)
# Generate secure random secret key
app.secret_key = _get_or_create_secret_key()
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('SESSION_COOKIE_SECURE', 'false').lower() == 'true'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB cap on request bodies (receipt uploads)

# Configure CORS - allow from environment or default to localhost
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5000').split(',')
CORS(app,
     supports_credentials=True,
     origins=ALLOWED_ORIGINS,
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type'])


# Add no-cache headers for development
@app.after_request
def add_no_cache_headers(response):
    if response.content_type and 'javascript' in response.content_type:
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response


# Rate limiting - Limiter was created app-less in helpers.py to avoid a
# circular import; bind it to the app now that it exists.
limiter.init_app(app)

# Session timeout check, registered programmatically (the function itself
# lives in helpers.py so it doesn't need to import `app`).
app.before_request(check_session_timeout)

# Register each feature area's routes
app.register_blueprint(auth_bp)
app.register_blueprint(transactions_bp)
app.register_blueprint(reports_bp)
app.register_blueprint(recurring_bp)
app.register_blueprint(salary_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(audit_bp)

# Serve static files
ALLOWED_EXTENSIONS = {'.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf'}


# Catch-all static file route (must be AFTER all API routes/blueprints)
@app.route('/<path:path>')
def serve_static(path):
    ext = os.path.splitext(path)[1].lower()
    basename = os.path.basename(path)
    # Uploaded receipts must never be reachable through this unauthenticated route -
    # they're only ever served via the authenticated /api/transactions/<id>/receipts/<id> endpoint.
    if ext not in ALLOWED_EXTENSIONS or basename.startswith('.') or '..' in path or path.startswith('uploads/'):
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory('.', path)


# Initialize database on startup
try:
    print("[server.py] Initializing database...")
    print(f"[server.py] USE_MYSQL = {USE_MYSQL}")
    if USE_MYSQL:
        print(f"[server.py] DB_HOST = {MYSQL_CONFIG['host']}")
        print(f"[server.py] DB_USER = {MYSQL_CONFIG['user']}")
        print(f"[server.py] DB_NAME = {MYSQL_CONFIG['database']}")
    init_db()
    print("[server.py] Database initialized successfully")

    # Load categories from settings table
    _helpers.load_known_category_keys()
except Exception as e:
    print(f"[server.py] ERROR: Failed to initialize database: {e}")
    import traceback
    traceback.print_exc()
    # Don't crash the app, but log the error
    print("[server.py] App will continue but database may not be accessible")

if __name__ == '__main__':
    print("=" * 50)
    print("Financial Dashboard Server Starting...")
    print("=" * 50)
    print("Dashboard: http://localhost:5001/dashboard.html")
    print("Categories: http://localhost:5001/categories.html")
    print("Form: http://localhost:5001/form.html")
    print("=" * 50)
    app.run(debug=False, host='0.0.0.0', port=5001)
