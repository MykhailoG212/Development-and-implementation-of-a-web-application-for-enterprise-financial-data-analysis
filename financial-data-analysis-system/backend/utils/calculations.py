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
    
    total_income = sum(r['amount'] for r in records if r['type'] == 'income')
    total_expenses = sum(r['amount'] for r in records if r['type'] == 'expense')
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