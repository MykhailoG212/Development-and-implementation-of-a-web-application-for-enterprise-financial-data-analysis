from flask import Blueprint, request, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash
from backend.models.user import User
from bson.objectid import ObjectId

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

mongo = None

def set_mongo(mongo_instance):
    """Встановлює екземпляр MongoDB для використання в цьому Blueprint."""
    global mongo
    mongo = mongo_instance

@auth_bp.route('/register', methods=['POST'])
def register():
    """Реєстрація нового користувача."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Будь ласка, введіть ім\'я користувача та пароль.'}), 400

    if mongo.db.users.find_one({'username': username}):
        return jsonify({'error': 'Користувач з таким ім\'ям вже існує.'}), 409

    hashed_password = generate_password_hash(password)
    new_user_data = {
        'username': username,
        'password': hashed_password      }
    result = mongo.db.users.insert_one(new_user_data)
    
    user = User(result.inserted_id, username, hashed_password)
    login_user(user)
    session['user_id'] = str(user.id) 
    
    return jsonify({'message': 'Реєстрація успішна!', 'username': username}), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    """Вхід існуючого користувача."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Будь ласка, введіть ім\'я користувача та пароль.'}), 400

    user_data = mongo.db.users.find_one({'username': username})
    
    if user_data:
        user = User.from_mongo(user_data)
        if user.verify_password(password):
            login_user(user)
            session['user_id'] = str(user.id) 
            return jsonify({'message': 'Вхід успішний!', 'username': username}), 200
        else:
            return jsonify({'error': 'Невірний пароль.'}), 401
    else:
        return jsonify({'error': 'Користувач не знайдений.'}), 401

@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """Вихід поточного користувача."""
    logout_user()
    session.pop('user_id', None)
    return jsonify({'message': 'Вихід успішний!'}), 200

@auth_bp.route('/delete_account', methods=['DELETE'])
@login_required
def delete_account():
    """Видалення облікового запису поточного користувача."""
    try:
        user_id_to_delete = current_user.id
        
        mongo.db.finance.delete_many({'user_id': str(user_id_to_delete)})
        
        mongo.db.users.delete_one({'_id': ObjectId(user_id_to_delete)})
        
        logout_user() 
        session.pop('user_id', None)
        return jsonify({'message': 'Обліковий запис успішно видалено!'}), 200
    except Exception as e:
        print(f"Error deleting account: {e}")
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/status', methods=['GET'])
def get_auth_status():
    """Перевіряє статус авторизації користувача."""
    if current_user.is_authenticated:
        return jsonify({'isAuthenticated': True, 'username': current_user.username}), 200
    else:
        return jsonify({'isAuthenticated': False}), 200