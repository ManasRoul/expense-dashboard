"""Salary record routes."""

from flask import Blueprint, request, jsonify, session
from config import USE_MYSQL
from helpers import execute_query

salary_bp = Blueprint('salary', __name__)


@salary_bp.route('/api/salary-records', methods=['POST'])
def create_salary_records():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        data = request.json
        records = data.get('records', [])

        if not records:
            return jsonify({'error': 'No records provided'}), 400

        placeholder = '%s' if USE_MYSQL else '?'

        # Calculate totals by payment method for the transaction (no inserts yet -
        # the transaction is created first so salary_records can link to its id)
        total_salary = 0
        cash_salary = 0
        upi_salary = 0
        salary_comments = []

        for record in records:
            amount = float(record['amount'])
            total_salary += amount
            if record['paymentMethod'] == 'cash':
                cash_salary += amount
            else:
                upi_salary += amount
            salary_comments.append(f"(₹{amount:.2f} - {record['paymentMethod'].upper()} - {record['employeeName']} - {record['paymentType']})")

        # Create a transaction entry so it reflects on dashboard
        # Get last closing balance
        last_tx = execute_query(
            'SELECT closing_balance FROM transactions WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1',
            fetch=True, fetchone=True
        )
        opening_balance = float(last_tx['closing_balance']) if last_tx and last_tx['closing_balance'] is not None else 0
        closing_balance = opening_balance - total_salary

        # Determine primary method (whichever has higher amount)
        salary_method = 'cash' if cash_salary >= upi_salary else 'upi'
        comment_str = ' | '.join(salary_comments)

        # Insert transaction with salary expense
        tx_columns = ['date', 'opening_balance', 'salary', 'salary_method', 'salary_comment', 'total_income', 'total_expense', 'closing_balance']
        tx_values = [records[0]['date'], opening_balance, total_salary, salary_method, comment_str, 0, total_salary, closing_balance]

        placeholders_str = ', '.join([placeholder] * len(tx_columns))
        columns_str = ', '.join(tx_columns)
        transaction_id = execute_query(f'INSERT INTO transactions ({columns_str}) VALUES ({placeholders_str})', tuple(tx_values))

        # Now insert salary_records linked to the transaction that was just created
        saved_count = 0
        for record in records:
            query = f'''INSERT INTO salary_records
                (date, employee_name, payment_type, amount, payment_method, note, transaction_id)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})'''

            values = (
                record['date'],
                record['employeeName'],
                record['paymentType'],
                record['amount'],
                record['paymentMethod'],
                record.get('note', ''),
                transaction_id
            )

            execute_query(query, values)
            saved_count += 1

        return jsonify({'message': f'{saved_count} record(s) saved successfully', 'count': saved_count}), 200
    except Exception as e:
        print(f"Error saving salary records: {e}")
        return jsonify({'error': str(e)}), 500


@salary_bp.route('/api/salary-records', methods=['GET'])
def get_salary_records():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        limit = request.args.get('limit', 100, type=int)

        placeholder = '%s' if USE_MYSQL else '?'
        group_concat = 'GROUP_CONCAT' if USE_MYSQL else 'group_concat'

        # Group by date and get summary
        query = f'''
            SELECT
                date,
                COUNT(*) as employee_count,
                SUM(amount) as total_amount,
                {group_concat}(employee_name) as employees,
                MIN(id) as record_id
            FROM salary_records
            WHERE deleted_at IS NULL
            GROUP BY date
            ORDER BY date DESC
            LIMIT {placeholder}
        '''

        records = execute_query(query, (limit,), fetch=True)

        return jsonify(records), 200
    except Exception as e:
        print(f"Error loading salary records: {e}")
        return jsonify({'error': str(e)}), 500


@salary_bp.route('/api/salary-records/all', methods=['GET'])
def get_all_salary_records():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        records = execute_query('SELECT * FROM salary_records WHERE deleted_at IS NULL ORDER BY date DESC', fetch=True)
        return jsonify(records), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@salary_bp.route('/api/salary-records/details/<date>', methods=['GET'])
def get_salary_records_by_date(date):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        placeholder = '%s' if USE_MYSQL else '?'
        query = f'SELECT * FROM salary_records WHERE DATE(date) = DATE({placeholder}) AND deleted_at IS NULL ORDER BY employee_name'

        records = execute_query(query, (date,), fetch=True)

        return jsonify(records), 200
    except Exception as e:
        print(f"Error loading salary record details: {e}")
        return jsonify({'error': str(e)}), 500


@salary_bp.route('/api/salary-records/<int:record_id>', methods=['DELETE'])
def delete_salary_record(record_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        if session.get('role') != 'owner':
            return jsonify({'error': 'Only owners can delete salary records'}), 403

        placeholder = '%s' if USE_MYSQL else '?'

        # Get the salary record to find which transaction (if any) it belongs to
        salary_record = execute_query(
            f'SELECT transaction_id FROM salary_records WHERE id = {placeholder}',
            (record_id,), fetch=True, fetchone=True
        )

        if not salary_record:
            return jsonify({'error': 'Salary record not found'}), 404

        linked_transaction_id = salary_record.get('transaction_id')

        # Delete the salary record
        delete_query = f'DELETE FROM salary_records WHERE id = {placeholder}'
        execute_query(delete_query, (record_id,))

        # Only cascade to the transaction this record was actually created
        # with (by transaction_id, never by date - other unrelated
        # transactions/salary records can share the same date).
        if linked_transaction_id:
            remaining_records = execute_query(
                f'SELECT COUNT(*) as cnt FROM salary_records WHERE transaction_id = {placeholder}',
                (linked_transaction_id,), fetch=True, fetchone=True
            )

            if remaining_records and remaining_records['cnt'] == 0:
                # Soft-delete to stay consistent with the transactions trash/restore flow
                execute_query(
                    f'UPDATE transactions SET deleted_at = CURRENT_TIMESTAMP WHERE id = {placeholder}',
                    (linked_transaction_id,)
                )

        return jsonify({'message': 'Salary record deleted successfully'}), 200
    except Exception as e:
        print(f"Error deleting salary record: {e}")
        return jsonify({'error': str(e)}), 500
