from mongoengine import Document, StringField, FloatField, DateTimeField
from enum import Enum

class RecordType(str, Enum):
    INCOME = 'income'
    EXPENSE = 'expense'

class FinancialRecord(Document):
    date = StringField(required=True)
    category = StringField(required=True)
    amount = FloatField(required=True)
    type = StringField(choices=['income', 'expense'], required=True)
    description = StringField()
    
    meta = {'collection': 'finance'}
    
    def to_dict(self):
        return {
            'date': self.date,
            'category': self.category,
            'amount': self.amount,
            'type': self.type,
            'description': self.description
        }