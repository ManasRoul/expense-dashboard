"""Settings routes: employees/categories, and app_config (thresholds/feature flags)."""

from flask import Blueprint, request, jsonify, session
import re
from config import USE_MYSQL
from helpers import execute_query, add_category_columns

settings_bp = Blueprint('settings', __name__)


@settings_bp.route('/api/settings', methods=['GET'])
def get_settings():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        setting_type = request.args.get('type')
        placeholder = '%s' if USE_MYSQL else '?'

        if setting_type:
            query = f"SELECT * FROM settings WHERE type = {placeholder} AND active = 1 ORDER BY sort_order"
            items = execute_query(query, (setting_type,), fetch=True)
        else:
            items = execute_query("SELECT * FROM settings WHERE active = 1 ORDER BY type, sort_order", fetch=True)

        return jsonify(items), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@settings_bp.route('/api/settings', methods=['POST'])
def add_setting():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can modify settings'}), 403

        data = request.json
        setting_type = data.get('type')
        key_id = data.get('key_id')
        label = data.get('label')
        salary_amount = data.get('salary_amount', 0)

        if not all([setting_type, key_id, label]):
            return jsonify({'error': 'type, key_id, and label are required'}), 400

        if setting_type not in ('employee', 'income_category', 'expense_category'):
            return jsonify({'error': 'Invalid type'}), 400

        # key_id ends up unescaped inside ALTER TABLE/SHOW COLUMNS statements
        # (add_category_columns) since column names can't be parameterized -
        # restrict it to a safe identifier shape to prevent SQL injection via DDL.
        if not re.match(r'^[a-z][a-z0-9_]{0,49}$', key_id):
            return jsonify({'error': 'key_id must start with a lowercase letter and contain only lowercase letters, numbers, and underscores (max 50 chars)'}), 400

        placeholder = '%s' if USE_MYSQL else '?'

        # income_category and expense_category both map to a column in the
        # transactions table named after key_id - the column is NOT namespaced
        # by type. The settings table's UNIQUE(type, key_id) constraint allows
        # the same key_id for an income category and an expense category, but
        # if that happened they would silently read/write the exact same
        # column (entering an amount under one would show up under the other).
        # Block that combination before it can happen.
        if setting_type in ('income_category', 'expense_category'):
            cross_type_conflict = execute_query(
                f"SELECT type FROM settings WHERE key_id = {placeholder} AND type IN ('income_category', 'expense_category') AND type != {placeholder}",
                (key_id, setting_type), fetch=True, fetchone=True
            )
            if cross_type_conflict:
                other = cross_type_conflict['type'].replace('_category', '')
                return jsonify({'error': f"key_id '{key_id}' is already used by an {other} category. Choose a name that doesn't collide with an existing income/expense category."}), 409

        # Check if a soft-deleted entry exists with same type and key_id
        existing = execute_query(
            f"SELECT id, active FROM settings WHERE type = {placeholder} AND key_id = {placeholder}",
            (setting_type, key_id), fetch=True, fetchone=True
        )

        if existing:
            if existing['active'] == 1:
                return jsonify({'error': 'This key_id already exists for this type'}), 409
            # Reactivate the soft-deleted entry
            if setting_type == 'employee' and salary_amount > 0:
                execute_query(
                    f"UPDATE settings SET active = 1, label = {placeholder}, salary_amount = {placeholder} WHERE id = {placeholder}",
                    (label, salary_amount, existing['id'])
                )
            else:
                execute_query(
                    f"UPDATE settings SET active = 1, label = {placeholder} WHERE id = {placeholder}",
                    (label, existing['id'])
                )
            # Ensure columns exist in transactions table
            if setting_type in ('income_category', 'expense_category'):
                add_category_columns(key_id)
            return jsonify({'message': 'Setting reactivated successfully'}), 200

        # Get next sort_order
        max_order = execute_query(
            f"SELECT MAX(sort_order) as max_order FROM settings WHERE type = {placeholder}",
            (setting_type,), fetch=True, fetchone=True
        )
        next_order = (max_order['max_order'] or 0) + 1

        if setting_type == 'employee' and salary_amount > 0:
            execute_query(
                f"INSERT INTO settings (type, key_id, label, sort_order, salary_amount) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})",
                (setting_type, key_id, label, next_order, salary_amount)
            )
        else:
            execute_query(
                f"INSERT INTO settings (type, key_id, label, sort_order) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})",
                (setting_type, key_id, label, next_order)
            )

        # Add columns to transactions table for income/expense categories
        if setting_type in ('income_category', 'expense_category'):
            add_category_columns(key_id)

        return jsonify({'message': 'Setting added successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@settings_bp.route('/api/settings/<int:setting_id>', methods=['PUT'])
def update_setting(setting_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can modify settings'}), 403

        data = request.json
        label = data.get('label')
        salary_amount = data.get('salary_amount')
        budget_amount = data.get('budget_amount')

        if label is None and salary_amount is None and budget_amount is None:
            return jsonify({'error': 'label, salary_amount, or budget_amount is required'}), 400

        placeholder = '%s' if USE_MYSQL else '?'

        # Build update query from whatever fields were provided
        set_parts = []
        values = []
        if label:
            set_parts.append(f'label = {placeholder}')
            values.append(label)
        if salary_amount is not None:
            set_parts.append(f'salary_amount = {placeholder}')
            values.append(salary_amount)
        if budget_amount is not None:
            set_parts.append(f'budget_amount = {placeholder}')
            values.append(budget_amount)
        values.append(setting_id)

        execute_query(
            f"UPDATE settings SET {', '.join(set_parts)} WHERE id = {placeholder}",
            tuple(values)
        )

        return jsonify({'message': 'Setting updated'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@settings_bp.route('/api/settings/<int:setting_id>', methods=['DELETE'])
def delete_setting(setting_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can modify settings'}), 403

        placeholder = '%s' if USE_MYSQL else '?'
        # Soft delete - mark as inactive
        execute_query(
            f"UPDATE settings SET active = 0 WHERE id = {placeholder}",
            (setting_id,)
        )

        return jsonify({'message': 'Setting removed'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@settings_bp.route('/api/app-config', methods=['GET'])
def get_app_config():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        rows = execute_query("SELECT * FROM app_config", fetch=True)
        # Tag with type: 'app_config' for frontend compatibility - it merges this
        # list into the same array it already builds from /api/settings.
        for row in (rows or []):
            row['type'] = 'app_config'

        return jsonify(rows or []), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@settings_bp.route('/api/app-config/<key_id>', methods=['PUT'])
def update_app_config(key_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can modify app config'}), 403

        data = request.json
        value = data.get('value')
        if value is None:
            return jsonify({'error': 'value is required'}), 400

        placeholder = '%s' if USE_MYSQL else '?'
        existing = execute_query(
            f"SELECT key_id FROM app_config WHERE key_id = {placeholder}",
            (key_id,), fetch=True, fetchone=True
        )
        if not existing:
            return jsonify({'error': f"Unknown app_config key '{key_id}'"}), 404

        execute_query(
            f"UPDATE app_config SET value = {placeholder}, updated_at = CURRENT_TIMESTAMP WHERE key_id = {placeholder}",
            (value, key_id)
        )

        return jsonify({'message': 'App config updated'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
