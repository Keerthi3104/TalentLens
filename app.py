# ══════════════════════════════════════════════════════════════
#  TalentLens — Python Flask Backend
#  File: app.py
#
#  Final Year Project
#  Created by: Sivasakthi K, Janani C, Keerthika K, Keerthika R
#  Annamalai University, Chidambaram, Cuddalore Dist
# ══════════════════════════════════════════════════════════════

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import sqlite3
import random
import os
from datetime import date

app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(__file__), 'talentlens.db')


# ══════════════════════════════════════════════════════════════
#  DATABASE
# ══════════════════════════════════════════════════════════════

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS applicants (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id     TEXT    NOT NULL,
            name           TEXT    NOT NULL,
            email          TEXT    NOT NULL,
            phone          TEXT,
            experience     INTEGER DEFAULT 0,
            skills         TEXT,
            linkedin       TEXT,
            github         TEXT,
            cover          TEXT,
            resume_score   INTEGER DEFAULT 0,
            linkedin_score INTEGER DEFAULT 0,
            github_score   INTEGER DEFAULT 0,
            overall_score  INTEGER DEFAULT 0,
            status         TEXT    DEFAULT 'new',
            applied        TEXT,
            UNIQUE(company_id, email)
        )
    ''')

    c.execute('SELECT COUNT(*) FROM applicants')
    if c.fetchone()[0] == 0:
        demo = [
            ('tcs',  'Priya Venkat',  'priya@mail.com',   '9876543210', 4, 'React, Node.js, AWS',       'https://linkedin.com/in/priyavenkat',  'https://github.com/priyav',   'Passionate full-stack developer.',  88, 82, 91, 87, 'shortlisted', '2024-01-15'),
            ('tcs',  'Karthik Rajan', 'karthik@mail.com', '9876543211', 3, 'Python, Django, PostgreSQL', 'https://linkedin.com/in/karthikrajan', 'https://github.com/karthikr', 'Backend engineer.',                 75, 68, 80, 74, 'reviewed',    '2024-01-16'),
            ('tcs',  'Sneha Pillai',  'sneha@mail.com',   '9876543212', 2, 'Vue.js, Laravel, MySQL',     '',                                     'https://github.com/snehap',   'Frontend developer.',               65, 72, 60, 66, 'new',         '2024-01-17'),
            ('tcs',  'Dev Kumar',     'dev@mail.com',     '9876543213', 5, 'Java, Spring Boot, Kafka',   'https://linkedin.com/in/devkumar',     'https://github.com/devkumar', 'Senior Java engineer.',             91, 85, 88, 88, 'new',         '2024-01-18'),
            ('hcl',  'Ananya Rathi',  'ananya@mail.com',  '9876543214', 3, 'Angular, .NET, Azure',       'https://linkedin.com/in/ananyarathi',  '',                            'Full stack developer.',             78, 74, 70, 74, 'new',         '2024-01-15'),
            ('hcl',  'Rahul Sharma',  'rahul@mail.com',   '9876543215', 6, 'Kubernetes, Docker, CI/CD',  'https://linkedin.com/in/rahulsharma',  'https://github.com/rahuls',   'DevOps engineer.',                  85, 80, 92, 86, 'new',         '2024-01-16'),
        ]
        c.executemany('''
            INSERT OR IGNORE INTO applicants
            (company_id,name,email,phone,experience,skills,linkedin,github,cover,
             resume_score,linkedin_score,github_score,overall_score,status,applied)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''', demo)
        conn.commit()
        print(f"[DB] Seeded {len(demo)} demo applicants.")

    conn.close()
    print(f"[DB] Ready → {DB_PATH}")


# ══════════════════════════════════════════════════════════════
#  SCORING ENGINE
# ══════════════════════════════════════════════════════════════

def calculate_scores(experience, skills, linkedin, github, summary=''):
    exp        = int(experience) if experience else 0
    is_fresher = exp == 0
    skill_list = [s.strip() for s in skills.split(',') if s.strip()] if skills else []
    sc         = len(skill_list)

    resume_score   = min(95, 45 + exp*4 + sc*2 + (5 if summary else 0) + (5 if is_fresher else 0))
    linkedin_score = min(90, 58 + random.randint(0, 17)) if linkedin else 18
    github_score   = min(93, 60 + random.randint(0, 19)) if github   else 15
    overall        = round((resume_score + linkedin_score + github_score) / 3)

    rs = resume_score
    gh = github_score
    role_fit = [
        {'name': 'Business Analyst',     'percent': max(0, min(100, rs - 8))},
        {'name': 'Backend Developer',    'percent': max(0, min(100, gh + 12))},
        {'name': 'Frontend Developer',   'percent': max(0, min(100, gh + 8))},
        {'name': 'Full Stack Developer', 'percent': max(0, min(100, (rs + gh) // 2))},
        {'name': 'QA / Tester',          'percent': max(0, min(100, rs - 18))},
        {'name': 'DevOps Engineer',      'percent': max(0, min(100, gh - 5))},
        {'name': 'Data Engineer',        'percent': max(0, min(100, rs - 15))},
    ]

    suggestions = []
    if linkedin:
        suggestions.append('Add 3–5 quantified achievements to your LinkedIn (e.g., "Improved API latency by 40%").')
    else:
        suggestions.append('⚠ LinkedIn URL missing — a complete profile increases recruiter visibility by 3×.')
    if github:
        suggestions.append('Pin your top repositories and write descriptive READMEs with tech stack and setup instructions.')
    else:
        suggestions.append('⚠ GitHub URL missing — add public projects to prove coding ability to recruiters.')
    if sc < 6:
        suggestions.append('Expand skills list to 8–12 entries covering languages, frameworks, tools and cloud platforms.')
    else:
        suggestions.append('Great skill breadth! Group by category (Languages, Frameworks, Cloud, Databases) for ATS parsing.')
    if is_fresher:
        suggestions.append('🌱 As a fresher, highlight academic projects, internships, hackathons and certifications prominently.')
    elif exp < 3:
        suggestions.append('Supplement experience with open-source contributions, hackathons, or freelance projects.')
    else:
        suggestions.append('Restructure experience bullets using STAR format: Situation → Task → Action → Result.')
    suggestions.append('Ensure your resume passes ATS: use standard headings, avoid columns/tables, and save as PDF.')

    return {
        'scores':      {'resume': resume_score, 'linkedin': linkedin_score, 'github': github_score},
        'overall':     overall,
        'roleFit':     role_fit,
        'suggestions': suggestions
    }


# ══════════════════════════════════════════════════════════════
#  ROUTES — Pages
# ══════════════════════════════════════════════════════════════

@app.route('/')
def index():
    return render_template('index.html')


# ══════════════════════════════════════════════════════════════
#  ROUTES — API
# ══════════════════════════════════════════════════════════════

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'message': 'TalentLens Flask backend is running!'})


@app.route('/api/score', methods=['POST'])
def score():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data'}), 400
    if not data.get('name') or not data.get('email'):
        return jsonify({'error': 'Name and email required'}), 400

    result = calculate_scores(
        data.get('exp', 0),
        data.get('skills', ''),
        data.get('li', ''),
        data.get('gh', ''),
        data.get('summary', '')
    )
    return jsonify(result)


@app.route('/api/applicants/counts')
def get_counts():
    conn = get_db()
    rows = conn.execute('SELECT company_id, COUNT(*) as cnt FROM applicants GROUP BY company_id').fetchall()
    conn.close()
    return jsonify({r['company_id']: r['cnt'] for r in rows})


@app.route('/api/applicants/<company_id>')
def get_applicants(company_id):
    conn = get_db()
    rows = conn.execute(
        'SELECT * FROM applicants WHERE company_id=? ORDER BY overall_score DESC',
        (company_id,)
    ).fetchall()
    conn.close()
    return jsonify({
        'company_id': company_id,
        'count': len(rows),
        'applicants': [{
            'id':         r['id'],
            'name':       r['name'],
            'email':      r['email'],
            'phone':      r['phone'],
            'experience': r['experience'],
            'skills':     r['skills'],
            'li':         r['linkedin'],
            'gh':         r['github'],
            'cover':      r['cover'],
            'scores':     {'resume': r['resume_score'], 'linkedin': r['linkedin_score'], 'github': r['github_score']},
            'overall':    r['overall_score'],
            'status':     r['status'],
            'applied':    r['applied'],
        } for r in rows]
    })


@app.route('/api/apply', methods=['POST'])
def apply():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data'}), 400

    company_id = data.get('company_id')
    name       = data.get('name', '').strip()
    email      = data.get('email', '').strip()
    phone      = data.get('phone', '').strip()

    if not all([company_id, name, email, phone]):
        return jsonify({'error': 'company_id, name, email and phone are required'}), 400

    experience = int(data.get('experience', 0))
    skills     = data.get('skills', '')
    linkedin   = data.get('linkedin', '')
    github     = data.get('github', '')
    cover      = data.get('cover', '')

    result  = calculate_scores(experience, skills, linkedin, github)
    scores  = result['scores']
    overall = result['overall']

    conn = get_db()
    c    = conn.cursor()

    c.execute('SELECT id FROM applicants WHERE company_id=? AND email=?', (company_id, email))
    if c.fetchone():
        conn.close()
        return jsonify({'error': 'You have already applied to this company.'}), 409

    c.execute('''
        INSERT INTO applicants
        (company_id,name,email,phone,experience,skills,linkedin,github,cover,
         resume_score,linkedin_score,github_score,overall_score,status,applied)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ''', (company_id, name, email, phone, experience, skills, linkedin, github, cover,
          scores['resume'], scores['linkedin'], scores['github'], overall, 'new', str(date.today())))
    conn.commit()
    new_id = c.lastrowid
    conn.close()

    return jsonify({
        'success': True,
        'message': f'Application submitted!',
        'applicant': {'id': new_id, 'name': name, 'email': email, 'scores': scores, 'overall': overall}
    }), 201


@app.route('/api/applicants/<int:applicant_id>/status', methods=['PATCH'])
def update_status(applicant_id):
    data   = request.get_json()
    status = data.get('status', 'new')
    if status not in ['new', 'reviewed', 'shortlisted', 'rejected']:
        return jsonify({'error': 'Invalid status'}), 400
    conn = get_db()
    conn.execute('UPDATE applicants SET status=? WHERE id=?', (status, applicant_id))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'id': applicant_id, 'status': status})


@app.route('/api/applicants/<company_id>/clear', methods=['DELETE'])
def clear_applicants(company_id):
    conn = get_db()
    c    = conn.cursor()
    c.execute('SELECT COUNT(*) FROM applicants WHERE company_id=?', (company_id,))
    count = c.fetchone()[0]
    c.execute('DELETE FROM applicants WHERE company_id=?', (company_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'deleted': count})


# ══════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    init_db()
    print("\n" + "="*55)
    print("  🎯 TalentLens — Flask Backend")
    print("  Open browser: http://127.0.0.1:5000")
    print("="*55)
    app.run(debug=True, port=5000)
