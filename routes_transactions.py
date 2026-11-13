"""Transaction lifecycle routes: CRUD, soft-delete/trash/restore, and receipts."""

from flask import Blueprint, request, jsonify, session, send_from_directory
from werkzeug.utils import secure_filename
import os
import re
import uuid
from config import USE_MYSQL
from helpers import (
    execute_query, audit_log, is_feature_enabled, validate_decimal, validate_date,
    build_transaction_columns_values, RECEIPTS_DIR, ALLOWED_RECEIPT_EXTENSIONS
)

transactions_bp = Blueprint('transactions', __name__)


def sync_salary_records(transaction_id, entry_date, data, placeholder, replace=False):
    """Mirror a transaction's salary comment into salary_records rows, linked by
    transaction_id. Used by both create and update so editing a transaction's
    salary entries actually shows up on the Salary report page, not just on the
    transaction itself - replace=True clears this transaction's existing rows
    first (an edit overwrites, same as every other field on the transaction)."""
    if replace:
        execute_query(f'DELETE FROM salary_records WHERE transaction_id = {placeholder}', (transaction_id,))

    salary_data = data.get('expense', {}).get('salary', {})
    salary_amount = salary_data.get('amount', 0) if isinstance(salary_data, dict) else 0
    salary_comment = salary_data.get('comment', '') if isinstance(salary_data, dict) else ''

    if not (salary_amount > 0 and salary_comment):
        return

    # Parse salary comment format: (₹5000 - CASH - Shakti - Advance - Note) | (₹3000 - UPI - Kabu - Full)
    entries = salary_comment.split('|')

    for entry in entries:
        entry = entry.strip()
        # Match pattern: (₹amount - METHOD - EmployeeName - PaymentType - Note) or (₹amount - METHOD - EmployeeName - PaymentType)
        match = re.match(r'\(₹([\d.]+)\s*-\s*(\w+)\s*-\s*(\w+)(?:\s*-\s*(\w+))?(?:\s*-\s*(.+))?\)', entry)
        if match:
            amount = float(match.group(1))
            payment_method = match.group(2).lower()
            employee_name = match.group(3)
            payment_type = match.group(4) if match.group(4) else 'Full'
            note = match.group(5) if match.group(5) else ''

            # Validate payment type
            if payment_type not in ['Advance', 'Full']:
                # If 4th group is not a valid payment type, it might be a note from old format
                note = payment_type if payment_type else ''
                payment_type = 'Full'

            # Insert into salary_records, linked to this transaction via
            # transaction_id so deleting one only affects records it created
            # (not every other salary_record/transaction sharing the same date)
            salary_query = f'''INSERT INTO salary_records
                (date, employee_name, payment_type, amount, payment_method, note, transaction_id)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})'''

            salary_values = (
                entry_date,
                employee_name,
                payment_type,
                amount,
                payment_method,
                note,
                transaction_id
            )

            execute_query(salary_query, salary_values)


@transactions_bp.route('/api/transactions', methods=['POST'])
def save_transaction():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        data = request.json

        # Validate opening balance
        try:
            opening_balance = validate_decimal(data.get('openingBalance', 0), 'Opening balance', min_value=None)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400

        # Validate date if provided
        entry_date = data.get('entryDate')
        if entry_date:
            try:
                entry_date = validate_date(entry_date)
            except ValueError as e:
                return jsonify({'error': str(e)}), 400

        # Use %s for MySQL, ? for SQLite
        placeholder = '%s' if USE_MYSQL else '?'

        columns, values_list = build_transaction_columns_values(data, entry_date)
        columns.append('created_by')
        values_list.append(session.get('username'))

        placeholders_str = ', '.join([placeholder] * len(columns))
        columns_str = ', '.join(columns)

        query = f'INSERT INTO transactions ({columns_str}) VALUES ({placeholders_str})'

        transaction_id = execute_query(query, tuple(values_list))

        sync_salary_records(transaction_id, entry_date, data, placeholder)

        return jsonify({'id': transaction_id, 'message': 'Transaction saved successfully'}), 200
    except Exception as e:
        print(f"Error saving transaction: {e}")
        return jsonify({'error': str(e)}), 500


@transactions_bp.route('/api/transactions', methods=['GET'])
def get_transactions():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        # Get limit from query parameter, default to 50. limit=all returns every row.
        raw_limit = request.args.get('limit', '50')
        placeholder = '%s' if USE_MYSQL else '?'

        if raw_limit == 'all':
            query = 'SELECT * FROM transactions WHERE deleted_at IS NULL ORDER BY id DESC'
            transactions = execute_query(query, fetch=True)
        else:
            try:
                limit = int(raw_limit)
            except ValueError:
                limit = 50
            query = f'SELECT * FROM transactions WHERE deleted_at IS NULL ORDER BY id DESC LIMIT {placeholder}'
            transactions = execute_query(query, (limit,), fetch=True)

        return jsonify(transactions), 200
    except Exception as e:
        print(f"Error fetching transactions: {e}")
        return jsonify({'error': str(e)}), 500


@transactions_bp.route('/api/transactions/<int:transaction_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_transaction(transaction_id):
    """Handle GET, PUT, and DELETE operations for a single transaction"""

    if request.method == 'GET':
        try:
            if 'user_id' not in session:
                return jsonify({'error': 'Not authenticated'}), 401

            placeholder = '%s' if USE_MYSQL else '?'
            query = f'SELECT * FROM transactions WHERE id = {placeholder}'
            transaction = execute_query(query, (transaction_id,), fetch=True, fetchone=True)

            if not transaction:
                return jsonify({'error': 'Transaction not found'}), 404

            return jsonify(transaction), 200
        except Exception as e:
            print(f"Error fetching transaction: {e}")
            return jsonify({'error': str(e)}), 500

    elif request.method == 'PUT':
        try:
            if 'user_id' not in session:
                return jsonify({'error': 'Not authenticated'}), 401

            data = request.json

            # Validate opening balance
            try:
                opening_balance = validate_decimal(data.get('openingBalance', 0), 'Opening balance', min_value=None)
            except ValueError as e:
                return jsonify({'error': str(e)}), 400

            # Validate date if provided
            entry_date = data.get('entryDate')
            if entry_date:
                try:
                    entry_date = validate_date(entry_date)
                except ValueError as e:
                    return jsonify({'error': str(e)}), 400

            placeholder = '%s' if USE_MYSQL else '?'

            # Known columns in the database
            columns, values_list = build_transaction_columns_values(data, entry_date)
            columns.append('updated_by')
            values_list.append(session.get('username'))

            set_parts = [f'{col} = {placeholder}' for col in columns]
            values_list.append(transaction_id)

            query = f"UPDATE transactions SET {', '.join(set_parts)} WHERE id = {placeholder}"

            execute_query(query, tuple(values_list))

            # entry_date is only set above if the request body included one - fall
            # back to the transaction's own date (just-updated or pre-existing) so
            # salary_records still gets a valid date even on a partial-field edit.
            sync_entry_date = entry_date or execute_query(
                f'SELECT date FROM transactions WHERE id = {placeholder}',
                (transaction_id,), fetch=True, fetchone=True
            )['date']
            sync_salary_records(transaction_id, sync_entry_date, data, placeholder, replace=True)

            return jsonify({'id': transaction_id, 'message': 'Transaction updated successfully'}), 200
        except Exception as e:
            print(f"Error updating transaction: {e}")
            return jsonify({'error': str(e)}), 500

    elif request.method == 'DELETE':
        try:
            # Check if user is logged in and is owner
            if 'user_id' not in session:
                audit_log('DELETE_TRANSACTION', success=False, details={'transaction_id': transaction_id, 'reason': 'Not authenticated'})
                return jsonify({'error': 'Not authenticated'}), 401

            if session.get('role') != 'owner':
                audit_log('DELETE_TRANSACTION', success=False, details={'transaction_id': transaction_id, 'reason': 'Insufficient permissions', 'role': session.get('role')})
                return jsonify({'error': 'Only owners can delete transactions'}), 403

            # Get the transaction to check it exists and isn't already trashed
            placeholder = '%s' if USE_MYSQL else '?'
            transaction = execute_query(
                f'SELECT * FROM transactions WHERE id = {placeholder} AND deleted_at IS NULL',
                (transaction_id,), fetch=True, fetchone=True
            )

            if not transaction:
                return jsonify({'error': 'Transaction not found'}), 404

            # Soft-delete: mark deleted_at instead of removing the row, so the
            # transaction (and any salary_records created alongside it, linked
            # by transaction_id) can be restored later from the trash.
            execute_query(
                f'UPDATE salary_records SET deleted_at = CURRENT_TIMESTAMP WHERE transaction_id = {placeholder}',
                (transaction_id,)
            )
            execute_query(
                f'UPDATE transactions SET deleted_at = CURRENT_TIMESTAMP WHERE id = {placeholder}',
                (transaction_id,)
            )

            audit_log('DELETE_TRANSACTION', success=True, details={'transaction_id': transaction_id})
            return jsonify({'message': 'Transaction moved to trash'}), 200
        except Exception as e:
            print(f"Error deleting transaction: {e}")
            audit_log('DELETE_TRANSACTION', success=False, details={'transaction_id': transaction_id, 'error': str(e)})
            return jsonify({'error': str(e)}), 500


@transactions_bp.route('/api/transactions/<int:transaction_id>/receipts', methods=['POST'])
def upload_receipts(transaction_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if not is_feature_enabled('feature_receipts'):
            return jsonify({'error': 'Receipt attachments are disabled'}), 403

        placeholder = '%s' if USE_MYSQL else '?'
        transaction = execute_query(
            f'SELECT id FROM transactions WHERE id = {placeholder} AND deleted_at IS NULL',
            (transaction_id,), fetch=True, fetchone=True
        )
        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404

        files = request.files.getlist('receipts')
        if not files or all(not f.filename for f in files):
            return jsonify({'error': 'No files provided'}), 400

        saved = 0
        errors = []
        for file in files:
            if not file.filename:
                continue
            original_name = secure_filename(file.filename)
            ext = os.path.splitext(original_name)[1].lower()
            if ext not in ALLOWED_RECEIPT_EXTENSIONS:
                errors.append(f'{original_name}: unsupported file type')
                continue

            filename = f"{transaction_id}_{uuid.uuid4().hex}{ext}"
            file.save(os.path.join(RECEIPTS_DIR, filename))

            execute_query(
                f'INSERT INTO transaction_receipts (transaction_id, filename, original_filename, uploaded_by) '
                f'VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})',
                (transaction_id, filename, original_name, session.get('username'))
            )
            saved += 1

        audit_log('UPLOAD_RECEIPT', success=saved > 0, details={'transaction_id': transaction_id, 'saved': saved, 'errors': errors})

        if saved == 0:
            return jsonify({'error': 'No files were saved', 'details': errors}), 400
        return jsonify({'message': f'{saved} receipt(s) uploaded successfully', 'errors': errors}), 200
    except Exception as e:
        print(f"Error uploading receipts: {e}")
        return jsonify({'error': str(e)}), 500


@transactions_bp.route('/api/transactions/<int:transaction_id>/receipts', methods=['GET'])
def list_receipts(transaction_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if not is_feature_enabled('feature_receipts'):
            return jsonify({'error': 'Receipt attachments are disabled'}), 403

        placeholder = '%s' if USE_MYSQL else '?'
        receipts = execute_query(
            f'SELECT id, original_filename, uploaded_by, uploaded_at FROM transaction_receipts '
            f'WHERE transaction_id = {placeholder} ORDER BY uploaded_at ASC',
            (transaction_id,), fetch=True
        )
        return jsonify(receipts), 200
    except Exception as e:
        print(f"Error listing receipts: {e}")
        return jsonify({'error': str(e)}), 500


@transactions_bp.route('/api/transactions/<int:transaction_id>/receipts/<int:receipt_id>', methods=['GET'])
def get_receipt_file(transaction_id, receipt_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if not is_feature_enabled('feature_receipts'):
            return jsonify({'error': 'Receipt attachments are disabled'}), 403

        placeholder = '%s' if USE_MYSQL else '?'
        receipt = execute_query(
            f'SELECT filename FROM transaction_receipts WHERE id = {placeholder} AND transaction_id = {placeholder}',
            (receipt_id, transaction_id), fetch=True, fetchone=True
        )
        if not receipt:
            return jsonify({'error': 'Receipt not found'}), 404

        # Filename comes from the DB, never from the request - no path traversal possible
        return send_from_directory(RECEIPTS_DIR, os.path.basename(receipt['filename']))
    except Exception as e:
        print(f"Error fetching receipt: {e}")
        return jsonify({'error': str(e)}), 500


@transactions_bp.route('/api/transactions/<int:transaction_id>/receipts/<int:receipt_id>', methods=['DELETE'])
def delete_receipt_file(transaction_id, receipt_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can remove receipts'}), 403
        if not is_feature_enabled('feature_receipts'):
            return jsonify({'error': 'Receipt attachments are disabled'}), 403

        placeholder = '%s' if USE_MYSQL else '?'
        receipt = execute_query(
            f'SELECT filename FROM transaction_receipts WHERE id = {placeholder} AND transaction_id = {placeholder}',
            (receipt_id, transaction_id), fetch=True, fetchone=True
        )
        if not receipt:
            return jsonify({'error': 'Receipt not found'}), 404

        full_path = os.path.join(RECEIPTS_DIR, os.path.basename(receipt['filename']))
        if os.path.exists(full_path):
            os.remove(full_path)

        execute_query(
            f'DELETE FROM transaction_receipts WHERE id = {placeholder}',
            (receipt_id,)
        )

        audit_log('DELETE_RECEIPT', success=True, details={'transaction_id': transaction_id, 'receipt_id': receipt_id})
        return jsonify({'message': 'Receipt removed'}), 200
    except Exception as e:
        print(f"Error deleting receipt: {e}")
        return jsonify({'error': str(e)}), 500


@transactions_bp.route('/api/transactions/trash', methods=['GET'])
def get_trashed_transactions():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can view the trash'}), 403

        transactions = execute_query(
            'SELECT * FROM transactions WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC',
            fetch=True
        )
        return jsonify(transactions), 200
    except Exception as e:
        print(f"Error fetching trashed transactions: {e}")
        return jsonify({'error': str(e)}), 500


@transactions_bp.route('/api/transactions/<int:transaction_id>/restore', methods=['POST'])
def restore_transaction(transaction_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can restore transactions'}), 403

        placeholder = '%s' if USE_MYSQL else '?'
        transaction = execute_query(
            f'SELECT id FROM transactions WHERE id = {placeholder} AND deleted_at IS NOT NULL',
            (transaction_id,), fetch=True, fetchone=True
        )
        if not transaction:
            return jsonify({'error': 'Trashed transaction not found'}), 404

        execute_query(
            f'UPDATE transactions SET deleted_at = NULL WHERE id = {placeholder}',
            (transaction_id,)
        )
        execute_query(
            f'UPDATE salary_records SET deleted_at = NULL WHERE transaction_id = {placeholder}',
            (transaction_id,)
        )

        audit_log('RESTORE_TRANSACTION', success=True, details={'transaction_id': transaction_id})
        return jsonify({'message': 'Transaction restored'}), 200
    except Exception as e:
        print(f"Error restoring transaction: {e}")
        audit_log('RESTORE_TRANSACTION', success=False, details={'transaction_id': transaction_id, 'error': str(e)})
        return jsonify({'error': str(e)}), 500


@transactions_bp.route('/api/transactions/<int:transaction_id>/permanent', methods=['DELETE'])
def permanently_delete_transaction(transaction_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can permanently delete transactions'}), 403

        placeholder = '%s' if USE_MYSQL else '?'
        transaction = execute_query(
            f'SELECT id FROM transactions WHERE id = {placeholder} AND deleted_at IS NOT NULL',
            (transaction_id,), fetch=True, fetchone=True
        )
        if not transaction:
            return jsonify({'error': 'Trashed transaction not found. Move it to trash first.'}), 404

        # Clean up any attached receipt files before dropping their DB rows,
        # otherwise they'd be orphaned on disk forever with no transaction to belong to.
        receipts = execute_query(
            f'SELECT filename FROM transaction_receipts WHERE transaction_id = {placeholder}',
            (transaction_id,), fetch=True
        )
        for r in (receipts or []):
            full_path = os.path.join(RECEIPTS_DIR, os.path.basename(r['filename']))
            if os.path.exists(full_path):
                os.remove(full_path)
        execute_query(f'DELETE FROM transaction_receipts WHERE transaction_id = {placeholder}', (transaction_id,))

        execute_query(f'DELETE FROM salary_records WHERE transaction_id = {placeholder}', (transaction_id,))
        execute_query(f'DELETE FROM transactions WHERE id = {placeholder}', (transaction_id,))

        audit_log('PERMANENT_DELETE_TRANSACTION', success=True, details={'transaction_id': transaction_id})
        return jsonify({'message': 'Transaction permanently deleted'}), 200
    except Exception as e:
        print(f"Error permanently deleting transaction: {e}")
        audit_log('PERMANENT_DELETE_TRANSACTION', success=False, details={'transaction_id': transaction_id, 'error': str(e)})
        return jsonify({'error': str(e)}), 500
