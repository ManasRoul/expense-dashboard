"""Dashboard/report aggregation routes: balances, month comparison, category
budget status, category totals, and vendor totals."""

from flask import Blueprint, jsonify, session
from datetime import datetime, timedelta
from config import USE_MYSQL
from helpers import execute_query, get_db_connection, is_feature_enabled, split_amount_by_method

reports_bp = Blueprint('reports', __name__)


@reports_bp.route('/api/dashboard/balances', methods=['GET'])
def get_balances():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        # Get all active income and expense categories dynamically
        income_categories = execute_query(
            "SELECT key_id FROM settings WHERE type = 'income_category' AND active = 1 ORDER BY sort_order",
            fetch=True
        )
        expense_categories = execute_query(
            "SELECT key_id FROM settings WHERE type = 'expense_category' AND active = 1 ORDER BY sort_order",
            fetch=True
        )

        income_fields = [cat['key_id'] for cat in (income_categories or [])]
        expense_fields = [cat['key_id'] for cat in (expense_categories or [])]

        # Build SQL with CASE WHEN for cash/upi aggregation
        # Treat empty/NULL payment methods as 'cash' for backward compatibility
        # Use NULLIF to convert empty strings to NULL, then COALESCE to default to 'cash'
        parts = []
        for f in income_fields + expense_fields:
            parts.append(f"SUM(CASE WHEN COALESCE(NULLIF({f}_method, ''), 'cash')='cash' THEN {f} ELSE 0 END) as {f}_cash")
            parts.append(f"SUM(CASE WHEN {f}_method='upi' THEN {f} ELSE 0 END) as {f}_upi")
        parts.append("COUNT(*) as cnt")

        query = f"SELECT {', '.join(parts)} FROM transactions WHERE deleted_at IS NULL"
        result = execute_query(query, fetch=True, fetchone=True)

        cash_income = sum(float(result.get(f'{f}_cash', 0) or 0) for f in income_fields)
        upi_income = sum(float(result.get(f'{f}_upi', 0) or 0) for f in income_fields)
        cash_expense = sum(float(result.get(f'{f}_cash', 0) or 0) for f in expense_fields)
        upi_expense = sum(float(result.get(f'{f}_upi', 0) or 0) for f in expense_fields)

        cash_balance = cash_income - cash_expense
        upi_balance = upi_income - upi_expense

        # Get the last transaction's closing balance
        last_transaction = execute_query(
            'SELECT closing_balance FROM transactions WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 1',
            fetch=True, fetchone=True
        )
        total_balance = last_transaction['closing_balance'] if last_transaction and last_transaction['closing_balance'] is not None else 0

        return jsonify({
            'cashIncome': f"{cash_income:.2f}",
            'cashExpense': f"{cash_expense:.2f}",
            'cashBalance': f"{cash_balance:.2f}",
            'upiIncome': f"{upi_income:.2f}",
            'upiExpense': f"{upi_expense:.2f}",
            'upiBalance': f"{upi_balance:.2f}",
            'totalBalance': f"{total_balance:.2f}",
            'transactionCount': result.get('cnt', 0) if result else 0
        }), 200
    except Exception as e:
        print(f"Error calculating balances: {e}")
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/api/dashboard/month-comparison', methods=['GET'])
def get_month_comparison():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        placeholder = '%s' if USE_MYSQL else '?'

        today = datetime.now()
        current_month_start = today.replace(day=1).strftime('%Y-%m-%d')
        # First day of next month = start of current month plus ~35 days, reset to day 1
        next_month_start = (today.replace(day=28) + timedelta(days=7)).replace(day=1).strftime('%Y-%m-%d')
        # First day of previous month = day 1 of current month minus 1 day, reset to day 1
        prev_month_start = (today.replace(day=1) - timedelta(days=1)).replace(day=1).strftime('%Y-%m-%d')

        def totals_for_range(start, end):
            query = f'''
                SELECT COALESCE(SUM(total_income), 0) as income, COALESCE(SUM(total_expense), 0) as expense
                FROM transactions
                WHERE deleted_at IS NULL AND date >= {placeholder} AND date < {placeholder}
            '''
            result = execute_query(query, (start, end), fetch=True, fetchone=True)
            income = float(result['income'] or 0) if result else 0
            expense = float(result['expense'] or 0) if result else 0
            return income, expense

        current_income, current_expense = totals_for_range(current_month_start, next_month_start)
        previous_income, previous_expense = totals_for_range(prev_month_start, current_month_start)

        return jsonify({
            'currentMonth': {
                'label': today.strftime('%B %Y'),
                'income': current_income,
                'expense': current_expense,
                'available': current_income - current_expense
            },
            'previousMonth': {
                'label': (today.replace(day=1) - timedelta(days=1)).strftime('%B %Y'),
                'income': previous_income,
                'expense': previous_expense,
                'available': previous_income - previous_expense
            }
        }), 200
    except Exception as e:
        print(f"Error calculating month comparison: {e}")
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/api/dashboard/category-budget-status', methods=['GET'])
def get_category_budget_status():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        placeholder = '%s' if USE_MYSQL else '?'

        budgeted_categories = execute_query(
            f"SELECT key_id, label, budget_amount FROM settings "
            f"WHERE type = 'expense_category' AND active = 1 AND budget_amount > 0",
            fetch=True
        )
        if not budgeted_categories:
            return jsonify([]), 200

        # Only sum columns that actually exist in transactions (same safety check as get_category_totals)
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            try:
                if USE_MYSQL:
                    cursor.execute("DESCRIBE transactions")
                    columns = {row[0] for row in cursor.fetchall()}
                else:
                    cursor.execute("PRAGMA table_info(transactions)")
                    columns = {row[1] for row in cursor.fetchall()}
            finally:
                cursor.close()
        finally:
            conn.close()

        today = datetime.now()
        current_month_start = today.replace(day=1).strftime('%Y-%m-%d')
        next_month_start = (today.replace(day=28) + timedelta(days=7)).replace(day=1).strftime('%Y-%m-%d')

        results = []
        for cat in budgeted_categories:
            key_id = cat['key_id']
            if key_id not in columns:
                continue
            query = f'''
                SELECT COALESCE(SUM({key_id}), 0) as spent FROM transactions
                WHERE deleted_at IS NULL AND date >= {placeholder} AND date < {placeholder}
            '''
            result = execute_query(query, (current_month_start, next_month_start), fetch=True, fetchone=True)
            spent = float(result['spent'] or 0) if result else 0
            budget = float(cat['budget_amount'])
            if spent >= budget:
                results.append({
                    'key_id': key_id,
                    'label': cat['label'],
                    'spent': spent,
                    'budget': budget,
                    'overBy': spent - budget
                })

        return jsonify(results), 200
    except Exception as e:
        print(f"Error calculating category budget status: {e}")
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/api/category-totals', methods=['GET'])
def get_category_totals():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        placeholder = '%s' if USE_MYSQL else '?'

        # Get all active categories from settings
        categories = execute_query(
            f"SELECT * FROM settings WHERE type IN ({placeholder}, {placeholder}) AND active = 1 ORDER BY type, sort_order",
            ('income_category', 'expense_category'), fetch=True
        )

        # Get the list of actual columns in transactions table (for safety check)
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            try:
                if USE_MYSQL:
                    cursor.execute("DESCRIBE transactions")
                    columns = {row[0] for row in cursor.fetchall()}
                else:
                    cursor.execute("PRAGMA table_info(transactions)")
                    columns = {row[1] for row in cursor.fetchall()}
            finally:
                cursor.close()
        finally:
            conn.close()

        income_totals = {}
        expense_totals = {}

        # Build dynamic SUM query only for categories with corresponding columns
        sum_parts = []
        category_keys = []

        for cat in categories:
            col_name = cat['key_id']
            if col_name in columns:
                sum_parts.append(f"COALESCE(SUM({col_name}), 0) as {col_name}")
                category_keys.append((col_name, cat['type']))

        if sum_parts:
            sums = ', '.join(sum_parts)
            query = f"SELECT {sums} FROM transactions WHERE deleted_at IS NULL"
            result = execute_query(query, fetch=True, fetchone=True)

            # Separate income and expense totals
            for col_name, cat_type in category_keys:
                total = float(result.get(col_name, 0) or 0)
                if cat_type == 'income_category':
                    income_totals[col_name] = total
                else:
                    expense_totals[col_name] = total

        return jsonify({
            'income': income_totals,
            'expense': expense_totals,
            'categories': categories  # Return full category metadata including icons and labels
        }), 200
    except Exception as e:
        print(f"Error calculating category totals: {e}")
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/api/payment-methods/totals', methods=['GET'])
def get_payment_method_totals():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        methods = execute_query(
            "SELECT key_id, label, icon FROM settings WHERE type = 'payment_method' AND active = 1 ORDER BY sort_order",
            fetch=True
        )
        if not methods:
            return jsonify([]), 200

        income_categories = execute_query(
            "SELECT key_id FROM settings WHERE type = 'income_category' AND active = 1",
            fetch=True
        )
        expense_categories = execute_query(
            "SELECT key_id FROM settings WHERE type = 'expense_category' AND active = 1",
            fetch=True
        )
        income_fields = [cat['key_id'] for cat in (income_categories or [])]
        expense_fields = [cat['key_id'] for cat in (expense_categories or [])]

        # Only sum columns that actually exist in transactions (same safety check
        # used elsewhere in this file for category/vendor totals).
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            try:
                if USE_MYSQL:
                    cursor.execute("DESCRIBE transactions")
                    columns = {row[0] for row in cursor.fetchall()}
                else:
                    cursor.execute("PRAGMA table_info(transactions)")
                    columns = {row[1] for row in cursor.fetchall()}
            finally:
                cursor.close()
        finally:
            conn.close()

        income_fields = [f for f in income_fields if f in columns and f'{f}_method' in columns]
        expense_fields = [f for f in expense_fields if f in columns and f'{f}_method' in columns]

        if not income_fields and not expense_fields:
            return jsonify([]), 200

        # Pulled into Python rather than a pure SQL SUM/CASE, because a single
        # category's stored amount/method pair can actually represent several
        # entries with DIFFERENT payment methods combined together (the "+ Add
        # More" multi-entry form only keeps the FIRST entry's method per
        # category) - split_amount_by_method() re-derives the true per-method
        # breakdown from the comment text so a mixed-method entry doesn't get
        # entirely misattributed to whichever method happened to be first.
        select_cols = ['id']
        for f in income_fields + expense_fields:
            select_cols.extend([f, f'{f}_method', f'{f}_comment'])
        query = f"SELECT {', '.join(select_cols)} FROM transactions WHERE deleted_at IS NULL"
        rows = execute_query(query, fetch=True) or []

        totals = {m['key_id']: {'income': 0.0, 'expense': 0.0} for m in methods}
        for category_type, fields in (('income', income_fields), ('expense', expense_fields)):
            for f in fields:
                for row in rows:
                    amount = float(row.get(f) or 0)
                    if amount <= 0:
                        continue
                    for split_amount, split_method, _ in split_amount_by_method(amount, row.get(f'{f}_method'), row.get(f'{f}_comment')):
                        if split_method in totals:
                            totals[split_method][category_type] += split_amount

        results = []
        for m in methods:
            method_key = m['key_id']
            income_total = totals[method_key]['income']
            expense_total = totals[method_key]['expense']
            results.append({
                'key_id': method_key,
                'label': m['label'],
                'icon': m['icon'],
                'income': income_total,
                'expense': expense_total,
                'net': income_total - expense_total
            })

        return jsonify(results), 200
    except Exception as e:
        print(f"Error calculating payment method totals: {e}")
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/api/payment-methods/<key_id>/transactions', methods=['GET'])
def get_payment_method_transactions(key_id):
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401

        placeholder = '%s' if USE_MYSQL else '?'

        method = execute_query(
            f"SELECT key_id FROM settings WHERE type = 'payment_method' AND key_id = {placeholder} AND active = 1",
            (key_id,), fetch=True, fetchone=True
        )
        if not method:
            return jsonify({'error': 'Unknown payment method'}), 404

        categories = execute_query(
            "SELECT key_id, label, type FROM settings WHERE type IN ('income_category', 'expense_category') AND active = 1 ORDER BY type, sort_order",
            fetch=True
        )

        # Only use categories whose amount/method columns actually exist (same safety check as get_category_totals)
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            try:
                if USE_MYSQL:
                    cursor.execute("DESCRIBE transactions")
                    columns = {row[0] for row in cursor.fetchall()}
                else:
                    cursor.execute("PRAGMA table_info(transactions)")
                    columns = {row[1] for row in cursor.fetchall()}
            finally:
                cursor.close()
        finally:
            conn.close()

        # Fetch every category entry with a nonzero amount (not pre-filtered by
        # method in SQL - see get_payment_method_totals() for why: a single
        # stored amount/method pair can actually be several entries with
        # different methods combined together) and split each one by its own
        # comment-recorded method in Python, so a mixed-method entry only
        # contributes the portion that's actually this method, with that
        # portion's own note as its comment.
        entries = []
        for cat in (categories or []):
            f = cat['key_id']
            method_col = f'{f}_method'
            comment_col = f'{f}_comment'
            vendor_col = f'{f}_vendor'
            if f not in columns or method_col not in columns:
                continue

            query_cols = ['id', 'date', f, method_col]
            if comment_col in columns:
                query_cols.append(comment_col)
            if vendor_col in columns:
                query_cols.append(vendor_col)

            rows = execute_query(
                f"SELECT {', '.join(query_cols)} FROM transactions WHERE deleted_at IS NULL AND {f} > 0",
                fetch=True
            ) or []

            cat_type = 'income' if cat['type'] == 'income_category' else 'expense'
            for row in rows:
                amount = float(row.get(f) or 0)
                comment = row.get(comment_col, '') if comment_col in columns else ''
                vendor = row.get(vendor_col, '') if vendor_col in columns else ''
                for split_amount, split_method, split_note in split_amount_by_method(amount, row.get(method_col), comment):
                    if split_method != key_id:
                        continue
                    entries.append({
                        'date': row['date'],
                        'category': cat['label'],
                        'type': cat_type,
                        'amount': split_amount,
                        'comment': split_note,
                        'vendor': vendor or ''
                    })

        # Capped to the most recent 500 matching entries, same spirit as the audit
        # log's 1000-entry cap - avoids an unbounded result set over a long history.
        entries.sort(key=lambda e: e['date'], reverse=True)
        return jsonify(entries[:500]), 200
    except Exception as e:
        print(f"Error fetching payment method transactions: {e}")
        return jsonify({'error': str(e)}), 500


@reports_bp.route('/api/vendors/totals', methods=['GET'])
def get_vendor_totals():
    try:
        if 'user_id' not in session:
            return jsonify({'error': 'Not authenticated'}), 401
        if not is_feature_enabled('feature_vendor_tracking'):
            return jsonify({'error': 'Vendor tracking is disabled'}), 403

        placeholder = '%s' if USE_MYSQL else '?'

        categories = execute_query(
            f"SELECT key_id FROM settings WHERE type IN ({placeholder}, {placeholder}) AND active = 1",
            ('income_category', 'expense_category'), fetch=True
        )

        # Only use categories whose amount/vendor columns actually exist (same safety check as get_category_totals)
        conn = get_db_connection()
        try:
            cursor = conn.cursor()
            try:
                if USE_MYSQL:
                    cursor.execute("DESCRIBE transactions")
                    columns = {row[0] for row in cursor.fetchall()}
                else:
                    cursor.execute("PRAGMA table_info(transactions)")
                    columns = {row[1] for row in cursor.fetchall()}
            finally:
                cursor.close()
        finally:
            conn.close()

        subqueries = []
        for cat in (categories or []):
            key = cat['key_id']
            vendor_col = f'{key}_vendor'
            if key in columns and vendor_col in columns:
                subqueries.append(
                    f"SELECT {vendor_col} as vendor, {key} as amount FROM transactions "
                    f"WHERE deleted_at IS NULL AND {vendor_col} IS NOT NULL AND {vendor_col} != '' AND {key} > 0"
                )

        if not subqueries:
            return jsonify([]), 200

        union_query = ' UNION ALL '.join(subqueries)
        final_query = f'''
            SELECT vendor, SUM(amount) as total, COUNT(*) as paymentCount
            FROM ({union_query}) as combined
            GROUP BY vendor
            ORDER BY total DESC
        '''
        results = execute_query(final_query, fetch=True)

        return jsonify([
            {'vendor': r['vendor'], 'total': float(r['total'] or 0), 'paymentCount': r['paymentCount']}
            for r in (results or [])
        ]), 200
    except Exception as e:
        print(f"Error calculating vendor totals: {e}")
        return jsonify({'error': str(e)}), 500
