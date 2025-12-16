from pymongo import MongoClient
import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your_secret_key'
    MONGO_URI = os.environ.get('MONGO_URI') or "mongodb://mongodb:27017/finanal_db"
    DEBUG = True