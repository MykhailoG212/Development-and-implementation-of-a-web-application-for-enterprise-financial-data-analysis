from flask import Blueprint, request, jsonify, session
from datetime import datetime, date, timedelta
import calendar
from flask_login import login_required, current_user

api_bp = Blueprint('api', __name__, url_prefix='/api')

mongo = None

def set_mongo(mongo_instance):
    global mongo
    mongo = mongo_instance

@api_bp.route('/finance', methods=['POST'])
@login_required
def add_record():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Дані не надані'}), 400
        
        required_fields = ['date', 'category', 'amount', 'type']
        for field in required_fields:
            if field not in data or data[field] == '' or data[field] is None:
                return jsonify({'error': f'Відсутнє обов\'язкове поле: {field}'}), 400
        
        if data['type'] not in ['income', 'expense']:
            return jsonify({'error': 'Тип має бути "income" або "expense"'}), 400
        
        try:
            amount = float(data['amount'])
            if amount < 0:
                return jsonify({'error': 'Сума має бути позитивною'}), 400
        except (ValueError, TypeError):
            return jsonify({'error': 'Невірний формат суми'}), 400
        
        record = {
            'user_id': current_user.id,
            'date': str(data['date']),
            'category': str(data['category']),
            'amount': amount,
            'type': str(data['type']),
            'description': str(data.get('description', '')),
            'created_at': datetime.utcnow()
        }
        
        result = mongo.db.finance.insert_one(record)
        return jsonify({'id': str(result.inserted_id), 'message': 'Запис успішно доданий'}), 201
        
    except Exception as e:
        print(f"Помилка при додаванні запису: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/finance', methods=['GET'])
@login_required
def get_records():
    try:
        filter_type = request.args.get('filter')
        
        query = {'user_id': current_user.id}
        if filter_type == 'monthly':
            now = datetime.now()
            start_of_month = datetime(now.year, now.month, 1)
            query['date'] = {'$gte': start_of_month.strftime('%Y-%m-%d')}
        elif filter_type == 'yearly':
            now = datetime.now()
            start_of_year = datetime(now.year, 1, 1)
            query['date'] = {'$gte': start_of_year.strftime('%Y-%m-%d')}
        
        records = list(mongo.db.finance.find(query).sort('date', -1))
        for record in records:
            record['_id'] = str(record['_id'])
        return jsonify(records), 200
    except Exception as e:
        print(f"Помилка при отриманні записів: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/metrics', methods=['GET'])
@login_required
def get_metrics():
    try:
        filter_type = request.args.get('filter')
        
        query = {'user_id': current_user.id}
        if filter_type == 'monthly':
            now = datetime.now()
            start_of_month = datetime(now.year, now.month, 1)
            query['date'] = {'$gte': start_of_month.strftime('%Y-%m-%d')}
        elif filter_type == 'yearly':
            now = datetime.now()
            start_of_year = datetime(now.year, 1, 1)
            query['date'] = {'$gte': start_of_year.strftime('%Y-%m-%d')}
        
        records = list(mongo.db.finance.find(query))
        metrics = calculate_metrics(records)
        return jsonify(metrics), 200
    except Exception as e:
        print(f"Помилка при отриманні показників: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/chart_data', methods=['GET'])
@login_required
def get_chart_data():
    try:
        filter_type = request.args.get('filter', 'monthly')
        
        all_user_records = list(mongo.db.finance.find({'user_id': current_user.id}).sort('date', 1))

        if not all_user_records:
            return jsonify({
                'labels': [],
                'incomeData': [],
                'expenseData': []
            }), 200

        chart_data = group_records_for_chart(all_user_records, filter_type)
        
        return jsonify(chart_data), 200
    except Exception as e:
        print(f"Помилка при отриманні даних для графіків: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/finance/<record_id>', methods=['DELETE'])
@login_required
def delete_record(record_id):
    try:
        from bson.objectid import ObjectId
        result = mongo.db.finance.delete_one({'_id': ObjectId(record_id), 'user_id': current_user.id})
        if result.deleted_count == 1:
            return jsonify({'message': 'Запис успішно видалений'}), 200
        else:
            return jsonify({'error': 'Запис не знайдено або недостатньо прав'}), 404
    except Exception as e:
        print(f"Помилка при видаленні запису: {str(e)}")
        return jsonify({'error': str(e)}), 500

@api_bp.route('/finance/<record_id>', methods=['PUT'])
@login_required
def update_record(record_id):
    try:
        from bson.objectid import ObjectId
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Дані не надані'}), 400

        update_fields = {}
        if 'date' in data:
            update_fields['date'] = str(data['date'])
        if 'category' in data:
            update_fields['category'] = str(data['category'])
        if 'amount' in data:
            try:
                amount = float(data['amount'])
                if amount < 0:
                    return jsonify({'error': 'Сума має бути позитивною'}), 400
                update_fields['amount'] = amount
            except (ValueError, TypeError):
                return jsonify({'error': 'Невірний формат суми'}), 400
        if 'type' in data:
            if data['type'] not in ['income', 'expense']:
                return jsonify({'error': 'Тип має бути "income" або "expense"'}), 400
            update_fields['type'] = str(data['type'])
        if 'description' in data:
            update_fields['description'] = str(data['description'])

        if not update_fields:
            return jsonify({'message': 'Немає даних для оновлення'}), 200

        result = mongo.db.finance.update_one(
            {'_id': ObjectId(record_id), 'user_id': current_user.id},
            {'$set': update_fields}
        )

        if result.matched_count == 1:
            return jsonify({'message': 'Запис успішно оновлений'}), 200
        else:
            return jsonify({'error': 'Запис не знайдено або недостатньо прав'}), 404

    except Exception as e:
        print(f"Помилка при оновленні запису: {str(e)}")
        return jsonify({'error': str(e)}), 500

def calculate_metrics(records):
    if not records:
        return {
            'total_income': 0,
            'total_expenses': 0,
            'profit': 0,
            'profit_margin': 0,
            'expense_ratio': 0,
            'record_count': 0
        }
    
    total_income = sum(r.get('amount', 0) for r in records if r.get('type') == 'income')
    total_expenses = sum(r.get('amount', 0) for r in records if r.get('type') == 'expense')
    profit = total_income - total_expenses
    
    profit_margin = (profit / total_income * 100) if total_income > 0 else 0
    expense_ratio = (total_expenses / total_income * 100) if total_income > 0 else 0
    
    return {
        'total_income': round(total_income, 2),
        'total_expenses': round(total_expenses, 2),
        'profit': round(profit, 2),
        'profit_margin': round(profit_margin, 2),
        'expense_ratio': round(expense_ratio, 2),
        'record_count': len(records)
    }

def group_records_for_chart(all_records, filter_type):
    filtered_records = []
    now = datetime.now()

    if filter_type == 'monthly':
        for record in all_records:
            record_date = datetime.strptime(record['date'], '%Y-%m-%d')
            if record_date.year == now.year and record_date.month == now.month:
                filtered_records.append(record)
        
        num_days = calendar.monthrange(now.year, now.month)[1]
        labels = [str(d) for d in range(1, num_days + 1)]
        
        grouped_data = {d: {'income': 0, 'expense': 0} for d in range(1, num_days + 1)}
        for record in filtered_records:
            record_date = datetime.strptime(record['date'], '%Y-%m-%d')
            day = record_date.day
            if record['type'] == 'income':
                grouped_data[day]['income'] += record['amount']
            else:
                grouped_data[day]['expense'] += record['amount']
        
        income_data = [round(grouped_data[d]['income'], 2) for d in range(1, num_days + 1)]
        expense_data = [round(grouped_data[d]['expense'], 2) for d in range(1, num_days + 1)]

    elif filter_type == 'yearly':
        for record in all_records:
            record_date = datetime.strptime(record['date'], '%Y-%m-%d')
            if record_date.year == now.year:
                filtered_records.append(record)

        month_names_uk = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"]
        labels = month_names_uk
        
        grouped_data = {m: {'income': 0, 'expense': 0} for m in range(1, 13)}
        for record in filtered_records:
            record_date = datetime.strptime(record['date'], '%Y-%m-%d')
            month = record_date.month
            if record['type'] == 'income':
                grouped_data[month]['income'] += record['amount']
            else:
                grouped_data[month]['expense'] += record['amount']
        
        income_data = [round(grouped_data[m]['income'], 2) for m in range(1, 13)]
        expense_data = [round(grouped_data[m]['expense'], 2) for m in range(1, 13)]

    else:
        filtered_records = all_records

        grouped_data_by_year = {}
        for record in filtered_records:
            record_date = datetime.strptime(record['date'], '%Y-%m-%d')
            year = record_date.year
            if year not in grouped_data_by_year:
                grouped_data_by_year[year] = {'income': 0, 'expense': 0}
            
            if record['type'] == 'income':
                grouped_data_by_year[year]['income'] += record['amount']
            else:
                grouped_data_by_year[year]['expense'] += record['amount']
        
        sorted_years = sorted(grouped_data_by_year.keys())
        labels = [str(year) for year in sorted_years]
        income_data = [round(grouped_data_by_year[year]['income'], 2) for year in sorted_years]
        expense_data = [round(grouped_data_by_year[year]['expense'], 2) for year in sorted_years]

    return {
        'labels': labels,
        'incomeData': income_data,
        'expenseData': expense_data
    }