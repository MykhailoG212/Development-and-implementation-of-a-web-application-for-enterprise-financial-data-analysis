from flask_login import UserMixin
from werkzeug.security import check_password_hash
from bson.objectid import ObjectId

class User(UserMixin):
    def __init__(self, id, username, password_hash):
        self.id = str(id)
        self.username = username
        self.password_hash = password_hash

    @staticmethod
    def from_mongo(user_data):
        """Створює об'єкт User із словника MongoDB"""
        if user_data:
            pwd = user_data.get('password') or user_data.get('password_hash')
            return User(
                id=user_data['_id'], 
                username=user_data['username'], 
                password_hash=pwd
            )
        return None

    def verify_password(self, password):
        return check_password_hash(self.password_hash, password)

    def get_id(self):
        return str(self.id)

    def __repr__(self):
        return f'<User {self.username}>'