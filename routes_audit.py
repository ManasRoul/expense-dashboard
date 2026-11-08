"""Audit log viewer route."""

from flask import Blueprint, jsonify, session
import os
import json
from helpers import is_feature_enabled

audit_bp = Blueprint('audit', __name__)


@audit_bp.route('/api/audit-log', methods=['GET'])
def get_audit_log():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can view the audit log'}), 403
        if not is_feature_enabled('feature_audit_log'):
            return jsonify({'error': 'The audit log page is disabled'}), 403

        entries = []
        if os.path.exists('audit.log'):
            with open('audit.log', 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue  # skip malformed lines rather than failing the whole request

        # Newest first, capped to the most recent 1000 entries
        entries.reverse()
        return jsonify(entries[:1000]), 200
    except Exception as e:
        print(f"Error reading audit log: {e}")
        return jsonify({'error': str(e)}), 500
