"""Auth routes: login/logout/check-auth, and the index page."""

from flask import Blueprint, request, jsonify, session, send_from_directory
from datetime import datetime
from config import USE_MYSQL
from helpers import execute_query, audit_log, verify_password, limiter

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/')
def index():
    return send_from_directory('.', 'login.html')


@auth_bp.route('/api/login', methods=['POST'])
@limiter.limit("5 per minute")  # Max 5 login attempts per minute
def login():
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            audit_log('LOGIN', success=False, details={'reason': 'Missing credentials'})
            return jsonify({'error': 'Username and password are required'}), 400

        # Get user by username only (password_hash included for verification)
        placeholder = '%s' if USE_MYSQL else '?'
        query = f"SELECT id, username, role, password_hash FROM users WHERE username = {placeholder}"
        user = execute_query(query, (username,), fetch=True, fetchone=True)

        # Verify password with salt
        if user and verify_password(user['password_hash'], password):
            # Set session
            session['user_id'] = user['id']
            session['username'] = user['username']
            session['role'] = user['role']
            session['last_activity'] = datetime.now().timestamp()
            session.permanent = True

            audit_log('LOGIN', success=True, details={'username': username})

            return jsonify({
                'message': 'Login successful',
                'username': user['username'],
                'role': user['role']
            }), 200
        else:
            audit_log('LOGIN', success=False, details={'username': username, 'reason': 'Invalid credentials'})
            return jsonify({'error': 'Invalid username or password'}), 401

    except Exception as e:
        print(f"Login error: {e}")
        audit_log('LOGIN', success=False, details={'error': str(e)})
        return jsonify({'error': 'An error occurred during login'}), 500


@auth_bp.route('/api/logout', methods=['POST'])
def logout():
    username = session.get('username')
    audit_log('LOGOUT', success=True, details={'username': username})
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200


@auth_bp.route('/api/check-auth', methods=['GET'])
def check_auth():
    if 'user_id' in session:
        return jsonify({
            'authenticated': True,
            'username': session.get('username')
        }), 200
    else:
        return jsonify({'authenticated': False}), 401
