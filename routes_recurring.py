"""Recurring transaction template routes."""

from flask import Blueprint, request, jsonify, session
from datetime import datetime
import json
from config import USE_MYSQL
from helpers import execute_query

recurring_bp = Blueprint('recurring', __name__)


@recurring_bp.route('/api/recurring-templates', methods=['POST'])
def create_recurring_template():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        data = request.json
        label = data.get('label')
        payload = data.get('payload')
        day_of_month = data.get('dayOfMonth')

        if not label or not payload:
            return jsonify({'error': 'label and payload are required'}), 400

        if day_of_month is not None:
            try:
                day_of_month = int(day_of_month)
                if day_of_month < 1 or day_of_month > 31:
                    return jsonify({'error': 'dayOfMonth must be between 1 and 31'}), 400
            except (TypeError, ValueError):
                return jsonify({'error': 'dayOfMonth must be a number'}), 400

        placeholder = '%s' if USE_MYSQL else '?'
        execute_query(
            f'INSERT INTO recurring_templates (label, payload, day_of_month, created_by) '
            f'VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})',
            (label, json.dumps(payload), day_of_month, session.get('username'))
        )

        return jsonify({'message': 'Template saved'}), 200
    except Exception as e:
        print(f"Error saving recurring template: {e}")
        return jsonify({'error': str(e)}), 500


@recurring_bp.route('/api/recurring-templates', methods=['GET'])
def list_recurring_templates():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        templates = execute_query(
            "SELECT * FROM recurring_templates WHERE active = 1 ORDER BY label ASC",
            fetch=True
        )
        for t in (templates or []):
            t['payload'] = json.loads(t['payload'])

        return jsonify(templates or []), 200
    except Exception as e:
        print(f"Error listing recurring templates: {e}")
        return jsonify({'error': str(e)}), 500


@recurring_bp.route('/api/recurring-templates/<int:template_id>', methods=['DELETE'])
def delete_recurring_template(template_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can delete templates'}), 403

        placeholder = '%s' if USE_MYSQL else '?'
        execute_query(
            f'UPDATE recurring_templates SET active = 0 WHERE id = {placeholder}',
            (template_id,)
        )

        return jsonify({'message': 'Template removed'}), 200
    except Exception as e:
        print(f"Error deleting recurring template: {e}")
        return jsonify({'error': str(e)}), 500


@recurring_bp.route('/api/recurring-templates/<int:template_id>/mark-applied', methods=['POST'])
def mark_recurring_template_applied(template_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        placeholder = '%s' if USE_MYSQL else '?'
        current_month = datetime.now().strftime('%Y-%m')
        execute_query(
            f'UPDATE recurring_templates SET last_applied_month = {placeholder} WHERE id = {placeholder}',
            (current_month, template_id)
        )

        return jsonify({'message': 'Marked as applied'}), 200
    except Exception as e:
        print(f"Error marking recurring template applied: {e}")
        return jsonify({'error': str(e)}), 500
