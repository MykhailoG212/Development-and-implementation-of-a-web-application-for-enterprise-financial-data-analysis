import os
from flask import Flask, jsonify
from flask_pymongo import PyMongo
from flask_cors import CORS
from flask_login import LoginManager, current_user
from bson.objectid import ObjectId

from backend.routes.api import api_bp, set_mongo as set_api_mongo
from backend.routes.auth import auth_bp, set_mongo as set_auth_mongo
from backend.config import Config
from backend.models.user import User

app = Flask(__name__)
app.config.from_object(Config)

app.config['SESSION_COOKIE_SAMESITE'] = 'Lax' 
app.config['SESSION_COOKIE_SECURE'] = False 

mongo = PyMongo(app)

set_api_mongo(mongo)
set_auth_mongo(mongo)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

@login_manager.user_loader
def load_user(user_id):
    """Ця функція потрібна Flask-Login для завантаження користувача із сесії"""
    if not user_id:
        return None
    try:
        user_data = mongo.db.users.find_one({'_id': ObjectId(user_id)})
        return User.from_mongo(user_data)
    except Exception as e:
        print(f"Error loading user: {e}")
        return None

CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}}, supports_credentials=True)

app.register_blueprint(api_bp)
app.register_blueprint(auth_bp)

@app.route('/')
def index():
    return jsonify({'message': 'API is running'}), 200

@app.errorhandler(401)
def unauthorized(error):
    return jsonify({'error': 'Unauthorized'}), 401

@app.errorhandler(500)
def internal_error(error):
    print(f"Internal Server Error: {error}")
    return jsonify({'error': 'Server Error'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)