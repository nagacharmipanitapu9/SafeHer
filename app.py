from flask import Flask, redirect, render_template, session
from database import init_db
from routes.auth import auth_bp
from routes.crime import crime_bp
from routes.sos import sos_bp
from routes.admin import admin_bp
from routes.chatbot import chatbot_bp
from routes.shuttle import shuttle_bp

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this'

# Register Blueprints
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(crime_bp, url_prefix='/crime')
app.register_blueprint(sos_bp, url_prefix='/sos')
app.register_blueprint(admin_bp, url_prefix='/admin')
app.register_blueprint(chatbot_bp, url_prefix='/chatbot')
app.register_blueprint(shuttle_bp, url_prefix='/shuttle')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect('/auth/login')
    return render_template('dashboard.html')

if __name__ == '__main__':
    init_db()
    app.run(debug=True)
    
